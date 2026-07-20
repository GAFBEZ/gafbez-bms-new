/**
 * Categorical accent colors for dashboard stat cards — used as full
 * solid-fill card backgrounds with white text on top.
 *
 * Validated with the CVD-safety/contrast checker: lightness band, chroma
 * floor, and CVD separation (adjacent ΔE 30.6, well clear of the >=12
 * target) all PASS at this exact ordering, and every hue clears 4.5:1
 * contrast against white (required for small label/helper text, not just
 * the large value — a full-fill card is a stricter bar than an icon badge).
 * Re-run `validate_palette.js` before reordering or swapping any hue.
 *
 * Do not reuse these for status/meaning (good/bad, error/success) — they're
 * identity accents only, not the app's status palette.
 */
export const DASHBOARD_PALETTE = {
  tealDark: "#15845d",
  orange: "#ce4914",
  blue: "#2874d0",
  red: "#df2f2d",
  magentaDark: "#cf386f",
  amberDark: "#9b6700",
  violet: "#4a3aa7",
  green: "#008300",
} as const;
