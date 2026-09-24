/**
 * Compares Swelleye (manual `cond`) with Open-Meteo (`condOpenMeteo`) across
 * every session that has both, prints a table and writes
 * reports/swelleye-vs-openmeteo.md.
 *
 * Run:  npm run compare      (uses `npx tsx`; loads .env.local itself)
 *
 * READ-ONLY: one SELECT on `sessions`, no writes. Reads every owner's rows
 * (it's a dev tool run with the service key, not an app feature).
 */
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Session } from "../lib/types";
import {
  METRIC_META,
  THRESHOLDS,
  compareSession,
  summarise,
  type MetricSummary,
  type SessionComparison,
} from "../lib/source-compare";

const ROOT = path.resolve(__dirname, "..");

async function loadSessions(): Promise<Session[]> {
  // Node's built-in .env loader; not in @types/node 20, hence the cast.
  try {
    (process as unknown as { loadEnvFile: (p: string) => void }).loadEnvFile(path.join(ROOT, ".env.local"));
  } catch {
    /* env may already be set */
  }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SECRET_KEY not set");
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await db.from("sessions").select("*").order("session_when", { ascending: true });
  if (error) throw new Error(`Supabase: ${error.message}`);
  return (data as Record<string, unknown>[]).map(
    (r) =>
      ({
        id: r.id,
        ownerId: r.owner_id,
        spot: r.spot,
        when: r.session_when,
        cond: r.cond ?? null,
        condOpenMeteo: r.cond_open_meteo ?? null,
        condCwaTide: r.cond_cwa_tide ?? null,
      }) as unknown as Session
  );
}

const signed = (n: number | null, dp = 2) => (n === null ? "-" : (n > 0 ? "+" : "") + n.toFixed(dp).replace(/\.?0+$/, ""));

function mdTable(head: string[], rows: string[][]): string {
  return [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n");
}

function sessionRows(cs: SessionComparison[]): string[][] {
  return cs.flatMap((c) =>
    c.metrics.map((m) => [
      `${c.spot} ${c.when.replace("T", " ")}`,
      METRIC_META[m.key].label,
      m.swelleye,
      m.openMeteo,
      m.diff === null ? "-" : `${signed(m.diff)} ${METRIC_META[m.key].unit}`.trim(),
      m.pctDiff === null ? "-" : `${signed(m.pctDiff, 1)}%`,
      m.verdict,
    ])
  );
}

function summaryRows(ss: MetricSummary[]): string[][] {
  return ss.map((s) => [
    METRIC_META[s.key].label,
    String(s.n),
    s.overall.toUpperCase(),
    `${s.counts.close}/${s.counts.noticeable}/${s.counts.large}`,
    s.meanDiff === null ? "-" : `${signed(s.meanDiff)} ${METRIC_META[s.key].unit}`.trim(),
    s.meanAbsDiff === null ? "-" : `${s.meanAbsDiff} ${METRIC_META[s.key].unit}`.trim(),
    s.maxAbsDiff === null ? "-" : `${s.maxAbsDiff} ${METRIC_META[s.key].unit}`.trim(),
    s.meanRatio === null ? "-" : s.meanRatio.toFixed(2),
  ]);
}

const SUMMARY_HEAD = ["Metric", "n", "Differs a lot?", "close/noticeable/large", "Mean diff (OM-SW)", "Mean abs diff", "Max abs diff", "Mean OM/SW ratio"];

function analysis(ss: MetricSummary[], nSessions: number): string {
  const get = (k: string) => ss.find((s) => s.key === k);
  const line = (k: string, what: string) => {
    const s = get(k);
    if (!s) return `- ${what}: not comparable in any session.`;
    return `- **${METRIC_META[s.key].label}** (${s.overall.toUpperCase()}, n=${s.n}): mean diff ${signed(s.meanDiff)} ${METRIC_META[s.key].unit}, mean abs ${s.meanAbsDiff}, max abs ${s.maxAbsDiff}. ${what}`;
  };
  return `## Analysis

**Sample size warning: n = ${nSessions} session(s), all from the same spot and week.** Every statement below describes these sessions only. Two points cannot separate a systematic bias from noise, so nothing here is a conclusion about the two sources in general. It scales as more Swelleye readings are typed into sessions; re-run then.

### What was measured

${line("swellHeightM", "Swelleye's own page says its number is the regional offshore swell, the same quantity Open-Meteo reports (CLAUDE.md, Nanwan vs Jialeshui test), so agreement is the expectation.")}
${line("swellPeriodS", "Same quantity again; Swelleye gives one swell train, Open-Meteo's primary train is the comparable one (secondary swell and wind waves are separate fields and are not compared).")}
${line("swellDir", "Swelleye directions are arrows read to a 16-point compass, so this side is quantised to 22.5 degree steps. Differences under one step cannot be told apart from rounding.")}
${line("windSpeedMs", "See the open question in CLAUDE.md. Stored Open-Meteo wind values were checked: they look like the corrected m/s ones (17 Sep 06:00 reads 7.45 m/s, the corrected figure CLAUDE.md records for the same hour; the old km/h value was 26.8). Note the rows' fetchedAt still says 2026-09-21, i.e. before the 2026-09-22 fix, so they were corrected in place rather than re-stamped.")}
${line("windGustMs", "CLAUDE.md noted gusts agreeing earlier while mean wind did not; compare with the wind speed row.")}
${line("windDir", "Same compass quantisation as swell direction.")}
${line("tideTiming", "Swelleye's tide note turning times vs Open-Meteo's turning points from hourly sea-level data (refined to sub-hour). Heights are not compared: different datums.")}
${line("tideTrend", "Rising/falling agreement (categorical).")}
${line("seaTempC", "")}
${line("airTempC", "Open-Meteo is a grid-cell value; Swelleye's air temp may be a station or model value; unknown.")}

### Plausible reasons for differences (hypotheses, not tested)

- **Different time base.** Swelleye is 2-hourly, Open-Meteo hourly; if the session time falls between Swelleye slots the typed value may be the neighbouring slot.
- **Quantisation.** Swelleye heights are typed to 1 decimal and directions to 16 points, so small direction and height gaps are partly rounding.
- **Wind: reference height / averaging window.** The open question in CLAUDE.md. Open-Meteo reports 10 m wind; Swelleye does not say what height or averaging it uses. If Open-Meteo is consistently lower than Swelleye by a stable ratio (see the OM/SW ratio column), that would fit a systematic definition difference rather than noise, but two points cannot establish a stable ratio, so the open question stays open.
- **Different models.** Both are regional/global model output, not observations; they will not match exactly even for the same underlying quantity.
- **Tide timing.** Open-Meteo's turning points are derived from hourly sea level, which limits precision to roughly 30 minutes (see lib/openmeteo.ts findTideEvents); Swelleye's times come from its own tide model.

### What cannot be concluded

- Whether either source is more accurate: neither is compared against observations. This only measures how far apart they are.
- Whether the differences are systematic. Need many more sessions across different conditions and spots.
- Anything about other spots or seasons.
`;
}

async function main() {
  const sessions = await loadSessions();
  const comps = sessions.map(compareSession).filter((c): c is SessionComparison => c !== null);
  const summary = summarise(comps);

  const t = THRESHOLDS;
  const thresholdRows = [
    ["Swell height", `close: <=${t.swellHeightM.absClose} m or <=${t.swellHeightM.pctClose}%`, `large: >${t.swellHeightM.absLarge} m and >${t.swellHeightM.pctLarge}%`],
    ["Swell period", `close: <=${t.swellPeriodS.absClose} s`, `large: >${t.swellPeriodS.absLarge} s`],
    ["Wind speed", `close: <=${t.windSpeedMs.absClose} m/s or <=${t.windSpeedMs.pctClose}%`, `large: >${t.windSpeedMs.absLarge} m/s and >${t.windSpeedMs.pctLarge}%`],
    ["Wind gust", `close: <=${t.windGustMs.absClose} m/s or <=${t.windGustMs.pctClose}%`, `large: >${t.windGustMs.absLarge} m/s and >${t.windGustMs.pctLarge}%`],
    ["Swell / wind direction", `close: <=${t.directionDeg.absClose} deg (one compass step)`, `large: >${t.directionDeg.absLarge} deg`],
    ["Tide turn timing", `close: <=${t.tideTimingMin.absClose} min`, `large: >${t.tideTimingMin.absLarge} min`],
    ["Temperature", `close: <=${t.tempC.absClose} C`, `large: >${t.tempC.absLarge} C`],
  ];

  const skippedLines = comps.flatMap((c) =>
    c.skipped.map((s) => `- ${c.spot} ${c.when}: ${METRIC_META[s.key].label} skipped (${s.reason})`)
  );

  const generated = new Date().toISOString();
  const md = `# Swelleye vs Open-Meteo

Generated ${generated} by \`npm run compare\` (scripts/compare-sources.ts, lib/source-compare.ts). Differences are Open-Meteo minus Swelleye.

> **Small sample: ${comps.length} session(s) have both a typed Swelleye reading and an Open-Meteo reading (of ${sessions.length} total). Treat every verdict as anecdotal.**

## At a glance: do they differ a lot?

${mdTable(SUMMARY_HEAD, summaryRows(summary))}

("Differs a lot?" = NO if every sample is close, YES if more than ${t.yesShareLarge * 100}% of samples are large, otherwise MIXED. Ratio = Open-Meteo / Swelleye.)

## Per-session, per-metric

${mdTable(["Session", "Metric", "Swelleye", "Open-Meteo", "Diff", "Diff %", "Verdict"], sessionRows(comps))}

${skippedLines.length ? `Skipped:\n\n${skippedLines.join("\n")}\n` : ""}
## Thresholds used

Defined in \`THRESHOLDS\` in lib/source-compare.ts. Judgement calls, not fitted to data.

${mdTable(["Metric", "Close", "Large"], thresholdRows)}

Everything between close and large is "noticeable". Swelleye directions are quantised to a 16-point compass (+-${t.compassHalfStepDeg} deg), heights to 1 decimal.

${analysis(summary, comps.length)}`;

  const out = path.join(ROOT, "reports", "swelleye-vs-openmeteo.md");
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, md);

  // terminal output
  console.log(`Swelleye vs Open-Meteo: ${comps.length} session(s) with both blocks, of ${sessions.length}. SMALL SAMPLE.\n`);
  console.log(mdTable(SUMMARY_HEAD, summaryRows(summary)));
  console.log("\n" + mdTable(["Session", "Metric", "Swelleye", "Open-Meteo", "Diff", "Diff %", "Verdict"], sessionRows(comps)));
  if (skippedLines.length) console.log("\nSkipped:\n" + skippedLines.join("\n"));
  console.log(`\nReport written to ${path.relative(process.cwd(), out)}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
