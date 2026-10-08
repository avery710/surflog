/**
 * Stencil post-processing for the Strip share image. satori can't punch holes
 * (no destination-out), so the strip is drawn with its text in a flag colour
 * (magenta) on flat shapes, and this turns the flag pixels transparent:
 * every anti-aliased edge pixel is a blend `f * flag + (1 - f) * shape`, so
 * solving for f gives the exact alpha, and the colour goes back to the shape's.
 * Pixels that are not on that blend line (the solid notes ink, the photo) are
 * left alone. The board photo sits over a green placeholder disc whose
 * bounding box is returned so the caller can paint the real photo there.
 *
  * With `shapeAlpha` < 1, every pixel inside the given [top, bottom) bands (rows holding
 * only shapes) then has its alpha scaled, so text ends at alpha 0 and the shapes at that
 * opacity. Outside the bands (plain text, the logo) nothing changes.
 *
 * Pure: RGBA bytes in, same buffer modified in place.
 */
export type KnockoutTone = "light" | "dark";

export interface PhotoBox {
  x: number;
  y: number;
  d: number;
}

const SHAPE: Record<KnockoutTone, [number, number, number]> = { light: [255, 255, 255], dark: [11, 13, 18] };

export function applyKnockout(
  rgba: Uint8Array,
  width: number,
  height: number,
  tone: KnockoutTone,
  opts: { shapeAlpha?: number; bands?: [number, number][] } = {}
): { photo: PhotoBox | null } {
  const shapeAlpha = opts.shapeAlpha ?? 1;
  const bands = opts.bands ?? [];
  const [sr, sg, sb] = SHAPE[tone];
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = rgba[i + 3];
      if (a < 8) continue; // empty canvas
      const r = rgba[i];
      const g = rgba[i + 1];
      const b = rgba[i + 2];
      // The photo placeholder (pure green, or its blend with the shape).
      // (r ~ b: the placeholder blends only with the gray/white/near-black shape, so
      // the wind dots, emerald or lime, with g high and r != b, are not mistaken for it)
      if (g - Math.max(r, b) > 25 && Math.abs(r - b) <= 14) {
        if (g > 200 && r < 60 && b < 60) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
        rgba[i] = sr;
        rgba[i + 1] = sg;
        rgba[i + 2] = sb;
        continue;
      }
      let f: number;
      if (tone === "light") {
        // white shape, magenta flag: red and blue stay ~255, green falls to 0.
        // The renderer darkens red/blue a little on anti-aliased edges (down
        // to ~220 seen), so the check is loose; green alone gives the alpha.
        if (r < 200 || b < 200 || Math.abs(r - b) > 12) continue;
        // a gray (the plain text's glow) is not a magenta blend: red must sit well above green
        if (r - g < 0.5 * (255 - g)) continue;
        f = 1 - g / 255;
      } else {
        // near-black shape: red rises 11 -> 255, green falls 13 -> 0, blue 18 -> 255
        f = (r - sr) / (255 - sr);
        if (f <= 0.004) continue;
        if (Math.abs(g - sg * (1 - f)) > 14 || Math.abs(b - (sb + (255 - sb) * f)) > 14) continue;
      }
      if (f <= 0.004) continue;
      f = Math.min(1, f);
      rgba[i] = sr;
      rgba[i + 1] = sg;
      rgba[i + 2] = sb;
      rgba[i + 3] = Math.round(a * (1 - f)); // the shape may itself be translucent (SHAPE_ALPHA)
    }
  }
  // Translucent shapes: scale alpha inside the shape-only bands (after the text is gone).
  if (shapeAlpha < 1) {
    for (const [top, bottom] of bands) {
      for (let y = Math.max(0, top); y < Math.min(height, bottom); y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4 + 3;
          rgba[i] = Math.round(rgba[i] * shapeAlpha);
        }
      }
    }
  }
  const photo = maxX >= minX ? { x: minX, y: minY, d: Math.max(maxX - minX, maxY - minY) + 1 } : null;
  return { photo };
}
