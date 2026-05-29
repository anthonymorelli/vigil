"use client";

import React, { useState, useMemo, useEffect, Suspense } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQueryState, parseAsStringLiteral } from "nuqs";
import { usePathname } from "next/navigation";
import { Check, Plus, ListPlus, Search, X, Command as CommandIcon, ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import { BookLogo } from "@/components/book-logo";
import { SlipBuilder, type SlipLeg } from "@/components/slip-builder";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { hitCellStyle } from "@/lib/hit-cell";
import { consensusFairProb, probToAmerican, evPct, type WeightMap } from "@/lib/devig";
import { isReferenceBook, getBook } from "@/lib/books";
import { useBookWeights } from "@/lib/book-weights";
import { PLATFORMS, getPlatformById, DEFAULT_PLATFORM_ID, type PlatformId } from "@/lib/platforms";
import { legBreakEvenProbability, getDefaultSlipForPlatform } from "@/lib/slip-types";
import { Logo } from "@/components/Logo";

type BookSideOdds = { over: number | null; under: number | null; line?: number };
type Offerings = Record<string, BookSideOdds>;
type MarketRow = {
  playerId: string; player: string; team?: string; matchup?: string;
  gameTime?: string; market: string; line: number; sport?: string; offerings: Offerings;
};
type PipelinePayload = { updated: string; source: string; markets: MarketRow[] };
type FlatProp = {
  key: string; player: string; team?: string; matchup: string; sport: string;
  market: string; line: number; side: "Over" | "Under";
  fairProb: number; fairPct: number; platformOdds: number | null; offerings: Offerings;
};

const MARKET_ABBREV: Record<string, string> = {
  "Points": "Pts", "Rebounds": "Reb", "Assists": "Ast", "Threes Made": "3PM",
  "Steals": "Stl", "Blocks": "Blk", "Turnovers": "TO",
  "Points + Rebounds": "Pts+Reb", "Points + Assists": "Pts+Ast",
  "Rebounds + Assists": "Reb+Ast", "Points + Rebounds + Assists": "Pts+Reb+Ast",
  "Pitcher Strikeouts": "K", "Hits": "H", "Home Runs": "HR", "RBIs": "RBI",
  "Runs": "R", "Walks": "BB", "Goals": "G", "Shots on Goal": "SOG",
  "Passing Yards": "Pass Yds", "Rushing Yards": "Rush Yds",
  "Receiving Yards": "Rec Yds", "Receptions": "Rec", "Passing TDs": "Pass TDs",
  "Map 1 Kills": "M1 Kills", "Map 1 Headshots": "M1 HS",
  "Maps 1-3 Kills": "Kills", "Maps 1-3 Assists": "Assists",
};

const SPORT_BADGE: Record<string, { label: string; color: string }> = {
  nba: { label: "NBA", color: "text-blue-400/70" },
  mlb: { label: "MLB", color: "text-red-400/70" },
  nfl: { label: "NFL", color: "text-green-400/70" },
  nhl: { label: "NHL", color: "text-cyan-400/70" },
  esports: { label: "Esports", color: "text-purple-400/70" },
};

const PLATFORM_LOGO: Record<string, string> = {
  prizepicks: "PrizePicks", underdog: "Underdog", pick6: "Pick6", betr: "Betr",
};

const SPORTS = [
  { id: "nba", label: "NBA" }, { id: "mlb", label: "MLB" },
  { id: "nfl", label: "NFL" }, { id: "nhl", label: "NHL" },
  { id: "esports", label: "Esports" },
];

function cleanMarket(m: string) {
  const stripped = m.replace("Player ", "");
  return MARKET_ABBREV[stripped] ?? stripped;
}
function formatOdds(n: number) { return n > 0 ? `+${n}` : `${n}`; }
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function processToFlat(markets: MarketRow[], weights: WeightMap, platformBooks: string[]): FlatProp[] {
  const props: FlatProp[] = [];
  for (const market of markets) {
    const hasProp = platformBooks.some(
      (b) => market.offerings[b]?.over != null || market.offerings[b]?.under != null
    );
    if (!hasProp) continue;
    const { fairOver } = consensusFairProb(market.offerings, weights);
    if (fairOver == null) continue;
    const sport = market.sport ?? "nba";
    for (const side of ["Over", "Under"] as const) {
      const fairProb = side === "Over" ? fairOver : 1 - fairOver;
      let platformOdds: number | null = null;
      for (const book of platformBooks) {
        const odds = side === "Over" ? market.offerings[book]?.over : market.offerings[book]?.under;
        if (odds != null) { platformOdds = odds; break; }
      }
      if (platformOdds == null) continue;
      props.push({
        key: `${market.playerId}|${market.market}|${market.line}|${side}`,
        player: market.player, team: market.team,
        matchup: market.matchup ?? "", sport, market: market.market,
        line: market.line, side, fairProb, fairPct: fairProb * 100,
        platformOdds, offerings: market.offerings,
      });
    }
  }
  return props.sort((a, b) => b.fairProb - a.fairProb);
}

const PLATFORM_IDS = PLATFORMS.map((p) => p.id) as [PlatformId, ...PlatformId[]];

export default function BoardPage() {
  return <Suspense><BoardInner /></Suspense>;
}

function BoardInner() {
  const pathname = usePathname();
  const [markets, setMarkets] = useState<MarketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSport, setSelectedSport] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [slipLegKeys, setSlipLegKeys] = useState<string[]>([]);
  const [slipOpen, setSlipOpen] = useState(false);
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [minHitPct, setMinHitPct] = useState(52);
  const [showAltLines, setShowAltLines] = useState(false);

  const { weights } = useBookWeights();
  const [platform, setPlatformRaw] = useQueryState(
    "platform",
    parseAsStringLiteral(PLATFORM_IDS).withDefault(DEFAULT_PLATFORM_ID),
  );
  const platformConfig = getPlatformById(platform);

  useEffect(() => { setShowAltLines(false); }, [platform]);

  useEffect(() => {
    fetch("/opportunities.json")
      .then((r) => r.json())
      .then((data: PipelinePayload | unknown[]) => {
        const rows = Array.isArray(data) ? [] : ((data as PipelinePayload).markets ?? []);
        const updated = Array.isArray(data) ? null : (data as PipelinePayload).updated ?? null;
        setMarkets(rows); setUpdatedAt(updated); setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const activePlatformBooks = useMemo(
    () => showAltLines ? platformConfig.books : platformConfig.primaryBooks,
    [platformConfig, showAltLines],
  );
  const defaultSlip = useMemo(() => getDefaultSlipForPlatform(platformConfig.slipPlatform), [platformConfig]);
  const targetPct = legBreakEvenProbability(defaultSlip) * 100;

  const allProps = useMemo(
    () => processToFlat(markets, weights, activePlatformBooks),
    [markets, weights, activePlatformBooks],
  );

  const referenceBookColumns = useMemo(() => {
    const seen = new Set<string>();
    for (const m of markets) {
      for (const book of Object.keys(m.offerings)) {
        if (isReferenceBook(book)) seen.add(book);
      }
    }
    const order: Record<string, number> = { sharp: 0, exchange: 1, retail: 2 };
    return [...seen].sort((a, b) => {
      const ca = order[getBook(a)?.category ?? "retail"] ?? 3;
      const cb = order[getBook(b)?.category ?? "retail"] ?? 3;
      return ca - cb;
    });
  }, [markets]);

  const displayed = useMemo(() => {
    let result = allProps.filter((p) => p.fairPct >= minHitPct);
    if (selectedSport) result = result.filter((p) => p.sport === selectedSport);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((p) =>
        p.player.toLowerCase().includes(q) ||
        p.market.toLowerCase().includes(q) ||
        p.team?.toLowerCase().includes(q) ||
        p.matchup.toLowerCase().includes(q)
      );
    }
    return sortDir === "asc" ? [...result].reverse() : result;
  }, [allProps, searchQuery, sortDir, selectedSport, minHitPct]);

  const slipKeys = useMemo(() => new Set(slipLegKeys), [slipLegKeys]);
  const slipFull = slipLegKeys.length >= 6;

  const slipLegs = useMemo((): SlipLeg[] =>
    slipLegKeys
      .map((key) => {
        const prop = allProps.find((p) => p.key === key);
        if (!prop) return null;
        return { key, player: prop.player, market: prop.market, line: prop.line, side: prop.side, fairProb: prop.fairProb };
      })
      .filter((l): l is SlipLeg => l !== null),
    [slipLegKeys, allProps],
  );

  const toggleSlipLeg = (key: string) => {
    setSlipLegKeys((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      if (prev.length >= 6) return prev;
      return [...prev, key];
    });
    setSlipOpen(true);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setCmdkOpen(true); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const hasActiveFilters = minHitPct !== 52 || showAltLines || !!searchQuery || !!selectedSport;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">

      {/* ── Sidebar ── */}
      <aside className="w-[220px] shrink-0 border-r border-border bg-card flex flex-col overflow-y-auto">

        <div className="px-4 pt-5 pb-4 border-b border-border">
          <Logo size={22} />
        </div>

        <div className="px-3 pt-4 pb-2">
          <p className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-widest px-1 mb-1.5">Sport</p>
          <button
            onClick={() => setSelectedSport(null)}
            className={["w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors",
              selectedSport === null ? "bg-accent text-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"].join(" ")}
          >All Sports</button>
          {SPORTS.map((s) => (
            <button key={s.id}
              onClick={() => setSelectedSport(selectedSport === s.id ? null : s.id)}
              className={["w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors",
                selectedSport === s.id ? "bg-accent text-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"].join(" ")}
            >{s.label}</button>
          ))}
        </div>

        <div className="px-3 pt-3 pb-2 border-t border-border mt-2">
          <p className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-widest px-1 mb-2">Platform</p>
          <div className="flex items-center gap-2 px-1 flex-wrap">
            {PLATFORMS.map((p) => {
              const isActive = platform === p.id;
              return (
                <button key={p.id} disabled={!p.available}
                  onClick={() => p.available && setPlatformRaw(p.id)}
                  title={p.label}
                  className={["inline-flex items-center justify-center w-10 h-10 rounded-xl transition-all",
                    isActive ? "ring-2 ring-blue-400/60 ring-offset-1 ring-offset-card" : "opacity-40 hover:opacity-70",
                    !p.available ? "cursor-not-allowed" : "cursor-pointer"].join(" ")}
                >
                  <BookLogo book={PLATFORM_LOGO[p.id] ?? p.label} size="header" />
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-3 pt-3 pb-2 border-t border-border mt-2">
          <p className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-widest px-1 mb-1.5">Search</p>
          <div className="relative px-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40 pointer-events-none" />
            <input type="text" placeholder="Players, markets..." value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 rounded-md border border-border bg-background pl-8 pr-7 text-sm placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-border"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        <div className="px-3 pt-3 pb-2 border-t border-border mt-2">
          <p className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-widest px-1 mb-2">Min % Hit</p>
          <div className="flex items-center gap-1 px-1">
            {[52, 54, 56, 58].map((val) => (
              <button key={val} onClick={() => setMinHitPct(val)}
                className={["flex-1 py-1 rounded-md text-xs font-medium transition-colors border",
                  minHitPct === val ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground"].join(" ")}
              >{val}%</button>
            ))}
          </div>
        </div>

        <div className="px-4 pt-3 pb-2 mt-1">
          <button onClick={() => setShowAltLines(!showAltLines)}
            className="w-full flex items-center justify-between text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>Alt Lines</span>
            <div className={["w-8 h-4 rounded-full transition-colors relative", showAltLines ? "bg-blue-500" : "bg-muted"].join(" ")}>
              <div className={["absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform", showAltLines ? "translate-x-4" : "translate-x-0.5"].join(" ")} />
            </div>
          </button>
        </div>

        <div className="mt-auto border-t border-border">
          {hasActiveFilters && (
            <div className="px-4 pt-3 pb-1">
              <button
                onClick={() => { setMinHitPct(52); setShowAltLines(false); setSearchQuery(""); setSelectedSport(null); }}
                className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              >Clear all filters</button>
            </div>
          )}
          {updatedAt && (
            <div className="px-4 py-3">
              <p className="text-[10px] text-muted-foreground/40">Updated {relativeTime(updatedAt)}</p>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        <header className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-0.5 rounded-lg bg-card border border-border p-0.5">
              <Link href="/scanner"
                className={["px-3 py-1 rounded-md text-sm transition-colors",
                  pathname === "/scanner" ? "bg-background border border-border text-foreground font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"].join(" ")}
              >Scanner</Link>
              <Link href="/board"
                className={["px-3 py-1 rounded-md text-sm transition-colors",
                  pathname === "/board" ? "bg-background border border-border text-foreground font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"].join(" ")}
              >Board</Link>
            </div>
            <p className="text-sm text-muted-foreground tabular-nums">
              <span className="text-foreground font-medium">{displayed.length}</span> props
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setCmdkOpen(true)}
              className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <CommandIcon className="h-3 w-3" /><span>K</span>
            </button>
            <button onClick={() => setSlipOpen(true)}
              className={["flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm font-medium transition-colors",
                slipLegKeys.length > 0 ? "border-blue-400/40 text-blue-400 bg-blue-400/5 hover:bg-blue-400/10" : "border-border text-muted-foreground hover:text-foreground"].join(" ")}
            >
              <ListPlus className="h-3.5 w-3.5" />
              {slipLegKeys.length > 0 ? `Slip (${slipLegKeys.length})` : "Slip Builder"}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto">
          <div className="min-w-max">
            <Table>
              <TableHeader className="sticky top-0 z-20 bg-background border-b border-border">
                <TableRow className="hover:bg-transparent h-14">
                  <TableHead className="w-8" />
                  <TableHead>Player</TableHead>
                  <TableHead>Bet</TableHead>
                  <TableHead>Line</TableHead>
                  <TableHead>Market</TableHead>
                  <TableHead className="text-right">
                    <div className="flex justify-end">
                      <BookLogo book={platformConfig.label} size="header" />
                    </div>
                  </TableHead>
                  <TableHead className="text-right">
                    <button
                      onClick={() => setSortDir(d => d === "desc" ? "asc" : "desc")}
                      className="inline-flex items-center gap-1 ml-auto hover:text-foreground transition-colors"
                    >
                      % Hit
                      {sortDir === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
                    </button>
                  </TableHead>
                  {referenceBookColumns.map((book) => (
                    <TableHead key={book} className="text-right">
                      <div className="flex justify-end">
                        <BookLogo book={getBook(book).label} size="header" />
                      </div>
                    </TableHead>
                  ))}
                  <TableHead className="w-12 text-center" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayed.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7 + referenceBookColumns.length} className="text-center py-20">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-card border border-border flex items-center justify-center">
                          <Search className="h-5 w-5 text-muted-foreground/50" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">No props found</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {markets.length === 0
                              ? "Run pipeline.py to generate opportunities.json"
                              : "Try lowering the min % Hit or clearing your search"}
                          </p>
                        </div>
                        {hasActiveFilters && (
                          <button
                            onClick={() => { setMinHitPct(52); setSearchQuery(""); setSelectedSport(null); setShowAltLines(false); }}
                            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                          >Clear all filters</button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : displayed.map((prop) => {
                  const { pillStyle, textClass } = hitCellStyle(prop.fairPct, targetPct);
                  const inSlip = slipKeys.has(prop.key);
                  const isExpanded = expanded === prop.key;
                  const sportMeta = SPORT_BADGE[prop.sport] ?? { label: prop.sport.toUpperCase(), color: "text-muted-foreground/50" };
                  const bestBook = referenceBookColumns.reduce<{ book: string; odds: number } | null>(
                    (best, book) => {
                      const odds = prop.side === "Over" ? prop.offerings[book]?.over : prop.offerings[book]?.under;
                      if (odds == null) return best;
                      if (best === null || odds > best.odds) return { book, odds };
                      return best;
                    }, null
                  );

                  return (
                    <React.Fragment key={prop.key}>
                      <TableRow
                        className="cursor-pointer border-border hover:bg-accent h-24 group"
                        onClick={() => setExpanded(isExpanded ? null : prop.key)}
                      >
                        <TableCell className="py-0 pl-3">
                          <span className={`transition-opacity ${isExpanded ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                            {isExpanded
                              ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                              : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                          </span>
                        </TableCell>
                        <TableCell className="py-0">
                          <div className="font-semibold text-base leading-tight tracking-tight">{prop.player}</div>
                          <div className="text-[11px] text-muted-foreground/40 mt-1 leading-tight">
                            {[prop.team, prop.matchup].filter(Boolean).join(" · ")}
                            {prop.sport && <span className={`ml-1.5 ${sportMeta.color}`}>· {sportMeta.label}</span>}
                          </div>
                        </TableCell>
                        <TableCell className="py-0">
                          <span className={`text-sm font-medium ${prop.side === "Over" ? "text-blue-400/80" : "text-red-400/80"}`}>
                            {prop.side}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-sm py-0 text-muted-foreground">{prop.line}</TableCell>
                        <TableCell className="py-0 max-w-[140px]">
                          <span className="text-sm text-muted-foreground/60 truncate block" title={cleanMarket(prop.market)}>
                            {cleanMarket(prop.market)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold text-sm py-0">
                          {prop.platformOdds != null ? formatOdds(prop.platformOdds) : "—"}
                        </TableCell>
                        <TableCell className="text-right py-0">
                          <div className="flex justify-end pr-1">
                            <span
                              className={`inline-flex items-center justify-center rounded-md font-mono text-sm px-3 py-2 min-w-[72px] ${textClass}`}
                              style={pillStyle}
                            >
                              {prop.fairPct.toFixed(1)}%
                            </span>
                          </div>
                        </TableCell>

                        {/* ── Reference book columns ── */}
                        {referenceBookColumns.map((book) => {
                          const odds = prop.side === "Over" ? prop.offerings[book]?.over : prop.offerings[book]?.under;
                          const isBest = bestBook?.book === book && odds != null;
                          return (
                            <TableCell
                              key={book}
                              className="text-right font-mono text-sm py-0 transition-colors"
                              style={isBest ? {
                                backgroundColor: "rgba(42, 93, 156, 0.30)",
                                borderLeft: "2px solid rgba(57, 99, 157, 0.70)",
                              } : undefined}
                            >
                              {odds != null ? (
                                <div className="flex flex-col items-end leading-tight pr-1">
                                  {isBest && (
                                    <span className="text-[8px] font-bold uppercase tracking-wide mb-0.5 text-[#B0C8E0]">
                                      BEST
                                    </span>
                                  )}
                                  <span className={isBest ? "text-white font-bold text-base" : "text-muted-foreground"}>
                                    {formatOdds(odds)}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground/20">—</span>
                              )}
                            </TableCell>
                          );
                        })}

                        <TableCell className="text-center py-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => toggleSlipLeg(prop.key)}
                            disabled={!inSlip && slipFull}
                            className={["inline-flex items-center justify-center h-7 w-7 rounded-md border transition-all opacity-0 group-hover:opacity-100",
                              inSlip ? "border-blue-400/50 text-blue-400 bg-blue-400/10 opacity-100"
                                : slipFull ? "border-border/30 text-muted-foreground/20 cursor-not-allowed"
                                : "border-border text-muted-foreground hover:text-foreground hover:bg-accent"].join(" ")}
                          >
                            {inSlip ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                          </button>
                        </TableCell>
                      </TableRow>

                      {isExpanded && (
                        <TableRow className="border-border bg-accent/10 hover:bg-accent/10">
                          <TableCell colSpan={8 + referenceBookColumns.length} className="px-8 py-4">
                            <div className="space-y-3">
                              <div className="flex items-center gap-8 text-xs">
                                <div>
                                  <p className="text-muted-foreground/50 uppercase tracking-wider mb-0.5">Fair</p>
                                  <p className="font-mono">{prop.fairPct.toFixed(1)}% / {formatOdds(probToAmerican(prop.fairProb))}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground/50 uppercase tracking-wider mb-0.5">Target (5P Flex)</p>
                                  <p className="font-mono">{targetPct.toFixed(1)}%</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground/50 uppercase tracking-wider mb-0.5">Matchup</p>
                                  <p className="font-mono">{prop.matchup}</p>
                                </div>
                              </div>
                              <div>
                                <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest mb-2">Reference Books</p>
                                <div className="flex items-center flex-wrap gap-x-0 divide-x divide-border rounded-lg border border-border bg-card/40 overflow-hidden w-fit">
                                  <div className="flex items-center gap-2.5 px-3 py-2 bg-blue-400/5">
                                    <BookLogo book={platformConfig.label} size="sm" />
                                    <span className="text-[9px] font-semibold uppercase text-blue-400">playing</span>
                                    <span className="font-mono text-sm font-semibold">
                                      {prop.platformOdds != null ? formatOdds(prop.platformOdds) : "—"}
                                    </span>
                                    {prop.platformOdds != null && (
                                      <span className="font-mono text-xs text-muted-foreground">
                                        {evPct(prop.fairProb, prop.platformOdds) > 0 ? "+" : ""}
                                        {evPct(prop.fairProb, prop.platformOdds).toFixed(1)}%
                                      </span>
                                    )}
                                  </div>
                                  {referenceBookColumns.map((book) => {
                                    const odds = prop.side === "Over" ? prop.offerings[book]?.over : prop.offerings[book]?.under;
                                    if (odds == null) return null;
                                    const ev = evPct(prop.fairProb, odds);
                                    return (
                                      <div key={book} className="flex items-center gap-2.5 px-3 py-2">
                                        <BookLogo book={getBook(book).label} size="sm" />
                                        <span className="font-mono text-sm text-muted-foreground">{formatOdds(odds)}</span>
                                        <span className={`font-mono text-xs ${ev >= 0 ? "text-blue-400/70" : "text-muted-foreground/50"}`}>
                                          {ev > 0 ? "+" : ""}{ev.toFixed(1)}%
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <SlipBuilder
        open={slipOpen}
        onCloseAction={() => setSlipOpen(false)}
        legs={slipLegs}
        onRemoveLegAction={(key) => setSlipLegKeys((prev) => prev.filter((k) => k !== key))}
        onClearAllAction={() => setSlipLegKeys([])}
        platform={platformConfig}
      />

      <Dialog open={cmdkOpen} onOpenChange={setCmdkOpen}>
        <DialogContent className="p-0 max-w-lg overflow-hidden">
          <DialogTitle className="sr-only">Command Palette</DialogTitle>
          <Command className="rounded-lg">
            <CommandInput placeholder="Search players..." className="h-11" />
            <CommandList className="max-h-80">
              <CommandEmpty>No results.</CommandEmpty>
              <CommandGroup heading="Players">
                {[...new Set(displayed.map((p) => p.player))].slice(0, 8).map((player: string) => (
                  <CommandItem key={player} onSelect={() => { setSearchQuery(player); setCmdkOpen(false); }}>
                    <Search className="h-3.5 w-3.5 mr-2 text-muted-foreground" />{player}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading="Actions">
                <CommandItem onSelect={() => { setSortDir(d => d === "desc" ? "asc" : "desc"); setCmdkOpen(false); }}>
                  <ArrowUpDown className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                  Toggle sort — {sortDir === "desc" ? "highest first" : "lowest first"}
                </CommandItem>
                <CommandItem onSelect={() => { setShowAltLines(!showAltLines); setCmdkOpen(false); }}>
                  <ArrowUpDown className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                  {showAltLines ? "Hide" : "Show"} alt lines
                </CommandItem>
                <CommandItem onSelect={() => { setSearchQuery(""); setCmdkOpen(false); }}>
                  <X className="h-3.5 w-3.5 mr-2 text-muted-foreground" />Clear search
                </CommandItem>
                <CommandItem onSelect={() => { setSlipOpen(true); setCmdkOpen(false); }}>
                  <ListPlus className="h-3.5 w-3.5 mr-2 text-muted-foreground" />Open slip builder
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </div>
  );
}