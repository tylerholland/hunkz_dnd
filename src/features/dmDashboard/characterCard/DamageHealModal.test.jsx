import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../api", () => ({
  patchSession: vi.fn(() => Promise.resolve({})),
}));

import DamageHealModal from "./DamageHealModal";
import { PalCtx } from "../dashboardShared";
import { PALETTES } from "../../characterSheet/theme";

describe("DamageHealModal", () => {
  it("renders a heal modal with the character's current HP", () => {
    render(
      <PalCtx.Provider value={PALETTES.ocean}>
        <DamageHealModal
          char={{ slug: "aragorn", name: "Aragorn", hp: 30, hpCurrent: 20 }}
          mode="heal"
          dmPassword="swordfish"
          onClose={vi.fn()}
          onOptimisticUpdate={vi.fn()}
          onSync={vi.fn()}
        />
      </PalCtx.Provider>
    );

    expect(screen.getByText("Aragorn")).toBeInTheDocument();
    expect(screen.getByText("✦ Heal")).toBeInTheDocument();
    expect(screen.getByText("Heal", { selector: "button" })).toBeInTheDocument();
  });
});
