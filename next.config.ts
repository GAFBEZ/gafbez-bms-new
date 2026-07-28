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
};

export default nextConfig;
