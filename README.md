# Vigil

**+EV prop betting intelligence for DFS platforms.**

Vigil deviggs exchange prices to derive a fair probability for every player prop, then compares that probability against the mathematical break-even threshold for each DFS slip type. The result: a ranked list of legs where your edge exceeds what the slip structure requires.

Not a picks app. A math tool.

**Live:** [prop-screen-web.vercel.app](https://prop-screen-web.vercel.app)

---

## How It Works

### 1. Devigging

Sportsbooks embed a margin (vig) in their odds. To find the true probability of an outcome, you need to remove it.

Vigil uses peer-to-peer exchanges — **Novig** and **ProphetX** — as reference books. Exchanges have no house margin by design; their prices represent the market's best estimate of true probability.

For each prop, Vigil computes a consensus fair probability by proportional devigging across both exchanges:

```
fair_over = implied_over / (implied_over + implied_under)
```

The consensus is a weighted average across both books, giving a vig-free fair probability for every player prop.

Exchange-only devigging is arguably superior to using Pinnacle (the traditional sharp reference) because exchanges have zero structural vig — Pinnacle still has a small margin baked in.

### 2. Slip Break-Even

DFS platforms like PrizePicks don't pay out at fixed odds — they pay multipliers conditional on hitting all (or most) legs in a slip. The break-even per leg depends on the specific slip structure.

Vigil solves for the per-leg win rate required for any slip to be +EV using a **binomial expected value model** and a **bisection method**:

```
EV(p, slip) = Σ [C(n,k) × p^k × (1-p)^(n-k) × payoutGrid[k]]

Solve: EV(p*) = 1.0  →  p* = break-even probability
```

Where `p` is the per-leg hit rate, `n` is the number of legs, and `payoutGrid[k]` is the multiplier paid when exactly `k` legs hit.

Examples:
- PrizePicks Flex 5 (10× all-hit, 2× 4/5, 0.4× 3/5): break-even = **54.25%** = -119 effective
- PrizePicks Flex 6 (12.5×): break-even = **58.98%**
- PrizePicks Power 5 (20×): break-even = **65.87%**

### 3. Slip EV

The slip EV for a given leg is the edge against the break-even:

```
Slip EV = fair_prob − break_even_prob   (expressed as percentage points)
```

A positive Slip EV means this leg is profitable to include in the selected slip structure. The board sorts by Slip EV descending.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind v4 + shadcn/ui |
| Font | Geist Sans / Geist Mono + Elan ITC Black |
| URL State | nuqs |
| Data Pipeline | Python + pandas |
| Deployment | Vercel |

---

## Data Pipeline

The Python pipeline (`pipeline.py`) fetches live player prop odds from The Odds API, normalizes them across all books, classifies DFS lines (standard / goblin / demon), and outputs `public/opportunities.json` for the frontend to consume.

```
The Odds API
    ↓  regions: us_dfs, us_ex, us, us2
    ↓  normalize + classify lines
    ↓  build market objects with offerings per book
    ↓  export → public/opportunities.json

Next.js Board
    ↓  fetch /opportunities.json
    ↓  consensusFairProb() — devig exchange books
    ↓  legBreakEvenProbability() — bisection solve per slip type
    ↓  slipEv = fairProb − breakEven
    ↓  render board sorted by Slip EV
```

### Line Classification

PrizePicks serves three line types under a single API:
- **Standard** (-137): main market line — real plays
- **Goblin** (-137, alternate market): easier line, 0.75× multiplier contribution
- **Demon** (+100, alternate market): harder line, 1.25× multiplier contribution

The pipeline classifies these by inspecting the market key suffix (`_alternate`) and price. Goblins and Demons are hidden by default and toggled via "Alt Lines."

---

## Running Locally

```bash
# Frontend
cd prop-screen-web
npm install
npm run dev
# → localhost:3000

# Pipeline (requires The Odds API key)
cd "prop - screen"
source venv/bin/activate
echo "ODDS_API_KEY=your_key" > .env
python3 pipeline.py
# → writes public/opportunities.json
```

---

## Project Structure

```
prop-screen-web/
├── src/
│   ├── app/
│   │   ├── board/page.tsx      ← Main board view
│   │   └── layout.tsx
│   ├── components/
│   │   ├── Logo.tsx            ← Pulse mark (QRS waveform) + Elan ITC Black wordmark
│   │   ├── book-logo.tsx       ← Brandfetch CDN logos + fallbacks (getfliff.com for Fliff)
│   │   └── slip-builder.tsx    ← Slip builder sheet
│   └── lib/
│       ├── devig.ts            ← consensusFairProb, evPct
│       ├── slip-types.ts       ← Break-even math, all slip structures
│       ├── hit-cell.ts         ← % Hit pill color tiers
│       ├── books.ts            ← Reference book registry
│       └── platforms.ts        ← DFS platform config
└── public/
    └── opportunities.json      ← Pipeline output
```

---

## Key Design Decisions

**Exchange-only devigging.** Retail books (DraftKings, FanDuel) are displayed for line shopping but excluded from the fair probability calculation. Only Novig and ProphetX — zero-vig exchanges — inform the math.

**Slip-aware EV, not raw odds EV.** The primary metric is edge against the specific slip structure you're playing, not raw edge against fair odds. A prop at 56% fair is a strong play for Flex 5 (54.25% needed) but not Flex 6 (58.98% needed). The board surfaces this distinction per row.

**% Hit pill as the score.** The core signal is one number: your fair hit probability versus the slip's break-even. Blue = above threshold, red = below. Intensity scales with edge magnitude.

---

## Portfolio Context

Built as both a functional personal tool and a portfolio piece demonstrating:

- Full-stack product development (Next.js + TypeScript + Python)
- Brand identity: custom SVG mark system, variant-aware logo component (dark/light surface), color system
- Probability math: devigging, binomial EV modeling, bisection method, Kelly criterion
- Data pipeline architecture: API normalization, multi-book aggregation, line classification
- Product thinking: responsive design, mobile card layout, keyboard navigation, slip builder

Pikkit-verified Top 10% NBA Bettor (@puffersnoopy) — the tool is used in production.