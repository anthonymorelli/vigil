// src/lib/hit-cell.ts
// % Hit cell — tiered blue system.
//
// PLAY   (fairPct >= targetPct) — filled blue pill, tiered by edge, with glow.
//                                  Glow = the exclusive signal for clearing your slip.
// BELOW  (fairPct <  targetPct) — dim blue, same family, no glow. Continuous ramp:
//                                  brighter just below BE, fades toward 50%.
//                                  "In the data, lower probability — still blue."
//
// One palette, top to bottom. Glow = play signal. Dimness = probability rank.

import type { CSSProperties } from "react"

export type HitCellStyle = {
  pillStyle: CSSProperties
  textClass: string
}

// Original blue — intentionally brighter than #2A5D9C, this is what glows right
const BLUE        = "58, 120, 200"
const BLUE_BORDER = "90, 154, 224"

export const UNIVERSAL_FLOOR = 53.45 // semantic threshold — no slip viable below here

const GLOW_GATE = 1.5  // pp above BE → Tier 3 (bright glow). ~55.75%+ on Flex 5.
const T2_GATE   = 0.5  // pp above BE → Tier 2 (medium glow). ~54.75%+.

export function hitZone(
  fairPct: number,
  targetPct: number,
): "play" | "maybe" | "skip" {
  if (fairPct >= targetPct)       return "play"
  if (fairPct >= UNIVERSAL_FLOOR) return "maybe"
  return "skip"
}

export function hitCellStyle(fairPct: number, targetPct: number): HitCellStyle {
  const delta = fairPct - targetPct

  // ── PLAY ──────────────────────────────────────────────────────────────────
  // Tiered by edge above BE. Glow is the exclusive "clears your slip" signal.
  if (delta >= 0) {
    let bgA: number, bdA: number, glowA: number, w: string

    if (delta >= GLOW_GATE) {
      bgA = 0.70; bdA = 0.90; glowA = 0.45; w = "font-bold"
    } else if (delta >= T2_GATE) {
      bgA = 0.50; bdA = 0.70; glowA = 0.25; w = "font-semibold"
    } else {
      bgA = 0.28; bdA = 0.45; glowA = 0.12; w = "font-medium"
    }

    return {
      pillStyle: {
        backgroundColor: `rgba(${BLUE}, ${bgA})`,
        border:           `1px solid rgba(${BLUE_BORDER}, ${bdA})`,
        color:            "rgb(210, 228, 248)",
        boxShadow: `0 0 14px rgba(${BLUE}, ${glowA}), 0 0 4px rgba(${BLUE}, ${glowA * 0.5})`,
      },
      textClass: `${w} tabular-nums`,
    }
  }

  // ── MAYBE (floor → BE) ────────────────────────────────────────────────────
  // Dim blue, no glow. Same family as plays — "lower value, still playable."
  // Ramp: brighter near BE, dimmer near the floor.
  if (fairPct >= UNIVERSAL_FLOOR) {
    const band  = Math.max(0.01, targetPct - UNIVERSAL_FLOOR)
    const normT = Math.max(0, Math.min(1, (fairPct - UNIVERSAL_FLOOR) / band))
    const bgA   = 0.12 + 0.10 * normT   // 0.12 → 0.22
    const bdA   = 0.25 + 0.18 * normT   // 0.25 → 0.43
    const txtL  = Math.round(48 + 12 * normT)
    return {
      pillStyle: {
        backgroundColor: `rgba(${BLUE}, ${bgA.toFixed(2)})`,
        border:           `1px solid rgba(${BLUE_BORDER}, ${bdA.toFixed(2)})`,
        color:            `hsl(210, 60%, ${txtL}%)`,
      },
      textClass: "tabular-nums",
    }
  }

  // ── SKIP (< floor) ─────────────────────────────────────────────────────────
  // Slate grey — clear "don't play this" without alarm red.
  // No slip type is viable below the floor. Grey = off the table.
  const st    = Math.max(0, Math.min(1, (fairPct - 50.0) / (UNIVERSAL_FLOOR - 50.0)))
  const bgA   = 0.12 + 0.06 * st
  const bdA   = 0.28 + 0.10 * st
  const txtL  = Math.round(48 + 8 * st)
  return {
    pillStyle: {
      backgroundColor: `rgba(100,115,135,${bgA.toFixed(2)})`,
      border:           `1px solid rgba(110,125,148,${bdA.toFixed(2)})`,
      color:            `hsl(215,14%,${txtL}%)`,
    },
    textClass: "tabular-nums",
  }
}

/** Expanded row tint — mirrors pill zone, far fainter */
export const expandedRowStyle: HitCellStyle = {
  pillStyle: {
    backgroundColor: `rgba(${BLUE}, 0.08)`,
    border:           "1px solid transparent",
    color:            "var(--muted-foreground)",
  },
  textClass: "tabular-nums",
}
