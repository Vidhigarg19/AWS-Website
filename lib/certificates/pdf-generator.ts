// ============================================================
// Certificate PDF Generator (SVG-Driven + Selectable Text Overlay)
// ============================================================
//
// Generates an ultra high-quality PDF certificate by:
// 1. Building the pure vector SVG with dynamic participant,
//    event, signer, and QR code data.
// 2. Rendering the SVG at 300 DPI via sharp (serverless-compatible).
// 3. Embedding into a US Letter Landscape PDF page via pdf-lib.
// 4. [Option C] Overlaying the verification URL as real selectable
//    PDF text with a clickable URI annotation — fully copy-pasteable.
//
// 100% SVG-driven background. Verification URL is real PDF text.
//
// ============================================================

import fs from "fs/promises";
import path from "path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import sharp from "sharp";
import QRCode from "qrcode";
import type {
  CertificateGenerationInput,
  CertificateGenerationResult,
} from "@/types/certificate";
import { generateCertificateId } from "./id-generator";
import { getVerificationUrl } from "./qr-generator";
import {
  generateCertificateSvg,
  SVG_CANVAS,
  CERT_ID_SVG_POSITION,
  VERIFY_URL_SVG_POSITION,
  buildCertIdText,
  buildVerifyUrlText,
} from "./svg-generator";

// ── IBM Plex Mono Bold Font Cache & Fontkit Patch ─────────────
let cachedFontBytes: Buffer | null = null;
let fontkitPatched = false;

/**
 * Patches a known bug in @pdf-lib/fontkit where TTFGlyph._getCBox tries
 * to read a 10-byte GlyfHeader on empty glyphs (e.g. space characters
 * at the end of the glyf table where loca[id] === loca[id+1]), causing:
 * "RangeError: Trying to access beyond buffer length".
 */
function ensureFontkitPatched(sampleBytes: Buffer) {
  if (fontkitPatched) return;
  try {
    const sampleFont = (fontkit as any).create(sampleBytes);
    const glyph0 = sampleFont.getGlyph(0);
    const proto = Object.getPrototypeOf(glyph0);
    if (proto && typeof proto._getCBox === "function") {
      const origGetCBox = proto._getCBox;
      const BBox = glyph0.cbox?.constructor;
      proto._getCBox = function (internal: any) {
        if (this._font?.loca && Array.isArray(this._font.loca.offsets)) {
          const currOffset = this._font.loca.offsets[this.id];
          const nextOffset = this._font.loca.offsets[this.id + 1];
          if (
            currOffset !== undefined &&
            nextOffset !== undefined &&
            currOffset === nextOffset
          ) {
            return Object.freeze(new (BBox || Object)(0, 0, 0, 0));
          }
        }
        return origGetCBox.call(this, internal);
      };
    }
  } catch (err) {
    console.warn("[PDFGenerator] fontkit patch warning:", err);
  }
  fontkitPatched = true;
}

async function getIbmPlexMonoBoldBytes(): Promise<Buffer> {
  if (cachedFontBytes) return cachedFontBytes;
  const fontPath = path.join(
    process.cwd(),
    "public",
    "fonts",
    "IBM_Plex_Mono",
    "IBMPlexMono-Bold.ttf"
  );
  cachedFontBytes = await fs.readFile(fontPath);
  ensureFontkitPatched(cachedFontBytes);
  return cachedFontBytes;
}

// ── PDF page dimensions (US Letter Landscape) ─────────────────
const PDF_W = 792; // points
const PDF_H = 612; // points

// ── Coordinate mapping: SVG (top-left origin) → PDF (bottom-left origin)
const scaleX = PDF_W / SVG_CANVAS.width;  // 792/3300 ≈ 0.24
const scaleY = PDF_H / SVG_CANVAS.height; // 612/2550 ≈ 0.24

/** Maps SVG x → PDF x (same direction). */
function svgToPdfX(svgX: number): number {
  return svgX * scaleX;
}

/**
 * Maps SVG y (top-left baseline) → PDF y (bottom-left baseline).
 * SVG y=2330 → PDF y = 612 - 2330*0.24 = 612 - 559.2 = 52.8
 */
function svgToPdfY(svgY: number): number {
  return PDF_H - svgY * scaleY;
}

/**
 * Formats an ISO date string into a human-readable format.
 * Example: "2026-09-28" → "28 September 2026"
 */
function formatDate(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return isoDate;
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return isoDate;
  }
}

/**
 * Generates a complete PDF certificate from dynamic input using the SVG template.
 * The verification URL is overlaid as real selectable PDF text (Option C).
 *
 * @param input - Certificate generation parameters
 * @returns Generation result with certificateId and downloadable pdfBuffer
 */
export async function generateCertificatePdf(
  input: CertificateGenerationInput
): Promise<CertificateGenerationResult> {
  try {
    // 1. Use pre-generated Certificate ID or generate a new one
    const certificateId =
      input.certificateId?.trim() || (await generateCertificateId());

    // 2. Generate QR code pointing to public verification page
    const verificationUrl = getVerificationUrl(certificateId);
    const qrDataUri = await QRCode.toDataURL(verificationUrl, {
      margin: 1,
      width: 300,
      errorCorrectionLevel: "M",
    });

    // 3. Format event date
    const formattedDate = formatDate(input.eventDate);

    // 4. Generate dynamic SVG certificate
    //    NOTE: the verification URL text is intentionally excluded from the SVG
    //    so it can be overlaid as real selectable PDF text below.
    const svgString = await generateCertificateSvg({
      participantName: input.participantName.trim(),
      eventTitle: input.eventTitle.trim(),
      eventDate: formattedDate,
      signerName: input.signerName?.trim(),
      signerTitle: input.signerTitle?.trim(),
      certificateId,
      qrDataUri,
    });

    // 5. Render SVG to pristine 300-DPI PNG buffer via sharp
    const renderedImageBuffer = await sharp(Buffer.from(svgString))
      .png({ quality: 100, compressionLevel: 8 })
      .toBuffer();

    // 6. Create PDF page (US Letter Landscape: 792 × 612 pt)
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([PDF_W, PDF_H]);

    // 7. Embed rendered image as full-bleed background
    const embeddedImage = await pdfDoc.embedPng(renderedImageBuffer);
    page.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width: PDF_W,
      height: PDF_H,
    });

    // ── Option C: Real selectable PDF text overlay ─────────────────────────
    //
    // Both Certificate ID and Verify URL are deliberately omitted from the
    // SVG raster so they live here as actual PDF text — fully selectable,
    // copy-pasteable, and with a clickable URI annotation in any PDF viewer.
    //
    // Uses true IBM Plex Mono Bold font matching the certificate typography.
    let certFont;
    try {
      pdfDoc.registerFontkit(fontkit);
      const fontBytes = await getIbmPlexMonoBoldBytes();
      certFont = await pdfDoc.embedFont(fontBytes);
    } catch (fontErr) {
      console.warn(
        "[PDFGenerator] Custom font embedding failed, falling back to CourierBold:",
        fontErr
      );
      certFont = await pdfDoc.embedFont(StandardFonts.CourierBold);
    }

    const textColor = rgb(0.086, 0.114, 0.149); // #161D26

    // 1. Draw Certificate ID text (selectable)
    const certIdText = buildCertIdText(certificateId);
    const certIdFontSize = 26 * scaleX; // 26 * 0.24 = 6.24 pt
    const certIdX = svgToPdfX(CERT_ID_SVG_POSITION.x);
    const certIdY = svgToPdfY(CERT_ID_SVG_POSITION.y);

    page.drawText(certIdText, {
      x: certIdX,
      y: certIdY,
      size: certIdFontSize,
      font: certFont,
      color: textColor,
    });

    // 2. Draw Verify Certificate text (selectable)
    const verifyUrlText = buildVerifyUrlText(certificateId);
    const labelText = "Verify Certificate: ";
    const urlOnlyText = `https://awstulas.org/verify/${certificateId}`;
    const verifyFontSize = 24 * scaleX; // 24 * 0.24 = 5.76 pt
    const verifyX = svgToPdfX(VERIFY_URL_SVG_POSITION.x);
    const verifyY = svgToPdfY(VERIFY_URL_SVG_POSITION.y);

    page.drawText(verifyUrlText, {
      x: verifyX,
      y: verifyY,
      size: verifyFontSize,
      font: certFont,
      color: textColor,
    });

    // ── Clickable URI annotation over the URL portion (No underline) ────────
    // Measure prefix width to position the annotation precisely over the URL
    const labelWidth = certFont.widthOfTextAtSize(labelText, verifyFontSize);
    const urlWidth = certFont.widthOfTextAtSize(urlOnlyText, verifyFontSize);

    const annotX = verifyX + labelWidth;
    const annotY = verifyY;
    const annotW = urlWidth;
    const annotH = verifyFontSize * 0.85;

    // Register a URI link annotation (opens in browser on click, without underline)
    const linkAnnotation = pdfDoc.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [annotX, annotY - 1, annotX + annotW, annotY + annotH],
      Border: [0, 0, 0],
      A: {
        Type: "Action",
        S: "URI",
        URI: verificationUrl,
      },
    });
    const annotRef = pdfDoc.context.register(linkAnnotation);
    page.node.set(
      pdfDoc.context.obj("Annots") as any,
      pdfDoc.context.obj([annotRef]) as any
    );

    // 8. Serialize PDF
    const pdfBytes = await pdfDoc.save();

    console.log(
      `[PDFGenerator] Certificate generated: ${certificateId} ` +
        `(${(pdfBytes.length / 1024).toFixed(1)} KB) ` +
        `for "${input.participantName}" — "${input.eventTitle}" ` +
        `[Certificate ID & verify URL: real selectable PDF text]`
    );

    return {
      success: true,
      certificateId,
      pdfBuffer: Buffer.from(pdfBytes),
    };
  } catch (error: any) {
    console.error("[PDFGenerator] Certificate generation failed:", error);
    return {
      success: false,
      error: error.message || "Unknown error during PDF generation",
    };
  }
}
