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
import { ChevronDown, ChevronRight } from "lucide-react";

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
  books: {
    book: string;
    odds: number;
    evPct: number;
    kellyPct: number;
  }[];
  bestEv: number;
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
      if (opp["EV %"] > existing.bestEv) {
        existing.bestEv = opp["EV %"];
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
        books: [bookOffering],
        bestEv: opp["EV %"],
        bestBook: opp.Book,
      });
    }
  }

  return Array.from(groups.values()).sort((a, b) => b.bestEv - a.bestEv);
}

function formatOdds(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

function cleanMarket(m: string): string {
  return m.replace("Player ", "");
}

export default function Home() {
  const [allOpps, setAllOpps] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [minEv, setMinEv] = useState(-3);

  useEffect(() => {
    fetch("/opportunities.json")
      .then((r) => r.json())
      .then((data: Opportunity[]) => {
        setAllOpps(data);
        setLoading(false);
      });
  }, []);

  const plays = useMemo(() => groupOpportunities(allOpps), [allOpps]);

  const displayed = useMemo(
    () => plays.filter((p) => p.bestEv >= minEv),
    [plays, minEv]
  );

  const positiveCount = plays.filter((p) => p.bestEv > 0).length;

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
              {positiveCount} +EV / {plays.length} plays
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            +EV NBA props · devigged against Novig + ProphetX
          </p>
        </header>

        {/* Filter bar */}
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">Min EV:</p>
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
                <TableHead className="text-right">% Hit</TableHead>
                <TableHead className="text-right">EV</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayed.map((play) => {
                const key = `${play.player}|${play.market}|${play.line}|${play.side}`;
                const isExpanded = expanded === key;
                const bestBookOffer = play.books.find(
                  (b) => b.book === play.bestBook
                )!;
                const evColor =
                  play.bestEv >= 3
                    ? "text-emerald-400"
                    : play.bestEv >= 0
                    ? "text-yellow-400"
                    : "text-muted-foreground";

                return (
                  <Fragment key={key}>
                    <TableRow
                      className="cursor-pointer border-border/60 hover:bg-accent/30"
                      onClick={() => setExpanded(isExpanded ? null : key)}
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
                        <Badge variant="outline" className="font-normal">
                          {play.bestBook}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {formatOdds(bestBookOffer.odds)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {formatOdds(play.fairOdds)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {play.fairPct.toFixed(1)}%
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono font-bold ${evColor}`}
                      >
                        {play.bestEv > 0 ? "+" : ""}
                        {play.bestEv.toFixed(2)}%
                      </TableCell>
                    </TableRow>

                    {isExpanded && (
                      <TableRow className="border-border/60 bg-accent/10 hover:bg-accent/10">
                        <TableCell colSpan={10} className="p-0">
                          <div className="p-4">
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
                                        <span className="text-sm font-medium">
                                          {b.book}
                                        </span>
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