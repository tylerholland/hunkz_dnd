import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { npcInitialColor, npcInitials, getPaletteAccent } from "./tokenUtils";

/**
 * TokenTray — strip below MapViewer showing unplaced PC and NPC tokens.
 * Always expanded; no collapse toggle or End Combat button.
 *
 * Props:
 *   party        — array of party member objects from getDmParty
 *   npcCombat    — { npcs: NPC[] }
 *   placedTokens — Token[] currently on the map (to compute unplaced set)
 *   heldId       — sourceId of the token currently held (null = none)
 *   onSelect     — (sourceId, type) => void — called when DM picks a token
 *   onResetTray   — () => void — returns all placed tokens to tray
 *   onClearTokens — () => void — wipes the npc-combat roster (two-step confirm)
 *   pal
 */
export default function TokenTray({ party, npcCombat, placedTokens, heldId, onSelect, onDropToTray, onClearTokensFromMap, onClearNpcsFromMap, pal }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const [menuPos, setMenuPos] = useState(null);

  useEffect(() => {
    if (!menuOpen) { setMenuPos(null); return; }
    if (menuButtonRef.current) {
      const rect = menuButtonRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (menuButtonRef.current?.contains(e.target)) return;
      setMenuOpen(false);
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [menuOpen]);

  const placedSourceIds = new Set((placedTokens || []).map((t) => t.sourceId));
  const isMapHeld = heldId !== null && placedSourceIds.has(heldId);

  const unplacedPcs = (party || []).filter((m) => !placedSourceIds.has(m.slug));
  const unplacedNpcs = (npcCombat?.npcs || []).filter((n) => !placedSourceIds.has(n.id));
  const totalUnplaced = unplacedPcs.length + unplacedNpcs.length;

  const palVars = {
    "--pal-border": pal.border,
    "--pal-accent": pal.accent,
    "--pal-accent-bright": pal.accentBright,
    "--pal-accent-dim": pal.accentDim,
    "--pal-text-muted": pal.textMuted,
    "--pal-surface-solid": pal.surfaceSolid || pal.surface,
  };

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
              style={{ "--token-ring-color": ringColor, "--pal-accent": pal.accent }}
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
                  style={{ background: ringColor, boxShadow: `0 0 0 2px ${ringColor}` }}
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
              style={{ "--token-fill-color": fillColor, "--pal-accent": pal.accent }}
              onClick={() => onSelect(npc.id, "npc")}
              title={npc.name}
            >
              <div
                className="tray-chip__initial"
                style={{ background: fillColor, boxShadow: `0 0 0 2px ${pal.border}` }}
              >
                {initials}
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions dropdown — Reset Tray + Clear Tokens */}
      <div className="token-tray__actions" style={{ "--pal-surface-solid": pal.surfaceSolid || pal.surface, "--pal-border": pal.border }}>
        <button
          ref={menuButtonRef}
          type="button"
          className="battle-mode-toggle"
          style={{
            "--pal-border": pal.border,
            "--pal-accent": pal.accent,
            "--pal-accent-bright": pal.accentBright,
            "--pal-accent-dim": pal.accentDim,
            "--pal-text-muted": pal.textMuted,
          }}
          onClick={() => setMenuOpen((v) => !v)}
        >
          ⋯
        </button>

        {menuOpen && menuPos && createPortal(
          <div
            className="tray-end-dropdown"
            style={{ ...palVars, position: "fixed", top: menuPos.top, right: menuPos.right, bottom: "auto", left: "auto" }}
          >
            <button
              type="button"
              className="tray-end-dropdown__item tray-end-dropdown__item--normal"
              onClick={() => { setMenuOpen(false); onClearTokensFromMap?.(); }}
            >
              Clear Tokens from Map
            </button>
            <button
              type="button"
              className="tray-end-dropdown__item tray-end-dropdown__item--normal"
              onClick={() => { setMenuOpen(false); onClearNpcsFromMap?.(); }}
            >
              Clear NPCs from Map
            </button>
            <button
              type="button"
              className="tray-end-dropdown__item tray-end-dropdown__item--normal"
              onClick={() => setMenuOpen(false)}
            >
              Cancel
            </button>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}

