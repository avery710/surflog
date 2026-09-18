import type { Session } from "./types";
import { spotLabel } from "./format";

const HEAD = [
  "date", "time", "spot", "rating",
  "swell_m", "period_s", "swell_from", "wind_ms", "gust_ms", "wind_from",
  "tide_m", "sea_c", "air_c",
  "om_swell_m", "om_period_s", "om_swell_deg", "om_wind_ms", "om_wind_deg",
  "notes",
];

const cell = (v: unknown): string => {
  if (v == null) return "";
  const t = String(v);
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

export function sessionsToCsv(sessions: Session[]): string {
  const lines = [HEAD.join(",")];
  // oldest first, like the reference export
  [...sessions].reverse().forEach((s) => {
    const c = s.cond;
    const om = s.condOpenMeteo;
    lines.push(
      [
        (s.when || "").slice(0, 10),
        (s.when || "").slice(11, 16),
        spotLabel(s.spot),
        s.rating,
        c?.swellHeightM, c?.swellPeriodS, c?.swellDir,
        c?.windSpeedMs, c?.windGustMs, c?.windDir,
        c?.tideM, c?.seaTempC, c?.airTempC,
        om?.swellHeightM, om?.swellPeriodS, om?.swellDirDeg,
        om?.windSpeedMs, om?.windDirDeg,
        s.notes,
      ]
        .map(cell)
        .join(",")
    );
  });
  return lines.join("\n");
}

export function downloadCsv(sessions: Session[], filename = "surflog.csv") {
  const csv = sessionsToCsv(sessions);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
