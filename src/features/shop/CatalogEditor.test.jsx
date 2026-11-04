import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./itemArtUpload", () => ({ uploadItemArt: vi.fn(async () => "https://b.s3.us-west-1.amazonaws.com/shop-items/abc.jpg") }));
import { CatalogEditor } from "./ShopDmParts";
import { uploadItemArt } from "./itemArtUpload";

const items = [
  { id: "rope", name: "20ft Rope", cat: "gear", price: 2 },
  { id: "dagger", name: "Dagger", cat: "arms", price: 10, tier: "light" },
];

describe("Item catalog", () => {
  it("puts a new item at the top, ready to name, even when filtered", () => {
    render(<CatalogEditor items={items} onSave={vi.fn()} busy={false} dmPassword="pw" />);
    fireEvent.change(screen.getByLabelText("Search items"), { target: { value: "rope" } });
    fireEvent.click(screen.getByRole("button", { name: "＋ Add item" }));
    const names = screen.getAllByLabelText("Name");
    expect(names[0]).toHaveValue("New item");
    expect(names[0]).toHaveFocus();
  });

  it("uploads a picture for an item, and Default puts the built-in one back", async () => {
    const { container } = render(<CatalogEditor items={items} onSave={vi.fn()} busy={false} dmPassword="pw" />);
    fireEvent.click(screen.getByRole("button", { name: "Change the picture for Dagger" }));
    const file = new File(["x"], "dagger.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Item picture"), { target: { files: [file] } });
    await waitFor(() => expect(uploadItemArt).toHaveBeenCalledWith(file, "pw"));
    await waitFor(() => expect(container.querySelector('img[src$="shop-items/abc.jpg"]')).not.toBeNull());
    expect(screen.getByText("Unsaved changes.")).toBeInTheDocument();
    // Default undoes it: back to the built-in picture, nothing to save.
    fireEvent.click(screen.getByRole("button", { name: "Default" }));
    expect(container.querySelector('img[src$="shop-items/abc.jpg"]')).toBeNull();
    expect(screen.getByText("Saved.")).toBeInTheDocument();
  });
});
