import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
import { DEFAULT_MONEY } from "../lib/money";

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
    expect(screen.getAllByText("Save")[0]).toBeDisabled();
    fireEvent.change(input, { target: { value: "1D20" } });
    expect(screen.getByText("1d20+2")).toBeInTheDocument();
    fireEvent.click(screen.getAllByText("Save")[0]);
    await waitFor(() => expect(api.putHouseRules).toHaveBeenCalledWith("swordfish", { abilityCheckDice: "1d20", featuresEnabled: true, spellCastDice: "1d20", playersEndTurn: true, customEffects: [], money: DEFAULT_MONEY, npcAttackDice: "1d20+3", weaponDamage: "wod", saveDice: "1d20", skillBonus: "none", initiativeDice: "1d20", autoInitiative: true }));
    expect(await screen.findByText(/Saved/)).toBeInTheDocument();
  });

  it("switches weapon damage to D&D 5e", async () => {
    renderPage();
    await screen.findByText(/By class: light weapons d6/);
    const group = screen.getByRole("group", { name: "Weapon damage" });
    expect(within(group).getByRole("button", { name: "World of Dungeons" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(group).getByRole("button", { name: "D&D 5e" }));
    expect(screen.getByText(/dagger d4, short sword d6/)).toBeInTheDocument();
    const card = group.closest("section");
    fireEvent.click(within(card).getByText("Save"));
    await waitFor(() => expect(api.putHouseRules).toHaveBeenCalledWith("swordfish", expect.objectContaining({ weaponDamage: "dnd", abilityCheckDice: "2d6" })));
  });

  it("turns Features & Traits off and on", async () => {
    renderPage();
    const toggle = await screen.findByRole("switch", { name: "Features & Traits" });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    fireEvent.click(toggle);
    await waitFor(() => expect(api.putHouseRules).toHaveBeenCalledWith("swordfish", { abilityCheckDice: "2d6", featuresEnabled: false, spellCastDice: "1d20", playersEndTurn: true, customEffects: [], money: DEFAULT_MONEY, npcAttackDice: "1d20+3", weaponDamage: "wod", saveDice: "1d20", skillBonus: "none", initiativeDice: "1d20", autoInitiative: true }));
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  it("blocks invalid dice", async () => {
    renderPage();
    const input = await screen.findByDisplayValue("2d6");
    fireEvent.change(input, { target: { value: "2d6+1" } });
    expect(screen.getByText(/Use a format like/)).toBeInTheDocument();
    expect(screen.getAllByText("Save")[0]).toBeDisabled();
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

  it("switches copper on and re-rates gold in the Money card", async () => {
    renderPage();
    // The card remounts once the rules load, so query after that.
    await waitFor(() => expect(screen.getByRole("switch", { name: "Copper" })).toBeEnabled());
    const copper = screen.getByRole("switch", { name: "Copper" });
    expect(screen.getByRole("switch", { name: "Silver" })).toBeDisabled();
    fireEvent.click(copper);
    fireEvent.change(screen.getByLabelText("Gold worth in silver"), { target: { value: "50" } });
    const moneyCard = screen.getByRole("heading", { name: "Money" }).closest("section");
    fireEvent.click(within(moneyCard).getByText("Save"));
    await waitFor(() => expect(api.putHouseRules).toHaveBeenCalled());
    const { money } = api.putHouseRules.mock.calls[0][1];
    expect(money.coins.cp).toEqual({ on: true, rate: 0.1 });
    expect(money.coins.gp).toEqual({ on: true, rate: 50 });
  });

  it("saves the saving throw dice, what a proficient skill adds, and initiative", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByRole("group", { name: "Saving throw dice" })).toBeInTheDocument());
    const card = within(screen.getByRole("group", { name: "Saving throw dice" }).closest("section"));
    const saves = within(screen.getByRole("group", { name: "Saving throw dice" }));
    await waitFor(() => expect(saves.getByRole("button", { name: "2d6" })).not.toBeDisabled());
    fireEvent.click(saves.getByRole("button", { name: "2d6" }));
    fireEvent.click(card.getByRole("button", { name: "Proficiency bonus (5e)" }));
    fireEvent.click(card.getByRole("switch", { name: "Ask everyone for initiative when combat starts" }));
    fireEvent.click(card.getByText("Save"));
    await waitFor(() => expect(api.putHouseRules).toHaveBeenCalledWith("swordfish", expect.objectContaining({ saveDice: "2d6", skillBonus: "proficiency", initiativeDice: "1d20", autoInitiative: false, abilityCheckDice: "2d6" })));
  });

  it("saves the spell casting dice separately from ability checks", async () => {
    renderPage();
    // The card remounts once the rules load, so query after that.
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Spell casting dice" })).toHaveValue("1d20"));
    const spellCard = within(screen.getByRole("textbox", { name: "Spell casting dice" }).closest("section"));
    fireEvent.click(spellCard.getByRole("button", { name: "2d6" }));
    fireEvent.click(spellCard.getByText("Save"));
    await waitFor(() => expect(api.putHouseRules).toHaveBeenCalledWith("swordfish", { abilityCheckDice: "2d6", featuresEnabled: true, spellCastDice: "2d6", playersEndTurn: true, customEffects: [], money: DEFAULT_MONEY, npcAttackDice: "1d20+3", weaponDamage: "wod", saveDice: "1d20", skillBonus: "none", initiativeDice: "1d20", autoInitiative: true }));
  });

  it("turns player turn-ending off", async () => {
    renderPage();
    const toggle = await screen.findByRole("switch", { name: "Players can end their own turn" });
    await waitFor(() => expect(toggle).not.toBeDisabled());
    expect(toggle).toHaveAttribute("aria-checked", "true");
    fireEvent.click(toggle);
    await waitFor(() => expect(api.putHouseRules).toHaveBeenCalledWith("swordfish", expect.objectContaining({ playersEndTurn: false })));
  });
});

describe("DmSettingsPage NPC attack roll", () => {
  beforeEach(() => {
    sessionStorage.setItem("dnd_dm_password", "swordfish");
    api.getSessionState.mockResolvedValue({ houseRules: { abilityCheckDice: "2d6" } });
    api.putHouseRules.mockImplementation(async (_pw, rules) => ({ houseRules: rules }));
    api.listCharacters.mockResolvedValue([]);
  });
  afterEach(() => { sessionStorage.clear(); vi.clearAllMocks(); });

  it("keeps the standard 1d20+3 or saves the DM's own roll", async () => {
    render(<MemoryRouter><DmSettingsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole("button", { name: "Your own" })).toBeEnabled());
    const card = screen.getByRole("heading", { name: "NPC attack roll" }).closest("section");
    expect(within(card).getByText(/Hits AC 12 about/)).toHaveTextContent("60%");
    fireEvent.click(within(card).getByRole("button", { name: "Your own" }));
    fireEvent.change(within(card).getByLabelText("Your NPC attack roll"), { target: { value: "1d20 + 5" } });
    fireEvent.click(within(card).getByText("Save"));
    await waitFor(() => expect(api.putHouseRules).toHaveBeenCalled());
    expect(api.putHouseRules.mock.calls[0][1].npcAttackDice).toBe("1d20+5");
  });
});
