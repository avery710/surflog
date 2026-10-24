"use client";

import { useEffect } from "react";

/**
 * Refraction for the header's liquid glass (2026-10-24, on request). Only
 * Chromium can bend what is behind an element (`backdrop-filter: url(#…)`
 * pointing at an SVG filter); Safari and Firefox drop or mishandle it. So this
 * renders the filter and sets `data-refract` on <html> only when the browser
 * reports itself as Chromium; the CSS for it hangs off that attribute
 * (`html[data-refract] .glass-bar` in app/globals.css), and everywhere else the
 * plain blurred glass stays.
 *
 * The displacement map is a vertical gradient stretched over the bar: the green
 * channel pushes the backdrop up at the top edge and down at the bottom edge and
 * is neutral (128) in the middle, so the bar's middle is undistorted and its
 * rims bend what passes under them, like the rounded edge of a lens. The red
 * channel stays neutral (no sideways shift). Colour interpolation is sRGB so
 * 128 really means "no move".
 */
const MAP = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" preserveAspectRatio="none">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="rgb(128,255,0)"/>` +
    `<stop offset="0.4" stop-color="rgb(128,128,0)"/>` +
    `<stop offset="0.6" stop-color="rgb(128,128,0)"/>` +
    `<stop offset="1" stop-color="rgb(128,0,0)"/>` +
    `</linearGradient></defs><rect width="64" height="64" fill="url(#g)"/></svg>`,
);

export function GlassRefraction() {
  useEffect(() => {
    const brands = (navigator as Navigator & { userAgentData?: { brands: { brand: string }[] } }).userAgentData?.brands;
    if (brands?.some((b) => /Chromium/i.test(b.brand))) {
      document.documentElement.setAttribute("data-refract", "");
    }
    return () => document.documentElement.removeAttribute("data-refract");
  }, []);
  return (
    <svg aria-hidden width="0" height="0" className="pointer-events-none absolute size-0">
      <filter id="glass-refract" x="0" y="0" width="1" height="1" colorInterpolationFilters="sRGB">
        <feImage href={`data:image/svg+xml,${MAP}`} preserveAspectRatio="none" result="map" />
        <feDisplacementMap in="SourceGraphic" in2="map" scale="22" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}
