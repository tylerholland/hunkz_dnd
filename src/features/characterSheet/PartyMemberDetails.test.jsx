import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PartyMemberDetails from "./PartyMemberDetails";

const card = {
  race: "Tortle", charClass: "Paladin", subclass: "Oath of the Ancients", level: 1,
  armorClass: 14,
  abilityMods: { Strength: 1, Dexterity: -1, Constitution: 2, Intelligence: 0, Wisdom: 2, Charisma: 2 },
  skills: ["survival"],
  specialAbilities: [],
  spells: [{ name: "Cure Wounds", description: "Touch heals 1d8.", role: "heal" }],
};

describe("PartyMemberDetails", () => {
  it("shows race/class, ability modifiers and names, with descriptions on tap", () => {
    render(<PartyMemberDetails card={card} id="d1" />);
    expect(screen.getByText("Tortle · Paladin · Oath of the Ancients · Level 1")).toBeTruthy();
    expect(screen.getByText("-1")).toBeTruthy();
    expect(screen.getAllByText("+2")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: /Cure Wounds/ }));
    expect(screen.getByText("Touch heals 1d8.")).toBeTruthy();
  });
});
