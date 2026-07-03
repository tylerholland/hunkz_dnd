import { useContext, useEffect, useRef, useState } from "react";
import { presignNpcPortrait, putNpcLibrary } from "../../api";
import { PalCtx } from "./dashboardShared";
import "./enemiesGallery.css";

const ABILITY_MAX_LENGTH = 255;
const ABILITY_COUNTER_THRESHOLD = 30;
const MAX_PORTRAIT_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_PORTRAIT_TYPES = ["image/png", "image/jpeg", "image/webp"];

function npcInitials(name) {
  const words = (name || "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return words.map((w) => w[0]?.toUpperCase() || "").join("");
}

function PortraitCircle({ portraitUrl, name, size = 84, npcPal }) {
  const [imgError, setImgError] = useState(false);
  const initials = npcInitials(name) || "?";

  const style = {
    width: size,
    height: size,
    borderRadius: "50%",
    flexShrink: 0,
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: npcPal.chipBg,
    border: `1px solid ${npcPal.actionBorder}`,
    fontFamily: "var(--font-display)",
    fontSize: size > 60 ? 24 : size > 32 ? 14 : 12,
    color: npcPal.bright,
    position: "relative",
  };

  if (portraitUrl && !imgError) {
    return (
      <div style={style}>
        <img
          src={portraitUrl}
          alt={name}
          onError={() => setImgError(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </div>
    );
  }
  return <div style={style}>{initials}</div>;
}

function AbilitiesListEditor({ abilities, onChange, npcPal }) {
  const pal = useContext(PalCtx);
  const [addInput, setAddInput] = useState("");
  const addInputRef = useRef(null);
  const addInputLen = addInput.length;
  const showCounter = addInputLen >= ABILITY_MAX_LENGTH - ABILITY_COUNTER_THRESHOLD;

  function handleAdd() {
    const text = addInput.trim();
    if (!text) return;
    onChange([...abilities, text]);
    setAddInput("");
    setTimeout(() => addInputRef.current?.focus(), 0);
  }

  function handleRemove(index) {
    onChange(abilities.filter((_, i) => i !== index));
  }

  return (
    <div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {abilities.map((entry, idx) => (
          <li key={idx} className="eg-ability-row">
            <span className="eg-ability-diamond">◆</span>
            <span className="eg-ability-text">{entry}</span>
            <button className="eg-ability-remove" onClick={() => handleRemove(idx)} title="Remove">−</button>
          </li>
        ))}
      </ul>
      <div className="eg-ability-add-row">
        <input
          ref={addInputRef}
          className="eg-input eg-ability-input"
          type="text"
          placeholder="add ability…"
          maxLength={ABILITY_MAX_LENGTH}
          value={addInput}
          onChange={(e) => setAddInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
          autoComplete="off"
        />
        <button
          className="eg-btn-add-ability"
          onClick={handleAdd}
          disabled={!addInput.trim()}
          style={{ background: npcPal.chipBg, border: `1px solid ${npcPal.accent}`, color: npcPal.bright }}
        >+</button>
      </div>
      {showCounter && (
        <div className={`eg-char-counter${addInputLen >= ABILITY_MAX_LENGTH ? " limit" : ""}`}>
          {ABILITY_MAX_LENGTH - addInputLen} / {ABILITY_MAX_LENGTH}
        </div>
      )}
    </div>
  );
}

function EntryEditor({ entry, npcPal, dmPassword, onMarkDirty, onSave, workingRef }) {
  const pal = useContext(PalCtx);
  const [name, setName] = useState(entry.name || "");
  const [hpMax, setHpMax] = useState(entry.hpMax != null ? String(entry.hpMax) : "");
  const [abilities, setAbilities] = useState(entry.abilities || []);
  const [portraitUrl, setPortraitUrl] = useState(entry.portraitUrl || null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [removeConfirm, setRemoveConfirm] = useState(false);
  const fileInputRef = useRef(null);
  const nameInputRef = useRef(null);

  // Sync working copy up via ref so parent can read on save
  useEffect(() => {
    workingRef.current = { name, hpMax, abilities, portraitUrl };
  }, [name, hpMax, abilities, portraitUrl, workingRef]);

  // When a new entry is selected, reset local state
  useEffect(() => {
    setName(entry.name || "");
    setHpMax(entry.hpMax != null ? String(entry.hpMax) : "");
    setAbilities(entry.abilities || []);
    setPortraitUrl(entry.portraitUrl || null);
    setUploadError("");
    setRemoveConfirm(false);
  }, [entry.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function markDirty() { onMarkDirty(); }

  async function handlePortraitSelect(e) {
    const file = e.target.files?.[0];
    if (!fileInputRef.current) return;
    fileInputRef.current.value = "";
    if (!file) return;
    if (!ACCEPTED_PORTRAIT_TYPES.includes(file.type)) {
      setUploadError("Only PNG, JPEG, or WebP images are supported.");
      return;
    }
    if (file.size > MAX_PORTRAIT_SIZE_BYTES) {
      setUploadError("Portrait must be 5 MB or smaller.");
      return;
    }
    setUploadError("");
    setUploading(true);
    // Show local preview immediately
    const localUrl = URL.createObjectURL(file);
    setPortraitUrl(localUrl);
    try {
      const { uploadUrl, portraitUrl: s3Url } = await presignNpcPortrait(file.name, file.type, file.size, dmPassword);
      await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type, "Cache-Control": "public, max-age=604800" },
      });
      URL.revokeObjectURL(localUrl);
      setPortraitUrl(s3Url);
      markDirty();
    } catch {
      URL.revokeObjectURL(localUrl);
      setPortraitUrl(entry.portraitUrl || null);
      setUploadError("Upload failed — try again.");
    } finally {
      setUploading(false);
    }
  }

  function handleRemovePortrait() {
    setPortraitUrl(null);
    setRemoveConfirm(false);
    markDirty();
  }

  return (
    <div className="eg-detail-fields">
      <div className="eg-portrait-row">
        <div style={{ position: "relative", flexShrink: 0 }}>
          <PortraitCircle portraitUrl={portraitUrl} name={name} size={84} npcPal={npcPal} />
          {uploading && (
            <div className="eg-portrait-uploading-ring" />
          )}
        </div>
        <div className="eg-portrait-actions">
          <button
            className="eg-portrait-action-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >{uploading ? "Uploading…" : "Replace"}</button>
          {portraitUrl && !removeConfirm && (
            <button
              className="eg-portrait-action-btn eg-portrait-remove-btn"
              onClick={() => setRemoveConfirm(true)}
            >Remove</button>
          )}
          {removeConfirm && (
            <div className="eg-portrait-remove-confirm">
              <button className="eg-confirm-del-btn" onClick={handleRemovePortrait}>Remove</button>
              <button className="eg-confirm-cancel-btn" onClick={() => setRemoveConfirm(false)}>Cancel</button>
            </div>
          )}
          {uploadError && <div className="eg-portrait-error">{uploadError}</div>}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_PORTRAIT_TYPES.join(",")}
            style={{ display: "none" }}
            onChange={handlePortraitSelect}
          />
        </div>
      </div>

      <div className="eg-field-group">
        <label className="eg-field-label">Name</label>
        <input
          ref={nameInputRef}
          className="eg-input eg-name-input"
          type="text"
          value={name}
          maxLength={80}
          onChange={(e) => { setName(e.target.value); markDirty(); }}
        />
      </div>

      <div className="eg-field-group">
        <label className="eg-field-label">Default HP</label>
        <input
          className="eg-input eg-hp-input"
          type="number"
          value={hpMax}
          placeholder="—"
          min="1"
          onChange={(e) => { setHpMax(e.target.value); markDirty(); }}
        />
        <span className="eg-hp-hint">Optional. Empty = no HP chip on picker rows.</span>
      </div>

      <div className="eg-field-group">
        <label className="eg-field-label">Abilities</label>
        <AbilitiesListEditor
          abilities={abilities}
          onChange={(next) => { setAbilities(next); markDirty(); }}
          npcPal={npcPal}
        />
      </div>
    </div>
  );
}

export default function EnemiesGalleryModal({ templates, dmPassword, onClose, onTemplatesChange }) {
  const pal = useContext(PalCtx);
  const npcPal = {
    accent: "#7a7060",
    bright: "#b0a080",
    surface: "rgba(30,26,20,0.6)",
    surfaceSolid: "#1e1a14",
    border: "rgba(120,110,90,0.3)",
    chipBg: "rgba(40,36,28,0.7)",
    actionBorder: "rgba(120,110,90,0.35)",
    track: "rgba(40,36,28,0.85)",
  };

  const [entries, setEntries] = useState(() => [...templates]);
  const [selectedId, setSelectedId] = useState(() => templates[0]?.id ?? null);
  const [isDirty, setIsDirty] = useState(false);
  const [showDirtyGuard, setShowDirtyGuard] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [isMobileDrilled, setIsMobileDrilled] = useState(false);
  const workingRef = useRef({});
  const savedFlashTimerRef = useRef(null);
  const entryKeyCounter = useRef(1000);

  // Sync entries from parent when templates prop changes (e.g. initial load)
  // Only on first mount — after that, local state is authoritative
  const didInitRef = useRef(false);
  useEffect(() => {
    if (!didInitRef.current) {
      didInitRef.current = true;
      setEntries([...templates]);
      setSelectedId(templates[0]?.id ?? null);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Esc key handling
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") {
        if (isDirty) setShowDirtyGuard(true);
        else onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isDirty, onClose]);

  function requestClose() {
    if (isDirty) { setShowDirtyGuard(true); return; }
    onClose();
  }

  function discardAndClose() {
    setShowDirtyGuard(false);
    setIsDirty(false);
    onClose();
  }

  function keepEditing() {
    setShowDirtyGuard(false);
  }

  const filteredEntries = filterText.trim()
    ? entries.filter((t) => {
        const hay = (t.name + " " + (t.abilities || []).join(" ")).toLowerCase();
        return hay.includes(filterText.trim().toLowerCase());
      })
    : entries;

  const selectedEntry = entries.find((t) => t.id === selectedId) ?? null;

  function selectEntry(id) {
    if (isDirty) {
      // Commit current working copy before switching
      flushWorkingCopy();
    }
    setSelectedId(id);
    setIsDirty(false);
    setIsMobileDrilled(true);
  }

  function flushWorkingCopy() {
    if (!selectedId) return;
    const w = workingRef.current;
    const hpMaxParsed = w.hpMax !== "" ? parseInt(w.hpMax, 10) : null;
    setEntries((current) =>
      current.map((t) =>
        t.id === selectedId
          ? {
              ...t,
              name: w.name || t.name,
              hpMax: Number.isFinite(hpMaxParsed) ? hpMaxParsed : null,
              abilities: w.abilities || t.abilities,
              portraitUrl: w.portraitUrl !== undefined ? w.portraitUrl : t.portraitUrl,
            }
          : t
      )
    );
  }

  function createNewEntry() {
    entryKeyCounter.current += 1;
    const newEntry = {
      id: `new-${entryKeyCounter.current}-${Date.now()}`,
      name: "",
      hpMax: null,
      portraitUrl: null,
      abilities: [],
      updatedAt: new Date().toISOString(),
    };
    setEntries((current) => [newEntry, ...current]);
    setSelectedId(newEntry.id);
    setIsDirty(false);
    setIsMobileDrilled(true);
    setTimeout(() => {
      const nameEl = document.querySelector(".eg-name-input");
      if (nameEl) nameEl.focus();
    }, 60);
  }

  function duplicateEntry() {
    if (!selectedEntry) return;
    flushWorkingCopy();
    entryKeyCounter.current += 1;
    const copy = {
      ...selectedEntry,
      id: `copy-${entryKeyCounter.current}-${Date.now()}`,
      name: `${selectedEntry.name} (copy)`,
      updatedAt: new Date().toISOString(),
    };
    setEntries((current) => [copy, ...current]);
    setSelectedId(copy.id);
    setIsDirty(false);
    setTimeout(() => {
      const nameEl = document.querySelector(".eg-name-input");
      if (nameEl) { nameEl.focus(); nameEl.select(); }
    }, 60);
  }

  function startDeleteEntry(id) {
    setDeleteConfirmId(id);
  }

  function commitDeleteEntry(id) {
    setEntries((current) => {
      const next = current.filter((t) => t.id !== id);
      if (selectedId === id) {
        setSelectedId(next[0]?.id ?? null);
        setIsDirty(false);
        setIsMobileDrilled(false);
      }
      return next;
    });
    setDeleteConfirmId(null);
    // Immediately persist deletion
    setEntries((current) => {
      const withoutDeleted = current.filter((t) => t.id !== id);
      saveToBackend(withoutDeleted);
      return withoutDeleted;
    });
  }

  async function saveToBackend(entriesToSave) {
    try {
      await putNpcLibrary(dmPassword, entriesToSave.map((t) => ({
        ...t,
        updatedAt: t.updatedAt || new Date().toISOString(),
      })));
      onTemplatesChange(entriesToSave);
    } catch {
      // Non-fatal — UI stays consistent, backend may be stale
    }
  }

  async function handleSave() {
    if (!selectedEntry) return;
    const w = workingRef.current;
    const hpMaxParsed = w.hpMax !== "" ? parseInt(w.hpMax, 10) : null;
    const name = (w.name || "").trim();
    if (!name) {
      const nameEl = document.querySelector(".eg-name-input");
      if (nameEl) { nameEl.style.borderColor = "#c06060"; nameEl.focus(); }
      return;
    }
    const updatedEntry = {
      ...selectedEntry,
      name,
      hpMax: Number.isFinite(hpMaxParsed) ? hpMaxParsed : null,
      abilities: w.abilities || [],
      portraitUrl: w.portraitUrl !== undefined ? w.portraitUrl : selectedEntry.portraitUrl,
      updatedAt: new Date().toISOString(),
    };
    const nextEntries = entries.map((t) => t.id === selectedId ? updatedEntry : t);
    // MRU: bring saved entry to front
    const reordered = [updatedEntry, ...nextEntries.filter((t) => t.id !== selectedId)];
    setEntries(reordered);
    setIsDirty(false);
    setSaving(true);
    try {
      await saveToBackend(reordered);
    } finally {
      setSaving(false);
    }
    clearTimeout(savedFlashTimerRef.current);
    setSavedFlash(true);
    savedFlashTimerRef.current = setTimeout(() => setSavedFlash(false), 1400);
  }

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) requestClose();
  }

  const showSearch = entries.length > 20;

  return (
    <div className="eg-modal-overlay" onClick={handleOverlayClick}>
      <div className="eg-modal-panel" style={{ "--npc-accent": npcPal.accent, "--npc-bright": npcPal.bright, "--npc-chip-bg": npcPal.chipBg, "--npc-action-border": npcPal.actionBorder, "--npc-track": npcPal.track, "--npc-surface-solid": npcPal.surfaceSolid, "--pal-text": pal.text, "--pal-text-body": pal.textBody, "--pal-text-muted": pal.textMuted, "--pal-border": pal.border, "--pal-accent": pal.accent, "--pal-accent-bright": pal.accentBright }}>
        <div className="eg-modal-header">
          <span className="eg-modal-title" style={{ fontFamily: pal.fontDisplay }}>NPC Library</span>
          <button className="eg-close-btn" onClick={requestClose} aria-label="Close">×</button>
        </div>

        <div className={`eg-modal-body${isMobileDrilled ? " drilled-in" : ""}`}>
          {/* List pane */}
          <div className="eg-list-pane">
            {showSearch && (
              <div className="eg-list-search-wrap">
                <input
                  className="eg-search-input"
                  type="text"
                  placeholder="Search name or abilities…"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                />
              </div>
            )}
            <div className="eg-list-rows">
              {filteredEntries.length === 0 && filterText && (
                <div className="eg-list-empty-msg" style={{ fontFamily: pal.fontBody }}>No matches.</div>
              )}
              {filteredEntries.length === 0 && !filterText && (
                <div className="eg-list-empty-msg" style={{ fontFamily: pal.fontBody }}>No entries yet. Add one below.</div>
              )}
              {filteredEntries.map((tpl) => {
                const isSelected = tpl.id === selectedId;
                const hpPart = tpl.hpMax ? `♥ ${tpl.hpMax} · ` : "";
                const ablCount = (tpl.abilities || []).length;
                return (
                  <div
                    key={tpl.id}
                    className={`eg-entry-row${isSelected ? " selected" : ""}`}
                    onClick={() => selectEntry(tpl.id)}
                    style={deleteConfirmId === tpl.id ? { background: "rgba(192,96,96,0.06)" } : undefined}
                  >
                    <div className="eg-entry-thumb" style={{ fontFamily: pal.fontDisplay }}>
                      <PortraitCircle portraitUrl={tpl.portraitUrl} name={tpl.name} size={30} npcPal={npcPal} />
                    </div>
                    <div className="eg-entry-text">
                      <div className="eg-entry-name" title={tpl.name} style={{ fontFamily: pal.fontDisplay }}>{tpl.name || "(untitled)"}</div>
                      <div className="eg-entry-meta" style={{ fontFamily: pal.fontUI }}>
                        {hpPart}{ablCount} abl
                      </div>
                    </div>
                    {isSelected && <span className="eg-entry-chevron">▸</span>}
                  </div>
                );
              })}
              <div className="eg-new-entry-row">
                <button className="eg-new-entry-btn" onClick={createNewEntry} style={{ fontFamily: pal.fontUI }}>+ New entry</button>
              </div>
            </div>

            <div className="eg-list-footer">
              {deleteConfirmId !== null ? (
                <div className="eg-delete-confirm-row">
                  <span style={{ fontFamily: pal.fontBody, fontSize: 12, fontStyle: "italic", color: pal.textMuted, flex: 1 }}>Delete this entry?</span>
                  <button className="eg-confirm-del-btn" onClick={() => commitDeleteEntry(deleteConfirmId)}>Delete</button>
                  <button className="eg-confirm-cancel-btn" onClick={() => setDeleteConfirmId(null)}>Cancel</button>
                </div>
              ) : (
                <>
                  <button
                    className="eg-list-action-btn"
                    disabled={!selectedEntry}
                    onClick={duplicateEntry}
                    style={{ fontFamily: pal.fontBody }}
                  >⧉ Duplicate</button>
                  <button
                    className="eg-list-action-btn danger"
                    disabled={!selectedEntry}
                    onClick={() => startDeleteEntry(selectedId)}
                    style={{ fontFamily: pal.fontBody }}
                  >🗑 Delete</button>
                </>
              )}
            </div>
          </div>

          {/* Detail pane */}
          <div className="eg-detail-pane">
            <button className="eg-mobile-back" onClick={() => { setIsMobileDrilled(false); setIsDirty(false); }} style={{ fontFamily: pal.fontUI }}>
              ‹ Enemies Gallery
            </button>

            {selectedEntry ? (
              <EntryEditor
                key={selectedEntry.id}
                entry={selectedEntry}
                npcPal={npcPal}
                dmPassword={dmPassword}
                onMarkDirty={() => setIsDirty(true)}
                onSave={handleSave}
                workingRef={workingRef}
              />
            ) : (
              <div className="eg-detail-empty" style={{ fontFamily: pal.fontBody }}>
                Select an entry from the list, or create one with + New entry.
              </div>
            )}

            {selectedEntry && (
              <div className="eg-save-row">
                <button
                  className="eg-save-btn"
                  disabled={!isDirty || saving}
                  onClick={handleSave}
                  style={{ fontFamily: pal.fontUI, background: npcPal.chipBg, border: `1px solid ${npcPal.accent}`, color: npcPal.bright }}
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
                {savedFlash && (
                  <span className="eg-saved-flash" style={{ fontFamily: pal.fontUI, color: npcPal.bright }}>✓ Saved</span>
                )}
              </div>
            )}
          </div>
        </div>

        {showDirtyGuard && (
          <div className="eg-dirty-guard" style={{ fontFamily: pal.fontBody }}>
            <span className="eg-dirty-guard-text">You have unsaved changes.</span>
            <div className="eg-dirty-guard-actions">
              <button className="eg-dirty-discard-btn" onClick={discardAndClose} style={{ fontFamily: pal.fontUI }}>Discard changes</button>
              <button className="eg-dirty-keep-btn" onClick={keepEditing} style={{ fontFamily: pal.fontUI, background: npcPal.chipBg, border: `1px solid ${npcPal.accent}`, color: npcPal.bright }}>Keep editing</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
