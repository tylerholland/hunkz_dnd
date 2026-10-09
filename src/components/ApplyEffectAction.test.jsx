import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import EffectLogRow from "./ApplyEffectAction";
import { PALETTES } from "../features/characterSheet/theme";

const entry = { id: "e1", type: "effect", slug: "eoghan", characterName: "Eòghan", effect: "Hexed", attack: { kind: "spell", name: "Hex" }, target: { sourceId: "npc-1", name: "Carrion Crawler" } };

describe("Apply Effect (DM log)", () => {
  it("applies the effect with the DM's note", async () => {
    const onApplyEffect = vi.fn(() => true);
    render(<EffectLogRow pal={PALETTES.ember} entry={entry} applied={false} onApplyEffect={onApplyEffect} />);
    fireEvent.click(screen.getByRole("button", { name: "Apply Effect" }));
    fireEvent.change(screen.getByPlaceholderText(/loses its hold/), { target: { value: "  drops his weapon " } });
    fireEvent.click(screen.getByRole("button", { name: "Apply Hexed" }));
    await waitFor(() => expect(onApplyEffect).toHaveBeenCalledWith(entry, "drops his weapon"));
  });

  it("says so when the target is gone, and shows Applied once done", async () => {
    const onApplyEffect = vi.fn(() => false);
    const { rerender } = render(<EffectLogRow pal={PALETTES.ember} entry={entry} applied={false} onApplyEffect={onApplyEffect} />);
    fireEvent.click(screen.getByRole("button", { name: "Apply Effect" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply Hexed" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("still in the fight");
    rerender(<EffectLogRow pal={PALETTES.ember} entry={entry} applied onApplyEffect={onApplyEffect} />);
    expect(screen.getByText("✓ Applied")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Apply Effect" })).toBeNull();
  });
});
