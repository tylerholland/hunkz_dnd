import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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

describe("spell effects & roll labels", () => {
  it("shows a spell's cast as 'casts Hex' with its target", () => {
    render(<RollHistoryRow pal={pal} entry={{ id: "r1", characterName: "Eòghan", label: "Hex CAST", attack: { kind: "spell", name: "Hex" }, target: { name: "Carrion Crawler" }, total: 12, rollValues: [9] }} />);
    expect(screen.getByText("casts")).toBeTruthy();
    expect(screen.getByText(/Carrion Crawler/)).toBeTruthy();
    expect(screen.queryByText(/CAST/)).toBeNull();
  });

  it("shows an effect row and, once applied, the DM's note", () => {
    render(<RollHistoryRow pal={pal} entry={{ id: "e1", type: "effect", characterName: "Eòghan", effect: "Hexed", attack: { kind: "spell", name: "Hex" }, target: { name: "Carrion Crawler" }, applied: { kind: "effect", note: "loses its hold on Aesop" } }} />);
    expect(screen.getByText("✦ Hex takes effect")).toBeTruthy();
    expect(screen.getByText("loses its hold on Aesop")).toBeTruthy();
  });

  it("shows a roll's label, and lets the DM change it inline", async () => {
    const { fireEvent, waitFor } = await import("@testing-library/react");
    const onSaveTag = vi.fn(() => Promise.resolve());
    render(<RollHistoryRow pal={pal} onSaveTag={onSaveTag} entry={{ id: "r2", characterName: "Aesop", label: "Free Roll", tag: "Climbing the grate", total: 9, rollValues: [9] }} />);
    expect(screen.getByText(/Climbing the grate/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Change this label" }));
    const input = screen.getByRole("textbox", { name: "Label this roll" });
    fireEvent.change(input, { target: { value: "Persuade the goblin king" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(onSaveTag).toHaveBeenCalledWith(expect.objectContaining({ id: "r2" }), "Persuade the goblin king"));
    expect(screen.getByText(/Persuade the goblin king/)).toBeTruthy();
  });

  it("puts the label back if the save fails, and shows no pencil without onSaveTag", async () => {
    const { fireEvent, waitFor } = await import("@testing-library/react");
    const onSaveTag = vi.fn(() => Promise.reject(new Error("offline")));
    const { rerender } = render(<RollHistoryRow pal={pal} onSaveTag={onSaveTag} entry={{ id: "r3", label: "Free Roll", total: 4, rollValues: [4] }} />);
    fireEvent.click(screen.getByRole("button", { name: "Label this roll" }));
    const input = screen.getByRole("textbox", { name: "Label this roll" });
    fireEvent.change(input, { target: { value: "Oops" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(screen.queryByText(/Oops/)).toBeNull());
    rerender(<RollHistoryRow pal={pal} entry={{ id: "r3", label: "Free Roll", total: 4, rollValues: [4] }} />);
    expect(screen.queryByRole("button", { name: /label/i })).toBeNull();
  });
});
