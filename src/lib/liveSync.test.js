import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isFieldPending, markExpectedFields, mergeOptimisticLiveFields, useSettlingOverride } from "./liveSync";

describe("pending-write expectations", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("ignores a stale poll until the server echoes the written value", () => {
    const ref = { current: new Map() };
    markExpectedFields(ref, { conditions: ["Prone"] });
    const prev = { conditions: ["Prone"], name: "A" };

    // An in-flight poll started before the write still says []
    expect(mergeOptimisticLiveFields(prev, { conditions: [], name: "B" }, ["conditions"], ref))
      .toEqual({ conditions: ["Prone"], name: "B" });
    // Server catches up → expectation clears
    expect(mergeOptimisticLiveFields(prev, { conditions: ["Prone"], name: "B" }, ["conditions"], ref).conditions).toEqual(["Prone"]);
    expect(ref.current.size).toBe(0);
  });

  it("defers to the server after the expectation expires (someone else changed it)", () => {
    const ref = { current: new Map() };
    markExpectedFields(ref, { inspiration: true }, 8000);
    expect(isFieldPending(ref, "inspiration", false)).toBe(true);
    vi.advanceTimersByTime(8001);
    expect(isFieldPending(ref, "inspiration", false)).toBe(false);
    expect(ref.current.size).toBe(0);
  });
});

describe("useSettlingOverride", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("shows the local value until the write lands and the server matches", () => {
    const { result, rerender } = renderHook(({ server }) => useSettlingOverride(server), { initialProps: { server: 1 } });
    let seq;
    act(() => { seq = result.current.begin(2); });
    expect(result.current.value).toBe(2);
    rerender({ server: 1 }); // stale poll mid-write
    expect(result.current.value).toBe(2);
    act(() => result.current.settle(seq));
    rerender({ server: 2 }); // server caught up
    expect(result.current.value).toBe(2);
  });

  it("hands back to the server after settling so other people's changes show", () => {
    const { result, rerender } = renderHook(({ server }) => useSettlingOverride(server, { releaseMs: 2000 }), { initialProps: { server: "a" } });
    let seq;
    act(() => { seq = result.current.begin("mine"); });
    act(() => result.current.settle(seq));
    rerender({ server: "someone-else" }); // concurrent change landed after ours
    expect(result.current.value).toBe("mine");
    act(() => { vi.advanceTimersByTime(2001); });
    expect(result.current.value).toBe("someone-else");
  });
});

describe("liveValuesEqual key order", () => {
  it("treats the same object with keys in a different order as equal", async () => {
    const { liveValuesEqual } = await import("./liveSync");
    expect(liveValuesEqual({ gp: 5, sp: 2 }, { sp: 2, gp: 5 })).toBe(true);
    expect(liveValuesEqual({ gp: 5 }, { gp: 6 })).toBe(false);
    expect(liveValuesEqual([{ a: 1, b: 2 }], [{ b: 2, a: 1 }])).toBe(true);
  });
});

describe("useAdaptivePolling wake-up", () => {
  it("fetches straight away when the window regains focus", async () => {
    const { useAdaptivePolling } = await import("./liveSync");
    vi.useFakeTimers();
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    const poll = vi.fn(async () => {});
    const { unmount } = renderHook(() => useAdaptivePolling({ poll, activeMs: 10000, backgroundMs: 30000 }));
    expect(poll).not.toHaveBeenCalled();
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    expect(poll).toHaveBeenCalledTimes(1);
    unmount();
    vi.useRealTimers();
  });
});
