import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getSessionState: vi.fn(),
  putHouseRules: vi.fn(),
  listCharacters: vi.fn(),
  updateCharacter: vi.fn(),
}));
vi.mock("../api", () => api);

import DmSettingsPage from "./DmSettingsPage";

describe("DmSettingsPage", () => {
  beforeEach(() => {
    sessionStorage.setItem("dnd_dm_password", "swordfish");
    api.getSessionState.mockResolvedValue({ houseRules: { abilityCheckDice: "2d6" } });
    api.putHouseRules.mockImplementation(async (_pw, rules) => ({ houseRules: rules }));
    api.listCharacters.mockResolvedValue([{ slug: "quietclaw", name: "Quietclaw" }, { slug: "aesop", name: "Aesop" }]);
    api.updateCharacter.mockResolvedValue({});
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
    await waitFor(() => expect(api.putHouseRules).toHaveBeenCalledWith("swordfish", { abilityCheckDice: "1d20", featuresEnabled: true }));
    expect(await screen.findByText(/Saved/)).toBeInTheDocument();
  });

  it("turns Features & Traits off and on", async () => {
    renderPage();
    const toggle = await screen.findByRole("switch");
    expect(toggle).toHaveAttribute("aria-checked", "true");
    fireEvent.click(toggle);
    await waitFor(() => expect(api.putHouseRules).toHaveBeenCalledWith("swordfish", { abilityCheckDice: "2d6", featuresEnabled: false }));
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  it("blocks invalid dice", async () => {
    renderPage();
    const input = await screen.findByDisplayValue("2d6");
    fireEvent.change(input, { target: { value: "2d6+1" } });
    expect(screen.getByText(/Use a format like/)).toBeInTheDocument();
    expect(screen.getByText("Save")).toBeDisabled();
  });

  it("resets a player's password to a temporary one after a confirm step", async () => {
    renderPage();
    await screen.findByRole("option", { name: "Quietclaw" });
    const reset = screen.getByRole("button", { name: "Reset password" });
    expect(reset).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Character"), { target: { value: "quietclaw" } });
    fireEvent.change(screen.getByLabelText("Temporary password"), { target: { value: "crackle123" } });
    fireEvent.click(reset);
    expect(api.updateCharacter).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm: reset Quietclaw" }));
    await waitFor(() => expect(api.updateCharacter).toHaveBeenCalledWith("quietclaw", { newPassword: "crackle123" }, "swordfish"));
    expect(await screen.findByText(/Quietclaw can now sign in/)).toBeInTheDocument();
    expect(screen.getByLabelText("Temporary password")).toHaveValue("");
  });

  it("says so when the reset fails", async () => {
    api.updateCharacter.mockRejectedValue(Object.assign(new Error("nope"), { status: 403 }));
    renderPage();
    await screen.findByRole("option", { name: "Aesop" });
    fireEvent.change(screen.getByLabelText("Character"), { target: { value: "aesop" } });
    fireEvent.change(screen.getByLabelText("Temporary password"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm: reset Aesop" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("DM password rejected");
  });
});
