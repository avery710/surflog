import type { Board, Session } from "./types";
import { boardLabel } from "./boards";
import { spotLabel } from "./format";
import { sessionPointsMet } from "./goal";

const HEAD = [
  "date", "time", "spot", "board",
  "swell_m", "period_s", "swell_from", "wind_ms", "gust_ms", "wind_from",
  "tide_m", "sea_c", "air_c",
  "om_swell_m", "om_period_s", "om_swell_deg", "om_wind_ms", "om_wind_deg",
  "goal", "goal_met", "goal_points_met",
  "notes",
];

const cell = (v: unknown): string => {
  if (v == null) return "";
  const t = String(v);
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

export function sessionsToCsv(sessions: Session[], boards: Board[] = []): string {
  const boardById = new Map(boards.map((b) => [b.id, b]));
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
        (() => {
          const b = s.boardId ? boardById.get(s.boardId) : undefined;
          return b ? boardLabel(b) : null;
        })(),
        c?.swellHeightM, c?.swellPeriodS, c?.swellDir,
        c?.windSpeedMs, c?.windGustMs, c?.windDir,
        c?.tideM, c?.seaTempC, c?.airTempC,
        om?.swellHeightM, om?.swellPeriodS, om?.swellDirDeg,
        om?.windSpeedMs, om?.windDirDeg,
        s.goalText, s.goalMet == null ? null : s.goalMet ? "yes" : "no",
        sessionPointsMet(s)?.map((m) => (m ? "yes" : "no")).join(";"),
        s.notes,
      ]
        .map(cell)
        .join(",")
    );
  });
  return lines.join("\n");
}

export function downloadCsv(sessions: Session[], boards: Board[] = [], filename = "surflog.csv") {
  const csv = sessionsToCsv(sessions, boards);
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
