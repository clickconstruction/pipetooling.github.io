/**
 * Citations between the HR file's entries and its narrative (v2.6615, punch list #277 PR 3, the third PR #275 planned).
 * An entry's basis line names the narrative's section it rests on — `N§16`, or `§16` on its own — and the narrative's
 * sections are numbered in their headings (`## 16. Bidding conduct`). Pure: the parse of a line's words into text and
 * citations, the heading a number names, and the entries that cite each section.
 */
import type { HrDocHeading } from './hrDocMarkdown'

export type SectionCitation = { raw: string; section: number }

/** `N§16`, `N §16`, `§16` — a section of the narrative; the number is 1 to 999. */
const CITE_RE = /(?:\bN\s?)?§\s?(\d{1,3})\b/g

/** The citations in a line's words, in order, each once. */
export function parseSectionCitations(text: string): SectionCitation[] {
  const out: SectionCitation[] = []
  const seen = new Set<number>()
  for (const m of text.matchAll(CITE_RE)) {
    const n = Number(m[1])
    if (!Number.isFinite(n) || n <= 0 || seen.has(n)) continue
    seen.add(n)
    out.push({ raw: m[0], section: n })
  }
  return out
}

export type CitationPart = { kind: 'text'; text: string } | { kind: 'cite'; raw: string; section: number }

/** A line's words split into plain runs and citations, so each citation can be drawn as a press in place. */
export function splitByCitations(text: string): CitationPart[] {
  const parts: CitationPart[] = []
  let last = 0
  for (const m of text.matchAll(CITE_RE)) {
    const at = m.index ?? 0
    if (at > last) parts.push({ kind: 'text', text: text.slice(last, at) })
    parts.push({ kind: 'cite', raw: m[0], section: Number(m[1]) })
    last = at + m[0].length
  }
  if (last < text.length) parts.push({ kind: 'text', text: text.slice(last) })
  return parts
}

/** The number a heading carries: `16. Bidding conduct` → 16, `§3 The shop` → 3, `Appendix A` → null. */
export function headingNumber(text: string): number | null {
  const m = /^\s*(?:§\s*)?(\d{1,3})(?:[.:)]|\s+[-–—]|\s)/.exec(text)
  return m ? Number(m[1]) : null
}

/** The heading a citation names, by its number; null when the document has none so numbered. */
export function sectionByNumber(headings: readonly HrDocHeading[], n: number): HrDocHeading | null {
  return headings.find((h) => headingNumber(h.text) === n) ?? null
}

export type CitingLine = { key: string; ymd: string; what: string }

/** For each section number, the lines that cite it, in the order given. */
export function citationsBySection(lines: readonly CitingLine[]): Map<number, CitingLine[]> {
  const out = new Map<number, CitingLine[]>()
  for (const l of lines) {
    for (const c of parseSectionCitations(l.what)) {
      const list = out.get(c.section) ?? []
      list.push(l)
      out.set(c.section, list)
    }
  }
  return out
}

/** "cited by 7 entries" / "cited by 1 entry". */
export function citedByWords(count: number): string {
  return `cited by ${count} ${count === 1 ? 'entry' : 'entries'}`
}

/** "1 of them corrected since" / "3 of them corrected since": the citing entries a later entry corrected (punch list #315). */
export function citedCorrectedWords(count: number): string {
  return `${count} of them corrected since`
}
