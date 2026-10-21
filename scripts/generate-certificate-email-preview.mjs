import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const moduleCache = new Map();

function loadTypeScriptModule(filePath) {
  const resolvedPath = path.resolve(filePath);
  if (moduleCache.has(resolvedPath)) return moduleCache.get(resolvedPath).exports;

  const loadedModule = { exports: {} };
  moduleCache.set(resolvedPath, loadedModule);
  const source = fs.readFileSync(resolvedPath, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: resolvedPath,
  });
  const nativeRequire = createRequire(resolvedPath);
  const moduleRequire = (specifier) => {
    if (specifier.startsWith(".")) {
      const dependencyPath = path.resolve(path.dirname(resolvedPath), specifier);
      return loadTypeScriptModule(`${dependencyPath}.ts`);
    }
    return nativeRequire(specifier);
  };

  new Function("module", "exports", "require", outputText)(
    loadedModule,
    loadedModule.exports,
    moduleRequire
  );
  return loadedModule.exports;
}

const templatePath = path.join(root, "lib", "email", "templates", "certificate-delivery.ts");
const templateModule = loadTypeScriptModule(templatePath);
const { getAwardTitle } = loadTypeScriptModule(
  path.join(root, "lib", "certificates", "award-title.ts")
);

const { generateCertificateEmailHtml, generateCertificateEmailText } = templateModule;
const commonData = {
  to: "student@example.com",
  recipientName: "Aarav Sharma",
  eventName: "AWS Cloud Innovation Workshop",
  eventDate: "17 October 2026",
  certificateId: "AWS-SBG-2026-A8F92K",
  verificationUrl: "https://awstulas.org/verify/AWS-SBG-2026-A8F92K",
};
const previews = [
  {
    filename: "certificate-participation-email.html",
    title: "Certificate of Participation",
    data: commonData,
  },
  ...[1, 2, 3, 4].map((rank) => {
    const awardTitle = getAwardTitle(rank);
    return {
      filename: rank === 1
        ? "certificate-excellence-email.html"
        : `certificate-excellence-rank-${rank}-email.html`,
      title: `Certificate of Excellence — ${awardTitle}`,
      data: { ...commonData, awardTitle },
    };
  }),
];
const outputDir = path.join(root, "tmp");
fs.mkdirSync(outputDir, { recursive: true });

for (const preview of previews) {
  const html = generateCertificateEmailHtml(preview.data, {
    iconSources: {
      whatsapp: "../public/email/icons/whatsapp.png",
      instagram: "../public/email/icons/instagram.png",
      meetup: "../public/email/icons/meetup.png",
      linkedin: "../public/email/icons/linkedin.png",
    },
  });
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
