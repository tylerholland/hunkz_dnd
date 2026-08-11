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
