// src/lib/platforms.ts
// Platform config: which books belong to each DFS platform, which slips are
// available, and which books form the devig reference (always-visible columns).

import type { SlipPlatform } from "./slip-types";

export type PlatformId = "prizepicks" | "underdog" | "pick6" | "betr";

export type Platform = {
  id: PlatformId;
  label: string;
  /** All book names this platform appears as in opportunities.json */
  books: string[];
  /** Primary book(s) — shown by default, no alt-line vig */
  primaryBooks: string[];
  /** Alt-line books (PP Boost / Discount). Hidden by default. */
  altBooks: string[];
  /** Matches SlipType.platform for slip filtering */
  slipPlatform: SlipPlatform;
  available: boolean;
};

export const PLATFORMS: Platform[] = [
  {
    id: "prizepicks",
    label: "PrizePicks",
    books: ["PrizePicks", "PP Demons", "PP Goblins"],
    primaryBooks: ["PrizePicks"],
    altBooks: ["PP Demons", "PP Goblins"],
    slipPlatform: "prizepicks",
    available: true,
  },
  {
    id: "underdog",
    label: "Underdog",
    books: ["Underdog"],
    primaryBooks: ["Underdog"],
    altBooks: [],
    slipPlatform: "underdog",
    available: false,
  },
  {
    id: "pick6",
    label: "Pick6",
    books: ["DK Pick6"],
    primaryBooks: ["DK Pick6"],
    altBooks: [],
    slipPlatform: "pick6",
    available: false,
  },
  {
    id: "betr",
    label: "Betr",
    books: ["Betr"],
    primaryBooks: ["Betr"],
    altBooks: [],
    slipPlatform: "betr",
    available: false,
  },
];

// ============================================================================
// Devig source weights — stub. UI to configure this comes later.
// Higher weight = more influence on fair probability computation.
// Pipeline currently averages Novig + ProphetX equally (weight 1 each).
// Update pipeline.py's BOOK_WEIGHTS constant in lockstep with this.
// ============================================================================
export const BOOK_WEIGHTS: Record<string, number> = {
  Novig: 3,
  ProphetX: 3,
  Polymarket: 1,
  Kalshi: 1,
  // FanDuel: 6,  // TODO: add when we have prop data from FD
};

// Reference books shown as inline columns in the table (devig sources)
// These must exist in opportunities.json for the column to show odds.
// For now they won't — the fair price IS the consensus of these books,
// so we display fair odds under their combined label.
export const REFERENCE_BOOK_LABELS = ["Novig", "ProphetX"] as const;

export function getPlatformById(id: string): Platform {
  return PLATFORMS.find((p) => p.id === id) ?? PLATFORMS[0];
}

export const DEFAULT_PLATFORM_ID: PlatformId = "prizepicks";