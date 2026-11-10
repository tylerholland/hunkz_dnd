import { act } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  postDmRoll: vi.fn(),
}));

vi.mock("../api", () => ({
  postDmRoll: apiMocks.postDmRoll,
}));

import DmDiceRoller from "./DmDiceRoller";
import { PALETTES } from "../features/characterSheet/theme";

afterEach(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  vi.clearAllMocks();
  apiMocks.postDmRoll.mockResolvedValue({ success: true });
});

describe("DmDiceRoller remote history", () => {
  it("renders character roll history entries with the character name in their palette color", () => {
    render(
      <DmDiceRoller
        pal={PALETTES.ocean}
        remoteHistory={[
          {
            id: "roll-1",
            characterName: "Aragorn",
            paletteKey: "ember",
            exprLabel: "3d6 + 1d20",
            label: "Free roll",
            rollValues: [2, 4, 1, 14],
            total: 21,
            isCrit: false,
            isFumble: false,
            createdAt: new Date().toISOString(), // within the log's one-day window
          },
        ]}
        onApplyDamage={vi.fn()}
        onApplyNpcDamage={vi.fn()}
      />
    );

    expect(screen.getByText("History")).toBeInTheDocument();
    const name = screen.getByText("Aragorn");
    expect(name).toBeInTheDocument();
    expect(name).toHaveStyle({ color: PALETTES.ember.accent });
    // The action (with its dice formula) is the emphasised line; the roller's
    // name sits smaller above it.
    const action = screen.getByText((_, node) => node?.textContent === "Free Roll (3d6 + 1d20)");
    expect(action).toBeInTheDocument();
    expect(action).toHaveStyle({ color: PALETTES.ocean.text, fontSize: "16px" });
    expect(screen.getByText("(3d6 + 1d20)")).toBeInTheDocument();
    expect(screen.getByText("[2, 4, 1, 14]")).toBeInTheDocument();
    const total = screen.getByText("21");
    expect(total).toBeInTheDocument();
    expect(total).toHaveStyle({ color: PALETTES.ember.accent });
  });

  it("expands repeated DM free rolls into individual history rows", () => {
    vi.useFakeTimers();

    render(
      <DmDiceRoller
        pal={PALETTES.ocean}
        remoteHistory={[]}
        onApplyDamage={vi.fn()}
        onApplyNpcDamage={vi.fn()}
      />
    );

    const initialRollButton = screen.getByRole("button", { name: /roll 1d20/i });
    const repeatRow = initialRollButton.parentElement;
    const repeatPlusButton = within(repeatRow).getByRole("button", { name: "+" });

    fireEvent.click(repeatPlusButton);
    fireEvent.click(repeatPlusButton);

    const multiRollButton = screen.getByRole("button", { name: /roll 1d20 ×3/i });
    fireEvent.click(multiRollButton);

    act(() => {
      vi.advanceTimersByTime(650);
    });

    const freeRollRows = screen.getAllByText((_, node) => /^Free Roll \(/.test(node?.textContent || "") && node.tagName === "DIV" && node.children.length === 1);
    expect(freeRollRows).toHaveLength(3);
  });

  it("persists DM rolls into shared roll history with a DM identity", async () => {
    vi.useFakeTimers();

    render(
      <DmDiceRoller
        pal={PALETTES.ocean}
        dmPassword="swordfish"
        remoteHistory={[]}
        onApplyDamage={vi.fn()}
        onApplyNpcDamage={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /roll 1d20/i }));

    await act(async () => {
      vi.advanceTimersByTime(650);
      await Promise.resolve();
    });

    expect(apiMocks.postDmRoll).toHaveBeenCalledTimes(1);

    const [password, payload] = apiMocks.postDmRoll.mock.calls[0];
    expect(password).toBe("swordfish");
    expect(payload).toMatchObject({
      characterName: "DM",
      source: "dm",
      exprLabel: "1d20",
      label: "Free Roll",
    });
    expect(payload.id).toEqual(expect.stringMatching(/^dm-roll-/));
    expect(payload.total).toEqual(expect.any(Number));
    expect(payload.rollValues).toHaveLength(1);

    expect(screen.getByText("DM")).toBeInTheDocument();
  });
});

describe("DmDiceRoller For box", () => {
  it("sends what a free roll is for with it, then clears the box", () => {
    vi.useFakeTimers();
    render(<DmDiceRoller pal={PALETTES.ocean} dmPassword="swordfish" />);

    const forBox = screen.getByLabelText("What's this roll for?");
    fireEvent.change(forBox, { target: { value: "Ogre tries to grapple" } });
    fireEvent.click(screen.getByRole("button", { name: /^Roll / }));
    act(() => { vi.advanceTimersByTime(650); });

    const [, payload] = apiMocks.postDmRoll.mock.calls[0];
    expect(payload.tag).toBe("Ogre tries to grapple");
    expect(forBox).toHaveValue("");
  });

  it("leaves the label off when the box is empty", () => {
    vi.useFakeTimers();
    render(<DmDiceRoller pal={PALETTES.ocean} dmPassword="swordfish" />);
    fireEvent.click(screen.getByRole("button", { name: /^Roll / }));
    act(() => { vi.advanceTimersByTime(650); });
    expect("tag" in apiMocks.postDmRoll.mock.calls[0][1]).toBe(false);
  });
});

describe("DmDiceRoller log window and grouping", () => {
  const minutesAgo = (m) => new Date(Date.now() - m * 60000).toISOString();

  it("keeps to the last day; earlier events come back on request", () => {
    render(
      <DmDiceRoller
        pal={PALETTES.ocean}
        remoteHistory={[
          { id: "new", characterName: "Liu", label: "Stealth", rollValues: [5, 2], total: 11, createdAt: minutesAgo(5) },
          { id: "old", characterName: "Aesop", label: "Old test roll", rollValues: [1], total: 1, createdAt: minutesAgo(60 * 30) },
        ]}
      />,
    );
    expect(screen.getByText("Stealth")).toBeInTheDocument();
    expect(screen.queryByText("Old test roll")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show earlier events (1)" }));
    expect(screen.getByText("Old test roll")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hide events older than a day" }));
    expect(screen.queryByText("Old test roll")).not.toBeInTheDocument();
  });

  it("shows the HP change a roll caused inside that roll, not as its own row", () => {
    const { container } = render(
      <DmDiceRoller
        pal={PALETTES.ocean}
        remoteHistory={[
          { id: "hp1", type: "hp", subject: { name: "Varn" }, from: 10, to: 7, max: 10, delta: -3, rollId: "dmg1", createdAt: minutesAgo(1) },
          { id: "dmg1", source: "dm", label: "Gnome · Poisoned shank DMG", rollValues: [3], total: 3, createdAt: minutesAgo(2) },
          { id: "hp2", type: "hp", subject: { name: "Varn" }, from: 7, to: 10, max: 10, delta: 3, createdAt: minutesAgo(3) },
        ]}
      />,
    );
    const rows = container.querySelectorAll(".rh-row");
    expect(rows).toHaveLength(2); // the damage roll (with its outcome) and the heal
    expect(within(rows[0]).getByText("−3")).toBeInTheDocument();
    expect(container.querySelectorAll(".rh-outcome")).toHaveLength(1);
  });
});
