import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getSessionState: vi.fn(),
  putHouseRules: vi.fn(),
}));
vi.mock("../api", () => api);

import DmSettingsPage from "./DmSettingsPage";

describe("DmSettingsPage", () => {
  beforeEach(() => {
    sessionStorage.setItem("dnd_dm_password", "swordfish");
    api.getSessionState.mockResolvedValue({ houseRules: { abilityCheckDice: "2d6" } });
    api.putHouseRules.mockImplementation(async (_pw, rules) => ({ houseRules: rules }));
  });
  afterEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  function renderPage() {
    return render(<MemoryRouter><DmSettingsPage /></MemoryRouter>);
  }

  it("loads the current ability-check dice and saves a change", async () => {
    renderPage();
    const input = await screen.findByDisplayValue("2d6");
    expect(screen.getByText("Save")).toBeDisabled();
    fireEvent.change(input, { target: { value: "1D20" } });
    expect(screen.getByText("1d20+2")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Save"));
    await waitFor(() => expect(api.putHouseRules).toHaveBeenCalledWith("swordfish", { abilityCheckDice: "1d20" }));
    expect(await screen.findByText(/Saved/)).toBeInTheDocument();
  });

  it("blocks invalid dice", async () => {
    renderPage();
    const input = await screen.findByDisplayValue("2d6");
    fireEvent.change(input, { target: { value: "2d6+1" } });
    expect(screen.getByText(/Use a format like/)).toBeInTheDocument();
    expect(screen.getByText("Save")).toBeDisabled();
  });
});
