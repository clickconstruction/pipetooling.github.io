import { describe, expect, it } from 'vitest'
import {
  EMPTY_AMENDMENT_INDEX,
  amendedByWords,
  amendmentCountWords,
  amendmentDayLabel,
  amendmentEnds,
  amendmentEntryKeys,
  amendmentIndex,
  amendmentInsertRows,
  amendmentKey,
  amendmentKindOfTable,
  amendmentStanding,
  amendmentTable,
  amendmentTargetsProblem,
  amendsWords,
  correctedKeys,
  latestWord,
  liveAmendments,
  parseAmendmentKey,
  type PersonAmendmentRow,
} from './personAmendments'

/** Made-up rows: e1 is the oldest entry, e2 corrects it, e3 corrects e2, e4 completes e1, f1 is a piece of evidence. */
function row(over: Partial<PersonAmendmentRow> & Pick<PersonAmendmentRow, 'id' | 'from_id' | 'to_id'>): PersonAmendmentRow {
  return { from_kind: 'hr_entry', to_kind: 'hr_entry', how: 'corrects', created_at: '2026-03-09T15:00:00+00:00', withdrawn_at: null, ...over }
}
const ROWS: PersonAmendmentRow[] = [
  row({ id: 'a2', from_id: 'e3', to_id: 'e2', created_at: '2026-03-12T15:00:00+00:00' }),
  row({ id: 'a1', from_id: 'e2', to_id: 'e1' }),
  row({ id: 'a3', from_id: 'e4', to_id: 'e1', how: 'completes', created_at: '2026-03-10T15:00:00+00:00' }),
  row({ id: 'a4', from_id: 'e4', to_id: 'f1', to_kind: 'hr_evidence', how: 'completes', created_at: '2026-03-10T15:00:00+00:00' }),
  row({ id: 'a5', from_id: 'e5', to_id: 'e4', withdrawn_at: '2026-03-20T15:00:00+00:00' }),
]
const E = (id: string) => amendmentKey('hr_entry', id)
const F = (id: string) => amendmentKey('hr_evidence', id)

describe('corrections as links: the kernel (punch list #315)', () => {
  it('keys a thing by its kind and id, and reads the key back', () => {
    expect(E('e1')).toBe('hr_entry:e1')
    expect(parseAmendmentKey('hr_evidence:f1')).toEqual({ kind: 'hr_evidence', id: 'f1' })
    expect(parseAmendmentKey('document:d1')).toBeNull()
    expect(parseAmendmentKey('hr_entry:')).toBeNull()
    expect(parseAmendmentKey('nothing')).toBeNull()
    expect(amendmentTable('hr_entry')).toBe('person_file_entries')
    expect(amendmentTable('hr_evidence')).toBe('person_file_evidence')
    expect(amendmentKindOfTable('person_file_entries')).toBe('hr_entry')
    expect(amendmentKindOfTable('person_file_evidence')).toBe('hr_evidence')
    expect(amendmentKindOfTable('person_contract_documents')).toBeNull()
  })

  it('keeps the links that stand, oldest first, and drops a withdrawn one', () => {
    expect(liveAmendments(ROWS).map((l) => l.id)).toEqual(['a1', 'a3', 'a4', 'a2'])
  })

  it('drops a row of a kind or a how it does not know', () => {
    const odd = [row({ id: 'x1', from_id: 'e9', to_id: 'e1', how: 'replaces' }), row({ id: 'x2', from_id: 'd1', to_id: 'e1', from_kind: 'document' })]
    expect(liveAmendments(odd)).toEqual([])
  })

  it('indexes both ends', () => {
    const index = amendmentIndex(ROWS)
    expect(index.amendedBy.get(E('e1'))?.map((l) => `${l.how} by ${l.from}`)).toEqual(['corrects by hr_entry:e2', 'completes by hr_entry:e4'])
    expect(index.amends.get(E('e4'))?.map((l) => `${l.how} ${l.to}`)).toEqual(['completes hr_entry:e1', 'completes hr_evidence:f1'])
    expect(index.amendedBy.get(E('e4'))).toBeUndefined()
  })

  it('says where a thing stands, corrected before completed', () => {
    const index = amendmentIndex(ROWS)
    expect(amendmentStanding(E('e1'), index)).toBe('corrected')
    expect(amendmentStanding(E('e2'), index)).toBe('corrected')
    expect(amendmentStanding(F('f1'), index)).toBe('completed')
    expect(amendmentStanding(E('e3'), index)).toBeNull()
    expect(amendmentStanding(E('e4'), index)).toBeNull()
    expect(amendmentStanding(E('e1'), EMPTY_AMENDMENT_INDEX)).toBeNull()
  })

  it('lists what was corrected, and never what was only completed', () => {
    expect([...correctedKeys(amendmentIndex(ROWS))].sort()).toEqual(['hr_entry:e1', 'hr_entry:e2'])
  })

  it('follows a correction of a correction to the latest word', () => {
    const index = amendmentIndex(ROWS)
    expect(latestWord(E('e1'), index)).toBe('hr_entry:e3')
    expect(latestWord(E('e2'), index)).toBe('hr_entry:e3')
    expect(latestWord(E('e3'), index)).toBe('hr_entry:e3')
    expect(latestWord(F('f1'), index)).toBe('hr_evidence:f1')
  })

  it('takes the newest of two corrections of one thing', () => {
    const two = [row({ id: 'b1', from_id: 'e2', to_id: 'e1' }), row({ id: 'b2', from_id: 'e7', to_id: 'e1', created_at: '2026-04-01T15:00:00+00:00' })]
    expect(latestWord(E('e1'), amendmentIndex(two))).toBe('hr_entry:e7')
  })

  it('ends on a loop a hand-made row could draw', () => {
    const loop = [row({ id: 'c1', from_id: 'e2', to_id: 'e1' }), row({ id: 'c2', from_id: 'e1', to_id: 'e2', created_at: '2026-03-10T15:00:00+00:00' })]
    expect(latestWord(E('e1'), amendmentIndex(loop))).toBe('hr_entry:e2')
  })

  it('writes a day the way a person reads one', () => {
    expect(amendmentDayLabel('2026-11-03')).toBe('Nov 3, 2026')
    expect(amendmentDayLabel('2026-01-31')).toBe('Jan 31, 2026')
    expect(amendmentDayLabel('2026-13-01')).toBe('2026-13-01')
    expect(amendmentDayLabel('soon')).toBe('soon')
  })

  it('words the older line and the newer line', () => {
    expect(amendedByWords('corrects', '2026-11-03')).toBe('Corrected Nov 3, 2026')
    expect(amendedByWords('completes', '2026-11-03')).toBe('Completed Nov 3, 2026')
    expect(amendedByWords('corrects', null)).toBe('Corrected')
    expect(amendsWords('corrects', 'hr_entry', '2026-10-28')).toBe('Corrects the entry of Oct 28, 2026')
    expect(amendsWords('completes', 'hr_evidence', '2026-10-28')).toBe('Completes the evidence record of Oct 28, 2026')
    expect(amendsWords('completes', 'hr_evidence', null)).toBe('Completes an evidence record held from this view')
  })

  it('hands a line both sides of its links, with the row behind each', () => {
    const days: Record<string, string> = { 'hr_entry:e1': '2026-03-02', 'hr_entry:e2': '2026-03-09', 'hr_entry:e4': '2026-03-10' }
    const ends = amendmentEnds(E('e1'), amendmentIndex(ROWS), (k) => days[k] ?? null)
    expect(ends.amendedBy).toEqual([
      { link_id: 'a1', how: 'corrects', key: 'hr_entry:e2', row: 'person_file_entries:e2', day: '2026-03-09', words: 'Corrected Mar 9, 2026' },
      { link_id: 'a3', how: 'completes', key: 'hr_entry:e4', row: 'person_file_entries:e4', day: '2026-03-10', words: 'Completed Mar 10, 2026' },
    ])
    expect(ends.amends).toEqual([])
    const newer = amendmentEnds(E('e4'), amendmentIndex(ROWS), (k) => days[k] ?? null)
    expect(newer.amends.map((x) => `${x.row} · ${x.words}`)).toEqual([
      'person_file_entries:e1 · Completes the entry of Mar 2, 2026',
      'person_file_evidence:f1 · Completes an evidence record held from this view',
    ])
  })

  it('refuses a pick that names a thing twice or the thing itself', () => {
    expect(amendmentTargetsProblem([{ kind: 'hr_entry', id: 'e1', how: 'corrects' }, { kind: 'hr_evidence', id: 'f1', how: 'completes' }], null)).toBeNull()
    expect(amendmentTargetsProblem([{ kind: 'hr_entry', id: 'e1', how: 'corrects' }, { kind: 'hr_entry', id: 'e1', how: 'completes' }], null)).toBe('The same entry is picked twice. One link a pair.')
    expect(amendmentTargetsProblem([{ kind: 'hr_entry', id: 'e1', how: 'corrects' }], 'hr_entry:e1')).toBe('A thing cannot correct or complete itself.')
  })

  it("builds hr_agent_write's keys, and none for a plain entry", () => {
    expect(amendmentEntryKeys([])).toEqual({})
    expect(amendmentEntryKeys([{ kind: 'hr_entry', id: 'e1', how: 'corrects' }, { kind: 'hr_evidence', id: 'f1', how: 'completes' }, { kind: 'hr_entry', id: 'e2', how: 'corrects' }])).toEqual({
      corrects: ['e1', 'e2'],
      completes: [{ kind: 'hr_evidence', id: 'f1' }],
    })
  })

  it("builds the tab's rows", () => {
    expect(amendmentInsertRows({ personId: 'p1', fromKind: 'hr_entry', fromId: 'e9', targets: [{ kind: 'hr_evidence', id: 'f1', how: 'completes' }], createdBy: 'u1' })).toEqual([
      { person_id: 'p1', from_kind: 'hr_entry', from_id: 'e9', to_kind: 'hr_evidence', to_id: 'f1', how: 'completes', created_by: 'u1' },
    ])
  })

  it('counts links in words', () => {
    expect(amendmentCountWords(1)).toBe('1 link')
    expect(amendmentCountWords(3)).toBe('3 links')
  })
})
