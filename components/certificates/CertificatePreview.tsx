"use client";

import { useEffect, useState, useMemo } from "react";
import { generateQRCodeDataUrl } from "@/lib/certificates/qr-generator";

interface CertificatePreviewProps {
  participantName: string;
  eventTitle: string;
  eventDate: string;
  signerName?: string;
  signerTitle?: string;
  certificateId?: string;
  awardTitle?: string;
}

function escapeXml(unsafe: string): string {
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getFittingFontSize(textLength: number, baseFontSize: number, maxCharsBeforeScale: number): number {
  if (textLength <= maxCharsBeforeScale) return baseFontSize;
  return Math.max(18, Math.floor((maxCharsBeforeScale / textLength) * baseFontSize));
}

export function CertificatePreview({
  participantName,
  eventTitle,
  eventDate,
  signerName,
  signerTitle,
  certificateId,
  awardTitle,
}: CertificatePreviewProps) {
  const [baseSvg, setBaseSvg] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [qr, setQr] = useState<{ certificateId: string; dataUrl: string } | null>(null);
  const certId = certificateId?.trim() || "AWS-SBG-2026-PREVIEW";
  const qrDataUrl = qr?.certificateId === certId ? qr.dataUrl : "";

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);
    const templateName = awardTitle
      ? "Certificate-of-Excellence-Template.svg"
      : "Certificate-Template.svg";

    fetch(`/templates/${templateName}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load ${templateName}: ${res.status}`);
        return res.text();
      })
      .then((svgText) => {
        if (isCurrent) {
          setBaseSvg(svgText);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error(`Failed to load ${templateName}:`, err);
        if (isCurrent) {
          setBaseSvg("");
          setIsLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [awardTitle]);

  useEffect(() => {
    let isCurrent = true;

    generateQRCodeDataUrl(certId)
      .then((dataUrl) => {
        if (isCurrent) setQr({ certificateId: certId, dataUrl });
      })
      .catch((err) => {
        console.error("Failed to generate certificate QR code:", err);
      });

    return () => {
      isCurrent = false;
    };
  }, [certId]);

  const renderedSvg = useMemo(() => {
    if (!baseSvg) return "";

    const name = participantName.trim() || "Participant Name";
    const event = eventTitle.trim() || "AWS Cloud Kickstart 2026";
    const date = eventDate.trim() || "30 September 2026";
    const signer = signerName?.trim() || "Piyush Lingwal";
    const title = signerTitle?.trim() || "Community Program Manager";
    // ── Right panel center X ────────────────────────────────────
    const cx = 2475;

    // Font sizes (approximated via character length)
    const nameSize = getFittingFontSize(name.length, 96, 14);
    const eventSize = getFittingFontSize(event.length, 52, 20);
    const line5Size = getFittingFontSize(58, 28, 58); // fixed long string
    const line6Size = getFittingFontSize(`on ${date}`.length, 32, 28);
    const signerNameSize = getFittingFontSize(signer.length, 38, 18);
    const signerTitleSize = getFittingFontSize(title.length, 26, 28);

    // ── Line 1: "This certificate is proudly presented to" ─────
    const line1Xml = `<text x="${cx}" y="1295" text-anchor="middle" font-family="'IBM Plex Mono', monospace" font-size="34" font-weight="400" fill="#555555">This certificate is proudly presented to</text>`;

    // ── Line 2: Participant Name ─────────────────────────────────
    const nameXml = `<text x="${cx}" y="1460" text-anchor="middle" font-family="'IBM Plex Mono', monospace" font-size="${nameSize}" font-weight="700" fill="#161D26">${escapeXml(name)}</text>`;

    // ── Line 3: "in recognition of their participation in" ──────
    const line3Xml = `<text x="${cx}" y="1568" text-anchor="middle" font-family="'IBM Plex Mono', monospace" font-size="34" font-weight="400" fill="#555555">in recognition of their participation in</text>`;

    // ── Line 4: Event Name ───────────────────────────────────────
    const eventXml = `<text x="${cx}" y="1668" text-anchor="middle" font-family="'IBM Plex Mono', monospace" font-size="${eventSize}" font-weight="700" fill="#FF9900">${escapeXml(event)}</text>`;

    // ── Line 5: "conducted by..." ────────────────────────────────
    const line5aXml = `<text x="${cx}" y="1762" text-anchor="middle" font-family="'IBM Plex Mono', monospace" font-size="${line5Size}" font-weight="400" fill="#444444">conducted by AWS Student Builder Group at Tulas University</text>`;

    // ── Line 6: "on DATE" ────────────────────────────────────────
    const line6Xml = `<text x="${cx}" y="1840" text-anchor="middle" font-family="'IBM Plex Mono', monospace" font-size="${line6Size}" font-weight="700" fill="#444444">${escapeXml(`on ${date}`)}</text>`;

    // ── QR & Certificate ID block (Certificate ID below QR) ────
    const qrAndMetaXml = `
      <g id="dynamic-verification-meta">
        ${qrDataUrl
          ? `<image href="${qrDataUrl}" x="220" y="2010" width="230" height="230" preserveAspectRatio="xMidYMid meet"/>`
          : `<rect x="220" y="2010" width="230" height="230" fill="#F4F4F6" stroke="#DEDEE3" stroke-width="2" rx="8"/><text x="335" y="2135" text-anchor="middle" font-family="'IBM Plex Mono', monospace" font-size="24" fill="#888888">[QR CODE]</text>`}
        <text x="220" y="2285" font-family="'IBM Plex Mono', monospace" font-size="26" font-weight="700" fill="#161D26">Certificate ID: ${escapeXml(certId)}</text>
        <text x="220" y="2330" font-family="'IBM Plex Mono', monospace" font-size="24" font-weight="700" fill="#161D26">Verify Certificate: https://awstulas.org/verify/${escapeXml(certId)}</text>
      </g>
    `;

    // ── Signer block: signature centered, name removed, titles centered ──
    const signerSigXml = `<image href="/Lingwal_Sign.png" x="2295" y="2005" width="360" height="130" preserveAspectRatio="xMidYMid meet" />`;
    const signerTitlesXml = `<text x="${cx}" y="2210" text-anchor="middle" font-family="'IBM Plex Mono', monospace" font-size="${signerTitleSize}" font-weight="400" fill="#555555">${escapeXml(title)}</text><text x="${cx}" y="2258" text-anchor="middle" font-family="'IBM Plex Mono', monospace" font-size="${signerTitleSize}" font-weight="400" fill="#555555">AWS Student Builder Group</text>`;

    const fontStyle = `
      <style>
        @font-face {
          font-family: 'IBM Plex Mono';
          font-weight: 400;
          font-style: normal;
          src: url('/fonts/IBM_Plex_Mono/IBMPlexMono-Regular.ttf') format('truetype');
        }
        @font-face {
          font-family: 'IBM Plex Mono';
          font-weight: 700;
          font-style: normal;
          src: url('/fonts/IBM_Plex_Mono/IBMPlexMono-Bold.ttf') format('truetype');
        }
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,400;0,700;1,400;1,700&amp;display=swap');
        text { font-family: 'IBM Plex Mono', monospace; font-smooth: always; -webkit-font-smoothing: antialiased; }
      </style>
    `;

    if (awardTitle) {
      const nameSize = getFittingFontSize(name.length, 96, 20);
      const rankSize = getFittingFontSize(awardTitle.length, 112, 13);
      const rankWidth = awardTitle.length * rankSize * 0.602;
      const eventSize = Math.min(62, Math.floor(1240 / (event.length * 0.602)));
      const dateLine = `on ${date}`;
      const dateSize = getFittingFontSize(dateLine.length, 34, 57);
      const datePrefixWidth = "on ".length * dateSize * 0.602;
      const dateLineWidth = dateLine.length * dateSize * 0.602;
      const rankLineY = 1550 - rankSize * 0.38;
      const excellenceTextXml = `
        <text x="${cx}" y="1215" text-anchor="middle" font-size="34" font-weight="400" fill="#555555">This certificate is proudly presented to</text>
        <text x="${cx}" y="1365" text-anchor="middle" font-size="${nameSize}" font-weight="700" fill="#161D26">${escapeXml(name)}</text>
        <text x="${cx}" y="1430" text-anchor="middle" font-size="32" font-weight="400" fill="#555555">for securing</text>
        <rect x="${cx - rankWidth / 2 - 195}" y="${rankLineY}" width="140" height="5" fill="#FF9900"/>
        <rect x="${cx + rankWidth / 2 + 55}" y="${rankLineY}" width="140" height="5" fill="#FF9900"/>
        <text x="${cx}" y="1550" text-anchor="middle" font-size="${rankSize}" font-weight="700" fill="#FF9900">${escapeXml(awardTitle)}</text>
        <text x="${cx}" y="1645" text-anchor="middle" font-size="54" font-weight="400" fill="#555555">in the</text>
        <text x="${cx}" y="1725" text-anchor="middle" font-size="${eventSize}" font-weight="700" fill="#FF9900">${escapeXml(event)}</text>
        <text x="${cx}" y="1820" text-anchor="middle" font-size="28" font-weight="400" fill="#444444">conducted by AWS Student Builder Group at Tulas University</text>
        <text x="${cx - dateLineWidth / 2}" y="1915" font-size="${dateSize}" font-weight="400" fill="#555555">on </text>
        <text x="${cx - dateLineWidth / 2 + datePrefixWidth}" y="1915" font-size="${dateSize}" font-weight="400" fill="#161D26">${escapeXml(date)}</text>
      `;
      const qrAndMetaXml = `
        <g id="dynamic-verification-meta">
          ${qrDataUrl
            ? `<image href="${qrDataUrl}" x="220" y="2010" width="230" height="230" preserveAspectRatio="xMidYMid meet"/>`
            : `<rect x="220" y="2010" width="230" height="230" fill="#F4F4F6" stroke="#DEDEE3" stroke-width="2" rx="8"/><text x="335" y="2135" text-anchor="middle" font-size="24" fill="#888888">[QR CODE]</text>`}
        <text x="220" y="2285" font-size="26" font-weight="700" fill="#161D26">Certificate ID: ${escapeXml(certId)}</text>
        <text x="220" y="2330" font-size="24" font-weight="700" fill="#161D26">Verify Certificate: https://awstulas.org/verify/${escapeXml(certId)}</text>
        </g>
      `;
      const signerSigXml = `<image href="/Lingwal_Sign.png" x="2295" y="2005" width="360" height="130" preserveAspectRatio="xMidYMid meet" />`;
      const signerTitlesXml = `<text x="${cx}" y="2210" text-anchor="middle" font-size="28" font-weight="400" fill="#555555">${escapeXml(title)}</text><text x="${cx}" y="2258" text-anchor="middle" font-size="28" font-weight="400" fill="#555555">AWS Student Builder Group</text>`;

      return baseSvg
        .replace('width="3300" height="2550"', 'width="100%" height="100%"')
        .replace("<!-- PROUDLY_PRESENT_PLACEHOLDER -->", excellenceTextXml)
        .replace("<!-- PARTICIPANT_NAME_PLACEHOLDER -->", "")
        .replace("<!-- ACHIEVEMENT_TEXT_PLACEHOLDER -->", "")
        .replace("<!-- EVENT_DETAILS_PLACEHOLDER -->", "")
        .replace("<!-- SIGNER_NAME_PLACEHOLDER -->", signerSigXml)
        .replace("<!-- SIGNER_TITLE_PLACEHOLDER -->", signerTitlesXml)
        .replace("<!-- QR_AND_META_PLACEHOLDER -->", qrAndMetaXml)
        .replace("<defs>", `<defs>${fontStyle}`);
    }

    let res = baseSvg
      .replace('width="3300" height="2550"', 'width="100%" height="100%"')
      .replace(/<rect x="2029" y="2148" width="882" height="2" fill="#161d26"\/>/, '<rect x="2175" y="2148" width="600" height="2" fill="#161d26"/>')
      .replace("<!-- PROUDLY_PRESENT_PLACEHOLDER -->", line1Xml)
      .replace("<!-- PARTICIPANT_NAME_PLACEHOLDER -->", nameXml)
      .replace("<!-- ACHIEVEMENT_TEXT_PLACEHOLDER -->", line3Xml)
      .replace("<!-- EVENT_DETAILS_PLACEHOLDER -->", `${eventXml}${line5aXml}${line6Xml}`)
      .replace("<!-- SIGNER_NAME_PLACEHOLDER -->", signerSigXml)
      .replace("<!-- SIGNER_TITLE_PLACEHOLDER -->", signerTitlesXml)
      .replace("<!-- QR_AND_META_PLACEHOLDER -->", qrAndMetaXml);

    res = res.replace("<defs>", `<defs>${fontStyle}`);
    return res;
  }, [
    baseSvg,
    participantName,
    eventTitle,
    eventDate,
    signerName,
    signerTitle,
    certId,
    qrDataUrl,
    awardTitle,
  ]);

  const [isFullscreen, setIsFullscreen] = useState(false);

  if (isLoading) {
    return (
      <div className="w-full aspect-[3300/2550] bg-slate-900/60 rounded-xl flex flex-col items-center justify-center border border-slate-800/80 animate-pulse gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin" />
        <p className="text-xs text-slate-400 font-mono tracking-wide">Loading Vector SVG Template...</p>
      </div>
    );
  }

  if (!renderedSvg) {
    return (
      <div className="w-full aspect-[3300/2550] bg-slate-900 rounded-xl flex items-center justify-center border border-red-500/30">
        <p className="text-xs text-red-400 font-medium">Failed to render template SVG</p>
      </div>
    );
  }

  return (
    <>
      <div className="relative group/preview">
        <div
          className="w-full aspect-[3300/2550] rounded-xl overflow-hidden border border-white/10 shadow-2xl shadow-black/80 bg-white select-none transition-all duration-300 [&_svg]:w-full [&_svg]:h-full [&_svg]:block"
          dangerouslySetInnerHTML={{ __html: renderedSvg }}
        />
        <button
          type="button"
          onClick={() => setIsFullscreen(true)}
          className="absolute bottom-3 right-3 px-3 py-1.5 rounded-lg bg-slate-950/80 hover:bg-slate-900 border border-white/15 text-slate-200 text-xs font-medium backdrop-blur-md opacity-0 group-hover/preview:opacity-100 transition-all duration-200 shadow-lg flex items-center gap-1.5 cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
          </svg>
          Expand
        </button>
      </div>

      {/* Fullscreen Lightbox Modal */}
      {isFullscreen && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md p-4 sm:p-8 flex flex-col items-center justify-center animate-in fade-in duration-200"
          onClick={() => setIsFullscreen(false)}
        >
          <div
            className="relative max-w-6xl w-full aspect-[3300/2550] max-h-[90vh] rounded-2xl overflow-hidden border border-white/20 shadow-2xl bg-white [&_svg]:w-full [&_svg]:h-full [&_svg]:block"
            onClick={(e) => e.stopPropagation()}
            dangerouslySetInnerHTML={{ __html: renderedSvg }}
          />
          <button
            type="button"
            onClick={() => setIsFullscreen(false)}
            className="mt-4 px-5 py-2 rounded-full bg-slate-800/90 hover:bg-slate-700 text-white text-xs font-semibold tracking-wide border border-white/20 transition-all cursor-pointer flex items-center gap-2 shadow-xl"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
            Close Fullscreen (Esc)
          </button>
        </div>
      )}
    </>
  );
}
