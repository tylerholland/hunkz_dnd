import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import DmDiceRoller from "./DmDiceRoller";
import { PALETTES } from "../features/characterSheet/theme";

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
});
