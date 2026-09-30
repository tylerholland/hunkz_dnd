import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ItemEditorModal from "./ItemEditorModal";
import { PALETTES } from "./theme";

const pal = PALETTES.ocean;

describe("ItemEditorModal armor class", () => {
  it("saves a base AC and Dex rule on armor", () => {
    const onSave = vi.fn();
    render(<ItemEditorModal item={{ id: "a", name: "Light Armor", type: "armor", mods: [] }} pal={pal} showType onSave={onSave} onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText("Armor Class"), { target: { value: "11" } });
    fireEvent.change(screen.getByLabelText("Dexterity"), { target: { value: "full" } });
    fireEvent.click(screen.getByText("Save Changes"));
    expect(onSave.mock.calls[0][0]).toMatchObject({ acBase: 11, acDex: "full" });
    expect(onSave.mock.calls[0][0]).not.toHaveProperty("acBonus");
  });

  it("defaults a new shield to +2 and drops armor AC fields from other types", () => {
    const onSave = vi.fn();
    render(<ItemEditorModal item={{ id: "s", name: "Shield", acBase: 11, acDex: "full", mods: [] }} pal={pal} showType onSave={onSave} onClose={() => {}} />);
    fireEvent.change(screen.getByDisplayValue("(none)"), { target: { value: "shield" } });
    expect(screen.getByLabelText("AC bonus")).toHaveValue(2);
    fireEvent.click(screen.getByText("Save Changes"));
    const saved = onSave.mock.calls[0][0];
    expect(saved.acBonus).toBe(2);
    expect(saved).not.toHaveProperty("acBase");
    expect(saved).not.toHaveProperty("acDex");
  });
});
