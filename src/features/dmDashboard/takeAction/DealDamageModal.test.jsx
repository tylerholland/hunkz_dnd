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
