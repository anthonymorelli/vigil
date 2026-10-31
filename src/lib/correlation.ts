// src/lib/correlation.ts
// Flags slip legs that are not independent. Slip EV (slip-math.ts) assumes
// independent legs; legs from the same game, and especially from the same
// player, are correlated, so the computed EV can be off in either direction.
// This module only detects the overlap; it does not estimate the correlation.

export type CorrelationLeg = {
  key: string;
  player: string;
  matchup?: string;
  gameTime?: string;
};

export type CorrelationGroup = {
  kind: "same-player" | "same-game";
  label: string;          // player name, or the matchup
  legIndexes: number[];   // 0-based positions in the slip
};

/** Groups of 2+ legs sharing a player or a game. Same-player groups are listed first. */
export function correlatedGroups(legs: CorrelationLeg[]): CorrelationGroup[] {
  const groups: CorrelationGroup[] = [];

  const byPlayer = new Map<string, number[]>();
  legs.forEach((leg, i) => {
    const k = leg.player.trim().toLowerCase();
    byPlayer.set(k, [...(byPlayer.get(k) ?? []), i]);
  });
  for (const idx of byPlayer.values()) {
    if (idx.length > 1) groups.push({ kind: "same-player", label: legs[idx[0]].player, legIndexes: idx });
  }

  const byGame = new Map<string, number[]>();
  legs.forEach((leg, i) => {
    if (!leg.matchup) return;
    const k = `${leg.matchup.trim().toLowerCase()}|${leg.gameTime ?? ""}`;
    byGame.set(k, [...(byGame.get(k) ?? []), i]);
  });
  for (const idx of byGame.values()) {
    if (idx.length < 2) continue;
    // Skip a game group that only repeats a same-player group.
    const players = new Set(idx.map((i) => legs[i].player.trim().toLowerCase()));
    if (players.size < 2) continue;
    groups.push({ kind: "same-game", label: legs[idx[0]].matchup!, legIndexes: idx });
  }

  return groups;
}
