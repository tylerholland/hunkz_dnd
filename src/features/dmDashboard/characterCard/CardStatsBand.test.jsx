import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CardStatsBand from "./CardStatsBand";
import CardLoadoutDrawer from "./CardLoadoutDrawer";

const char = {
  name: "Eoghan",
  level: 5,
  stats: [
    { stat: "Dexterity", score: 14 },
    { stat: "Constitution", score: 12 },
    { stat: "Wisdom", score: 16 },
  ],
  skills: ["perception", "stealth", "insight", "survival", "athletics"],
  weapons: [{ id: "w1", name: "Longbow", mods: [{ attribute: "Attack Bonus", value: 7 }, { attribute: "Damage", value: "1d8+4" }] }],
  equipment: [{ id: "e1", name: "Rope", qty: 2 }],
  spells: [{ id: "s1", name: "Hunter's Mark", level: 1 }],
  specialAbilities: ["favored enemy"],
};

describe("DM card stats band", () => {
  it("shows all six modifiers from the character's stats", () => {
    render(<CardStatsBand char={char} expanded={false} onToggleExpand={() => {}} />);
    expect(screen.getByTitle("Wisdom")).toHaveTextContent("Wis+3");
    expect(screen.getByTitle("Dexterity")).toHaveTextContent("Dex+2");
    expect(screen.getByTitle("Charisma")).toHaveTextContent("Cha+0");
    expect(screen.getByRole("button", { name: "+1" })).toBeInTheDocument(); // 5 skills, 4 shown
  });

  it("rolls a check when a modifier or skill is clicked", () => {
    const onRoll = vi.fn();
    render(<CardStatsBand char={char} onRoll={onRoll} expanded={false} onToggleExpand={() => {}} />);
    fireEvent.click(screen.getByTitle("Roll Wisdom (1d20+3)"));
    expect(onRoll).toHaveBeenCalledWith("1d20+3", "Wisdom check");
    fireEvent.click(screen.getByTitle("Roll Perception (1d20+6)"));
    expect(onRoll).toHaveBeenLastCalledWith("1d20+6", "Perception");
  });

  it("drawer lists loadout and rolls weapon attack and damage", () => {
    const onRoll = vi.fn();
    render(<CardLoadoutDrawer char={char} onRoll={onRoll} />);
    expect(screen.getByText("Hunter's Mark")).toBeInTheDocument();
    expect(screen.getByText("Favored Enemy")).toBeInTheDocument();
    expect(document.querySelector(".cc-drawer-qty")).toHaveTextContent("(2)");
    fireEvent.click(screen.getByText("+7 hit"));
    expect(onRoll).toHaveBeenCalledWith("1d20+7", "Longbow attack");
    fireEvent.click(screen.getByText("1d8+4"));
    expect(onRoll).toHaveBeenLastCalledWith("1d8+4", "Longbow damage");
  });
});
