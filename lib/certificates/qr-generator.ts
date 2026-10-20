// ============================================================
// QR Code Generator
// ============================================================
//
// Generates QR codes that point to the public verification URL.
// The QR contains ONLY the verification URL — no personal data.
//
// ============================================================

import QRCode from "qrcode";

/**
 * Constructs the public verification URL for a certificate.
 *
 * @param certificateId - The public certificate ID (e.g., AWS-SBG-2026-A8F92K)
 * @param baseUrl - Optional base URL override
 * @returns Full verification URL
 */
export function getVerificationUrl(
  certificateId: string,
  baseUrl?: string
): string {
  const resolvedBaseUrl =
    baseUrl ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";
  const base = resolvedBaseUrl.replace(/\/+$/, "");
  return `${base}/verify/${encodeURIComponent(certificateId)}`;
}

/**
 * Generates a QR code as a PNG buffer.
 *
 * The QR code encodes the verification URL for the given certificate ID.
 * Output is suitable for embedding directly into a PDF.
 *
 * @param certificateId - The public certificate ID
 * @param options - Optional QR code customization
 * @returns PNG image buffer of the QR code
 */
export async function generateQRCode(
  certificateId: string,
  options?: {
    baseUrl?: string;
    width?: number;
    margin?: number;
    errorCorrectionLevel?: "L" | "M" | "Q" | "H";
  }
): Promise<Buffer> {
  const verificationUrl = getVerificationUrl(
    certificateId,
    options?.baseUrl
  );

  const qrBuffer = await QRCode.toBuffer(verificationUrl, {
    type: "png",
    width: options?.width ?? 300,
    margin: options?.margin ?? 2,
    errorCorrectionLevel: options?.errorCorrectionLevel ?? "M",
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
  });

  return Buffer.from(qrBuffer);
}

/**
 * Generates a QR code as a data URL (for browser preview).
 *
 * @param certificateId - The public certificate ID
 * @param baseUrl - Optional base URL override
 * @returns Data URL string (data:image/png;base64,...)
 */
export async function generateQRCodeDataUrl(
  certificateId: string,
  baseUrl?: string
): Promise<string> {
  const verificationUrl = getVerificationUrl(certificateId, baseUrl);

  return QRCode.toDataURL(verificationUrl, {
    width: 300,
    margin: 2,
    errorCorrectionLevel: "M",
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
  });
}
