import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TokenChip } from "./BattleModeController";
import { PALETTES } from "../../../components/CharacterSheet";

const pcToken = { id: "tok-1", type: "character", sourceId: "aragorn", x: 0.2, y: 0.3 };
const party = [{ slug: "aragorn", name: "Aragorn", palette: "ocean", hpCurrent: 10, hp: 10 }];

function renderChip(overrides = {}) {
  return render(
    <div style={{ position: "relative" }}>
      <TokenChip
        token={pcToken}
        imageW={1000}
        imageH={800}
        party={party}
        npcCombat={{ npcs: [] }}
        isDm={false}
        isOwnToken={false}
        partyVisibilityEnabled
        isHeld={false}
        pal={PALETTES.ocean}
        {...overrides}
      />
    </div>
  );
}

function stubLayerRect(chip) {
  // Story 55 (ADR-021) — .tk-lunge now sits between .token-chip and the
  // token-layer root (chip.parentElement.parentElement), not
  // chip.parentElement directly.
  const layer = chip.parentElement.parentElement;
  vi.spyOn(layer, "getBoundingClientRect").mockReturnValue({
    left: 0, top: 0, width: 1000, height: 800, right: 1000, bottom: 800, x: 0, y: 0,
  });
  chip.setPointerCapture = vi.fn();
  return layer;
}

describe("TokenChip own-token drag affordance", () => {
  it("marks the player's own character token as draggable", () => {
    const { container } = renderChip({ ownSlug: "aragorn" });
    expect(container.querySelector(".token-chip--own-draggable")).toBeTruthy();
  });

  it("does not mark another player's token as draggable", () => {
    const { container } = renderChip({ ownSlug: "someone-else" });
    expect(container.querySelector(".token-chip--own-draggable")).toBeNull();
  });

  it("does not mark an NPC token as draggable even if ownSlug happens to match sourceId", () => {
    const npcToken = { id: "tok-npc", type: "npc", sourceId: "npc-1", x: 0.5, y: 0.5 };
    const { container } = render(
      <div style={{ position: "relative" }}>
        <TokenChip
          token={npcToken}
          imageW={1000}
          imageH={800}
          party={[]}
          npcCombat={{ npcs: [{ id: "npc-1", name: "Goblin", hpCurrent: 5, hpMax: 5 }] }}
          isDm={false}
          isOwnToken={false}
          partyVisibilityEnabled
          isHeld={false}
          pal={PALETTES.ocean}
          ownSlug="npc-1"
        />
      </div>
    );
    expect(container.querySelector(".token-chip--own-draggable")).toBeNull();
  });

  it("never marks a chip draggable in the DM view, even if ownSlug is passed", () => {
    const { container } = renderChip({ ownSlug: "aragorn", isDm: true });
    expect(container.querySelector(".token-chip--own-draggable")).toBeNull();
  });
});

describe("TokenChip own-token drag interaction", () => {
  it("drags to a new position and commits the dropped fractional coordinates", () => {
    const onMoveToken = vi.fn().mockResolvedValue({ success: true });
    const panSuppressedRef = { current: false };
    const { container } = renderChip({ ownSlug: "aragorn", onMoveToken, panSuppressedRef });
    const chip = container.querySelector(".token-chip");
    stubLayerRect(chip);

    // Start at the token's current position (0.2, 0.3) in a 1000x800 layer.
    fireEvent.pointerDown(chip, { pointerId: 1, clientX: 200, clientY: 240, pointerType: "mouse", button: 0 });
    expect(panSuppressedRef.current).toBe(true);
    expect(chip.className).toContain("token-chip--dragging");

    fireEvent.pointerMove(chip, { pointerId: 1, clientX: 500, clientY: 400 });
    fireEvent.pointerUp(chip, { pointerId: 1, clientX: 500, clientY: 400 });

    expect(panSuppressedRef.current).toBe(false);
    expect(onMoveToken).toHaveBeenCalledTimes(1);
    const [tokenId, x, y] = onMoveToken.mock.calls[0];
    expect(tokenId).toBe("tok-1");
    expect(x).toBeCloseTo(0.5);
    expect(y).toBeCloseTo(0.5);
  });

  it("clamps the dropped position to [0, 1] when the pointer leaves the image bounds", () => {
    const onMoveToken = vi.fn().mockResolvedValue({ success: true });
    const panSuppressedRef = { current: false };
    const { container } = renderChip({ ownSlug: "aragorn", onMoveToken, panSuppressedRef });
    const chip = container.querySelector(".token-chip");
    stubLayerRect(chip);

    fireEvent.pointerDown(chip, { pointerId: 1, clientX: 200, clientY: 240, pointerType: "mouse", button: 0 });
    fireEvent.pointerMove(chip, { pointerId: 1, clientX: -400, clientY: 2000 });
    fireEvent.pointerUp(chip, { pointerId: 1, clientX: -400, clientY: 2000 });

    const [, x, y] = onMoveToken.mock.calls[0];
    expect(x).toBe(0);
    expect(y).toBe(1);
  });

  it("does not call onMoveToken for a tap with no meaningful movement", () => {
    const onMoveToken = vi.fn();
    const panSuppressedRef = { current: false };
    const { container } = renderChip({ ownSlug: "aragorn", onMoveToken, panSuppressedRef });
    const chip = container.querySelector(".token-chip");
    stubLayerRect(chip);

    fireEvent.pointerDown(chip, { pointerId: 2, clientX: 200, clientY: 240, pointerType: "mouse", button: 0 });
    fireEvent.pointerUp(chip, { pointerId: 2, clientX: 200, clientY: 240 });

    expect(onMoveToken).not.toHaveBeenCalled();
  });

  it("does not start a drag for tokens that are not the player's own", () => {
    const onMoveToken = vi.fn();
    const panSuppressedRef = { current: false };
    const { container } = renderChip({ ownSlug: "someone-else", onMoveToken, panSuppressedRef });
    const chip = container.querySelector(".token-chip");
    stubLayerRect(chip);

    fireEvent.pointerDown(chip, { pointerId: 3, clientX: 200, clientY: 240, pointerType: "mouse", button: 0 });
    expect(panSuppressedRef.current).toBe(false);
    expect(chip.className).not.toContain("token-chip--dragging");

    fireEvent.pointerMove(chip, { pointerId: 3, clientX: 500, clientY: 400 });
    fireEvent.pointerUp(chip, { pointerId: 3, clientX: 500, clientY: 400 });

    expect(onMoveToken).not.toHaveBeenCalled();
  });
});
