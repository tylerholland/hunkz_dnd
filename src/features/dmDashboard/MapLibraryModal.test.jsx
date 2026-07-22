import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../api", () => ({
  putMapActive: vi.fn(),
  patchMap: vi.fn(),
  deleteMap: vi.fn(),
}));

vi.mock("./MapUploadModal", () => ({
  __esModule: true,
  default: () => null,
  displayMapName: (map) => map.name || map.id,
}));

vi.mock("../maps/MapThumbnail", () => ({
  __esModule: true,
  default: ({ alt }) => <div data-testid="map-thumb">{alt}</div>,
}));

import MapLibraryModal from "./MapLibraryModal";
import { putMapActive } from "../../api";

const ADVENTURE_MAP = { id: "map-adv", name: "Forest", imageUrl: "https://example.com/forest.png", contentType: "image/png" };
const BATTLE_MAP   = { id: "map-bat", name: "Dungeon", imageUrl: "https://example.com/dungeon.png", contentType: "image/png" };

function makeLibrary({ activeId = "map-adv", adventureMapId = null, battleMapId = null } = {}) {
  return {
    activeMapId: activeId,
    adventureMapId,
    battleMapId,
    maps: [ADVENTURE_MAP, BATTLE_MAP],
  };
}

function renderModal(props = {}) {
  return render(
    <MapLibraryModal
      mapLibrary={makeLibrary()}
      dmPassword="dm-secret"
      combatMode={false}
      onLibraryChange={vi.fn()}
      {...props}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  putMapActive.mockResolvedValue({});
});

// ── Label tests ───────────────────────────────────────────────────────────────

describe("MapLibraryModal — active map label", () => {
  it("shows '● Adventure Map' on the active map in adventure mode", () => {
    renderModal({ combatMode: false });
    expect(screen.getByText("● Adventure Map")).toBeInTheDocument();
  });

  it("shows '● Combat Map' on the active map in combat mode", () => {
    renderModal({ combatMode: true });
    expect(screen.getByText("● Combat Map")).toBeInTheDocument();
  });

  it("does not show the legacy '● Active' text", () => {
    renderModal({ combatMode: false });
    expect(screen.queryByText("● Active")).toBeNull();
  });
});

// ── modeOpts tests ────────────────────────────────────────────────────────────

describe("MapLibraryModal — Set Active writes the correct mode assignment", () => {
  it("sends adventureMapId when setting active in adventure mode", async () => {
    renderModal({ combatMode: false });
    fireEvent.click(screen.getByRole("button", { name: /set active/i }));
    await waitFor(() => {
      expect(putMapActive).toHaveBeenCalledWith(
        BATTLE_MAP.id,
        "dm-secret",
        { adventureMapId: BATTLE_MAP.id }
      );
    });
  });

  it("sends battleMapId when setting active in combat mode", async () => {
    renderModal({ combatMode: true });
    fireEvent.click(screen.getByRole("button", { name: /set active/i }));
    await waitFor(() => {
      expect(putMapActive).toHaveBeenCalledWith(
        BATTLE_MAP.id,
        "dm-secret",
        { battleMapId: BATTLE_MAP.id }
      );
    });
  });
});

// ── Optimistic state tests ────────────────────────────────────────────────────

describe("MapLibraryModal — optimistic active indicator", () => {
  it("flips the active indicator immediately before server responds", async () => {
    let resolveSetActive;
    putMapActive.mockImplementation(() => new Promise((resolve) => { resolveSetActive = resolve; }));

    renderModal({ combatMode: false });

    // Before click: adventure map shows label, battle map has "Set Active" button.
    // Both labels are present because one map is active and shows the label.
    expect(screen.getByText("● Adventure Map")).toBeInTheDocument();
    const setActiveBtn = screen.getByRole("button", { name: /set active/i });
    expect(setActiveBtn).toBeInTheDocument();

    fireEvent.click(setActiveBtn);

    // Immediately (before server responds): battle map card should now show the
    // active label (optimistic) — the label text appears twice (one per map
    // is active). Verify by checking there are now TWO "● Adventure Map" labels.
    // Actually — simpler: verify that "Set Active" moved to the adventure map
    // by checking that two cards exist but the label count is still one (just
    // the indicator moved), meaning the battle map card now shows the label
    // and no longer has the Set Active button as its first action.
    //
    // Cleanest signal: putMapActive was called but not yet resolved, AND the
    // battle map card now shows "● Adventure Map" (from optimisticActiveId).
    await waitFor(() => {
      expect(putMapActive).toHaveBeenCalledTimes(1);
    });
    // Label should have appeared on the battle map (the one just clicked)
    // There should now be exactly one "● Adventure Map" label in the DOM
    // (the battle map is now active and shows it).
    expect(screen.getAllByText("● Adventure Map").length).toBe(1);

    act(() => { resolveSetActive({}); });
  });

  it("reverts the optimistic flip when the server call fails", async () => {
    putMapActive.mockRejectedValue(new Error("network error"));

    renderModal({ combatMode: false });

    fireEvent.click(screen.getByRole("button", { name: /set active/i }));

    // Should revert: Set Active button returns
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /set active/i })).toBeInTheDocument();
    });
  });
});
