import { render, screen } from "@testing-library/react";
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
    ...props,
  };

  return render(
    <PalCtx.Provider value={PALETTES.vellum}>
      <NpcCombatSection {...defaultProps} />
    </PalCtx.Provider>
  );
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
});
