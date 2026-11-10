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

describe("ItemEditorModal on use", () => {
  it("saves a heals effect, tidied, and refuses one that isn't dice", () => {
    const onSave = vi.fn();
    render(<ItemEditorModal item={{ id: "h", name: "Salve", mods: [] }} pal={pal} onSave={onSave} onClose={() => {}} />);
    const heals = screen.getByLabelText("When used, heals");
    fireEvent.change(heals, { target: { value: "lots" } });
    expect(screen.getByText("Save Changes")).toBeDisabled();
    fireEvent.change(heals, { target: { value: "1D6 + 2" } });
    fireEvent.click(screen.getByText("Save Changes"));
    expect(onSave.mock.calls[0][0].onUse).toEqual({ heals: "1d6+2" });
  });

  it("shows a known potion's healing and drops onUse when left blank", () => {
    const onSave = vi.fn();
    render(<ItemEditorModal item={{ id: "p", name: "Potion of Healing", onUse: { heals: "3" }, mods: [] }} pal={pal} onSave={onSave} onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText("When used, heals"), { target: { value: "" } });
    expect(screen.getByText(/heals 2d4\+2 \(worked out from the name\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Save Changes"));
    expect(onSave.mock.calls[0][0]).not.toHaveProperty("onUse");
  });
});
