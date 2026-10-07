/**
 * The narrative for the firm (v2.4812): the office's account of a matter, in markdown, shown to the
 * firm as the first tab of its portal and the first section of its printed packet. Pure and
 * dependency-free, so the `legal-portal` function and the client read one rule; rendering (marked
 * through the app's sanitizer) is the client's, in `src/lib/legal/legalNarrativeHtml.ts`.
 */

export const LEGAL_NARRATIVE_MAX_CHARS = 40_000

export type LegalNarrative = {
  markdown: string
  /** YYYY-MM-DD the office last saved it. */
  updatedOn: string
  updatedByName: string
}

/** The keys that may travel; `shapeMatterForCounsel` cuts the narrative to these. */
export const NARRATIVE_PAYLOAD_KEYS = ['markdown', 'updatedOn', 'updatedByName'] as const

/** A matter row → the narrative the firm reads; null when the office has written none. */
export function legalNarrativeFromRow(row: { narrative_md?: string | null; narrative_updated_at?: string | null }, updatedByName: string, dayOf: (iso: string) => string): LegalNarrative | null {
  const markdown = (row.narrative_md ?? '').trim()
  if (!markdown) return null
  return { markdown, updatedOn: row.narrative_updated_at ? dayOf(row.narrative_updated_at) : '', updatedByName }
}

/** The payload's narrative, read defensively: an older function sends none. */
export function parseLegalNarrative(raw: unknown): LegalNarrative | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const markdown = typeof r.markdown === 'string' ? r.markdown.trim() : ''
  if (!markdown) return null
  return { markdown, updatedOn: typeof r.updatedOn === 'string' ? r.updatedOn : '', updatedByName: typeof r.updatedByName === 'string' ? r.updatedByName : '' }
}

/** The standing line above it, on the portal and on paper: whose account it is, and where the record is. */
export function legalNarrativeBandWords(n: Pick<LegalNarrative, 'updatedOn' | 'updatedByName'>): string {
  const who = n.updatedByName ? `written by ${n.updatedByName}` : 'written by the office'
  const when = n.updatedOn ? ` on ${n.updatedOn}` : ''
  return `The office's account of this matter, ${who}${when}. The record behind it is on the other tabs, and the documents it names are under Evidence.`
}

/** Null when the text may be saved; else why not. */
export function legalNarrativeProblem(markdown: string): string | null {
  if (markdown.trim().length > LEGAL_NARRATIVE_MAX_CHARS) return `The narrative is longer than ${LEGAL_NARRATIVE_MAX_CHARS.toLocaleString('en-US')} characters.`
  return null
}

/** The outline the desk offers to start from: the four parts counsel reads first. */
export const LEGAL_NARRATIVE_OUTLINE = `## The parties

Who did the work, for whom, at what address, and who owns the property.

## What happened

**Date** — what was done, what was billed, what was said.

## What they say, what the record shows

| They say | The record |
|---|---|
|  |  |

## Still missing

What counsel will ask for that the office does not have yet.
`
