# Validation plan — does spot-fit actually work?

The claim under test: **one offshore reading plus each break's orientation can
substitute for a per-spot tuned forecast.** It might not. This is how we find
out, and what would make us drop it.

Read `lib/spot-fit.ts` first for what is being computed.

---

## Phase 0 — harvest (prerequisite, not optional)

Crawl all 42 `swelleye.com/en/surf-spots/<slug>/` pages for:

- lat/lng (embedded in the page URLs)
- the Spot Infographic: facing, wave type, seabed, best tide, best swell
  direction, best wind direction, surfer level

Fills `lib/spots.ts`. The app needs this anyway, so it is shared cost, not
validation overhead.

**Cost:** 42 page reads. **Blocker:** nothing works per-spot without it.

---

## Phase 1 — one-day cross-section: can it DISCRIMINATE?

Pick a day with a clear directional swell (NE monsoon, or typhoon groundswell —
the more directional, the sharper the test). Then:

1. Pull one Open-Meteo reading per region (remember: neighbouring spots share a
   grid node, so this is a handful of readings, not 42).
2. Run `computeFit` for every spot.
3. Read Swelleye's own forecast height for the same spots at the same hour.
4. Compare **rank orderings** — Spearman's rho between our `effectiveSwellM`
   and Swelleye's swell height.

**Pass:** rho > 0.6 AND zero directional blunders — no spot where we say 0 m and
Swelleye says it's working, or vice versa. The blunders matter more than the
correlation; getting the ordering roughly right while calling a working spot
dead is a failure.

**What failure would mean:** geometry isn't capturing the dominant variation.
Most likely culprits are shadowing (Guishan Island sits off the Yilan coast and
`cos(incidence)` knows nothing about it) or Swelleye using a different source
model entirely.

**Important limitation:** this phase measures whether we resemble Swelleye, NOT
whether we are right. Swelleye is a reference, not ground truth.

---

## Phase 2 — across days, against humans: is it TRUE?

Swelleye carries a **daily surfer star rating** on each spot page ("2.5 / 5,
2 surfer ratings"). That is independent human ground truth, and it is free.

1. Choose 8-10 spots with deliberately different orientations — north coast
   facing N, northeast facing E, east coast, south, west.
2. Once a day, record: our features + Swelleye's star rating for that spot.
3. Two weeks gives roughly 100-140 observations.
4. Test which feature tracks the rating: `exposure`, `inSwellWindow`,
   `onshoreWindMs`, `junkRatio`, `tideMatchesBest`.

**Pass:** at least one feature shows a clear monotonic relationship with rating.

**Caveat, and it is a big one:** those ratings often rest on one or two voters.
Very noisy. Look for trend across many spot-days, never trust a single day.

---

## Phase 3 — against Capy's own journal (the real target)

This is the question that actually matters, and it is not "which spot is good"
— it is **"which conditions does Capy enjoy"**. Different question, and only
the journal can answer it.

**Blocker: there is no rating field.** It was offered at the start and declined.
Without an outcome variable there is nothing to correlate the features against,
and Phase 3 cannot run at all. Simplest fix: a 1-5 star field on each session.
Even a binary good/bad would do.

**Needs N ~= 30 sessions** before any pattern is worth believing.

---

## Collection mechanics

- Phase 0 and 1 are one-off and can be done now, via the browser.
- Phase 2 is a daily job. In the artifact setup it would need a scheduled task,
  which is currently blocked by the network allowlist (see CLAUDE.md). After
  self-hosting it is a cron job.

## When to abandon this approach

- Phase 1 rho < 0.3 — the geometry is noise; go back to reading Swelleye.
- Or: `exposure` shows no relationship to ratings but `junkRatio` does. Then
  throw away the orientation model and keep only the wind-wave-to-swell ratio,
  which needs no spot statics at all and already looked informative on
  2026-09-17.

Dropping it is a legitimate result. Better than shipping a number that looks
authoritative and is decorative.

---

# RESULT — Phase 1 pilot, Jialeshui, 2026-09-18

One spot, two hours. Swelleye's spot-tuned forecast vs Open-Meteo offshore
plus `computeFit`. Jialeshui statics: faces SE, best swell ENE/E/SE/SSE,
best wind W, best tide Mid. Real coordinates 21.987722, 120.845982 (the
earlier 22.05/120.90 guess was ~8 km out).

| | Swelleye | Open-Meteo raw | computeFit `effectiveSwellM` |
|---|---|---|---|
| 06:00 | 1.1 m @ 7.4 s | 1.12 m @ 7.9 s from 93° | 0.83 m |
| 16:00 | 1.0 m @ 7.5 s | 0.96 m @ 7.9 s from 98° | 0.77 m |

## Finding 1 — raw Open-Meteo already matches Swelleye

1.12 vs 1.1, and 0.96 vs 1.0. Within 0.04 m at both hours. No adjustment
needed at all.

## Finding 2 — the exposure term makes it WORSE. Drop it.

Scaling by `cos(incidence)` under-predicts by 0.27 m and 0.23 m — a consistent
~25% shortfall. The correction subtracts signal.

The physics explains why: shoaling waves **refract toward shore-normal**. A
swell arriving 42° off the beach normal in deep water does not stay 42° off as
it reaches the break; it bends in. Applying `cos()` to the *offshore* angle
therefore over-penalises badly. And both numbers appear to describe the same
quantity — an offshore/nearshore swell height, not a breaking wave height —
so there was nothing to project in the first place.

**Action:** `effectiveSwellM` demoted. Do not display it, do not treat it as a
height estimate. `exposure` and `incidenceDeg` are kept as descriptive fields
only, pending Finding 3.

## Finding 3 — untested at the extremes; do NOT generalise yet

Both samples had moderate incidence (42°, 37°). The model may still be right
where it matters most — a west-coast break on an east swell computes
`exposure = 0`, and that is very likely correct. What this pilot disproves is
the *middle* of the range, not the blocked case.

**Next test:** a spot whose orientation clearly blocks the day's swell. If
`exposure = 0` there and Swelleye also shows nothing, the term survives as a
shadowing flag rather than as a scaling factor.

## Finding 4 — what still looks worth keeping

- **Secondary swell** — 0.42 m from NE at 06:00 growing to 0.6 m from ENE by
  16:00. Swelleye cannot show this at all.
- **junkRatio** — 0.59 / 0.52 today. Caution: on 2026-09-17, rated 2.5/5, it
  was 1.18, i.e. *higher* junk on the better-rated day. One contradicting
  datapoint. n is far too small; keep collecting.
- **tide band** — 06:00 low, 16:00 mid. Jialeshui's best tide is Mid, so the
  afternoon matched and the dawn did not. Swelleye gives the tide height but
  never tells you whether it suits the break. This is genuine added value.
- **wind mode** — wind from NE 37° against a SE-facing beach is cross-shore,
  and does not match the published best of W.

## Finding 5 — wind speed disagrees

Open-Meteo 5.5 m/s vs Swelleye 8 m/s at 06:00 (gusts agree: 10.7 vs 10).
Roughly 30% apart. Unresolved — possibly different heights or averaging
windows. Worth pinning down before trusting wind numbers from either.

## Ground truth available

Swelleye's daily surfer rating for Jialeshui: 9/16 2.0/5, 9/17 2.5/5,
9/18 2.0/5. Three points. Nowhere near enough, but the collection mechanism
is confirmed to work.

## Verdict

Phase 1 fired on the first test and killed the headline feature. The geometry
does not improve height prediction. What survives is the part that was never
about geometry: secondary swell, the wind-sea split, and matching tide and wind
against each spot's published preferences.

---

# RESULT — Phase 1b, Nanwan vs Jialeshui, 2026-09-18

The shadowing test from Finding 3. Nanwan (21.959292, 120.762598) faces S,
best swell S/SE/SSW, and its own description says it is "flat for most of the
year" except on S/SE typhoon swells. Today's swell is from the E. Textbook
blocked case, 25 km from Jialeshui.

| spot | hour | facing | swell from | incidence | exposure | Swelleye height | inWindow | surfer rating |
|---|---|---|---|---|---|---|---|---|
| Jialeshui | 06:00 | SE (135°) | 93° E | 42° | 0.74 | 1.1 m | yes | 2.0 / 5 |
| Jialeshui | 16:00 | SE (135°) | 98° E | 37° | 0.80 | 1.0 m | yes | 2.0 / 5 |
| Nanwan | 06:00 | S (180°) | 94° E | 86° | **0.07** | 1.0 m | no | **1.0 / 5** |
| Nanwan | 16:00 | S (180°) | 96° E | 84° | **0.10** | 1.0 m | no | **1.0 / 5** |

## Finding 6 — Swelleye's swell height is NOT spot-adjusted

Nanwan 1.0 m, Jialeshui 1.1 m. Near-identical, despite Nanwan being side-on to
the swell and rated half as good by the people who surfed it. Open-Meteo says
the same thing (1.06 vs 1.12), because both are reporting the same regional
offshore swell.

**Swelleye's spot tuning lives in the infographic, not in the forecast table.**
This corrects a premise that has been wrong since 2026-09-16: "Swelleye is the
spot-tuned one" is true of its local knowledge, not of its numbers.

## Finding 7 — Finding 2 was measured against the wrong reference. Restore exposure.

Yesterday exposure was demoted for deviating from Swelleye's height. But
Swelleye's height was never a per-spot target, so that test could only ever
have punished a term that discriminates. Against the reference that actually
matters — what surfers said — the picture inverts:

| discriminator | Jialeshui : Nanwan |
|---|---|
| Swelleye swell height | 1.10 (no signal) |
| **exposure** | **10.7** |
| **human rating** | **2.00** |

Exposure and `inSwellWindow` both separate the two spots in the direction the
ratings go. Swelleye's height separates nothing.

`effectiveSwellM` stays demoted — it is still not a height at the break. But
`exposure` and `inSwellWindow` are restored as the per-spot signals, which is
what they were for.

## Caveats — do not oversell this

- n = 2 spots, 1 day, 1 swell direction.
- Ratings rest on 1-2 voters each.
- exposure and `inSwellWindow` are collinear here; this test cannot say which
  is better. A day with swell just outside a window but near-normal to the
  beach would separate them.
- "Any spot not facing E is bad today" would explain these data equally well.
  Needs days with different swell directions before the geometry is confirmed
  rather than merely consistent.

## Next

Repeat on a day with a S or SE swell, when Nanwan should come alive and the
ranking should INVERT. That is the falsifiable prediction, and it is the test
worth waiting for.

---

# DECISION 2026-09-18 — surfer ratings are out

Capy's call: Swelleye's surfer star ratings are not to be used. Reasonable —
one or two voters per spot per day, no consistency between raters.

**This removes the only independent ground truth the plan had.** Consequences,
stated plainly:

- Phase 2 as written is dead. It was built entirely on those ratings.
- Finding 7 loses its evidence. Exposure still separates Nanwan from Jialeshui
  by 10.7x where Swelleye's height separates them by 1.10x, but "which one is
  correct" now has nothing to check against. The discrimination is real; the
  *direction* is no longer independently confirmed.
- Neither Swelleye's nor Open-Meteo's height discriminates between spots
  (Finding 6), so no forecast number can serve as the target either.

**What is left as weak corroboration:** each spot's published description and
its `bestSwellDir`. Nanwan's own page says it is "flat for most of the year"
and works on S/SE swells — today's E swell gives exposure 0.07, which agrees.
`facing` and `bestSwellDir` are separate published fields, so exposure agreeing
with `inSwellWindow` is two independent pieces of Swelleye's local knowledge
pointing the same way. Weak, and close to circular. Not a substitute.

**The only real replacement is Capy's own journal — which needs a rating
field.** This has now come up three times and it is load-bearing: without an
outcome variable, spot-fit is computable but unfalsifiable. Ship a 1-5 star or
even a binary good/bad on each session, or accept that the model stays a
plausible unverified heuristic indefinitely.

Until then: compute the features, store them, display them as descriptive
("side-on to the swell", "outside the usual window"), and never as a score.
