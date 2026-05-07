"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Copy, Check } from "lucide-react";
import {
  SLIP_TYPES,
  getSlipById,
  legBreakEvenProbability,
} from "@/lib/slip-types";
import { computeHeterogeneousSlipEV } from "@/lib/slip-math";
import type { Platform } from "@/lib/platforms";

export type SlipLeg = {
  key: string;
  player: string;
  market: string;
  line: number;
  side: "Over" | "Under";
  fairProb: number;
};

const MARKET_ABBREV: Record<string, string> = {
  "Points": "Pts", "Rebounds": "Reb", "Assists": "Ast",
  "Threes Made": "3PM", "Steals": "Stl", "Blocks": "Blk",
  "Turnovers": "TO", "Points + Rebounds": "Pts+Reb",
  "Points + Assists": "Pts+Ast", "Rebounds + Assists": "Reb+Ast",
  "Points + Rebounds + Assists": "Pts+Reb+Ast",
  "Pitcher Strikeouts": "K", "Hits": "H", "Home Runs": "HR",
};

function cleanMarket(m: string): string {
  const stripped = m.replace("Player ", "");
  return MARKET_ABBREV[stripped] ?? stripped;
}

function evColor(ev: number): string {
  return ev >= 3 ? "text-blue-400" : ev >= 0 ? "text-yellow-400" : "text-red-400";
}

function formatSlipForClipboard(
  legs: SlipLeg[],
  slipLabel: string,
  ev: number | null,
  breakEven: number | null,
): string {
  const header = `Prop Screen · ${slipLabel}`;
  const divider = "─".repeat(32);

  const legLines = legs.map((leg, i) => {
    const market = cleanMarket(leg.market);
    const fair = (leg.fairProb * 100).toFixed(1);
    return `${i + 1}. ${leg.player}  ${market} ${leg.side} ${leg.line}  (${fair}% fair)`;
  });

  const footer = [
    ev != null ? `Slip EV: ${ev > 0 ? "+" : ""}${ev.toFixed(2)}%` : null,
    breakEven != null ? `Per-leg target: ${(breakEven * 100).toFixed(1)}%` : null,
  ].filter(Boolean).join("  ·  ");

  return [header, divider, ...legLines, divider, footer, "", "propscreen.app"].join("\n");
}

type SlipBuilderProps = {
  open: boolean;
  onCloseAction: () => void;
  legs: SlipLeg[];
  onRemoveLegAction: (key: string) => void;
  onClearAllAction: () => void;
  platform: Platform;
};

export function SlipBuilder({
  open,
  onCloseAction,
  legs,
  onRemoveLegAction,
  onClearAllAction,
  platform,
}: SlipBuilderProps) {
  const [slipId, setSlipId] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (legs.length === 0) return;
    const match =
      SLIP_TYPES.find(
        (s) =>
          s.platform === platform.slipPlatform &&
          s.picks === legs.length &&
          s.recommended &&
          s.available
      ) ??
      SLIP_TYPES.find(
        (s) =>
          s.platform === platform.slipPlatform &&
          s.picks === legs.length &&
          s.available
      );
    if (match) setSlipId(match.id);
  }, [legs.length, platform.slipPlatform]);

  const slip = useMemo(() => (slipId ? getSlipById(slipId) : null), [slipId]);

  const matchingSlips = useMemo(
    () =>
      SLIP_TYPES.filter(
        (s) =>
          s.platform === platform.slipPlatform &&
          s.picks === legs.length &&
          s.available
      ),
    [legs.length, platform.slipPlatform]
  );

  const result = useMemo(() => {
    if (!slip || legs.length === 0 || slip.picks !== legs.length) return null;
    return computeHeterogeneousSlipEV(legs.map((l) => l.fairProb), slip);
  }, [legs, slip]);

  const breakEven = slip ? legBreakEvenProbability(slip) : null;

  const handleCopy = async () => {
    if (legs.length === 0) return;
    const slipLabel = slip
      ? `${slip.platformLabel} ${slip.picks}P ${slip.variant}`
      : `${platform.label} Slip`;
    const text = formatSlipForClipboard(
      legs,
      slipLabel,
      result?.ev ?? null,
      breakEven,
    );
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onCloseAction()}>
      <SheetContent
        aria-describedby={undefined}
        className="w-[440px] sm:w-[480px] flex flex-col gap-0 p-0 overflow-hidden"
      >
        {/* Header */}
        <SheetHeader className="px-5 py-4 border-b border-border/60 shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base font-semibold">
              Slip Builder
              {legs.length > 0 && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {legs.length} / 6 legs
                </span>
              )}
            </SheetTitle>
            <div className="flex items-center gap-2">
              {legs.length > 0 && (
                <>
                  <button
                    onClick={handleCopy}
                    className={[
                      "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-all",
                      copied
                        ? "border-blue-400/40 text-blue-400 bg-blue-400/5"
                        : "border-border text-muted-foreground hover:text-foreground hover:border-border/80",
                    ].join(" ")}
                  >
                    {copied
                      ? <><Check className="h-3 w-3" /> Copied!</>
                      : <><Copy className="h-3 w-3" /> Copy slip</>
                    }
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground hover:text-foreground -mr-1"
                    onClick={onClearAllAction}
                  >
                    Clear all
                  </Button>
                </>
              )}
            </div>
          </div>
        </SheetHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* Empty state */}
          {legs.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 text-center px-8">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Click the{" "}
                <span className="font-semibold text-foreground">+</span> on any
                row to add a leg
              </p>
            </div>
          )}

          {/* Leg list */}
          {legs.length > 0 && (
            <div className="px-5 pt-5 space-y-2">
              {legs.map((leg, idx) => (
                <div
                  key={leg.key}
                  className="flex items-start justify-between gap-3 rounded-md border border-border/60 bg-card/30 px-3 py-2.5"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="text-[10px] text-muted-foreground/40 font-mono mt-0.5 shrink-0 w-3 text-right">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate leading-tight">
                        {leg.player}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {cleanMarket(leg.market)} · {leg.line} ·{" "}
                        <span
                          className={
                            leg.side === "Over"
                              ? "text-blue-400/80"
                              : "text-red-400/80"
                          }
                        >
                          {leg.side}
                        </span>
                        <span className="ml-1.5 text-muted-foreground/50">
                          {(leg.fairProb * 100).toFixed(1)}% fair
                        </span>
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => onRemoveLegAction(leg.key)}
                    className="shrink-0 mt-0.5 p-0.5 rounded text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Slip type picker */}
          {legs.length > 0 && (
            <div className="px-5 pt-4">
              {matchingSlips.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    Slip Type
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {matchingSlips.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setSlipId(s.id)}
                        className={[
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium transition-colors",
                          slipId === s.id
                            ? "border-border bg-accent text-foreground"
                            : "border-border/50 text-muted-foreground hover:text-foreground hover:border-border",
                        ].join(" ")}
                      >
                        {s.picks} Pick {s.variant}
                        {s.recommended && (
                          <Badge
                            variant="outline"
                            className="text-[9px] h-4 px-1 border-blue-400/40 text-blue-400"
                          >
                            BEST
                          </Badge>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No {platform.label} slips available for {legs.length} legs.
                </p>
              )}
            </div>
          )}

          {/* EV + scenarios */}
          {result && slip && (
            <div className="px-5 pt-5 pb-6 space-y-4">
              {/* EV summary card */}
              <div className="rounded-md border border-border/60 bg-card/30 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                      Slip EV
                    </p>
                    <p className={`text-2xl font-bold font-mono ${evColor(result.ev)}`}>
                      {result.ev > 0 ? "+" : ""}
                      {result.ev.toFixed(2)}%
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                      Per-leg target
                    </p>
                    <p className="text-lg font-mono font-semibold text-muted-foreground">
                      {breakEven != null ? (breakEven * 100).toFixed(1) : "—"}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Scenarios table */}
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                  Outcome Scenarios
                </p>
                <div className="rounded-md border border-border/60 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/60 bg-muted/20">
                        <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium">Hits</th>
                        <th className="text-right px-3 py-2 text-xs text-muted-foreground font-medium">Prob</th>
                        <th className="text-right px-3 py-2 text-xs text-muted-foreground font-medium">Mult</th>
                        <th className="text-right px-3 py-2 text-xs text-muted-foreground font-medium">Contribution</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.scenarios.map(({ hits, prob, mult }) => {
                        const isAllHit = hits === slip.picks;
                        const isPaying = mult > 0;
                        const contribution = prob * mult * 100;
                        return (
                          <tr
                            key={hits}
                            className={[
                              "border-b border-border/40 last:border-0",
                              isAllHit ? "bg-blue-400/5" : "",
                              !isPaying ? "opacity-40" : "",
                            ].join(" ")}
                          >
                            <td className="px-3 py-2 font-mono">
                              <span className={isAllHit ? "text-blue-400 font-semibold" : ""}>
                                {hits}/{slip.picks}
                              </span>
                            </td>
                            <td className="text-right px-3 py-2 font-mono text-muted-foreground">
                              {(prob * 100).toFixed(1)}%
                            </td>
                            <td className="text-right px-3 py-2 font-mono">
                              {!isPaying ? (
                                <span className="text-muted-foreground/40">0×</span>
                              ) : (
                                <span className={isAllHit ? "text-blue-400" : ""}>{mult}×</span>
                              )}
                            </td>
                            <td className="text-right px-3 py-2 font-mono">
                              {!isPaying ? (
                                <span className="text-muted-foreground/30">—</span>
                              ) : (
                                <span className="text-blue-400/70">+{contribution.toFixed(1)}%</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-muted-foreground/40 mt-1.5 leading-relaxed">
                  Assumes leg independence. Contribution = P(outcome) × payout as % of stake.
                </p>
              </div>
            </div>
          )}

          {/* Mismatch warning */}
          {legs.length > 0 && slip && slip.picks !== legs.length && (
            <div className="px-5 pt-4">
              <p className="text-xs text-muted-foreground">
                Add {slip.picks - legs.length} more leg
                {slip.picks - legs.length !== 1 ? "s" : ""} to compute EV, or
                select a {legs.length}-pick slip type above.
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}