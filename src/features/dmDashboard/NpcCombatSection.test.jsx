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

describe("NpcCombatSection Story 23 ability reference", () => {
  it("coerces legacy string abilities into the new list display", () => {
    renderSection({
      npcCombat: {
        npcs: [
          {
            id: "npc-1",
            name: "Goblin Hexer",
            hpMax: 7,
            hpCurrent: 7,
            conditions: [],
            initiativeEntryId: null,
            abilities: "Hex Bolt +5, 2d6 necrotic",
          },
        ],
      },
      initiative: { activeTurnIndex: 0, entries: [] },
    });

    // Inactive NPCs collapse by default (Story 29b) — expand to see the ability block.
    fireEvent.click(screen.getByRole("button", { name: "Expand card" }));

    expect(screen.getByText("Hex Bolt +5, 2d6 necrotic")).toBeInTheDocument();
    expect(screen.getByTitle("Edit abilities")).toBeInTheDocument();
  });

  it("shows only the first three abilities when collapsed and expands on demand", () => {
    renderSection({
      npcCombat: {
        npcs: [
          {
            id: "npc-1",
            name: "Goblin Mage",
            hpMax: 7,
            hpCurrent: 7,
            conditions: [],
            initiativeEntryId: null,
            abilities: ["Magic Missile", "Shield", "Misty Step", "Fireball"],
          },
        ],
      },
      initiative: { activeTurnIndex: 0, entries: [] },
    });

    // Inactive NPCs collapse by default (Story 29b) — expand to see the ability block.
    fireEvent.click(screen.getByRole("button", { name: "Expand card" }));

    expect(screen.getByText("Magic Missile")).toBeInTheDocument();
    expect(screen.getByText("Shield")).toBeInTheDocument();
    expect(screen.getByText("Misty Step")).toBeInTheDocument();
    expect(screen.queryByText("Fireball")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show all 4" }));

    expect(screen.getByText("Fireball")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show less" })).toBeInTheDocument();
  });

  it("auto-expands on the NPC turn and collapses again when the turn ends", () => {
    const npcCombat = {
      npcs: [
        {
          id: "npc-1",
          name: "Goblin Mage",
          hpMax: 7,
          hpCurrent: 7,
          conditions: [],
          initiativeEntryId: "entry-1",
          abilities: ["Magic Missile", "Shield", "Misty Step", "Fireball"],
        },
      ],
    };

    const { rerender } = renderSection({
      npcCombat,
      initiative: {
        activeTurnIndex: 0,
        entries: [
          {
            id: "entry-1",
            name: "Goblin Mage",
            initiative: 14,
            isPC: false,
            npcId: "npc-1",
          },
        ],
      },
    });

    expect(screen.getByText("Fireball")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show less" })).toBeInTheDocument();

    rerender(
      <PalCtx.Provider value={PALETTES.vellum}>
        <NpcCombatSection
          npcCombat={npcCombat}
          initiative={{ activeTurnIndex: 0, entries: [] }}
          dmPassword="secret"
          onUpdate={vi.fn()}
          onCommitNpcCombat={vi.fn(async () => true)}
        />
      </PalCtx.Provider>
    );

    expect(screen.queryByText("Fireball")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show all 4" })).toBeInTheDocument();
  });

  it("cancels edit mode without committing draft changes", () => {
    const onCommitNpcCombat = vi.fn(async () => true);

    renderSection({
      npcCombat: {
        npcs: [
          {
            id: "npc-1",
            name: "Goblin Mage",
            hpMax: 7,
            hpCurrent: 7,
            conditions: [],
            initiativeEntryId: null,
            abilities: ["Magic Missile"],
          },
        ],
      },
      initiative: { activeTurnIndex: 0, entries: [] },
      onCommitNpcCombat,
    });

    // Inactive NPCs collapse by default (Story 29b) — expand to reach the ability block.
    fireEvent.click(screen.getByRole("button", { name: "Expand card" }));

    fireEvent.click(screen.getByTitle("Edit abilities"));
    fireEvent.change(screen.getByPlaceholderText("+ Add ability or spell…"), {
      target: { value: "Counterspell" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCommitNpcCombat).not.toHaveBeenCalled();
    expect(screen.getByText("Magic Missile")).toBeInTheDocument();
    expect(screen.queryByText("Counterspell")).not.toBeInTheDocument();
  });

  it("commits a trimmed ability array after add and remove edits", async () => {
    const onCommitNpcCombat = vi.fn(async () => true);
    const initialNpcCombat = {
      npcs: [
        {
          id: "npc-1",
          name: "Goblin Mage",
          hpMax: 7,
          hpCurrent: 7,
          conditions: [],
          initiativeEntryId: null,
          abilities: ["Magic Missile"],
        },
      ],
    };

    const { rerender } = renderSection({
      npcCombat: initialNpcCombat,
      initiative: { activeTurnIndex: 0, entries: [] },
      onCommitNpcCombat,
    });

    // Inactive NPCs collapse by default (Story 29b) — expand to reach the ability block.
    fireEvent.click(screen.getByRole("button", { name: "Expand card" }));

    fireEvent.click(screen.getByTitle("Edit abilities"));
    fireEvent.click(screen.getByTitle("Remove"));
    fireEvent.change(screen.getByPlaceholderText("+ Add ability or spell…"), {
      target: { value: "  Counterspell  " },
    });
    fireEvent.keyDown(screen.getByPlaceholderText("+ Add ability or spell…"), { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    await waitFor(() => expect(onCommitNpcCombat).toHaveBeenCalledTimes(1));

    expect(getCommittedNpcCombat(onCommitNpcCombat).npcs[0].abilities).toEqual(["Counterspell"]);

    rerender(
      <PalCtx.Provider value={PALETTES.vellum}>
        <NpcCombatSection
          npcCombat={getCommittedNpcCombat(onCommitNpcCombat)}
          initiative={{ activeTurnIndex: 0, entries: [] }}
          dmPassword="secret"
          onUpdate={vi.fn()}
          onCommitNpcCombat={onCommitNpcCombat}
        />
      </PalCtx.Provider>
    );

    expect(screen.getByText("Counterspell")).toBeInTheDocument();
    expect(screen.queryByText("Magic Missile")).not.toBeInTheDocument();
  });

  it("returns to the empty state after removing all abilities and saving", async () => {
    const onCommitNpcCombat = vi.fn(async () => true);

    const { rerender } = renderSection({
      npcCombat: {
        npcs: [
          {
            id: "npc-1",
            name: "Goblin Mage",
            hpMax: 7,
            hpCurrent: 7,
            conditions: [],
            initiativeEntryId: null,
            abilities: ["Magic Missile"],
          },
        ],
      },
      initiative: { activeTurnIndex: 0, entries: [] },
      onCommitNpcCombat,
    });

    // Inactive NPCs collapse by default (Story 29b) — expand to reach the ability block.
    fireEvent.click(screen.getByRole("button", { name: "Expand card" }));

    fireEvent.click(screen.getByTitle("Edit abilities"));
    fireEvent.click(screen.getByTitle("Remove"));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    await waitFor(() => expect(onCommitNpcCombat).toHaveBeenCalledTimes(1));

    expect(getCommittedNpcCombat(onCommitNpcCombat).npcs[0].abilities).toEqual([]);

    rerender(
      <PalCtx.Provider value={PALETTES.vellum}>
        <NpcCombatSection
          npcCombat={getCommittedNpcCombat(onCommitNpcCombat)}
          initiative={{ activeTurnIndex: 0, entries: [] }}
          dmPassword="secret"
          onUpdate={vi.fn()}
          onCommitNpcCombat={onCommitNpcCombat}
        />
      </PalCtx.Provider>
    );

    expect(screen.getByRole("button", { name: "+ Ability reference" })).toBeInTheDocument();
  });
});
