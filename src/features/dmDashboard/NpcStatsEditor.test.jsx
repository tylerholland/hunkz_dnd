import { useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import NpcStatsEditor from "./NpcStatsEditor";
import NpcAttacksRef from "./NpcAttacksRef";

function Harness({ initial }) {
  const [stats, setStats] = useState(initial);
  return <NpcStatsEditor defense={stats.defense} attacks={stats.attacks} onChange={setStats} />;
}

describe("NpcStatsEditor", () => {
  it("switches defense between an AC and a defense roll", () => {
    render(<Harness initial={{ defense: { kind: "ac", ac: 13 }, attacks: [] }} />);
    expect(screen.getByLabelText("Armour class")).toHaveValue("13");
    fireEvent.click(screen.getByRole("button", { name: "Defense roll" }));
    expect(screen.getByLabelText("Defense roll")).toHaveValue("1d20+3");
    expect(screen.getByLabelText("Defense name")).toHaveValue("Dodge");
  });

  it("adds an attack, guesses its look from the name, and shows hit chances", () => {
    render(<Harness initial={{ defense: null, attacks: [] }} />);
    fireEvent.click(screen.getByRole("button", { name: "＋ Add an attack" }));
    fireEvent.change(screen.getByPlaceholderText("Tentacles"), { target: { value: "Poison Bite" } });
    expect(screen.getByRole("button", { name: "Look: Bite" })).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("1d20+4"), { target: { value: "1d20+8" } });
    expect(screen.getByText(/Hits AC 12 about/)).toHaveTextContent("85%");
    // A look picked by hand stays put when the name changes.
    fireEvent.click(screen.getByRole("button", { name: "Look: Bite" }));
    fireEvent.click(screen.getByRole("button", { name: "Spit" }));
    fireEvent.change(screen.getByPlaceholderText("Tentacles"), { target: { value: "Tentacle" } });
    expect(screen.getByRole("button", { name: "Look: Spit" })).toBeInTheDocument();
  });
});

describe("NpcAttacksRef", () => {
  const template = { id: "gob", name: "Goblin Soldier", defense: { kind: "ac", ac: 15 }, attacks: [{ id: "s", name: "Scimitar", hit: "1d20+4", damage: "1d6+2", look: "cut" }] };
  const spearGoblin = { name: "Goblin Soldier 3", librarySourceId: "gob", defense: { kind: "ac", ac: 15 }, attacks: [{ id: "s", name: "Spear", hit: "1d20+4", damage: "1d8+2", look: "cut" }] };

  it("shows a compact summary on the card, marked when changed from the library", () => {
    render(<NpcAttacksRef npc={spearGoblin} template={template} onSave={vi.fn()} />);
    expect(screen.getByText("Attacks · AC 15")).toBeInTheDocument();
    expect(screen.getByText("Spear")).toBeInTheDocument();
    expect(screen.getByText("1d20+4 · 1d8+2")).toBeInTheDocument();
    expect(screen.getByText("✎ Changed")).toBeInTheDocument();
    // The editor isn't on the card; it opens in a modal.
    expect(screen.queryByRole("button", { name: "＋ Add an attack" })).toBeNull();
  });

  it("edits in a modal, where Reset to library brings back the creature's attacks", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(<NpcAttacksRef npc={spearGoblin} template={template} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Goblin Soldier 3's attacks and defense" }));
    const dialog = screen.getByRole("dialog", { name: "Goblin Soldier 3" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Reset to library" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save for this one" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ defense: { kind: "ac", ac: 15 }, attacks: template.attacks }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("offers to add attacks to an NPC without any", () => {
    render(<NpcAttacksRef npc={{ name: "Rat" }} template={null} onSave={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "+ Attacks & defense" }));
    expect(screen.getByRole("dialog", { name: "Rat" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });
});
