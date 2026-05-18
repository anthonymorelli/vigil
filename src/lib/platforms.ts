// src/lib/platforms.ts
import type { SlipPlatform } from "./slip-types";

export type PlatformId = "prizepicks" | "underdog" | "pick6" | "betr";

export type Platform = {
  id: PlatformId;
  label: string;
  books: string[];
  primaryBooks: string[];
  altBooks: string[];
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
    available: true,
  },
  {
    id: "pick6",
    label: "Pick6",
    books: ["Pick6"],
    primaryBooks: ["Pick6"],
    altBooks: ["Pick6"],  // all Pick6 lines are alt lines
    slipPlatform: "pick6",
    available: true,
  },
  {
    id: "betr",
    label: "Betr",
    books: ["Betr"],
    primaryBooks: ["Betr"],
    altBooks: [],
    slipPlatform: "betr",
    available: true,
  },
];

export const BOOK_WEIGHTS: Record<string, number> = {
  Novig: 3,
  ProphetX: 3,
  Polymarket: 1,
  Kalshi: 1,
};

export const REFERENCE_BOOK_LABELS = ["Novig", "ProphetX"] as const;

export function getPlatformById(id: string): Platform {
  return PLATFORMS.find((p) => p.id === id) ?? PLATFORMS[0];
}

export const DEFAULT_PLATFORM_ID: PlatformId = "prizepicks";