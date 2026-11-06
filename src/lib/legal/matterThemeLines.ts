import type { LegalTimeline, LegalTimelineItem } from './legalTimeline'
import type { ThemeLine } from './legalThemes'

/**
 * The matter's By theme view (v2.6599, punch list #269 T2b's remainder): the matter's documents and the entries on
 * its timeline — events, statements, planned steps — as the lines the theme kernel reads (`ThemeLine`), so the HR
 * file's By theme view draws a matter the same way it draws a person. A document is its own file; an event carries
 * the documents it names. The lien clock's deadlines, the Record of contact and the packet's steps have no row a
 * mark can hang on and are left out, as is anything voided.
 */

export type MatterThemeLine = ThemeLine & {
  /** `document` for a paper on the Evidence tab; else the entry's kind on the timeline (`event` · `statement` · `plan` · `entry`). */
  kind: 'document' | 'event' | 'statement' | 'plan' | 'entry'
  documentId: string | null
  entryId: string | null
}

const ENTRY_KINDS: ReadonlySet<LegalTimelineItem['kind']> = new Set(['event', 'statement', 'plan', 'entry'])

/** The matter's lines in the record's order: by day, then as the timeline sorted them. */
export function matterThemeLines(timeline: Pick<LegalTimeline, 'past' | 'today' | 'upcoming'>): MatterThemeLine[] {
  const out: MatterThemeLine[] = []
  for (const i of [...timeline.past, ...timeline.today, ...timeline.upcoming]) {
    if (i.voided) continue
    if (i.kind === 'document' && i.documentId) {
      out.push({
        key: `document:${i.documentId}`,
        ymd: i.ymd,
        loggedAt: null,
        kindWords: i.documentChip ? `document · ${i.documentChip}` : i.kindWords ? `document · ${i.kindWords}` : 'document',
        what: i.what,
        notes: i.notes,
        byName: i.byName,
        ref: { table: 'legal_matter_documents', id: i.documentId },
        attachmentIds: [i.documentId],
        kind: 'document',
        documentId: i.documentId,
        entryId: null,
      })
      continue
    }
    if (i.entryId && ENTRY_KINDS.has(i.kind)) {
      out.push({
        key: `entry:${i.entryId}`,
        ymd: i.ymd,
        loggedAt: null,
        kindWords: i.kindWords || (i.kind === 'plan' ? 'planned step' : i.kind),
        what: i.what,
        notes: i.notes,
        byName: i.byName,
        ref: { table: 'legal_matter_entries', id: i.entryId },
        attachmentIds: i.documents.map((d) => d.id),
        kind: i.kind as MatterThemeLine['kind'],
        documentId: i.documentId,
        entryId: i.entryId,
      })
    }
  }
  return out.sort((a, b) => a.ymd.localeCompare(b.ymd) || a.key.localeCompare(b.key))
}

/** Where a press on *Open on the Timeline* lands for this line: a paper on Evidence, an entry on the Timeline. */
export function matterThemeLineLanding(line: Pick<MatterThemeLine, 'kind'>): 'evidence' | 'timeline' {
  return line.kind === 'document' ? 'evidence' : 'timeline'
}
