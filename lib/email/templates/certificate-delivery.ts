export interface CertificateEmailData {
  to: string;
  recipientName: string;
  eventName: string;
  eventDate: string;
  certificateId: string;
  verificationUrl: string;
  awardTitle?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeVerificationHref(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Certificate verification URL must be an absolute URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Certificate verification URL must use HTTP or HTTPS.");
  }

  return escapeHtml(url.toString());
}

function generateCertificateMessageHtml(data: CertificateEmailData): string {
  const eventName = `<strong style="color:#1F1F2E;">${escapeHtml(data.eventName)}</strong>`;
  const groupName = '<strong style="color:#1F1F2E;">AWS Student Builder Group</strong>';

  if (data.awardTitle) {
    return `Congratulations on securing <strong style="color:#5B21B6;">${escapeHtml(data.awardTitle)}</strong> in ${eventName}, organized by the ${groupName} at Tulas University! 🏆`;
  }

  return `Thank you for participating in ${eventName}, organized by the ${groupName} at Tulas University!`;
}

function generateCertificateMessageText(data: CertificateEmailData): string {
  if (data.awardTitle) {
    return `Congratulations on securing ${data.awardTitle} in ${data.eventName}, organized by the AWS Student Builder Group at Tulas University! 🏆`;
  }

  return `Thank you for participating in ${data.eventName}, organized by the AWS Student Builder Group at Tulas University!`;
}

export function generateCertificateEmailHtml(
  data: CertificateEmailData,
  options: { bannerSrc?: string | null } = {}
): string {
  const safeRecipientName = escapeHtml(data.recipientName);
  const safeVerificationUrl = escapeVerificationHref(data.verificationUrl);
  const bannerSrc =
    options.bannerSrc === undefined ? "../public/email/banner.png" : options.bannerSrc;
  const banner = bannerSrc
    ? `<tr><td style="padding:0;"><img src="${escapeHtml(bannerSrc)}" width="600" alt="AWS Student Builder Group" style="display:block;width:100%;max-width:600px;height:auto;border:0;border-radius:10px;"></td></tr>`
    : "";
  const eventParagraph = data.awardTitle
    ? "Your dedication, knowledge, and enthusiasm truly made you stand out. We are delighted to recognize your achievement and hope you continue learning, building, and pushing your limits."
    : "Your participation, curiosity, and enthusiasm truly made the event special. We appreciate your involvement and hope you continue learning, building, and growing with our community.";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${data.awardTitle ? "Congratulations on Your Achievement" : "Certificate of Participation"} | AWS SBG</title>
</head>
<body style="margin:0;padding:0;background-color:#FFFFFF;color:#1F1F2E;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:#FFFFFF;border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:20px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#FFFFFF;border:1px solid #F3EEFF;border-radius:10px;border-collapse:separate;">
          ${banner}
          <tr>
            <td style="padding:28px 30px 22px;background-color:#FFFFFF;color:#1F1F2E;">
              <p style="margin:0 0 18px;font-size:16px;line-height:1.5;color:#1F1F2E;">Dear <strong>${safeRecipientName}</strong>,</p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#1F1F2E;">${generateCertificateMessageHtml(data)}</p>
              <p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#555566;">${eventParagraph}</p>
              <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 26px;border-collapse:separate;">
                <tr>
                  <td align="center" bgcolor="#6D28D9" style="border-radius:10px;background-color:#6D28D9;">
                    <a href="${safeVerificationUrl}" style="display:inline-block;padding:14px 32px;border:1px solid #6D28D9;border-radius:10px;color:#FFFFFF;font-size:16px;font-weight:bold;line-height:1.2;text-align:center;text-decoration:none;">Claim Your Certificate &rarr;</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#1F1F2E;">Thank you for being a part of our community. We look forward to seeing you achieve many more milestones in your journey!</p>
              <p style="margin:0;font-size:15px;line-height:1.7;color:#1F1F2E;">Warm Regards,<br><strong style="color:#5B21B6;">Team AWS Student Builder Group</strong><br>Tulas University, Dehradun</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 30px 22px;background-color:#FFFFFF;text-align:center;">
              <div style="height:1px;background-color:#F3EEFF;font-size:0;line-height:0;">&nbsp;</div>
              <p style="margin:15px 0 0;font-size:11px;line-height:1.5;letter-spacing:1.5px;color:#A0A0A0;">Learn. Build. Innovate. Together.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export function generateCertificateEmailText(data: CertificateEmailData): string {
  const message = generateCertificateMessageText(data);
  const eventParagraph = data.awardTitle
    ? "Your dedication, knowledge, and enthusiasm truly made you stand out. We are delighted to recognize your achievement and hope you continue learning, building, and pushing your limits."
    : "Your participation, curiosity, and enthusiasm truly made the event special. We appreciate your involvement and hope you continue learning, building, and growing with our community.";

  return [
    `Dear ${data.recipientName},`,
    "",
    message,
    "",
    eventParagraph,
    "",
    `Claim your certificate: ${data.verificationUrl}`,
    "",
    "Thank you for being a part of our community. We look forward to seeing you achieve many more milestones in your journey!",
    "",
    "Warm Regards,",
    "Team AWS Student Builder Group",
    "Tulas University, Dehradun",
    "",
    "Learn. Build. Innovate. Together.",
  ].join("\n");
}
