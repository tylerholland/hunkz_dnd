import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import GiveItemPanel from "./GiveItemPanel";

const party = [{ slug: "liu", name: "Liu Sha", palette: "ember" }, { slug: "aesop", name: "Aesop", palette: "forest" }];

describe("Give an item", () => {
  it("picks who and how many, says exactly what will happen, then gives", async () => {
    const onGive = vi.fn(async () => true);
    const onClose = vi.fn();
    render(<GiveItemPanel item={{ id: "p1", name: "Potion of Healing", qty: 3 }} party={party} onGive={onGive} onClose={onClose} />);
    expect(screen.getByRole("button", { name: "Pick who" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /Liu Sha/ }));
    fireEvent.click(screen.getByRole("button", { name: "One more" }));
    fireEvent.click(screen.getByRole("button", { name: "Give 2 Potion of Healing to Liu Sha" }));
    await waitFor(() => expect(onGive).toHaveBeenCalledWith("liu", 2));
    expect(onClose).toHaveBeenCalled();
  });

  it("a single item has no quantity; errors stay on screen", async () => {
    render(<GiveItemPanel item={{ id: "w1", name: "Shortsword" }} party={party} onGive={async () => "Busy, try again."} onClose={() => {}} />);
    expect(screen.queryByText("How many")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Aesop/ }));
    fireEvent.click(screen.getByRole("button", { name: "Give Shortsword to Aesop" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Busy, try again.");
  });
});
