export interface CertificateEmailData {
  to: string;
  recipientName: string;
  eventName: string;
  eventDate: string;
  certificateId: string;
  verificationUrl: string;
}

export function generateCertificateEmailHtml(data: CertificateEmailData): string {
  const { recipientName, eventName, eventDate, certificateId, verificationUrl } = data;

  return `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Certificate of Participation — AWS Student Builder Group</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #08080B;
      color: #F4F4F6;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    table {
      border-spacing: 0;
      border-collapse: collapse;
    }
    td {
      padding: 0;
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #08080B;
      padding-top: 36px;
      padding-bottom: 48px;
    }
    .main {
      background-color: #0F0F13;
      margin: 0 auto;
      width: 100%;
      max-width: 600px;
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid #26262D;
    }
    .btn-verify {
      background-color: #6C63FF;
      color: #FFFFFF !important;
      text-decoration: none;
      padding: 12px 28px;
      border-radius: 10px;
      font-weight: 700;
      font-size: 13px;
      display: inline-block;
      letter-spacing: 0.3px;
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#08080B;color:#F4F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <center class="wrapper" style="width:100%;table-layout:fixed;background-color:#08080B;padding-top:36px;padding-bottom:48px;">
    <table class="main" width="100%" style="background-color:#0F0F13;margin:0 auto;width:100%;max-width:600px;border-radius:16px;overflow:hidden;border:1px solid #26262D;">
      
      <!-- Top Accent Bar (AWS Purple to Orange) -->
      <tr>
        <td style="background: linear-gradient(90deg, #6C63FF 0%, #FF9900 100%); height: 4px;"></td>
      </tr>

      <!-- Header Logo / Community Name -->
      <tr>
        <td style="padding: 32px 36px 24px 36px; text-align: left; background-color: #0F0F13; border-bottom: 1px solid #1C1C24;">
          <table width="100%">
            <tr>
              <td>
                <span style="font-size: 11px; font-weight: 800; color: #A78BFA; letter-spacing: 1.5px; text-transform: uppercase; font-family: monospace; display: block; margin-bottom: 4px;">
                  AWS Student Builder Group
                </span>
                <span style="font-size: 18px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.3px;">
                  Tulas University • Certificate of Participation
                </span>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Main Body Content -->
      <tr>
        <td style="padding: 36px 36px 28px 36px;">
          <p style="margin: 0 0 16px 0; font-size: 18px; font-weight: 700; color: #FFFFFF; line-height: 1.4;">
            Dear ${recipientName},
          </p>
          <p style="margin: 0 0 24px 0; font-size: 14.5px; line-height: 1.65; color: #A1A1AA;">
            Thank you for attending <strong style="color: #FFFFFF;">${eventName}</strong>. We truly appreciate your active participation and enthusiasm as part of the AWS Student Builder Group community.
          </p>
          <p style="margin: 0 0 28px 0; font-size: 14.5px; line-height: 1.65; color: #A1A1AA;">
            Your official credential has been generated and is attached to this email as a PDF. You can also verify or download it online at any time using your permanent Certificate ID.
          </p>

          <!-- Certificate Info Box -->
          <table width="100%" style="background-color: #17171C; border-radius: 12px; border: 1px solid #26262D; margin-bottom: 28px;">
            <tr>
              <td style="padding: 20px 24px;">
                <table width="100%">
                  <tr>
                    <td style="padding-bottom: 12px;">
                      <span style="font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #71717A; font-family: monospace; display: block;">Recipient</span>
                      <span style="font-size: 14px; font-weight: 600; color: #FFFFFF;">${recipientName}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-bottom: 12px;">
                      <span style="font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #71717A; font-family: monospace; display: block;">Session / Event</span>
                      <span style="font-size: 14px; font-weight: 600; color: #FFFFFF;">${eventName}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-bottom: 12px;">
                      <span style="font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #71717A; font-family: monospace; display: block;">Date</span>
                      <span style="font-size: 13px; font-weight: 500; color: #D4D4D8;">${eventDate}</span>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <span style="font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #71717A; font-family: monospace; display: block;">Certificate ID</span>
                      <span style="font-size: 15px; font-weight: 700; color: #6C63FF; font-family: monospace;">${certificateId}</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <!-- CTA Button -->
          <div style="text-align: center; margin-bottom: 32px;">
            <a href="${verificationUrl}" class="btn-verify" style="background-color:#6C63FF;color:#FFFFFF!important;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:700;font-size:13px;display:inline-block;">
              Verify Credential Online ↗
            </a>
          </div>

          <p style="margin: 0; font-size: 12px; color: #71717A; text-align: center; line-height: 1.5;">
            Attachment: <strong style="color: #D4D4D8;">${certificateId}.pdf</strong> (300 DPI High-Resolution PDF)
          </p>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="padding: 24px 36px; background-color: #0A0A0E; border-top: 1px solid #1C1C24; text-align: center;">
          <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 600; color: #D4D4D8;">
            AWS Student Builder Group • Tulas University
          </p>
          <p style="margin: 0; font-size: 11px; color: #52525B;">
            Dehradun, Uttarakhand, India • Official Certificate Verification System
          </p>
        </td>
      </tr>

    </table>
  </center>
</body>
</html>
  `.trim();
}

export function generateCertificateEmailText(data: CertificateEmailData): string {
  const { recipientName, eventName, eventDate, certificateId, verificationUrl } = data;
  return `
AWS Student Builder Group — Tulas University
Certificate of Participation

Dear ${recipientName},

Thank you for attending "${eventName}" on ${eventDate}. Your active participation with the AWS Student Builder Group is highly valued.

Your official certificate has been generated and is attached to this email as a PDF.

Certificate Details:
- Recipient: ${recipientName}
- Event: ${eventName}
- Date: ${eventDate}
- Certificate ID: ${certificateId}
- Verification Link: ${verificationUrl}

You can verify the authenticity of this certificate at any time using the link above.

Warm regards,
AWS Student Builder Group Team
Tulas University, Dehradun
  `.trim();
}
