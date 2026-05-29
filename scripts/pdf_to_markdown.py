#!/usr/bin/env python3
"""
Convert Living-Greyhawk-Gazetteer.pdf to structured markdown files.

Output layout:
  world-guide/
    toc.json                        <- manifest for the app's sidebar nav
    01-greyhawks-world.md
    02-folk-of-the-flanaess.md
    03-history-of-the-flanaess.md
    04-gazetteer/
      ahlissa.md
      bandit-kingdoms.md
      ...  (one file per realm)
      _index.md                     <- gazetteer overview / key page
    05-geography-of-the-flanaess.md
    06-power-groups.md
    07-greyhawks-gods.md
    08-appendix.md

Usage:
    python3 scripts/pdf_to_markdown.py
    python3 scripts/pdf_to_markdown.py --pdf path/to/other.pdf --out path/to/output
"""

import re
import json
import argparse
from pathlib import Path

try:
    import fitz  # pymupdf
except ImportError:
    raise SystemExit("pymupdf not installed. Run: pip3 install pymupdf")


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

PDF_PATH = Path(__file__).parent.parent / "src/assets/Living-Greyhawk-Gazetteer.pdf"
OUT_DIR  = Path(__file__).parent.parent / "public" / "world-guide"

# Font-size thresholds (tweak if headings look off after first run)
H1_MIN_SIZE = 14.0   # chapter / major realm name  → ##
H2_MIN_SIZE = 11.5   # sub-section name            → ###
BODY_MIN_SIZE = 8.0  # ignore anything smaller (footers, footnotes, page numbers)

# Pages to skip entirely (cover, ToC page, heraldry plates, maps, back cover)
SKIP_PAGES = {1, 2, 195, 196, 197, 198, 199, 200}

# TOC level-1 entries that map to the gazetteer section — realms get their own files
GAZETTEER_TITLE = "Gazetteer of the Flanaess"

# Realms that are listed as TOC level-2 grouping headers, not real realm entries
GAZETTEER_GROUP_HEADERS = {"Realms of the Flanaess Key", "Realms A - G", "Realms H - R", "Realms S - Z"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[''']", "", text)
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def clean_text(text: str) -> str:
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


# ---------------------------------------------------------------------------
# PDF parsing
# ---------------------------------------------------------------------------

def _render_para(parts: list) -> str:
    """Render accumulated (bold, text) pairs as a markdown paragraph string."""
    rendered = []
    for bold, text in parts:
        if bold and text.strip():
            rendered.append(f"**{text.strip()}**")
        else:
            rendered.append(text)
    result = "".join(rendered)
    return re.sub(r" {2,}", " ", result).strip()


def _reading_order_blocks(page):
    """Return text blocks in natural reading order.

    For two-column pages, left-column blocks are returned before right-column
    ones (sorted by y within each column). For single-column pages, blocks are
    sorted by y. Column boundary is detected by looking for a horizontal gap
    > 50pt between block x-starts, rather than using the page midpoint (which
    fails for PDFs with asymmetric margins).
    """
    blocks = [b for b in page.get_text("dict")["blocks"] if b.get("type") == 0]
    if not blocks:
        return blocks

    x_starts = sorted(set(round(b["bbox"][0]) for b in blocks))
    col_boundary = None
    for i in range(len(x_starts) - 1):
        if x_starts[i + 1] - x_starts[i] > 50:
            col_boundary = (x_starts[i] + x_starts[i + 1]) / 2
            break

    if col_boundary:
        return sorted(blocks, key=lambda b: (0 if b["bbox"][0] < col_boundary else 1, b["bbox"][1]))
    return sorted(blocks, key=lambda b: b["bbox"][1])


def page_to_markdown(page) -> str:
    """Convert a page to reflowed markdown.

    Processes the PDF at line granularity within each block. A line whose first
    span is bold starts a new paragraph (these are label lines like 'Ruler:'),
    and continuation lines are joined with a space (or directly for soft hyphens).
    Heading-sized lines are emitted as ## / ### and always flush any open paragraph.
    Bold label paragraphs are later promoted to #### subheadings by
    promote_labels_to_headings().
    """
    result_paragraphs = []
    current_para: list = []  # list of (bold: bool, text: str)

    def flush():
        if current_para:
            p = _render_para(current_para)
            if p:
                result_paragraphs.append(p)
            current_para.clear()

    for block in _reading_order_blocks(page):
        if block.get("type") != 0:
            continue

        for line in block.get("lines", []):
            spans = [
                {"size": s.get("size", 0), "bold": bool(s.get("flags", 0) & 16), "text": s.get("text", "")}
                for s in line.get("spans", [])
                if s.get("size", 0) >= BODY_MIN_SIZE and s.get("text", "")
            ]
            if not spans:
                continue

            max_size = max(s["size"] for s in spans)

            if max_size >= H1_MIN_SIZE:
                flush()
                heading = re.sub(r"\s+", " ", " ".join(s["text"] for s in spans)).strip()
                result_paragraphs.append(f"## {heading}")

            elif max_size >= H2_MIN_SIZE:
                flush()
                heading = re.sub(r"\s+", " ", " ".join(s["text"] for s in spans)).strip()
                result_paragraphs.append(f"### {heading}")

            else:
                # A line whose first non-empty span is bold starts a new paragraph
                # (these are structured label lines: "Ruler:", "Government:", etc.)
                if spans[0]["bold"] and spans[0]["text"].strip() and current_para:
                    flush()

                if not current_para:
                    for s in spans:
                        current_para.append((s["bold"], s["text"]))
                else:
                    # Join to existing paragraph, handling soft hyphens
                    last_bold, last_text = current_para[-1]
                    if last_text.rstrip().endswith("-"):
                        current_para[-1] = (last_bold, last_text.rstrip()[:-1])
                        current_para.append((spans[0]["bold"], spans[0]["text"].lstrip()))
                        for s in spans[1:]:
                            current_para.append((s["bold"], s["text"]))
                    else:
                        current_para.append((spans[0]["bold"], " " + spans[0]["text"].lstrip()))
                        for s in spans[1:]:
                            current_para.append((s["bold"], s["text"]))

    flush()
    return "\n\n".join(result_paragraphs)


def promote_labels_to_headings(text: str) -> str:
    """Promote **Label**: patterns at paragraph starts to #### subheadings.

    Handles both '**Label**: value' and '**Label:** value' (colon inside or
    outside the bold markers). Only promotes when the bold label is the first
    thing in the paragraph, so mid-paragraph emphasis is left alone.
    """
    label_re = re.compile(r'^\*\*([^*\n]+?)\*\*:?\s*([\s\S]*)', re.DOTALL)
    paragraphs = text.split("\n\n")
    result = []
    for para in paragraphs:
        if para.startswith("#"):
            result.append(para)
            continue
        m = label_re.match(para)
        if m:
            label = m.group(1).strip().rstrip(":")
            content = m.group(2).strip()
            result.append(f"#### {label}\n{content}" if content else f"#### {label}")
        else:
            result.append(para)
    return "\n\n".join(b for b in result if b.strip())


def extract_pages(doc, start_page: int, end_page: int, trim_to_title: str = None) -> str:
    """Extract markdown text from a page range (1-indexed, inclusive).

    trim_to_title: if set, discard everything before the first ## heading whose
    text matches this title (case-insensitive). Handles the common case where a
    section starts mid-page and we'd otherwise capture the tail of the prior section.
    """
    parts = []
    for page_num in range(start_page, end_page + 1):
        if page_num in SKIP_PAGES:
            continue
        parts.append(page_to_markdown(doc[page_num - 1]))

    combined = clean_text("\n\n".join(p for p in parts if p))
    combined = promote_labels_to_headings(combined)

    if trim_to_title:
        pattern = re.compile(
            r"(^|\n)(##+ " + re.escape(trim_to_title) + r"\b)",
            re.IGNORECASE,
        )
        m = pattern.search(combined)
        if m:
            combined = combined[m.start():].lstrip("\n")

    return combined


# ---------------------------------------------------------------------------
# TOC processing
# ---------------------------------------------------------------------------

def build_section_map(doc):
    """
    Parse the embedded TOC and return a list of section dicts:
      { title, level, start_page, end_page }
    """
    toc = doc.get_toc()
    total_pages = len(doc)
    sections = []

    for i, (level, title, page) in enumerate(toc):
        # End page = start of next entry at same or higher level, minus 1
        end_page = total_pages
        for j in range(i + 1, len(toc)):
            nlevel, _, npage = toc[j]
            if nlevel <= level:
                end_page = npage - 1
                break
        sections.append({
            "title": title,
            "level": level,
            "start_page": page,
            "end_page": end_page,
        })

    return sections


# ---------------------------------------------------------------------------
# Writers
# ---------------------------------------------------------------------------

def write_chapter(path: Path, title: str, content: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    body = f"# {title}\n\n{content}\n"
    path.write_text(body, encoding="utf-8")
    print(f"  wrote {path.relative_to(OUT_DIR.parent)}")


def process_gazetteer(doc, sections: list[dict], out_dir: Path) -> list[dict]:
    """
    Write one markdown file per realm. Returns TOC entries for the manifest.
    """
    gaz_dir = out_dir / "04-gazetteer"
    gaz_dir.mkdir(parents=True, exist_ok=True)

    # Find realm entries: level 3 inside the Gazetteer section
    in_gaz = False
    toc_entries = []

    for sec in sections:
        if sec["level"] == 1 and sec["title"] == GAZETTEER_TITLE:
            in_gaz = True
        elif sec["level"] == 1 and in_gaz:
            in_gaz = False

        if not in_gaz:
            continue

        if sec["title"] in GAZETTEER_GROUP_HEADERS:
            # Write the key/overview page as _index.md
            if sec["title"] == "Realms of the Flanaess Key":
                content = extract_pages(doc, sec["start_page"], sec["end_page"], trim_to_title=sec["title"])
                write_chapter(gaz_dir / "_index.md", sec["title"], content)
                toc_entries.append({"title": sec["title"], "file": "04-gazetteer/_index.md", "level": 2})
            continue

        if sec["level"] == 3:
            fname = slugify(sec["title"]) + ".md"
            content = extract_pages(doc, sec["start_page"], sec["end_page"], trim_to_title=sec["title"])
            write_chapter(gaz_dir / fname, sec["title"], content)
            toc_entries.append({
                "title": sec["title"],
                "file": f"04-gazetteer/{fname}",
                "level": 3,
            })

    return toc_entries


def process_chapters(doc, sections: list[dict], out_dir: Path) -> list[dict]:
    """
    Write one markdown file per top-level chapter (excluding Gazetteer).
    Returns TOC entries for the manifest.
    """
    chapter_map = {
        "Greyhawk's World":         ("01-greyhawks-world.md",          "01"),
        "Folk of the Flanaess":     ("02-folk-of-the-flanaess.md",      "02"),
        "History of the Flanaess":  ("03-history-of-the-flanaess.md",   "03"),
        "Geography of the Flanaess":("05-geography-of-the-flanaess.md", "05"),
        "Power Groups":             ("06-power-groups.md",              "06"),
        "Greyhawk's Gods":          ("07-greyhawks-gods.md",            "07"),
        "Appendix:The Living Greyhawk Campaign": ("08-appendix.md",     "08"),
    }

    toc_entries = []

    for sec in sections:
        if sec["level"] != 1:
            continue
        if sec["title"] not in chapter_map:
            continue

        fname, prefix = chapter_map[sec["title"]]
        content = extract_pages(doc, sec["start_page"], sec["end_page"], trim_to_title=sec["title"])
        write_chapter(out_dir / fname, sec["title"], content)
        toc_entries.append({
            "title": sec["title"],
            "file": fname,
            "level": 1,
        })

    return toc_entries


def build_toc_manifest(chapter_entries: list[dict], gazetteer_entries: list[dict]) -> dict:
    """Build the toc.json structure consumed by the app's sidebar."""
    entries = []

    for e in chapter_entries:
        order = int(e["file"].split("-")[0]) if e["file"][0].isdigit() else 99
        entries.append({**e, "_order": order})

    # Insert gazetteer group after chapter 03
    gaz_group = {
        "title": "Gazetteer of the Flanaess",
        "file": None,
        "level": 1,
        "_order": 4,
        "children": gazetteer_entries,
    }
    entries.append(gaz_group)
    entries.sort(key=lambda x: x["_order"])

    # Strip internal sort key
    for e in entries:
        e.pop("_order", None)

    return {"sections": entries}


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Convert Greyhawk PDF to markdown")
    parser.add_argument("--pdf", default=str(PDF_PATH))
    parser.add_argument("--out", default=str(OUT_DIR))
    args = parser.parse_args()

    pdf_path = Path(args.pdf)
    out_dir  = Path(args.out)

    if not pdf_path.exists():
        raise SystemExit(f"PDF not found: {pdf_path}")

    out_dir.mkdir(parents=True, exist_ok=True)
    print(f"Opening {pdf_path.name} …")

    doc = fitz.open(str(pdf_path))
    print(f"  {len(doc)} pages")

    sections = build_section_map(doc)

    print("\nWriting chapters …")
    chapter_entries = process_chapters(doc, sections, out_dir)

    print("\nWriting gazetteer realms …")
    gazetteer_entries = process_gazetteer(doc, sections, out_dir)

    print("\nWriting toc.json …")
    manifest = build_toc_manifest(chapter_entries, gazetteer_entries)
    toc_path = out_dir / "toc.json"
    toc_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"  wrote {toc_path.relative_to(out_dir.parent)}")

    print(f"\nDone. {len(chapter_entries)} chapters, {len(gazetteer_entries)} realm files.")
    print(f"Output: {out_dir}/")


if __name__ == "__main__":
    main()
