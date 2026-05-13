import { render, screen, waitFor } from "@testing-library/react";
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
}));

vi.mock("../components/DmDiceRoller", () => ({
  default: () => <div data-testid="dm-dice-roller" />,
}));

vi.mock("../features/dmDashboard/CharacterCard", () => ({
  default: () => <div data-testid="character-card" />,
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

import DmDashboardPage from "./DmDashboardPage";

describe("DmDashboardPage auth refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    apiMocks.listCharacters.mockResolvedValue([]);
    apiMocks.getPartyRoster.mockResolvedValue({ exists: false, members: [] });
    apiMocks.getMapLibrary.mockResolvedValue({ activeMapId: null, maps: [] });
  });

  it("shows the checking loader instead of the password prompt while stored DM creds are being verified", () => {
    sessionStorage.setItem("dnd_dm_password", "swordfish");
    apiMocks.getDmParty.mockImplementation(() => new Promise(() => {}));

    render(<DmDashboardPage />);

    expect(screen.getByText("Checking DM Access")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Password")).not.toBeInTheDocument();
  });

  it("falls back to the DM password prompt when stored creds are invalid", async () => {
    sessionStorage.setItem("dnd_dm_password", "expired");
    apiMocks.getDmParty.mockRejectedValueOnce(new Error("forbidden"));

    render(<DmDashboardPage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Password")).toBeInTheDocument();
    });

    expect(sessionStorage.getItem("dnd_dm_password")).toBe(null);
  });
});
