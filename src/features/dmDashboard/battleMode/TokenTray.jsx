import { useEffect, useRef, useState } from "react";
import { npcInitialColor, npcInitials, getPaletteAccent } from "./tokenUtils";

/**
 * TokenTray — 76px strip below MapViewer showing unplaced PC and NPC tokens.
 *
 * Props:
 *   party        — array of party member objects from getDmParty
 *   npcCombat    — { npcs: NPC[] }
 *   placedTokens — Token[] currently on the map (to compute unplaced set)
 *   heldId       — sourceId of the token currently held (null = none)
 *   onSelect     — (sourceId, type) => void — called when DM picks a token
 *   onEndCombat  — () => void — clears all tokens + flips to adventure mode
 *   onResetTray  — () => void — returns all placed tokens to tray
 *   pal
 */
export default function TokenTray({ party, npcCombat, placedTokens, heldId, onSelect, onDropToTray, onEndCombat, onResetTray, pal }) {
  const [endMenuOpen, setEndMenuOpen] = useState(false);

  const placedSourceIds = new Set((placedTokens || []).map((t) => t.sourceId));
  // A "map-held" token is one being dragged from the map (it's placed, not from tray)
  const isMapHeld = heldId !== null && placedSourceIds.has(heldId);

  const unplacedPcs = (party || []).filter((m) => !placedSourceIds.has(m.slug));
  const unplacedNpcs = (npcCombat?.npcs || []).filter((n) => !placedSourceIds.has(n.id));

  const totalUnplaced = unplacedPcs.length + unplacedNpcs.length;
  const totalAll = (party || []).length + (npcCombat?.npcs || []).length;
  const allPlaced = totalUnplaced === 0 && totalAll > 0;

  // Collapse to a slim status strip once everything is placed; auto-expand
  // the instant a token returns to unplaced (or the DM taps the strip).
  const [manuallyExpanded, setManuallyExpanded] = useState(false);
  const prevAllPlacedRef = useRef(allPlaced);
  useEffect(() => {
    if (prevAllPlacedRef.current && !allPlaced) {
      setManuallyExpanded(false);
    }
    prevAllPlacedRef.current = allPlaced;
  }, [allPlaced]);
  const collapsed = allPlaced && !manuallyExpanded;

  const palVars = {
    "--pal-border": pal.border,
    "--pal-accent": pal.accent,
    "--pal-accent-bright": pal.accentBright,
    "--pal-accent-dim": pal.accentDim,
    "--pal-text-muted": pal.textMuted,
    "--pal-surface-solid": pal.surfaceSolid || pal.surface,
  };

  if (collapsed) {
    return (
      <div
        className={`token-tray token-tray--collapsed${isMapHeld ? " token-tray--drop-target" : ""}`}
        style={palVars}
        onClick={isMapHeld ? (e) => { e.stopPropagation(); onDropToTray?.(); } : () => setManuallyExpanded(true)}
      >
        <div className="tray-collapsed-strip">
          <span className="tray-collapsed-check">✓</span>
          <span className="tray-collapsed-label">All tokens placed · {totalAll}</span>
          <button
            type="button"
            className="tray-collapsed-chevron"
            onClick={(e) => { e.stopPropagation(); setManuallyExpanded(true); }}
          >
            ⌃ open
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`token-tray${isMapHeld ? " token-tray--drop-target" : ""}`}
      style={palVars}
      onClick={isMapHeld ? (e) => { e.stopPropagation(); onDropToTray?.(); } : undefined}
    >
      {/* PC half */}
      <div className="token-tray__half token-tray__half--pc">
        <span className="token-tray__label">
          {totalUnplaced > 0 ? `Unplaced · ${totalUnplaced}` : "All placed"}
        </span>
        {unplacedPcs.length === 0 && (
          <span className="token-tray__empty" style={{ color: pal.textMuted }}>—</span>
        )}
        {unplacedPcs.map((member) => {
          const isSelected = heldId === member.slug;
          const ringColor = (member.palette && pal.name === member.palette)
            ? pal.accent
            : getPaletteAccent(member.palette);
          return (
            <div
              key={member.slug}
              className={`tray-chip${isSelected ? " tray-chip--selected" : ""}`}
              style={{
                "--token-ring-color": ringColor,
                "--pal-accent": pal.accent,
              }}
              onClick={() => onSelect(member.slug, "character")}
              title={member.name}
            >
              {member.portraitUrl ? (
                <img
                  className="tray-chip__portrait"
                  src={member.portraitUrl}
                  alt={member.name}
                  draggable={false}
                  style={{ "--token-ring-color": ringColor }}
                />
              ) : (
                <div
                  className="tray-chip__initial"
                  style={{
                    background: ringColor,
                    boxShadow: `0 0 0 2px ${ringColor}`,
                  }}
                >
                  {(member.name || "?")[0].toUpperCase()}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Divider */}
      <div className="token-tray__divider" />

      {/* NPC half */}
      <div className="token-tray__half token-tray__half--npc">
        {unplacedNpcs.length === 0 && (
          <span className="token-tray__empty" style={{ color: pal.textMuted }}>
            {(npcCombat?.npcs || []).length === 0 ? "No NPCs in combat" : "—"}
          </span>
        )}
        {unplacedNpcs.map((npc) => {
          const isSelected = heldId === npc.id;
          const fillColor = npcInitialColor(npc.id);
          const initials = npcInitials(npc.name);
          return (
            <div
              key={npc.id}
              className={`tray-chip${isSelected ? " tray-chip--selected" : ""}`}
              style={{
                "--token-fill-color": fillColor,
                "--pal-accent": pal.accent,
              }}
              onClick={() => onSelect(npc.id, "npc")}
              title={npc.name}
            >
              <div
                className="tray-chip__initial"
                style={{
                  background: fillColor,
                  boxShadow: `0 0 0 2px ${pal.border}`,
                }}
              >
                {initials}
              </div>
            </div>
          );
        })}
      </div>

      {/* End dropdown */}
      <div className="token-tray__actions" style={{ "--pal-surface-solid": pal.surfaceSolid || pal.surface, "--pal-border": pal.border }}>
        <button
          type="button"
          className="battle-mode-toggle"
          style={{
            "--pal-border": pal.border,
            "--pal-accent": pal.accent,
            "--pal-accent-bright": pal.accentBright,
            "--pal-accent-dim": pal.accentDim,
            "--pal-text-muted": pal.textMuted,
          }}
          onClick={() => setEndMenuOpen((v) => !v)}
        >
          End ▾
        </button>

        {endMenuOpen && (
          <div className="tray-end-dropdown" style={palVars}>
            <button
              type="button"
              className="tray-end-dropdown__item tray-end-dropdown__item--danger"
              onClick={() => { setEndMenuOpen(false); onEndCombat(); }}
            >
              End Combat
            </button>
            <button
              type="button"
              className="tray-end-dropdown__item tray-end-dropdown__item--normal"
              onClick={() => { setEndMenuOpen(false); onResetTray(); }}
            >
              Reset Tray
            </button>
            <button
              type="button"
              className="tray-end-dropdown__item tray-end-dropdown__item--normal"
              onClick={() => setEndMenuOpen(false)}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

