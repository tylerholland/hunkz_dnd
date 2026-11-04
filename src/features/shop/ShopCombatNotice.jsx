import { useState } from "react";
import { putShopStatus } from "../../api";
import "./shopCombatNotice.css";

// The DM's Combat view, while the shop is open: combat doesn't close it (he may
// only be setting up), so offer to. Closing starts the usual lock-up, so anyone
// mid-purchase still gets two minutes to pay. "Leave it open" holds for this
// opening only.
const dismissKey = (openingId) => `dnd_shop_combat_ok_${openingId}`;
const wasDismissed = (openingId) => {
  try { return sessionStorage.getItem(dismissKey(openingId)) === "1"; } catch { return false; }
};

export default function ShopCombatNotice({ shop, dmPassword, onChanged }) {
  const [dismissed, setDismissed] = useState(() => new Set());
  const [state, setState] = useState({ kind: "idle", message: "" });
  const openingId = shop?.openingId;
  if (shop?.status !== "open" || !openingId || dismissed.has(openingId) || wasDismissed(openingId)) return null;

  function leaveOpen() {
    try { sessionStorage.setItem(dismissKey(openingId), "1"); } catch { /* still hidden for this visit */ }
    setDismissed((d) => new Set(d).add(openingId));
  }
  async function closeShop() {
    setState({ kind: "busy", message: "" });
    try {
      await putShopStatus(dmPassword, "close");
      setState({ kind: "idle", message: "" });
      onChanged?.();
    } catch {
      setState({ kind: "error", message: "Couldn't close it. Try again, or close it from the shop page." });
    }
  }

  return (
    <div className="shop-combat-note" role="status">
      <span><b>{shop.name || "The shop"}</b> is open. Players can keep shopping while you set up.</span>
      <span className="shop-combat-note-actions">
        <button type="button" className="shop-combat-note-close" onClick={closeShop} disabled={state.kind === "busy"}>
          {state.kind === "busy" ? "Closing…" : "Close it now"}
        </button>
        <button type="button" className="shop-combat-note-keep" onClick={leaveOpen}>Leave it open</button>
      </span>
      {state.kind === "error" && <span className="shop-combat-note-err" role="alert">{state.message}</span>}
    </div>
  );
}
