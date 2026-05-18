// src/lib/slip-types.ts
// Configuration for every DFS slip type across all platforms.
// Math: per-leg break-even probability solved numerically against the
// platform's actual payout grid (insurance/partial payouts included).
//
// PRIZEPICKS NOTE: Ties and DNPs revert the lineup down one level (e.g.
// 5-pick Flex → 4-pick Flex). Not modelable per-leg — treat as downside risk.
// Demon/Goblin lines carry altered payout rates; hidden by default in UI.
//
// UNDERDOG NOTE: Per-pick difficulty multipliers (0.7x anchor, 1.5x boost)
// scale the payout up or down from the base grid. Break-even math here
// assumes all standard 1.0x picks — the most common case.
//
// DK PICK6 NOTE: Pool-based contest payouts — not fixed multipliers.
// Payouts vary by sport, date, and field size. Not modelable with a fixed
// grid. All Pick6 entries marked unavailable; hidden from UI.

export type SlipPlatform = "prizepicks" | "underdog" | "betr" | "sleeper" | "pick6" | "parlayplay";

export type SlipType = {
  id: string;
  platform: SlipPlatform;
  platformLabel: string;
  variant: string;
  picks: number;
  payoutGrid: number[];     // length N+1, multipliers indexed by hits
  available: boolean;       // false = stub or pool-based, hidden from UI
  recommended?: boolean;
  notes?: string;
};

// ============================================================================
// PrizePicks — verified May 2026
// Power Play: all picks must be correct to win
// Flex Play: lineups can still win with 1–2 incorrect picks
// ============================================================================

const PP_POWER = (picks: number, allHitMult: number): number[] => {
  const grid = new Array(picks + 1).fill(0);
  grid[picks] = allHitMult;
  return grid;
};

// Flex grids — index = hits, value = multiplier
const PP_FLEX_3: number[] = [0, 0, 1, 3];           // 2/3→1x, 3/3→3x
const PP_FLEX_4: number[] = [0, 0, 0, 1.5, 6];      // 3/4→1.5x, 4/4→6x
const PP_FLEX_5: number[] = [0, 0, 0, 0.4, 2, 10];  // 3/5→0.4x, 4/5→2x, 5/5→10x — break-even ~54.3%
const PP_FLEX_6: number[] = [0, 0, 0, 0, 0.4, 2, 25]; // 4/6→0.4x, 5/6→2x, 6/6→25x — break-even ~54.3%

// ============================================================================
// Underdog Fantasy — verified May 2026
// Standard = all-or-nothing. Flex = partial payouts on 1–2 losses.
// Base multipliers assume 1.0x difficulty per pick.
// Picks with difficulty ≠ 1.0x (e.g. 0.7x anchor, 1.5x boost) scale payouts.
// ============================================================================

// Standard grids (all-or-nothing)
// 2: 3.5x | 3: 6.5x | 4: 10x | 5: 20x | 6: 35x | 7: 65x | 8: 120x

// Flex grids — index = hits
const UD_FLEX_3: number[] = [0, 0, 1.09, 3.25];                  // 2/3→1.09x, 3/3→3.25x
const UD_FLEX_4: number[] = [0, 0, 0, 1.5, 6];                   // 3/4→1.5x, 4/4→6x
const UD_FLEX_5: number[] = [0, 0, 0, 0, 2.5, 10];               // 4/5→2.5x, 5/5→10x — break-even ~54.7%
const UD_FLEX_6: number[] = [0, 0, 0, 0, 0.25, 2.6, 25];         // 4/6→0.25x, 5/6→2.6x, 6/6→25x — break-even ~53.9% ← best
const UD_FLEX_7: number[] = [0, 0, 0, 0, 0, 0.5, 2.75, 40];      // 5/7→0.5x, 6/7→2.75x, 7/7→40x
const UD_FLEX_8: number[] = [0, 0, 0, 0, 0, 0, 1, 3, 80];        // 6/8→1x, 7/8→3x, 8/8→80x

// ============================================================================
// Betr Flex Play — verified February 2026
// Perfect Play = all-or-nothing, grid pending confirmation.
// Special picks (Edge Picks, Boosts, Anchors, Edge Combos) alter multipliers.
// ============================================================================

const BETR_FLEX_3:  number[] = [0, 0, 1, 3];                          // 2/3→1x, 3/3→3x
const BETR_FLEX_4:  number[] = [0, 0, 0, 1.5, 6];                     // 3/4→1.5x, 4/4→6x
const BETR_FLEX_5:  number[] = [0, 0, 0, 0.4, 2, 10];                 // 3/5→0.4x, 4/5→2x, 5/5→10x — break-even ~54.3%
const BETR_FLEX_6:  number[] = [0, 0, 0, 0, 1, 1.5, 20];              // 4/6→1x, 5/6→1.5x, 6/6→20x
const BETR_FLEX_7:  number[] = [0, 0, 0, 0, 0, 1.25, 2, 35];          // 5/7→1.25x, 6/7→2x, 7/7→35x
const BETR_FLEX_8:  number[] = [0, 0, 0, 0, 0, 1.25, 1.5, 2, 50];    // 5/8→1.25x, 6/8→1.5x, 7/8→2x, 8/8→50x
const BETR_FLEX_9:  number[] = [0, 0, 0, 0, 0, 0, 1.25, 1.5, 2, 100]; // 6/9→1.25x, 7/9→1.5x, 8/9→2x, 9/9→100x
const BETR_FLEX_10: number[] = [0, 0, 0, 0, 0, 0, 1, 1.25, 1.5, 2, 200]; // 6/10→1x ... 10/10→200x

// ============================================================================
// SLIP_TYPES registry
// ============================================================================

export const SLIP_TYPES: SlipType[] = [

  // ── PrizePicks Power ────────────────────────────────────────────────────
  { id: "pp_power_2", platform: "prizepicks", platformLabel: "PrizePicks", variant: "Power", picks: 2, payoutGrid: PP_POWER(2, 3),    available: true },
  { id: "pp_power_3", platform: "prizepicks", platformLabel: "PrizePicks", variant: "Power", picks: 3, payoutGrid: PP_POWER(3, 6),    available: true },
  { id: "pp_power_4", platform: "prizepicks", platformLabel: "PrizePicks", variant: "Power", picks: 4, payoutGrid: PP_POWER(4, 10),   available: true },
  { id: "pp_power_5", platform: "prizepicks", platformLabel: "PrizePicks", variant: "Power", picks: 5, payoutGrid: PP_POWER(5, 20),   available: true },
  { id: "pp_power_6", platform: "prizepicks", platformLabel: "PrizePicks", variant: "Power", picks: 6, payoutGrid: PP_POWER(6, 37.5), available: true }, // verified May 2026

  // ── PrizePicks Flex ─────────────────────────────────────────────────────
  { id: "pp_flex_3", platform: "prizepicks", platformLabel: "PrizePicks", variant: "Flex", picks: 3, payoutGrid: PP_FLEX_3, available: true },
  { id: "pp_flex_4", platform: "prizepicks", platformLabel: "PrizePicks", variant: "Flex", picks: 4, payoutGrid: PP_FLEX_4, available: true },
  {
    id: "pp_flex_5",
    platform: "prizepicks",
    platformLabel: "PrizePicks",
    variant: "Flex",
    picks: 5,
    payoutGrid: PP_FLEX_5,
    available: true,
    recommended: true,
    notes: "Best PP slip — insurance softens per-leg target. Break-even ~54.3%. Verified May 2026",
  },
  {
    id: "pp_flex_6",
    platform: "prizepicks",
    platformLabel: "PrizePicks",
    variant: "Flex",
    picks: 6,
    payoutGrid: PP_FLEX_6,
    available: true,
    notes: "6/6→25x, 5/6→2x, 4/6→0.4x. Break-even ~54.3%. Verified May 2026",
  },

  // ── Underdog Standard (all-or-nothing) ──────────────────────────────────
  { id: "ud_std_2", platform: "underdog", platformLabel: "Underdog", variant: "Standard", picks: 2, payoutGrid: [0, 0, 3.5],                  available: true },
  { id: "ud_std_3", platform: "underdog", platformLabel: "Underdog", variant: "Standard", picks: 3, payoutGrid: [0, 0, 0, 6.5],                available: true },
  { id: "ud_std_4", platform: "underdog", platformLabel: "Underdog", variant: "Standard", picks: 4, payoutGrid: [0, 0, 0, 0, 10],              available: true },
  { id: "ud_std_5", platform: "underdog", platformLabel: "Underdog", variant: "Standard", picks: 5, payoutGrid: [0, 0, 0, 0, 0, 20],           available: true },
  { id: "ud_std_6", platform: "underdog", platformLabel: "Underdog", variant: "Standard", picks: 6, payoutGrid: [0, 0, 0, 0, 0, 0, 35],        available: true },
  { id: "ud_std_7", platform: "underdog", platformLabel: "Underdog", variant: "Standard", picks: 7, payoutGrid: [0, 0, 0, 0, 0, 0, 0, 65],     available: true },
  { id: "ud_std_8", platform: "underdog", platformLabel: "Underdog", variant: "Standard", picks: 8, payoutGrid: [0, 0, 0, 0, 0, 0, 0, 0, 120], available: true },

  // ── Underdog Flex ───────────────────────────────────────────────────────
  { id: "ud_flex_3", platform: "underdog", platformLabel: "Underdog", variant: "Flex", picks: 3, payoutGrid: UD_FLEX_3, available: true },
  { id: "ud_flex_4", platform: "underdog", platformLabel: "Underdog", variant: "Flex", picks: 4, payoutGrid: UD_FLEX_4, available: true },
  { id: "ud_flex_5", platform: "underdog", platformLabel: "Underdog", variant: "Flex", picks: 5, payoutGrid: UD_FLEX_5, available: true },
  {
    id: "ud_flex_6",
    platform: "underdog",
    platformLabel: "Underdog",
    variant: "Flex",
    picks: 6,
    payoutGrid: UD_FLEX_6,
    available: true,
    recommended: true,
    notes: "Best UD slip — break-even ~53.9% (~-116 effective), better than PP Flex 5. Verified May 2026",
  },
  { id: "ud_flex_7", platform: "underdog", platformLabel: "Underdog", variant: "Flex", picks: 7, payoutGrid: UD_FLEX_7, available: true },
  { id: "ud_flex_8", platform: "underdog", platformLabel: "Underdog", variant: "Flex", picks: 8, payoutGrid: UD_FLEX_8, available: true },

  // ── Betr Flex Play ──────────────────────────────────────────────────────
  { id: "betr_flex_3",  platform: "betr", platformLabel: "Betr", variant: "Flex", picks: 3,  payoutGrid: BETR_FLEX_3,  available: true },
  { id: "betr_flex_4",  platform: "betr", platformLabel: "Betr", variant: "Flex", picks: 4,  payoutGrid: BETR_FLEX_4,  available: true },
  {
    id: "betr_flex_5",
    platform: "betr",
    platformLabel: "Betr",
    variant: "Flex",
    picks: 5,
    payoutGrid: BETR_FLEX_5,
    available: true,
    recommended: true,
    notes: "Best Betr slip — identical grid to PP Flex 5. Break-even ~54.3%. Verified February 2026",
  },
  { id: "betr_flex_6",  platform: "betr", platformLabel: "Betr", variant: "Flex", picks: 6,  payoutGrid: BETR_FLEX_6,  available: true },
  { id: "betr_flex_7",  platform: "betr", platformLabel: "Betr", variant: "Flex", picks: 7,  payoutGrid: BETR_FLEX_7,  available: true },
  { id: "betr_flex_8",  platform: "betr", platformLabel: "Betr", variant: "Flex", picks: 8,  payoutGrid: BETR_FLEX_8,  available: true },
  { id: "betr_flex_9",  platform: "betr", platformLabel: "Betr", variant: "Flex", picks: 9,  payoutGrid: BETR_FLEX_9,  available: true },
  { id: "betr_flex_10", platform: "betr", platformLabel: "Betr", variant: "Flex", picks: 10, payoutGrid: BETR_FLEX_10, available: true },

  // ── Betr Perfect Play ───────────────────────────────────────────────────
  { id: "betr_perfect_5", platform: "betr", platformLabel: "Betr", variant: "Perfect Play", picks: 5, payoutGrid: [], available: false, notes: "Payout grid pending confirmation" },

  // ── DK Pick6 ────────────────────────────────────────────────────────────
  // Pool-based contest — payouts vary by sport/date/field size.
  // No fixed multiplier grid. All entries unavailable; not shown in UI.
  { id: "pick6_2", platform: "pick6", platformLabel: "DK Pick6", variant: "Pick6", picks: 2, payoutGrid: [], available: false, notes: "Pool-based — no fixed multiplier" },
  { id: "pick6_3", platform: "pick6", platformLabel: "DK Pick6", variant: "Pick6", picks: 3, payoutGrid: [], available: false, notes: "Pool-based — no fixed multiplier" },
  { id: "pick6_4", platform: "pick6", platformLabel: "DK Pick6", variant: "Pick6", picks: 4, payoutGrid: [], available: false, notes: "Pool-based — no fixed multiplier" },
  { id: "pick6_5", platform: "pick6", platformLabel: "DK Pick6", variant: "Pick6", picks: 5, payoutGrid: [], available: false, notes: "Pool-based — no fixed multiplier" },
  { id: "pick6_6", platform: "pick6", platformLabel: "DK Pick6", variant: "Pick6", picks: 6, payoutGrid: [], available: false, notes: "Pool-based — no fixed multiplier" },
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
  if (!slip.available || slip.payoutGrid.length === 0) return 1;
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

export const DEFAULT_SLIP_TYPE = SLIP_TYPES.find((s) => s.id === "pp_flex_5")!;

export function getSlipById(id: string): SlipType {
  return SLIP_TYPES.find((s) => s.id === id) ?? DEFAULT_SLIP_TYPE;
}

export function getDefaultSlipForPlatform(platform: SlipPlatform): SlipType {
  return (
    SLIP_TYPES.find((s) => s.platform === platform && s.recommended && s.available) ??
    SLIP_TYPES.find((s) => s.platform === platform && s.available) ??
    DEFAULT_SLIP_TYPE
  );
}

export function groupedSlipTypes(platformFilter?: SlipPlatform) {
  const slips = platformFilter
    ? SLIP_TYPES.filter((s) => s.platform === platformFilter)
    : SLIP_TYPES;

  const groups = new Map<string, Map<string, SlipType[]>>();
  for (const slip of slips) {
    if (!groups.has(slip.platformLabel)) groups.set(slip.platformLabel, new Map());
    const variants = groups.get(slip.platformLabel)!;
    if (!variants.has(slip.variant)) variants.set(slip.variant, []);
    variants.get(slip.variant)!.push(slip);
  }
  return Array.from(groups.entries()).map(([platform, variants]) => ({
    platform,
    variants: Array.from(variants.entries()).map(([variant, slips]) => ({ variant, slips })),
  }));
}