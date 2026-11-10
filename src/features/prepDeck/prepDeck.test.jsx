import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MessageComposer from "./MessageComposer";
import PrepDeckPanel from "./PrepDeckPanel";
import PlayerMessages from "./PlayerMessages";

vi.mock("../../api", () => ({ postMessageSeen: vi.fn(async () => ({})), postMessageReply: vi.fn(async () => ({})), presignMomentArt: vi.fn() }));
import { postMessageReply, postMessageSeen } from "../../api";

const members = [{ slug: "eoghan", name: "Eòghan", palette: "ocean" }, { slug: "liu", name: "Liu Sha", palette: "ember" }];

describe("the composer", () => {
  it("writes a moment for everyone and reads it now", async () => {
    const onSend = vi.fn(async () => true);
    render(<MessageComposer members={members} initial={{ kind: "moment" }} onSave={vi.fn()} onSend={onSend} onDelete={vi.fn()} onClose={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText("The Guildmaster's signal"), { target: { value: "Smoke" } });
    fireEvent.change(screen.getByPlaceholderText("The Guildmaster signals to the shadows…"), { target: { value: "Bells ring at the north gate." } });
    fireEvent.click(screen.getByRole("button", { name: "Read it now" }));
    await waitFor(() => expect(onSend).toHaveBeenCalled());
    expect(onSend.mock.calls[0][0]).toMatchObject({ to: "all", title: "Smoke", text: "Bells ring at the north gate." });
  });

  it("a note needs someone to pass it to; picking a player makes it a note", async () => {
    const onSend = vi.fn(async () => true);
    render(<MessageComposer members={members} initial={{ kind: "note" }} onSave={vi.fn()} onSend={onSend} onDelete={vi.fn()} onClose={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText("You notice…"), { target: { value: "A boy watches you." } });
    expect(screen.getByRole("button", { name: "Pass it now" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /Liu Sha/ }));
    fireEvent.click(screen.getByRole("button", { name: "Pass it now" }));
    await waitFor(() => expect(onSend.mock.calls[0][0]).toMatchObject({ to: ["liu"], canReply: true, showPassed: true }));
  });
});

describe("the prep deck", () => {
  const cards = [
    { id: "c1", kind: "moment", title: "The signal", text: "The Guildmaster signals…", to: "all", usedAt: null },
    { id: "c2", kind: "note", title: "Not the whole truth", text: "She's hiding something.", to: "choose", usedAt: null },
    { id: "c3", kind: "moment", title: "Dusk", text: "The inn is loud.", to: "all", usedAt: "2026-11-09T20:31:00Z" },
  ];

  it("reads a moment in one tap; a 'choose' note asks who first; used ones fold away", () => {
    const onSend = vi.fn();
    render(<PrepDeckPanel cards={cards} members={members} onSend={onSend} onEdit={vi.fn()} onPrepare={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Read" }));
    expect(onSend).toHaveBeenCalledWith(cards[0], undefined);
    fireEvent.click(screen.getByRole("button", { name: "Pass" }));
    fireEvent.click(screen.getByRole("button", { name: /Eòghan/ }));
    expect(onSend).toHaveBeenLastCalledWith(cards[1], ["eoghan"]);
    expect(screen.queryByText("Dusk")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Used tonight · 1/ }));
    expect(screen.getByText("Dusk")).toBeInTheDocument();
  });
});

describe("the player's pop-ups", () => {
  beforeEach(() => { postMessageSeen.mockClear(); postMessageReply.mockClear(); });

  it("shows a moment, oldest first, until Continue", async () => {
    const messages = [
      { id: "m2", kind: "moment", title: "Later", text: "Second.", sentAt: "2026-11-09T20:40:00Z", seenByMe: false },
      { id: "m1", kind: "moment", title: "Dusk", text: "First.", sentAt: "2026-11-09T20:30:00Z", seenByMe: false },
    ];
    render(<PlayerMessages messages={messages} slug="liu" password="pw" />);
    expect(screen.getByRole("heading", { name: "Dusk" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("heading", { name: "Later" })).toBeInTheDocument();
    await waitFor(() => expect(postMessageSeen).toHaveBeenCalledWith("liu", "pw", "m1"));
  });

  it("a note: reply once, then it's done; notes for others never pop up", async () => {
    const messages = [
      { id: "n1", kind: "note", title: "The boy", text: "A boy watches you.", to: ["liu"], canReply: true, sentAt: "2026-11-09T20:30:00Z", seenByMe: false },
      { id: "n2", kind: "note", passed: true, to: ["eoghan"], sentAt: "2026-11-09T20:31:00Z" },
    ];
    render(<PlayerMessages messages={messages} slug="liu" password="pw" />);
    fireEvent.change(screen.getByLabelText("Reply to the DM"), { target: { value: "I follow him" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(postMessageReply).toHaveBeenCalledWith("liu", "pw", "n1", "I follow him"));
    await waitFor(() => expect(screen.queryByText("A note from the DM")).not.toBeInTheDocument());
  });
});
