import { act } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  postDmRoll: vi.fn(),
}));

vi.mock("../api", () => ({
  postDmRoll: apiMocks.postDmRoll,
}));

import DmDiceRoller from "./DmDiceRoller";
import { PALETTES } from "../features/characterSheet/theme";

afterEach(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  vi.clearAllMocks();
  apiMocks.postDmRoll.mockResolvedValue({ success: true });
});

describe("DmDiceRoller remote history", () => {
  it("renders character roll history entries with the character name in their palette color", () => {
    render(
      <DmDiceRoller
        pal={PALETTES.ocean}
        remoteHistory={[
          {
            id: "roll-1",
            characterName: "Aragorn",
            paletteKey: "ember",
            exprLabel: "3d6 + 1d20",
            label: "Free roll",
            rollValues: [2, 4, 1, 14],
            total: 21,
            isCrit: false,
            isFumble: false,
            createdAt: "2026-05-01T12:00:00.000Z",
          },
        ]}
        onApplyDamage={vi.fn()}
        onApplyNpcDamage={vi.fn()}
      />
    );

    expect(screen.getByText("History")).toBeInTheDocument();
    const name = screen.getByText("Aragorn");
    expect(name).toBeInTheDocument();
    expect(name).toHaveStyle({ color: PALETTES.ember.accent });
    const action = screen.getByText((_, node) => node?.textContent === "Free Roll");
    expect(action).toBeInTheDocument();
    expect(action).toHaveStyle({ color: PALETTES.ocean.textBody });
    expect(screen.getByText("3d6 + 1d20")).toBeInTheDocument();
    expect(screen.getByText("[2, 4, 1, 14]")).toBeInTheDocument();
    const total = screen.getByText("21");
    expect(total).toBeInTheDocument();
    expect(total).toHaveStyle({ color: PALETTES.ember.accent });
  });

  it("expands repeated DM free rolls into individual history rows", () => {
    vi.useFakeTimers();

    render(
      <DmDiceRoller
        pal={PALETTES.ocean}
        remoteHistory={[]}
        onApplyDamage={vi.fn()}
        onApplyNpcDamage={vi.fn()}
      />
    );

    const initialRollButton = screen.getByRole("button", { name: /roll 1d20/i });
    const repeatRow = initialRollButton.parentElement;
    const repeatPlusButton = within(repeatRow).getByRole("button", { name: "+" });

    fireEvent.click(repeatPlusButton);
    fireEvent.click(repeatPlusButton);

    const multiRollButton = screen.getByRole("button", { name: /roll 1d20 ×3/i });
    fireEvent.click(multiRollButton);

    act(() => {
      vi.advanceTimersByTime(650);
    });

    const freeRollRows = screen.getAllByText((_, node) => node?.textContent === "Free Roll");
    expect(freeRollRows).toHaveLength(3);
  });

  it("persists DM rolls into shared roll history with a DM identity", async () => {
    vi.useFakeTimers();

    render(
      <DmDiceRoller
        pal={PALETTES.ocean}
        dmPassword="swordfish"
        remoteHistory={[]}
        onApplyDamage={vi.fn()}
        onApplyNpcDamage={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /roll 1d20/i }));

    await act(async () => {
      vi.advanceTimersByTime(650);
      await Promise.resolve();
    });

    expect(apiMocks.postDmRoll).toHaveBeenCalledTimes(1);

    const [password, payload] = apiMocks.postDmRoll.mock.calls[0];
    expect(password).toBe("swordfish");
    expect(payload).toMatchObject({
      characterName: "DM",
      source: "dm",
      exprLabel: "1d20",
      label: "Free Roll",
    });
    expect(payload.id).toEqual(expect.stringMatching(/^dm-roll-/));
    expect(payload.total).toEqual(expect.any(Number));
    expect(payload.rollValues).toHaveLength(1);

    expect(screen.getByText("DM")).toBeInTheDocument();
  });
});
