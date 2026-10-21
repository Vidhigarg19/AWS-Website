import { getAwardTitle } from "../../certificates/award-title";

const SOCIAL_LINKS = [
  {
    platform: "whatsapp",
    label: "WhatsApp",
    url: "https://chat.whatsapp.com/Dy6s9Lo9rFpLNbrMkgUgQ6?s=cl&p=a&mlu=4&ilr=4",
  },
  {
    platform: "instagram",
    label: "Instagram",
    url: "https://instagram.com/aws.sbgtulas",
  },
  {
    platform: "meetup",
    label: "Meetup",
    url: "https://www.meetup.com/aws-sbg-at-tulas-university/",
  },
  {
    platform: "linkedin",
    label: "LinkedIn",
    url: "https://www.linkedin.com/company/aws-tulas/",
  },
] as const;

export type CertificateSocialPlatform = (typeof SOCIAL_LINKS)[number]["platform"];

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
  const awardTitle = getAwardTitle(data.awardTitle);
  const eventName = `<strong style="color:#1F1F2E;">${escapeHtml(data.eventName)}</strong>`;
  const groupName = '<strong style="color:#1F1F2E;">AWS Student Builder Group</strong>';

  if (awardTitle) {
    return `Congratulations on securing <strong style="color:#5B21B6;">${escapeHtml(awardTitle)}</strong> in ${eventName}, organized by the ${groupName} at Tulas University! 🏆`;
  }

  return `Thank you for participating in ${eventName}, organized by the ${groupName} at Tulas University!`;
}

function generateCertificateMessageText(data: CertificateEmailData): string {
  const awardTitle = getAwardTitle(data.awardTitle);
  if (awardTitle) {
    return `Congratulations on securing ${awardTitle} in ${data.eventName}, organized by the AWS Student Builder Group at Tulas University! 🏆`;
  }

  return `Thank you for participating in ${data.eventName}, organized by the AWS Student Builder Group at Tulas University!`;
}

export function generateCertificateEmailHtml(
  data: CertificateEmailData,
  options: {
    iconSources?: Partial<Record<CertificateSocialPlatform, string | null>>;
  } = {}
): string {
  const safeRecipientName = escapeHtml(data.recipientName);
  const safeVerificationUrl = escapeVerificationHref(data.verificationUrl);
  const banner = `<tr><td style="padding:0;"><img src="https://awstulas.org/email/banner.png" width="600" alt="AWS Student Builder Group" style="display:block;width:100%;max-width:600px;height:auto;border:0;border-radius:10px;"></td></tr>`;
  const socialIcons = SOCIAL_LINKS.map((socialLink) => {
    const iconSrc =
      options.iconSources?.[socialLink.platform] === undefined
        ? `cid:certificate-icon-${socialLink.platform}`
        : options.iconSources[socialLink.platform];
    const icon = iconSrc
      ? `<img src="${escapeHtml(iconSrc)}" width="32" height="32" alt="${socialLink.label}" style="display:block;width:32px;height:32px;border:0;">`
      : `<span style="color:#6D28D9;font-size:12px;line-height:32px;text-decoration:underline;">${socialLink.label}</span>`;

    return `<td align="center" style="padding:0 8px;"><a href="${escapeHtml(socialLink.url)}" style="display:inline-block;text-decoration:none;">${icon}</a></td>`;
  }).join("");
  const awardTitle = getAwardTitle(data.awardTitle);
  const emailData = { ...data, awardTitle };
  const eventParagraph = awardTitle
    ? "Your dedication, knowledge, and enthusiasm truly made you stand out. We are delighted to recognize your achievement and hope you continue learning, building, and pushing your limits."
    : "Your participation, curiosity, and enthusiasm truly made the event special. We appreciate your involvement and hope you continue learning, building, and growing with our community.";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${awardTitle ? "Congratulations on Your Achievement" : "Certificate of Participation"} | AWS SBG</title>
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
              <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#1F1F2E;">${generateCertificateMessageHtml(emailData)}</p>
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
              <p style="margin:14px 0 10px;font-size:12px;line-height:1.6;color:#555566;">Share your achievement on <a href="${escapeHtml(SOCIAL_LINKS[3].url)}" style="color:#6D28D9;text-decoration:underline;">LinkedIn</a> and don't forget to tag <strong style="color:#1F1F2E;">AWS Student Builder Group at Tulas University</strong>.</p>
              <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;border-collapse:collapse;">
                <tr>${socialIcons}</tr>
              </table>
              <p style="margin:10px 0 0;font-size:11px;line-height:1.5;letter-spacing:1.5px;color:#A0A0A0;">Learn. Build. Innovate. Together.</p>
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
  const awardTitle = getAwardTitle(data.awardTitle);
  const message = generateCertificateMessageText({ ...data, awardTitle });
  const eventParagraph = awardTitle
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
    "Share your achievement on LinkedIn and don't forget to tag AWS Student Builder Group at Tulas University.",
    "",
    `LinkedIn: ${SOCIAL_LINKS[3].url}`,
    `Instagram: ${SOCIAL_LINKS[1].url}`,
    `WhatsApp: ${SOCIAL_LINKS[0].url}`,
    `Meetup: ${SOCIAL_LINKS[2].url}`,
    "",
    "Warm Regards,",
    "Team AWS Student Builder Group",
    "Tulas University, Dehradun",
    "",
    "Learn. Build. Innovate. Together.",
  ].join("\n");
}
