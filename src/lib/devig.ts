// src/lib/devig.ts
// Client-side devigging math. Pure functions, no React, fully testable.
//
// Books arrive at weight 1 (unbiased). User-controlled weights modify
// each book's contribution to the fair-value consensus. All books default
// enabled — user explicitly disables to exclude.
//
// Devig method: per-book proportional. For each book with both Over and
// Under priced, strip the vig proportionally to recover the fair Over
// probability from that book. Then take a weighted average across all
// enabled reference books to get the consensus.

import { isReferenceBook } from "./books";

// ============================================================================
// Types
// ============================================================================

export type BookOffering = {
  over: number | null;   // American odds, null if no price
  under: number | null;
};

/** Map of book id -> offering. Comes from pipeline output. */
export type MarketOfferings = Record<string, BookOffering>;

export type BookWeight = {
  enabled: boolean;
  weight: number;
  locked?: boolean;       // locked weights survive preset switches
};

export type WeightMap = Record<string, BookWeight>;

// ============================================================================
// Odds conversions
// ============================================================================

export function americanToProb(odds: number): number {
  if (odds === 0) return 0.5;
  if (odds < 0) return -odds / (-odds + 100);
  return 100 / (odds + 100);
}

export function probToAmerican(p: number): number {
  if (p <= 0 || p >= 1) return 0;
  if (p >= 0.5) return -Math.round((p / (1 - p)) * 100);
  return Math.round(((1 - p) / p) * 100);
}

// ============================================================================
// Per-book devigging
// ============================================================================

/**
 * Strip vig proportionally from one book's two-way market.
 * Returns the fair Over probability per that book, or null if either
 * side is missing or implied probabilities are degenerate.
 */
export function devigBookOver(offering: BookOffering): number | null {
  if (offering.over == null || offering.under == null) return null;
  const pO = americanToProb(offering.over);
  const pU = americanToProb(offering.under);
  const total = pO + pU;
  if (total <= 0) return null;
  return pO / total;
}

// ============================================================================
// Weighted consensus across books
// ============================================================================

export type ConsensusResult = {
  fairOver: number | null;
  contributingBooks: string[];
  totalWeight: number;
};

/**
 * Weighted-average fair Over probability across all enabled reference
 * books that have both sides priced. Books missing a side are skipped.
 * Returns null fairOver if no eligible book contributed.
 */
export function consensusFairProb(
  offerings: MarketOfferings,
  weights: WeightMap,
): ConsensusResult {
  let weightedSum = 0;
  let totalWeight = 0;
  const contributing: string[] = [];

  for (const [bookId, offering] of Object.entries(offerings)) {
    if (!isReferenceBook(bookId)) continue;
    const w = weights[bookId];
    if (!w?.enabled || w.weight <= 0) continue;

    const fairO = devigBookOver(offering);
    if (fairO == null) continue;

    weightedSum += fairO * w.weight;
    totalWeight += w.weight;
    contributing.push(bookId);
  }

  if (totalWeight === 0) {
    return { fairOver: null, contributingBooks: [], totalWeight: 0 };
  }
  return {
    fairOver: weightedSum / totalWeight,
    contributingBooks: contributing,
    totalWeight,
  };
}

// ============================================================================
// EV / Kelly
// ============================================================================

/** EV percent on a $1 stake at the given odds vs the fair probability. */
export function evPct(fairProb: number, americanOdds: number): number {
  const o = americanOdds;
  const b = o > 0 ? o / 100 : 100 / -o;
  return (fairProb * b - (1 - fairProb)) * 100;
}

/** Quarter-Kelly is what most bettors actually deploy; this returns full Kelly %. */
export function kellyPct(fairProb: number, americanOdds: number): number {
  const o = americanOdds;
  const b = o > 0 ? o / 100 : 100 / -o;
  const k = (fairProb * b - (1 - fairProb)) / b;
  return Math.max(0, k * 100);
}