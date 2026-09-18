import { googleSignIn } from "@/app/actions";

const ERROR_MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked: "That Google account is already linked a different way. Try again.",
  AccessDenied: "Access denied.",
  Default: "Couldn't sign in — try again.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const { callbackUrl, error } = await searchParams;

  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4.5">
      <div className="w-full max-w-[360px] rounded-[var(--r-card)] border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
        <h1 className="font-sans text-[26px] font-extrabold tracking-[-0.025em]">Surflog</h1>
        <p className="mt-1.5 text-[14px] font-medium text-muted-foreground">
          Sign in to log sessions and see your own journal.
        </p>

        {error && (
          <p className="mt-4 rounded-[var(--r-tile)] bg-[var(--warm-soft)] px-4 py-3 text-[13.5px] font-medium text-warm">
            {ERROR_MESSAGES[error] ?? ERROR_MESSAGES.Default}
          </p>
        )}

        <form
          className="mt-6"
          action={async () => {
            "use server";
            await googleSignIn(callbackUrl);
          }}
        >
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-primary px-6 py-3 font-sans text-[15px] font-bold text-primary-foreground transition-[filter] hover:brightness-110 active:scale-[0.975]"
          >
            <GoogleG className="size-4.5" />
            Continue with Google
          </button>
        </form>

        <p className="mt-5 text-[12.5px] font-medium text-muted-foreground">
          Each Google account gets its own private journal — nobody else can see it.
        </p>
      </div>
    </div>
  );
}

function GoogleG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
        opacity=".95"
      />
      <path
        fill="currentColor"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
        opacity=".8"
      />
      <path
        fill="currentColor"
        d="M5.27 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.37-2.28V6.63H1.29A11.98 11.98 0 0 0 0 12c0 1.93.46 3.76 1.29 5.37z"
        opacity=".65"
      />
      <path
        fill="currentColor"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.63l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}
