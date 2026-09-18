// Swelleye's forecast table is 2-hour granularity (00, 02, 04 … 22) — see
// CLAUDE.md "The automation problem". The picker matches that grid.
export const TIME_SLOTS = Array.from({ length: 12 }, (_, i) => {
  const h = String(i * 2).padStart(2, "0");
  return `${h}:00`;
});
