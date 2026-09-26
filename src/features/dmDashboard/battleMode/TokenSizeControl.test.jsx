import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TokenSizeControl from "./TokenSizeControl";

describe("TokenSizeControl", () => {
  it("shows the size and steps it", () => {
    const onChange = vi.fn();
    render(<TokenSizeControl scale={3} onChange={onChange} />);
    expect(screen.getByText("HUGE")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Increase token size"));
    expect(onChange).toHaveBeenCalledWith(4);
    fireEvent.click(screen.getByLabelText("Decrease token size"));
    expect(onChange).toHaveBeenLastCalledWith(2);
  });

  it("is inert when disabled (NPC not on the map)", () => {
    const onChange = vi.fn();
    render(<TokenSizeControl scale={1} disabled onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Increase token size"));
    expect(onChange).not.toHaveBeenCalled();
  });
});
