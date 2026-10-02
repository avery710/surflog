import { Landing } from "@/components/landing/landing";

/**
 * DEV-ONLY: the signed-out landing page ("/" without a session), so it can
 * be checked from a signed-in browser. Same component; sign-in is a no-op.
 */
export default function LandingPreviewPage() {
  return (
    <Landing
      signInAction={async () => {
        "use server";
      }}
    />
  );
}
