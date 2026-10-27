import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import XpCoinRow from "./XpCoinRow";
import { PALETTES } from "../../characterSheet/theme";

describe("XpCoinRow", () => {
  it("renders XP progress and the GP pill for an xp-mode character", () => {
    render(
      <XpCoinRow
        char={{ levelingMode: "xp", level: 3 }}
        cardPal={PALETTES.ocean}
        optimisticXp={450}
        optimisticCoin={{ cp: 0, sp: 0, ep: 0, gp: 120, pp: 0 }}
        setShowAwardXp={vi.fn()}
        setShowDistributeCoin={vi.fn()}
        showTier2
      />
    );

    expect(screen.getByText("XP")).toBeInTheDocument();
    expect(screen.getByText("450")).toBeInTheDocument();
    expect(screen.getByLabelText("120 gold")).toBeInTheDocument();
    expect(screen.getByLabelText("0 silver")).toBeInTheDocument();
  });

  it("hides the XP row for a milestone-mode character", () => {
    render(
      <XpCoinRow
        char={{ levelingMode: "milestone", level: 3 }}
        cardPal={PALETTES.ocean}
        optimisticXp={0}
        optimisticCoin={{ cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }}
        setShowAwardXp={vi.fn()}
        setShowDistributeCoin={vi.fn()}
        showTier2
      />
    );

    expect(screen.queryByText("XP")).not.toBeInTheDocument();
    expect(screen.getByText("Coin")).toBeInTheDocument();
  });
});
