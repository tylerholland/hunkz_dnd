import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import InventoryPanel from "./InventoryPanel";
import { useInventoryWrites } from "./useInventoryWrites";
import { PALETTES } from "./theme";

// Renders the panel wired to the real write hook, with a persist we control.
function Harness({ initial, persist }) {
  const [char, setChar] = useState(initial);
  const { writeLoadout, commitCoin, commitXp } = useInventoryWrites({ char, setChar, persist });
  return (
    <>
      <InventoryPanel char={char} pal={PALETTES.ember} writeLoadout={writeLoadout} onCommitCoin={commitCoin} onCommitXp={commitXp} />
      <output data-testid="equipment">{JSON.stringify(char.equipment)}</output>
    </>
  );
}

const ring = (id, attuned) => ({ id, name: `Ring ${id}`, requiresAttunement: true, attuned, mods: [] });

describe("InventoryPanel", () => {
  it("shows the attunement count and attunes an item from its gem", async () => {
    const persist = vi.fn(() => Promise.resolve());
    render(<Harness persist={persist} initial={{ weapons: [], equipment: [ring("a", true), ring("b", false)] }} />);

    expect(screen.getByText(/Attuned 1 \/ 3/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Ring b: requires attunement/ }));
    await waitFor(() => expect(persist).toHaveBeenCalled());
    expect(persist.mock.calls[0][0].equipment.find((i) => i.id === "b").attuned).toBe(true);
    expect(screen.getByText(/Attuned 2 \/ 3/)).toBeInTheDocument();
  });

  it("toggles equipped and undoes the change when the save fails", async () => {
    const persist = vi.fn(() => Promise.reject(new Error("offline")));
    render(<Harness persist={persist} initial={{ weapons: [], equipment: [{ id: "c", name: "Cloak", equipped: true, mods: [] }] }} />);

    fireEvent.click(screen.getByRole("button", { name: "Unequip Cloak" }));
    await waitFor(() => expect(persist).toHaveBeenCalled());
    await waitFor(() => expect(JSON.parse(screen.getByTestId("equipment").textContent)[0].equipped).toBe(true));
  });

  it("does not show an attunement line when nothing needs attuning", () => {
    render(<Harness persist={vi.fn()} initial={{ weapons: [], equipment: [{ id: "d", name: "Rope", mods: [] }] }} />);
    expect(screen.queryByText(/Attuned/)).not.toBeInTheDocument();
  });
});
