import { notFound } from "next/navigation";

/**
 * Everything under /dev is a local-only component showcase (synthetic data,
 * no auth) — see CLAUDE.md "Project agents" (storybook). The repo is public
 * and every route deploys, so this 404s outright in production builds.
 * Never remove this gate. proxy.ts has a matching bypass that only applies
 * when NODE_ENV !== "production" too — see proxy.ts.
 */
export default function DevLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return children;
}
