import { describe, expect, it } from 'vitest'
import { CHANGES_PRESS, changesLineWords, changesMissing, changesPlaceholder, emptyNewSetDraft, partTimeline, timelineEntryFor, type PlanSetRow } from './planSets'

function set(over: Partial<PlanSetRow> & { id: string }): PlanSetRow {
  return { part_id: 'p1', name: 'Issued set', kind: 'issued', source: 'gc', dated: null, came_at: '2026-10-01T12:00:00Z', memo: '', changes: '', link: '', replaces_set_id: null, marks_up_set_id: null, ...over } as PlanSetRow
}

describe('what changed between sets (v2.6356)', () => {
  const issued = set({ id: 'a', name: 'Issued set', dated: '2026-06-01' })
  const add1 = set({ id: 'b', name: 'Addendum 1', kind: 'addendum', dated: '2026-07-01', replaces_set_id: 'a', changes: 'P-201 redrawn: the riser moved to the north wall.' })
  const add2 = set({ id: 'c', name: 'Addendum 2', kind: 'addendum', dated: '2026-08-01' })
  const asBuilt = set({ id: 'd', name: 'As-built', kind: 'as_built', source: 'ours', dated: '2026-09-01', marks_up_set_id: 'c' })

  it('runs the plain sets newest first, each with the set before it, as-builts aside', () => {
    const t = partTimeline([asBuilt, issued, add2, add1])
    expect(t.map((e) => [e.set.id, e.previous?.id ?? null])).toEqual([
      ['c', 'b'],
      ['b', 'a'],
      ['a', null],
    ])
  })

  it('takes the set a row says it replaces over the date order', () => {
    const t = partTimeline([issued, add2, { ...add1, replaces_set_id: 'c' }])
    expect(timelineEntryFor(t, add1).previous?.id).toBe('c')
    expect(timelineEntryFor(t, set({ id: 'zz' })).previous).toBeNull()
  })

  it('reads the change line with the set before it, and nothing until someone writes it', () => {
    const t = partTimeline([issued, add1, add2])
    expect(changesLineWords(timelineEntryFor(t, add1))).toBe('What changed from Issued set: P-201 redrawn: the riser moved to the north wall.')
    expect(changesLineWords(timelineEntryFor(t, add2))).toBeNull()
    expect(changesLineWords({ set: { ...issued, changes: 'The first set.' }, previous: null })).toBe('What changed: The first set.')
    expect(changesLineWords({ set: { ...add2, changes: '   ' }, previous: add1 })).toBeNull()
  })

  it('offers Write what changed on a set that followed another with nothing written, never on the first set', () => {
    const t = partTimeline([issued, add1, add2])
    expect(changesMissing(timelineEntryFor(t, add2))).toBe(true)
    expect(changesMissing(timelineEntryFor(t, add1))).toBe(false)
    expect(changesMissing(timelineEntryFor(t, issued))).toBe(false)
    expect(CHANGES_PRESS).toEqual({ write: 'Write what changed', edit: 'Edit what changed', save: 'Save what changed' })
  })

  it('cues the form with the set the new one replaces, and a draft starts with no change words', () => {
    expect(changesPlaceholder({ name: 'Issued set' })).toBe('What moved from Issued set: which sheets or areas, and what it means for our work. Nothing, for a reissue.')
    expect(changesPlaceholder(null)).toBe('What this set settles, in a line. Leave it empty on a first set.')
    expect(emptyNewSetDraft('addendum').changes ?? '').toBe('')
  })

  it('treats a row with no change words at all as one nobody has written', () => {
    const noField = set({ id: 'e', name: 'Addendum 3', kind: 'addendum', dated: '2026-09-01' })
    delete noField.changes
    const e = timelineEntryFor(partTimeline([issued, noField]), noField)
    expect(changesLineWords(e)).toBeNull()
    expect(changesMissing(e)).toBe(true)
  })
})
