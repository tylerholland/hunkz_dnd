import { DESCRIPTION_MAX_LENGTH, uid } from "./constants";
import { FEATURE_KINDS, normalizeFeatures, proficiencyBonus } from "./features";

/**
 * Features & Traits editor (character sheet edit mode). Players enter their
 * own race/class features from their books — the app tracks the uses.
 */
export default function FeaturesEditor({ features, level, onChange, pal, secHead, lbl }) {
  const list = normalizeFeatures(features);
  const prof = proficiencyBonus(level);
  const set = (next) => onChange(next);
  const patch = (id, changes) => set(list.map((f) => (f.id === id ? { ...f, ...changes } : f)));
  const patchUses = (id, uses) => patch(id, { uses });

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={secHead}>Features &amp; Traits</div>
      <div style={{ fontFamily: pal.fontBody, fontSize: 13, color: pal.textMuted, marginBottom: 12, fontStyle: "italic" }}>
        Race and class features from your books (e.g. a Firbolg&apos;s Hidden Step). Features with uses get pips on your Session page, refilled by a short or long rest.
      </div>

      {list.length === 0 && (
        <div style={{ fontFamily: pal.fontBody, fontSize: 14, color: pal.textMuted, fontStyle: "italic", marginBottom: 10 }}>No features added.</div>
      )}

      {list.map((feature) => {
        const usesMode = feature.uses?.mode || "none";
        return (
          <div key={feature.id} style={{ border: `1px solid ${pal.border}`, borderRadius: 4, padding: 12, marginBottom: 10, display: "grid", gap: 10 }}>
            <div className="flex-row" style={{ gap: 8 }}>
              <input
                className="input-base"
                style={{ flex: 1 }}
                maxLength={60}
                value={feature.name}
                onChange={(e) => patch(feature.id, { name: e.target.value })}
                placeholder="Feature name…"
                aria-label="Feature name"
              />
              <select
                className="input-base"
                style={{ width: "auto" }}
                value={feature.kind}
                onChange={(e) => patch(feature.id, { kind: e.target.value })}
                aria-label="Feature type"
              >
                {FEATURE_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
              </select>
              <button
                type="button"
                onClick={() => set(list.filter((f) => f.id !== feature.id))}
                className="btn-ghost"
                aria-label={`Remove ${feature.name}`}
                style={{ width: 34, padding: 0, flexShrink: 0, color: pal.textMuted, fontSize: 20, textAlign: "center" }}
              >×</button>
            </div>
            <div>
              <label style={lbl}>Description</label>
              <textarea
                className="input-base"
                style={{ minHeight: 70, resize: "vertical" }}
                maxLength={DESCRIPTION_MAX_LENGTH}
                value={feature.description}
                onChange={(e) => patch(feature.id, { description: e.target.value })}
                placeholder="What it does, from your book…"
              />
            </div>
            <div className="flex-row" style={{ gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div>
                <label style={lbl}>Uses</label>
                <select
                  className="input-base"
                  style={{ width: "auto" }}
                  value={usesMode}
                  onChange={(e) => {
                    const mode = e.target.value;
                    if (mode === "none") patchUses(feature.id, null);
                    else patchUses(feature.id, { mode, max: feature.uses?.max ?? 1, recharge: feature.uses?.recharge || "long", used: 0 });
                  }}
                >
                  <option value="none">No limit</option>
                  <option value="fixed">A fixed number</option>
                  <option value="prof">= Proficiency bonus ({prof})</option>
                </select>
              </div>
              {usesMode === "fixed" && (
                <div>
                  <label style={lbl}>How many</label>
                  <input
                    className="input-base"
                    type="number"
                    min="1"
                    max="99"
                    style={{ width: 80 }}
                    value={feature.uses.max ?? 1}
                    onChange={(e) => patchUses(feature.id, { ...feature.uses, max: Math.max(1, Math.min(99, parseInt(e.target.value, 10) || 1)) })}
                  />
                </div>
              )}
              {usesMode !== "none" && (
                <div>
                  <label style={lbl}>Recharges on</label>
                  <select
                    className="input-base"
                    style={{ width: "auto" }}
                    value={feature.uses.recharge}
                    onChange={(e) => patchUses(feature.id, { ...feature.uses, recharge: e.target.value })}
                  >
                    <option value="long">Long rest</option>
                    <option value="short">Short rest</option>
                  </select>
                </div>
              )}
            </div>
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => set([...list, { id: uid(), name: "", kind: "race", description: "", uses: null }])}
        className="btn-ghost"
        style={{ width: "auto", padding: "7px 16px", color: pal.accentBright, borderStyle: "dashed" }}
      >
        + Add feature
      </button>
    </div>
  );
}
