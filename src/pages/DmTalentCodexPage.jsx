import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getTalentCodex, putTalentCodex } from "../api";
import { PALETTES } from "../components/CharacterSheet";
import { PalCtx } from "../features/dmDashboard/dashboardShared";
import DmLoginPrompt from "../features/dmDashboard/DmLoginPrompt";
import TopNav from "../components/TopNav";
import { useTextScale } from "../lib/useTextScale";
import { CHARACTER_SKILLS, SPECIAL_ABILITIES, TALENT_DETAILS } from "../features/characterSheet/talentCatalog";
import { setTalentCodex } from "../features/characterSheet/talentCodexStore";
import { TooltipBody } from "../features/characterSheet/CharacterTalents";
import "./dmSettings.css";
import "./talentCodex.css";

// Story 39 — Talent Codex (DM Settings → Talent Codex). The DM refines the
// built-in descriptions of the table's skills and special abilities and adds
// an optional "At the table" ruling. Only overrides are saved; untouched
// entries keep the built-in text, and "Reset to built-in" removes an override.

const GROUPS = [
  { title: "Skills", keys: CHARACTER_SKILLS },
  { title: "Special abilities", keys: SPECIAL_ABILITIES },
];

function builtIn(key) {
  return TALENT_DETAILS[key] || { label: key, description: "" };
}

export default function DmTalentCodexPage() {
  const [dmPassword, setDmPassword] = useState(() => sessionStorage.getItem("dnd_dm_password") || "");
  const [authed, setAuthed] = useState(() => !!sessionStorage.getItem("dnd_dm_password"));
  const [entries, setEntries] = useState(null); // saved overrides
  const [loadError, setLoadError] = useState(null);
  const [selectedKey, setSelectedKey] = useState(CHARACTER_SKILLS[0]);
  const [draft, setDraft] = useState(null); // { description, atTable } for selectedKey
  const [pendingKey, setPendingKey] = useState(null); // asked to switch with unsaved changes
  const [filter, setFilter] = useState("");
  const [status, setStatus] = useState({ kind: "idle", message: "" });
  const [mobileEditing, setMobileEditing] = useState(false);
  const { textScale, textScaleMenuItem } = useTextScale();

  const palKey = sessionStorage.getItem("dnd_dm_palette") || "ocean";
  const pal = PALETTES[palKey] || PALETTES.ocean;

  useEffect(() => {
    if (!authed) return undefined;
    let cancelled = false;
    getTalentCodex()
      .then((codex) => {
        if (cancelled) return;
        setEntries(codex.entries || {});
        setTalentCodex(codex.entries || {}, codex.version);
      })
      .catch(() => { if (!cancelled) setLoadError("Couldn't load the codex — check your connection and reload."); });
    return () => { cancelled = true; };
  }, [authed]);

  const current = useMemo(() => {
    const base = builtIn(selectedKey);
    const override = entries?.[selectedKey] || {};
    return { description: override.description || base.description || "", atTable: override.atTable || "" };
  }, [entries, selectedKey]);
  const shown = draft ?? current;
  const dirty = !!draft && (draft.description !== current.description || draft.atTable !== current.atTable);
  const edited = (key) => !!entries?.[key];

  if (!authed) {
    return (
      <PalCtx.Provider value={pal}>
        <DmLoginPrompt onSuccess={(pw) => { setDmPassword(pw); setAuthed(true); }} />
      </PalCtx.Provider>
    );
  }

  function select(key) {
    if (key === selectedKey) { setMobileEditing(true); return; }
    if (dirty) { setPendingKey(key); return; }
    setSelectedKey(key);
    setDraft(null);
    setStatus({ kind: "idle", message: "" });
    setMobileEditing(true);
  }

  function edit(field, value) {
    setDraft((prev) => ({ ...(prev ?? current), [field]: value }));
    setStatus({ kind: "idle", message: "" });
  }

  async function saveEntries(nextEntries, message) {
    setStatus({ kind: "saving", message: "Saving…" });
    try {
      const res = await putTalentCodex(dmPassword, nextEntries);
      setEntries(res.entries || {});
      setTalentCodex(res.entries || {}, res.version);
      setDraft(null);
      setStatus({ kind: "saved", message });
      return true;
    } catch (err) {
      setStatus({ kind: "error", message: err?.status === 403 ? "DM password rejected — sign in again from the Campaign page." : "Couldn't save. Try again." });
      return false;
    }
  }

  async function save() {
    if (!draft || !entries) return false;
    const base = builtIn(selectedKey);
    const description = draft.description.trim();
    const atTable = draft.atTable.trim();
    const next = { ...entries };
    const override = {
      ...(description && description !== (base.description || "").trim() ? { description } : {}),
      ...(atTable ? { atTable } : {}),
    };
    if (Object.keys(override).length) next[selectedKey] = override;
    else delete next[selectedKey];
    return saveEntries(next, "Saved — everyone's info boxes update within a few seconds.");
  }

  async function resetToBuiltIn() {
    if (!entries) return;
    const next = { ...entries };
    delete next[selectedKey];
    await saveEntries(next, "Back to the built-in text.");
  }

  async function resolvePending(action) {
    const target = pendingKey;
    setPendingKey(null);
    if (action === "stay") return;
    if (action === "save" && !(await save())) return;
    setSelectedKey(target);
    setDraft(null);
    setMobileEditing(true);
  }

  const palVars = {
    "--pal-bg": pal.bg,
    "--pal-surface": pal.surface,
    "--pal-surface-solid": pal.surfaceSolid,
    "--pal-border": pal.border,
    "--pal-accent": pal.accent,
    "--pal-accent-bright": pal.accentBright,
    "--pal-accent-dim": pal.accentDim,
    "--pal-text": pal.text,
    "--pal-text-body": pal.textBody,
    "--pal-text-muted": pal.textMuted,
    "--pal-gem": pal.gem,
    "--font-display": pal.fontDisplay,
    "--font-body": pal.fontBody,
    "--font-ui": pal.fontUI,
  };
  const needle = filter.trim().toLowerCase();
  const base = builtIn(selectedKey);
  const kindLabel = CHARACTER_SKILLS.includes(selectedKey) ? "Skill" : "Special ability";

  return (
    <PalCtx.Provider value={pal}>
      <div
        className="dm-settings-page"
        style={{ ...palVars, zoom: textScale, background: `radial-gradient(ellipse at 50% 0%, ${pal.glow1} 0%, transparent 60%), ${pal.bg}` }}
      >
        <TopNav backTo="/dm/settings" title="Talent Codex" menuItems={[{ label: "DM Settings", href: "/dm/settings" }, { label: "Campaign", href: "/dm" }, { divider: true }, textScaleMenuItem]} />
        <main className="tc-main">
          <p className="dm-settings-intro">
            Your table&apos;s own words for each skill and special ability. Players see them in the info boxes on their sheets and party cards. <b>At the table</b> holds house rulings and only shows when you&apos;ve written one. <Link to="/dm/settings" className="tc-link">← DM Settings</Link>
          </p>
          {loadError && <p className="dm-settings-status dm-settings-status--error" role="alert">{loadError}</p>}

          <div className={`tc-layout${mobileEditing ? " tc-editing" : ""}`}>
            <nav className="tc-rail" aria-label="Skills and special abilities">
              <input className="dm-settings-input tc-filter" placeholder="Filter…" aria-label="Filter skills and abilities" value={filter} onChange={(e) => setFilter(e.target.value)} />
              {GROUPS.map((group) => {
                const keys = group.keys.filter((key) => !needle || builtIn(key).label.toLowerCase().includes(needle));
                if (!keys.length) return null;
                return (
                  <div key={group.title} className="tc-group">
                    <div className="tc-group-title">{group.title}</div>
                    {keys.map((key) => (
                      <button
                        key={key}
                        type="button"
                        className={`tc-item${key === selectedKey ? " on" : ""}`}
                        aria-current={key === selectedKey ? "true" : undefined}
                        onClick={() => select(key)}
                      >
                        <span>{builtIn(key).label}</span>
                        {edited(key) ? <span className="tc-edited" title="Edited for this table">●</span> : null}
                      </button>
                    ))}
                  </div>
                );
              })}
            </nav>

            <section className="tc-editor" aria-labelledby="tc-editor-h">
              <button type="button" className="tc-back" onClick={() => setMobileEditing(false)}>← All skills &amp; abilities</button>
              <div className="tc-editor-head">
                <h2 id="tc-editor-h" className="dm-settings-label">{base.label}</h2>
                <span className="tc-kind">{kindLabel}{edited(selectedKey) ? " · edited" : " · built-in text"}</span>
              </div>

              {pendingKey && (
                <div className="tc-guard" role="alertdialog" aria-label="Unsaved changes">
                  <span>You have unsaved changes to {base.label}.</span>
                  <button type="button" className="dm-settings-save" onClick={() => resolvePending("save")}>Save</button>
                  <button type="button" className="dm-settings-revert" onClick={() => resolvePending("discard")}>Discard</button>
                  <button type="button" className="dm-settings-revert" onClick={() => resolvePending("stay")}>Keep editing</button>
                </div>
              )}

              <label className="tc-field">
                <span className="tc-field-label">Description</span>
                <textarea
                  rows={6}
                  maxLength={2000}
                  value={shown.description}
                  disabled={!entries}
                  onChange={(e) => edit("description", e.target.value)}
                />
                <span className="tc-hint">**bold**, *italic*, a blank line between paragraphs, "- " for a list.</span>
              </label>
              <label className="tc-field">
                <span className="tc-field-label">At the table <span className="tc-optional">(optional)</span></span>
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={shown.atTable}
                  disabled={!entries}
                  placeholder="e.g. +1 to Awareness checks in darkness"
                  onChange={(e) => edit("atTable", e.target.value)}
                />
                <span className="tc-hint">House rulings. Shown in info boxes only when filled in.</span>
              </label>

              <div className="tc-preview" aria-label="Preview">
                <span className="tc-field-label">Preview</span>
                <div className="tc-preview-box">
                  <TooltipBody pal={pal} tooltip={{ description: shown.description || base.label, ...(shown.atTable.trim() ? { atTable: shown.atTable } : {}) }} />
                </div>
              </div>

              <div className="dm-settings-actions">
                <button type="button" className="dm-settings-save" onClick={save} disabled={!dirty || status.kind === "saving"}>
                  {status.kind === "saving" ? "Saving…" : "Save"}
                </button>
                {dirty && <button type="button" className="dm-settings-revert" onClick={() => setDraft(null)}>Discard</button>}
                {edited(selectedKey) && !dirty && (
                  <button type="button" className="dm-settings-revert" onClick={resetToBuiltIn} disabled={status.kind === "saving"}>Reset to built-in</button>
                )}
                {status.message && (
                  <span className={`dm-settings-status dm-settings-status--${status.kind}`} role={status.kind === "error" ? "alert" : "status"}>{status.message}</span>
                )}
              </div>
            </section>
          </div>
        </main>
      </div>
    </PalCtx.Provider>
  );
}
