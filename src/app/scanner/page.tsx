"use client";

import { useState, useMemo, useEffect, useRef, Fragment, Suspense } from "react";
import { useQueryState, parseAsStringLiteral } from "nuqs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem,
  CommandList, CommandSeparator,
} from "@/components/ui/command";
import { ChevronDown, ChevronRight, Check, Plus, ListPlus, Search, X, ArrowUpDown, ArrowUp, ArrowDown, Command as CommandIcon } from "lucide-react";
import { BookLogo } from "@/components/book-logo";
import { SlipBuilder, type SlipLeg } from "@/components/slip-builder";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { hitCellStyle, expandedRowStyle } from "@/lib/hit-cell";
import { consensusFairProb, evPct, probToAmerican, type WeightMap } from "@/lib/devig";
import { BOOKS, getBook, isReferenceBook } from "@/lib/books";
import { useBookWeights } from "@/lib/book-weights";
import {
  getSlipById, getDefaultSlipForPlatform, groupedSlipTypes,
  legBreakEvenProbability, legEvPctVsSlip, legTargetAmerican,
} from "@/lib/slip-types";
import {
  PLATFORMS, getPlatformById, DEFAULT_PLATFORM_ID, type PlatformId,
} from "@/lib/platforms";
import { Logo } from "@/components/Logo";

type BookSideOdds = { over: number | null; under: number | null; line?: number; type?: string };
type Offerings = Record<string, BookSideOdds>;
type MarketRow = {
  playerId: string; player: string; team?: string; matchup?: string;
  gameTime?: string; market: string; line: number; sport?: string; offerings: Offerings;
};
type PipelinePayload = { updated: string; source: string; markets: MarketRow[] };
type Play = {
  key: string; player: string; team?: string; matchup?: string;
  market: string; line: number; side: "Over" | "Under";
  fairProb: number; fairPct: number; fairOdds: number;
  platformBook: string; platformOdds: number;
  offerings: Offerings; slipId?: string;
  slip?: ReturnType<typeof getSlipById>; slipEv?: number;
};

function processMarkets(markets: MarketRow[], weights: WeightMap, activePlatformBooks: string[], showAltLines: boolean): Play[] {
  const plays: Play[] = [];
  for (const market of markets) {
    const { fairOver } = consensusFairProb(market.offerings, weights);
    if (fairOver == null) continue;
    for (const side of ["Over", "Under"] as const) {
      const fairProb = side === "Over" ? fairOver : 1 - fairOver;
      let platformBook: string | null = null;
      let platformOdds: number | null = null;
      for (const book of activePlatformBooks) {
        const offering = market.offerings[book];
        const odds = side === "Over" ? offering?.over : offering?.under;
        if (odds != null) { platformBook = book; platformOdds = odds; break; }
      }
      if (!platformBook || platformOdds == null) continue;
      const offeringType = market.offerings[platformBook]?.type;
      if (!showAltLines && offeringType === "goblin") continue;
      if (!showAltLines && offeringType === "demon") continue;
      plays.push({
        key: `${market.playerId}|${market.market}|${market.line}|${side}`,
        player: market.player, team: market.team, matchup: market.matchup,
        market: market.market, line: market.line, side, fairProb,
        fairPct: fairProb * 100, fairOdds: probToAmerican(fairProb),
        platformBook, platformOdds,
        offerings: market.offerings,
      });
    }
  }
  return plays;
}

const MARKET_ABBREV: Record<string, string> = {
  "Points": "Pts", "Rebounds": "Reb", "Assists": "Ast", "Threes Made": "3PM",
  "Steals": "Stl", "Blocks": "Blk", "Turnovers": "TO",
  "Points + Rebounds": "Pts+Reb", "Points + Assists": "Pts+Ast",
  "Rebounds + Assists": "Reb+Ast", "Points + Rebounds + Assists": "Pts+Reb+Ast",
  "Pitcher Strikeouts": "K", "Hits": "H", "Home Runs": "HR", "RBIs": "RBI",
  "Runs": "R", "Walks": "BB", "Saves": "SV", "Goals": "G", "Shots on Goal": "SOG",
  "Blocked Shots": "BS", "Kills": "Kills", "1st 2 Maps Kills": "K (2M)",
};

const cleanMarket = (m: string) => MARKET_ABBREV[m.replace("Player ", "")] ?? m.replace("Player ", "");
const formatOdds = (n: number) => n > 0 ? `+${n}` : `${n}`;
const evColor = (ev: number) => ev >= 3 ? "text-blue-400" : ev >= 0 ? "text-yellow-400" : "text-muted-foreground";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const SPORTS = [
  { id: "nba", label: "NBA", available: true },
  { id: "mlb", label: "MLB", available: true },
  { id: "nfl", label: "NFL", available: true },
  { id: "nhl", label: "NHL", available: true },
  { id: "esports", label: "Esports", available: true },
];

const PLATFORM_LOGO: Record<string, string> = {
  prizepicks: "PrizePicks", underdog: "Underdog", pick6: "Pick6", betr: "Betr",
};

function SlipPicker({ selectedSlipId, onSelect, fairProb, platformFilter }: {
  selectedSlipId: string; onSelect: (id: string) => void;
  fairProb: number; platformFilter: ReturnType<typeof getPlatformById>["slipPlatform"];
}) {
  const [open, setOpen] = useState(false);
  const slip = getSlipById(selectedSlipId);
  const targetProb = legBreakEvenProbability(slip);
  const ev = legEvPctVsSlip(slip, fairProb);
  const grouped = groupedSlipTypes(platformFilter);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-accent transition-colors"
        >
          <span className="font-medium text-sm">{slip.platformLabel} {slip.picks}P {slip.variant}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground/60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start" onClick={(e) => e.stopPropagation()}>
        <Command>
          <CommandInput placeholder="Search slip types..." className="h-9" />
          <CommandList>
            <CommandEmpty>No slip type found.</CommandEmpty>
            {grouped.map((pg, pIdx) => (
              <Fragment key={pg.platform}>
                {pIdx > 0 && <CommandSeparator />}
                {pg.variants.map((vg) => (
                  <CommandGroup key={`${pg.platform}-${vg.variant}`} heading={`${pg.platform} ${vg.variant}`}>
                    {vg.slips.map((s) => {
                      const sTarget = legBreakEvenProbability(s);
                      const isSelected = s.id === selectedSlipId;
                      return (
                        <CommandItem key={s.id} value={`${s.platformLabel} ${s.variant} ${s.picks}`}
                          disabled={!s.available}
                          onSelect={() => { onSelect(s.id); setOpen(false); }}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            {isSelected ? <Check className="h-3.5 w-3.5 text-blue-400" /> : <span className="w-3.5" />}
                            <span className="text-sm">{s.picks} Pick {s.variant}</span>
                            {s.recommended && (
                              <Badge variant="outline" className="text-[9px] h-4 px-1 border-blue-400/40 text-blue-400">BEST</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                            <span>{(sTarget * 100).toFixed(1)}%</span>
                            <span className="opacity-50">{legTargetAmerican(s)}</span>
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                ))}
              </Fragment>
            ))}
          </CommandList>
        </Command>
        <div className="border-t border-border px-3 py-2 bg-muted/30">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Target / Fair</span>
            <span className="font-mono">{(targetProb * 100).toFixed(1)}% / {(fairProb * 100).toFixed(1)}%</span>
          </div>
          <div className="flex items-center justify-between text-xs mt-1">
            <span className="text-muted-foreground">Slip EV</span>
            <span className={`font-mono font-semibold ${evColor(ev)}`}>
              {ev >= 0 ? "+" : ""}{ev.toFixed(2)}%
            </span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

const PLATFORM_IDS = PLATFORMS.map((p) => p.id) as [PlatformId, ...PlatformId[]];

export default function Home() {
  return <Suspense><HomeInner /></Suspense>;
}

function HomeInner() {
  const pathname = usePathname();
  const [markets, setMarkets] = useState<MarketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [minHitPct, setMinHitPct] = useState(52);
  const [showAltLines, setShowAltLines] = useState(false);
  const [rowSlips, setRowSlips] = useState<Record<string, string>>({});
  const [slipLegKeys, setSlipLegKeys] = useState<string[]>([]);
  const [slipOpen, setSlipOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSport, setSelectedSport] = useState("nba");
  const [sortCol, setSortCol] = useState<"fairPct" | "player" | "market">("fairPct");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [focusedIdx, setFocusedIdx] = useState<number | null>(null);
  const [cmdkOpen, setCmdkOpen] = useState(false);

  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);
  const { weights } = useBookWeights();

  const cycleSort = (col: "fairPct" | "player" | "market") => {
    if (sortCol === col) setSortDir((d) => d === "desc" ? "asc" : "desc");
    else { setSortCol(col); setSortDir(col === "fairPct" ? "desc" : "asc"); }
  };

  const [platform, setPlatformRaw] = useQueryState(
    "platform",
    parseAsStringLiteral(PLATFORM_IDS).withDefault(DEFAULT_PLATFORM_ID),
  );
  const platformConfig = getPlatformById(platform);

  useEffect(() => { setRowSlips({}); setExpanded(null); setSlipLegKeys([]); }, [platform]);

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

  const referenceBookColumns = useMemo(() => {
    const seen = new Set<string>();
    for (const m of markets) {
      for (const book of Object.keys(m.offerings)) {
        if (isReferenceBook(book)) seen.add(book);
      }
    }
    const order: Record<string, number> = { sharp: 0, exchange: 1, retail: 2 };
    return [...seen].sort((a, b) => {
      const ca = order[BOOKS[a]?.category ?? "retail"] ?? 3;
      const cb = order[BOOKS[b]?.category ?? "retail"] ?? 3;
      return ca - cb;
    });
  }, [markets]);

  const activePlatformBooks = useMemo(
    () => showAltLines ? platformConfig.books : platformConfig.primaryBooks,
    [platformConfig, showAltLines],
  );

  const plays = useMemo(
    () => processMarkets(
      markets.filter((m) => !m.sport || m.sport === selectedSport),
      weights, activePlatformBooks, showAltLines,
    ),
    [markets, weights, activePlatformBooks, selectedSport, showAltLines],
  );

  const playsWithSlipEv = useMemo(() => {
    return plays.map((p) => {
      const defaultSlip = getDefaultSlipForPlatform(platformConfig.slipPlatform);
      const slipId = rowSlips[p.key] ?? defaultSlip.id;
      const slip = getSlipById(slipId);
      const slipEv = legEvPctVsSlip(slip, p.fairProb);
      return { ...p, slipId, slip, slipEv };
    }).sort((a, b) => b.fairPct - a.fairPct);
  }, [plays, rowSlips, platformConfig]);

  const gameDates = useMemo(() => {
    const seen = new Set<string>();
    for (const m of markets) {
      if (m.gameTime) {
        const d = new Date(m.gameTime).toLocaleDateString("en-US", { month: "short", day: "numeric" });
        seen.add(d);
      }
    }
    return [...seen].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  }, [markets]);

  const displayed = useMemo(() => {
    let result = playsWithSlipEv.filter((p) => p.fairPct >= minHitPct);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((p) =>
        p.player.toLowerCase().includes(q) ||
        p.market.toLowerCase().includes(q) ||
        p.team?.toLowerCase().includes(q)
      );
    }
    if (selectedDate) {
      result = result.filter((p) => {
        const market = markets.find((m) => m.playerId === p.key.split("|")[0]);
        if (!market?.gameTime) return false;
        const d = new Date(market.gameTime).toLocaleDateString("en-US", { month: "short", day: "numeric" });
        return d === selectedDate;
      });
    }
    return [...result].sort((a, b) => {
      if (sortCol === "player") return sortDir === "asc" ? a.player.localeCompare(b.player) : b.player.localeCompare(a.player);
      if (sortCol === "market") return sortDir === "asc" ? cleanMarket(a.market).localeCompare(cleanMarket(b.market)) : cleanMarket(b.market).localeCompare(cleanMarket(a.market));
      return sortDir === "asc" ? a.fairPct - b.fairPct : b.fairPct - a.fairPct;
    });
  }, [playsWithSlipEv, minHitPct, searchQuery, selectedDate, markets, sortDir, sortCol]);

  const positiveCount = playsWithSlipEv.filter((p) => p.slipEv! > 0).length;
  const setSlipForRow = (key: string, slipId: string) => setRowSlips((prev) => ({ ...prev, [key]: slipId }));

  const slipLegs = useMemo((): SlipLeg[] =>
    slipLegKeys
      .map((key) => playsWithSlipEv.find((p) => p.key === key))
      .filter((p): p is NonNullable<typeof p> => p != null)
      .map((p) => ({ key: p.key, player: p.player, market: p.market, line: p.line, side: p.side, fairProb: p.fairProb })),
    [slipLegKeys, playsWithSlipEv],
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
    if (focusedIdx !== null && rowRefs.current[focusedIdx]) {
      rowRefs.current[focusedIdx]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [focusedIdx]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setCmdkOpen(true); return; }
      if (cmdkOpen) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowDown") { e.preventDefault(); setFocusedIdx((prev) => prev === null ? 0 : Math.min(prev + 1, displayed.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setFocusedIdx((prev) => prev === null ? 0 : Math.max(prev - 1, 0)); }
      else if (e.key === "Enter" && focusedIdx !== null) { e.preventDefault(); const play = displayed[focusedIdx]; if (play) setExpanded((prev) => prev === play.key ? null : play.key); }
      else if (e.key === "Escape") { e.preventDefault(); if (expanded) setExpanded(null); else setFocusedIdx(null); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [displayed, focusedIdx, expanded, cmdkOpen]);

  const totalCols = 7 + referenceBookColumns.length;

  if (loading) {
    return (
      <main className="min-h-screen bg-background p-6 flex items-center justify-center">
        <p className="text-muted-foreground">Loading opportunities...</p>
      </main>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">

      {/* ── Sidebar ── */}
      <aside className="w-[220px] shrink-0 border-r border-border bg-card flex flex-col overflow-y-auto">

        <div className="px-4 pt-5 pb-4 border-b border-border">
          <Logo size="md" />
        </div>

        <div className="px-3 pt-4 pb-2">
          <p className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-widest px-1 mb-1.5">Sport</p>
          {SPORTS.map((s) => (
            <button key={s.id} disabled={!s.available}
              onClick={() => s.available && setSelectedSport(s.id)}
              className={["w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors",
                selectedSport === s.id && s.available ? "bg-accent text-foreground font-medium"
                  : s.available ? "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  : "text-muted-foreground/30 cursor-not-allowed"].join(" ")}
            >
              {s.label}
              {!s.available && <span className="text-[9px] uppercase tracking-wider opacity-50">soon</span>}
            </button>
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

        {gameDates.length > 0 && (
          <div className="px-3 pt-3 pb-2 border-t border-border mt-2">
            <p className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-widest px-1 mb-1.5">Date</p>
            <div className="px-1 space-y-0.5">
              <button onClick={() => setSelectedDate(null)} className={["w-full text-left px-2 py-1 rounded-md text-sm transition-colors", selectedDate === null ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"].join(" ")}>All dates</button>
              {gameDates.map((d) => (
                <button key={d} onClick={() => setSelectedDate(d === selectedDate ? null : d)} className={["w-full text-left px-2 py-1 rounded-md text-sm transition-colors", selectedDate === d ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"].join(" ")}>{d}</button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-auto border-t border-border">
          {(minHitPct !== 52 || showAltLines || searchQuery || selectedDate) && (
            <div className="px-4 pt-3 pb-1">
              <button
                onClick={() => { setMinHitPct(52); setShowAltLines(false); setSearchQuery(""); setSelectedDate(null); }}
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
              Showing <span className="text-foreground font-medium">{displayed.length}</span>
              <span className="mx-1.5 text-muted-foreground/30">·</span>
              {positiveCount} +EV
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
          <TooltipProvider delayDuration={300}>
            <Table>
              <TableHeader className="sticky top-0 z-20 bg-background border-b border-border">
                <TableRow className="hover:bg-transparent h-14">
                  <TableHead className="w-8" />
                  <TableHead>
                    <button onClick={() => cycleSort("player")} className="inline-flex items-center gap-1 hover:text-foreground transition-colors group">
                      <span>Player</span>
                      {sortCol === "player" ? sortDir === "desc" ? <ArrowDown className="h-3 w-3 text-blue-400" /> : <ArrowUp className="h-3 w-3 text-blue-400" /> : <ArrowUpDown className="h-3 w-3 text-muted-foreground/30 group-hover:text-muted-foreground" />}
                    </button>
                  </TableHead>
                  <TableHead>Bet</TableHead>
                  <TableHead>Line</TableHead>
                  <TableHead>
                    <button onClick={() => cycleSort("market")} className="inline-flex items-center gap-1 hover:text-foreground transition-colors group">
                      <span>Market</span>
                      {sortCol === "market" ? sortDir === "desc" ? <ArrowDown className="h-3 w-3 text-blue-400" /> : <ArrowUp className="h-3 w-3 text-blue-400" /> : <ArrowUpDown className="h-3 w-3 text-muted-foreground/30 group-hover:text-muted-foreground" />}
                    </button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex justify-end cursor-help">
                          <BookLogo book={platformConfig.label} size="header" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[220px] text-xs">
                        Per-leg break-even odds for your selected slip type.
                      </TooltipContent>
                    </Tooltip>
                  </TableHead>
                  <TableHead className="text-right">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button onClick={() => cycleSort("fairPct")} className="inline-flex items-center gap-1 ml-auto hover:text-foreground transition-colors group">
                          <span>% Hit</span>
                          {sortCol === "fairPct" ? sortDir === "desc" ? <ArrowDown className="h-3 w-3 text-blue-400" /> : <ArrowUp className="h-3 w-3 text-blue-400" /> : <ArrowUpDown className="h-3 w-3 text-muted-foreground/30 group-hover:text-muted-foreground" />}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[220px] text-xs">
                        Fair probability this leg hits, devigged from exchange prices.
                      </TooltipContent>
                    </Tooltip>
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
                {displayed.length === 0 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={totalCols} className="py-20">
                      <div className="flex flex-col items-center justify-center gap-3 text-center">
                        {markets.length === 0 ? (
                          <>
                            <div className="w-12 h-12 rounded-full bg-card border border-border flex items-center justify-center">
                              <span className="text-2xl">📭</span>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">No data loaded</p>
                              <p className="text-xs text-muted-foreground mt-1">Run <code className="font-mono bg-card px-1.5 py-0.5 rounded border border-border">pipeline.py</code> to generate opportunities.json</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="w-12 h-12 rounded-full bg-card border border-border flex items-center justify-center">
                              <Search className="h-5 w-5 text-muted-foreground/50" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">No plays match</p>
                              <p className="text-xs text-muted-foreground mt-1">Try lowering the min % Hit filter or clearing your search</p>
                            </div>
                            <button onClick={() => { setMinHitPct(52); setSearchQuery(""); setSelectedDate(null); }}
                              className="text-xs text-blue-400 hover:text-blue-300 transition-colors mt-1"
                            >Clear all filters</button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {displayed.map((play, idx) => {
                  const isExpanded = expanded === play.key;
                  const isFocused = focusedIdx === idx;
                  const targetPct = legBreakEvenProbability(play.slip!) * 100;
                  const { pillStyle, textClass: hitTextClass } = hitCellStyle(play.fairPct, targetPct);
                  const expandedBg = expandedRowStyle(play.fairPct, targetPct);
                  const isAbove = play.fairPct >= targetPct;
                  const accentBg   = isAbove ? "bg-blue-400/5"  : "bg-red-400/5";
                  const accentText = isAbove ? "text-blue-400"   : "text-red-400";

                  const bestRefBook = referenceBookColumns.reduce<{ book: string; odds: number } | null>(
                    (best, book) => {
                      const o = play.offerings[book];
                      const odds = play.side === "Over" ? o?.over : o?.under;
                      if (odds == null) return best;
                      if (best === null || odds > best.odds) return { book, odds };
                      return best;
                    }, null
                  );

                  return (
                    <Fragment key={play.key}>
                      <TableRow
                        ref={(el) => { rowRefs.current[idx] = el; }}
                        className={["cursor-pointer border-border hover:bg-accent h-24 group",
                          isFocused ? "bg-accent ring-1 ring-inset ring-blue-400/30" : ""].join(" ")}
                        onClick={() => { setExpanded(isExpanded ? null : play.key); setFocusedIdx(idx); }}
                      >
                        <TableCell className="py-0 pl-3">
                          <span className={`transition-opacity ${isExpanded ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                            {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                          </span>
                        </TableCell>
                        <TableCell className="py-0">
                          <div className="font-semibold text-base leading-tight tracking-tight">{play.player}</div>
                          {(play.team || play.matchup) && (
                            <div className="text-xs text-muted-foreground/40 mt-1 leading-tight">
                              {[play.team, play.matchup].filter(Boolean).join(" · ")}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="py-0">
                          <span className={`text-sm font-medium ${play.side === "Over" ? "text-blue-400/80" : "text-red-400/80"}`}>{play.side}</span>
                        </TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground py-0">{play.line}</TableCell>
                        <TableCell className="py-0 max-w-[140px]">
                          <span className="text-sm text-muted-foreground/60 truncate block" title={cleanMarket(play.market)}>
                            {cleanMarket(play.market)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold text-sm py-0">
                          {formatOdds(legTargetAmerican(play.slip!))}
                        </TableCell>
                        <TableCell className="text-right py-0">
                          <div className="flex justify-end pr-1">
                            <span className={`inline-flex items-center justify-center rounded-md font-mono text-sm px-3 py-2 min-w-[72px] ${hitTextClass}`} style={pillStyle}>
                              {play.fairPct.toFixed(1)}%
                            </span>
                          </div>
                        </TableCell>

                        {referenceBookColumns.map((book) => {
                          const offering = play.offerings[book];
                          const odds = play.side === "Over" ? offering?.over : offering?.under;
                          const isBest = bestRefBook?.book === book && odds != null;
                          const altLine = offering?.line != null && offering.line !== play.line ? offering.line : null;
                          return (
                            <TableCell
                              key={book}
                              className="text-right font-mono text-sm py-0 transition-colors"
                              style={isBest ? {
                                backgroundColor: "rgba(42, 93, 156, 0.55)",
                                borderLeft: "3px solid rgba(90, 154, 224, 0.95)",
                                boxShadow: "inset 0 0 24px rgba(42, 93, 156, 0.25)",
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
                                  {altLine != null && (
                                    <span className="text-[10px] text-muted-foreground/50">{altLine}</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground/20">—</span>
                              )}
                            </TableCell>
                          );
                        })}

                        <TableCell className="text-center py-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleSlipLeg(play.key); }}
                            disabled={!slipLegKeys.includes(play.key) && slipLegKeys.length >= 6}
                            className={["inline-flex items-center justify-center h-7 w-7 rounded-md border transition-all",
                              slipLegKeys.includes(play.key)
                                ? "border-blue-400/50 text-blue-400 bg-blue-400/10 hover:bg-blue-400/20 opacity-100"
                                : slipLegKeys.length >= 6
                                ? "border-border/30 text-muted-foreground/20 cursor-not-allowed opacity-0 group-hover:opacity-100"
                                : "border-border text-muted-foreground hover:text-foreground hover:border-border/80 hover:bg-accent opacity-0 group-hover:opacity-100"].join(" ")}
                          >
                            {slipLegKeys.includes(play.key) ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                          </button>
                        </TableCell>
                      </TableRow>

                      {isExpanded && (
                        <TableRow className="border-border hover:bg-transparent" style={expandedBg}>
                          <TableCell colSpan={totalCols} className="p-0">
                            <div className="p-5 space-y-5">
                              <div className="flex items-start gap-8 text-xs flex-wrap">
                                <div>
                                  <p className="text-muted-foreground uppercase tracking-wider mb-1">Slip</p>
                                  <SlipPicker
                                    selectedSlipId={play.slipId!}
                                    onSelect={(id) => setSlipForRow(play.key, id)}
                                    fairProb={play.fairProb}
                                    platformFilter={platformConfig.slipPlatform}
                                  />
                                </div>
                                <div>
                                  <p className="text-muted-foreground uppercase tracking-wider mb-1">Target</p>
                                  <p className="font-mono">{targetPct.toFixed(1)}% / {formatOdds(legTargetAmerican(play.slip!))}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground uppercase tracking-wider mb-1">Fair</p>
                                  <p className="font-mono">{play.fairPct.toFixed(1)}% / {formatOdds(play.fairOdds)}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground uppercase tracking-wider mb-1">Slip EV</p>
                                  <p className={`font-mono font-semibold ${evColor(play.slipEv!)}`}>
                                    {play.slipEv! > 0 ? "+" : ""}{play.slipEv!.toFixed(2)}%
                                  </p>
                                </div>
                              </div>

                              {(() => {
                                const priced = referenceBookColumns
                                  .map((book) => {
                                    const o = play.offerings[book];
                                    const odds = play.side === "Over" ? o?.over : o?.under;
                                    return odds != null ? { book, odds } : null;
                                  })
                                  .filter((x): x is { book: string; odds: number } => x != null);
                                if (priced.length === 0) return null;
                                return (
                                  <div>
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50 mb-2">
                                      Reference Books · {priced.length} priced
                                    </p>
                                    <div className="flex items-center flex-wrap gap-x-0 gap-y-1 rounded-lg border border-border bg-card/40 divide-x divide-border overflow-hidden">
                                      <div className={`flex items-center gap-2.5 px-3 py-2 ${accentBg}`}>
                                        <BookLogo book={play.platformBook} size="sm" />
                                        <span className={`text-[9px] font-semibold uppercase tracking-wide ${accentText}`}>playing</span>
                                        <span className="font-mono text-sm font-semibold text-foreground">{formatOdds(play.platformOdds)}</span>
                                        <span className={`font-mono text-xs font-bold ${evColor(play.slipEv!)}`}>
                                          {play.slipEv! > 0 ? "+" : ""}{play.slipEv!.toFixed(1)}%
                                        </span>
                                      </div>
                                      {priced.map(({ book, odds: refOdds }) => {
                                        const refEv = evPct(play.fairProb, refOdds);
                                        return (
                                          <div key={book} className="flex items-center gap-2.5 px-3 py-2">
                                            <BookLogo book={getBook(book).label} size="sm" />
                                            <span className="font-mono text-sm text-muted-foreground">{formatOdds(refOdds)}</span>
                                            <span className={`font-mono text-xs font-semibold ${evColor(refEv)}`}>
                                              {refEv > 0 ? "+" : ""}{refEv.toFixed(1)}%
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </TooltipProvider>
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
            <CommandInput placeholder="Search players, switch platform..." className="h-11" />
            <CommandList className="max-h-80">
              <CommandEmpty>No results.</CommandEmpty>
              <CommandGroup heading="Players">
                {[...new Set(displayed.map((p) => p.player))].slice(0, 8).map((player) => (
                  <CommandItem key={player} onSelect={() => { setSearchQuery(player); setCmdkOpen(false); }}>
                    <Search className="h-3.5 w-3.5 mr-2 text-muted-foreground" />{player}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading="Platform">
                {PLATFORMS.filter((p) => p.available).map((p) => (
                  <CommandItem key={p.id} onSelect={() => { setPlatformRaw(p.id); setCmdkOpen(false); }}>
                    <Check className={`h-3.5 w-3.5 mr-2 ${platform === p.id ? "text-blue-400" : "opacity-0"}`} />
                    {p.label}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading="Actions">
                <CommandItem onSelect={() => { cycleSort("fairPct"); setCmdkOpen(false); }}>
                  <ArrowUpDown className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                  Sort by % Hit — {sortDir === "desc" ? "highest first" : "lowest first"}
                </CommandItem>
                <CommandItem onSelect={() => { cycleSort("player"); setCmdkOpen(false); }}>
                  <ArrowUpDown className="h-3.5 w-3.5 mr-2 text-muted-foreground" />Sort by player name
                </CommandItem>
                <CommandItem onSelect={() => { setSearchQuery(""); setMinHitPct(52); setSelectedDate(null); setCmdkOpen(false); }}>
                  <X className="h-3.5 w-3.5 mr-2 text-muted-foreground" />Clear all filters
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