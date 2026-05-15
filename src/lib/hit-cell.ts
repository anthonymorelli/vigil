// src/lib/hit-cell.ts
// Pill style for the % Hit cell.
//
// Three distinct tiers instead of continuous alpha — adjacent rows should
// look visually different, not just fractionally brighter. Each tier has
// its own fill, border, and glow so the jump is obvious.
//
// Blue = Vancouver signal blue (#2A5D9C) extracted from the bridge photo.
// Border = Vancouver sky blue (#39639D) — slightly lighter.
// Red tiers unchanged.

import type { CSSProperties } from "react";

export type HitCellStyle = {
  pillStyle: CSSProperties;
  textClass: string;
};

// ── Above target — Vancouver blues ───────────────────────────────────────
//  #2A5D9C → rgb(42, 93, 156)   fill
//  #39639D → rgb(57, 99, 157)   border
//
// ── Below target — red (unchanged) ──────────────────────────────────────

const BLUE        = "58, 120, 200";  // boosted — perceivable blue on dark bg
const BLUE_BORDER = "90, 154, 224";  // lighter rim to match
const RED         = "239, 68, 68";
const RED_BORDER  = "252, 165, 165";

function pill(
  rgb: string,
  borderRgb: string,
  fill: number,
  border: number,
  glow?: number,
): CSSProperties {
  return {
    backgroundColor: `rgba(${rgb}, ${fill})`,
    border: `1px solid rgba(${borderRgb}, ${border})`,
    boxShadow: glow ? `0 0 12px rgba(${rgb}, ${glow})` : undefined,
  };
}

export function hitCellStyle(fairPct: number, targetPct: number): HitCellStyle {
  const delta = fairPct - targetPct;

  if (delta >= 0) {
    // Tier 3 — strong edge (≥4pp)
    if (delta >= 4) return {
      pillStyle: pill(BLUE, BLUE_BORDER, 0.70, 0.90, 0.35),
      textClass: "text-white font-bold",
    };
    // Tier 2 — solid edge (2–4pp)
    if (delta >= 2) return {
      pillStyle: pill(BLUE, BLUE_BORDER, 0.50, 0.70),
      textClass: "text-blue-100 font-semibold",
    };
    // Tier 1 — marginal (0–2pp): ghost pill
    return {
      pillStyle: pill(BLUE, BLUE_BORDER, 0.22, 0.40),
      textClass: "text-blue-200 font-medium",
    };
  }

  // Tier 2 — clearly below (-2pp or worse)
  if (delta <= -2) return {
    pillStyle: pill(RED, RED_BORDER, 0.32, 0.50),
    textClass: "text-red-200 font-semibold",
  };
  // Tier 1 — borderline (0 to -2pp)
  return {
    pillStyle: pill(RED, RED_BORDER, 0.14, 0.25),
    textClass: "text-red-300 font-medium",
  };
}

/**
 * Expanded row tint — mirrors pill tier.
 */
export function expandedRowStyle(fairPct: number, targetPct: number): CSSProperties {
  const delta = fairPct - targetPct;
  if (delta >= 4)  return { backgroundColor: "rgba(42, 93, 156, 0.12)" };
  if (delta >= 0)  return { backgroundColor: "rgba(42, 93, 156, 0.07)" };
  if (delta <= -2) return { backgroundColor: "rgba(239, 68, 68, 0.09)" };
  return           { backgroundColor: "rgba(239, 68, 68, 0.05)" };
}