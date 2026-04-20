"""
OddsBlaze Data Pipeline — loader + devig + EV calculation

Reads the 17 NBA JSON snapshots you captured and produces a DataFrame of
+EV opportunities by devigging PrizePicks/Demons/Goblins prices against
a peer-to-peer exchange consensus (Novig + ProphetX midpoints).

Drop-in replacement for the mock fetch_opportunities() in app.py.
"""

from pathlib import Path
import json
import pandas as pd
import numpy as np


# ============================================================================
# CONFIG
# ============================================================================

# Where your OddsBlaze capture lives — update this path if you re-run the capture
SNAPSHOT_DIR = Path("oddsblaze_snapshot")

# Books whose prices we want to EVALUATE for +EV (the "soft" side)
TARGET_BOOKS = ["prizepicks", "prizepicks-demons", "prizepicks-goblins"]

# Books whose prices form our "sharp" / "fair" reference for devigging
# Exchanges have no house vig, so their midpoints approximate true probability
REFERENCE_BOOKS = ["novig", "prophetx"]

# Pretty display names
BOOK_LABELS = {
    "prizepicks": "PrizePicks",
    "prizepicks-demons": "PP Demons",
    "prizepicks-goblins": "PP Goblins",
    "novig": "Novig",
    "prophetx": "ProphetX",
    "kalshi": "Kalshi",
    "polymarket": "Polymarket",
}


# ============================================================================
# ODDS MATH (same functions as app.py, duplicated for standalone use)
# ============================================================================

def american_to_prob(odds) -> float:
    """American odds string or int -> implied probability (with vig)."""
    o = int(str(odds).replace("+", ""))
    return 100 / (o + 100) if o > 0 else -o / (-o + 100)


def prob_to_american(prob: float) -> int:
    if prob <= 0 or prob >= 1:
        return 0
    if prob >= 0.5:
        return round(-100 * prob / (1 - prob))
    return round(100 * (1 - prob) / prob)


def calc_ev_pct(fair_prob: float, book_odds) -> float:
    o = int(str(book_odds).replace("+", ""))
    b = (o / 100) if o > 0 else (100 / -o)
    return (fair_prob * b - (1 - fair_prob)) * 100


def calc_kelly_pct(fair_prob: float, book_odds) -> float:
    o = int(str(book_odds).replace("+", ""))
    b = (o / 100) if o > 0 else (100 / -o)
    k = (fair_prob * b - (1 - fair_prob)) / b
    return max(0, k * 100)


# ============================================================================
# STEP 1 — Find the latest snapshot
# ============================================================================

def find_latest_run(snapshot_dir: Path = SNAPSHOT_DIR) -> Path:
    """Find the most recent run_<timestamp> folder."""
    if not snapshot_dir.exists():
        raise FileNotFoundError(
            f"No snapshot directory at {snapshot_dir.absolute()}. "
            f"Run capture_oddsblaze.py first."
        )
    runs = sorted([p for p in snapshot_dir.iterdir() if p.name.startswith("run_")])
    if not runs:
        raise FileNotFoundError(f"No run_* folders inside {snapshot_dir}")
    return runs[-1]


# ============================================================================
# STEP 2 — Load + normalize a single book's JSON into rows
# ============================================================================

def load_book_odds(json_path: Path) -> pd.DataFrame:
    """Load one book's JSON, flatten into rows with a consistent schema."""
    if not json_path.exists():
        return pd.DataFrame()

    with open(json_path) as f:
        data = json.load(f)

    rows = []
    book_id = data.get("sportsbook", {}).get("id", "unknown")

    for event in data.get("events", []):
        matchup = f"{event['teams']['away']['abbreviation']} @ {event['teams']['home']['abbreviation']}"
        event_id = event.get("id")

        for odd in event.get("odds", []):
            # Skip non-player markets (spreads, moneylines, totals) for now
            if "player" not in odd:
                continue

            player = odd["player"]
            selection = odd.get("selection", {})

            rows.append({
                "book": book_id,
                "event_id": event_id,
                "matchup": matchup,
                "player_id": player.get("id"),
                "player_name": player.get("name"),
                "team": player.get("team", {}).get("abbreviation"),
                "market": odd.get("market"),
                "line": selection.get("line"),
                "side": selection.get("side"),
                "price": odd.get("price"),
                "main": odd.get("main", False),
                "sdio_id": player.get("mappings", {}).get("SportsDataIO", {}).get("id"),
            })

    return pd.DataFrame(rows)


# ============================================================================
# STEP 3 — Load all books we care about
# ============================================================================

def load_all_books(run_dir: Path, books: list[str]) -> pd.DataFrame:
    """Load and concatenate the specified books from a run directory."""
    nba_dir = run_dir / "odds" / "nba"
    frames = []
    for book in books:
        df = load_book_odds(nba_dir / f"{book}.json")
        if not df.empty:
            frames.append(df)
            print(f"  loaded {len(df):>5} rows from {book}")
        else:
            print(f"  [skip] no data for {book}")
    if not frames:
        return pd.DataFrame()
    return pd.concat(frames, ignore_index=True)


# ============================================================================
# STEP 4 — Compute fair probability from exchange consensus
# ============================================================================

def compute_exchange_fair_probs(ref_df: pd.DataFrame) -> pd.DataFrame:
    """
    For each (player_id, market, line) group in reference books,
    compute a vig-free fair probability for Over.

    Method: devig each exchange's two-way market proportionally, then average
    the resulting fair Over probabilities across exchanges.
    """
    if ref_df.empty:
        return pd.DataFrame()

    # Pivot: for each (player, market, line, book), we need both Over and Under prices
    ref_df = ref_df.copy()
    ref_df["prob"] = ref_df["price"].apply(american_to_prob)

    # Group key — unique bet
    group_cols = ["player_id", "player_name", "market", "line"]

    fair_rows = []
    for key, group in ref_df.groupby(group_cols):
        # We need BOTH sides from at least one book to devig
        over_rows = group[group["side"].str.lower() == "over"]
        under_rows = group[group["side"].str.lower() == "under"]

        if over_rows.empty or under_rows.empty:
            continue

        # For each book that has both sides, devig proportionally
        fair_overs = []
        for book in over_rows["book"].unique():
            o_prob = over_rows[over_rows["book"] == book]["prob"]
            u_prob = under_rows[under_rows["book"] == book]["prob"]
            if o_prob.empty or u_prob.empty:
                continue
            p_o = o_prob.iloc[0]
            p_u = u_prob.iloc[0]
            total = p_o + p_u
            if total <= 0:
                continue
            fair_overs.append(p_o / total)

        if not fair_overs:
            continue

        # Average the devigged fair Over probs across exchanges
        fair_over = float(np.mean(fair_overs))

        player_id, player_name, market, line = key
        fair_rows.append({
            "player_id": player_id,
            "player_name": player_name,
            "market": market,
            "line": line,
            "fair_over": fair_over,
            "fair_under": 1 - fair_over,
            "reference_books": ",".join(sorted(set(
                list(over_rows["book"]) + list(under_rows["book"])
            ))),
        })

    return pd.DataFrame(fair_rows)


# ============================================================================
# STEP 5 — Join targets with fair probs and compute EV
# ============================================================================

def compute_ev(target_df: pd.DataFrame, fair_df: pd.DataFrame) -> pd.DataFrame:
    """Join target book prices with fair probs, calculate EV and Kelly."""
    if target_df.empty or fair_df.empty:
        return pd.DataFrame()

    merged = target_df.merge(
        fair_df,
        on=["player_id", "market", "line"],
        how="inner",
        suffixes=("", "_fair"),
    )

    if merged.empty:
        return merged

    # Pick the right fair prob based on side
    merged["fair_prob"] = merged.apply(
        lambda r: r["fair_over"] if str(r["side"]).lower() == "over" else r["fair_under"],
        axis=1,
    )

    merged["fair_odds"] = merged["fair_prob"].apply(prob_to_american)
    merged["ev_pct"] = merged.apply(
        lambda r: calc_ev_pct(r["fair_prob"], r["price"]), axis=1
    )
    merged["kelly_pct"] = merged.apply(
        lambda r: calc_kelly_pct(r["fair_prob"], r["price"]), axis=1
    )

    # Use player_name from target_df (non-null), else from fair_df
    merged["player_display"] = merged["player_name"].fillna(merged["player_name_fair"])

    return merged


# ============================================================================
# MAIN — build the opportunities DataFrame
# ============================================================================

def fetch_opportunities_from_snapshot() -> pd.DataFrame:
    """
    Main entry point — drop this into app.py to replace the mock fetcher.

    Returns a DataFrame with columns compatible with the existing Streamlit UI:
      Player, Team, Matchup, Market, Line, Side, Book, Odds, Fair Odds,
      Fair %, EV %, Kelly %, Updated
    """
    print("Finding latest snapshot...")
    run_dir = find_latest_run()
    print(f"Using: {run_dir}\n")

    print("Loading reference (exchange) books...")
    ref_df = load_all_books(run_dir, REFERENCE_BOOKS)

    print("\nLoading target (PrizePicks) books...")
    target_df = load_all_books(run_dir, TARGET_BOOKS)

    if ref_df.empty or target_df.empty:
        print("No data to work with.")
        return pd.DataFrame()

    print("\nComputing exchange fair probabilities...")
    fair_df = compute_exchange_fair_probs(ref_df)
    print(f"  -> {len(fair_df)} unique (player, market, line) tuples with devigged fair probs")

    print("\nJoining targets with fair probs...")
    ev_df = compute_ev(target_df, fair_df)
    print(f"  -> {len(ev_df)} priced opportunities")

    if ev_df.empty:
        print("No overlap between PrizePicks markets and exchange markets.")
        return pd.DataFrame()

    # Shape into the schema the existing Streamlit app expects
    output = pd.DataFrame({
        "Player": ev_df["player_display"],
        "Team": ev_df["team"],
        "Matchup": ev_df["matchup"],
        "Market": ev_df["market"],
        "Line": ev_df["line"],
        "Side": ev_df["side"],
        "Book": ev_df["book"].map(BOOK_LABELS).fillna(ev_df["book"]),
        "Odds": ev_df["price"].apply(lambda x: int(str(x).replace("+", ""))),
        "Fair Odds": ev_df["fair_odds"],
        "Fair %": ev_df["fair_prob"] * 100,
        "EV %": ev_df["ev_pct"],
        "Kelly %": ev_df["kelly_pct"],
        "Updated": pd.Timestamp.now(),
        "Reference": ev_df["reference_books"],
    })

    return output.sort_values("EV %", ascending=False).reset_index(drop=True)


# ============================================================================
# STANDALONE TEST — run this file directly to see what it produces
# ============================================================================
def export_to_json(output_path: str = "opportunities.json") -> None:
    """Export opportunities as JSON for the Next.js frontend to consume."""
    df = fetch_opportunities_from_snapshot()
    if df.empty:
        print("No data to export")
        return

    df = df.copy()
    df["Updated"] = df["Updated"].apply(lambda t: t.isoformat())

    df.to_json(output_path, orient="records", indent=2)
if __name__ == "__main__":
    df = fetch_opportunities_from_snapshot()
    export_to_json("../prop-screen-web/public/opportunities.json")
    
    if df.empty:
        print("\nNo opportunities found. Check that exchanges have overlapping markets.")
    else:
        print(f"\n=== Top 20 opportunities by EV% ===\n")
        cols = ["Player", "Market", "Line", "Side", "Book", "Odds", "Fair Odds", "EV %", "Kelly %"]
        with pd.option_context("display.max_rows", 50, "display.width", 200):
            print(df[cols].head(20).to_string(index=False))

        print(f"\n=== Summary ===")
        print(f"Total opportunities: {len(df)}")
        print(f"Positive EV plays:   {(df['EV %'] > 0).sum()}")
        print(f"EV > 3%:             {(df['EV %'] > 3).sum()}")
        print(f"EV > 5%:             {(df['EV %'] > 5).sum()}")
        print(f"Best EV:             {df['EV %'].max():.2f}%")
        print(f"Books found:         {df['Book'].unique().tolist()}")
