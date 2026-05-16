import { useContext, useRef, useState } from "react";
import { PALETTES } from "../characterSheet/theme";
import {
  PalCtx,
  VELLUM_CARD_MODE,
  getActiveTurnSurface,
  mixHex,
  withAlpha,
} from "./dashboardShared";
import "./npcCombat.css";

function insertByInitiative(entries, entry) {
  const nextScore = entry.initiative ?? 0;
  const insertIndex = entries.findIndex((value) => (value.initiative ?? 0) < nextScore);
  if (insertIndex === -1) return [...entries, entry];
  return [...entries.slice(0, insertIndex), entry, ...entries.slice(insertIndex)];
}

export default function InitiativeTracker({ initiative, party, onCommitInitiative, onPromoteToNpc, npcCombat }) {
  const pal = useContext(PalCtx);
  const [newName, setNewName] = useState("");
  const [newInit, setNewInit] = useState("");
  const [pcRolls, setPcRolls] = useState({});
  const [promoteOpenId, setPromoteOpenId] = useState(null);
  const [promoteHp, setPromoteHp] = useState("");
  const [modifyOrderMode, setModifyOrderMode] = useState(false);
  const vellumTurnButtonBg = pal === PALETTES.vellum
    ? getActiveTurnSurface(withAlpha(mixHex(VELLUM_CARD_MODE.paperAlt, pal.accent, 0.14), 0.82), pal.accent, 0.16, 0.05)
    : "rgba(18,32,48,0.5)";

  const entries = initiative.entries || [];
  const activeTurnIndex = initiative.activeTurnIndex ?? 0;
  const activeEntryId = entries[activeTurnIndex]?.id ?? null;
  const currentRound = initiative.round ?? 1;
  const roundNumRef = useRef(null);

  const existingSlugs = new Set((initiative.entries || []).map((entry) => entry.slug).filter(Boolean));
  const availablePCs = (party || []).filter((character) => !existingSlugs.has(character.slug));

  function triggerRoundAnim(className) {
    const el = roundNumRef.current;
    if (!el) return;
    el.classList.remove("swapping", "auto-brighten");
    void el.offsetWidth; // force reflow to restart animation
    el.classList.add(className);
    setTimeout(() => el.classList.remove(className), 450);
  }

  function getActiveIndex(updatedEntries) {
    if (!activeEntryId) return 0;
    const nextIndex = updatedEntries.findIndex((value) => value.id === activeEntryId);
    return nextIndex < 0 ? 0 : nextIndex;
  }

  function buildPayload(updatedEntries) {
    return {
      entries: updatedEntries,
      activeTurnIndex: getActiveIndex(updatedEntries),
      round: currentRound,
    };
  }

  async function handleNextTurn() {
    if (entries.length === 0) return;
    const next = (activeTurnIndex + 1) % entries.length;
    const wrapped = next === 0 && entries.length > 0;
    const nextRound = wrapped ? currentRound + 1 : currentRound;
    if (wrapped) {
      triggerRoundAnim("auto-brighten");
    }
    await onCommitInitiative({ entries: initiative.entries || [], activeTurnIndex: next, round: nextRound }, { optimistic: true });
  }

  async function handleAddPC(char) {
    const roll = pcRolls[char.slug] ?? "";
    const initNum = parseInt(roll, 10);
    const entry = {
      id: "id" + Date.now() + Math.random().toString(36).slice(2, 6),
      slug: char.slug,
      name: char.name || char.nameAlt || char.slug,
      initiative: isNaN(initNum) ? 0 : initNum,
      isPC: true,
      npcId: null,
    };
    const updated = insertByInitiative(initiative.entries || [], entry);
    await onCommitInitiative(buildPayload(updated), { optimistic: true });
    setPcRolls((rolls) => {
      const next = { ...rolls };
      delete next[char.slug];
      return next;
    });
  }

  async function handleAddEntry() {
    if (!newName.trim()) return;
    const initNum = parseInt(newInit, 10);
    const entry = {
      id: "id" + Date.now() + Math.random().toString(36).slice(2, 6),
      name: newName.trim(),
      initiative: isNaN(initNum) ? 0 : initNum,
      isPC: false,
      npcId: null,
    };
    const updated = insertByInitiative(initiative.entries || [], entry);
    await onCommitInitiative(buildPayload(updated), { optimistic: true });
    setNewName("");
    setNewInit("");
  }

  async function handleRemove(id) {
    const updated = (initiative.entries || []).filter((entry) => entry.id !== id);
    const nextRound = updated.length === 0 ? 1 : currentRound;
    await onCommitInitiative({
      entries: updated,
      activeTurnIndex: updated.length === 0 ? 0 : getActiveIndex(updated),
      round: nextRound,
    }, { optimistic: true });
  }

  async function handleClear() {
    await onCommitInitiative({ entries: [], activeTurnIndex: 0, round: 1 }, { optimistic: true });
  }

  async function moveEntry(entryId, delta) {
    const fromIndex = entries.findIndex((entry) => entry.id === entryId);
    if (fromIndex < 0) return;
    const toIndex = Math.max(0, Math.min(entries.length - 1, fromIndex + delta));
    if (toIndex === fromIndex) return;

    const updated = [...entries];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);

    await onCommitInitiative(buildPayload(updated), { optimistic: true });
  }

  return (
    <div
      className="dm-init-col"
      style={{
        borderLeft: `1px solid ${pal.border}`,
        paddingLeft: 20,
        "--pal-bg":           pal.bg,
        "--pal-surface":      pal.surface,
        "--pal-surface-solid":pal.surfaceSolid,
        "--pal-border":       pal.border,
        "--pal-accent":       pal.accent,
        "--pal-accent-bright":pal.accentBright,
        "--pal-accent-dim":   pal.accentDim,
        "--pal-text":         pal.text,
        "--pal-text-body":    pal.textBody,
        "--pal-text-muted":   pal.textMuted,
        "--pal-glow-1":       pal.glow1,
        "--pal-glow-2":       pal.glow2,
      }}
    >
      <div className="init-header">
        <span className="label-ui" style={{ letterSpacing: "0.3em" }}>Initiative Order</span>

        {/* Round counter — shows when entries exist, shows em dash when empty */}
        <div className="init-round-counter">
          <span className="init-round-micro-label">Round</span>
          <button
            className="init-round-stepper"
            disabled={entries.length === 0 || currentRound <= 1}
            aria-label="Decrease round"
            onClick={() => {
              if (currentRound <= 1) return;
              const nextRound = currentRound - 1;
              triggerRoundAnim("swapping");
              onCommitInitiative({ entries: initiative.entries || [], activeTurnIndex, round: nextRound }, { optimistic: true });
            }}
          >−</button>
          <span className="cc-round-num" ref={roundNumRef}>
            {entries.length === 0 ? "–" : String(currentRound)}
          </span>
          <button
            className="init-round-stepper"
            disabled={entries.length === 0}
            aria-label="Increase round"
            onClick={() => {
              const nextRound = currentRound + 1;
              triggerRoundAnim("swapping");
              onCommitInitiative({ entries: initiative.entries || [], activeTurnIndex, round: nextRound }, { optimistic: true });
            }}
          >+</button>
        </div>

        <button onClick={handleClear} className="btn-init-clear">Clear ×</button>
      </div>

      <button
        onClick={handleNextTurn}
        disabled={entries.length === 0}
        className="btn-primary"
        style={{
          width: "100%",
          marginBottom: 10,
          background: entries.length === 0 ? "transparent" : vellumTurnButtonBg,
          border: `1px solid ${entries.length === 0 ? pal.border : pal.accent}`,
          color: entries.length === 0 ? pal.textMuted : pal.accentBright,
          cursor: entries.length === 0 ? "not-allowed" : "pointer",
          letterSpacing: "0.2em",
          padding: "9px 0",
        }}
      >▶ Next Turn</button>

      {entries.length === 0 ? (
        <div style={{ fontFamily: pal.fontUI, fontSize: 12, color: pal.textMuted, textAlign: "center", padding: "20px 0", letterSpacing: "0.08em" }}>
          No initiative set — add characters, use <span style={{ color: pal.accentBright }}>+ Init</span> on enemies, or add a manual combatant below
        </div>
      ) : (
        <div style={{ marginBottom: 14 }}>
          <ul className="init-list">
          {entries.map((entry, idx) => {
            const isCurrent = idx === activeTurnIndex;
            const isPromoteOpen = promoteOpenId === entry.id;
            const trackedNpc = !entry.isPC && entry.npcId ? (npcCombat?.npcs || []).find((npc) => npc.id === entry.npcId) : null;
            let hpDotColor = null;
            if (trackedNpc) {
              if (trackedNpc.hpCurrent <= 0) hpDotColor = "#8c3030";
              else if (trackedNpc.hpCurrent < trackedNpc.hpMax / 2) hpDotColor = "#b07030";
              else hpDotColor = "#5a9060";
            }
            const canPromote = !entry.isPC && !entry.npcId && onPromoteToNpc;
            return (
              <li key={entry.id} className="init-entry">
                <div
                  onClick={canPromote ? () => setPromoteOpenId(isPromoteOpen ? null : entry.id) : undefined}
                  data-current={isCurrent ? "true" : undefined}
                  data-promote-open={isPromoteOpen ? "true" : undefined}
                  data-promote-clickable={canPromote ? "true" : undefined}
                  className="init-entry-row"
                  style={{ background: isCurrent ? "rgba(106,143,168,0.12)" : pal.surface, borderColor: isCurrent ? pal.accent : isPromoteOpen ? "rgba(122,112,96,0.5)" : pal.border, borderRadius: isPromoteOpen ? "4px 4px 0 0" : 4 }}
                >
                  <span className="num-display-sm init-value" style={{ color: isCurrent ? pal.accentBright : pal.gem, fontSize: 18 }}>{entry.initiative}</span>
                  <span className="init-name" style={{ color: isCurrent ? pal.accentBright : pal.text, fontWeight: isCurrent ? 600 : 400, fontStyle: !entry.isPC ? "italic" : "normal" }}>{entry.name}</span>
                  {hpDotColor && (
                    <span className="init-hp-dot" style={{ background: hpDotColor, boxShadow: `0 0 4px ${hpDotColor}` }} title={`${trackedNpc.hpCurrent}/${trackedNpc.hpMax} HP`} />
                  )}
                  {!entry.isPC && !entry.npcId && <span className="init-badge-npc">NPC</span>}
                  {isCurrent && <span className="init-now-label">◀ Now</span>}
                  {modifyOrderMode && (
                    <>
                      <div className="init-move-controls">
                        <button
                          onClick={(e) => { e.stopPropagation(); moveEntry(entry.id, -1); }}
                          disabled={idx === 0}
                          title="Move up"
                          style={{ background: "transparent", border: `1px solid ${idx === 0 ? pal.border : pal.accent}`, borderRadius: 3, color: idx === 0 ? pal.textMuted : pal.accentBright, fontFamily: pal.fontUI, fontSize: 10, width: 20, height: 18, cursor: idx === 0 ? "not-allowed" : "pointer", opacity: idx === 0 ? 0.45 : 1, lineHeight: 1 }}
                        >↑</button>
                        <button
                          onClick={(e) => { e.stopPropagation(); moveEntry(entry.id, 1); }}
                          disabled={idx === entries.length - 1}
                          title="Move down"
                          style={{ background: "transparent", border: `1px solid ${idx === entries.length - 1 ? pal.border : pal.accent}`, borderRadius: 3, color: idx === entries.length - 1 ? pal.textMuted : pal.accentBright, fontFamily: pal.fontUI, fontSize: 10, width: 20, height: 18, cursor: idx === entries.length - 1 ? "not-allowed" : "pointer", opacity: idx === entries.length - 1 ? 0.45 : 1, lineHeight: 1 }}
                        >↓</button>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemove(entry.id); }}
                        title="Remove from initiative"
                        className="btn-init-remove"
                      >×</button>
                    </>
                  )}
                </div>
                {isPromoteOpen && (
                  <div className="init-promote-panel">
                    <div className="label-ui" style={{ letterSpacing: "0.2em", marginBottom: 7 }}>Set max HP to track this enemy</div>
                    <div className="init-promote-row">
                      <input
                        type="number"
                        placeholder="HP"
                        value={promoteHp}
                        onChange={(e) => setPromoteHp(e.target.value)}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === "Enter") {
                            const n = parseInt(promoteHp, 10);
                            if (n > 0) {
                              onPromoteToNpc(entry.id, n);
                              setPromoteOpenId(null);
                              setPromoteHp("");
                            }
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                        style={{ width: 72, background: "rgba(18,14,10,0.6)", border: "1px solid rgba(122,112,96,0.45)", borderRadius: 3, color: pal.text, fontFamily: pal.fontDisplay, fontSize: 16, padding: "6px 8px", outline: "none", textAlign: "center" }}
                      />
                      <button onClick={(e) => { e.stopPropagation(); const n = parseInt(promoteHp, 10); if (n > 0) { onPromoteToNpc(entry.id, n); setPromoteOpenId(null); setPromoteHp(""); } }} style={{ background: "rgba(122,112,96,0.2)", border: "1px solid #7a7060", borderRadius: 3, color: "#b0a080", fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.14em", padding: "6px 12px", cursor: "pointer" }}>Track HP</button>
                      <button onClick={(e) => { e.stopPropagation(); setPromoteOpenId(null); setPromoteHp(""); }} style={{ background: "transparent", border: "none", color: pal.textMuted, fontFamily: pal.fontUI, fontSize: 11, cursor: "pointer", padding: "4px 6px" }}>Cancel</button>
                    </div>
                    <div style={{ fontFamily: pal.fontUI, fontSize: 10, color: pal.textMuted, marginTop: 5, fontStyle: "italic" }}>Creates an NPC card linked to this entry.</div>
                  </div>
                )}
              </li>
            );
          })}
          </ul>
          <button
            onClick={() => setModifyOrderMode((value) => !value)}
            data-active={modifyOrderMode ? "true" : undefined}
            className="btn-modify-order"
          >{modifyOrderMode ? "Done" : "Modify Order"}</button>
        </div>
      )}

      {availablePCs.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div className="label-ui" style={{ letterSpacing: "0.3em", marginBottom: 8 }}>Add Characters</div>
          {availablePCs.map((char) => (
            <div key={char.slug} className="init-pc-row">
              <span style={{ fontFamily: pal.fontBody, fontSize: 14, color: pal.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{char.name || char.nameAlt || char.slug}</span>
              <input type="number" placeholder="Roll" value={pcRolls[char.slug] ?? ""} onChange={(e) => setPcRolls((rolls) => ({ ...rolls, [char.slug]: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && handleAddPC(char)} style={{ width: 52, background: pal.surface, border: "1px solid rgba(100,130,160,0.32)", borderRadius: 3, color: pal.text, fontFamily: pal.fontDisplay, fontSize: 15, padding: "5px 6px", outline: "none", textAlign: "center" }} />
              <button onClick={() => handleAddPC(char)} className="btn-init-add">+</button>
            </div>
          ))}
        </div>
      )}

      <div className="label-ui" style={{ letterSpacing: "0.3em", marginBottom: 4 }}>Add Manual Combatant</div>
      <div style={{ fontFamily: pal.fontUI, fontSize: 10, color: pal.textMuted, marginBottom: 8, letterSpacing: "0.06em" }}>
        For allies, summons, or scene actors that do not need an enemy card.
      </div>
      <div className="init-add-row">
        <input type="text" placeholder="Name…" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddEntry()} style={{ flex: 1, background: pal.surface, border: "1px solid rgba(100,130,160,0.32)", borderRadius: 3, color: pal.text, fontFamily: pal.fontBody, fontSize: 14, padding: "7px 10px", outline: "none" }} />
        <input type="number" placeholder="Init" value={newInit} onChange={(e) => setNewInit(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddEntry()} style={{ width: 50, background: pal.surface, border: "1px solid rgba(100,130,160,0.32)", borderRadius: 3, color: pal.text, fontFamily: pal.fontDisplay, fontSize: 15, padding: "7px 6px", outline: "none", textAlign: "center" }} />
        <button onClick={handleAddEntry} className="btn-init-add-manual">Add</button>
      </div>
    </div>
  );
}
