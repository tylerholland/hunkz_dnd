import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../api", () => ({
  patchDmNote: vi.fn(() => Promise.resolve({})),
}));

import DmNotesStrip from "./DmNotesStrip";
import { PALETTES } from "../../characterSheet/theme";

describe("DmNotesStrip", () => {
  it("renders the collapsed add-note affordance when there are no notes", () => {
    render(
      <DmNotesStrip
        slug="aragorn"
        dmNotes={[]}
        sharedPlayerNotes={[]}
        dmPassword="swordfish"
        pal={PALETTES.ocean}
      />
    );

    expect(screen.getByText("+ Note")).toBeInTheDocument();
  });

  it("shows a DM note badge count when notes exist", () => {
    render(
      <DmNotesStrip
        slug="aragorn"
        dmNotes={[{ id: "n1", text: "Watch for traps", createdAt: new Date().toISOString() }]}
        sharedPlayerNotes={[]}
        dmPassword="swordfish"
        pal={PALETTES.ocean}
      />
    );

    expect(screen.getByText("DM Notes")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });
});
