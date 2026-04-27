// src/lib/slip-types.ts
// Configuration for every DFS slip type Anthony plays
// Math: per-leg break-even probability solved numerically against the
// platform's actual payout grid (insurance/partial payouts included)

export type SlipPlatform = "prizepicks" | "underdog" | "betr" | "sleeper" | "pick6" | "parlayplay";

/**
 * payoutGrid[k] = multiplier paid when k of N legs hit
 * Index 0 means "0 legs hit", index N means "all legs hit"
 * Anything that doesn't pay should be 0 (e.g. PP Power on any miss)
 */
export type SlipType = {
  id: string;
  platform: SlipPlatform;
  platformLabel: string;
  variant: string;          // "Power", "Flex"
  picks: number;            // N — total legs in the slip
  payoutGrid: number[];     // length N+1, multipliers indexed by hits
  available: boolean;       // do we have data for this platform's book?
  recommended?: boolean;
  notes?: string;
};

// ============================================================================
// PrizePicks payout grids (Anthony's confirmed data, April 2026)
// ============================================================================

const PP_POWER = (picks: number, allHitMult: number): number[] => {
  const grid = new Array(picks + 1).fill(0);
  grid[picks] = allHitMult;
  return grid;
};

// Flex grids — index = hits, value = multiplier
const PP_FLEX_3: number[] = [0, 0, 1, 3];
const PP_FLEX_4: number[] = [0, 0, 0, 1.5, 6];
const PP_FLEX_5: number[] = [0, 0, 0, 0.4, 2, 10];
const PP_FLEX_6: number[] = [0, 0, 0, 0, 0.4, 2, 12.5];

export const SLIP_TYPES: SlipType[] = [
  // PrizePicks Power
  { id: "pp_power_2", platform: "prizepicks", platformLabel: "PrizePicks", variant: "Power", picks: 2, payoutGrid: PP_POWER(2, 3),  available: true },
  { id: "pp_power_3", platform: "prizepicks", platformLabel: "PrizePicks", variant: "Power", picks: 3, payoutGrid: PP_POWER(3, 6),  available: true },
  { id: "pp_power_4", platform: "prizepicks", platformLabel: "PrizePicks", variant: "Power", picks: 4, payoutGrid: PP_POWER(4, 10), available: true },
  { id: "pp_power_5", platform: "prizepicks", platformLabel: "PrizePicks", variant: "Power", picks: 5, payoutGrid: PP_POWER(5, 20), available: true },
  { id: "pp_power_6", platform: "prizepicks", platformLabel: "PrizePicks", variant: "Power", picks: 6, payoutGrid: PP_POWER(6, 25), available: true },

  // PrizePicks Flex
  { id: "pp_flex_3", platform: "prizepicks", platformLabel: "PrizePicks", variant: "Flex", picks: 3, payoutGrid: PP_FLEX_3, available: true },
  { id: "pp_flex_4", platform: "prizepicks", platformLabel: "PrizePicks", variant: "Flex", picks: 4, payoutGrid: PP_FLEX_4, available: true },
  { id: "pp_flex_5", platform: "prizepicks", platformLabel: "PrizePicks", variant: "Flex", picks: 5, payoutGrid: PP_FLEX_5, available: true, recommended: true, notes: "Best PP slip — insurance softens per-leg target" },
  { id: "pp_flex_6", platform: "prizepicks", platformLabel: "PrizePicks", variant: "Flex", picks: 6, payoutGrid: PP_FLEX_6, available: true },
];

// ============================================================================
// Math: solve per-leg break-even probability against a payout grid
// ============================================================================

function binomialCoeff(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  k = Math.min(k, n - k);
  let c = 1;
  for (let i = 0; i < k; i++) {
    c = (c * (n - i)) / (i + 1);
  }
  return c;
}

function slipEV(p: number, payoutGrid: number[]): number {
  const n = payoutGrid.length - 1;
  let ev = 0;
  for (let k = 0; k <= n; k++) {
    const probK = binomialCoeff(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k);
    ev += probK * payoutGrid[k];
  }
  return ev;
}

export function legBreakEvenProbability(slip: SlipType): number {
  let lo = 0.0001;
  let hi = 0.9999;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const ev = slipEV(mid, slip.payoutGrid);
    if (ev < 1) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function probToAmerican(p: number): number {
  if (p <= 0 || p >= 1) return 0;
  if (p >= 0.5) return -Math.round((p / (1 - p)) * 100);
  return Math.round(((1 - p) / p) * 100);
}

export function americanToProb(odds: number): number {
  if (odds === 0) return 0.5;
  if (odds < 0) return -odds / (-odds + 100);
  return 100 / (odds + 100);
}

export function legTargetAmerican(slip: SlipType): number {
  return probToAmerican(legBreakEvenProbability(slip));
}

export function legEvPctVsSlip(slip: SlipType, fairProb: number): number {
  const target = legBreakEvenProbability(slip);
  return (fairProb - target) * 100;
}

// ============================================================================
// Defaults & helpers
// ============================================================================

export const DEFAULT_SLIP_TYPE = SLIP_TYPES.find(s => s.id === "pp_flex_5")!;

export function getSlipById(id: string): SlipType {
  return SLIP_TYPES.find(s => s.id === id) ?? DEFAULT_SLIP_TYPE;
}

export function groupedSlipTypes() {
  const groups = new Map<string, Map<string, SlipType[]>>();
  for (const slip of SLIP_TYPES) {
    if (!groups.has(slip.platformLabel)) {
      groups.set(slip.platformLabel, new Map());
    }
    const variants = groups.get(slip.platformLabel)!;
    if (!variants.has(slip.variant)) {
      variants.set(slip.variant, []);
    }
    variants.get(slip.variant)!.push(slip);
  }
  return Array.from(groups.entries()).map(([platform, variants]) => ({
    platform,
    variants: Array.from(variants.entries()).map(([variant, slips]) => ({
      variant,
      slips,
    })),
  }));
}