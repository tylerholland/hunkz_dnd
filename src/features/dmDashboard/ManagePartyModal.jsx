import { useContext, useEffect, useMemo, useState } from "react";
import { PalCtx } from "./dashboardShared";

function reorder(items, fromIndex, toIndex) {
  if (fromIndex === toIndex) return items;
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export default function ManagePartyModal({ characters, rosterMembers, onClose, onSave }) {
  const pal = useContext(PalCtx);
  const [members, setMembers] = useState(rosterMembers);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const allCharacters = useMemo(
    () => [...characters].sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [characters]
  );
  const memberSet = useMemo(() => new Set(members), [members]);
  const inParty = members
    .map((slug) => allCharacters.find((character) => character.slug === slug))
    .filter(Boolean);
  const available = allCharacters.filter((character) => !memberSet.has(character.slug));

  function addMember(slug) {
    setMembers((current) => [...current, slug]);
  }

  function removeMember(slug) {
    setMembers((current) => current.filter((value) => value !== slug));
  }

  function moveMember(slug, delta) {
    setMembers((current) => {
      const fromIndex = current.indexOf(slug);
      if (fromIndex < 0) return current;
      const toIndex = Math.max(0, Math.min(current.length - 1, fromIndex + delta));
      return reorder(current, fromIndex, toIndex);
    });
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      await onSave(members);
      onClose();
    } catch {
      setError("Could not save party roster.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 220, background: "rgba(0,0,0,0.74)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ width: "min(820px, 100%)", maxHeight: "85vh", overflow: "auto", background: pal.surfaceSolid, border: `1px solid ${pal.border}`, borderRadius: 8, padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: pal.fontDisplay, fontSize: 18, letterSpacing: "0.08em", color: pal.text }}>Manage Party</div>
            <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: pal.textMuted }}>Choose which library characters are in the current campaign party</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: pal.textMuted, fontSize: 18, lineHeight: 1, cursor: "pointer", padding: "2px 6px" }}>×</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 16 }}>
          <div>
            <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.24em", textTransform: "uppercase", color: pal.textMuted, marginBottom: 8 }}>In Party · {inParty.length}</div>
            <div style={{ border: `1px solid ${pal.border}`, borderRadius: 6, overflow: "hidden" }}>
              {inParty.length === 0 ? (
                <div style={{ padding: 14, fontFamily: pal.fontBody, fontSize: 14, color: pal.textMuted }}>No characters in the party yet.</div>
              ) : (
                inParty.map((character, idx) => (
                  <div key={character.slug} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderTop: idx === 0 ? "none" : `1px solid ${pal.border}`, background: pal.surface }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: pal.fontBody, fontSize: 15, color: pal.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{character.name}</div>
                      <div style={{ fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: pal.textMuted }}>{character.race || "Character"}{character.charClass ? ` · ${character.charClass}` : ""}</div>
                    </div>
                    <button onClick={() => moveMember(character.slug, -1)} disabled={idx === 0} style={{ background: "transparent", border: `1px solid ${idx === 0 ? pal.border : pal.accent}`, borderRadius: 3, color: idx === 0 ? pal.textMuted : pal.accentBright, width: 22, height: 20, cursor: idx === 0 ? "not-allowed" : "pointer", opacity: idx === 0 ? 0.45 : 1 }}>↑</button>
                    <button onClick={() => moveMember(character.slug, 1)} disabled={idx === inParty.length - 1} style={{ background: "transparent", border: `1px solid ${idx === inParty.length - 1 ? pal.border : pal.accent}`, borderRadius: 3, color: idx === inParty.length - 1 ? pal.textMuted : pal.accentBright, width: 22, height: 20, cursor: idx === inParty.length - 1 ? "not-allowed" : "pointer", opacity: idx === inParty.length - 1 ? 0.45 : 1 }}>↓</button>
                    <button onClick={() => removeMember(character.slug)} style={{ background: "transparent", border: `1px solid rgba(192,96,96,0.4)`, borderRadius: 3, color: "#c06060", fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.08em", padding: "3px 8px", cursor: "pointer" }}>Remove</button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.24em", textTransform: "uppercase", color: pal.textMuted, marginBottom: 8 }}>Available · {available.length}</div>
            <div style={{ border: `1px solid ${pal.border}`, borderRadius: 6, overflow: "hidden" }}>
              {available.length === 0 ? (
                <div style={{ padding: 14, fontFamily: pal.fontBody, fontSize: 14, color: pal.textMuted }}>All characters are already in the party.</div>
              ) : (
                available.map((character, idx) => (
                  <div key={character.slug} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderTop: idx === 0 ? "none" : `1px solid ${pal.border}`, background: pal.surface }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: pal.fontBody, fontSize: 15, color: pal.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{character.name}</div>
                      <div style={{ fontFamily: pal.fontUI, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: pal.textMuted }}>{character.race || "Character"}{character.charClass ? ` · ${character.charClass}` : ""}</div>
                    </div>
                    <button onClick={() => addMember(character.slug)} style={{ background: "transparent", border: `1px solid ${pal.accent}`, borderRadius: 3, color: pal.accentBright, fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.08em", padding: "3px 8px", cursor: "pointer" }}>Add</button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {error && (
          <div style={{ marginTop: 12, color: "#c06060", fontFamily: pal.fontBody, fontSize: 14 }}>{error}</div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
          <button onClick={onClose} style={{ background: "transparent", border: `1px solid ${pal.border}`, borderRadius: 4, color: pal.textMuted, fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", padding: "8px 14px", cursor: "pointer" }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ background: saving ? "rgba(18,32,48,0.3)" : "rgba(18,32,48,0.6)", border: `1px solid ${pal.accent}`, borderRadius: 4, color: pal.accentBright, fontFamily: pal.fontUI, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", padding: "8px 14px", cursor: saving ? "not-allowed" : "pointer" }}>{saving ? "Saving…" : "Save Party"}</button>
        </div>
      </div>
    </div>
  );
}
