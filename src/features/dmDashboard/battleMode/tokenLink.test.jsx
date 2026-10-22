import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { clearLinkHover, setLinkHover, useLinkHover } from "./tokenLink";
import TrayChip from "./TrayChip";
import { PALETTES } from "../../characterSheet/theme";

describe("token ↔ card hover link (Story 33)", () => {
  it("tells only the matching token/card which side is hovered", () => {
    const goblin = renderHook(() => useLinkHover("npc", "gob"));
    const ogre = renderHook(() => useLinkHover("npc", "ogre"));
    act(() => setLinkHover("npc", "gob", "token"));
    expect(goblin.result.current).toBe("token");
    expect(ogre.result.current).toBeNull();
    act(() => clearLinkHover("npc", "ogre")); // a stale leave can't clear someone else's hover
    expect(goblin.result.current).toBe("token");
    act(() => clearLinkHover("npc", "gob"));
    expect(goblin.result.current).toBeNull();
  });
});

describe("TrayChip", () => {
  const props = {
    type: "npc", sourceId: "gob", name: "Goblin Scout", portraitUrl: "https://example.test/goblin.png", initials: "GS",
    ringColor: "#555", fillColor: "#2a5a4a", conditions: ["Hexed"], hpCurrent: 4, hpMax: 7,
    effectNotes: { Hexed: "loses its hold on Aesop" }, onSelect: vi.fn(), pal: PALETTES.ocean,
  };

  it("shows an NPC's portrait (initials if it fails to load)", () => {
    render(<TrayChip {...props} />);
    const img = screen.getByAltText("Goblin Scout");
    fireEvent.error(img);
    expect(screen.getByText("GS")).toBeTruthy();
  });

  it("opens the token's card on hover and lights its card", () => {
    const card = renderHook(() => useLinkHover("npc", "gob"));
    render(<TrayChip {...props} />);
    fireEvent.mouseEnter(screen.getByLabelText("Goblin Scout"));
    expect(card.result.current).toBe("token");
    expect(screen.getByText("HEXED")).toBeTruthy();
    expect(screen.getByText("loses its hold on Aesop")).toBeTruthy();
    expect(screen.getByText("4/7")).toBeTruthy();
    fireEvent.mouseLeave(screen.getByLabelText("Goblin Scout"));
    expect(screen.queryByText("4/7")).toBeNull();
    expect(card.result.current).toBeNull();
  });

  it("pulses when its card is hovered", () => {
    const { container } = render(<TrayChip {...props} />);
    expect(container.querySelector(".tk-link-ring")).toBeNull();
    act(() => setLinkHover("npc", "gob", "card"));
    expect(container.querySelector(".tk-link-ring")).not.toBeNull();
    act(() => clearLinkHover("npc", "gob"));
  });
});
