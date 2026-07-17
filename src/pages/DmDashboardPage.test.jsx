import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  getDmParty: vi.fn(),
  listCharacters: vi.fn(),
  getPartyRoster: vi.fn(),
  putPartyRoster: vi.fn(),
  patchSession: vi.fn(),
  getInitiative: vi.fn(),
  putInitiative: vi.fn(),
  getNpcCombat: vi.fn(),
  putNpcCombat: vi.fn(),
  getRollHistory: vi.fn(),
  getMapLibrary: vi.fn(),
  getNpcLibrary: vi.fn(),
  putNpcLibrary: vi.fn(),
  getCounterWheels: vi.fn(),
  putCounterWheels: vi.fn(),
  presignNpcPortrait: vi.fn(),
}));

vi.mock("../api", () => ({
  getDmParty: apiMocks.getDmParty,
  listCharacters: apiMocks.listCharacters,
  getPartyRoster: apiMocks.getPartyRoster,
  putPartyRoster: apiMocks.putPartyRoster,
  patchSession: apiMocks.patchSession,
  getInitiative: apiMocks.getInitiative,
  putInitiative: apiMocks.putInitiative,
  getNpcCombat: apiMocks.getNpcCombat,
  putNpcCombat: apiMocks.putNpcCombat,
  getRollHistory: apiMocks.getRollHistory,
  getMapLibrary: apiMocks.getMapLibrary,
  getNpcLibrary: apiMocks.getNpcLibrary,
  putNpcLibrary: apiMocks.putNpcLibrary,
  getCounterWheels: apiMocks.getCounterWheels,
  putCounterWheels: apiMocks.putCounterWheels,
  presignNpcPortrait: apiMocks.presignNpcPortrait,
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
    apiMocks.getInitiative.mockResolvedValue({ entries: [], activeTurnIndex: 0 });
    apiMocks.getNpcCombat.mockResolvedValue({ npcs: [] });
    apiMocks.getRollHistory.mockResolvedValue({ rolls: [] });
    apiMocks.getMapLibrary.mockResolvedValue({ activeMapId: null, maps: [] });
    apiMocks.getNpcLibrary.mockResolvedValue({ templates: [] });
    apiMocks.getCounterWheels.mockResolvedValue({ wheels: [] });
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
