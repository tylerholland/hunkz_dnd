import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PlayerSilence from "./PlayerSilence";
import SilenceCard from "./SilenceCard";

vi.mock("../../api", () => ({ postSilenceAck: vi.fn(async () => ({})) }));
import { postSilenceAck } from "../../api";

describe("Request silence", () => {
  it("covers a player's screen until they say they're listening", async () => {
    render(<PlayerSilence silence={{ id: "s1", acks: [] }} slug="liu" password="pw" />);
    expect(screen.getByRole("alertdialog", { name: "Your DM requests your attention!" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "I'm listening" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await waitFor(() => expect(postSilenceAck).toHaveBeenCalledWith("liu", "pw", "s1"));
  });

  it("isn't shown to someone who already acknowledged, or when there's none", () => {
    const { container, rerender } = render(<PlayerSilence silence={{ id: "s1", acks: ["liu"] }} slug="liu" password="pw" />);
    expect(container).toBeEmptyDOMElement();
    rerender(<PlayerSilence silence={null} slug="liu" password="pw" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the DM who's listening", () => {
    const onLift = vi.fn();
    render(<SilenceCard silence={{ id: "s1", acks: ["liu"] }} members={[{ slug: "liu", name: "Liu Sha" }, { slug: "aesop", name: "Aesop" }]} onLift={onLift} />);
    expect(screen.getByText("1 of 2 listening")).toBeInTheDocument();
    expect(screen.getByText(/Still on screen for Aesop/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Lift it" }));
    expect(onLift).toHaveBeenCalled();
  });
});
