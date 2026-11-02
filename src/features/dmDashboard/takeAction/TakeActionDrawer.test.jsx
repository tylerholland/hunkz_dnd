import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TakeActionDrawer from "./TakeActionDrawer";

describe("TakeActionDrawer — a long-pressed token, handled directly", () => {
  it("offers Damage and Heal on the token itself", () => {
    const onDirect = vi.fn();
    render(<TakeActionDrawer step="target" actorName="Ogre" onTargetSelf={vi.fn()} onCancel={vi.fn()} onDirect={onDirect} onToggleCondition={vi.fn()} />);
    expect(screen.getByText("Or on Ogre directly")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "⚔ Dmg" }));
    expect(onDirect).toHaveBeenCalledWith("damage");
    fireEvent.click(screen.getByRole("button", { name: /Heal/ }));
    expect(onDirect).toHaveBeenCalledWith("heal");
  });

  it("toggles conditions from chips, showing the ones it has, and Done closes", () => {
    const onToggleCondition = vi.fn();
    const onCancel = vi.fn();
    render(<TakeActionDrawer step="target" actorName="Ogre" conditions={["Prone"]} onTargetSelf={vi.fn()} onCancel={onCancel} onDirect={vi.fn()} onToggleCondition={onToggleCondition} />);
    fireEvent.click(screen.getByRole("button", { name: "+ Cond" }));
    expect(screen.getByRole("button", { name: "Prone" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Poisoned" }));
    expect(onToggleCondition).toHaveBeenCalledWith("Poisoned");
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onCancel).toHaveBeenCalled();
  });
});
