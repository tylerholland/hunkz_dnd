// Story 72 — the item catalog as a spreadsheet: export, parse, and the diff
// shown before an import is applied. Rows match by `id`.
const COLUMNS = ["id", "name", "category", "price", "per", "effect", "notes", "shown"];

const cell = (v) => {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function catalogToCsv(items) {
  const rows = items.map((i) => [i.id, i.name, i.cat, i.price, i.per || "", i.stat || "", i.notes || "", i.hidden ? "no" : "yes"]);
  return [COLUMNS, ...rows].map((r) => r.map(cell).join(",")).join("\n");
}

/** Rows of cells, honouring quotes, doubled quotes and newlines inside quotes. */
export function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  const src = String(text || "").replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i += 1;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const slugify = (s) => String(s || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/**
 * Items from a CSV, keyed by the header row (column order doesn't matter).
 * Rows without a name are skipped; a missing id is made from the name.
 */
export function csvToItems(text, shelfIds) {
  const [header, ...rows] = parseCsv(text);
  if (!header) return { items: [], errors: ["The file is empty."] };
  const col = Object.fromEntries(header.map((h, i) => [h.trim().toLowerCase(), i]));
  if (col.name === undefined || col.price === undefined) return { items: [], errors: ["The file needs at least a name and a price column."] };
  const get = (r, k) => (col[k] === undefined ? "" : String(r[col[k]] ?? "").trim());
  const items = [], errors = [];
  rows.forEach((r, n) => {
    const name = get(r, "name");
    if (!name) return;
    const cat = get(r, "category").toLowerCase() || get(r, "cat").toLowerCase();
    const price = Number(get(r, "price"));
    if (!shelfIds.includes(cat)) { errors.push(`Row ${n + 2} (${name}): unknown category “${cat}”`); return; }
    if (!Number.isFinite(price) || price < 0) { errors.push(`Row ${n + 2} (${name}): price must be a number`); return; }
    const item = { id: slugify(get(r, "id") || name), name, cat, price };
    const per = get(r, "per"); if (per) item.per = per;
    const stat = get(r, "effect") || get(r, "stat"); if (stat) item.stat = stat;
    const notes = get(r, "notes"); if (notes) item.notes = notes;
    if (/^(no|false|0|hidden)$/i.test(get(r, "shown"))) item.hidden = true;
    items.push(item);
  });
  return { items, errors };
}

const FIELDS = ["name", "cat", "price", "per", "stat", "notes", "hidden"];
/** What an import would change: new rows, changed rows (with which fields), and rows missing from the file. */
export function diffCatalog(current, incoming) {
  const before = new Map(current.map((i) => [i.id, i]));
  const after = new Map(incoming.map((i) => [i.id, i]));
  const added = incoming.filter((i) => !before.has(i.id));
  const changed = incoming
    .filter((i) => before.has(i.id))
    .map((i) => ({ item: i, fields: FIELDS.filter((f) => String(before.get(i.id)[f] ?? "") !== String(i[f] ?? "")) }))
    .filter((c) => c.fields.length);
  const missing = current.filter((i) => !after.has(i.id));
  return { added, changed, missing };
}
