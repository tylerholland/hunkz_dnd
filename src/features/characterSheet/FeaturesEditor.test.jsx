import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import FeaturesEditor from "./FeaturesEditor";
import { PALETTES } from "./theme";

describe("FeaturesEditor", () => {
  it("adds a feature and sets its uses to the proficiency bonus", () => {
    const onChange = vi.fn();
    const { rerender } = render(<FeaturesEditor features={[]} level={5} onChange={onChange} pal={PALETTES.ocean} secHead={{}} lbl={{}} />);
    fireEvent.click(screen.getByText("+ Add feature"));
    const added = onChange.mock.calls[0][0];
    expect(added).toHaveLength(1);
    rerender(<FeaturesEditor features={[{ ...added[0], name: "Hidden Step" }]} level={5} onChange={onChange} pal={PALETTES.ocean} secHead={{}} lbl={{}} />);
    fireEvent.change(screen.getByDisplayValue("No limit"), { target: { value: "prof" } });
    const withUses = onChange.mock.calls.at(-1)[0][0];
    expect(withUses.uses).toMatchObject({ mode: "prof", recharge: "long", used: 0 });
    expect(screen.getByText("= Proficiency bonus (3)")).toBeTruthy();
  });
});
