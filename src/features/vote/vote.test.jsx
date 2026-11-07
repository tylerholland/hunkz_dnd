import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ postVoteBallot: vi.fn() }));
vi.mock("../../api", () => api);
import VoteBoard from "./VoteBoard";
import PlayerVote from "./PlayerVote";
import VoteComposer from "./VoteComposer";
import { tally, voteLogText } from "./voteUtil";

const members = [
  { slug: "eoghan", name: "Eòghan", palette: "ocean" },
  { slug: "liu", name: "Liu Sha", palette: "ember" },
  { slug: "aesop", name: "Aesop", palette: "forest" },
];
const base = { id: "v1", question: "Where next?", options: ["Inn", "Temple", "Beggar"], multi: false, endsAt: null, showLive: false, showResult: true, status: "open", mine: [] };

describe("the vote board", () => {
  it("puts each token in the box it chose; a sole leader glows; the undecided wait in the tray", () => {
    const { container } = render(<VoteBoard vote={{ ...base, ballots: { eoghan: [0], liu: [0] } }} members={members} tray />);
    const boxes = container.querySelectorAll(".vb-box");
    expect(boxes[0].className).toMatch(/vb-box--lead/);
    expect(boxes[0].querySelectorAll(".vb-tok").length).toBe(2);
    expect(container.querySelector(".vb-tray")).toHaveTextContent("Aesop");
  });

  it("a tie glows nowhere while open, and is marked Tied when it closes", () => {
    const vote = { ...base, ballots: { eoghan: [0], liu: [1] } };
    const { container, rerender } = render(<VoteBoard vote={vote} members={members} />);
    expect(container.querySelectorAll(".vb-box--lead").length).toBe(0);
    rerender(<VoteBoard vote={vote} members={members} closed />);
    expect(container.querySelectorAll(".vb-box--lead").length).toBe(2);
    expect(container.querySelector(".vb-box--lead .vb-tag")).toHaveTextContent("Tied");
    expect(tally(vote).winners).toEqual([0, 1]);
  });
});

describe("a player's vote card", () => {
  afterEach(() => { localStorage.clear(); vi.clearAllMocks(); });

  it("lets them pick and vote, without showing others' votes by default", async () => {
    api.postVoteBallot.mockResolvedValue({});
    render(<PlayerVote vote={base} slug="eoghan" password="pw" members={members} />);
    expect(screen.getByText("Where next?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Temple/ }));
    fireEvent.click(screen.getByRole("button", { name: "Vote" }));
    await waitFor(() => expect(api.postVoteBallot).toHaveBeenCalledWith("eoghan", "pw", "v1", [1]));
    expect(await screen.findByRole("button", { name: "Voted ✓" })).toBeDisabled();
  });

  it("Later tucks it into a pill", () => {
    render(<PlayerVote vote={base} slug="eoghan" password="pw" members={members} />);
    fireEvent.click(screen.getByRole("button", { name: "Later" }));
    fireEvent.click(screen.getByRole("button", { name: /Vote open/ }));
    expect(screen.getByText("Where next?")).toBeInTheDocument();
  });

  it("when the DM keeps the result, they only learn it closed; OK puts it away", () => {
    const { container } = render(<PlayerVote vote={{ ...base, status: "closed", showResult: false, mine: [2] }} slug="eoghan" password="pw" members={members} />);
    expect(screen.getByText("The vote has closed. The DM has the result.")).toBeInTheDocument();
    expect(screen.getByText("You voted Beggar.")).toBeInTheDocument();
    expect(container.querySelector(".vb-board")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(screen.queryByText("Where next?")).toBeNull();
  });

  it("shows the result board when the DM shares it", () => {
    render(<PlayerVote vote={{ ...base, status: "closed", ballots: { eoghan: [0], liu: [0], aesop: [1] } }} slug="eoghan" password="pw" members={members} />);
    expect(screen.getByText(/The party chose/)).toHaveTextContent("The party chose Inn");
  });
});

describe("the DM's form", () => {
  it("sends the question, options and settings", async () => {
    const onSend = vi.fn().mockResolvedValue(true);
    const onClose = vi.fn();
    render(<VoteComposer onSend={onSend} onClose={onClose} />);
    fireEvent.change(screen.getByPlaceholderText("Where do we go next?"), { target: { value: "Trust the beggar?" } });
    fireEvent.click(screen.getByRole("button", { name: "Yes / No" }));
    fireEvent.click(screen.getByRole("switch", { name: "Show the result to players when it closes" }));
    fireEvent.click(screen.getByRole("button", { name: "Send to the party" }));
    await waitFor(() => expect(onSend).toHaveBeenCalledWith({ question: "Trust the beggar?", options: ["Yes", "No"], multi: false, limitSec: 60, showLive: false, showResult: false }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("the session log line", () => {
  it("says the outcome, or not, if it was kept", () => {
    expect(voteLogText({ question: "Where?", winners: ["Inn"] })).toBe("“Where?”: the party chose Inn");
    expect(voteLogText({ question: "Where?", winners: ["Inn", "Temple"] })).toBe("“Where?”: a tie between Inn and Temple");
    expect(voteLogText({ question: "Where?", hidden: true })).toBe("The party voted on “Where?”");
  });
});
