import { createRef } from "react";
import { act } from "react";
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  postCharacterRoll: vi.fn(),
}));

vi.mock("../api", () => ({
  postCharacterRoll: apiMocks.postCharacterRoll,
}));

import DiceRoller from "./DiceRoller";
import { PALETTES } from "../features/characterSheet/theme";

afterEach(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  vi.clearAllMocks();
  apiMocks.postCharacterRoll.mockResolvedValue({ success: true });
});

// Story 57 (ADR-027) — `rollAttack` is a new entry point on the same
// imperative handle `rollAbility` already used, extending `executeRoll`
// rather than forking it.
describe("DiceRoller.rollAttack (imperative handle, Story 57)", () => {
  const attackEntry = { id: "w1", kind: "weapon", name: "Longsword", toHit: "+7", damage: "1d8+3" };

  it("rolls a to-hit (ATK step) and resolves the completion callback with the result", () => {
    vi.useFakeTimers();
    const ref = createRef();
    render(<DiceRoller ref={ref} pal={PALETTES.ember} slug="aragorn" />);

    const onComplete = vi.fn();
    act(() => {
      ref.current.rollAttack({ attackEntry, step: "atk", onComplete });
    });

    expect(onComplete).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1100); });

    expect(onComplete).toHaveBeenCalledTimes(1);
    const result = onComplete.mock.calls[0][0];
    expect(result).not.toBeNull();
    expect(result.label).toBe("Longsword ATK");
    expect(typeof result.total).toBe("number");
  });

  it("rolls damage (DMG step) using attackEntry.damage as the dice expression", () => {
    vi.useFakeTimers();
    const ref = createRef();
    render(<DiceRoller ref={ref} pal={PALETTES.ember} slug="aragorn" />);

    const onComplete = vi.fn();
    act(() => {
      ref.current.rollAttack({ attackEntry, step: "dmg", onComplete });
    });
    act(() => { vi.advanceTimersByTime(1100); });

    const result = onComplete.mock.calls[0][0];
    expect(result.label).toBe("Longsword DMG");
    // 1d8+3 -> total between 4 and 11
    expect(result.total).toBeGreaterThanOrEqual(4);
    expect(result.total).toBeLessThanOrEqual(11);
  });

  it("passes target/attack declaration fields through to postCharacterRoll (ADR-026), without baking them into label", () => {
    vi.useFakeTimers();
    const ref = createRef();
    render(<DiceRoller ref={ref} pal={PALETTES.ember} slug="aragorn" />);

    const target = { type: "npc", sourceId: "npc-1", name: "Goblin 2" };
    act(() => {
      ref.current.rollAttack({ attackEntry, step: "atk", target, onComplete: () => {} });
    });
    act(() => { vi.advanceTimersByTime(1100); });

    expect(apiMocks.postCharacterRoll).toHaveBeenCalledTimes(1);
    const [slugArg, payload] = apiMocks.postCharacterRoll.mock.calls[0];
    expect(slugArg).toBe("aragorn");
    expect(payload.label).toBe("Longsword ATK");
    expect(payload.target).toEqual(target);
    expect(payload.attack).toEqual({ kind: "weapon", id: "w1", name: "Longsword" });
  });

  it("does not get stuck ARMED-forever: a roll already in flight calls onComplete(null) instead of silently no-opping (ADR-027 rule 2)", () => {
    vi.useFakeTimers();
    const ref = createRef();
    render(<DiceRoller ref={ref} pal={PALETTES.ember} slug="aragorn" />);

    act(() => {
      ref.current.rollAttack({ attackEntry, step: "atk", onComplete: () => {} });
    });

    const secondOnComplete = vi.fn();
    act(() => {
      ref.current.rollAttack({ attackEntry, step: "atk", onComplete: secondOnComplete });
    });

    expect(secondOnComplete).toHaveBeenCalledWith(null);
  });

  it("an unset attackEntry.damage on the DMG step calls onComplete(null) rather than throwing", () => {
    vi.useFakeTimers();
    const ref = createRef();
    render(<DiceRoller ref={ref} pal={PALETTES.ember} slug="aragorn" />);

    const onComplete = vi.fn();
    act(() => {
      ref.current.rollAttack({ attackEntry: { ...attackEntry, damage: undefined }, step: "dmg", onComplete });
    });

    expect(onComplete).toHaveBeenCalledWith(null);
  });

  it("getAttackExpr computes the same loaded expression rollAttack itself rolls (brief §3.4)", () => {
    const ref = createRef();
    render(<DiceRoller ref={ref} pal={PALETTES.ember} slug="aragorn" />);

    expect(ref.current.getAttackExpr(attackEntry, "atk")).toBe("1d20+7");
    expect(ref.current.getAttackExpr(attackEntry, "dmg")).toBe("1d8+3");
  });

  it("an edited exprOverride replaces the entry's own toHit/damage entirely", () => {
    vi.useFakeTimers();
    const ref = createRef();
    render(<DiceRoller ref={ref} pal={PALETTES.ember} slug="aragorn" />);

    const onComplete = vi.fn();
    act(() => {
      ref.current.rollAttack({ attackEntry, step: "atk", exprOverride: "1d20+2", onComplete });
    });
    act(() => { vi.advanceTimersByTime(1100); });

    const result = onComplete.mock.calls[0][0];
    expect(result.flat).toBe(2);
    expect(result.total).toBeGreaterThanOrEqual(3);
    expect(result.total).toBeLessThanOrEqual(22);
  });

  it("advMode/setAdvMode are exposed on the handle and drive the same advantage logic the panel uses", () => {
    vi.useFakeTimers();
    const ref = createRef();
    render(<DiceRoller ref={ref} pal={PALETTES.ember} slug="aragorn" />);

    expect(ref.current.advMode).toBe("normal");
    act(() => { ref.current.setAdvMode("advantage"); });
    expect(ref.current.advMode).toBe("advantage");
  });
});

describe("DiceRoller free roll description", () => {
  it("sends what the roll is for as its tag, then clears the field", async () => {
    vi.useFakeTimers();
    const { getByLabelText, getByText } = render(<DiceRoller pal={PALETTES.ember} slug="eoghan" />);
    const field = getByLabelText("What's this roll for?");
    act(() => { field.focus(); });
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.change(field, { target: { value: "Climbing the grate" } });
    fireEvent.click(getByText(/^Roll 1d20/i));
    expect(field.value).toBe("");
    act(() => { vi.advanceTimersByTime(1200); });
    expect(apiMocks.postCharacterRoll).toHaveBeenCalledWith("eoghan", expect.objectContaining({ label: "Free Roll", tag: "Climbing the grate" }));
  });

  it("labels a spell's first roll as its cast", () => {
    vi.useFakeTimers();
    const ref = createRef();
    render(<DiceRoller ref={ref} pal={PALETTES.ember} slug="eoghan" />);
    act(() => { ref.current.rollAttack({ attackEntry: { id: "s1", kind: "spell", name: "Hex", toHit: "+3" }, step: "atk" }); });
    act(() => { vi.advanceTimersByTime(1200); });
    expect(apiMocks.postCharacterRoll).toHaveBeenCalledWith("eoghan", expect.objectContaining({ label: "Hex CAST" }));
  });
});

describe("DiceRoller spell casting dice (DM Settings)", () => {
  it("casts spells with the table's spell dice plus to-hit; weapons stay on 1d20", () => {
    const ref = createRef();
    render(<DiceRoller ref={ref} pal={PALETTES.ember} slug="eoghan" spellDice="2d6" />);
    expect(ref.current.getAttackExpr({ kind: "spell", name: "Hex", toHit: "+3" }, "atk")).toBe("2d6+3");
    expect(ref.current.getAttackExpr({ kind: "weapon", name: "Dagger", toHit: "+3" }, "atk")).toBe("1d20+3");
  });
});

describe("DiceRoller effect riders (Story 70)", () => {
  it("rolls a rider as its own dice, adds it to the total and records its share", () => {
    vi.useFakeTimers();
    const ref = createRef();
    render(<DiceRoller ref={ref} pal={PALETTES.ember} slug="eoghan" />);
    const onComplete = vi.fn();
    act(() => {
      ref.current.rollAttack({ attackEntry: { id: "w", kind: "weapon", name: "Dagger", damage: "1d6" }, step: "dmg", riders: [{ effect: "Hexed", dice: "1d6", label: "Hex" }], onComplete });
    });
    act(() => { vi.advanceTimersByTime(1500); });
    const result = onComplete.mock.calls[0][0];
    expect(result.riders).toHaveLength(1);
    const riderTotal = result.riders[0].total;
    const base = result.groups.filter((g) => !g.rider).reduce((s, g) => s + g.rolls.reduce((a, b) => a + b, 0), 0);
    expect(result.total).toBe(base + riderTotal);
    expect(result.groups.filter((g) => g.rider)).toHaveLength(1); // not merged into the weapon's d6
    expect(apiMocks.postCharacterRoll).toHaveBeenCalledWith("eoghan", expect.objectContaining({ riders: [expect.objectContaining({ label: "Hex", total: riderTotal })] }));
  });
});

describe("DiceRoller \"What was that for?\"", () => {
  const attacks = [{ kind: "weapon", name: "Longbow", toHit: "+5", damage: "1d8+3" }];

  it("asks after an untagged free roll, guesses from the dice, and saves the pick on the posted roll", async () => {
    vi.useFakeTimers();
    apiMocks.postCharacterRoll.mockResolvedValue({ success: true, id: "roll-1" });
    const onTagRoll = vi.fn(() => Promise.resolve());
    const { fireEvent, screen } = await import("@testing-library/react");
    render(<DiceRoller pal={PALETTES.ember} slug="liu" askPurpose onTagRoll={onTagRoll} attacks={attacks} inCombat />);
    fireEvent.change(screen.getByPlaceholderText(/or type/i), { target: { value: "1d8+3" } });
    fireEvent.click(screen.getByRole("button", { name: "Roll" }));
    await act(async () => { vi.advanceTimersByTime(1200); });
    expect(screen.getByText("What was that for?")).toBeInTheDocument();
    const best = screen.getByRole("button", { name: "Longbow damage" });
    expect(best).toHaveClass("best");
    await act(async () => { fireEvent.click(best); });
    expect(onTagRoll).toHaveBeenCalledWith("roll-1", "Longbow damage");
    expect(screen.queryByText("What was that for?")).not.toBeInTheDocument();
    expect(screen.getByText(/Longbow damage/)).toBeInTheDocument();
  });

  it("doesn't ask when the rule is off or the roll already says what it's for", async () => {
    vi.useFakeTimers();
    const { fireEvent, screen } = await import("@testing-library/react");
    const { unmount } = render(<DiceRoller pal={PALETTES.ember} slug="liu" askPurpose={false} onTagRoll={vi.fn()} attacks={attacks} />);
    fireEvent.click(screen.getByText(/^Roll 1d20/i));
    await act(async () => { vi.advanceTimersByTime(1200); });
    expect(screen.queryByText("What was that for?")).not.toBeInTheDocument();
    unmount();
    render(<DiceRoller pal={PALETTES.ember} slug="liu" askPurpose onTagRoll={vi.fn()} attacks={attacks} />);
    fireEvent.change(screen.getByLabelText("What's this roll for?"), { target: { value: "Climbing" } });
    fireEvent.click(screen.getByText(/^Roll 1d20/i));
    await act(async () => { vi.advanceTimersByTime(1200); });
    expect(screen.queryByText("What was that for?")).not.toBeInTheDocument();
  });

  it("fades by itself and leaves a + for link to label it later", async () => {
    vi.useFakeTimers();
    apiMocks.postCharacterRoll.mockResolvedValue({ success: true, id: "roll-2" });
    const { fireEvent, screen } = await import("@testing-library/react");
    render(<DiceRoller pal={PALETTES.ember} slug="liu" askPurpose onTagRoll={vi.fn(() => Promise.resolve())} attacks={attacks} />);
    fireEvent.click(screen.getByText(/^Roll 1d20/i));
    await act(async () => { vi.advanceTimersByTime(1200); });
    expect(screen.getByText("What was that for?")).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(12100); }); // fades…
    await act(async () => { vi.advanceTimersByTime(400); }); // …and goes
    expect(screen.queryByText("What was that for?")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "+ for" }));
    expect(screen.getByText("What was that for?")).toBeInTheDocument();
  });
});
