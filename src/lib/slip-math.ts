// src/lib/slip-math.ts
// Full 2^N enumeration of slip outcomes for heterogeneous leg fair probs.
// Each leg can have a different probability — no binomial shortcut.
// Max N=6 → 64 iterations, trivially fast.

import type { SlipType } from "./slip-types";

export type SlipScenario = {
  hits: number;
  prob: number;  // probability of exactly this many legs hitting
  mult: number;  // payout multiplier for this hit count
};

export type SlipResult = {
  ev: number;              // EV% above stake (e.g. +5.24 means +5.24%)
  scenarios: SlipScenario[];
};

export function computeHeterogeneousSlipEV(
  fairProbs: number[],
  slip: SlipType
): SlipResult {
  const n = fairProbs.length;

  // Accumulate probability mass per hit count across all 2^N outcomes
  const hitProbs = new Array(n + 1).fill(0) as number[];

  for (let mask = 0; mask < (1 << n); mask++) {
    let hits = 0;
    let prob = 1;
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        hits++;
        prob *= fairProbs[i];
      } else {
        prob *= 1 - fairProbs[i];
      }
    }
    hitProbs[hits] += prob;
  }

  let expectedReturn = 0;
  const scenarios: SlipScenario[] = hitProbs.map((prob, hits) => {
    const mult = slip.payoutGrid[hits] ?? 0;
    expectedReturn += prob * mult;
    return { hits, prob, mult };
  });

  return {
    ev: (expectedReturn - 1) * 100,
    scenarios,
  };
}