import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const chime = vi.hoisted(() => ({ playTurnChime: vi.fn() }));
vi.mock("../../lib/turnChime", () => chime);

import { EndTurnButton, YourTurnBanner } from "./TurnCue";
import { useYourTurnCue } from "./useYourTurnCue";

describe("EndTurnButton", () => {
  it("shows whose turn it is, then You're next, then a live End Turn", () => {
    const onEnd = vi.fn();
    const { rerender } = render(<EndTurnButton state="waiting" activeName="Quietclaw" onEnd={onEnd} />);
    expect(screen.getByRole("button")).toHaveTextContent("Quietclaw's turn");
    expect(screen.getByRole("button")).toBeDisabled();
    rerender(<EndTurnButton state="next" activeName="Mr. Meanjeans" onEnd={onEnd} />);
    expect(screen.getByRole("button")).toHaveTextContent("You're next");
    expect(screen.getByRole("button")).toBeDisabled();
    rerender(<EndTurnButton state="mine" activeName="Eòghan" onEnd={onEnd} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onEnd).toHaveBeenCalled();
    rerender(<EndTurnButton state="mine" busy onEnd={onEnd} />);
    expect(screen.getByRole("button")).toHaveTextContent("Ending…");
    expect(screen.getByRole("button")).toBeDisabled();
  });
});

describe("useYourTurnCue", () => {
  const props = (over) => ({ isOurTurn: false, turnKey: "1:e1", alertsOn: true, ...over });

  it("doesn't fire on first load mid-turn, fires once when your turn starts", () => {
    chime.playTurnChime.mockClear();
    const { result, rerender } = renderHook((p) => useYourTurnCue(p), { initialProps: props({ isOurTurn: true, turnKey: "1:e2" }) });
    expect(result.current).toBeNull();
    rerender(props({ turnKey: "1:e3" }));
    expect(result.current).toBeNull();
    rerender(props({ isOurTurn: true, turnKey: "2:e2" }));
    expect(result.current).toBe("2:e2");
    expect(chime.playTurnChime).toHaveBeenCalledTimes(1);
    rerender(props({ isOurTurn: true, turnKey: "2:e2" })); // a poll of the same turn
    expect(chime.playTurnChime).toHaveBeenCalledTimes(1);
  });

  it("stays quiet with Turn alerts off, and marks the tab title while it's your turn", () => {
    chime.playTurnChime.mockClear();
    document.title = "Hunkz Adventures";
    const { result, rerender, unmount } = renderHook((p) => useYourTurnCue(p), { initialProps: props() });
    rerender(props({ isOurTurn: true, turnKey: "1:e2", alertsOn: false }));
    expect(result.current).toBeNull();
    expect(chime.playTurnChime).not.toHaveBeenCalled();
    expect(document.title).toBe("● Your turn — Hunkz Adventures");
    rerender(props({ turnKey: "1:e3" }));
    expect(document.title).toBe("Hunkz Adventures");
    unmount();
  });
});

describe("YourTurnBanner", () => {
  it("renders the round when played, nothing otherwise", () => {
    const { rerender, container } = render(<YourTurnBanner playKey={null} round={2} initial="E" />);
    expect(container.firstChild).toBeNull();
    rerender(<YourTurnBanner playKey="2:e2" round={2} initial="E" />);
    expect(screen.getByText("Your turn")).toBeTruthy();
    expect(screen.getByText("Round 2")).toBeTruthy();
  });
});
