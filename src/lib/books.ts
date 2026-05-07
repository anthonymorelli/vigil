// src/lib/books.ts
// Single source of truth for sportsbook metadata.
// Pipeline emits raw canonical book IDs; everything else (display, devig,
// weighting) derives from this registry.

export type BookCategory = "sharp" | "exchange" | "retail" | "target";

export type BookMeta = {
  id: string;              // canonical id used in pipeline output and as key throughout app
  label: string;           // display name
  domain: string | null;   // for Brandfetch CDN; null = no logo available
  category: BookCategory;
};

// Category meaning:
//   sharp     — low-vig, slow-moving sportsbook (Pinnacle, Circa). Highest signal.
//   exchange  — peer-to-peer matching, no house vig (Novig, ProphetX, Polymarket, Kalshi).
//   retail    — public-facing US sportsbook (DK, FanDuel, MGM, etc.). Some signal, depends on book.
//   target    — pickem / DFS platforms we devig FOR. Never used as reference.
//
// "Reference" books = sharp + exchange + retail. Anything user can weight.

export const BOOKS: Record<string, BookMeta> = {
  // Sharp
  Pinnacle:   { id: "Pinnacle",   label: "Pinnacle",    domain: "pinnacle.com",        category: "sharp" },
  Circa:      { id: "Circa",      label: "Circa",       domain: "circasports.com",     category: "sharp" },

  // Exchange
  Novig:      { id: "Novig",      label: "Novig",       domain: "novig.us",            category: "exchange" },
  ProphetX:   { id: "ProphetX",   label: "ProphetX",    domain: "prophetx.co",         category: "exchange" },
  Polymarket: { id: "Polymarket", label: "Polymarket",  domain: "polymarket.com",      category: "exchange" },
  Kalshi:     { id: "Kalshi",     label: "Kalshi",      domain: "kalshi.com",          category: "exchange" },

  // Retail
  DraftKings: { id: "DraftKings", label: "DraftKings",  domain: "draftkings.com",      category: "retail" },
  FanDuel:    { id: "FanDuel",    label: "FanDuel",     domain: "fanduel.com",         category: "retail" },
  BetMGM:     { id: "BetMGM",     label: "BetMGM",      domain: "betmgm.com",          category: "retail" },
  Caesars:    { id: "Caesars",    label: "Caesars",     domain: "caesars.com",         category: "retail" },
  Fanatics:   { id: "Fanatics",   label: "Fanatics",    domain: "fanaticsbetting.com", category: "retail" },
  BetRivers:  { id: "BetRivers",  label: "BetRivers",   domain: "betrivers.com",       category: "retail" },
  HardRock:   { id: "HardRock",   label: "Hard Rock",   domain: "hardrock.bet",        category: "retail" },
  bet365:     { id: "bet365",     label: "bet365",      domain: "bet365.com",          category: "retail" },
  BetOnline:  { id: "BetOnline",  label: "BetOnline",   domain: "betonline.ag",        category: "retail" },
  Bovada:     { id: "Bovada",     label: "Bovada",      domain: "bovada.lv",           category: "retail" },
  Fliff:      { id: "Fliff",      label: "Fliff",       domain: "fliff.com",           category: "retail" },

  // Target — pickem / DFS platforms (never used as reference)
  PrizePicks: { id: "PrizePicks", label: "PrizePicks",  domain: "prizepicks.com",      category: "target" },
  PPDemons:   { id: "PPDemons",   label: "PP Boost",    domain: "prizepicks.com",      category: "target" },
  PPGoblins:  { id: "PPGoblins",  label: "PP Discount", domain: "prizepicks.com",      category: "target" },
  Underdog:   { id: "Underdog",   label: "Underdog",    domain: "underdogfantasy.com", category: "target" },
  Pick6:      { id: "Pick6",      label: "DK Pick6",    domain: "draftkings.com",      category: "target" },
  Betr:       { id: "Betr",       label: "Betr",        domain: "betr.app",            category: "target" },
};

// ============================================================================
// Helpers
// ============================================================================

export const BOOK_IDS = Object.keys(BOOKS);

export const SHARP_BOOK_IDS = BOOK_IDS.filter(
  (id) => BOOKS[id].category === "sharp" || BOOKS[id].category === "exchange",
);
export const RETAIL_BOOK_IDS = BOOK_IDS.filter((id) => BOOKS[id].category === "retail");
export const TARGET_BOOK_IDS = BOOK_IDS.filter((id) => BOOKS[id].category === "target");
export const REFERENCE_BOOK_IDS = BOOK_IDS.filter((id) => BOOKS[id].category !== "target");

export function getBook(id: string): BookMeta {
  return (
    BOOKS[id] ?? {
      id,
      label: id,
      domain: null,
      category: "retail",
    }
  );
}

export function isReferenceBook(id: string): boolean {
  const cat = BOOKS[id]?.category;
  return cat === "sharp" || cat === "exchange" || cat === "retail";
}

export function isTargetBook(id: string): boolean {
  return BOOKS[id]?.category === "target";
}