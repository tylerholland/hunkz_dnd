import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CombatGuide, { CombatGuideOffer } from "./CombatGuide";
import { COMBAT_GUIDES, combatGuideSeen } from "./combatGuideSteps";

afterEach(() => localStorage.clear());

describe("CombatGuide", () => {
  it("walks the player guide step by step, and Done closes it for good", () => {
    const onClose = vi.fn();
    render(<CombatGuide who="player" onClose={onClose} />);
    expect(screen.getByText(`Combat quick start · Players · Step 1 of ${COMBAT_GUIDES.player.length}`)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Open the map" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: "Hold an enemy to target it" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "ArrowLeft" });
    expect(screen.getByRole("heading", { name: "Open the map" })).toBeInTheDocument();

    // Jump to the last step with its dot, then Done.
    const lastTitle = COMBAT_GUIDES.player.at(-1).title;
    fireEvent.click(screen.getByRole("button", { name: `Step ${COMBAT_GUIDES.player.length}: ${lastTitle}` }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onClose).toHaveBeenCalled();
    expect(combatGuideSeen("player")).toBe(true);
  });

  it("has the DM's eight steps, from starting combat to passing the turn", () => {
    render(<CombatGuide who="dm" onClose={vi.fn()} />);
    expect(COMBAT_GUIDES.dm.map((s) => s.title)).toEqual([
      "Start combat", "Long-press a token to act with it", "Pick the target", "Pick the action",
      "Deal the damage", "Apply a player's damage", "Label events as they happen", "Pass the turn",
    ]);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(combatGuideSeen("dm")).toBe(true);
  });
});

describe("CombatGuideOffer", () => {
  it("opens the guide, or is dismissed once on this device", () => {
    const onOpen = vi.fn();
    const onDismiss = vi.fn();
    render(<CombatGuideOffer who="player" onOpen={onOpen} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole("button", { name: "Quick start ›" }));
    expect(onOpen).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalled();
    expect(combatGuideSeen("player")).toBe(true);
  });
});
