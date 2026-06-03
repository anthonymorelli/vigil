// src/lib/book-weights.ts
import { useState } from "react";
import { BOOKS, REFERENCE_BOOK_IDS } from "./books";
import type { WeightMap } from "./devig";

export function defaultWeights(): WeightMap {
  return propWeights();
}

// Default fair-value model. Mirrors the prop-weighting that exchange-heavy
// +EV tools converge on: exchanges dominant, FanDuel weighted highest among
// retail (line quality + volume), DraftKings second, sharp books and the
// rest of retail at 1. Prediction markets (Kalshi/Polymarket) enabled at 1
// when present. DFS/target books never contribute.
export function propWeights(): WeightMap {
  const WEIGHTS: Record<string, number> = {
    Novig: 3, ProphetX: 3,
    Pinnacle: 1, Circa: 1, Polymarket: 1, Kalshi: 1,
    FanDuel: 6, DraftKings: 2,
    BetMGM: 1, Caesars: 1, Fanatics: 1, BetRivers: 1,
    HardRock: 1, bet365: 1, BetOnline: 1, Bovada: 1, Fliff: 1,
  };
  const map: WeightMap = {};
  for (const id of REFERENCE_BOOK_IDS) {
    const w = WEIGHTS[id];
    map[id] = { enabled: w != null && w > 0, weight: w ?? 1 };
  }
  return map;
}

export function allEqualWeights(): WeightMap {
  const map: WeightMap = {};
  for (const id of REFERENCE_BOOK_IDS) {
    const cat = BOOKS[id]?.category ?? "retail";
    map[id] = { enabled: true, weight: 1 };
  }
  return map;
}

export function sharpOnlyWeights(): WeightMap {
  const map: WeightMap = {};
  for (const id of REFERENCE_BOOK_IDS) {
    const cat = BOOKS[id]?.category ?? "retail";
    map[id] = { enabled: cat === "sharp" || cat === "exchange", weight: 1 };
  }
  return map;
}

export function exchangeOnlyWeights(): WeightMap {
    const map: WeightMap = {};
    for (const id of REFERENCE_BOOK_IDS) {
      const cat = BOOKS[id]?.category ?? "retail";
      // Kalshi and Polymarket are prediction markets — exclude from default
      // They still show as reference columns but don't pollute fair value
      map[id] = { 
        enabled: cat === "exchange" && id !== "Kalshi" && id !== "Polymarket", 
        weight: 1 
      };
    }
    return map;
  }

export const WEIGHT_PRESETS = [
  { id: "prop",     label: "Prop Weights",  factory: propWeights         },
  { id: "all",      label: "All Equal",     factory: allEqualWeights     },
  { id: "sharp",    label: "Sharp Only",    factory: sharpOnlyWeights    },
  { id: "exchange", label: "Exchanges Only",factory: exchangeOnlyWeights },
] as const;

const STORAGE_KEY = "bookWeights";

export function useBookWeights() {
  const [weights, setWeightsState] = useState<WeightMap>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored) as WeightMap;
    } catch {}
    return defaultWeights();
  });

  const setWeights = (next: WeightMap) => {
    setWeightsState(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  };

  return { weights, setWeights };
}