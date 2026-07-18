import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BACKGROUND_POLL_MS } from "../lib/liveSync";

const apiMocks = vi.hoisted(() => ({
  getDmParty: vi.fn(),
  listCharacters: vi.fn(),
  getPartyRoster: vi.fn(),
  putPartyRoster: vi.fn(),
  patchSession: vi.fn(),
  putInitiative: vi.fn(),
  putNpcCombat: vi.fn(),
  getNpcLibrary: vi.fn(),
  putNpcLibrary: vi.fn(),
  getCounterWheels: vi.fn(),
  putCounterWheels: vi.fn(),
  presignNpcPortrait: vi.fn(),
  getSessionState: vi.fn(),
}));

vi.mock("../api", () => ({
  getDmParty: apiMocks.getDmParty,
  listCharacters: apiMocks.listCharacters,
  getPartyRoster: apiMocks.getPartyRoster,
  putPartyRoster: apiMocks.putPartyRoster,
  patchSession: apiMocks.patchSession,
  putInitiative: apiMocks.putInitiative,
  putNpcCombat: apiMocks.putNpcCombat,
  getNpcLibrary: apiMocks.getNpcLibrary,
  putNpcLibrary: apiMocks.putNpcLibrary,
  getCounterWheels: apiMocks.getCounterWheels,
  putCounterWheels: apiMocks.putCounterWheels,
  presignNpcPortrait: apiMocks.presignNpcPortrait,
  getSessionState: apiMocks.getSessionState,
}));

vi.mock("../components/DmDiceRoller", () => ({
  default: () => <div data-testid="dm-dice-roller" />,
}));

vi.mock("../features/dmDashboard/CharacterCard", () => ({
  default: () => <div data-testid="character-card" />,
  AwardXpModal: () => null,
  DistributeCoinModal: () => null,
}));

vi.mock("../features/dmDashboard/ConfirmDialog", () => ({
  default: () => <div data-testid="confirm-dialog" />,
}));

vi.mock("../features/dmDashboard/InitiativeTracker", () => ({
  default: () => <div data-testid="initiative-tracker" />,
}));

vi.mock("../features/dmDashboard/NpcCombatSection", () => ({
  default: () => <div data-testid="npc-combat-section" />,
}));

vi.mock("../features/dmDashboard/MapPanel", () => ({
  default: () => <div data-testid="map-panel" />,
}));

vi.mock("../features/dmDashboard/MapLibraryStrip", () => ({
  default: () => <div data-testid="map-library-strip" />,
}));

vi.mock("../features/dmDashboard/ManagePartyModal", () => ({
  default: () => null,
}));

import DmDashboardPage from "./DmDashboardPage";

describe("DmDashboardPage text scaling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    apiMocks.getDmParty.mockResolvedValue([]);
    apiMocks.listCharacters.mockResolvedValue([]);
    apiMocks.getPartyRoster.mockResolvedValue({ exists: false, members: [] });
    apiMocks.getNpcLibrary.mockResolvedValue({ templates: [] });
    apiMocks.getCounterWheels.mockResolvedValue({ wheels: [] });
    apiMocks.getSessionState.mockResolvedValue({
      party: [],
      initiative: { entries: [], activeTurnIndex: 0 },
      npcCombat: { npcs: [] },
      rollHistory: { rolls: [] },
      mapLibrary: { activeMapId: null, maps: [] },
      counterWheels: { wheels: [] },
      serverTime: "2026-07-17T00:00:00.000Z",
    });
  });

  it("adjusts and persists dashboard text scale from the action menu", async () => {
    sessionStorage.setItem("dnd_dm_password", "swordfish");

    render(
      <MemoryRouter>
        <DmDashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "All Actions" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "All Actions" }));

    expect(screen.getByText("Text Size")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Increase text size" }));

    await waitFor(() => {
      expect(screen.getByText("110%")).toBeInTheDocument();
    });

    expect(sessionStorage.getItem("dnd_dm_text_scale")).toBe("1.1");
  });
});

describe("DmDashboardPage polling (Story 35 consolidation)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    sessionStorage.clear();
    apiMocks.getDmParty.mockResolvedValue([]);
    apiMocks.listCharacters.mockResolvedValue([]);
    apiMocks.getPartyRoster.mockResolvedValue({ exists: false, members: [] });
    apiMocks.getNpcLibrary.mockResolvedValue({ templates: [] });
    apiMocks.getCounterWheels.mockResolvedValue({ wheels: [] });
    apiMocks.getSessionState.mockResolvedValue({
      party: [],
      initiative: { entries: [], activeTurnIndex: 0 },
      npcCombat: { npcs: [] },
      rollHistory: { rolls: [] },
      mapLibrary: { activeMapId: null, maps: [] },
      counterWheels: { wheels: [] },
      serverTime: "2026-07-17T00:00:00.000Z",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("issues exactly one getSessionState request per poll tick", async () => {
    sessionStorage.setItem("dnd_dm_password", "swordfish");

    render(
      <MemoryRouter>
        <DmDashboardPage />
      </MemoryRouter>
    );

    // Flush the mount-time auth check + the initial consolidated fetch.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const callsAfterMount = apiMocks.getSessionState.mock.calls.length;
    expect(callsAfterMount).toBeGreaterThan(0);
    expect(apiMocks.getSessionState).toHaveBeenLastCalledWith({ dmPassword: "swordfish" });

    // jsdom reports document.hasFocus() === false, so polling runs at the
    // backgrounded cadence — advance by exactly one tick.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(BACKGROUND_POLL_MS);
    });

    expect(apiMocks.getSessionState.mock.calls.length).toBe(callsAfterMount + 1);
  });
});
