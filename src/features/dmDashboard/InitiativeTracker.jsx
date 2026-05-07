import { useContext, useState } from "react";
import { PALETTES } from "../characterSheet/theme";
import {
  PalCtx,
  VELLUM_CARD_MODE,
  getActiveTurnSurface,
  mixHex,
  withAlpha,
} from "./dashboardShared";

export default function InitiativeTracker({ initiative, party, onCommitInitiative, onPromoteToNpc, npcCombat }) {
  const pal = useContext(PalCtx);
  const [newName, setNewName] = useState("");
  const [newInit, setNewInit] = useState("");
  const [pcRolls, setPcRolls] = useState({});
  const [promoteOpenId, setPromoteOpenId] = useState(null);
  const [promoteHp, setPromoteHp] = useState("");
  const vellumTurnButtonBg = pal === PALETTES.vellum
    ? getActiveTurnSurface(withAlpha(mixHex(VELLUM_CARD_MODE.paperAlt, pal.accent, 0.14), 0.82), pal.accent, 0.16, 0.05)
    : "rgba(18,32,48,0.5)";

  const entries = [...(initiative.entries || [])].sort((a, b) => b.initiative - a.initiative);
  const activeTurnIndex = initiative.activeTurnIndex ?? 0;
  const activeSortedIndex = activeTurnIndex < entries.length ? activeTurnIndex : 0;

  const existingSlugs = new Set((initiative.entries || []).map((entry) => entry.slug).filter(Boolean));
  const availablePCs = (party || []).filter((character) => !existingSlugs.has(character.slug));

  async function handleNextTurn() {
    if (entries.length === 0) return;
    const next = (activeTurnIndex + 1) % entries.length;
    await onCommitInitiative({ entries: initiative.entries || [], activeTurnIndex: next }, { optimistic: true });
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
    const updated = [...(initiative.entries || []), entry];
    await onCommitInitiative({ entries: updated, activeTurnIndex: initiative.activeTurnIndex ?? 0 }, { optimistic: true });
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
    const updated = [...(initiative.entries || []), entry];
    await onCommitInitiative({ entries: updated, activeTurnIndex: initiative.activeTurnIndex ?? 0 }, { optimistic: true });
    setNewName("");
    setNewInit("");
  }

  async function handleRemove(id) {
    const updated = (initiative.entries || []).filter((entry) => entry.id !== id);
    const nextActiveTurnIndex = updated.length === 0 ? 0 : Math.min(initiative.activeTurnIndex ?? 0, updated.length - 1);
    await onCommitInitiative({ entries: updated, activeTurnIndex: nextActiveTurnIndex }, { optimistic: true });
  }

  async function handleClear() {
    await onCommitInitiative({ entries: [], activeTurnIndex: 0 }, { optimistic: true });
  }

  return (
    <div className="dm-init-col" style={{ borderLeft: `1px solid ${pal.border}`, paddingLeft: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.3em", textTransform: "uppercase", color: pal.textMuted }}>Initiative Order</span>
        <button
          onClick={handleClear}
          style={{ background: "transparent", border: "none", color: pal.textMuted, fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.12em", cursor: "pointer", padding: "3px 0" }}
          onMouseEnter={(e) => { e.target.style.color = "#c06060"; }}
          onMouseLeave={(e) => { e.target.style.color = pal.textMuted; }}
        >Clear ×</button>
      </div>

      <button
        onClick={handleNextTurn}
        disabled={entries.length === 0}
        style={{ background: entries.length === 0 ? "transparent" : vellumTurnButtonBg, border: `1px solid ${entries.length === 0 ? pal.border : pal.accent}`, borderRadius: 4, color: entries.length === 0 ? pal.textMuted : pal.accentBright, fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", padding: "9px 0", width: "100%", cursor: entries.length === 0 ? "not-allowed" : "pointer", marginBottom: 10 }}
      >▶ Next Turn</button>

      {entries.length === 0 ? (
        <div style={{ fontFamily: pal.fontUI, fontSize: 12, color: pal.textMuted, textAlign: "center", padding: "20px 0", letterSpacing: "0.08em" }}>No initiative set — add combatants below</div>
      ) : (
        <ul style={{ listStyle: "none", marginBottom: 14, padding: 0 }}>
          {entries.map((entry, idx) => {
            const isCurrent = idx === activeSortedIndex;
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
              <li key={entry.id} style={{ marginBottom: 3 }}>
                <div
                  onClick={canPromote ? () => setPromoteOpenId(isPromoteOpen ? null : entry.id) : undefined}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: isPromoteOpen ? "4px 4px 0 0" : 4, background: isCurrent ? "rgba(106,143,168,0.12)" : pal.surface, border: `1px solid ${isCurrent ? pal.accent : isPromoteOpen ? "rgba(122,112,96,0.5)" : pal.border}`, cursor: canPromote ? "pointer" : "default" }}
                  onMouseEnter={canPromote ? (e) => { if (!isCurrent) e.currentTarget.style.borderColor = "rgba(122,112,96,0.5)"; } : undefined}
                  onMouseLeave={canPromote ? (e) => { if (!isCurrent && !isPromoteOpen) e.currentTarget.style.borderColor = pal.border; } : undefined}
                >
                  <span style={{ fontFamily: pal.fontDisplay, fontSize: 18, color: isCurrent ? pal.accentBright : pal.gem, width: 28, textAlign: "center", flexShrink: 0 }}>{entry.initiative}</span>
                  <span style={{ fontFamily: pal.fontBody, fontSize: 15, color: isCurrent ? pal.accentBright : pal.text, fontWeight: isCurrent ? 600 : 400, flex: 1, fontStyle: !entry.isPC ? "italic" : "normal" }}>{entry.name}</span>
                  {hpDotColor && (
                    <span style={{ width: 9, height: 9, borderRadius: "50%", flexShrink: 0, background: hpDotColor, boxShadow: `0 0 4px ${hpDotColor}`, display: "inline-block" }} title={`${trackedNpc.hpCurrent}/${trackedNpc.hpMax} HP`} />
                  )}
                  {!entry.isPC && !entry.npcId && (
                    <span style={{ fontFamily: pal.fontUI, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: pal.textMuted, background: "rgba(100,130,160,0.1)", border: `1px solid ${pal.border}`, borderRadius: 8, padding: "1px 6px" }}>NPC</span>
                  )}
                  {isCurrent && (
                    <span style={{ fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.1em", color: pal.accentBright, whiteSpace: "nowrap" }}>◀ Now</span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemove(entry.id); }}
                    style={{ background: "transparent", border: "none", color: pal.textMuted, fontSize: 14, cursor: "pointer", padding: "2px 4px", borderRadius: 3, lineHeight: 1 }}
                    onMouseEnter={(e) => { e.target.style.color = "#c06060"; e.target.style.background = "rgba(192,96,96,0.1)"; }}
                    onMouseLeave={(e) => { e.target.style.color = pal.textMuted; e.target.style.background = ""; }}
                  >×</button>
                </div>
                {isPromoteOpen && (
                  <div style={{ padding: "10px 12px", background: "rgba(30,26,20,0.6)", border: "1px solid rgba(122,112,96,0.5)", borderTop: "none", borderRadius: "0 0 4px 4px" }}>
                    <div style={{ fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: pal.textMuted, marginBottom: 7 }}>Set max HP to track this enemy</div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
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
      )}

      {availablePCs.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.3em", textTransform: "uppercase", color: pal.textMuted, marginBottom: 8 }}>Add Characters</div>
          {availablePCs.map((char) => (
            <div key={char.slug} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
              <span style={{ fontFamily: pal.fontBody, fontSize: 14, color: pal.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{char.name || char.nameAlt || char.slug}</span>
              <input type="number" placeholder="Roll" value={pcRolls[char.slug] ?? ""} onChange={(e) => setPcRolls((rolls) => ({ ...rolls, [char.slug]: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && handleAddPC(char)} style={{ width: 52, background: pal.surface, border: "1px solid rgba(100,130,160,0.32)", borderRadius: 3, color: pal.text, fontFamily: pal.fontDisplay, fontSize: 15, padding: "5px 6px", outline: "none", textAlign: "center" }} />
              <button onClick={() => handleAddPC(char)} style={{ background: "transparent", border: "1px solid rgba(100,130,160,0.32)", borderRadius: 3, color: pal.accentBright, fontFamily: pal.fontUI, fontSize: 13, padding: "5px 10px", cursor: "pointer" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = pal.accent; e.currentTarget.style.background = "rgba(106,143,168,0.15)"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(100,130,160,0.32)"; e.currentTarget.style.background = "transparent"; }}>+</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.3em", textTransform: "uppercase", color: pal.textMuted, marginBottom: 8 }}>Add Combatant</div>
      <div style={{ display: "flex", gap: 6 }}>
        <input type="text" placeholder="Name…" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddEntry()} style={{ flex: 1, background: pal.surface, border: "1px solid rgba(100,130,160,0.32)", borderRadius: 3, color: pal.text, fontFamily: pal.fontBody, fontSize: 14, padding: "7px 10px", outline: "none" }} />
        <input type="number" placeholder="Init" value={newInit} onChange={(e) => setNewInit(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddEntry()} style={{ width: 50, background: pal.surface, border: "1px solid rgba(100,130,160,0.32)", borderRadius: 3, color: pal.text, fontFamily: pal.fontDisplay, fontSize: 15, padding: "7px 6px", outline: "none", textAlign: "center" }} />
        <button onClick={handleAddEntry} style={{ background: "transparent", border: "1px solid rgba(100,130,160,0.32)", borderRadius: 3, color: pal.accentBright, fontFamily: pal.fontUI, fontSize: 13, padding: "7px 12px", cursor: "pointer" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = pal.accent; e.currentTarget.style.background = "rgba(106,143,168,0.15)"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(100,130,160,0.32)"; e.currentTarget.style.background = "transparent"; }}>Add</button>
      </div>
    </div>
  );
}
