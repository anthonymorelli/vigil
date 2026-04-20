import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import fs from "fs";
import path from "path";

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

async function loadOpportunities(): Promise<Opportunity[]> {
  const filePath = path.join(process.cwd(), "public", "opportunities.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

export default async function Home() {
  const allOpps = await loadOpportunities();
  const positiveEv = allOpps.filter((o) => o["EV %"] > 0);
  const nearMiss = allOpps
    .filter((o) => o["EV %"] <= 0 && o["EV %"] > -3)
    .slice(0, 20);

  const displayed = [...positiveEv, ...nearMiss];

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="space-y-1">
          <div className="flex items-baseline justify-between">
            <h1 className="text-3xl font-bold tracking-tight">Prop Screen</h1>
            <p className="text-sm text-muted-foreground">
              {positiveEv.length} +EV / {allOpps.length} total
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            +EV NBA props · devigged against Novig + ProphetX
          </p>
        </header>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {displayed.map((opp, i) => (
            <PropCard key={i} opp={opp} />
          ))}
        </div>
      </div>
    </main>
  );
}

function PropCard({ opp }: { opp: Opportunity }) {
  const formatOdds = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  const ev = opp["EV %"];
  const evColor =
    ev >= 3
      ? "text-emerald-400"
      : ev >= 0
      ? "text-yellow-400"
      : "text-muted-foreground";

  return (
    <Card className="overflow-hidden border-border/60 bg-card/50 backdrop-blur">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <h2 className="text-base font-semibold truncate">{opp.Player}</h2>
            <Badge variant="outline" className="text-xs font-normal">
              {opp.Book}
            </Badge>
          </div>
          <div className="text-right shrink-0">
            <div className={`text-xl font-bold ${evColor}`}>
              {ev > 0 ? "+" : ""}
              {ev.toFixed(2)}%
            </div>
            <p className="text-xs text-muted-foreground">EV</p>
          </div>
        </div>

        <Separator className="my-4" />

        <div className="space-y-2">
          <p className="text-sm font-medium">
            {opp.Side} {opp.Line} · {opp.Market.replace("Player ", "")}
          </p>
          <div className="flex items-center justify-between text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Odds</p>
              <p className="font-mono font-semibold">{formatOdds(opp.Odds)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Fair</p>
              <p className="font-mono font-semibold text-muted-foreground">
                {formatOdds(opp["Fair Odds"])}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Kelly</p>
              <p className="font-mono font-semibold">
                {opp["Kelly %"].toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}