/**
 * Board helpers shared by the API routes and the UI — pure, no server
 * imports, safe in client components.
 *
 * Length is total inches (surfboards are sized 6'2" everywhere, Taiwan
 * included — the one exception to the metric convention, see CLAUDE.md
 * "Conventions"). Volume is litres.
 */
import type { Board, Rocker } from "./types";

export const ROCKERS: Rocker[] = ["low", "medium", "high"];

export const MAX_BRAND = 80;
export const MAX_BOARD_NOTE = 500;
export const MAX_LENGTH_IN = 240; // 20'0"
export const MAX_VOLUME_L = 300;

/** 74 -> 6'2", 74.5 -> 6'2.5". */
export function formatLength(lengthIn: number | null | undefined): string | null {
  if (lengthIn == null || !Number.isFinite(lengthIn) || lengthIn <= 0) return null;
  const total = Math.round(lengthIn * 10) / 10;
  let ft = Math.floor(total / 12);
  let inches = Math.round((total - ft * 12) * 10) / 10;
  if (inches >= 12) {
    ft += 1;
    inches -= 12;
  }
  return `${ft}'${inches}"`;
}

/** Split total inches into the form's two fields. */
export function splitLength(lengthIn: number | null | undefined): { ft: string; inches: string } {
  if (lengthIn == null || lengthIn <= 0) return { ft: "", inches: "" };
  const ft = Math.floor(lengthIn / 12);
  const inches = Math.round((lengthIn - ft * 12) * 10) / 10;
  return { ft: String(ft), inches: String(inches) };
}

/** The form's ft + in fields -> total inches. Empty both -> null; anything
 *  unparseable or out of range -> NaN (caller shows an error). */
export function joinLength(ft: string, inches: string): number | null {
  const f = ft.trim();
  const i = inches.trim();
  if (!f && !i) return null;
  const fn = f ? Number(f) : 0;
  const inn = i ? Number(i) : 0;
  if (!Number.isFinite(fn) || !Number.isFinite(inn) || fn < 0 || inn < 0 || inn >= 12) return NaN;
  if (!Number.isInteger(fn)) return NaN;
  const total = fn * 12 + inn;
  if (total <= 0 || total > MAX_LENGTH_IN) return NaN;
  return Math.round(total * 10) / 10;
}

/** "Pyzel 6'2"" — brand + length, whichever exist. */
export function boardLabel(board: Pick<Board, "brand" | "lengthIn">): string {
  return [board.brand.trim(), formatLength(board.lengthIn)].filter(Boolean).join(" ");
}

export function formatVolume(volumeL: number | null | undefined): string | null {
  if (volumeL == null || !Number.isFinite(volumeL)) return null;
  return `${Math.round(volumeL * 100) / 100} L`;
}

export type BoardInput = Pick<Board, "brand" | "lengthIn" | "volumeL" | "rocker" | "note">;

/** Validates a POST/PUT body. Server-side source of truth; the form mirrors it. */
export function parseBoardInput(body: unknown): { ok: true; value: BoardInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid JSON body" };
  const b = body as Record<string, unknown>;

  const brand = typeof b.brand === "string" ? b.brand.trim() : "";
  if (brand.length > MAX_BRAND) return { ok: false, error: `brand is limited to ${MAX_BRAND} characters` };

  const note = typeof b.note === "string" ? b.note.trim() : "";
  if (note.length > MAX_BOARD_NOTE) {
    return { ok: false, error: `note is limited to ${MAX_BOARD_NOTE} characters` };
  }

  const num = (v: unknown): number | null | "bad" => {
    if (v == null || v === "") return null;
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
    return Number.isFinite(n) ? n : "bad";
  };

  const lengthIn = num(b.lengthIn);
  if (lengthIn === "bad" || (lengthIn != null && (lengthIn <= 0 || lengthIn > MAX_LENGTH_IN))) {
    return { ok: false, error: "lengthIn must be total inches, 1-240" };
  }
  const volumeL = num(b.volumeL);
  if (volumeL === "bad" || (volumeL != null && (volumeL <= 0 || volumeL > MAX_VOLUME_L))) {
    return { ok: false, error: "volumeL must be litres, 1-300" };
  }

  let rocker: Rocker | null = null;
  if (b.rocker != null && b.rocker !== "") {
    if (!ROCKERS.includes(b.rocker as Rocker)) {
      return { ok: false, error: "rocker must be low, medium or high" };
    }
    rocker = b.rocker as Rocker;
  }

  if (!brand && lengthIn == null) return { ok: false, error: "a board needs a brand or a length" };

  return {
    ok: true,
    value: {
      brand,
      lengthIn: lengthIn == null ? null : Math.round(lengthIn * 10) / 10,
      volumeL: volumeL == null ? null : Math.round(volumeL * 100) / 100,
      rocker,
      note,
    },
  };
}
