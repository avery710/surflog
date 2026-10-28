/**
 * Page background (2026-10-24, trial on request): a blurred teal-to-pale
 * gradient with film grain on top, fixed to the viewport behind every page.
 * Three stacked vertical gradients (base, a bright aqua masked to the left,
 * a deep navy-green masked to the right), blurred, then a monochrome SVG
 * noise tile blended with `overlay`. Styles: `.grainy` in app/globals.css.
 * Decorative only, so hidden from assistive tech.
 */
export function GrainyBackground() {
  return (
    <div aria-hidden className="grainy pointer-events-none fixed -z-10">
      <div className="color" />
      <div className="grain" />
    </div>
  );
}
