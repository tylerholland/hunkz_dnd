#!/usr/bin/env python3
"""
Split large world-guide chapter files into per-entry sub-files with index pages.

Handles:
  02-folk-of-the-flanaess.md  → 02-folk/ (one file per race + languages.md + index.md)
  05-geography-of-the-flanaess.md → 05-geography/ (one file per category + index.md)
  07-greyhawks-gods.md        → 07-gods/ (one file per letter group + index.md)
  06-power-groups.md          → 06-power-groups/ (one file per group + index.md)

Also updates world-guide/toc.json to reflect the new structure.

Usage:
    python3 scripts/split_chapters.py
"""

import json
import re
import sys
from pathlib import Path

GUIDE_DIR = Path(__file__).parent.parent / "public" / "world-guide"
TOC_PATH  = GUIDE_DIR / "toc.json"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[''']", "", text)
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def write_file(path: Path, title: str, content: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(f"# {title}\n\n{content}\n", encoding="utf-8")
    print(f"  wrote {path.relative_to(GUIDE_DIR.parent)}")


def read_lines(path: Path) -> list[str]:
    return path.read_text(encoding="utf-8").splitlines()


def lines_to_text(lines: list[str]) -> str:
    return "\n".join(lines).strip()


def split_by_heading(lines: list[str], heading_prefix: str) -> list[tuple[str, list[str]]]:
    """
    Split lines into sections based on a heading prefix (e.g., '### ' or '#### ').
    Returns list of (heading_title, content_lines).
    """
    sections = []
    current_title = None
    current_lines = []

    for line in lines:
        if line.startswith(heading_prefix):
            if current_title is not None:
                sections.append((current_title, current_lines))
            current_title = line[len(heading_prefix):].strip()
            current_lines = []
        else:
            if current_title is not None:
                current_lines.append(line)

    if current_title is not None:
        sections.append((current_title, current_lines))

    return sections


# ---------------------------------------------------------------------------
# Folk of the Flanaess
# ---------------------------------------------------------------------------

def split_folk():
    src = GUIDE_DIR / "02-folk-of-the-flanaess.md"
    if not src.exists():
        print(f"  skipping folk — {src.name} not found")
        return []

    out_dir = GUIDE_DIR / "02-folk"
    lines = read_lines(src)

    # Collect intro (everything before first ### heading)
    intro_lines = []
    for line in lines[2:]:  # skip '# Title' and blank
        if line.startswith("### "):
            break
        intro_lines.append(line)

    # Split races by ### headings
    race_sections = split_by_heading(lines, "### ")

    # Find the Languages section — it starts after ## Other Folk
    # Races are everything before the languages (####) section in Other Folk
    # Languages appear as #### headings
    race_entries = []
    lang_lines_start = None
    for i, (title, content) in enumerate(race_sections):
        # Once we hit entries that are part of languages (they appear under ## Other Folk),
        # we stop adding races. The transition is: race_sections continues but
        # ## Other Folk appears as a line in the content of the last race before languages.
        # Simpler: languages start at the first #### heading in the file.
        race_entries.append((title, content))

    # Find language entries (#### headings) — these appear after ## Other Folk
    other_folk_idx = next((i for i, l in enumerate(lines) if l.startswith("## Other Folk")), None)
    lang_sections = []
    other_folk_intro = []
    if other_folk_idx is not None:
        other_block = lines[other_folk_idx + 1:]
        # Collect intro (before first ####)
        for line in other_block:
            if line.startswith("#### "):
                break
            other_folk_intro.append(line)
        lang_sections = split_by_heading(other_block, "#### ")

    # Write individual race files
    toc_entries = []
    for title, content in race_entries:
        fname = slugify(title) + ".md"
        body = lines_to_text(content)
        write_file(out_dir / fname, title, body)
        toc_entries.append({"title": title, "file": f"02-folk/{fname}", "level": 3})

    # Write languages file
    if lang_sections:
        lang_body_parts = []
        # Add the Other Folk intro first (trolls, ogres, etc.)
        other_intro = lines_to_text(other_folk_intro)
        if other_intro:
            lang_body_parts.append(other_intro + "\n\n---\n")
        for title, content in lang_sections:
            lang_body_parts.append(f"### {title}\n\n{lines_to_text(content)}")
        lang_body = "\n\n".join(lang_body_parts)
        write_file(out_dir / "languages.md", "Languages of the Flanaess", lang_body)
        toc_entries.append({"title": "Languages", "file": "02-folk/languages.md", "level": 2})

    # Write index
    intro_text = lines_to_text(intro_lines)
    race_list = "\n".join(f"- [{t}](02-folk/{slugify(t)}.md)" for t, _ in race_entries)
    index_body = f"{intro_text}\n\n## Races & Peoples\n\n{race_list}\n\n## Languages\n\nSee [Languages of the Flanaess](02-folk/languages.md) for all languages and dialects spoken across the Flanaess."
    write_file(out_dir / "index.md", "Folk of the Flanaess", index_body)

    src.unlink()
    print(f"  removed {src.name}")

    return [{"title": t, "file": e, "level": l} for entry in toc_entries
            for t, e, l in [(entry["title"], entry["file"], entry["level"])]]


# ---------------------------------------------------------------------------
# Geography of the Flanaess
# ---------------------------------------------------------------------------

# Category name → first feature that belongs to it (used to find boundary lines)
GEO_CATEGORIES = [
    ("Forests",     "Adri Forest"),
    ("Mountains",   "Barrier Peaks"),
    ("Hills",       "Abbor-Alz"),
    ("Islands",     "Asperdi-Duxchan"),
    ("Seas & Lakes","Abanfyl, Lake"),
    ("Rivers",      "Artonsamay"),
    ("Wetlands",    "Cold Marshes"),
    ("Wastelands",  "Barren Wastes"),
]


def split_geography():
    src = GUIDE_DIR / "05-geography-of-the-flanaess.md"
    if not src.exists():
        print(f"  skipping geography — {src.name} not found")
        return []

    out_dir = GUIDE_DIR / "05-geography"
    lines = read_lines(src)

    # Find the line index of each category's first feature
    category_starts = []
    for cat_name, first_feature in GEO_CATEGORIES:
        marker = f"#### {first_feature}"
        idx = next((i for i, l in enumerate(lines) if l.strip() == marker), None)
        if idx is None:
            print(f"  WARNING: could not find '{marker}' for category {cat_name}")
        category_starts.append((cat_name, idx))

    # Sort by line index (should already be in order, but just in case)
    category_starts = [(n, i) for n, i in category_starts if i is not None]
    category_starts.sort(key=lambda x: x[1])

    # Split the file into category slices
    toc_entries = []
    for i, (cat_name, start_idx) in enumerate(category_starts):
        end_idx = category_starts[i + 1][1] if i + 1 < len(category_starts) else len(lines)
        cat_lines = lines[start_idx:end_idx]

        # Split into individual feature entries
        features = split_by_heading(cat_lines, "#### ")

        # Filter out caption-only entries (very short, no real content)
        real_features = [(t, c) for t, c in features if lines_to_text(c).strip()]

        # Build the category file: each feature as ### subheading
        body_parts = []
        for feat_title, feat_content in real_features:
            body_parts.append(f"### {feat_title}\n\n{lines_to_text(feat_content)}")
        body = "\n\n".join(body_parts)

        fname = slugify(cat_name) + ".md"
        write_file(out_dir / fname, cat_name, body)
        toc_entries.append({"title": cat_name, "file": f"05-geography/{fname}", "level": 2,
                             "count": len(real_features)})

    # Write index
    index_parts = ["The Flanaess encompasses a vast array of geographic features — ancient forests, towering mountain ranges, deep inland seas, and desolate wastelands. Browse by category:\n"]
    for entry in toc_entries:
        index_parts.append(f"- [{entry['title']}](05-geography/{slugify(entry['title'])}.md) — {entry['count']} entries")
    write_file(out_dir / "index.md", "Geography of the Flanaess",
               "\n".join(index_parts))

    src.unlink()
    print(f"  removed {src.name}")

    return [{"title": e["title"], "file": e["file"], "level": e["level"]} for e in toc_entries]


# ---------------------------------------------------------------------------
# Greyhawk's Gods
# ---------------------------------------------------------------------------

# Letter group name → first god whose body paragraph starts with that name
GODS_GROUPS = [
    ("Gods A–H", ["Al'Akbar", "Allitur", "Atroa", "Beltar"]),   # starts with A
    ("Gods I–M", ["Incabulos", "Istus", "Iuz"]),                  # starts with I
    ("Gods N–P", ["Nerull", "Norebo", "Obad-Hai"]),               # starts with N
    ("Gods R–U", ["Ralishaz", "Rao", "Rudd"]),                    # starts with R
    ("Gods V–Z", ["Vara", "Vecna", "Velnius"]),                   # starts with V
]


def find_god_boundary(lines, name_candidates):
    """Find the line index of the first #### heading before a god whose body text starts with any of the candidates."""
    for i, line in enumerate(lines):
        if not line.startswith("#### "):
            continue
        # Look ahead up to 10 lines for body text starting with a candidate name
        for j in range(i + 1, min(i + 15, len(lines))):
            body = lines[j].strip()
            if body and not body.startswith("####"):
                for candidate in name_candidates:
                    if body.startswith(candidate):
                        return i
                break  # found body text, not a match — stop looking ahead
    return None


def split_gods():
    src = GUIDE_DIR / "07-greyhawks-gods.md"
    if not src.exists():
        print(f"  skipping gods — {src.name} not found")
        return []

    out_dir = GUIDE_DIR / "07-gods"
    lines = read_lines(src)

    # Find the intro (before the first real god entry)
    # The real content starts after the long intro paragraph that ends with "#### Domains"
    # First find boundaries for each letter group
    group_starts = []
    for group_name, candidates in GODS_GROUPS:
        idx = find_god_boundary(lines, candidates)
        if idx is None:
            # Fallback: search body text for first name starting with the group letter
            first_letter = group_name.split("–")[0].split()[-1][0]
            for i, line in enumerate(lines):
                if not line.startswith("#### ") and line.strip() and not line.startswith("#"):
                    if line.strip()[0].upper() == first_letter:
                        # Walk back to find the preceding #### heading
                        for k in range(i - 1, max(0, i - 10), -1):
                            if lines[k].startswith("#### "):
                                idx = k
                                break
                        if idx is not None:
                            break
        if idx is None:
            print(f"  WARNING: could not find boundary for {group_name}")
        group_starts.append((group_name, idx))

    group_starts = [(n, i) for n, i in group_starts if i is not None]
    group_starts.sort(key=lambda x: x[1])

    # Extract intro (before first group)
    first_boundary = group_starts[0][1] if group_starts else len(lines)
    intro_lines = lines[2:first_boundary]  # skip '# Title' + blank
    intro_text = lines_to_text(intro_lines)

    toc_entries = []
    for i, (group_name, start_idx) in enumerate(group_starts):
        end_idx = group_starts[i + 1][1] if i + 1 < len(group_starts) else len(lines)
        group_lines = lines[start_idx:end_idx]
        body = lines_to_text(group_lines)

        fname = slugify(group_name) + ".md"
        write_file(out_dir / fname, group_name, body)
        toc_entries.append({"title": group_name, "file": f"07-gods/{fname}", "level": 2})

    # Write index
    index_body = (
        intro_text[:600].rstrip() + "…\n\n"
        "Browse gods by name range:\n\n" +
        "\n".join(f"- [{e['title']}](07-gods/{slugify(e['title'])}.md)" for e in toc_entries)
    )
    write_file(out_dir / "index.md", "Greyhawk's Gods", index_body)

    src.unlink()
    print(f"  removed {src.name}")

    return [{"title": e["title"], "file": e["file"], "level": e["level"]} for e in toc_entries]


# ---------------------------------------------------------------------------
# Power Groups
# ---------------------------------------------------------------------------

# (org_name, phrase_that_starts_this_org_in_the_prose)
# Circle of Eight uses None because it begins at the top of the file body.
POWER_GROUP_BOUNDARIES = [
    ("Circle of Eight",
     None),
    ("Horned Society",
     "No one knows the true age of the Horned Society."),
    ("Knight Protectors of the Great Kingdom",
     "Of all the orders of knighthood in the history of the Flanaess, none was greater than the fabled"),
    ("Knights of the Hart",
     "Once the least militant major order of knights in the Flanaess, the Knights of the Hart"),
    ("Knights of Holy Shielding",
     "Established in the mid-300s CY to support the lords of the petty domains north of the Nyr Dyv, the Knights of Holy Shielding"),
    ("Knights of Luna",
     "The Knights of Luna is an elven order of knighthood dedicated to preserving the monarchy of Celene"),
    ("Knights of the Watch",
     "The Knights of the Watch was created several centuries ago on the foundation"),
    ("Mouqollad Consortium",
     "The Mouqollad Consortium unites the merchant clans of the Baklunish nations"),
    ("Old Faith",
     "Oerth's natural fertility has inspired the devotion of its people."),
    ("Old Lore",
     "The Colleges of the Old Lore are an order of bards appended"),
    ("People of the Testing",
     "The mystic cabal known as the People of the Testing is a society of elves"),
    ("Silent Ones of Keoland",
     "This ancient society is almost entirely closed to outsiders, but its mystique"),
]


def split_power_groups():
    src = GUIDE_DIR / "06-power-groups.md"
    if not src.exists():
        print(f"  skipping power groups — {src.name} not found")
        return []

    out_dir = GUIDE_DIR / "06-power-groups"

    # Work with the full text (minus the # title heading) as a single string
    raw = src.read_text(encoding="utf-8")
    body = re.sub(r"^#[^\n]*\n\n?", "", raw, count=1)

    # Find the text position of each org's start phrase
    boundaries = []
    for org_name, start_phrase in POWER_GROUP_BOUNDARIES:
        if start_phrase is None:
            boundaries.append((org_name, 0))
        else:
            idx = body.find(start_phrase)
            if idx == -1:
                print(f"  WARNING: could not find start of '{org_name}' in prose — skipping")
            else:
                boundaries.append((org_name, idx))

    boundaries.sort(key=lambda x: x[1])

    toc_entries = []
    for i, (org_name, start_pos) in enumerate(boundaries):
        end_pos = boundaries[i + 1][1] if i + 1 < len(boundaries) else len(body)
        content = body[start_pos:end_pos].strip()
        if not content:
            continue
        fname = slugify(org_name) + ".md"
        write_file(out_dir / fname, org_name, content)
        toc_entries.append({"title": org_name, "file": f"06-power-groups/{fname}", "level": 2})

    # Write index
    intro = "The Flanaess is shaped by powerful organizations that operate across national boundaries — knightly orders, merchant guilds, druidic circles, and secret societies.\n\n"
    index_body = intro + "\n".join(
        f"- [{e['title']}](06-power-groups/{slugify(e['title'])}.md)" for e in toc_entries
    )
    write_file(out_dir / "index.md", "Power Groups", index_body)

    src.unlink()
    print(f"  removed {src.name}")

    return [{"title": e["title"], "file": e["file"], "level": e["level"]} for e in toc_entries]


# ---------------------------------------------------------------------------
# toc.json update
# ---------------------------------------------------------------------------

def update_toc(folk_entries, geo_entries, gods_entries, power_entries):
    toc = json.loads(TOC_PATH.read_text(encoding="utf-8"))

    for section in toc["sections"]:
        title = section.get("title", "")

        if title == "Folk of the Flanaess" and folk_entries:
            section["file"] = "02-folk/index.md"
            section["children"] = folk_entries

        elif title == "Geography of the Flanaess" and geo_entries:
            section["file"] = "05-geography/index.md"
            section["children"] = geo_entries

        elif title == "Greyhawk's Gods" and gods_entries:
            section["file"] = "07-gods/index.md"
            section["children"] = gods_entries

        elif title == "Power Groups" and power_entries:
            section["file"] = "06-power-groups/index.md"
            section["children"] = power_entries

    TOC_PATH.write_text(json.dumps(toc, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"  updated {TOC_PATH.relative_to(GUIDE_DIR.parent)}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("Splitting Folk of the Flanaess …")
    folk_entries = split_folk()

    print("\nSplitting Geography of the Flanaess …")
    geo_entries = split_geography()

    print("\nSplitting Greyhawk's Gods …")
    gods_entries = split_gods()

    print("\nSplitting Power Groups …")
    power_entries = split_power_groups()

    print("\nUpdating toc.json …")
    update_toc(folk_entries, geo_entries, gods_entries, power_entries)

    print("\nDone.")


if __name__ == "__main__":
    main()
