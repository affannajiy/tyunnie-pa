// Pure parser for docs/CHANGELOG.md. Turns the Keep-a-Changelog markdown into
// structured entries consumed by the /about page (full history) and the
// "Site Updated" announcement (latest entry's bold lead-ins only).
//
// Kept dependency-free and side-effect-free: the file is read with fs in the
// API route, then handed to parseChangelog() here.

export interface ChangelogItem {
  /** The **bold** lead-in of a bullet, e.g. "Vault emails can no longer be sent…". */
  headline: string;
  /** The remainder of the bullet line after the bold lead-in (may be empty). */
  body: string;
}

export interface ChangelogSection {
  /** e.g. "Added", "Fixed", "Security", "Docs". */
  title: string;
  items: ChangelogItem[];
}

/** A labelled group inside the `### Highlights` block, e.g. "New" / "Fixed". */
export interface HighlightGroup {
  label: string; // "New", "Fixed"
  items: ChangelogItem[];
}

export interface ChangelogEntry {
  version: string; // "3.21.1"
  date: string; // "2026-06-10" (raw, as written)
  intro: string; // optional free paragraph under the version header
  /** Plain-English, user-facing notes from the `### Highlights` section (may be empty). */
  highlights: HighlightGroup[];
  /** Full technical sections (Added/Fixed/Security/…) — the dev-facing record. */
  sections: ChangelogSection[];
}

// "## [3.21.1] — 2026-06-10"  (accepts em-dash, en-dash, or hyphen separator)
const VERSION_RE = /^##\s*\[([^\]]+)\]\s*[—–-]\s*(.+?)\s*$/;
// "### Security"
const SECTION_RE = /^###\s+(.+?)\s*$/;
// Top-level bullet only (no leading indent): "- text"
const BULLET_RE = /^-\s+(.+?)\s*$/;
// Leading "**bold**" lead-in of a bullet
const BOLD_LEAD_RE = /^\*\*(.+?)\*\*\s*(.*)$/;
// A standalone "**New**" / "**Fixed**" group label inside the Highlights block
const HL_LABEL_RE = /^\*\*(.+?)\*\*\s*$/;

function splitItem(raw: string): ChangelogItem {
  const bold = raw.match(BOLD_LEAD_RE);
  if (bold) {
    // Trim a leading "— " / "- " / ": " joiner between headline and body.
    const body = bold[2].replace(/^\s*[—–:-]\s*/, "").trim();
    return { headline: bold[1].trim(), body };
  }
  return { headline: raw.trim(), body: "" };
}

export function parseChangelog(raw: string): ChangelogEntry[] {
  const lines = raw.split(/\r?\n/);
  const entries: ChangelogEntry[] = [];
  let entry: ChangelogEntry | null = null;
  let section: ChangelogSection | null = null;
  // Highlights block state — separate from `section` so the New/Fixed groups land
  // in `entry.highlights`, never in the technical `entry.sections`.
  let inHighlights = false;
  let hlGroup: HighlightGroup | null = null;

  for (const line of lines) {
    const v = line.match(VERSION_RE);
    if (v) {
      entry = { version: v[1].trim(), date: v[2].trim(), intro: "", highlights: [], sections: [] };
      entries.push(entry);
      section = null;
      inHighlights = false;
      hlGroup = null;
      continue;
    }
    if (!entry) continue; // skip the file's top matter

    const s = line.match(SECTION_RE);
    if (s) {
      const title = s[1].trim();
      inHighlights = title.toLowerCase() === "highlights";
      if (inHighlights) {
        section = null;
        hlGroup = null;
      } else {
        section = { title, items: [] };
        entry.sections.push(section);
      }
      continue;
    }

    // Inside "### Highlights": **New** / **Fixed** label lines start a group;
    // bullets under them become that group's user-facing items.
    if (inHighlights) {
      if (!line.startsWith(" ") && !line.startsWith("\t")) {
        const b = line.match(BULLET_RE);
        if (b) {
          if (!hlGroup) {
            hlGroup = { label: "Updates", items: [] };
            entry.highlights.push(hlGroup);
          }
          hlGroup.items.push(splitItem(b[1]));
          continue;
        }
        const label = line.match(HL_LABEL_RE);
        if (label) {
          hlGroup = { label: label[1].trim(), items: [] };
          entry.highlights.push(hlGroup);
          continue;
        }
      }
      continue; // ignore blanks / stray prose inside Highlights
    }

    // Only capture top-level bullets (ignore indented sub-bullets for brevity).
    if (!line.startsWith(" ") && !line.startsWith("\t")) {
      const b = line.match(BULLET_RE);
      if (b) {
        const item = splitItem(b[1]);
        if (section) {
          section.items.push(item);
        } else {
          // Bullet before any "### Section" — bucket under a default section.
          section = { title: "Changes", items: [item] };
          entry.sections.push(section);
        }
        continue;
      }
    }

    // A non-bullet, non-blank line before the first section is intro prose.
    const text = line.trim();
    if (text && !text.startsWith("-") && entry.sections.length === 0) {
      entry.intro = entry.intro ? `${entry.intro} ${text}` : text;
    }
  }

  return entries;
}

/** True when an entry has any user-facing Highlights groups to show. */
export function hasHighlights(entry: ChangelogEntry): boolean {
  return (entry.highlights ?? []).some((g) => g.items.length > 0);
}
