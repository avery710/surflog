# Critique case library

`references/critiques/part-1.md` … `part-6.md` hold **713 real logo critiques** in
English (1,448 critique notes in total). Each case is one logo that was submitted for
review: the submitter's brief (when there was one), then the critique notes. The cases
are anonymous: names are replaced with `[name]`, and there are no dates, sources or
images.

Use the library to **ground a judgement in precedent**, and to check whether a move you
are about to make has already been criticised many times over.

The critiques are blunt. The profanity of the originals has been removed; the
judgements have not been softened. Keep it that way in your own output: be direct about
the work, never abusive, never about the person.

## Case shape

Every note was originally a callout pinned to a region of the submitted image, so each
remark carries its location: a coarse zone (`top-left`, `center`, `bottom-right`) plus an
approximate position from the top-left. That's the model for critique output: **every
remark is anchored to a specific place in the artwork.**

```
## Case 0108

- Submitter's note: Student project: a logo for a roadside café.

Critique notes (4):

1. **middle-left** [middle-left, ~3%,60% from top-left]: <remark>
2. **center** [center, ~39%,60% from top-left]: <remark>
```

Part 1 (cases 0001–0106) uses the same content without note numbers or bold zones:
`middle-left [middle-left, ~3%,60% from top-left]: <remark>`. Search patterns that rely
on `1. **` will miss it; match `from top-left]:` instead.

Where a critique discusses a specific Cyrillic letter on the logo, that letter is kept
in Cyrillic. The images themselves are not included, so a case tells you what was said
about a logo, not exactly what it looked like.

## Searching it

Case headings, and every note:

```bash
grep -n '^## Case ' references/critiques/*.md
grep -c 'from top-left\]:' references/critiques/*.md
```

Find precedent for a specific failure. `-B8` pulls the case heading and brief up with
the hit:

```bash
grep -rn -i -B8 'typeface\|font'                   references/critiques/
grep -rn -i -B8 'reads as\|looks like\|read as'   references/critiques/   # misreadings
grep -rn -i -B8 'letterspacing\|kerning\|tracking\|spacing' references/critiques/
grep -rn -i -B8 'small size\|at small\|scaled down\|reduc' references/critiques/
grep -rn -i -B8 'clip-art\|clipart\|stock'        references/critiques/
grep -rn -i -B8 'gradient\|shadow\|gloss'         references/critiques/
grep -rn -i -B8 'composition\|focal point\|balance' references/critiques/
grep -rn -i -B8 'idea\|brief\|concept'            references/critiques/
grep -rn -i -B8 'heart\|shield\|leaf\|drop\|globe\|crown\|swoosh' references/critiques/   # cliché motifs
grep -rn -i -B8 'cliché\|banal\|generic\|trite'   references/critiques/
grep -rn -i -B8 'this works\|good\|well done\|nice' references/critiques/   # praise
```

## Using it in a critique

Follow the cases' method:

1. Pin every remark to a specific region of the image.
2. State what is broken, why it is broken, and the concrete fix.
3. Rank by severity: idea failures first, then construction, then finish.
4. Say plainly when something works. The cases are harsh, but they do praise real
   quality and explain their reasoning.

Cite precedent as *case number + the point*, in this shape:

> Case 0108: a roadside-café mark that relied on a diagram of a car leaving the road
> only made sense to insiders; the fix was to drop the arrow and let the rhythm of the
> letters and lane markings carry it.

**Only cite a case you have actually opened and read.** Never invent a case number or a
plausible-sounding verdict; a made-up citation is worse than none, and the library is
right there to check. Paraphrase rather than pasting long passages.
