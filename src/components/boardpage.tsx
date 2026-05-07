"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useQueryState, parseAsStringLiteral } from "nuqs";
import { usePathname } from "next/navigation";
import { Check, Plus, ListPlus, Search, X, Command as CommandIcon, ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import { BookLogo } from "@/components/book-logo";
import { SlipBuilder, type SlipLeg } from "@/components/slip-builder";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem,
  CommandList, CommandSeparator,
} from "@/components/ui/command";
import { hitCellStyle } from "@/lib/hit-cell";
import { consensusFairProb, probToAmerican, type WeightMap } from "@/lib/devig";
import { useBookWeights } from "@/lib/book-weights";
import { PLATFORMS, getPlatformById, DEFAULT_PLATFORM_ID, type PlatformId } from "@/lib/platforms";
import { legBreakEvenProbability, getDefaultSlipForPlatform, getSlipById } from "@/lib/slip-types";

// ============================================================================
// Types
// ============================================================================

type BookSideOdds = { over: number | null; under: number | null; line?: number };
type Offerings = Record<string, BookSideOdds>;

type MarketRow = {
  playerId: string;
  player: string;
  team?: string;
  matchup?: string;
  gameTime?: string;
  market: string;
  line: number;
  sport?: string;
  offerings: Offerings;
};

type PipelinePayload = { updated: string; source: string; markets: MarketRow[] };

type ProcessedProp = {
  key: string;
  player: string;
  team?: string;
  matchup: string;
  market: string;
  line: number;
  overProb: number | null;
  underProb: number | null;
  overOdds: number | null;
  underOdds: number | null;
  offerings: Offerings;
};

// ============================================================================
// Helpers
// ============================================================================

const MARKET_ABBREV: Record<string, string> = {
  "Points": "Pts", "Rebounds": "Reb", "Assists": "Ast",
  "Threes Made": "3PM", "Steals": "Stl", "Blocks": "Blk",
  "Turnovers": "TO", "Points + Rebounds": "Pts+Reb",
  "Points + Assists": "Pts+Ast", "Rebounds + Assists": "Reb+Ast",
  "Points + Rebounds + Assists": "Pts+Reb+Ast",
  "Pitcher Strikeouts": "K", "Hits": "H", "Home Runs": "HR",
  "RBIs": "RBI", "Runs": "R", "Walks": "BB",
  "Goals": "G", "Assists (Hockey)": "A", "Shots on Goal": "SOG",
};

function cleanMarket(m: string) {
  const stripped = m.replace("Player ", "");
  return MARKET_ABBREV[stripped] ?? stripped;
}

function formatOdds(n: number) {
  return n > 0 ? `+${n}` : `${n}`;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ============================================================================
// Process markets into props with both sides
// ============================================================================

function processToProps(
  markets: MarketRow[],
  weights: WeightMap,
  platformBooks: string[],
): ProcessedProp[] {
  const props: ProcessedProp[] = [];

  for (const market of markets) {
    // Check if platform has this prop
    const hasProp = platformBooks.some(
      (b) => market.offerings[b]?.over != null || market.offerings[b]?.under != null
    );
    if (!hasProp) continue;

    const { fairOver } = consensusFairProb(market.offerings, weights);

    // Get platform odds for display
    let platformOver: number | null = null;
    let platformUnder: number | null = null;
    for (const book of platformBooks) {
      const o = market.offerings[book];
      if (o?.over != null) platformOver = o.over;
      if (o?.under != null) platformUnder = o.under;
      if (platformOver !== null && platformUnder !== null) break;
    }

    props.push({
      key: `${market.playerId}|${market.market}|${market.line}`,
      player: market.player,
      team: market.team,
      matchup: market.matchup ?? "Unknown",
      market: market.market,
      line: market.line,
      overProb: fairOver ?? null,
      underProb: fairOver != null ? 1 - fairOver : null,
      overOdds: platformOver,
      underOdds: platformUnder,
      offerings: market.offerings,
    });
  }

  return props;
}

// ============================================================================
// Sport tabs config
// ============================================================================

type Sport = { id: string; label: string; available: boolean };
const SPORTS: Sport[] = [
  { id: "nba",     label: "NBA",     available: true  },
  { id: "mlb",     label: "MLB",     available: true  },
  { id: "nfl",     label: "NFL",     available: true  },
  { id: "nhl",     label: "NHL",     available: true  },
  { id: "esports", label: "Esports", available: true  },
];

const PLATFORM_LOGO: Record<string, string> = {
  prizepicks: "PrizePicks",
  underdog: "Underdog",
  pick6: "Pick6",
  betr: "Betr",
};

// ============================================================================
// Prop row component
// ============================================================================

function PropRow({
  prop,
  targetPct,
  inSlip,
  slipFull,
  onAdd,
}: {
  prop: ProcessedProp;
  targetPct: number;
  inSlip: boolean;
  slipFull: boolean;
  onAdd: (side: "Over" | "Under") => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const overStyle = prop.overProb != null
    ? hitCellStyle(prop.overProb * 100, targetPct)
    : null;
  const underStyle = prop.underProb != null
    ? hitCellStyle(prop.underProb * 100, targetPct)
    : null;

  // Best side = higher fair prob
  const bestSide: "Over" | "Under" =
    (prop.overProb ?? 0) >= (prop.underProb ?? 0) ? "Over" : "Under";

  return (
    <>
      <div
        className="flex items-center gap-4 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-accent/30 transition-colors cursor-pointer group"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Expand chevron */}
        <span className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {expanded
            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        </span>

        {/* Player */}
        <div className="w-44 shrink-0">
          <p className="font-semibold text-sm leading-tight">{prop.player}</p>
          {prop.team && (
            <p className="text-[11px] text-muted-foreground/40 mt-0.5">{prop.team}</p>
          )}
        </div>

        {/* Market + Line */}
        <div className="w-28 shrink-0">
          <p className="text-sm text-muted-foreground/70">{cleanMarket(prop.market)}</p>
          <p className="text-xs font-mono text-muted-foreground/50 mt-0.5">{prop.line}</p>
        </div>

        {/* Over side */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground/40 w-6">Over</span>
          {prop.overOdds != null && (
            <span className="text-xs font-mono text-muted-foreground">
              {formatOdds(prop.overOdds)}
            </span>
          )}
          {overStyle && prop.overProb != null ? (
            <span
              className={`inline-flex items-center justify-center rounded-md font-mono text-xs px-2.5 py-1 min-w-[58px] ${overStyle.textClass}`}
              style={overStyle.pillStyle}
            >
              {(prop.overProb * 100).toFixed(1)}%
            </span>
          ) : (
            <span className="text-xs text-muted-foreground/25 min-w-[58px] text-center">—</span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onAdd("Over"); }}
            disabled={inSlip || slipFull}
            className={[
              "h-6 w-6 rounded border flex items-center justify-center transition-all shrink-0",
              "opacity-0 group-hover:opacity-100",
              inSlip
                ? "border-blue-400/50 text-blue-400 bg-blue-400/10 opacity-100"
                : slipFull
                ? "border-border/30 text-muted-foreground/20 cursor-not-allowed"
                : "border-border text-muted-foreground hover:text-foreground hover:bg-accent",
            ].join(" ")}
          >
            {inSlip ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          </button>
        </div>

        <div className="w-px h-8 bg-border/40 shrink-0" />

        {/* Under side */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground/40 w-8">Under</span>
          {prop.underOdds != null && (
            <span className="text-xs font-mono text-muted-foreground">
              {formatOdds(prop.underOdds)}
            </span>
          )}
          {underStyle && prop.underProb != null ? (
            <span
              className={`inline-flex items-center justify-center rounded-md font-mono text-xs px-2.5 py-1 min-w-[58px] ${underStyle.textClass}`}
              style={underStyle.pillStyle}
            >
              {(prop.underProb * 100).toFixed(1)}%
            </span>
          ) : (
            <span className="text-xs text-muted-foreground/25 min-w-[58px] text-center">—</span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onAdd("Under"); }}
            disabled={inSlip || slipFull}
            className={[
              "h-6 w-6 rounded border flex items-center justify-center transition-all shrink-0",
              "opacity-0 group-hover:opacity-100",
              inSlip
                ? "border-blue-400/50 text-blue-400 bg-blue-400/10 opacity-100"
                : slipFull
                ? "border-border/30 text-muted-foreground/20 cursor-not-allowed"
                : "border-border text-muted-foreground hover:text-foreground hover:bg-accent",
            ].join(" ")}
          >
            {inSlip ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {/* Expanded reference book odds */}
      {expanded && (
        <div className="px-12 py-3 bg-accent/10 border-b border-border/40">
          <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest mb-2">Reference Books</p>
          <div className="flex items-center flex-wrap gap-x-0 divide-x divide-border rounded-lg border border-border bg-card/40 overflow-hidden w-fit">
            {Object.entries(prop.offerings)
              .filter(([, odds]) => odds.over != null || odds.under != null)
              .map(([book, odds]) => (
                <div key={book} className="flex items-center gap-2 px-3 py-2">
                  <BookLogo book={book} size="sm" />
                  <div className="flex items-center gap-1.5 font-mono text-xs">
                    {odds.over != null && (
                      <span className="text-muted-foreground">
                        <span className="text-muted-foreground/40 mr-0.5">O</span>
                        {formatOdds(odds.over)}
                      </span>
                    )}
                    {odds.under != null && (
                      <span className="text-muted-foreground">
                        <span className="text-muted-foreground/40 mr-0.5">U</span>
                        {formatOdds(odds.under)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================================
// Game card component
// ============================================================================

function GameCard({
  matchup,
  props,
  targetPct,
  slipKeys,
  slipFull,
  onAdd,
}: {
  matchup: string;
  props: ProcessedProp[];
  targetPct: number;
  slipKeys: Set<string>;
  slipFull: boolean;
  onAdd: (prop: ProcessedProp, side: "Over" | "Under") => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-card/20 overflow-hidden">
      {/* Game header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-border hover:bg-accent/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold">{matchup}</span>
          <span className="text-xs text-muted-foreground/50 tabular-nums">
            {props.length} prop{props.length !== 1 ? "s" : ""}
          </span>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${collapsed ? "-rotate-90" : ""}`} />
      </button>

      {/* Props list */}
      {!collapsed && (
        <div>
          {props.map((prop) => (
            <PropRow
              key={prop.key}
              prop={prop}
              targetPct={targetPct}
              inSlip={slipKeys.has(`${prop.key}|Over`) || slipKeys.has(`${prop.key}|Under`)}
              slipFull={slipFull}
              onAdd={(side) => onAdd(prop, side)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main page
// ============================================================================

const PLATFORM_IDS = PLATFORMS.map((p) => p.id) as [PlatformId, ...PlatformId[]];

export default function BoardPage() {
  return <Suspense><BoardInner /></Suspense>;
}

function BoardInner() {
  const pathname = usePathname();
  const [markets, setMarkets] = useState<MarketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [selectedSport, setSelectedSport] = useState("nba");
  const [searchQuery, setSearchQuery] = useState("");
  const [slipLegKeys, setSlipLegKeys] = useState<string[]>([]);
  const [slipOpen, setSlipOpen] = useState(false);
  const [cmdkOpen, setCmdkOpen] = useState(false);

  const { weights } = useBookWeights();

  const [platform, setPlatformRaw] = useQueryState(
    "platform",
    parseAsStringLiteral(PLATFORM_IDS).withDefault(DEFAULT_PLATFORM_ID),
  );

  const platformConfig = getPlatformById(platform);

  useEffect(() => {
    fetch("/opportunities.json")
      .then((r) => r.json())
      .then((data: PipelinePayload | unknown[]) => {
        const rows = Array.isArray(data) ? [] : ((data as PipelinePayload).markets ?? []);
        const updated = Array.isArray(data) ? null : (data as PipelinePayload).updated ?? null;
        setMarkets(rows);
        setUpdatedAt(updated);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Filter by sport
  const sportMarkets = useMemo(
    () => markets.filter((m) => !m.sport || m.sport === selectedSport),
    [markets, selectedSport],
  );

  // Process into props with both sides
  const allProps = useMemo(
    () => processToProps(sportMarkets, weights, platformConfig.primaryBooks),
    [sportMarkets, weights, platformConfig],
  );

  // Filter by search
  const filteredProps = useMemo(() => {
    if (!searchQuery.trim()) return allProps;
    const q = searchQuery.toLowerCase();
    return allProps.filter(
      (p) =>
        p.player.toLowerCase().includes(q) ||
        p.market.toLowerCase().includes(q) ||
        p.team?.toLowerCase().includes(q)
    );
  }, [allProps, searchQuery]);

  // Group by matchup
  const groupedByMatchup = useMemo(() => {
    const groups = new Map<string, ProcessedProp[]>();
    for (const prop of filteredProps) {
      const key = prop.matchup;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(prop);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredProps]);

  // Default slip for target pct
  const defaultSlip = useMemo(
    () => getDefaultSlipForPlatform(platformConfig.slipPlatform),
    [platformConfig],
  );
  const targetPct = legBreakEvenProbability(defaultSlip) * 100;

  // Slip legs
  const slipKeys = useMemo(() => new Set(slipLegKeys), [slipLegKeys]);
  const slipFull = slipLegKeys.length >= 6;

  const slipLegs = useMemo((): SlipLeg[] =>
    slipLegKeys
      .map((legKey) => {
        const lastPipe = legKey.lastIndexOf("|");
        const propKey = legKey.slice(0, lastPipe);
        const side = legKey.slice(lastPipe + 1) as "Over" | "Under";
        const prop = allProps.find((p) => p.key === propKey);
        if (!prop) return null;
        const fairProb = side === "Over" ? prop.overProb : prop.underProb;
        if (fairProb == null) return null;
        return {
          key: legKey,
          player: prop.player,
          market: prop.market,
          line: prop.line,
          side,
          fairProb,
        };
      })
      .filter((l): l is SlipLeg => l !== null),
    [slipLegKeys, allProps],
  );

  const handleAddToSlip = (prop: ProcessedProp, side: "Over" | "Under") => {
    const key = `${prop.key}|${side}`;
    setSlipLegKeys((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      if (prev.length >= 6) return prev;
      return [...prev, key];
    });
    setSlipOpen(true);
  };

  // Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdkOpen(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading props...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">

      {/* ── Sidebar ────────────────────────────────────────────────── */}
      <aside className="w-[220px] shrink-0 border-r border-border bg-card flex flex-col overflow-y-auto">

        <div className="px-4 pt-5 pb-4 border-b border-border">
          <h1 className="text-sm font-semibold tracking-tight">Prop Screen</h1>
          <p className="text-[11px] text-muted-foreground/60 mt-0.5">Full slate · all props</p>
        </div>

        {/* Sport */}
        <div className="px-3 pt-4 pb-2">
          <p className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-widest px-1 mb-1.5">Sport</p>
          {SPORTS.map((s) => (
            <button
              key={s.id}
              disabled={!s.available}
              onClick={() => s.available && setSelectedSport(s.id)}
              className={[
                "w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors",
                selectedSport === s.id && s.available ? "bg-accent text-foreground font-medium"
                  : s.available ? "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  : "text-muted-foreground/30 cursor-not-allowed",
              ].join(" ")}
            >
              {s.label}
              {!s.available && <span className="text-[9px] uppercase tracking-wider opacity-50">soon</span>}
            </button>
          ))}
        </div>

        {/* Platform */}
        <div className="px-3 pt-3 pb-2 border-t border-border mt-2">
          <p className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-widest px-1 mb-2">Platform</p>
          <div className="flex items-center gap-2 px-1 flex-wrap">
            {PLATFORMS.map((p) => {
              const isActive = platform === p.id;
              const bookName = PLATFORM_LOGO[p.id] ?? p.label;
              return (
                <button
                  key={p.id}
                  disabled={!p.available}
                  onClick={() => p.available && setPlatformRaw(p.id)}
                  title={p.label}
                  className={[
                    "inline-flex items-center justify-center w-10 h-10 rounded-xl transition-all",
                    isActive ? "ring-2 ring-blue-400/60 ring-offset-1 ring-offset-card" : "opacity-40 hover:opacity-70",
                    !p.available ? "cursor-not-allowed" : "cursor-pointer",
                  ].join(" ")}
                >
                  <BookLogo book={bookName} size="header" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Search */}
        <div className="px-3 pt-3 pb-2 border-t border-border mt-2">
          <p className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-widest px-1 mb-1.5">Search</p>
          <div className="relative px-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40 pointer-events-none" />
            <input
              type="text"
              placeholder="Players, markets..."
              value={searchQuery}
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

        {/* Bottom */}
        <div className="mt-auto border-t border-border px-4 py-3">
          {updatedAt && (
            <p className="text-[10px] text-muted-foreground/40">Updated {relativeTime(updatedAt)}</p>
          )}
        </div>
      </aside>

      {/* ── Main ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Topbar */}
        <header className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-0.5 rounded-lg bg-card border border-border p-0.5">
              <Link
                href="/"
                className={[
                  "px-3 py-1 rounded-md text-sm transition-colors",
                  pathname === "/" ? "bg-background border border-border text-foreground font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                Scanner
              </Link>
              <Link
                href="/board"
                className={[
                  "px-3 py-1 rounded-md text-sm transition-colors",
                  pathname === "/board" ? "bg-background border border-border text-foreground font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                Board
              </Link>
            </div>
            <p className="text-sm text-muted-foreground tabular-nums">
              <span className="text-foreground font-medium">{filteredProps.length}</span> props
              <span className="mx-1.5 text-muted-foreground/30">·</span>
              {groupedByMatchup.length} games
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCmdkOpen(true)}
              className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <CommandIcon className="h-3 w-3" /><span>K</span>
            </button>
            <button
              onClick={() => setSlipOpen(true)}
              className={[
                "flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm font-medium transition-colors",
                slipLegKeys.length > 0
                  ? "border-blue-400/40 text-blue-400 bg-blue-400/5 hover:bg-blue-400/10"
                  : "border-border text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              <ListPlus className="h-3.5 w-3.5" />
              {slipLegKeys.length > 0 ? `Slip (${slipLegKeys.length})` : "Slip Builder"}
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto px-5 py-4 space-y-3">
          {groupedByMatchup.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-card border border-border flex items-center justify-center">
                <Search className="h-5 w-5 text-muted-foreground/50" />
              </div>
              <div>
                <p className="text-sm font-medium">No props found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {markets.length === 0
                    ? "Run pipeline.py to generate opportunities.json"
                    : "No props available for the selected sport and platform"}
                </p>
              </div>
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="text-xs text-blue-400 hover:text-blue-300">
                  Clear search
                </button>
              )}
            </div>
          ) : (
            groupedByMatchup.map(([matchup, props]) => (
              <GameCard
                key={matchup}
                matchup={matchup}
                props={props}
                targetPct={targetPct}
                slipKeys={slipKeys}
                slipFull={slipFull}
                onAdd={handleAddToSlip}
              />
            ))
          )}
        </div>
      </div>

      {/* Slip Builder */}
      <SlipBuilder
        open={slipOpen}
        onCloseAction={() => setSlipOpen(false)}
        legs={slipLegs}
        onRemoveLegAction={(key) => setSlipLegKeys((prev) => prev.filter((k) => k !== key))}
        onClearAllAction={() => setSlipLegKeys([])}
        platform={platformConfig}
      />

      {/* Cmd+K */}
      <Dialog open={cmdkOpen} onOpenChange={setCmdkOpen}>
        <DialogContent className="p-0 max-w-lg overflow-hidden">
          <DialogTitle className="sr-only">Command Palette</DialogTitle>
          <Command className="rounded-lg">
            <CommandInput placeholder="Search players..." className="h-11" />
            <CommandList className="max-h-80">
              <CommandEmpty>No results.</CommandEmpty>
              <CommandGroup heading="Players">
                {[...new Set(filteredProps.map((p) => p.player))].slice(0, 8).map((player) => (
                  <CommandItem
                    key={player}
                    onSelect={() => { setSearchQuery(player); setCmdkOpen(false); }}
                  >
                    <Search className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                    {player}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading="Actions">
                <CommandItem onSelect={() => { setSearchQuery(""); setCmdkOpen(false); }}>
                  <X className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                  Clear search
                </CommandItem>
                <CommandItem onSelect={() => { setSlipOpen(true); setCmdkOpen(false); }}>
                  <ListPlus className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                  Open slip builder
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </div>
  );
}