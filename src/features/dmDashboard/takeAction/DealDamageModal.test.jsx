import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DealDamageModal from "./DealDamageModal";
import { PALETTES } from "../../characterSheet/theme";

const base = {
  pal: PALETTES.ocean,
  actorName: "Aesop",
  targetName: "Goblin Scout",
  targetHp: { current: 9, max: 12 },
  actionName: "Unarmed Strike",
};

describe("DealDamageModal", () => {
  it("pre-fills from a player's roll, adjusts with ½, and applies", () => {
    const onApply = vi.fn();
    render(<DealDamageModal {...base} initialAmount={9} fromRoll={{ exprLabel: "1d6+4", total: 9 }} onApply={onApply} onMiss={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(/From Aesop's roll/)).toBeTruthy();
    fireEvent.click(screen.getByTitle("Resistance"));
    expect(screen.getByLabelText("Damage amount").value).toBe("4");
    fireEvent.click(screen.getByText("Apply Damage"));
    expect(onApply).toHaveBeenCalledWith({ amount: 4, crit: false });
  });

  it("rolls the dice into the amount and reports the roll", () => {
    const onRoll = vi.fn();
    render(<DealDamageModal {...base} initialExpr="1d1+0" onRoll={onRoll} onApply={vi.fn()} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Dice/), { target: { value: "2d4+1" } });
    fireEvent.click(screen.getByText("Roll"));
    expect(onRoll).toHaveBeenCalledTimes(1);
    const total = onRoll.mock.calls[0][0].total;
    expect(total).toBeGreaterThanOrEqual(3);
    expect(screen.getByLabelText("Damage amount").value).toBe(String(total));
  });

  it("heal mode hides the damage-only controls", () => {
    render(<DealDamageModal {...base} heal actionName="Heal" initialAmount={5} onApply={vi.fn()} onMiss={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText("Apply Healing")).toBeTruthy();
    expect(screen.queryByText("Miss")).toBe(null);
    expect(screen.queryByText("Crit")).toBe(null);
  });
});

describe("DealDamageModal — attack roll against a defense", () => {
  it("rolls to hit against the target's AC and suggests the verdict", () => {
    const onAttackRoll = vi.fn();
    const rnd = vi.spyOn(Math, "random").mockReturnValue(0.5); // d20 → 11
    render(<DealDamageModal {...base} actorName="Carrion Crawler" targetName="Eòghan" attackExpr="1d20+8" targetDefense={{ kind: "ac", ac: 12 }} onAttackRoll={onAttackRoll} onApply={vi.fn()} onMiss={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Roll to hit" }));
    expect(screen.getByText("19")).toBeTruthy();
    expect(screen.getByText("vs Eòghan's AC 12")).toBeTruthy();
    expect(screen.getByText("Hits")).toBeTruthy();
    expect(onAttackRoll).toHaveBeenCalled();
    rnd.mockRestore();
  });

  it("rolls the target's defense with the attack, and a tie goes to the defender", () => {
    const rnd = vi.spyOn(Math, "random").mockReturnValue(0.5); // every d20 → 11
    render(<DealDamageModal {...base} attackExpr="1d20+3" targetDefense={{ kind: "roll", roll: "1d20+3", name: "Dodge" }} onApply={vi.fn()} onMiss={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Roll to hit" }));
    expect(screen.getByText("vs Goblin Scout's Dodge 14")).toBeTruthy();
    expect(screen.getByText("Misses")).toBeTruthy();
    // The Miss button becomes the suggested action.
    expect(screen.getByRole("button", { name: "Miss" }).className).toMatch(/primary/);
    rnd.mockRestore();
  });

  it("compares a player's to-hit with the creature's AC when opened from their roll", () => {
    render(<DealDamageModal {...base} initialAmount={7} fromRoll={{ exprLabel: "1d6+3", total: 7, hitTotal: 15 }} targetDefense={{ kind: "ac", ac: 13 }} onApply={vi.fn()} onMiss={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(/attack/).textContent).toMatch(/15/);
    expect(screen.getByText("Hits")).toBeTruthy();
  });
});
