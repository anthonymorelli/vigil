"use client";

import React, { useState, useMemo, useEffect, Suspense } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useQueryState, parseAsStringLiteral } from "nuqs";
import { usePathname } from "next/navigation";
import { Check, Plus, ListPlus, Search, X, Command as CommandIcon, ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronRight, ChevronUp, SlidersHorizontal } from "lucide-react";
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
import { legBreakEvenProbability, legEvPctVsSlip, legTargetAmerican, getDefaultSlipForPlatform, groupedSlipTypes } from "@/lib/slip-types";
import { Logo } from "@/components/Logo";

type BookSideOdds = { over: number | null; under: number | null; line?: number; type?: string };
type Offerings = Record<string, BookSideOdds>;
type MarketRow = {
  playerId: string; player: string; team?: string; matchup?: string;
  gameTime?: string; market: string; line: number; sport?: string; offerings: Offerings;
};
type PipelinePayload = { updated: string; source: string; markets: MarketRow[] };
type FlatProp = {
  key: string; player: string; team?: string; matchup: string; sport: string;
  market: string; line: number; side: "Over" | "Under";
  fairProb: number; fairPct: number; offerings: Offerings;
  gameTime?: string;
};

const MARKET_ABBREV: Record<string, string> = {
  "Points": "Pts", "Rebounds": "Reb", "Assists": "Ast", "Threes Made": "3PM",
  "Steals": "Stl", "Blocks": "Blk", "Turnovers": "TO",
  "Points + Rebounds": "Pts+Reb", "Points + Assists": "Pts+Ast",
  "Rebounds + Assists": "Reb+Ast", "Points + Rebounds + Assists": "Pts+Reb+Ast",
  "Steals + Blocks": "Stl+Blk", "Pitcher Strikeouts": "Ks", "Hitter Strikeouts": "K",
  "Hits": "H", "H": "Hits", "Home Runs": "HR", "RBIs": "RBI", "Runs": "R",
  "Walks": "BB", "Hits + Runs + RBIs": "H+R+RBI", "Earned Runs": "ER",
  "Pitching Outs": "Outs", "Total Bases": "TB", "Goals": "G", "Shots on Goal": "SOG",
  "Saves": "SV", "Goals + Assists": "G+A", "Passing Yards": "Pass Yds",
  "Rushing Yards": "Rush Yds", "Receiving Yards": "Rec Yds", "Receptions": "Rec",
  "Passing TDs": "Pass TDs", "Rushing TDs": "Rush TDs", "Receiving TDs": "Rec TDs",
  "Interceptions": "INT", "Sacks": "Sacks", "Pass Completions": "Comp",
  "Pass Attempts": "Att", "Map 1 Kills": "M1 Kills", "Map 1 Headshots": "M1 HS",
  "Maps 1-3 Kills": "Kills", "Maps 1-3 Assists": "Assists", "Maps 1-3 Deaths": "Deaths",
};

const SPORT_BADGE: Record<string, { label: string; color: string }> = {
  nba: { label: "NBA", color: "text-blue-400/70" },
  mlb: { label: "MLB", color: "text-red-400/70" },
  nfl: { label: "NFL", color: "text-green-400/70" },
  nhl: { label: "NHL", color: "text-cyan-400/70" },
  esports: { label: "Esports", color: "text-purple-400/70" },
};

const SPORT_ORDER = ["nba", "mlb", "nhl", "nfl", "esports"];
const SPORT_LABELS: Record<string, string> = {
  nba: "NBA", mlb: "MLB", nhl: "NHL", nfl: "NFL", esports: "Esports",
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
function formatGameTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  if (isToday) return `Today · ${timeStr}`;
  if (isTomorrow) return `Tomorrow · ${timeStr}`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + ` · ${timeStr}`;
}

function processToFlat(markets: MarketRow[], weights: WeightMap, platformBooks: string[], showAltLines: boolean): FlatProp[] {
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
      let platformBook: string | null = null;
      for (const book of platformBooks) {
        const odds = side === "Over" ? market.offerings[book]?.over : market.offerings[book]?.under;
        if (odds != null) { platformBook = book; break; }
      }
      if (platformBook == null) continue;
      const offeringType = market.offerings[platformBook]?.type;
      if (!showAltLines && offeringType === "goblin") continue;
      if (!showAltLines && offeringType === "demon") continue;
      props.push({
        key: `${market.playerId}|${market.market}|${market.line}|${side}`,
        player: market.player, team: market.team,
        matchup: market.matchup ?? "", sport, market: market.market,
        line: market.line, side, fairProb, fairPct: fairProb * 100,
        offerings: market.offerings,
        gameTime: market.gameTime,
      });
    }
  }
  return props.sort((a, b) => b.fairProb - a.fairProb);
}

const PLATFORM_IDS = PLATFORMS.map((p) => p.id) as [PlatformId, ...PlatformId[]];
type MarketOption = { rawMarket: string; abbrev: string; sport: string };

// ── SlipBreakdown (shared desktop + mobile) ──────────────────────────────
const SLIP_VISIBLE_DEFAULT = 3;

function SlipBreakdown({ fairProb, platformSlipPlatform, platformLabel }: {
  fairProb: number;
  platformSlipPlatform: ReturnType<typeof getPlatformById>["slipPlatform"];
  platformLabel: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const fairPct = fairProb * 100;
  const allSlips = groupedSlipTypes(platformSlipPlatform)
    .flatMap((g) => g.variants.flatMap((v) => v.slips))
    .filter((s) => s.available)
    .map((s) => ({
      id: s.id,
      label: `${s.picks} Pick ${s.variant}`,
      breakEven: legBreakEvenProbability(s) * 100,
      qualifies: fairPct >= legBreakEvenProbability(s) * 100,
    }))
    .sort((a, b) => a.breakEven - b.breakEven);
  const qualifying = allSlips.filter((s) => s.qualifies);
  const nonQualifying = allSlips.filter((s) => !s.qualifies);
  const visibleQualifying = showAll ? qualifying : qualifying.slice(0, SLIP_VISIBLE_DEFAULT);
  const visible = [...visibleQualifying, ...(showAll ? nonQualifying : [])];
  const totalHidden = showAll ? 0 : Math.max(0, qualifying.length - SLIP_VISIBLE_DEFAULT) + nonQualifying.length;
  return (
    <div className="min-w-[180px]">
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/50">{platformLabel} % Needed</p>
        <span className="font-mono text-sm font-semibold" style={{ color: "#5A9AE0" }}>{fairPct.toFixed(1)}%</span>
      </div>
      {qualifying.length === 0 ? (
        <p className="text-xs text-muted-foreground/40 italic mb-1">No qualifying slips</p>
      ) : (
        <div className="space-y-1.5">
          {visible.map(({ id, label, breakEven, qualifies }) => (
            <div key={id} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                {qualifies ? <Check className="h-3 w-3 text-emerald-400 shrink-0" /> : <X className="h-3 w-3 text-muted-foreground/25 shrink-0" />}
                <span className={`text-sm ${qualifies ? "text-emerald-400" : "text-muted-foreground/35"}`}>{label}</span>
              </div>
              <span className={`font-mono text-sm tabular-nums ${qualifies ? "text-foreground font-medium" : "text-muted-foreground/35"}`}>{breakEven.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      )}
      {(totalHidden > 0 || showAll) && (
        <button onClick={() => setShowAll((v) => !v)} className="mt-2 text-[11px] text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors">
          {showAll ? "Show less" : `+${totalHidden} more`}
        </button>
      )}
    </div>
  );
}

// ── Desktop MarketFilterDropdown ─────────────────────────────────────────
function MarketFilterDropdown({ options, selectedMarket, selectedSport, onSelect }: {
  options: MarketOption[]; selectedMarket: string | null; selectedSport: string | null; onSelect: (market: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedAbbrev = selectedMarket ? options.find((o) => o.rawMarket === selectedMarket)?.abbrev ?? selectedMarket : null;
  const grouped = useMemo(() => {
    if (selectedSport) return [{ sport: selectedSport, label: SPORT_LABELS[selectedSport] ?? selectedSport, markets: options }];
    const map = new Map<string, MarketOption[]>();
    for (const opt of options) { if (!map.has(opt.sport)) map.set(opt.sport, []); map.get(opt.sport)!.push(opt); }
    return SPORT_ORDER.filter((s) => map.has(s)).map((s) => ({ sport: s, label: SPORT_LABELS[s] ?? s, markets: map.get(s)! }));
  }, [options, selectedSport]);
  if (options.length < 2) return null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className={["flex items-center gap-1.5 h-7 px-2.5 rounded-md border text-xs font-medium transition-colors",
          selectedMarket ? "border-blue-400/40 text-blue-400 bg-blue-400/5" : "border-border text-muted-foreground hover:text-foreground hover:bg-accent/50"].join(" ")}>
          {selectedAbbrev ?? "Market"}<ChevronDown className="h-3 w-3 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-1" align="start">
        <button onClick={() => { onSelect(null); setOpen(false); }}
          className={["w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors",
            selectedMarket === null ? "text-foreground bg-accent" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"].join(" ")}>
          <span>All markets</span>{selectedMarket === null && <Check className="h-3.5 w-3.5 text-blue-400" />}
        </button>
        {grouped.map((group) => (
          <div key={group.sport}>
            {!selectedSport && <p className="px-2 pt-2 pb-0.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/40">{group.label}</p>}
            {group.markets.map((opt) => (
              <button key={opt.rawMarket} onClick={() => { onSelect(opt.rawMarket); setOpen(false); }}
                className={["w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors",
                  selectedMarket === opt.rawMarket ? "text-foreground bg-accent" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"].join(" ")}>
                <span>{opt.abbrev}</span>{selectedMarket === opt.rawMarket && <Check className="h-3.5 w-3.5 text-blue-400" />}
              </button>
            ))}
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// ── PropCard (mobile only) ────────────────────────────────────────────────
function PropCard({ prop, platformConfig, defaultSlip, targetPct, referenceBookColumns, inSlip, slipFull, onToggleSlip, onExpand, isExpanded }: {
  prop: FlatProp;
  platformConfig: ReturnType<typeof getPlatformById>;
  defaultSlip: ReturnType<typeof getDefaultSlipForPlatform>;
  targetPct: number;
  referenceBookColumns: string[];
  inSlip: boolean;
  slipFull: boolean;
  onToggleSlip: () => void;
  onExpand: () => void;
  isExpanded: boolean;
}) {
  const { pillStyle, textClass } = hitCellStyle(prop.fairPct, targetPct);
  const slipEv = legEvPctVsSlip(defaultSlip, prop.fairProb);
  const sportMeta = SPORT_BADGE[prop.sport] ?? { label: prop.sport.toUpperCase(), color: "text-muted-foreground/50" };

  const bestBook = referenceBookColumns.reduce<{ book: string; odds: number } | null>((best, book) => {
    const odds = prop.side === "Over" ? prop.offerings[book]?.over : prop.offerings[book]?.under;
    if (odds == null) return best;
    if (best === null || odds > best.odds) return { book, odds };
    return best;
  }, null);

  // Left accent border — intensity tracks slip EV tier
  const accentColor = slipEv >= 3
    ? "rgba(58, 120, 200, 0.9)"
    : slipEv >= 0
    ? "rgba(58, 120, 200, 0.5)"
    : "rgba(239, 68, 68, 0.25)";

  return (
    <div
      className={["rounded-xl border transition-colors overflow-hidden",
        isExpanded ? "bg-card border-blue-400/20" : "bg-card/80 border-border/60"].join(" ")}
      style={{ borderLeft: `3px solid ${accentColor}` }}
    >
      {/* Main tap area */}
      <div className="p-4 cursor-pointer" onClick={onExpand}>
        {/* Top row: pill + player name + market label + add button */}
        <div className="flex items-start gap-3 mb-2">
          <span className={`inline-flex items-center justify-center rounded-lg font-mono text-sm font-bold px-2.5 py-1.5 min-w-[64px] shrink-0 mt-0.5 ${textClass}`} style={pillStyle}>
            {prop.fairPct.toFixed(1)}%
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-base leading-tight tracking-tight truncate">{prop.player}</p>
            {/* Market in caps — own line, Upside style */}
            <p className="text-[11px] font-semibold tracking-widest text-muted-foreground/50 uppercase mt-0.5">
              {cleanMarket(prop.market)}
            </p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSlip(); }}
            disabled={!inSlip && slipFull}
            className={["inline-flex items-center justify-center h-7 w-7 rounded-lg border transition-all shrink-0 mt-0.5",
              inSlip ? "border-blue-400/50 text-blue-400 bg-blue-400/10"
                : slipFull ? "border-border/30 text-muted-foreground/20 cursor-not-allowed"
                : "border-border text-muted-foreground"].join(" ")}
          >
            {inSlip ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Second row: side/line + matchup + platform odds */}
        <div className="flex items-start justify-between gap-2 pl-[76px]">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground/70">
              <span className={prop.side === "Over" ? "text-blue-400/80" : "text-red-400/80"}>{prop.side}</span>
              {" "}{prop.line}
            </p>
            <p className="text-[11px] text-muted-foreground/40 mt-0.5 truncate">
              {prop.matchup}
              {prop.sport && <span className={`ml-1.5 ${sportMeta.color}`}>· {sportMeta.label}</span>}
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className="flex items-center gap-1.5 justify-end">
              <BookLogo book={platformConfig.label} size="sm" />
              <span className="font-mono text-sm font-semibold">{formatOdds(legTargetAmerican(defaultSlip))}</span>
            </div>
            {bestBook && (
              <p className="text-[11px] text-muted-foreground/50 font-mono mt-0.5">
                Best {formatOdds(bestBook.odds)}
              </p>
            )}
          </div>
        </div>

        {/* Slip EV */}
        <div className="pl-[76px] mt-2">
          <span className={`text-xs font-mono font-semibold ${slipEv >= 0 ? "text-blue-400" : "text-muted-foreground/50"}`}>
            Slip EV {slipEv > 0 ? "+" : ""}{slipEv.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="border-t border-border/60 px-4 pb-4 pt-3 space-y-4">

          {/* Slip breakdown */}
          <SlipBreakdown
            fairProb={prop.fairProb}
            platformSlipPlatform={platformConfig.slipPlatform}
            platformLabel={platformConfig.label}
          />

          {/* Metadata row */}
          <div className="flex items-center gap-6 text-xs flex-wrap">
            <div>
              <p className="text-muted-foreground/50 uppercase tracking-wider mb-0.5">Fair</p>
              <p className="font-mono font-medium">{prop.fairPct.toFixed(1)}% / {formatOdds(probToAmerican(prop.fairProb))}</p>
            </div>
            {prop.gameTime && (
              <div>
                <p className="text-muted-foreground/50 uppercase tracking-wider mb-0.5">Game Time</p>
                <p className="font-mono">{formatGameTime(prop.gameTime)}</p>
              </div>
            )}
            {prop.matchup && (
              <div>
                <p className="text-muted-foreground/50 uppercase tracking-wider mb-0.5">Matchup</p>
                <p className="font-mono">{prop.matchup}</p>
              </div>
            )}
          </div>

          {/* Reference books horizontal scroll */}
          <div>
            <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest mb-2">Reference Books</p>
            <div className="overflow-x-auto -mx-1 px-1">
              <div className="flex gap-2 pb-1">
                {/* Playing chip */}
                <div className="flex-shrink-0 flex items-center gap-2 rounded-lg border border-blue-400/30 bg-blue-400/5 px-3 py-2">
                  <BookLogo book={platformConfig.label} size="sm" />
                  <span className="text-[9px] font-semibold uppercase text-blue-400">playing</span>
                  <span className="font-mono text-sm font-semibold">{formatOdds(legTargetAmerican(defaultSlip))}</span>
                  <span className={`font-mono text-xs font-semibold ${slipEv >= 0 ? "text-blue-400" : "text-muted-foreground/50"}`}>
                    {slipEv > 0 ? "+" : ""}{slipEv.toFixed(1)}%
                  </span>
                </div>
                {/* Reference book chips */}
                {referenceBookColumns.map((book) => {
                  const odds = prop.side === "Over" ? prop.offerings[book]?.over : prop.offerings[book]?.under;
                  if (odds == null) return null;
                  const ev = evPct(prop.fairProb, odds);
                  const isPositive = ev >= 0;
                  return (
                    <div key={book}
                      className="flex-shrink-0 flex items-center gap-2 rounded-lg border px-3 py-2"
                      style={isPositive ? {
                        borderColor: "rgba(90, 154, 224, 0.40)",
                        backgroundColor: "rgba(58, 120, 200, 0.22)",
                      } : { borderColor: "rgba(255,255,255,0.08)", backgroundColor: "transparent" }}
                    >
                      <BookLogo book={getBook(book).label} size="sm" />
                      <span className={`font-mono text-sm ${isPositive ? "text-white font-bold" : "text-muted-foreground"}`}>{formatOdds(odds)}</span>
                      <span className={`font-mono text-xs font-bold ${isPositive ? "text-[#B0C8E0]" : "text-muted-foreground/50"}`}>
                        {ev > 0 ? "+" : ""}{ev.toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── MobileTopBar ──────────────────────────────────────────────────────────
function MobileTopBar({ platform, setPlatformRaw, selectedSport, setSelectedSport, searchQuery, setSearchQuery, minHitPct, setMinHitPct, showAltLines, setShowAltLines, displayedCount, slipLegKeys, onOpenSlip, hasActiveFilters, onClearFilters, marketOptions, selectedMarket, onSelectMarket }: {
  platform: PlatformId;
  setPlatformRaw: (p: PlatformId) => void;
  selectedSport: string | null;
  setSelectedSport: (s: string | null) => void;
  searchQuery: string;
  setSearchQuery: (s: string) => void;
  minHitPct: number;
  setMinHitPct: (n: number) => void;
  showAltLines: boolean;
  setShowAltLines: (b: boolean) => void;
  displayedCount: number;
  slipLegKeys: string[];
  onOpenSlip: () => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  marketOptions: MarketOption[];
  selectedMarket: string | null;
  onSelectMarket: (m: string | null) => void;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <div className="sticky top-0 z-30 bg-background border-b border-border">
      {/* Row 1: Logo + count + slip button */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <Logo size={18} />
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground tabular-nums">
            <span className="text-foreground font-medium">{displayedCount}</span> props
          </p>
          <button onClick={onOpenSlip}
            className={["flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors",
              slipLegKeys.length > 0 ? "border-blue-400/40 text-blue-400 bg-blue-400/5" : "border-border text-muted-foreground"].join(" ")}
          >
            <ListPlus className="h-3.5 w-3.5" />
            {slipLegKeys.length > 0 ? `Slip (${slipLegKeys.length})` : "Slip"}
          </button>
        </div>
      </div>

      {/* Row 2: Platform icons — always visible, primary action */}
      <div className="flex items-center gap-2.5 px-4 pb-2">
        {PLATFORMS.map((p) => {
          const isActive = platform === p.id;
          return (
            <button key={p.id} disabled={!p.available}
              onClick={() => p.available && setPlatformRaw(p.id as PlatformId)}
              title={p.label}
              className={["inline-flex items-center justify-center w-10 h-10 rounded-xl transition-all",
                isActive ? "ring-2 ring-blue-400/60 ring-offset-1 ring-offset-background opacity-100" : "opacity-55",
                !p.available ? "cursor-not-allowed opacity-25" : "cursor-pointer"].join(" ")}
            >
              <BookLogo book={PLATFORM_LOGO[p.id] ?? p.label} size="header" />
            </button>
          );
        })}
      </div>

      {/* Row 3: Sport pills + filter toggle */}
      <div className="flex items-center gap-2 px-4 pb-2">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none flex-1">
          <button onClick={() => setSelectedSport(null)}
            className={["shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors border",
              selectedSport === null ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground"].join(" ")}
          >All</button>
          {SPORTS.map((s) => (
            <button key={s.id} onClick={() => setSelectedSport(selectedSport === s.id ? null : s.id)}
              className={["shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors border",
                selectedSport === s.id ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground"].join(" ")}
            >{s.label}</button>
          ))}
        </div>
        <button onClick={() => setFiltersOpen((v) => !v)}
          className={["shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors",
            filtersOpen || hasActiveFilters ? "border-blue-400/40 text-blue-400 bg-blue-400/5" : "border-border text-muted-foreground"].join(" ")}
        >
          <SlidersHorizontal className="h-3 w-3" />
          Filters
          {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 ml-0.5" />}
        </button>
      </div>

      {/* Expandable filter panel — min%, alt lines, search only */}
      {filtersOpen && (
        <div className="px-4 pb-3 space-y-3 border-t border-border/60 pt-3">
          {/* Market filter */}
          <div className="flex items-center gap-2">
            <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest w-16 shrink-0">Market</p>
            <MarketFilterDropdown options={marketOptions} selectedMarket={selectedMarket} selectedSport={selectedSport} onSelect={onSelectMarket} />
          </div>

          {/* Min % Hit */}
          <div className="flex items-center gap-2">
            <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest w-16 shrink-0">Min Hit</p>
            <div className="flex items-center gap-1">
              {[52, 54, 56, 58].map((val) => (
                <button key={val} onClick={() => setMinHitPct(val)}
                  className={["px-3 py-1 rounded-md text-xs font-medium transition-colors border",
                    minHitPct === val ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground"].join(" ")}
                >{val}%</button>
              ))}
            </div>
          </div>

          {/* Alt Lines + clear */}
          <div className="flex items-center gap-3">
            <button onClick={() => setShowAltLines(!showAltLines)}
              className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className={["w-8 h-4 rounded-full transition-colors relative shrink-0", showAltLines ? "bg-blue-500" : "bg-muted"].join(" ")}>
                <div className={["absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform", showAltLines ? "translate-x-4" : "translate-x-0.5"].join(" ")} />
              </div>
              <span className="text-xs">Alt Lines</span>
            </button>
            {hasActiveFilters && (
              <button onClick={onClearFilters} className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors ml-auto">
                Clear all
              </button>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40 pointer-events-none" />
            <input type="text" placeholder="Players, markets..." value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 rounded-lg border border-border bg-card pl-9 pr-8 text-sm placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-border"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────
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
  const [selectedMarket, setSelectedMarket] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);
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
  useEffect(() => { setSelectedMarket(null); }, [selectedSport, platform]);

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
    () => processToFlat(markets, weights, activePlatformBooks, showAltLines),
    [markets, weights, activePlatformBooks, showAltLines],
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

  const marketOptions = useMemo((): MarketOption[] => {
    let base = allProps.filter((p) => p.fairPct >= minHitPct);
    if (selectedSport) base = base.filter((p) => p.sport === selectedSport);
    const seen = new Map<string, MarketOption>();
    for (const p of base) {
      if (!seen.has(p.market)) seen.set(p.market, { rawMarket: p.market, abbrev: cleanMarket(p.market), sport: p.sport });
    }
    return [...seen.values()].sort((a, b) => a.abbrev.localeCompare(b.abbrev));
  }, [allProps, selectedSport, minHitPct]);

  const displayed = useMemo(() => {
    let result = allProps.filter((p) => p.fairPct >= minHitPct);
    if (selectedSport) result = result.filter((p) => p.sport === selectedSport);
    if (selectedMarket) result = result.filter((p) => p.market === selectedMarket);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((p) =>
        p.player.toLowerCase().includes(q) || p.market.toLowerCase().includes(q) ||
        p.team?.toLowerCase().includes(q) || p.matchup.toLowerCase().includes(q)
      );
    }
    return sortDir === "asc" ? [...result].reverse() : result;
  }, [allProps, searchQuery, sortDir, selectedSport, selectedMarket, minHitPct]);

  const slipKeys = useMemo(() => new Set(slipLegKeys), [slipLegKeys]);
  const slipFull = slipLegKeys.length >= 6;

  const slipLegs = useMemo((): SlipLeg[] =>
    slipLegKeys.map((key) => {
      const prop = allProps.find((p) => p.key === key);
      if (!prop) return null;
      return { key, player: prop.player, market: prop.market, line: prop.line, side: prop.side, fairProb: prop.fairProb };
    }).filter((l): l is SlipLeg => l !== null),
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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (cmdkOpen) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowDown") { e.preventDefault(); setFocusedIndex((i) => Math.min(i + 1, displayed.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setFocusedIndex((i) => Math.max(i - 1, 0)); }
      else if (e.key === "Enter" && focusedIndex >= 0) {
        e.preventDefault();
        const prop = displayed[focusedIndex];
        if (prop) setExpanded((exp) => (exp === prop.key ? null : prop.key));
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (expanded) setExpanded(null); else setFocusedIndex(-1);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [cmdkOpen, displayed, focusedIndex, expanded]);

  const hasActiveFilters = minHitPct !== 52 || showAltLines || !!searchQuery || !!selectedSport || !!selectedMarket;
  const clearFilters = () => { setMinHitPct(52); setShowAltLines(false); setSearchQuery(""); setSelectedSport(null); setSelectedMarket(null); };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <>
      {/* ══════════════════════════════════════════════════════════
          MOBILE LAYOUT  (< md)
      ══════════════════════════════════════════════════════════ */}
      <div className="md:hidden flex flex-col h-screen bg-background overflow-hidden">
        <MobileTopBar
          platform={platform as PlatformId}
          setPlatformRaw={(p) => setPlatformRaw(p)}
          selectedSport={selectedSport}
          setSelectedSport={setSelectedSport}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          minHitPct={minHitPct}
          setMinHitPct={setMinHitPct}
          showAltLines={showAltLines}
          setShowAltLines={setShowAltLines}
          displayedCount={displayed.length}
          slipLegKeys={slipLegKeys}
          onOpenSlip={() => setSlipOpen(true)}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearFilters}
          marketOptions={marketOptions}
          selectedMarket={selectedMarket}
          onSelectMarket={setSelectedMarket}
        />

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
          {displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-12 h-12 rounded-full bg-card border border-border flex items-center justify-center">
                <Search className="h-5 w-5 text-muted-foreground/50" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">No props found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {markets.length === 0 ? "Run pipeline.py to generate data" : "Try lowering Min % Hit or clearing filters"}
                </p>
              </div>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">Clear filters</button>
              )}
            </div>
          ) : displayed.map((prop) => (
            <PropCard
              key={prop.key}
              prop={prop}
              platformConfig={platformConfig}
              defaultSlip={defaultSlip}
              targetPct={targetPct}
              referenceBookColumns={referenceBookColumns}
              inSlip={slipKeys.has(prop.key)}
              slipFull={slipFull}
              onToggleSlip={() => toggleSlipLeg(prop.key)}
              onExpand={() => setExpanded(expanded === prop.key ? null : prop.key)}
              isExpanded={expanded === prop.key}
            />
          ))}
          {/* Bottom padding so last card clears any sticky elements */}
          <div className="h-4" />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          DESKTOP LAYOUT  (≥ md)
      ══════════════════════════════════════════════════════════ */}
      <div className="hidden md:flex h-screen overflow-hidden bg-background">

        <aside className="w-[220px] shrink-0 border-r border-border bg-card flex flex-col overflow-y-auto">
          <div className="px-4 pt-5 pb-4 border-b border-border"><Logo size={22} /></div>
          <div className="px-3 pt-4 pb-2">
            <p className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-widest px-1 mb-1.5">Sport</p>
            <button onClick={() => setSelectedSport(null)}
              className={["w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors",
                selectedSport === null ? "bg-accent text-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"].join(" ")}
            >All Sports</button>
            {SPORTS.map((s) => (
              <button key={s.id} onClick={() => setSelectedSport(selectedSport === s.id ? null : s.id)}
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
                  <button key={p.id} disabled={!p.available} onClick={() => p.available && setPlatformRaw(p.id)} title={p.label}
                    className={["inline-flex items-center justify-center w-10 h-10 rounded-xl transition-all",
                      isActive ? "ring-2 ring-blue-400/60 ring-offset-1 ring-offset-card opacity-100" : "opacity-60 hover:opacity-85",
                      !p.available ? "cursor-not-allowed opacity-30 hover:opacity-30" : "cursor-pointer"].join(" ")}
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
              className="w-full flex items-center justify-between text-sm text-muted-foreground hover:text-foreground transition-colors">
              <span>Alt Lines</span>
              <div className={["w-8 h-4 rounded-full transition-colors relative", showAltLines ? "bg-blue-500" : "bg-muted"].join(" ")}>
                <div className={["absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform", showAltLines ? "translate-x-4" : "translate-x-0.5"].join(" ")} />
              </div>
            </button>
          </div>

          <div className="mt-auto border-t border-border">
            {hasActiveFilters && (
              <div className="px-4 pt-3 pb-1">
                <button onClick={clearFilters} className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors">Clear all filters</button>
              </div>
            )}
            {updatedAt && (
              <div className="px-4 py-3">
                <p className="text-[10px] text-muted-foreground/40">Updated {relativeTime(updatedAt)}</p>
              </div>
            )}
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-0.5 rounded-lg bg-card border border-border p-0.5">
                <Link href="/scanner" className={["px-3 py-1 rounded-md text-sm transition-colors",
                  pathname === "/scanner" ? "bg-background border border-border text-foreground font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"].join(" ")} style={{display:"none"}}>Scanner</Link>
                <Link href="/board" className={["px-3 py-1 rounded-md text-sm transition-colors",
                  pathname === "/board" ? "bg-background border border-border text-foreground font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"].join(" ")}>Board</Link>
              </div>
              <MarketFilterDropdown options={marketOptions} selectedMarket={selectedMarket} selectedSport={selectedSport} onSelect={setSelectedMarket} />
              <p className="text-sm text-muted-foreground tabular-nums">
                <span className="text-foreground font-medium">{displayed.length}</span> props
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setCmdkOpen(true)}
                className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded border border-border text-xs text-muted-foreground hover:text-foreground transition-colors">
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
                      <div className="flex justify-end"><BookLogo book={platformConfig.label} size="header" /></div>
                    </TableHead>
                    <TableHead className="text-right">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button onClick={() => setSortDir(d => d === "desc" ? "asc" : "desc")}
                              className="inline-flex items-center gap-1 ml-auto hover:text-foreground transition-colors">
                              % Hit
                              {sortDir === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-[200px] text-xs">
                            Fair hit probability devigged from exchange consensus. Blue = above slip break-even.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                    {referenceBookColumns.map((book) => (
                      <TableHead key={book} className="text-right">
                        <div className="flex justify-end"><BookLogo book={getBook(book).label} size="header" /></div>
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
                              {markets.length === 0 ? "Run pipeline.py to generate opportunities.json" : "Try lowering the min % Hit or clearing your search"}
                            </p>
                          </div>
                          {hasActiveFilters && (
                            <button onClick={clearFilters} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">Clear all filters</button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : displayed.map((prop, idx) => {
                    const { pillStyle, textClass } = hitCellStyle(prop.fairPct, targetPct);
                    const inSlip = slipKeys.has(prop.key);
                    const isExpanded = expanded === prop.key;
                    const isFocused = idx === focusedIndex;
                    const sportMeta = SPORT_BADGE[prop.sport] ?? { label: prop.sport.toUpperCase(), color: "text-muted-foreground/50" };
                    const bestBook = referenceBookColumns.reduce<{ book: string; odds: number } | null>(
                      (best, book) => {
                        const odds = prop.side === "Over" ? prop.offerings[book]?.over : prop.offerings[book]?.under;
                        if (odds == null) return best;
                        if (best === null || odds > best.odds) return { book, odds };
                        return best;
                      }, null
                    );
                    const slipEv = legEvPctVsSlip(defaultSlip, prop.fairProb);
                    return (
                      <React.Fragment key={prop.key}>
                        <TableRow
                          className={["cursor-pointer border-border hover:bg-accent h-24 group",
                            isFocused ? "ring-1 ring-inset ring-blue-400/40 bg-accent/20" : ""].join(" ")}
                          onClick={() => { setFocusedIndex(idx); setExpanded(isExpanded ? null : prop.key); }}
                        >
                          <TableCell className="py-0 pl-3">
                            <span className={`transition-opacity ${isExpanded ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                              {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                            </span>
                          </TableCell>
                          <TableCell className="py-0">
                            <div className="font-semibold text-base leading-tight tracking-tight">{prop.player}</div>
                            <div className="text-[11px] text-muted-foreground/60 mt-1 leading-tight">
                              {[prop.team, prop.matchup].filter(Boolean).join(" · ")}
                              {prop.sport && <span className={`ml-1.5 ${sportMeta.color}`}>· {sportMeta.label}</span>}
                            </div>
                          </TableCell>
                          <TableCell className="py-0">
                            <span className={`text-sm font-medium ${prop.side === "Over" ? "text-blue-400/80" : "text-red-400/80"}`}>{prop.side}</span>
                          </TableCell>
                          <TableCell className="font-mono text-sm py-0 text-muted-foreground">{prop.line}</TableCell>
                          <TableCell className="py-0 max-w-[140px]">
                            <span className="text-sm text-muted-foreground/60 truncate block" title={cleanMarket(prop.market)}>{cleanMarket(prop.market)}</span>
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold text-sm py-0">
                            {formatOdds(legTargetAmerican(defaultSlip))}
                          </TableCell>
                          <TableCell className="text-right py-0">
                            <div className="flex justify-end pr-1">
                              <span className={`inline-flex items-center justify-center rounded-md font-mono text-sm px-3 py-2 min-w-[72px] ${textClass}`} style={pillStyle}>
                                {prop.fairPct.toFixed(1)}%
                              </span>
                            </div>
                          </TableCell>
                          {referenceBookColumns.map((book) => {
                            const odds = prop.side === "Over" ? prop.offerings[book]?.over : prop.offerings[book]?.under;
                            const isBest = bestBook?.book === book && odds != null;
                            return (
                              <TableCell key={book} className="text-right font-mono text-sm py-0 transition-colors"
                                style={isBest ? { backgroundColor: "rgba(42, 93, 156, 0.75)", borderLeft: "3px solid rgba(90, 154, 224, 1)", boxShadow: "inset 0 0 28px rgba(42, 93, 156, 0.5)" } : undefined}
                              >
                                {odds != null ? (
                                  <div className="flex flex-col items-end leading-tight pr-1">
                                    {isBest && <span className="text-[8px] font-bold uppercase tracking-wide mb-0.5 text-[#B0C8E0]">BEST</span>}
                                    <span className={isBest ? "text-white font-bold text-base" : "text-muted-foreground"}>{formatOdds(odds)}</span>
                                  </div>
                                ) : <span className="text-muted-foreground/20">—</span>}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center py-0" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => toggleSlipLeg(prop.key)} disabled={!inSlip && slipFull}
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
                            <TableCell colSpan={8 + referenceBookColumns.length} className="px-8 py-6">
                              <div className="flex items-start gap-10 flex-wrap">
                                <SlipBreakdown fairProb={prop.fairProb} platformSlipPlatform={platformConfig.slipPlatform} platformLabel={platformConfig.label} />
                                <div className="w-px self-stretch bg-border hidden sm:block" />
                                <div className="flex-1 min-w-0 space-y-5">
                                  <div className="flex items-center gap-10 flex-wrap">
                                    <div>
                                      <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-1">Fair</p>
                                      <p className="font-mono text-sm font-medium">{prop.fairPct.toFixed(1)}% / {formatOdds(probToAmerican(prop.fairProb))}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-1">Matchup</p>
                                      <p className="font-mono text-sm">{prop.matchup || "—"}</p>
                                    </div>
                                    {prop.gameTime && (
                                      <div>
                                        <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-1">Game Time</p>
                                        <p className="font-mono text-sm">{formatGameTime(prop.gameTime)}</p>
                                      </div>
                                    )}
                                    <div>
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-1 cursor-default">Slip EV</p>
                                          </TooltipTrigger>
                                          <TooltipContent side="top" className="max-w-[240px] text-xs">
                                            Edge vs. {defaultSlip.picks}-pick {defaultSlip.variant} break-even ({(legBreakEvenProbability(defaultSlip) * 100).toFixed(1)}%). Positive = profitable leg.
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                      <p className={`font-mono text-sm font-semibold ${slipEv >= 0 ? "text-blue-400" : "text-muted-foreground"}`}>
                                        {slipEv > 0 ? "+" : ""}{slipEv.toFixed(2)}%
                                      </p>
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest mb-2">Reference Books</p>
                                    <div className="flex items-stretch rounded-lg border border-border bg-card/40 overflow-hidden w-full">
                                      <div className="flex items-center gap-2.5 px-4 py-3 bg-blue-400/5 flex-shrink-0">
                                        <BookLogo book={platformConfig.label} size="sm" />
                                        <span className="text-[9px] font-semibold uppercase text-blue-400">playing</span>
                                        <span className="font-mono text-sm font-semibold">{formatOdds(legTargetAmerican(defaultSlip))}</span>
                                        <span className={`font-mono text-xs font-semibold ${slipEv >= 0 ? "text-blue-400" : "text-muted-foreground/50"}`}>
                                          {slipEv > 0 ? "+" : ""}{slipEv.toFixed(1)}%
                                        </span>
                                      </div>
                                      {referenceBookColumns.map((book) => {
                                        const odds = prop.side === "Over" ? prop.offerings[book]?.over : prop.offerings[book]?.under;
                                        if (odds == null) return null;
                                        const ev = evPct(prop.fairProb, odds);
                                        const isPositive = ev >= 0;
                                        return (
                                          <div key={book} className="flex-1 flex items-center justify-center gap-2.5 px-3 py-3 border-l border-border"
                                            style={isPositive ? { backgroundColor: "rgba(58, 120, 200, 0.22)", borderLeft: "1px solid rgba(90, 154, 224, 0.40)" } : undefined}
                                          >
                                            <BookLogo book={getBook(book).label} size="sm" />
                                            <span className={`font-mono text-sm ${isPositive ? "text-white font-bold" : "text-muted-foreground"}`}>{formatOdds(odds)}</span>
                                            <span className={`font-mono text-xs font-bold ${isPositive ? "text-[#B0C8E0]" : "text-muted-foreground/50"}`}>
                                              {ev > 0 ? "+" : ""}{ev.toFixed(1)}%
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
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

        {/* Cmd+K */}
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
                    <ArrowUpDown className="h-3.5 w-3.5 mr-2 text-muted-foreground" />Toggle sort — {sortDir === "desc" ? "highest first" : "lowest first"}
                  </CommandItem>
                  <CommandItem onSelect={() => { setShowAltLines(!showAltLines); setCmdkOpen(false); }}>
                    <ArrowUpDown className="h-3.5 w-3.5 mr-2 text-muted-foreground" />{showAltLines ? "Hide" : "Show"} alt lines
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

      {/* SlipBuilder — shared across both layouts */}
      <SlipBuilder
        open={slipOpen}
        onCloseAction={() => setSlipOpen(false)}
        legs={slipLegs}
        onRemoveLegAction={(key) => setSlipLegKeys((prev) => prev.filter((k) => k !== key))}
        onClearAllAction={() => setSlipLegKeys([])}
        platform={platformConfig}
      />
    </>
  );
}