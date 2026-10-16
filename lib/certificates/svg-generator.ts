// ============================================================
// SVG Certificate Template Generator (Vector IBM Plex Mono)
// ============================================================
//
// Converts all certificate text into pure vector SVG <path> elements
// using the local IBM Plex Mono TTF font files.
//
// WHY VECTOR PATHS:
// - Eliminates system font dependency completely (no Times New Roman fallback)
// - 100% identical in browser, PDF, mobile, print, and librsvg/sharp
// - Perfectly sharp vector rendering at any scale or DPI
//
// ============================================================

import fs from "fs/promises";
import path from "path";
import { parse, type Font } from "opentype.js";

export interface SvgCertificateInput {
  participantName: string;
  eventTitle: string;
  eventDate: string;
  signerName?: string;
  signerTitle?: string;
  certificateId: string;
  qrDataUri?: string;
  signatureDataUri?: string;
}

/**
 * SVG canvas dimensions (from the Certificate-Template.svg viewBox).
 * Used for coordinate mapping between SVG space and PDF page space.
 */
export const SVG_CANVAS = { width: 3300, height: 2550 } as const;

/**
 * The raw SVG-space position of the Certificate ID text line.
 * x=220 (left-aligned), y=2285 (baseline).
 */
export const CERT_ID_SVG_POSITION = { x: 220, y: 2285 } as const;

/**
 * The raw SVG-space position of the verification URL text line.
 * x=220 (left-aligned, same as certId block), y=2330 (baseline).
 */
export const VERIFY_URL_SVG_POSITION = { x: 220, y: 2330 } as const;

/** Returns the Certificate ID text as it appears on the certificate. */
export function buildCertIdText(certificateId: string): string {
  return `Certificate ID: ${certificateId}`;
}

/** Returns the full verification URL text as it appears on the certificate. */
export function buildVerifyUrlText(certificateId: string): string {
  return `Verify Certificate: https://awstulas.org/verify/${certificateId}`;
}

let cachedTemplateSvg: string | null = null;
let cachedBoldFont: Font | null = null;
let cachedRegFont: Font | null = null;
let cachedSignatureDataUri: string | null = null;

/**
 * Loads and caches the base SVG template.
 */
export async function getBaseSvgTemplate(): Promise<string> {
  if (cachedTemplateSvg) return cachedTemplateSvg;

  const templatePath = path.join(
    process.cwd(),
    "public",
    "templates",
    "Certificate-Template.svg"
  );

  try {
    cachedTemplateSvg = await fs.readFile(templatePath, "utf8");
    return cachedTemplateSvg;
  } catch (err) {
    console.error("[SvgGenerator] Failed to read Certificate-Template.svg:", err);
    throw new Error(`SVG template not found at ${templatePath}`);
  }
}

/**
 * Loads and caches local IBM Plex Mono fonts for vector path generation.
 */
async function getFonts(): Promise<{ boldFont: Font; regFont: Font }> {
  if (cachedBoldFont && cachedRegFont) {
    return { boldFont: cachedBoldFont, regFont: cachedRegFont };
  }

  const boldPath = path.join(
    process.cwd(),
    "public",
    "fonts",
    "IBM_Plex_Mono",
    "IBMPlexMono-Bold.ttf"
  );
  const regPath = path.join(
    process.cwd(),
    "public",
    "fonts",
    "IBM_Plex_Mono",
    "IBMPlexMono-Regular.ttf"
  );

  const [boldBuf, regBuf] = await Promise.all([
    fs.readFile(boldPath),
    fs.readFile(regPath),
  ]);

  cachedBoldFont = parse(
    boldBuf.buffer.slice(boldBuf.byteOffset, boldBuf.byteOffset + boldBuf.byteLength)
  );
  cachedRegFont = parse(
    regBuf.buffer.slice(regBuf.byteOffset, regBuf.byteOffset + regBuf.byteLength)
  );

  return { boldFont: cachedBoldFont, regFont: cachedRegFont };
}

/**
 * Loads and returns the signature image as a base64 data URI.
 */
async function getSignatureDataUri(): Promise<string | null> {
  if (cachedSignatureDataUri) return cachedSignatureDataUri;

  const sigPath = path.join(process.cwd(), "public", "Lingwal_Sign.png");
  try {
    const buf = await fs.readFile(sigPath);
    cachedSignatureDataUri = `data:image/png;base64,${buf.toString("base64")}`;
    return cachedSignatureDataUri;
  } catch {
    console.warn("[SvgGenerator] Signature image not found, skipping.");
    return null;
  }
}

/**
 * Serializes an opentype.js Path into a valid, bulletproof SVG path data string.
 *
 * CRITICAL FIX:
 * opentype.js built-in `path.toPathData()` has a known bug in `roundDecimal` where
 * numbers in exponential notation (e.g. 2.84e-14) produce "2.84e-14e+2", which
 * evaluates to NaN (e.g. "QNaN 85.69"). SVG rasterizers (sharp, librsvg, browsers)
 * immediately abort rendering the path at NaN, causing text to vanish!
 * This custom serializer safely rounds numbers and guarantees zero NaNs.
 */
function pathToSvgPathData(path: any, precision: number = 2): string {
  const factor = Math.pow(10, precision);
  const round = (val: number): string => {
    if (!Number.isFinite(val)) return "0";
    const rounded = Math.round(val * factor) / factor;
    return rounded.toString();
  };

  let d = "";
  for (let i = 0; i < path.commands.length; i++) {
    const cmd = path.commands[i];
    switch (cmd.type) {
      case "M":
        d += `M${round(cmd.x)} ${round(cmd.y)}`;
        break;
      case "L":
        d += `L${round(cmd.x)} ${round(cmd.y)}`;
        break;
      case "Q":
        d += `Q${round(cmd.x1)} ${round(cmd.y1)} ${round(cmd.x)} ${round(cmd.y)}`;
        break;
      case "C":
        d += `C${round(cmd.x1)} ${round(cmd.y1)} ${round(cmd.x2)} ${round(cmd.y2)} ${round(cmd.x)} ${round(cmd.y)}`;
        break;
      case "Z":
        d += "Z";
        break;
    }
  }
  return d;
}

/**
 * Converts a text string into a centered SVG <path> element.
 */
function textToSvgPath(
  font: Font,
  text: string,
  centerX: number,
  y: number,
  fontSize: number,
  fill: string
): string {
  const width = font.getAdvanceWidth(text, fontSize);
  const x = centerX - width / 2;
  const path = font.getPath(text, x, y, fontSize);
  const pathData = pathToSvgPathData(path, 2);
  return `<path d="${pathData}" fill="${fill}" />`;
}

/**
 * Converts a text string into a left-aligned SVG <path> element.
 */
function textToSvgPathLeft(
  font: Font,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  fill: string
): string {
  const path = font.getPath(text, x, y, fontSize);
  const pathData = pathToSvgPathData(path, 2);
  return `<path d="${pathData}" fill="${fill}" />`;
}

/**
 * Calculates optimal font size for participant name to ensure it fits within maxWidth.
 */
function getFittingFontSize(
  font: Font,
  text: string,
  baseFontSize: number,
  maxWidth: number
): number {
  const w = font.getAdvanceWidth(text, baseFontSize);
  if (w <= maxWidth) return baseFontSize;
  return Math.floor((maxWidth / w) * baseFontSize);
}

/**
 * Generates the full dynamic SVG string with 100% vector IBM Plex Mono glyphs.
 *
 * Certificate layout (right panel, centered at x=2475):
 *   y=1280  "This certificate is proudly presented to"
 *   y=1430  {{PARTICIPANT_NAME}}  (bold, large)
 *   y=1540  "in recognition of their participation in"
 *   y=1650  {{EVENT_NAME}}  (bold, amber)
 *   y=1750  "conducted by AWS Student Builder Group at Tulas University"
 *   y=1830  "on {{DATE}}"
 *
 *   y=1980  Certificate ID: {{ID}}
 *   y=2050  [QR CODE]  (left panel, x=220)
 *   y=2100  Verify Certificate  (label)
 *   y=2150  {{VERIFICATION_URL}}
 *
 *   y=2100  Signature image (left bottom)
 *   y=2148  Signature line
 *   y=2195  Signer Name
 *   y=2250  Signer Title
 */
export async function generateCertificateSvg(
  input: SvgCertificateInput
): Promise<string> {
  const [{ boldFont, regFont }, baseSvg, signatureDataUri] = await Promise.all([
    getFonts(),
    getBaseSvgTemplate(),
    input.signatureDataUri ? Promise.resolve(input.signatureDataUri) : getSignatureDataUri(),
  ]);

  const participantName = input.participantName.trim();
  const eventTitle = input.eventTitle.trim();
  const eventDate = input.eventDate.trim();
  const signerName = input.signerName?.trim() || "Piyush Lingwal";
  const signerTitle = input.signerTitle?.trim() || "Community Program Manager";
  const signerOrg = "AWS Student Builder Group";
  const certificateId = input.certificateId.trim();

  // ── Right panel center X ──────────────────────────────────────
  const cx = 2475;

  // 1. "This certificate is proudly presented to"
  const line1 = "This certificate is proudly presented to";
  const line1Size = getFittingFontSize(regFont, line1, 34, 1180);
  const line1Path = textToSvgPath(regFont, line1, cx, 1295, line1Size, "#555555");

  // 2. Participant Name (bold, large)
  const nameSize = getFittingFontSize(boldFont, participantName, 96, 1200);
  const namePath = textToSvgPath(boldFont, participantName, cx, 1460, nameSize, "#161D26");

  // 3. "in recognition of their participation in"
  const line3 = "in recognition of their participation in";
  const line3Size = getFittingFontSize(regFont, line3, 34, 1180);
  const line3Path = textToSvgPath(regFont, line3, cx, 1568, line3Size, "#555555");

  // 4. Event Name (bold, amber)
  const eventSize = getFittingFontSize(boldFont, eventTitle, 52, 1200);
  const eventPath = textToSvgPath(boldFont, eventTitle, cx, 1668, eventSize, "#FF9900");

  // 5. "conducted by AWS Student Builder Group at Tulas University"
  const line5 = "conducted by AWS Student Builder Group at Tulas University";
  const line5Size = getFittingFontSize(regFont, line5, 28, 1200);
  const line5Path = textToSvgPath(regFont, line5, cx, 1762, line5Size, "#444444");

  // 6. "on {{DATE}}"
  const line6 = `on ${eventDate}`;
  const line6Size = getFittingFontSize(boldFont, line6, 32, 1180);
  const line6Path = textToSvgPath(boldFont, line6, cx, 1840, line6Size, "#444444");

  // ── Bottom-left: QR code + Certificate ID + Verify block ────────
  // QR image placed at x=220, y=2010. Certificate ID placed directly below QR.
  const qrImageXml = input.qrDataUri
    ? `<image href="${input.qrDataUri}" x="220" y="2010" width="230" height="230" />`
    : `<rect x="220" y="2010" width="230" height="230" fill="#F4F4F6" stroke="#DEDEE3" stroke-width="2" rx="8"/><text x="335" y="2135" text-anchor="middle" font-family="monospace" font-size="24" fill="#888">[QR]</text>`;

  // NOTE: Both the Certificate ID and the Verification URL are intentionally NOT rendered
  // into the SVG path raster here. They are overlaid as real, selectable PDF text
  // by the pdf-generator. This ensures both lines are 100% selectable and copy-pasteable.
  const qrAndMetaXml = `
    <g id="dynamic-verification-meta">
      ${qrImageXml}
    </g>
  `;

  // ── Signer block ───────────────────────────────────────────────
  // Signature image centered above the line at cx = 2475
  const sigImgXml = signatureDataUri
    ? `<image href="${signatureDataUri}" x="2295" y="2005" width="360" height="130" preserveAspectRatio="xMidYMid meet" />`
    : "";

  // Signer name removed per user request: "Remove the name Piyush Lingwal from there only keep the signature."
  const signerTitleSize = getFittingFontSize(regFont, signerTitle, 28, 580);
  const signerTitlePath = textToSvgPath(regFont, signerTitle, cx, 2210, signerTitleSize, "#555555");

  const signerOrgSize = getFittingFontSize(regFont, signerOrg, 28, 580);
  const signerOrgPath = textToSvgPath(regFont, signerOrg, cx, 2258, signerOrgSize, "#555555");

  // Replace placeholders in baseSvg with pure vector glyph paths
  const resultSvg = baseSvg
    .replace(/<rect x="2029" y="2148" width="882" height="2" fill="#161d26"\/>/, '<rect x="2175" y="2148" width="600" height="2" fill="#161d26"/>')
    .replace("<!-- PROUDLY_PRESENT_PLACEHOLDER -->", line1Path)
    .replace("<!-- PARTICIPANT_NAME_PLACEHOLDER -->", namePath)
    .replace("<!-- ACHIEVEMENT_TEXT_PLACEHOLDER -->", `${line3Path}`)
    .replace("<!-- EVENT_DETAILS_PLACEHOLDER -->", `${eventPath}${line5Path}${line6Path}`)
    .replace("<!-- SIGNER_NAME_PLACEHOLDER -->", sigImgXml)
    .replace("<!-- SIGNER_TITLE_PLACEHOLDER -->", `${signerTitlePath}${signerOrgPath}`)
    .replace("<!-- QR_AND_META_PLACEHOLDER -->", qrAndMetaXml);

  return resultSvg;
}
