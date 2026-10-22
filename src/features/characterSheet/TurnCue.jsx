
// Story 49 — the player's End Turn button and the "Your turn" cue.

/**
 * The End Turn button: always shown while initiative is running and you're in
 * it; disabled until it's your turn.
 *   waiting — "Liu Sha's turn" (muted)
 *   next    — "You're next" (light wash), with whose turn it is now
 *   mine    — "End Turn · when you're done" (lit, steady — no pulse, so it
 *             doesn't invite a click before you've acted)
 */
export function EndTurnButton({ state, activeName, busy = false, error = null, onEnd }) {
  const mine = state === "mine";
  return (
    <div className="cs-sm-endturn-wrap">
      <button
        type="button"
        className="cs-sm-endturn"
        data-state={state}
        disabled={!mine || busy}
        onClick={mine ? onEnd : undefined}
        aria-live="polite"
      >
        {mine ? (
          <>{busy ? "Ending…" : "End Turn"}<span className="cs-sm-endturn-sub">when you&apos;re done</span></>
        ) : state === "next" ? (
          <>You&apos;re next<span className="cs-sm-endturn-sub">{activeName ? `${activeName}'s turn` : ""}</span></>
        ) : (
          <>{activeName ? `${activeName}'s turn` : "Waiting"}</>
        )}
      </button>
      {error ? <div className="cs-sm-endturn-error" role="alert">{error}</div> : null}
    </div>
  );
}

/**
 * The "Your turn" banner: covers only the left panel (portrait + "Your turn"
 * + round), ~1.5s, then slides back (fades with reduced motion). Fully opaque
 * in every palette. Doesn't block taps. Each new `playKey` remounts it, which
 * replays the CSS animation; it ends invisible.
 */
export function YourTurnBanner({ playKey, portraitUrl, initial, round }) {
  if (!playKey) return null;
  return (
    <div className="cs-sm-turn-banner" key={playKey} aria-hidden="true">
      <div className="cs-sm-turn-banner-portrait">
        {portraitUrl ? <img src={portraitUrl} alt="" /> : initial}
      </div>
      <div className="cs-sm-turn-banner-title">Your turn</div>
      <div className="cs-sm-turn-banner-rule" />
      <div className="cs-sm-turn-banner-sub">Round {round}</div>
    </div>
  );
}
