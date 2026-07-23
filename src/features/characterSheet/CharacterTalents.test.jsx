import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import CharacterTalents from "./CharacterTalents";
import { PALETTES } from "./theme";

describe("CharacterTalents", () => {
  it("renders selected skills and special abilities with visible tooltips", () => {
    render(
      <CharacterTalents
        pal={PALETTES.ocean}
        skills={["athletics", "stealth"]}
        specialAbilities={["backstab"]}
        title="Skills & Special Abilities"
      />
    );

    expect(screen.getByText("Skills & Special Abilities")).toBeInTheDocument();
    const athletics = screen.getByText("Athletics");
    const backstab = screen.getByText("Backstab");

    fireEvent.click(athletics);
    expect(screen.getByText("Represents strength, climbing, grappling, swimming, and other feats of physical exertion.")).toBeInTheDocument();

    fireEvent.click(backstab);
    expect(screen.getByText("Deals extra harm or gains advantage when striking from surprise or weak positions.")).toBeInTheDocument();
  });
});
