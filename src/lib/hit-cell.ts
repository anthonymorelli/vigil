// src/lib/hit-cell.ts
// Pill style for the % Hit cell.
//
// Three distinct tiers instead of continuous alpha — adjacent rows should
// look visually different, not just fractionally brighter. Each tier has
// its own fill, border, and glow so the jump is obvious.

import type { CSSProperties } from "react";

export type HitCellStyle = {
  pillStyle: CSSProperties;
  textClass: string;
};

// ── Blue tiers (above target) ─────────────────────────────────────────────
//
//  Tier 3 (+4pp or more)  — bright, glowing — great leg
//  Tier 2 (+2–4pp)        — solid blue — good leg
//  Tier 1 (0–2pp)         — dim blue — marginal edge
//
// ── Red tiers (below target) ─────────────────────────────────────────────
//
//  Tier 2 (-2pp or worse) — clearly red — avoid
//  Tier 1 (0 to -2pp)     — barely red — borderline

const BLUE = "59, 130, 246";
const BLUE_BORDER = "147, 197, 253";
const RED = "239, 68, 68";
const RED_BORDER = "252, 165, 165";

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
      pillStyle: pill(BLUE, BLUE_BORDER, 0.55, 0.75, 0.30),
      textClass: "text-white font-bold",
    };
    // Tier 2 — solid edge (2–4pp)
    if (delta >= 2) return {
      pillStyle: pill(BLUE, BLUE_BORDER, 0.32, 0.55),
      textClass: "text-blue-100 font-semibold",
    };
    // Tier 1 — marginal (0–2pp)
    return {
      pillStyle: pill(BLUE, BLUE_BORDER, 0.16, 0.30),
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
 * Expanded row tint — mirrors pill tier so the open row still reads as
 * part of the same play rather than a generic gray block.
 */
export function expandedRowStyle(fairPct: number, targetPct: number): CSSProperties {
  const delta = fairPct - targetPct;
  if (delta >= 4)  return { backgroundColor: "rgba(59, 130, 246, 0.10)" };
  if (delta >= 0)  return { backgroundColor: "rgba(59, 130, 246, 0.06)" };
  if (delta <= -2) return { backgroundColor: "rgba(239, 68, 68, 0.09)" };
  return           { backgroundColor: "rgba(239, 68, 68, 0.05)" };
}