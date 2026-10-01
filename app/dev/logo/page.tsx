import { notFound } from "next/navigation";
import { SurflogLogo } from "@/components/logo";

type Variant = "bold" | "regular" | "tagline";

/**
 * DEV-ONLY: the SURFLOG wordmark (components/logo.tsx) at display and
 * header size, on white and on the teal header/accent surface, next to the
 * current plain-text "Surflog" header style for comparison. Not linked
 * anywhere real; 404s in production. Avery hasn't picked a variant yet —
 * see CLAUDE.md "Style references" before wiring any of these into the
 * real header.
 */
export default function LogoPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="mx-auto w-full max-w-[880px] px-4.5 py-8">
      <h1 className="font-sans text-2xl font-extrabold">Logo preview (dev only)</h1>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">
        Three variants of <code>components/logo.tsx</code>&apos;s{" "}
        <code>&lt;SurflogLogo /&gt;</code>: bold (default weight), regular (lighter stroke,
        same letterforms) and tagline (bold mark + &quot;SURF JOURNAL&quot; caption). Each at a
        large display size (~120px) and header size (~28px), black on white and white on the
        app&apos;s teal. The header row also isn&apos;t swapped in anywhere real yet — this page
        is just for comparing the options.
      </p>

      <Row
        variant="bold"
        title="Bold"
        description="Default weight — heavy ribbon, matches the reference most closely."
      />

      <Row variant="regular" title="Regular" description="Same letter geometry, a lighter stroke." />

      <Row
        variant="tagline"
        title="Tagline"
        description="Bold mark + caption in the app's UI font (Funnel Sans) — for a large display spot like the sign-in card, not the header. The caption is a fixed size, so it reads small next to the 120px mark and won't shrink further at header size."
      />

      <section className="mt-10">
        <h2 className="text-lg font-bold">Current header text style, for comparison</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Surface bg="white" fg="black">
            <span className="font-sans text-[30px] font-extrabold tracking-[-0.025em] leading-tight">
              Surflog
            </span>
          </Surface>
          <Surface bg="#0e7c86" fg="white">
            <span className="font-sans text-[30px] font-extrabold tracking-[-0.025em] leading-tight">
              Surflog
            </span>
          </Surface>
        </div>
      </section>
    </div>
  );
}

function Row({
  variant,
  title,
  description,
}: {
  variant: Variant;
  title: string;
  description: string;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">{description}</p>

      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Display size (~120px)
      </p>
      {/* Stacked, not side-by-side — the mark at 120px tall (~500px wide)
          is wider than half this page's max-width, so a 2-col grid clips
          it. Header size below is narrow enough to sit side by side. The
          mark itself has no responsive sizing (it's meant to be dropped in
          at a fixed height wherever it's used) — shrunk here on narrow
          viewports only so this comparison page doesn't scroll sideways;
          see CLAUDE.md "No horizontal page scroll". */}
      <div className="mt-2 flex flex-col gap-3">
        <Surface bg="white" fg="black" pad>
          <SurflogLogo variant={variant} className="h-[72px] sm:h-[120px]" />
        </Surface>
        <Surface bg="#0e7c86" fg="white" pad>
          <SurflogLogo variant={variant} className="h-[72px] sm:h-[120px]" />
        </Surface>
      </div>

      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Header size (~28px)
      </p>
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Surface bg="white" fg="black">
          <SurflogLogo variant={variant} className="h-7" />
        </Surface>
        <Surface bg="#0e7c86" fg="white">
          <SurflogLogo variant={variant} className="h-7" />
        </Surface>
      </div>
    </section>
  );
}

function Surface({
  bg,
  fg,
  pad,
  children,
}: {
  bg: string;
  fg: string;
  pad?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{ backgroundColor: bg, color: fg }}
      className={
        "flex items-center justify-center rounded-[var(--r-card)] border border-border " +
        (pad ? "p-6" : "p-3")
      }
    >
      {children}
    </div>
  );
}
