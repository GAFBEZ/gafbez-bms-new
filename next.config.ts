import type { NextConfig } from "next";

// Lets next/image optimize the uploaded logo, which is served from
// Supabase Storage's public URL rather than a local /public asset.
const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseHostname
      ? [
          {
            protocol: "https",
            hostname: supabaseHostname,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
  // Next's own default cap on a Server Action's request body is 1MB,
  // well under the 5MB image size this app already advertises to staff
  // (see inventory/actions.ts, installation-projects/actions.ts). Raising
  // it here only helps up to Vercel's own hard 4.5MB-per-request platform
  // limit, which no app config can lift -- installation project images
  // are uploaded client-side straight to Supabase Storage to sidestep
  // that ceiling entirely; this raised limit is a safety net for the
  // remaining Server-Action-based uploads (e.g. product images) until
  // they get the same treatment.
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  // @sparticuz/chromium's binary is loaded from disk at runtime rather
  // than a plain require(), so Next's own dependency trace misses it --
  // without this, the PDF route's serverless function bundle on Vercel
  // is missing the Chromium binary entirely (works fine in local dev,
  // where the full `puppeteer` package's own Chromium is used instead).
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  outputFileTracingIncludes: {
    "/api/quote-builder/pdf": ["node_modules/@sparticuz/chromium/bin/**/*"],
    "/api/invoice-builder/pdf": ["node_modules/@sparticuz/chromium/bin/**/*"],
  },
};

export default nextConfig;
