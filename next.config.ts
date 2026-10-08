import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // There's an unrelated package-lock.json in the home directory, which
  // otherwise makes Next.js guess the workspace root wrong.
  turbopack: {
    root: path.join(__dirname),
  },
  // Don't let `next dev` append its agent-rules block to CLAUDE.md — this
  // project's CLAUDE.md is hand-curated project context, not a place for
  // generated boilerplate.
  agentRules: false,
  // lib/share-image.tsx reads the wordmark PNGs from public/ at render time;
  // a serverless function only carries the files it is told about.
  outputFileTracingIncludes: {
    "/api/sessions/[id]/share-image": ["./public/surflog-logo.png", "./public/surflog-logo-white.png"],
    "/s/[token]/card.png": ["./public/surflog-logo.png", "./public/surflog-logo-white.png"],
    "/dev/share/image": ["./public/surflog-logo.png", "./public/surflog-logo-white.png"],
  },
};

export default nextConfig;
