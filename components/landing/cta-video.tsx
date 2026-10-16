"use client";

import { useEffect, useRef } from "react";
import { cn } from "cn";

/**
 * The closing CTA's background: Avery's iPhone clip (IMG_5420 2), cropped to
 * a 3:2 band that starts just above the horizon, kept HDR. Tuned so the
 * island sits above the heading at every card shape (checked at 320, 375,
 * 768 and desktop): on a phone-shaped card the whole band is visible, on a
 * wide card `object-position` (landing.tsx) shows its top part, and the
 * heading always lands on water. The handheld horizon sloped ~0.58 degrees
 * (measured), so it is rotated level, with the black wedges trimmed off.
 * public/landing/cta-waves.mp4, ~5 MB, 1020x680:
 *   ffmpeg -i "IMG_5420 2.mov" -an -vf "crop=1050:800:0:740,format=yuv420p10le,rotate=a=-0.58*PI/180:ow=iw:oh=ih:c=black:bilinear=1,crop=1020:680:15:60" \
 *     -c:v libx265 -preset slow -crf 20 -tag:v hvc1 -color_primaries bt2020 \
 *     -color_trc arib-std-b67 -colorspace bt2020nc \
 *     -x265-params colorprim=bt2020:transfer=arib-std-b67:colormatrix=bt2020nc \
 *     -movflags +faststart cta-waves.mp4
 * Why HEVC HDR and not H.264: every SDR re-encode (even with a hand-built
 * HLG to SDR tone map) looked off against the original. HEVC plays in Safari,
 * Chrome and Edge but not everywhere (Firefox may not): there the poster
 * stays. The poster JPEG is the first frame tone-mapped to SDR by hand, so it
 * is close to, not identical with, the HDR video.
 *
 * Decoration only: the video file is not requested until the section is
 * within 200 px of the viewport, it pauses once scrolled away, and with
 * "reduce motion" on it never plays (the poster stays).
 */
const SRC = "/landing/cta-waves.mp4";
const POSTER = "/landing/cta-waves-poster.jpg";

export function CtaVideo({ className }: { className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    // React doesn't reliably render the `muted` attribute; autoplay needs it.
    video.muted = true;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (reduce.matches) return;
        if (entry.isIntersecting) {
          if (!video.getAttribute("src")) video.src = SRC;
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { rootMargin: "200px" }
    );
    io.observe(video);
    return () => io.disconnect();
  }, []);

  return (
    <video
      ref={ref}
      poster={POSTER}
      muted
      loop
      playsInline
      preload="none"
      disablePictureInPicture
      aria-hidden
      tabIndex={-1}
      className={cn("pointer-events-none absolute inset-0 size-full object-cover", className)}
    />
  );
}
