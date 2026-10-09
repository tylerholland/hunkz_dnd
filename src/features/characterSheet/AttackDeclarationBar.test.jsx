import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AttackDeclarationBar from "./AttackDeclarationBar";
import { PALETTES } from "./theme";

const hex = { id: "s-hex", kind: "spell", name: "Hex", toHit: "+3", effect: "Hexed" };
const base = { target: { tokenId: "t1", sourceId: "npc-1", name: "Carrion Crawler" }, gone: false };

function renderBar(declaration, props = {}) {
  return render(
    <AttackDeclarationBar
      pal={PALETTES.ember}
      declaration={{ ...base, ...declaration }}
      chips={[]}
      rolling={false}
      advMode="normal"
      getAttackExpr={() => "1d20+3"}
      onSelectAttack={vi.fn()}
      onReopenPicker={vi.fn()}
      onCancel={vi.fn()}
      onRoll={vi.fn()}
      {...props}
    />
  );
}

describe("AttackDeclarationBar — spell effects", () => {
  it("casts a spell rather than attacking", () => {
    renderBar({ attack: hex, lastRoll: null });
    expect(screen.getByRole("button", { name: "✶ CAST" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ATTACK" })).not.toBeInTheDocument();
  });

  it("offers ✦ EFFECT (and no DAMAGE) after casting an effect-only spell", () => {
    const onSendEffect = vi.fn();
    renderBar({ attack: hex, lastRoll: { step: "atk", total: 12, groups: [], flat: 3 } }, { onSendEffect });
    expect(screen.queryByRole("button", { name: /DAMAGE/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "✦ EFFECT" }));
    expect(onSendEffect).toHaveBeenCalled();
  });

  it("offers both when the spell also has damage dice", () => {
    renderBar({ attack: { ...hex, damage: "1d6" }, lastRoll: { step: "atk", total: 12, groups: [], flat: 3 } });
    expect(screen.getByRole("button", { name: /DAMAGE/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "✦ EFFECT" })).toBeInTheDocument();
  });

  it("shows the effect as sent, then applied once the DM applies it", () => {
    const onDone = vi.fn();
    const lastRoll = { step: "atk", total: 12, groups: [], flat: 3 };
    const { rerender } = renderBar({ attack: hex, lastRoll, effectSent: { effect: "Hexed", applied: false } }, { onDone });
    expect(screen.getByRole("status")).toHaveTextContent("Hexed sent");
    rerender(
      <AttackDeclarationBar pal={PALETTES.ember} declaration={{ ...base, attack: hex, lastRoll, effectSent: { effect: "Hexed", applied: true } }}
        chips={[]} rolling={false} advMode="normal" getAttackExpr={() => ""} onSelectAttack={vi.fn()} onReopenPicker={vi.fn()} onCancel={vi.fn()} onRoll={vi.fn()} onDone={onDone} />
    );
    expect(screen.getByRole("status")).toHaveTextContent("Carrion Crawler is Hexed");
    fireEvent.click(screen.getByRole("button", { name: "DONE" }));
    expect(onDone).toHaveBeenCalled();
  });
});
