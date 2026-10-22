import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { getTalentDetail, getTalentTooltip } from "./talentCatalog";
import { setTalentCodex } from "./talentCodexStore";
import CharacterTalents from "./CharacterTalents";
import { PALETTES } from "./theme";

afterEach(() => setTalentCodex({}, 0));

describe("Talent Codex overrides (Story 39)", () => {
  it("keeps the built-in text until the DM writes their own", () => {
    const builtIn = getTalentDetail("awareness").description;
    expect(builtIn).toMatch(/notice danger/);
    expect(getTalentTooltip("awareness")).toEqual({ description: builtIn });

    setTalentCodex({ awareness: { description: "Spot the **unseen**.", atTable: "+1 in darkness" } }, 1);
    expect(getTalentDetail("awareness")).toMatchObject({ label: "Awareness", description: "Spot the **unseen**.", atTable: "+1 in darkness", edited: true });

    setTalentCodex({ backstab: { atTable: "Only from hiding" } }, 2);
    expect(getTalentTooltip("backstab")).toEqual({ description: getTalentDetail("backstab").description, atTable: "Only from hiding" });
    expect(getTalentDetail("backstab").description).toMatch(/surprise/); // built-in kept
  });

  it("shows 'At the table' in the info box only when the DM filled it in", () => {
    const pal = PALETTES.ember;
    const { rerender } = render(<CharacterTalents pal={pal} skills={["awareness"]} />);
    fireEvent.mouseEnter(screen.getByRole("button", { name: /Awareness/ }));
    expect(screen.queryByText("At the table")).toBeNull();
    act(() => setTalentCodex({ awareness: { description: "Spot the **unseen**.", atTable: "+1 in darkness" } }, 3));
    rerender(<CharacterTalents pal={pal} skills={["awareness"]} />);
    expect(screen.getByText("At the table")).toBeTruthy();
    expect(screen.getByText("unseen").tagName).toBe("STRONG");
    expect(screen.getByText("+1 in darkness")).toBeTruthy();
  });
});
