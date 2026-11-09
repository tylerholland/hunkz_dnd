import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { abilityCheck, checkBonus, checkName, dcPresets, rollFor, savingThrow, skillCheck } from "./rollCheck";
import AskRollModal from "./AskRollModal";
import PlayerRollPrompt from "./PlayerRollPrompt";

vi.mock("../../api", () => ({ postRollResult: vi.fn(async () => ({})) }));
import { postRollResult } from "../../api";

const stat = (s) => ["Strength", "Dexterity", "Constitution", "Wisdom", "Intelligence", "Charisma"].map((name, i) => ({ stat: name, score: s[i] }));
const eoghan = { slug: "eoghan", name: "Eòghan", level: 3, palette: "ocean", stats: stat([12, 16, 12, 14, 10, 8]), skills: ["perception", "survival"] };
const liu = { slug: "liu", name: "Liu Sha", level: 3, palette: "ember", stats: stat([8, 18, 12, 12, 14, 12]), skills: [] };

describe("roll checks", () => {
  it("names checks and works out the bonus under the house rule", () => {
    expect(checkName(skillCheck("perception"))).toBe("Wisdom (Perception)");
    expect(checkName(savingThrow("dex"))).toBe("Dexterity save");
    expect(checkName(abilityCheck("str"))).toBe("Strength check");
    expect(checkBonus(eoghan, skillCheck("perception"), { skillBonus: "none" })).toBe(2);
    expect(checkBonus(eoghan, skillCheck("perception"), { skillBonus: "proficiency" })).toBe(4);
    expect(checkBonus(eoghan, skillCheck("stealth"), { skillBonus: "proficiency" })).toBe(3); // not listed: DEX only
  });

  it("rolls the dice with advantage as one extra die, keeping the best", () => {
    const dice = [6, 1, 4];
    const r = rollFor("2d6", 2, "adv", () => dice.shift());
    expect(r).toEqual({ total: 12, rolls: [4, 6], dropped: 1 });
    expect(dcPresets("2d6")).toEqual([7, 10, 12]);
    expect(dcPresets("1d20")).toEqual([10, 12, 15, 20]);
  });
});

describe("Ask for a Roll", () => {
  it("starts with nobody picked; sends who, the check and the DC", async () => {
    const onSend = vi.fn(async () => true);
    render(<AskRollModal members={[eoghan, liu]} rules={{ abilityCheckDice: "2d6" }} onSend={onSend} onClose={() => {}} />);
    expect(screen.getByRole("button", { name: "Pick who rolls" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /Liu Sha/ }));
    fireEvent.click(screen.getByRole("button", { name: "Investigation" }));
    fireEvent.click(screen.getByRole("button", { name: "DC 10" }));
    fireEvent.change(screen.getByPlaceholderText("Searching the Guildmaster's study"), { target: { value: "The study" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask Liu Sha" }));
    await waitFor(() => expect(onSend).toHaveBeenCalled());
    expect(onSend.mock.calls[0][0]).toEqual({ targets: ["liu"], check: skillCheck("investigation"), dc: 10, showDc: false, adv: "normal", label: "The study" });
  });
});

describe("the player's roll prompt", () => {
  beforeEach(() => { localStorage.clear(); postRollResult.mockClear(); });
  const request = { id: "r1", check: skillCheck("perception"), dice: "2d6", adv: "normal", dc: null, mine: null, revealed: false };

  it("shows the roll loaded with their bonus and sends the result", async () => {
    render(<PlayerRollPrompt requests={[request]} char={eoghan} rules={{ skillBonus: "none" }} slug="eoghan" password="pw" />);
    fireEvent.click(screen.getByRole("button", { name: "Roll 2d6 +2" }));
    await waitFor(() => expect(postRollResult).toHaveBeenCalled());
    const [slug, pw, id, result] = postRollResult.mock.calls[0];
    expect([slug, pw, id, result.manual]).toEqual(["eoghan", "pw", "r1", false]);
    expect(await screen.findByText(/sent to the DM/)).toBeInTheDocument();
  });

  it("takes a total from real dice, and shows everyone's once revealed", async () => {
    const { rerender } = render(<PlayerRollPrompt requests={[request]} char={eoghan} rules={{}} slug="eoghan" password="pw" />);
    fireEvent.change(screen.getByLabelText("Your total"), { target: { value: "9" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(postRollResult.mock.calls[0][3]).toEqual({ total: 9, rolls: [], manual: true }));
    rerender(<PlayerRollPrompt requests={[{ ...request, mine: { total: 9, manual: true }, revealed: true, results: [{ slug: "eoghan", total: 9 }, { slug: "liu", total: 11 }] }]} char={eoghan} rules={{}} slug="eoghan" password="pw" members={[eoghan, liu]} />);
    expect(screen.getByText("Liu Sha")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(screen.queryByText("The DM asks for a roll")).not.toBeInTheDocument();
  });
});
