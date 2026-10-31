import { describe, expect, it } from "vitest";
import { correlatedGroups } from "../correlation";

const g = "New York Knicks @ San Antonio Spurs";
const t = "2026-06-14T00:30:00Z";

describe("correlatedGroups", () => {
  it("returns nothing for legs from different games", () => {
    expect(
      correlatedGroups([
        { key: "a", player: "Jalen Brunson", matchup: g, gameTime: t },
        { key: "b", player: "Faker", matchup: "T1 @ G2", gameTime: t },
      ]),
    ).toEqual([]);
  });

  it("flags two players in the same game", () => {
    expect(
      correlatedGroups([
        { key: "a", player: "Jalen Brunson", matchup: g, gameTime: t },
        { key: "b", player: "Faker", matchup: "T1 @ G2" },
        { key: "c", player: "Karl-Anthony Towns", matchup: g, gameTime: t },
      ]),
    ).toEqual([{ kind: "same-game", label: g, legIndexes: [0, 2] }]);
  });

  it("flags the same player twice without also double-counting the game", () => {
    expect(
      correlatedGroups([
        { key: "a", player: "Jalen Brunson", matchup: g, gameTime: t },
        { key: "b", player: "Jalen Brunson", matchup: g, gameTime: t },
      ]),
    ).toEqual([{ kind: "same-player", label: "Jalen Brunson", legIndexes: [0, 1] }]);
  });

  it("treats the same matchup at different times as different games", () => {
    expect(
      correlatedGroups([
        { key: "a", player: "A", matchup: g, gameTime: t },
        { key: "b", player: "B", matchup: g, gameTime: "2026-06-16T00:30:00Z" },
      ]),
    ).toEqual([]);
  });
});
