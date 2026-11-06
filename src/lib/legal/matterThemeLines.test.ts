import { describe, expect, it } from 'vitest'
import type { LegalTimelineItem } from './legalTimeline'
import { matterThemeLineLanding, matterThemeLines } from './matterThemeLines'

const item = (over: Partial<LegalTimelineItem>): LegalTimelineItem => ({
  key: 'k', lane: 'did', ymd: '2026-10-01', kind: 'event', entryKind: 'event', entryId: null, documentId: null, what: 'x', kindWords: '', notes: '', amount: null,
  byName: 'the office', source: 'office', viaPortal: false, state: 'happened', stateWords: '', plannedYmd: null, doneYmd: null, held: false, heldReason: '', voided: false, voidReason: '',
  isLivePlan: false, documents: [], serves: null, deadlineKey: null, deadlineJobId: null, documentChip: '', ...over,
})

describe('matterThemeLines (v2.6599)', () => {
  it('turns documents and entries into theme lines with the table the marks hang on, and leaves the rest out', () => {
    const lines = matterThemeLines({
      past: [
        item({ key: 'doc:d1', lane: 'paper', ymd: '2026-09-08', kind: 'document', documentId: 'd1', what: 'Mailbox review', notes: 'What the export shows.', documentChip: 'final' }),
        item({ key: 'entry:e1', ymd: '2026-10-05', kind: 'event', entryId: 'e1', what: 'Dana writes to Jordan', kindWords: 'event', documents: [{ id: 'd1', title: 'Mailbox review', held: false }] }),
        item({ key: 'entry:s1', lane: 'said', ymd: '2026-10-06', kind: 'statement', entryId: 's1', what: 'Sworn statement', kindWords: 'statement' }),
        item({ key: 'deadline:x', lane: 'paper', ymd: '2026-10-07', kind: 'deadline', what: 'Notice due' }),
        item({ key: 'said:c1', lane: 'said', ymd: '2026-10-08', kind: 'said', entryId: 'c1', what: 'A call' }),
        item({ key: 'entry:v1', ymd: '2026-10-09', kind: 'event', entryId: 'v1', what: 'Entered twice', voided: true }),
      ],
      today: [],
      upcoming: [item({ key: 'entry:p1', lane: 'planned', ymd: '2026-11-09', kind: 'plan', entryId: 'p1', what: 'Send the notice', state: 'planned' })],
    })
    expect(lines.map((l) => l.key)).toEqual(['document:d1', 'entry:e1', 'entry:s1', 'entry:p1'])
    expect(lines[0]).toMatchObject({ ref: { table: 'legal_matter_documents', id: 'd1' }, attachmentIds: ['d1'], kindWords: 'document · final', notes: 'What the export shows.', kind: 'document' })
    expect(lines[1]).toMatchObject({ ref: { table: 'legal_matter_entries', id: 'e1' }, attachmentIds: ['d1'], kindWords: 'event', kind: 'event' })
    expect(lines[3]).toMatchObject({ kindWords: 'planned step', kind: 'plan' })
  })
  it('a document lands on Evidence and an entry on the Timeline', () => {
    expect(matterThemeLineLanding({ kind: 'document' })).toBe('evidence')
    expect(matterThemeLineLanding({ kind: 'event' })).toBe('timeline')
  })
})
