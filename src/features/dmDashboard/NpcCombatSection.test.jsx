import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import NpcCombatSection from "./NpcCombatSection";
import { PalCtx } from "./dashboardShared";
import { PALETTES } from "../characterSheet/theme";

function renderSection(props = {}) {
  const defaultProps = {
    npcCombat: {
      npcs: [
        {
          id: "npc-1",
          name: "Goblin",
          hpMax: 7,
          hpCurrent: 7,
          conditions: [],
          initiativeEntryId: "entry-1",
        },
      ],
    },
    initiative: {
      activeTurnIndex: 0,
      entries: [
        {
          id: "entry-1",
          name: "Goblin",
          initiative: 14,
          isPC: false,
          npcId: "npc-1",
        },
      ],
    },
    dmPassword: "secret",
    onUpdate: vi.fn(),
    onCommitNpcCombat: vi.fn(async () => true),
    ...props,
  };

  return render(
    <PalCtx.Provider value={PALETTES.vellum}>
      <NpcCombatSection {...defaultProps} />
    </PalCtx.Provider>
  );
}

function getCommittedNpcCombat(mockFn) {
  const [[nextNpcCombat]] = mockFn.mock.calls.slice(-1);
  return nextNpcCombat;
}

describe("NpcCombatSection turn highlighting", () => {
  it("marks an NPC card as active when initiative points to that NPC id", () => {
    renderSection();

    const npcCard = screen.getByText("Goblin").closest("[data-active-turn='true']");
    expect(npcCard).toBeTruthy();
    expect(npcCard).toHaveClass("dm-active-turn");
  });

  it("marks an NPC card as active for older initiative data that only matches by name", () => {
    renderSection({
      npcCombat: {
        npcs: [
          {
            id: "npc-2",
            name: "Bandit Captain",
            hpMax: 65,
            hpCurrent: 65,
            conditions: [],
            initiativeEntryId: null,
          },
        ],
      },
      initiative: {
        activeTurnIndex: 0,
        entries: [
          {
            id: "entry-old",
            name: "Bandit Captain",
            initiative: 12,
            isPC: false,
          },
        ],
      },
    });

    const npcCard = screen.getByText("Bandit Captain").closest("[data-active-turn='true']");
    expect(npcCard).toBeTruthy();
    expect(npcCard).toHaveClass("dm-active-turn");
  });

  it("treats legacy initiativeId links as in-initiative NPCs", () => {
    renderSection({
      npcCombat: {
        npcs: [
          {
            id: "npc-legacy",
            name: "Goblin",
            hpMax: 7,
            hpCurrent: 7,
            conditions: [],
            initiativeId: "entry-1",
          },
        ],
      },
    });

    expect(screen.getByRole("button", { name: "− Init" })).toBeTruthy();
  });

  it("splits enemies into initiative and inactive sections with short initiative buttons", () => {
    renderSection({
      npcCombat: {
        npcs: [
          {
            id: "npc-1",
            name: "Goblin",
            hpMax: 7,
            hpCurrent: 7,
            conditions: [],
            initiativeEntryId: "entry-1",
          },
          {
            id: "npc-2",
            name: "Wolf",
            hpMax: 11,
            hpCurrent: 11,
            conditions: [],
            initiativeEntryId: null,
          },
        ],
      },
      initiative: {
        activeTurnIndex: 0,
        entries: [
          {
            id: "entry-1",
            name: "Goblin",
            initiative: 14,
            isPC: false,
            npcId: "npc-1",
          },
        ],
      },
    });

    expect(screen.getByText(/In Initiative/i)).toBeTruthy();
    expect(screen.getByText(/Inactive/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "− Init" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "+ Init" })).toBeTruthy();
  });

  it("hides the section End Combat button when the caller opts out", () => {
    renderSection({
      showEndCombatButton: false,
      initiative: { activeTurnIndex: 0, entries: [] },
    });

    expect(screen.queryByRole("button", { name: "End Combat ×" })).not.toBeInTheDocument();
  });
});

// Abilities and defense are one list now (design/prototypes/npc-abilities.html):
// the old inline ability editor was replaced by a summary + modal.
describe("NpcCombatSection abilities & defense", () => {
  const inactive = (npc) => ({ npcCombat: { npcs: [{ id: "npc-1", hpMax: 7, hpCurrent: 7, conditions: [], initiativeEntryId: null, ...npc }] }, initiative: { activeTurnIndex: 0, entries: [] } });

  it("shows old string abilities as plain lines, and old attacks as rollable ones", () => {
    renderSection(inactive({
      name: "Goblin Hexer",
      abilities: ["Keen Smell: advantage on smell checks", "Pack Tactics"],
      attacks: [{ id: "s", name: "Scimitar", hit: "1d20+4", damage: "1d6+2", look: "cut" }],
    }));
    fireEvent.click(screen.getByRole("button", { name: "Expand card" }));
    expect(screen.getByText("Scimitar")).toBeInTheDocument();
    expect(screen.getByText("1d20+4 · 1d6+2")).toBeInTheDocument();
    expect(screen.getByText("Keen Smell")).toBeInTheDocument();
    expect(screen.getByText("advantage on smell checks")).toBeInTheDocument();
    expect(screen.getByText("Pack Tactics")).toBeInTheDocument();
  });

  it("shows the first three plain abilities, then more on demand", () => {
    renderSection(inactive({ name: "Goblin Mage", abilities: ["One", "Two", "Three", "Four", "Five"] }));
    fireEvent.click(screen.getByRole("button", { name: "Expand card" }));
    expect(screen.getByText("Three")).toBeInTheDocument();
    expect(screen.queryByText("Four")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "+2 more" }));
    expect(screen.getByText("Five")).toBeInTheDocument();
  });

  it("edits in the modal and saves one list, folding the old attacks in", async () => {
    const onCommitNpcCombat = vi.fn(async () => true);
    renderSection({ ...inactive({ name: "Goblin Mage", abilities: ["Magic Missile"], attacks: [{ id: "s", name: "Staff", hit: "1d20+2", damage: "1d6", look: "chop" }] }), onCommitNpcCombat });
    fireEvent.click(screen.getByRole("button", { name: "Expand card" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit Goblin Mage's abilities and defense" }));
    fireEvent.click(screen.getByRole("switch", { name: "Magic Missile can be rolled" }));
    fireEvent.change(screen.getAllByPlaceholderText("1d20+4")[0], { target: { value: "1d20+5" } });
    fireEvent.change(screen.getAllByPlaceholderText("1d6+2")[0], { target: { value: "3d4+3" } });
    fireEvent.change(screen.getByLabelText("Armour class"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onCommitNpcCombat).toHaveBeenCalled());
    const npc = getCommittedNpcCombat(onCommitNpcCombat).npcs[0];
    expect(npc.attacks).toBeUndefined();
    expect(npc.defense).toEqual({ kind: "ac", ac: 12 });
    expect(npc.abilities.map((a) => [a.name, a.roll?.hit, a.roll?.damage])).toEqual([["Magic Missile", "1d20+5", "3d4+3"], ["Staff", "1d20+2", "1d6"]]);
  });

  it("offers to add abilities to an NPC without any", () => {
    renderSection(inactive({ name: "Rat" }));
    fireEvent.click(screen.getByRole("button", { name: "Expand card" }));
    fireEvent.click(screen.getByRole("button", { name: "+ Abilities & defense" }));
    expect(screen.getByRole("dialog", { name: "Rat" })).toBeInTheDocument();
  });
});

describe("NpcCombatSection Add Enemy", () => {
  it("sits collapsed at the top once there are enemies, and opens in place", () => {
    renderSection();
    expect(screen.queryByPlaceholderText("Name…")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "+ Add enemy" }));
    expect(screen.getByPlaceholderText("Name…")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close Add Enemy" }));
    expect(screen.queryByPlaceholderText("Name…")).toBeNull();
  });

  it("starts open when there are no enemies yet", () => {
    renderSection({ npcCombat: { npcs: [] }, initiative: { activeTurnIndex: 0, entries: [] } });
    expect(screen.getByPlaceholderText("Name…")).toBeInTheDocument();
  });
});
