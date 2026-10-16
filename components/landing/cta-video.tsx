"use client";

import { useEffect, useRef } from "react";
import { cn } from "cn";

/**
 * The closing CTA's background: an 8-second loop of the break at Wushi
 * (public/landing/cta-waves.mp4, ~270 KB — the 9 MB iPhone clip cropped to a
 * 5:4 slice around the horizon, 960 px, 24 fps, no audio). An MP4 beats a GIF
 * by ~20x at the same look, and `muted` + `playsInline` + `loop` is all a
 * browser needs to treat it like one (autoplay, inline on iOS).
 *
 * Decoration only: the poster JPEG paints first, the video file is not
 * requested until the section is within 200 px of the viewport, it pauses
 * once scrolled away, and with "reduce motion" on it never plays (the poster
 * stays).
 *
 * Re-encode (iPhone clips are rotated + HDR, ffmpeg autorotates):
 *   ffmpeg -i IMG.MOV -an -vf "crop=1080:864:0:480,scale=960:768,fps=24,format=yuv420p" \
 *     -c:v libx264 -preset slow -crf 29 -movflags +faststart cta-waves.mp4
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
