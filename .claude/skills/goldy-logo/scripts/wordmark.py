"""Set a wordmark in a real typeface and emit it as outlined SVG paths.

Run it as `python3 wordmark.py ...` (or `py wordmark.py ...` on Windows).

Deliberately has no `#!/usr/bin/env python3` line: on Windows both the `py` launcher
and the PyManager `python3` shim honour a shebang and will hand the script to whichever
runtime they map "python3" to — which is not necessarily the default one that has
fontTools installed. Without the line, both use the default. Do not add one back.

The point is a self-contained file: no font dependency, no live text, letterforms
drawn by an actual type designer rather than by you.

    py wordmark.py --text FINNROST --font C:/Windows/Fonts/georgia.ttf
    py wordmark.py --text "КОМПАС" --font ./Inter.ttf --tracking 40 --out mark.svg
    py wordmark.py --text AVATAR --font ./x.otf --kern AV=-60 --kern TA=-40

Requires fontTools:  py -m pip install fonttools

Notes on what this does and does not do:
  * Missing glyphs are a hard error, not a silent gap. A silently dropped letter is
    the single most common way generated logo artwork ships broken.
  * The legacy `kern` table is applied when present. OpenType GPOS kerning is NOT
    applied — most modern fonts keep kerning there. Check AV / To / LT / Ко / Га by
    eye in the proof sheet and correct them with --kern.
  * Never scale the result non-uniformly. Pick a proper width, don't stretch.
"""

import argparse
import json
import sys

try:
    from fontTools.ttLib import TTFont
    from fontTools.pens.svgPathPen import SVGPathPen
    from fontTools.pens.boundsPen import BoundsPen
except ImportError as exc:
    # Name the interpreter that actually ran. On Windows the `py` launcher honours the
    # shebang above and can hand the script to an older runtime than `py -c` uses, so
    # "I installed it already" and "it is missing" are both true at the same time.
    sys.exit(
        "{}: {}\n"
        "Running under: {} (Python {}.{})\n"
        "Install it for THAT interpreter:\n"
        '    "{}" -m pip install fonttools\n'
        "On Windows, prefer `python3 wordmark.py ...` or `py -3 wordmark.py ...` — a bare\n"
        "`py wordmark.py` follows the shebang and may pick a different runtime.".format(
            type(exc).__name__, exc, sys.executable,
            sys.version_info[0], sys.version_info[1], sys.executable))


def glyph_bounds(glyph_set, gname):
    pen = BoundsPen(glyph_set)
    glyph_set[gname].draw(pen)
    return pen.bounds  # (xMin, yMin, xMax, yMax) or None for a blank glyph


def cap_height(font, glyph_set, cmap):
    """Measure the real cap height from H.

    Many fonts have no OS/2 sCapHeight, and the common 0.7-em guess is simply wrong —
    it will misalign the lockup. Measuring the drawn H works for TrueType and CFF alike.
    """
    gname = cmap.get(ord("H")) or cmap.get(ord("Н"))  # Latin H, else Cyrillic En
    if gname:
        b = glyph_bounds(glyph_set, gname)
        if b:
            return b[3]
    try:
        if font["OS/2"].sCapHeight:
            return font["OS/2"].sCapHeight
    except Exception:
        pass
    return font["head"].unitsPerEm * 0.7


def legacy_kern_table(font):
    """Read the old-style `kern` table if the font has one. Returns {(gnameA, gnameB): value}."""
    if "kern" not in font:
        return {}
    pairs = {}
    try:
        for subtable in font["kern"].kernTables:
            pairs.update(subtable.kernTable)
    except Exception:
        pass
    return pairs


def build(text, font_path, face_index=0, tracking=0.0, pair_kern=None,
          color="#111", tight=True):
    font = TTFont(font_path, fontNumber=face_index)
    upem = font["head"].unitsPerEm
    cmap = font.getBestCmap()
    glyph_set = font.getGlyphSet()
    hmtx = font["hmtx"]
    cap = cap_height(font, glyph_set, cmap)
    kern = legacy_kern_table(font)
    pair_kern = pair_kern or {}

    missing = [ch for ch in text if ch != " " and ord(ch) not in cmap]
    if missing:
        raise SystemExit(
            "Font '{}' has no glyph for: {}\n"
            "Pick a face that covers the script you need — run find-fonts.mjs to look.".format(
                font_path, " ".join("{!r} (U+{:04X})".format(c, ord(c)) for c in missing)))

    parts, x, prev_gname, prev_ch = [], 0.0, None, None
    bbox = [None, None, None, None]  # xMin, yMin, xMax, yMax

    for ch in text:
        gname = cmap.get(ord(ch))
        if gname is None:  # only reachable for a space not in cmap
            x += upem * 0.3
            prev_gname, prev_ch = None, None
            continue

        if prev_gname is not None:
            x += tracking
            x += pair_kern.get(prev_ch + ch, kern.get((prev_gname, gname), 0))

        pen = SVGPathPen(glyph_set)
        glyph_set[gname].draw(pen)
        d = pen.getCommands()
        if d:
            parts.append('<path d="{}" transform="translate({:.1f},0)"/>'.format(d, x))
            b = glyph_bounds(glyph_set, gname)
            if b:
                xs = (b[0] + x, b[2] + x)
                bbox[0] = xs[0] if bbox[0] is None else min(bbox[0], xs[0])
                bbox[2] = xs[1] if bbox[2] is None else max(bbox[2], xs[1])
                bbox[1] = b[1] if bbox[1] is None else min(bbox[1], b[1])
                bbox[3] = b[3] if bbox[3] is None else max(bbox[3], b[3])

        x += hmtx[gname][0]
        prev_gname, prev_ch = gname, ch

    if bbox[0] is None:
        raise SystemExit("Nothing was drawn — every glyph was blank.")

    advance = x
    if tight:
        vx, vy = bbox[0], -bbox[3]
        vw, vh = bbox[2] - bbox[0], bbox[3] - bbox[1]
    else:
        vx, vy = 0.0, -cap
        vw, vh = advance, cap

    # Font coordinates are y-up, SVG is y-down — flip once, about the baseline.
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="{:.1f} {:.1f} {:.1f} {:.1f}">\n'
        '  <g fill="{}" transform="scale(1,-1)">\n    {}\n  </g>\n</svg>\n'
    ).format(vx, vy, vw, vh, color, "\n    ".join(parts))

    metrics = {
        "text": text, "font": font_path, "unitsPerEm": upem,
        "capHeight": round(cap, 1), "advanceWidth": round(advance, 1),
        "bbox": {"xMin": round(bbox[0], 1), "yMin": round(bbox[1], 1),
                 "xMax": round(bbox[2], 1), "yMax": round(bbox[3], 1)},
        "legacyKernPairsApplied": sum(
            1 for i in range(len(text) - 1)
            if (cmap.get(ord(text[i])), cmap.get(ord(text[i + 1]))) in kern),
        "hasGPOS": "GPOS" in font,
    }
    return svg, metrics


def parse_kern(values):
    out = {}
    for item in values or []:
        if "=" not in item:
            raise SystemExit("--kern expects PAIR=VALUE, e.g. --kern AV=-60 (got {!r})".format(item))
        pair, val = item.rsplit("=", 1)
        if len(pair) != 2:
            raise SystemExit("--kern pair must be exactly two characters (got {!r})".format(pair))
        out[pair] = float(val)
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--text", required=True, help="exact spelling and capitalisation")
    ap.add_argument("--font", required=True, help="path to a .ttf/.otf/.ttc file")
    ap.add_argument("--face-index", type=int, default=0, help="which face inside a .ttc")
    ap.add_argument("--tracking", type=float, default=0.0,
                    help="uniform letterspacing in font units (upem is usually 1000 or 2048). "
                         "Tighten for display sizes, open for small sizes.")
    ap.add_argument("--kern", action="append", metavar="AV=-60",
                    help="per-pair correction in font units; repeatable")
    ap.add_argument("--color", default="#111", help="fill; use 'currentColor' to inherit")
    ap.add_argument("--box", choices=["tight", "advance"], default="tight",
                    help="tight = viewBox hugs the drawn outlines (default); "
                         "advance = advance width x cap height, for baseline alignment")
    ap.add_argument("--out", help="write SVG here (default: stdout)")
    ap.add_argument("--metrics", help="write measurements here as JSON")
    a = ap.parse_args()

    svg, metrics = build(a.text, a.font, a.face_index, a.tracking,
                         parse_kern(a.kern), a.color, a.box == "tight")

    if a.out:
        with open(a.out, "w", encoding="utf-8") as fh:
            fh.write(svg)
        print("wrote {}".format(a.out), file=sys.stderr)
    else:
        sys.stdout.write(svg)

    if a.metrics:
        with open(a.metrics, "w", encoding="utf-8") as fh:
            json.dump(metrics, fh, indent=2, ensure_ascii=False)

    print("cap height {capHeight}  advance {advanceWidth}  upem {unitsPerEm}".format(**metrics),
          file=sys.stderr)
    if metrics["hasGPOS"] and not metrics["legacyKernPairsApplied"]:
        print("note: this font kerns via GPOS, which is not applied here. Check the "
              "problem pairs by eye in the proof sheet and correct with --kern.", file=sys.stderr)


if __name__ == "__main__":
    main()
