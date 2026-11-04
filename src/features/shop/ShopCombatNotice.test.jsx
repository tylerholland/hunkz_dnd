import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ putShopStatus: vi.fn() }));
vi.mock("../../api", () => api);
import ShopCombatNotice from "./ShopCombatNotice";

const open = { status: "open", openingId: "o1", name: "Ironwhistle's" };

describe("ShopCombatNotice", () => {
  afterEach(() => { sessionStorage.clear(); vi.clearAllMocks(); });

  it("offers to close an open shop, which starts the usual lock-up", async () => {
    api.putShopStatus.mockResolvedValue({});
    const onChanged = vi.fn();
    render(<ShopCombatNotice shop={open} dmPassword="pw" onChanged={onChanged} />);
    expect(screen.getByText(/is open/)).toHaveTextContent("Ironwhistle's is open");
    fireEvent.click(screen.getByRole("button", { name: "Close it now" }));
    await waitFor(() => expect(api.putShopStatus).toHaveBeenCalledWith("pw", "close"));
    expect(onChanged).toHaveBeenCalled();
  });

  it("Leave it open holds for this opening, and asks again for the next", () => {
    const { rerender } = render(<ShopCombatNotice shop={open} dmPassword="pw" />);
    fireEvent.click(screen.getByRole("button", { name: "Leave it open" }));
    expect(screen.queryByRole("status")).toBeNull();
    rerender(<ShopCombatNotice shop={{ ...open }} dmPassword="pw" />);
    expect(screen.queryByRole("status")).toBeNull();
    rerender(<ShopCombatNotice shop={{ ...open, openingId: "o2" }} dmPassword="pw" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("says nothing when the shop isn't open", () => {
    render(<ShopCombatNotice shop={{ ...open, status: "lockup" }} dmPassword="pw" />);
    expect(screen.queryByRole("status")).toBeNull();
  });
});
