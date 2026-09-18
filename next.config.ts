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
};

export default nextConfig;
