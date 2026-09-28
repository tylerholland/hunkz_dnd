import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RollHistoryRow } from "./RollHistoryList";
import { PALETTES } from "../features/characterSheet/theme";

const pal = PALETTES.ocean;

describe("session history rows (Story 69)", () => {
  it("shows damage tagged with the attack that dealt it", () => {
    render(<RollHistoryRow pal={pal} entry={{ id: "h1", type: "hp", subject: { name: "Goblin Scout" }, delta: -8, by: { name: "Aesop" }, action: { name: "Unarmed Strike", crit: true } }} />);
    expect(screen.getByText("Goblin Scout")).toBeTruthy();
    expect(screen.getByText("−8")).toBeTruthy();
    expect(screen.getByText(/Aesop, Unarmed Strike/)).toBeTruthy();
    expect(screen.getByText("crit")).toBeTruthy();
  });

  it("shows healing with the HP it moved between, and misses", () => {
    const { rerender } = render(<RollHistoryRow pal={pal} entry={{ id: "h2", type: "hp", subject: { name: "Eòghan" }, delta: 5, from: 10, to: 15, max: 38 }} />);
    expect(screen.getByText("+5")).toBeTruthy();
    expect(screen.getByText("10 → 15 / 38 HP")).toBeTruthy();
    rerender(<RollHistoryRow pal={pal} entry={{ id: "h3", type: "hp", subject: { name: "Carrion" }, delta: 0, miss: true, by: { name: "Liu Sha" } }} />);
    expect(screen.getByText("missed")).toBeTruthy();
  });

  it("shows conditions added and removed", () => {
    render(<RollHistoryRow pal={pal} entry={{ id: "c1", type: "condition", subject: { name: "Goblin Scout" }, added: ["Poisoned"], removed: ["Prone"], exhaustion: { from: 0, to: 1 } }} />);
    expect(screen.getByText("+ Poisoned")).toBeTruthy();
    expect(screen.getByText("Prone")).toBeTruthy();
    expect(screen.getByText("Exhaustion 0 → 1")).toBeTruthy();
  });
});
