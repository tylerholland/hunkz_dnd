import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useRollOverlayPref } from "./rollOverlayPref";

afterEach(() => localStorage.clear());

describe("useRollOverlayPref", () => {
  it("is on by default and remembers being switched off", () => {
    const { result, unmount } = renderHook(() => useRollOverlayPref());
    expect(result.current.enabled).toBe(true);
    expect(result.current.menuItem).toMatchObject({ toggle: true, label: "Roll animation", checked: true });
    act(() => result.current.menuItem.onChange());
    expect(result.current.enabled).toBe(false);
    expect(result.current.menuItem.checked).toBe(false);
    unmount();
    expect(renderHook(() => useRollOverlayPref()).result.current.enabled).toBe(false);
  });
});
