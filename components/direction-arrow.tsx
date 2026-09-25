import { ArrowUp } from "lucide-react";

/**
 * An arrow for a "from" direction in degrees (the meteorological convention
 * Open-Meteo uses: 90 = coming from the east). It points the way the swell
 * or wind is travelling — from the east means an arrow pointing west — like
 * the arrows on Swelleye's forecast table. `ArrowUp` points north at 0deg,
 * so rotating by deg + 180 turns it to the travel direction.
 */
export function DirectionArrow({
  deg,
  className = "size-3.5",
  strokeWidth = 2.5,
}: {
  deg: number;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <ArrowUp
      aria-hidden
      className={`${className} shrink-0 text-primary`}
      strokeWidth={strokeWidth}
      style={{ transform: `rotate(${deg + 180}deg)` }}
    />
  );
}
