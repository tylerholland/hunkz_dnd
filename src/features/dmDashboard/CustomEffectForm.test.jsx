import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CustomEffectForm from "./CustomEffectForm";
import { CustomEffectsCtx } from "./customEffectsContext";

describe("CustomEffectForm (Story 70)", () => {
  it("creates a named effect of the chosen kind and hands it back", async () => {
    const create = vi.fn(async (name) => name);
    const onCreated = vi.fn();
    render(<CustomEffectsCtx.Provider value={{ create }}><CustomEffectForm onCreated={onCreated} /></CustomEffectsCtx.Provider>);
    fireEvent.click(screen.getByRole("button", { name: "+ Custom effect…" }));
    fireEvent.change(screen.getByLabelText("Custom effect name"), { target: { value: " Covered in slime " } });
    fireEvent.click(screen.getByRole("radio", { name: "Neutral" }));
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(create).toHaveBeenCalledWith("Covered in slime", "neutral"));
    expect(onCreated).toHaveBeenCalledWith("Covered in slime");
  });

  it("isn't offered outside the DM dashboard", () => {
    const { container } = render(<CustomEffectForm />);
    expect(container.firstChild).toBeNull();
  });
});
