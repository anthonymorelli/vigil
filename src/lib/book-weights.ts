// src/lib/book-weights.ts
import { useState } from "react";
import { BOOKS, REFERENCE_BOOK_IDS } from "./books";
import type { WeightMap } from "./devig";

export function defaultWeights(): WeightMap {
  return exchangeOnlyWeights();
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
  { id: "all",      label: "All Equal",     factory: defaultWeights      },
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