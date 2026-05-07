import { fireEvent, render, screen } from "@testing-library/react";
import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  verifyPassword: vi.fn(),
  updateCharacter: vi.fn(),
  getPortraitUploadUrl: vi.fn(),
  patchSession: vi.fn(),
}));

vi.mock("../api", () => ({
  verifyPassword: apiMocks.verifyPassword,
  updateCharacter: apiMocks.updateCharacter,
  getPortraitUploadUrl: apiMocks.getPortraitUploadUrl,
  patchSession: apiMocks.patchSession,
}));

vi.mock("../features/characterSheet/CharacterSheetEditMode", () => ({
  default: () => null,
}));

vi.mock("../features/characterSheet/CharacterSheetViewMode", () => ({
  default: ({ ctx }) => (
    <div>
      <div data-testid="hp-current">{ctx.hpCurrent}</div>
      <button
        type="button"
        onClick={() => {
          const delta = 1;
          const nextHp = Math.min(ctx.hpMax, ctx.hpCurrent + delta);
          if (nextHp === ctx.hpCurrent) return;
          ctx.hpPendingDelta.current += delta;
          ctx.markSessionExpected({ hpCurrent: nextHp });
          ctx.setChar((current) => ({ ...current, hpCurrent: nextHp }));
          ctx.hpFlushRef.current?.();
        }}
      >
        +1 HP
      </button>
      <div data-testid="turn-flag">{ctx.isActiveTurn ? "active" : "inactive"}</div>
    </div>
  ),
}));

import CharacterSheet from "./CharacterSheet";

function makeCharacter(overrides = {}) {
  return {
    slug: "aragorn",
    name: "Aragorn",
    palette: "ember",
    hp: 30,
    hpMax: 30,
    hpCurrent: 23,
    tempHP: 0,
    level: 4,
    race: "Human",
    charClass: "Ranger",
    subclass: "",
    alignment: "",
    background: "",
    origin: "",
    spells: [],
    inPlay: [],
    conditions: [],
    concentration: { active: false, spell: "" },
    inspiration: false,
    exhaustionLevel: 0,
    armorTotal: 0,
    armorType: "",
    hitDice: "",
    weapons: [],
    equipment: [],
    stats: [],
    spellSlots: [],
    collections: [],
    ...overrides,
  };
}

describe("CharacterSheet optimistic sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    apiMocks.patchSession.mockResolvedValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces repeated HP increments into a single server write and ignores stale poll data until the expected value arrives", async () => {
    const onSessionSync = vi.fn();
    const { rerender } = render(
      <CharacterSheet
        initialData={makeCharacter({ hpCurrent: 23 })}
        slug="aragorn"
        onSessionSync={onSessionSync}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "+1 HP" }));
    fireEvent.click(screen.getByRole("button", { name: "+1 HP" }));
    fireEvent.click(screen.getByRole("button", { name: "+1 HP" }));

    expect(screen.getByTestId("hp-current")).toHaveTextContent("26");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(apiMocks.patchSession).toHaveBeenCalledTimes(1);
    expect(apiMocks.patchSession).toHaveBeenCalledWith("aragorn", { hpCurrent: 26 }, null);
    expect(onSessionSync).toHaveBeenCalledTimes(1);

    rerender(
      <CharacterSheet
        initialData={makeCharacter({ hpCurrent: 24 })}
        slug="aragorn"
        onSessionSync={onSessionSync}
      />
    );

    expect(screen.getByTestId("hp-current")).toHaveTextContent("26");

    rerender(
      <CharacterSheet
        initialData={makeCharacter({ hpCurrent: 26 })}
        slug="aragorn"
        onSessionSync={onSessionSync}
      />
    );

    expect(screen.getByTestId("hp-current")).toHaveTextContent("26");
  });
});
