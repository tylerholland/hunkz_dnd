import { useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import NpcStatsEditor from "./NpcStatsEditor";
import NpcAbilitiesRef from "./NpcAbilitiesRef";

function Harness({ initial }) {
  const [stats, setStats] = useState(initial);
  return <NpcStatsEditor defense={stats.defense} abilities={stats.abilities} onChange={setStats} />;
}

describe("NpcStatsEditor", () => {
  it("switches defense between an AC and a defense roll, starting empty", () => {
    render(<Harness initial={{ defense: { kind: "ac", ac: 13 }, abilities: [] }} />);
    expect(screen.getByLabelText("Armour class")).toHaveValue("13");
    fireEvent.click(screen.getByRole("button", { name: "Defense roll" }));
    // Starts empty: the examples are faded placeholders, not values.
    expect(screen.getByLabelText("Defense roll")).toHaveValue("");
    expect(screen.getByLabelText("Defense roll")).toHaveAttribute("placeholder", "1d20+3");
    expect(screen.getByLabelText("Defense name")).toHaveAttribute("placeholder", "Dodge");
    // Empty isn't an error; something unreadable is.
    expect(screen.getByLabelText("Defense roll").className).not.toMatch(/bad/);
    fireEvent.change(screen.getByLabelText("Defense roll"), { target: { value: "lots" } });
    expect(screen.getByLabelText("Defense roll").className).toMatch(/bad/);
  });

  it("adds a plain ability, then makes it rollable with a guessed look and hit chances", () => {
    render(<Harness initial={{ defense: null, abilities: [] }} />);
    fireEvent.click(screen.getByRole("button", { name: "＋ Add an ability" }));
    fireEvent.change(screen.getByLabelText("Ability name"), { target: { value: "Poison Bite" } });
    expect(screen.queryByPlaceholderText("1d20+4")).toBeNull();
    fireEvent.click(screen.getByRole("switch", { name: "Poison Bite can be rolled" }));
    expect(screen.getByRole("button", { name: "Look: Bite" })).toBeInTheDocument();
    // The dice start empty, with examples as placeholders.
    expect(screen.getByPlaceholderText("1d20+4")).toHaveValue("");
    fireEvent.change(screen.getByPlaceholderText("1d20+4"), { target: { value: "1d20+8" } });
    expect(screen.getByText(/Hits AC 12 about/)).toHaveTextContent("85%");
    // A look picked by hand stays put when the name changes.
    fireEvent.click(screen.getByRole("button", { name: "Look: Bite" }));
    fireEvent.click(screen.getByRole("button", { name: "Spit" }));
    fireEvent.change(screen.getByLabelText("Ability name"), { target: { value: "Tentacle" } });
    expect(screen.getByRole("button", { name: "Look: Spit" })).toBeInTheDocument();
  });

  it("moves abilities up and down", () => {
    render(<Harness initial={{ defense: null, abilities: [{ id: "a", name: "Keen Smell" }, { id: "b", name: "Bite" }] }} />);
    fireEvent.click(screen.getByRole("button", { name: "Move Bite up" }));
    expect(screen.getAllByLabelText("Ability name").map((i) => i.value)).toEqual(["Bite", "Keen Smell"]);
  });
});

describe("NpcAbilitiesRef", () => {
  const template = { id: "gob", name: "Goblin Soldier", defense: { kind: "ac", ac: 15 }, abilities: [{ id: "s", name: "Scimitar", roll: { hit: "1d20+4", damage: "1d6+2", look: "cut" } }, { id: "n", name: "Nimble Escape", notes: "Disengage or Hide as a bonus action." }] };
  const spearGoblin = { name: "Goblin Soldier 3", librarySourceId: "gob", defense: { kind: "ac", ac: 15 }, abilities: [{ id: "s", name: "Spear", roll: { hit: "1d20+4", damage: "1d8+2", look: "cut" } }, { id: "n", name: "Nimble Escape", notes: "Disengage or Hide as a bonus action." }] };

  it("shows rollable abilities with their dice, then the rest, marked when changed", () => {
    render(<NpcAbilitiesRef npc={spearGoblin} template={template} onSave={vi.fn()} />);
    expect(screen.getByText("Abilities · AC 15")).toBeInTheDocument();
    expect(screen.getByText("Spear")).toBeInTheDocument();
    expect(screen.getByText("1d20+4 · 1d8+2")).toBeInTheDocument();
    expect(screen.getByText("Nimble Escape")).toBeInTheDocument();
    expect(screen.getByText("✎ Changed")).toBeInTheDocument();
  });

  it("edits in a modal, where Reset to library brings back the creature's abilities", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(<NpcAbilitiesRef npc={spearGoblin} template={template} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Goblin Soldier 3's abilities and defense" }));
    const dialog = screen.getByRole("dialog", { name: "Goblin Soldier 3" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Reset to library" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save for this one" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ defense: { kind: "ac", ac: 15 }, abilities: template.abilities }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
