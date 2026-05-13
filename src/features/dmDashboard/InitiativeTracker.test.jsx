import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import InitiativeTracker from "./InitiativeTracker";
import { PalCtx } from "./dashboardShared";
import { PALETTES } from "../characterSheet/theme";

function renderTracker(props = {}) {
  const defaultProps = {
    initiative: {
      entries: [
        { id: "entry-1", slug: "aragorn", name: "Aragorn", initiative: 15, isPC: true, npcId: null },
      ],
      activeTurnIndex: 0,
    },
    party: [
      { slug: "aragorn", name: "Aragorn" },
      { slug: "liu-sha", name: "Liu Sha" },
    ],
    npcCombat: {
      npcs: [
        { id: "npc-1", name: "Goblin", hpCurrent: 7, hpMax: 7, initiativeEntryId: null },
      ],
    },
    onCommitInitiative: vi.fn(() => Promise.resolve()),
    onPromoteToNpc: vi.fn(),
    ...props,
  };

  render(
    <PalCtx.Provider value={PALETTES.ocean}>
      <InitiativeTracker {...defaultProps} />
    </PalCtx.Provider>
  );

  return defaultProps;
}

describe("InitiativeTracker optimistic updates", () => {
  it("adds an available character with optimistic initiative commit", async () => {
    const props = renderTracker();

    fireEvent.click(screen.getByRole("button", { name: "+" }));

    expect(props.onCommitInitiative).toHaveBeenCalledTimes(1);
    const [payload, options] = props.onCommitInitiative.mock.calls[0];
    expect(payload.entries).toHaveLength(2);
    expect(payload.entries[1]).toMatchObject({
      slug: "liu-sha",
      name: "Liu Sha",
      isPC: true,
    });
    expect(options).toEqual({ optimistic: true });
  });

  it("adds a manual combatant with optimistic initiative commit", async () => {
    const props = renderTracker();

    fireEvent.change(screen.getByPlaceholderText("Name…"), { target: { value: "Goblin" } });
    fireEvent.change(screen.getByPlaceholderText("Init"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(props.onCommitInitiative).toHaveBeenCalledTimes(1);
    const [payload, options] = props.onCommitInitiative.mock.calls[0];
    expect(payload.entries).toHaveLength(2);
    expect(payload.entries[1]).toMatchObject({
      name: "Goblin",
      initiative: 12,
      isPC: false,
    });
    expect(options).toEqual({ optimistic: true });
  });

  it("reorders initiative entries when moving an entry down", async () => {
    const props = renderTracker({
      initiative: {
        entries: [
          { id: "entry-1", slug: "aragorn", name: "Aragorn", initiative: 15, isPC: true, npcId: null },
          { id: "entry-2", slug: "liu-sha", name: "Liu Sha", initiative: 12, isPC: true, npcId: null },
        ],
        activeTurnIndex: 0,
      },
      party: [
        { slug: "aragorn", name: "Aragorn" },
        { slug: "liu-sha", name: "Liu Sha" },
      ],
    });

    fireEvent.click(screen.getByRole("button", { name: "Modify Order" }));
    const downButtons = screen.getAllByTitle("Move down");
    fireEvent.click(downButtons[0]);

    expect(props.onCommitInitiative).toHaveBeenCalledTimes(1);
    const [payload, options] = props.onCommitInitiative.mock.calls[0];
    expect(payload.entries.map((entry) => entry.id)).toEqual(["entry-2", "entry-1"]);
    expect(payload.activeTurnIndex).toBe(1);
    expect(options).toEqual({ optimistic: true });
  });
});
