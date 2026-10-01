import { useCallback, useEffect, useRef } from "react";
import { applyDelta, normalizeCoin } from "./sessionLoadout";

// Inventory, coin and XP writes shared by the Session and Profile views: apply
// the change locally at once, save it, and undo it if the save fails. Each
// view passes its own `persist(fields)` (both go through the live session
// endpoint), which must throw on failure.
//
// Item edits apply a transform to the latest array by item id, so a
// concurrent change to a different item is never clobbered.
export function useInventoryWrites({ char, setChar, persist }) {
  const charRef = useRef(char);
  useEffect(() => { charRef.current = char; }, [char]);

  // `undo` (optional) reverts just this change from whatever the list is by
  // then; without it the list goes back to how it was before.
  const writeLoadout = useCallback(async (kind, transform, undo) => {
    const prev = charRef.current?.[kind] || [];
    const next = transform(prev);
    setChar((current) => ({ ...current, [kind]: next }));
    try {
      await persist({ [kind]: next });
      return true;
    } catch {
      setChar((current) => ({ ...current, [kind]: undo ? undo(current?.[kind] || []) : prev }));
      return false;
    }
  }, [persist, setChar]);

  const commitCoin = useCallback(async (denom, op, amount) => {
    const prevCoin = normalizeCoin(charRef.current?.coin);
    const { value, clamped } = applyDelta(prevCoin[denom], op, amount);
    const nextCoin = { ...prevCoin, [denom]: value };
    setChar((prev) => ({ ...prev, coin: nextCoin }));
    try {
      await persist({ coin: nextCoin });
      return { ok: true, clamped };
    } catch {
      setChar((prev) => ({ ...prev, coin: prevCoin }));
      return { ok: false, clamped: false };
    }
  }, [persist, setChar]);

  const commitXp = useCallback(async (op, amount) => {
    const prevXp = charRef.current?.xpCurrent ?? 0;
    const { value, clamped } = applyDelta(prevXp, op, amount);
    setChar((prev) => ({ ...prev, xpCurrent: value }));
    try {
      await persist({ xpCurrent: value });
      return { ok: true, clamped };
    } catch {
      setChar((prev) => ({ ...prev, xpCurrent: prevXp }));
      return { ok: false, clamped: false };
    }
  }, [persist, setChar]);

  return { writeLoadout, commitCoin, commitXp };
}
