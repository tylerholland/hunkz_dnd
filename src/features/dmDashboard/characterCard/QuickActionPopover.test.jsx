import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import QuickActionPopover from "./QuickActionPopover";
import { PALETTES } from "../../characterSheet/theme";

describe("QuickActionPopover", () => {
  it("renders the default action list for a character", () => {
    render(
      <QuickActionPopover
        char={{ slug: "aragorn", name: "Aragorn", conditions: [] }}
        pal={PALETTES.ocean}
        basePal={PALETTES.ocean}
        onClose={vi.fn()}
        onUpdate={vi.fn()}
        onOpenHpModal={vi.fn()}
        onCommitFields={vi.fn()}
      />
    );

    expect(screen.getByText("Aragorn — More Actions")).toBeInTheDocument();
    expect(screen.getByText("Deal Damage")).toBeInTheDocument();
    expect(screen.getByText("Heal")).toBeInTheDocument();
    expect(screen.getByText("Add Condition")).toBeInTheDocument();
    expect(screen.getByText("Set Temp HP")).toBeInTheDocument();
  });
});
