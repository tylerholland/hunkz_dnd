import { useEffect, useState } from "react";
import { playTurnChime } from "../../lib/turnChime";

// Story 49.
/**
 * Fires the cue when your turn starts — not on first load mid-turn (the lit
 * button covers that), not on refreshes of the same turn. `turnKey` changes
 * whenever the active turn changes ("round:entryId"). While it's your turn the
 * tab title gets a "● Your turn" prefix. Returns a key that changes each time
 * the banner should play (null until the first time).
 */
export function useYourTurnCue({ isOurTurn, turnKey, alertsOn }) {
  const [prevKey, setPrevKey] = useState(turnKey ?? null);
  const [bannerKey, setBannerKey] = useState(null);
  // Track turn changes while rendering (React's "adjust state on prop change"
  // pattern): the first key seen is the page loading, not a new turn.
  if ((turnKey ?? null) !== prevKey) {
    setPrevKey(turnKey ?? null);
    if (prevKey !== null && turnKey && isOurTurn && alertsOn) setBannerKey(turnKey);
  }

  useEffect(() => {
    if (bannerKey) playTurnChime();
  }, [bannerKey]);

  useEffect(() => {
    if (!isOurTurn) return undefined;
    const base = document.title.replace(/^● Your turn — /, "");
    document.title = `● Your turn — ${base}`;
    return () => { document.title = document.title.replace(/^● Your turn — /, ""); };
  }, [isOurTurn]);

  return bannerKey;
}
