import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const play = vi.fn();
vi.mock("./fxEngine", () => ({ createFxEngine: () => ({ play, destroy: vi.fn() }) }));

import CombatFxLayer from "./CombatFxLayer";

describe("CombatFxLayer", () => {
  it("plays each strike exactly once, even when later polls repeat it", () => {
    const a = { id: "damage|t1|s1", style: "cut", targetId: "t1" };
    const b = { id: "heal|t2|s2", style: "heal", targetId: "t2" };
    const { rerender } = render(<CombatFxLayer events={[a]} />);
    rerender(<CombatFxLayer events={[a]} />);
    rerender(<CombatFxLayer events={[a, b]} />);
    expect(play.mock.calls.map(([e]) => e.id)).toEqual(["damage|t1|s1", "heal|t2|s2"]);
  });
});

describe("CombatFxLayer while the tab is hidden", () => {
  it("holds strikes and plays the recent ones when the tab is shown again", () => {
    play.mockClear();
    const setVisibility = (v) => Object.defineProperty(document, "visibilityState", { value: v, configurable: true });
    setVisibility("hidden");
    const { rerender } = render(<CombatFxLayer events={[]} />);
    rerender(<CombatFxLayer events={[{ id: "damage|t9|s9", style: "cut", targetId: "t9" }]} />);
    expect(play).not.toHaveBeenCalled();
    setVisibility("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(play.mock.calls.map(([e]) => e.id)).toEqual(["damage|t9|s9"]);
  });
});
