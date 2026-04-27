"use client";

import { useState, useMemo, useEffect, Fragment } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { ChevronDown, ChevronRight, Check } from "lucide-react";
import { BookLogo } from "@/components/book-logo";
import {
  DEFAULT_SLIP_TYPE,
  getSlipById,
  groupedSlipTypes,
  legBreakEvenProbability,
  legEvPctVsSlip,
  legTargetAmerican,
} from "@/lib/slip-types";

type Opportunity = {
  Player: string;
  Market: string;
  Line: number;
  Side: "Over" | "Under";
  Book: string;
  Odds: number;
  "Fair Odds": number;
  "Fair %": number;
  "EV %": number;
  "Kelly %": number;
  Updated: string;
  Reference: string;
};

type Play = {
  player: string;
  market: string;
  line: number;
  side: "Over" | "Under";
  fairOdds: number;
  fairPct: number;
  fairProb: number;
  books: {
    book: string;
    odds: number;
    evPct: number;
    kellyPct: number;
  }[];
  bestMarketEv: number;
  bestBook: string;
};

function groupOpportunities(opps: Opportunity[]): Play[] {
  const groups = new Map<string, Play>();

  for (const opp of opps) {
    const key = `${opp.Player}|${opp.Market}|${opp.Line}|${opp.Side}`;
    const existing = groups.get(key);

    const bookOffering = {
      book: opp.Book,
      odds: opp.Odds,
      evPct: opp["EV %"],
      kellyPct: opp["Kelly %"],
    };

    if (existing) {
      existing.books.push(bookOffering);
      if (opp["EV %"] > existing.bestMarketEv) {
        existing.bestMarketEv = opp["EV %"];
        existing.bestBook = opp.Book;
      }
    } else {
      groups.set(key, {
        player: opp.Player,
        market: opp.Market,
        line: opp.Line,
        side: opp.Side,
        fairOdds: opp["Fair Odds"],
        fairPct: opp["Fair %"],
        fairProb: opp["Fair %"] / 100,
        books: [bookOffering],
        bestMarketEv: opp["EV %"],
        bestBook: opp.Book,
      });
    }
  }

  return Array.from(groups.values());
}

function formatOdds(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

function cleanMarket(m: string): string {
  return m.replace("Player ", "");
}

// ============================================================================
// Inline SlipPicker — Popover + Command pattern
// ============================================================================

function SlipPicker({
  selectedSlipId,
  onSelect,
  fairProb,
}: {
  selectedSlipId: string;
  onSelect: (id: string) => void;
  fairProb: number;
}) {
  const [open, setOpen] = useState(false);
  const slip = getSlipById(selectedSlipId);
  const targetProb = legBreakEvenProbability(slip);
  const evPct = legEvPctVsSlip(slip, fairProb);

  const evColor =
    evPct >= 3
      ? "text-emerald-400"
      : evPct >= 0
      ? "text-yellow-400"
      : "text-muted-foreground";

  const grouped = groupedSlipTypes();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-accent/40 transition-colors"
        >
          <span className={`font-mono text-sm font-semibold ${evColor}`}>
            {(targetProb * 100).toFixed(1)}%
          </span>
          <ChevronDown className="h-3 w-3 text-muted-foreground/60" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-0"
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        <Command>
          <CommandInput placeholder="Search slip types..." className="h-9" />
          <CommandList>
            <CommandEmpty>No slip type found.</CommandEmpty>
            {grouped.map((platform, pIdx) => (
              <Fragment key={platform.platform}>
                {pIdx > 0 && <CommandSeparator />}
                {platform.variants.map((variantGroup) => (
                  <CommandGroup
                    key={`${platform.platform}-${variantGroup.variant}`}
                    heading={`${platform.platform} ${variantGroup.variant}`}
                  >
                    {variantGroup.slips.map((s) => {
                      const sTarget = legBreakEvenProbability(s);
                      const sTargetOdds = legTargetAmerican(s);
                      const isSelected = s.id === selectedSlipId;
                      return (
                        <CommandItem
                          key={s.id}
                          value={`${s.platformLabel} ${s.variant} ${s.picks}`}
                          disabled={!s.available}
                          onSelect={() => {
                            onSelect(s.id);
                            setOpen(false);
                          }}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            {isSelected ? (
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <span className="w-3.5" />
                            )}
                            <span className="text-sm">
                              {s.picks} Pick {s.variant}
                            </span>
                            {s.recommended && (
                              <Badge
                                variant="outline"
                                className="text-[9px] h-4 px-1 border-emerald-400/40 text-emerald-400"
                              >
                                BEST
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                            <span>{(sTarget * 100).toFixed(1)}%</span>
                            <span className="opacity-50">
                              {sTargetOdds > 0
                                ? `+${sTargetOdds}`
                                : sTargetOdds}
                            </span>
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
        <div className="border-t border-border/60 px-3 py-2 bg-muted/20">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Target / Fair</span>
            <span className="font-mono">
              {(targetProb * 100).toFixed(1)}% / {(fairProb * 100).toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center justify-between text-xs mt-1">
            <span className="text-muted-foreground">Slip EV</span>
            <span className={`font-mono font-semibold ${evColor}`}>
              {evPct >= 0 ? "+" : ""}
              {evPct.toFixed(2)}%
            </span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ============================================================================
// Main page
// ============================================================================

export default function Home() {
  const [allOpps, setAllOpps] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [minEv, setMinEv] = useState(-3);
  const [showAltLines, setShowAltLines] = useState(false);

  // Per-row slip selections — keyed by play key
  const [rowSlips, setRowSlips] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/opportunities.json")
      .then((r) => r.json())
      .then((data: Opportunity[]) => {
        setAllOpps(data);
        setLoading(false);
      });
  }, []);

  const plays = useMemo(() => groupOpportunities(allOpps), [allOpps]);

  // Filter out alt lines (Discount / Boost — formerly PP Goblins / PP Demons)
  // by default. Sharps avoid these because PrizePicks bakes extra vig into
  // the multiplier adjustment vs the standard line. Current EV math doesn't
  // account for the multiplier weighting either, so showing them produces
  // misleading numbers. Toggle in filter bar to show.
  const visiblePlays = useMemo(() => {
    if (showAltLines) return plays;
    return plays
      .map((p) => {
        const filteredBooks = p.books.filter(
          (b) => b.book !== "PP Demons" && b.book !== "PP Goblins"
        );
        if (filteredBooks.length === 0) return null;
        const sorted = [...filteredBooks].sort((a, b) => b.evPct - a.evPct);
        return {
          ...p,
          books: filteredBooks,
          bestMarketEv: sorted[0].evPct,
          bestBook: sorted[0].book,
        };
      })
      .filter((p): p is Play => p !== null);
  }, [plays, showAltLines]);

  // Compute per-row slip EV using each row's selected slip type (or default)
  const playsWithSlipEv = useMemo(() => {
    return visiblePlays
      .map((p) => {
        const key = `${p.player}|${p.market}|${p.line}|${p.side}`;
        const slipId = rowSlips[key] ?? DEFAULT_SLIP_TYPE.id;
        const slip = getSlipById(slipId);
        const slipEv = legEvPctVsSlip(slip, p.fairProb);
        return { ...p, key, slipId, slip, slipEv };
      })
      .sort((a, b) => b.slipEv - a.slipEv);
  }, [visiblePlays, rowSlips]);

  const displayed = useMemo(
    () => playsWithSlipEv.filter((p) => p.slipEv >= minEv),
    [playsWithSlipEv, minEv]
  );

  const positiveCount = playsWithSlipEv.filter((p) => p.slipEv > 0).length;

  const setSlipForRow = (key: string, slipId: string) => {
    setRowSlips((prev) => ({ ...prev, [key]: slipId }));
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-background p-6 flex items-center justify-center">
        <p className="text-muted-foreground">Loading opportunities...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <header className="space-y-1">
          <div className="flex items-baseline justify-between">
            <h1 className="text-3xl font-bold tracking-tight">Prop Screen</h1>
            <p className="text-sm text-muted-foreground">
              {positiveCount} +EV / {playsWithSlipEv.length} plays
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            +EV NBA props · devigged against Novig + ProphetX · slip-aware EV
            per row
          </p>
        </header>

        {/* Filter bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-sm text-muted-foreground">Min Slip EV:</p>
          {[-3, -1, 0, 2].map((val) => (
            <Button
              key={val}
              variant={minEv === val ? "default" : "outline"}
              size="sm"
              onClick={() => setMinEv(val)}
            >
              {val > 0 ? `+${val}%` : `${val}%`}
            </Button>
          ))}
          <div className="h-4 w-px bg-border/60 mx-1" />
          <Button
            variant={showAltLines ? "default" : "outline"}
            size="sm"
            onClick={() => setShowAltLines(!showAltLines)}
          >
            {showAltLines ? "✓ " : ""}Alt Lines (Discount/Boost)
          </Button>
          <p className="ml-auto text-sm text-muted-foreground">
            Showing {displayed.length}
          </p>
        </div>

        {/* Table */}
        <div className="rounded-lg border border-border/60 bg-card/30 backdrop-blur overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/60">
                <TableHead className="w-8"></TableHead>
                <TableHead>Player</TableHead>
                <TableHead>Bet</TableHead>
                <TableHead>Line</TableHead>
                <TableHead>Market</TableHead>
                <TableHead className="text-right">Book</TableHead>
                <TableHead className="text-right">Odds</TableHead>
                <TableHead className="text-right">Fair</TableHead>
                <TableHead className="text-right">% Hit Need</TableHead>
                <TableHead className="text-right">Slip EV</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayed.map((play) => {
                const isExpanded = expanded === play.key;
                const bestBookOffer = play.books.find(
                  (b) => b.book === play.bestBook
                )!;
                const evColor =
                  play.slipEv >= 3
                    ? "text-emerald-400"
                    : play.slipEv >= 0
                    ? "text-yellow-400"
                    : "text-muted-foreground";

                return (
                  <Fragment key={play.key}>
                    <TableRow
                      className="cursor-pointer border-border/60 hover:bg-accent/30"
                      onClick={() =>
                        setExpanded(isExpanded ? null : play.key)
                      }
                    >
                      <TableCell className="py-3">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {play.player}
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            play.side === "Over"
                              ? "text-emerald-400/80"
                              : "text-red-400/80"
                          }
                        >
                          {play.side}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono">{play.line}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {cleanMarket(play.market)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex">
                          <BookLogo book={play.bestBook} />
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {formatOdds(bestBookOffer.odds)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {formatOdds(play.fairOdds)}
                      </TableCell>
                      <TableCell className="text-right">
                        <SlipPicker
                          selectedSlipId={play.slipId}
                          onSelect={(id) => setSlipForRow(play.key, id)}
                          fairProb={play.fairProb}
                        />
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono font-bold ${evColor}`}
                      >
                        {play.slipEv > 0 ? "+" : ""}
                        {play.slipEv.toFixed(2)}%
                      </TableCell>
                    </TableRow>

                    {isExpanded && (
                      <TableRow className="border-border/60 bg-accent/10 hover:bg-accent/10">
                        <TableCell colSpan={10} className="p-0">
                          <div className="p-4 space-y-4">
                            {/* Slip context */}
                            <div className="flex items-center gap-6 text-xs">
                              <div>
                                <p className="text-muted-foreground uppercase tracking-wider mb-0.5">
                                  Selected Slip
                                </p>
                                <p className="font-medium">
                                  {play.slip.platformLabel} {play.slip.picks}{" "}
                                  Pick {play.slip.variant}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground uppercase tracking-wider mb-0.5">
                                  Target
                                </p>
                                <p className="font-mono">
                                  {(
                                    legBreakEvenProbability(play.slip) * 100
                                  ).toFixed(1)}
                                  % /{" "}
                                  {formatOdds(legTargetAmerican(play.slip))}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground uppercase tracking-wider mb-0.5">
                                  Fair
                                </p>
                                <p className="font-mono">
                                  {play.fairPct.toFixed(1)}% /{" "}
                                  {formatOdds(play.fairOdds)}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground uppercase tracking-wider mb-0.5">
                                  Best Market EV
                                </p>
                                <p className="font-mono">
                                  {play.bestMarketEv > 0 ? "+" : ""}
                                  {play.bestMarketEv.toFixed(2)}%
                                </p>
                              </div>
                            </div>

                            {/* Book comparison grid */}
                            <div>
                              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
                                Book Comparison · {play.books.length} book
                                {play.books.length !== 1 ? "s" : ""}
                              </p>
                              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                {[...play.books]
                                  .sort((a, b) => b.evPct - a.evPct)
                                  .map((b) => {
                                    const bEvColor =
                                      b.evPct >= 3
                                        ? "text-emerald-400"
                                        : b.evPct >= 0
                                        ? "text-yellow-400"
                                        : "text-muted-foreground";
                                    const isBest = b.book === play.bestBook;
                                    return (
                                      <div
                                        key={b.book}
                                        className={`flex items-center justify-between rounded-md border px-3 py-2 ${
                                          isBest
                                            ? "border-emerald-400/40 bg-emerald-400/5"
                                            : "border-border/60 bg-background/40"
                                        }`}
                                      >
                                        <div className="flex items-center gap-2">
                                          <BookLogo book={b.book} size="md" />
                                          {isBest && (
                                            <Badge
                                              variant="outline"
                                              className="text-[10px] h-4 px-1.5 border-emerald-400/40 text-emerald-400"
                                            >
                                              BEST
                                            </Badge>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-3 text-right">
                                          <span className="font-mono text-sm font-semibold">
                                            {formatOdds(b.odds)}
                                          </span>
                                          <span
                                            className={`font-mono text-sm font-bold ${bEvColor}`}
                                          >
                                            {b.evPct > 0 ? "+" : ""}
                                            {b.evPct.toFixed(1)}%
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </main>
  );
}