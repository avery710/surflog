import { googleSignIn } from "@/app/actions";
import { SignInCard } from "@/components/signin-card";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const { callbackUrl, error } = await searchParams;

  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4.5">
      <SignInCard
        error={error}
        action={async () => {
          "use server";
          await googleSignIn(callbackUrl);
        }}
      />
    </div>
  );
}
