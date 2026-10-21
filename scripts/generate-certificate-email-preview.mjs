import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const templatePath = path.join(root, "lib", "email", "templates", "certificate-delivery.ts");
const templateSource = fs.readFileSync(templatePath, "utf8");
const { outputText } = ts.transpileModule(templateSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
  fileName: templatePath,
});
const templateModule = { exports: {} };
new Function("module", "exports", outputText)(templateModule, templateModule.exports);

const { generateCertificateEmailHtml, generateCertificateEmailText } = templateModule.exports;
const commonData = {
  to: "student@example.com",
  recipientName: "Aarav Sharma",
  eventName: "AWS Cloud Innovation Workshop",
  eventDate: "17 October 2026",
  certificateId: "AWS-SBG-2026-A8F92K",
  verificationUrl: "https://awstulas.org/verify/AWS-SBG-2026-A8F92K",
};
const bannerPath = path.join(root, "public", "email", "banner.png");
const bannerSrc = fs.existsSync(bannerPath) ? "../public/email/banner.png" : null;
const socialIconSrcs = {
  linkedin: "../public/email/icons/linkedin.png",
  instagram: "../public/email/icons/instagram.png",
  whatsapp: "../public/email/icons/whatsapp.png",
  meetup: "../public/email/icons/meetup.png",
};
const previews = [
  {
    filename: "certificate-participation-email.html",
    title: "Certificate of Participation",
    data: commonData,
  },
  {
    filename: "certificate-excellence-email.html",
    title: "Certificate of Excellence",
    data: { ...commonData, awardTitle: "1st Position" },
  },
];
const outputDir = path.join(root, "tmp");
fs.mkdirSync(outputDir, { recursive: true });

for (const preview of previews) {
  const html = generateCertificateEmailHtml(preview.data, { bannerSrc, socialIconSrcs });
  const text = generateCertificateEmailText(preview.data);
  fs.writeFileSync(path.join(outputDir, preview.filename), html, "utf8");
  fs.writeFileSync(
    path.join(outputDir, preview.filename.replace(".html", ".txt")),
    text,
    "utf8"
  );
}

const indexHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Certificate Email Previews</title>
</head>
<body style="margin:0;padding:24px;background:#08080B;color:#F4F4F6;font-family:Arial,Helvetica,sans-serif;">
  <main style="max-width:900px;margin:0 auto;">
    <h1 style="font-size:22px;">Certificate Email Previews</h1>
    ${previews.map((preview) => `
      <section style="margin:28px 0;">
        <h2 style="font-size:16px;color:#A855F7;">${preview.title}</h2>
        <iframe title="${preview.title}" src="${preview.filename}" style="display:block;width:100%;height:820px;border:1px solid #303943;background:#08080B;"></iframe>
        <p style="font-size:12px;color:#A1A1AA;">Plain text: <a href="${preview.filename.replace(".html", ".txt")}" style="color:#A855F7;">${preview.filename.replace(".html", ".txt")}</a></p>
      </section>`).join("")}
  </main>
</body>
</html>`;
fs.writeFileSync(path.join(outputDir, "email-preview.html"), indexHtml, "utf8");
console.log(`Email previews written to ${path.join(outputDir, "email-preview.html")}`);
