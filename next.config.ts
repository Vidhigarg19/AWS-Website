import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  agentRules: false,

  images: {
    qualities: [100, 75],
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
  
  poweredByHeader: false,

  async headers() {
    // Files in /public are not fingerprinted, so Next serves them with
    // `max-age=0, must-revalidate`: every repeat visit re-requests every image,
    // the mascot video and the fonts. Cache them for a day and let the browser
    // refresh them in the background for a week. (Listed by folder on purpose:
    // an extension pattern such as woff2 would also match /_next/static, which
    // Next already serves as immutable.)
    const publicAssetCache = [
      {
        key: "Cache-Control",
        value: "public, max-age=86400, stale-while-revalidate=604800",
      },
    ];

    return [
      ...["/members", "/logos", "/flowers", "/fonts", "/assets"].map((dir) => ({
        source: `${dir}/:path*`,
        headers: publicAssetCache,
      })),
      { source: "/Chatbot.webm", headers: publicAssetCache },
      { source: "/chatbotmascot.webp", headers: publicAssetCache },
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;