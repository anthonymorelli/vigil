# Vigil

A +EV scanner for DFS player props. It compares prop lines on PrizePicks, Underdog, Pick6 and Betr against a weighted consensus of sportsbook and exchange prices, strips the vig, and ranks plays by edge over the break-even probability of the slip you are building.

**Demo:** [prop-screen-web.vercel.app/board](https://prop-screen-web.vercel.app/board)

> **Status:** the deployed demo runs on a static **mock** snapshot (`public/opportunities.json`, `"source": "mock"`). The math and UI are real; the odds are synthetic. Live data needs the Python pipeline and an Odds API key, which are not connected to this deployment.

<!-- [FILL] Add a screenshot at docs/board.png, then replace this comment with: ![Vigil board](docs/board.png) -->

## What it does

- Reads a market snapshot (player, line, and per-book Over/Under prices) and shows it as a sortable board.
- Removes each book's vig, then averages the fair Over probability across the reference books you enable, with adjustable weights.
- Computes the break-even probability per leg for the active slip type from the platform's actual payout grid, and the EV of a slip built from your legs.
- Marks each line by how far fair probability sits above break-even. Glow means a play; dimness means lower probability.
- Flags lines where a reference book prices a different number than the DFS anchor.
- Sports in the demo data: NBA, MLB, NHL, esports.

## How the math works

**Devig.** Per book, with both sides priced, fair Over = `pO / (pO + pU)` where `p` is the American-odds implied probability (proportional devig). Books missing a side, or priced on a different line from the DFS line, are skipped; a 31.5 price is a different market from 30.5, so it is shown for reference but never enters fair value. The consensus is the weighted average across enabled reference books (`src/lib/devig.ts`). Weight presets (Prop, All Equal, Sharp Only, Exchanges Only) live in `src/lib/book-weights.ts`; you can edit weights in the UI and they persist in your browser.

**Break-even.** For each slip type, the per-leg probability `p` where expected return equals the stake is solved numerically against the payout grid (`src/lib/slip-types.ts`):

```
EV(p) = Σ_k C(n,k) · p^k · (1 − p)^(n−k) · payout[k]   →   solve EV(p) = 1
```

| Slip | Break-even per leg |
|---|---|
| PrizePicks Power 5 (20x) | 54.93 % |
| PrizePicks Power 6 (37.5x) | 54.66 % |
| PrizePicks Flex 5 | 54.25 % |
| PrizePicks Flex 6 | 54.21 % |
| Underdog Flex 6 | 53.82 % |
| Underdog Standard 2 (3.5x) | 53.45 % |
| Underdog Standard 4 (12x) | 53.73 % |
| Betr Flex 8 | 54.08 % |

**Leg edge.** On the board, a leg's edge is its fair probability minus the slip's per-leg break-even, in percentage points (pp). It says whether the leg clears the bar; it is not the slip's EV.

**Slip EV.** In the slip builder, a slip with different fair probabilities per leg is enumerated over all 2^N outcomes (`src/lib/slip-math.ts`). No binomial shortcut, because legs differ.

**Known limits.** Legs are assumed independent, so same-game correlation is not modelled. PrizePicks ties and DNPs reduce a lineup a level and are not modelled. Underdog payouts assume standard 1.0x picks, and PrizePicks Goblin/Demon lines carry altered payouts that are not modelled. Pick6 pays a per-entry base multiplier plus pool winnings, so its slips are marked unavailable. Betr Perfect Play has no published grid and is disabled. Payout grids were checked against the platforms on Oct 30, 2026 and change without notice.

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind v4 · shadcn/ui · Geist Sans and Mono, Barlow Condensed. Pipeline: Python · pandas. Deployed on Vercel.

## Architecture

```
prop-screen/         Python pipeline: fetch odds, normalize, write JSON
prop-screen-web/     this repo
  src/app/board/       main board
  src/app/scanner/     scanner view
  src/lib/devig.ts       devig and weighted consensus
  src/lib/slip-types.ts  payout grids per slip type
  src/lib/slip-math.ts   exact slip EV
  src/lib/hit-cell.ts    edge-to-color mapping
  public/opportunities.json   snapshot the frontend reads
```

The pipeline writes `opportunities.json` and the frontend reads it statically. The planned change serves the same shape from a FastAPI endpoint the frontend polls.

## Run locally

```bash
git clone https://github.com/anthonymorelli/prop-screen-web
cd prop-screen-web
npm install
npm run dev        # http://localhost:3000/board
```

The mock snapshot ships with the repo, so no keys are needed. `scripts/patch_opportunities.py` regenerates varied mock odds (`python3 scripts/patch_opportunities.py`).

To use live data, run the pipeline (needs `ODDS_API_KEY`; [The Odds API](https://the-odds-api.com) `us_dfs` covers PrizePicks, Underdog, Pick6 and Betr):

```bash
cd prop-screen && source venv/bin/activate && python3 pipeline.py
# writes prop-screen-web/public/opportunities.json
```

## Roadmap

Tests for the devig and slip math, CI, a book selector, game context per row, market filters, player search, correlation flags, backtesting, FastAPI data source.

## Disclaimer

Research and portfolio project, not betting advice. Mock data in the demo is invented, including player lines. Real lines and payouts change and can be wrong; verify at the platform before you stake. DFS availability varies by state.

## Author

Anthony Morelli · Verified Top 10 % NBA bettor on Pikkit ([@puffersnoopy](https://pikkit.com)) · anthony@anthonymorelli.dev
