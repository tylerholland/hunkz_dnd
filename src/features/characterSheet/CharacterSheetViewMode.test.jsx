import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../components/DiceRoller", () => ({
  default: () => <div data-testid="dice-roller" />,
}));

vi.mock("./ItemEditorModal", () => ({
  default: () => <div data-testid="item-editor-modal" />,
}));

import CharacterSheetViewMode from "./CharacterSheetViewMode";
import { PALETTES } from "./theme";

function makeCtx(overrides = {}) {
  const pal = PALETTES.ember;
  return {
    rootWrap: {},
    pal,
    char: {
      name: "Aragorn",
      charClass: "Ranger",
      subclass: "",
      nameAlt: "",
      pronunciation: "",
      race: "Human",
      alignment: "Neutral Good",
      background: "Strider",
      origin: "North",
      portraitUrl: "",
      portrait: "",
      tagline: "",
      conditions: [],
      concentration: { active: false, spell: "" },
      hpMax: 30,
      hpCurrent: 23,
      tempHP: 0,
      hitDice: "4d10",
      armorType: "",
      armorTotal: 15,
      level: 4,
      stats: [],
      spells: [],
      weapons: [],
      equipment: [],
      inPlay: [],
      inspiration: false,
      exhaustionLevel: 0,
      spellSlots: [],
      collections: [],
    },
    exportJSON: vi.fn(),
    handleEditClick: vi.fn(),
    unlockLoading: false,
    unlockChecking: false,
    unlockState: "unlocked",
    unlockIntent: "view",
    unlockInput: "",
    setUnlockInput: vi.fn(),
    unlockError: null,
    handleCancelUnlock: vi.fn(),
    handleUnlockSubmit: vi.fn(),
    handleViewUnlock: vi.fn(),
    active: null,
    setActive: vi.fn(),
    activeSec: null,
    navBtn: {},
    onSave: null,
    slug: "aragorn",
    applySessionPatch: vi.fn(() => Promise.resolve()),
    setChar: vi.fn(),
    markSessionExpected: vi.fn(),
    hpFlushRef: { current: vi.fn() },
    hpPendingDelta: { current: 0 },
    tempHpFlushRef: { current: vi.fn() },
    exhFlushRef: { current: vi.fn() },
    exhPendingDelta: { current: 0 },
    concSpellInput: "",
    setConcSpellInput: vi.fn(),
    hpEditMode: false,
    setHpEditMode: vi.fn(),
    hpMax: 30,
    hpCurrent: 23,
    tempHP: 0,
    hpPct: 23 / 30,
    hpBarColor: pal.gem,
    hpBonus: 0,
    _itemBonuses: {},
    isActiveTurn: false,
    secHead: {},
    inputStyle: {},
    combatTab: "combat",
    setTab: vi.fn(),
    editingItem: null,
    setEditingItem: vi.fn(),
    expandedItems: new Set(),
    setExpandedItems: vi.fn(),
    toggleExpanded: vi.fn(),
    hoveredStat: null,
    setHoveredStat: vi.fn(),
    updateWeapon: vi.fn(),
    addWeapon: vi.fn(),
    updateEquipment: vi.fn(),
    addEquipment: vi.fn(),
    ...overrides,
  };
}

function renderView(ctxOverrides = {}) {
  return render(
    <MemoryRouter>
      <CharacterSheetViewMode ctx={makeCtx(ctxOverrides)} />
    </MemoryRouter>
  );
}

describe("CharacterSheetViewMode turn state", () => {
  it("shows the Your Turn banner when the character is the active combatant", () => {
    renderView({ isActiveTurn: true });

    expect(screen.getByText("Your Turn")).toBeInTheDocument();
    expect(screen.getByText("You are the active combatant in initiative.")).toBeInTheDocument();
  });

  it("does not show the Your Turn banner when the character is not active", () => {
    renderView({ isActiveTurn: false });

    expect(screen.queryByText("Your Turn")).not.toBeInTheDocument();
  });
});
