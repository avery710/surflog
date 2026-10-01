# Production — turning the idea into real vector artwork

Read this before writing any SVG. The doctrine is in `SKILL.md`; this is how the file
actually gets made.

Deliver **SVG**: vector, self-contained, no external font dependency, no embedded
rasters, no filters.

---

## 1. Choosing and finding the typeface

Use a real, well-made typeface. Do not draw your own letters unless you can actually
draw letters. When in doubt, take a neutral well-built grotesque.

`fc-list` does not exist on Windows. Use the bundled finder instead — it reads the sfnt
`name` table directly, so you get the real family and style names rather than guesses
from filenames:

```bash
node scripts/find-fonts.mjs                # every installed family
node scripts/find-fonts.mjs grotesk        # filter by family, style or filename
node scripts/find-fonts.mjs --json         # machine-readable
```

It scans the platform font directories on Windows, macOS and Linux, and reads `.ttc`
collections correctly (one entry per face inside the file).

**Check script coverage before you commit to a face.** If the name is Cyrillic, most
"nice" Latin faces will not cover it. `wordmark.py` refuses to run on a missing glyph
rather than leaving a hole, which is the check that matters — but it is faster to pick a
covering face first.

## 2. Setting the wordmark

Convert type to outlines so the file is self-contained and the letterforms are
professionally drawn:

```bash
python3 scripts/wordmark.py --text "FINNROST" --font "C:/Windows/Fonts/georgia.ttf" \
    --tracking 30 --out logo.svg --metrics logo.json
```

| Flag | Purpose |
|---|---|
| `--text` | exact spelling and capitalisation |
| `--font` | path to `.ttf` / `.otf` / `.ttc` |
| `--face-index` | which face inside a `.ttc` |
| `--tracking` | uniform letterspacing, **in font units** (upem is usually 1000 or 2048) |
| `--kern AV=-60` | per-pair correction, repeatable |
| `--box tight\|advance` | `tight` hugs the outlines (default); `advance` gives advance-width × cap-height for baseline alignment |
| `--color` | fill; use `currentColor` to inherit from context |
| `--metrics` | write cap height, advance and bbox as JSON, for aligning the lockup |

Then tune:

- **Optical tracking** — tighten for display sizes, open for small sizes.
- **Per-pair kerning** for the problem pairs: `AV`, `To`, `LT`, `Ко`, `Га`.
- **Cap-height alignment** against the mark — use the measured `capHeight` from
  `--metrics`, never the common 0.7-em guess, which is simply wrong and will misalign
  the lockup.
- **Never scale text non-uniformly.** Do not stretch or condense by transform; pick a
  proper width instead.

### What the script does not do

It applies the legacy `kern` table when a font has one, but **not** OpenType GPOS
kerning — which is where most modern fonts keep it. The script tells you when it detects
this. Check the problem pairs by eye in the proof sheet and correct them with `--kern`.

### Interpreter trap on Windows

`wordmark.py` deliberately has **no shebang line**. Both the `py` launcher and the
PyManager `python3` shim honour a shebang and will hand the script to whichever runtime
they map `python3` to — which may not be the default one where you installed fontTools.
The symptom is maddening: `py -c "import fontTools"` succeeds while `py wordmark.py`
reports it missing. Without a shebang, both use the default. **Do not add one back.**

If the import still fails, the error message names the exact interpreter that ran and
the exact pip command for it.

## 3. Building the mark

- Few primitives, one construction logic, one consistent stroke weight.
- **Write the numeric relationships down** (stroke = 12 units, corner radius = 8 units) and hold them everywhere.
- Align to a real grid, then **correct optically** where the math looks wrong — a circle must overshoot a square slightly to look the same size.
- **Union overlapping shapes into single paths.** No self-intersections, no stray hairline gaps. A visible self-intersection is a manufacturing defect, not an artistic device.
- One flat fill. Use `currentColor` so the mark inherits colour from context.
- `viewBox` tight to the artwork, no empty padding baked in.

## 4. The lockup

- **Decide dominance — the boss-and-secretary rule.** If mark and wordmark compete, make one clearly primary and the other secondary in size or weight. Two equal elements read as indecision.
- Set **clear space** as a fraction of the mark (e.g. the cap height), and state it.
- Separate elements that clump together "like a lump of dumplings in a pot" — and conversely, don't let a group drift apart until it stops reading as one object.
- **Internal ties are always tighter than external ones.** If the gap inside the name exceeds the gap between name and mark, the composition is broken.
- Produce the horizontal lockup, the stacked lockup, and the mark alone.

## 5. The proof sheet — the audit gate

```bash
node scripts/proof-sheet.mjs logo.svg mark.svg --out proof-sheet.png \
    --sizes 96,48,24,16 --label "primary lockup"
```

Renders full size, each reduction, one flat colour, inverted on black, three blur
treatments, and business-card and sign contexts — then writes a single PNG.

It drives headless Chrome over the DevTools protocol rather than using `cairosvg`:
cairo is painful to install on Windows, and a browser renders SVG exactly the way a
viewer's browser will. Set `CHROME=/path/to/chrome` if it cannot find one. Node 22+.

It also warns if the artwork contains `<filter>`, `<image>`, an embedded data-URI raster
or a gradient — all forbidden in delivered artwork.

**Then open the PNG and look at it.** The gate is not that the script exited 0. It is
you reading the rendered letters against the intended spelling, one by one. Generated
geometry fails in ways the source never reveals — a dropped letter, a collision, a shape
that reads as something else. This is the single highest-yield check in the whole skill.

## 6. Files to deliver

| File | What it is |
|---|---|
| `logo.svg` | primary lockup |
| `logo-stacked.svg` | stacked lockup |
| `mark.svg` | the mark alone |
| `logo-mono.svg` | one flat colour |
| `proof-sheet.png` | the rendered test sheet |

Plus a short written statement: the brief in one line, the idea in one sentence, which
of the two routes it took (unexpected subject move, or beautiful form), the audit results
including anything that failed and why it is acceptable, and what changes at small size.

One recommendation, at most one deliberate alternative. Never a contact sheet of twenty.
