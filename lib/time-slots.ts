// The time picker's grid: every half hour, 00:00 … 23:30. Open-Meteo is hourly
// (a :30 time takes the nearest hour, see getConditions) and the tide
// bracket works to the minute, so finer than this would promise more than
// the data has. It was 2-hourly (Swelleye's table) until 2026-10-20.
export const SLOT_MINUTES = 30;
export const TIME_SLOTS = Array.from({ length: (24 * 60) / SLOT_MINUTES }, (_, i) => {
  const m = i * SLOT_MINUTES;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
});
