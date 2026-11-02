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

  it("drags a row by its grip to a new place, re-sorting live, and saves on release", () => {
    const props = renderTracker({
      initiative: {
        entries: [
          { id: "a", slug: "aragorn", name: "Aragorn", initiative: 18, isPC: true, npcId: null },
          { id: "b", slug: "liu-sha", name: "Liu Sha", initiative: 14, isPC: true, npcId: null },
          { id: "c", name: "Goblin", initiative: 9, isPC: false, npcId: null },
        ],
        activeTurnIndex: 0,
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Modify Order" }));
    // Rows 40px tall, stacked from the top (jsdom has no layout).
    document.querySelectorAll(".init-list > .init-entry").forEach((row, i) => {
      row.getBoundingClientRect = () => ({ top: i * 40, height: 40, bottom: i * 40 + 40, left: 0, right: 200, width: 200 });
    });
    const grip = screen.getByRole("button", { name: "Drag to move Aragorn" });
    fireEvent.pointerDown(grip, { button: 0, clientY: 20, pointerId: 1 });
    fireEvent.pointerMove(window, { clientY: 110, pointerId: 1 });
    // Live: Aragorn now shows last.
    expect([...document.querySelectorAll(".init-name")].map((n) => n.textContent)).toEqual(["Liu Sha", "Goblin", "Aragorn"]);
    expect(props.onCommitInitiative).not.toHaveBeenCalled();
    fireEvent.pointerUp(window, { clientY: 110, pointerId: 1 });
    const [payload] = props.onCommitInitiative.mock.calls[0];
    expect(payload.entries.map((e) => e.id)).toEqual(["b", "c", "a"]);
  });
});
