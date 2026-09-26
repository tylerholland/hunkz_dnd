import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SessionQuickAdd from "./SessionQuickAdd";
import SessionLedger from "./SessionLedger";
import SessionLoadoutRow from "./SessionLoadoutRow";
import ItemEditorModal from "./ItemEditorModal";
import { PALETTES } from "./theme";

describe("SessionQuickAdd", () => {
  it("adds comma-separated items and keeps the input ready for more", async () => {
    const onAdd = vi.fn().mockResolvedValue(true);
    render(<SessionQuickAdd kind="equipment" label="Item" onAdd={onAdd} onOpenDetails={() => {}} />);
    fireEvent.click(screen.getByText("+ Item"));
    const input = screen.getByLabelText("New item name");
    fireEvent.change(input, { target: { value: "Rope, Arrows x20" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd.mock.calls[0][0].map((i) => [i.name, i.qty])).toEqual([["Rope", undefined], ["Arrows", 20]]);
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
  });

  it("restores the typed text when the save fails", async () => {
    const onAdd = vi.fn().mockResolvedValue(false);
    render(<SessionQuickAdd kind="weapons" label="Weapon" onAdd={onAdd} onOpenDetails={() => {}} />);
    fireEvent.click(screen.getByText("+ Weapon"));
    const input = screen.getByLabelText("New weapon name");
    fireEvent.change(input, { target: { value: "Dagger" } });
    fireEvent.click(screen.getByText("Add"));
    await waitFor(() => expect(input).toHaveValue("Dagger"));
    expect(screen.getByText(/Couldn't save/)).toBeInTheDocument();
  });
});

describe("SessionLedger", () => {
  it("applies a gold delta through the pad", async () => {
    const onCommitCoin = vi.fn().mockResolvedValue({ ok: true, clamped: false });
    render(<SessionLedger char={{ coin: { gp: 12 }, levelingMode: "milestone" }} onCommitCoin={onCommitCoin} onCommitXp={vi.fn()} />);
    fireEvent.click(screen.getByLabelText("Gold: 12. Adjust"));
    fireEvent.click(screen.getByText("100"));
    fireEvent.click(screen.getByText("25"));
    fireEvent.click(screen.getByText("Apply"));
    await waitFor(() => expect(onCommitCoin).toHaveBeenCalledWith("gp", "gain", 125));
    expect(screen.queryByText("Experience")).not.toBeInTheDocument();
  });
});

describe("SessionLoadoutRow + ItemEditorModal delete", () => {
  it("toggles equipped from the icon and expands from the name", () => {
    const onToggleEquipped = vi.fn();
    const onToggleExpand = vi.fn();
    render(<SessionLoadoutRow item={{ id: "a", name: "Shield", equipped: false }} onEdit={vi.fn()} onToggleEquipped={onToggleEquipped} onToggleExpand={onToggleExpand} />);
    fireEvent.click(screen.getByRole("button", { name: "Equip Shield" }));
    expect(onToggleEquipped).toHaveBeenCalled();
    expect(onToggleExpand).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Shield"));
    expect(onToggleExpand).toHaveBeenCalled();
  });

  it("shows description and Use Item for counted items; pencil opens the editor", () => {
    const onUse = vi.fn();
    const onEdit = vi.fn();
    render(<SessionLoadoutRow expanded item={{ id: "p", name: "Healing", qty: 2, description: "Heals 2d4+2." }} onUse={onUse} onEdit={onEdit} onToggleEquipped={vi.fn()} onToggleExpand={vi.fn()} />);
    expect(screen.getByText("Heals 2d4+2.")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Use Item"));
    expect(onUse).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Edit Healing" }));
    expect(onEdit).toHaveBeenCalled();
  });

  it("hides Use Item for untracked or used-up items", () => {
    const { rerender } = render(<SessionLoadoutRow expanded item={{ id: "r", name: "Rope" }} onUse={vi.fn()} onEdit={vi.fn()} onToggleEquipped={vi.fn()} onToggleExpand={vi.fn()} />);
    expect(screen.queryByText("Use Item")).not.toBeInTheDocument();
    rerender(<SessionLoadoutRow expanded item={{ id: "r", name: "Rope", qty: 0 }} onUse={vi.fn()} onEdit={vi.fn()} onToggleEquipped={vi.fn()} onToggleExpand={vi.fn()} />);
    expect(screen.queryByText("Use Item")).not.toBeInTheDocument();
  });

  it("requires a second tap to delete", () => {
    const onDelete = vi.fn();
    render(<ItemEditorModal item={{ id: "a", name: "Shield", mods: [] }} pal={PALETTES.ember} onSave={vi.fn()} onClose={vi.fn()} onDelete={onDelete} />);
    fireEvent.click(screen.getByText("Delete"));
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Confirm delete"));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});

describe("ItemTypeIcon", () => {
  it("picks a sword for weapons and the item type for equipment", () => {
    const { container, rerender } = render(<SessionLoadoutRow kind="weapons" item={{ id: "w", name: "Axe" }} onEdit={vi.fn()} onToggleEquipped={vi.fn()} />);
    expect(container.querySelector("[data-icon='weapon']")).not.toBeNull();
    rerender(<SessionLoadoutRow kind="equipment" item={{ id: "p", name: "Healing", type: "Potion", equipped: false }} onEdit={vi.fn()} onToggleEquipped={vi.fn()} />);
    expect(container.querySelector("[data-icon='potion']")).not.toBeNull();
    expect(screen.getByTitle("Potion · Stowed — click to equip")).toBeInTheDocument();
    rerender(<SessionLoadoutRow kind="equipment" item={{ id: "r", name: "Rope" }} onEdit={vi.fn()} onToggleEquipped={vi.fn()} />);
    expect(container.querySelector("[data-icon='other']")).not.toBeNull();
  });
});
