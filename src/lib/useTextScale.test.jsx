import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TEXT_SCALE_KEY, useTextScale } from "./useTextScale";

afterEach(() => sessionStorage.clear());

describe("useTextScale", () => {
  it("is one setting shared by every page", () => {
    const first = renderHook(() => useTextScale());
    act(() => first.result.current.textScaleMenuItem.onIncrement());
    expect(sessionStorage.getItem(TEXT_SCALE_KEY)).toBe("1.1");
    first.unmount();
    const next = renderHook(() => useTextScale());
    expect(next.result.current.textScale).toBe(1.1);
  });

  it("picks up a size saved under the old per-surface keys", () => {
    sessionStorage.setItem("dnd_dm_text_scale", "1.3");
    expect(renderHook(() => useTextScale()).result.current.textScale).toBe(1.3);
  });
});
