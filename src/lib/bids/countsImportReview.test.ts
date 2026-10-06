import { describe, expect, it } from 'vitest'

import {
  buildCountsImportWritePlan,
  countsImportReviewIsEmpty,
  countsImportWritePlanIsEmpty,
  defaultCountsImportChoices,
  describeCountsImportApplied,
  describeCountsImportWritePlan,
  reviewCountsImport,
} from './countsImportReview'
import type { CountSheetRow } from './countSheet'
import type { ParsedCountImportRow } from './parseCountsImportText'

const ex = (id: string, fixture: string, count: number, group_tag: string | null = null, page: string | null = null): CountSheetRow => ({ id, fixture, count, group_tag, page, unit: null })
const inc = (fixture: string, count: number, group_tag: string | null = null, page: string | null = null): ParsedCountImportRow => ({ fixture, count, group_tag, page, unit: fixture.toLowerCase().startsWith('ft of') ? 'ft' : 'ea' })

describe('reviewCountsImport — the four piles', () => {
  it('pairs by exact name and group; a count or page change is Changed, identical is Same', () => {
    const existing = [ex('a', 'WC', 12, 'Restroom A', '2, 4'), ex('b', 'LAV', 10, 'Restroom A', '2, 4'), ex('c', 'EWC', 2, null, '3'), ex('d', 'UR', 4, 'Restroom A', '2')]
    const incoming = [inc('WC', 14, 'Restroom A', '2, 4, 6'), inc('lav', 10, 'restroom a', '2, 4'), inc('EWC', 2, null, '3, 5'), inc('UR', 4, 'Restroom A', '2')]
    const r = reviewCountsImport({ incoming, existing, alternateTags: [], scope: 'all' })
    expect(r.changed.map((c) => [c.existing.id, c.countChanged, c.pageChanged, c.groupChanged])).toEqual([
      ['a', true, true, false],
      ['c', false, true, false],
    ])
    expect(r.same.map((s) => s.existing.id)).toEqual(['b', 'd'])
    expect(r.added).toEqual([])
    expect(r.missing).toEqual([])
    expect(countsImportReviewIsEmpty(r)).toBe(false)
  })

  it('a row only in the copy is Added; a row only on the bid is Missing', () => {
    const r = reviewCountsImport({ incoming: [inc('Mop sink', 1, 'Janitor', '6')], existing: [ex('h', 'Hose bibb', 1, 'Break room', '7')], alternateTags: [], scope: 'all' })
    expect(r.added.map((a) => a.fixture)).toEqual(['Mop sink'])
    expect(r.missing.map((m) => m.id)).toEqual(['h'])
    expect(r.pairs).toEqual([])
  })

  it('an identical paste is empty — nothing to approve', () => {
    const r = reviewCountsImport({ incoming: [inc('WC', 4, 'Restroom A', '2')], existing: [ex('a', 'WC', 4, 'Restroom A', '2')], alternateTags: [], scope: 'all' })
    expect(countsImportReviewIsEmpty(r)).toBe(true)
    expect(r.same).toHaveLength(1)
  })

  it('a page compared trimmed: "2, 4" and " 2, 4 " are the same page', () => {
    const r = reviewCountsImport({ incoming: [inc('WC', 4, null, ' 2, 4 ')], existing: [ex('a', 'WC', 4, null, '2, 4')], alternateTags: [], scope: 'all' })
    expect(countsImportReviewIsEmpty(r)).toBe(true)
  })

  it('Missing defaults to Remove on a copy of every sheet and to Keep otherwise', () => {
    const existing = [ex('h', 'Hose bibb', 1)]
    expect(reviewCountsImport({ incoming: [], existing, alternateTags: [], scope: 'all' }).missingDefault).toBe('remove')
    expect(reviewCountsImport({ incoming: [], existing, alternateTags: [], scope: 'partial' }).missingDefault).toBe('keep')
    expect(reviewCountsImport({ incoming: [], existing, alternateTags: [], scope: 'unknown' }).missingDefault).toBe('keep')
  })
})

describe('reviewCountsImport — the second tier and the proposals', () => {
  it('a name with no exact pair pairs by name alone when unique on both sides, and reads as a group change', () => {
    // Rows imported before v2.4188 carried no group; the re-copy does.
    const r = reviewCountsImport({ incoming: [inc('WC', 12, 'Restroom A', '2')], existing: [ex('a', 'WC', 12, null, '2')], alternateTags: [], scope: 'all' })
    expect(r.changed.map((c) => [c.existing.id, c.countChanged, c.groupChanged])).toEqual([['a', false, true]])
    expect(r.added).toEqual([])
    expect(r.missing).toEqual([])
  })

  it('the name-only pair stays inside the alternate scope: a base WC and an alternate WC are two rows', () => {
    const existing = [ex('a', 'WC', 4, 'Restroom A', '2')]
    const incoming = [inc('WC', 1, 'Break room', '3')]
    const r = reviewCountsImport({ incoming, existing, alternateTags: [], importAlternateGroups: ['Break room'], scope: 'all' })
    expect(r.changed).toEqual([])
    expect(r.added.map((a) => a.fixture)).toEqual(['WC'])
    expect(r.missing.map((m) => m.id)).toEqual(['a'])
  })

  it('proposes a rename: same group and count, a different name', () => {
    const r = reviewCountsImport({ incoming: [inc('Trap primer TP-1', 2, 'Restroom B', '4')], existing: [ex('t', 'Trap primer', 2, 'Restroom B', '4')], alternateTags: [], scope: 'all' })
    expect(r.pairs.map((p) => [p.missing.id, p.incoming.fixture, p.kind])).toEqual([['t', 'Trap primer TP-1', 'renamed']])
    // The proposal does not take the rows out of their piles — the person decides.
    expect(r.missing.map((m) => m.id)).toEqual(['t'])
    expect(r.added.map((a) => a.fixture)).toEqual(['Trap primer TP-1'])
  })

  it('one row that changed group is a Changed row, not a proposal: the name-only tier catches it', () => {
    const existing = [ex('a', 'WC', 4, 'Restroom A', '2'), ex('b', 'WC', 6, 'Restroom B', '4')]
    const incoming = [inc('WC', 4, 'Restroom A', '2'), inc('WC', 6, 'Restroom C', '4')]
    const r = reviewCountsImport({ incoming, existing, alternateTags: [], scope: 'all' })
    expect(r.same.map((s) => s.existing.id)).toEqual(['a'])
    expect(r.changed.map((c) => [c.existing.id, c.groupChanged, c.countChanged])).toEqual([['b', true, false]])
    expect(r.pairs).toEqual([])
  })

  it('proposes a move when two rows of one name both changed group: the counts tell them apart', () => {
    const existing = [ex('a', 'WC', 4, 'Restroom A', '2'), ex('b', 'WC', 6, 'Restroom B', '4')]
    const incoming = [inc('WC', 4, 'Restroom C', '2'), inc('WC', 6, 'Restroom D', '4')]
    const r = reviewCountsImport({ incoming, existing, alternateTags: [], scope: 'all' })
    expect(r.changed).toEqual([])
    expect(r.pairs.map((p) => [p.missing.id, p.incoming.group_tag, p.kind])).toEqual([
      ['a', 'Restroom C', 'moved'],
      ['b', 'Restroom D', 'moved'],
    ])
  })

  it('never proposes when more than one row could be the pair, or when the count differs', () => {
    const existing = [ex('t', 'Trap primer', 2, 'Restroom B')]
    const two = [inc('Trap primer TP-1', 2, 'Restroom B'), inc('Trap primer TP-2', 2, 'Restroom B')]
    expect(reviewCountsImport({ incoming: two, existing, alternateTags: [], scope: 'all' }).pairs).toEqual([])
    const other = [inc('Trap primer TP-1', 3, 'Restroom B')]
    expect(reviewCountsImport({ incoming: other, existing, alternateTags: [], scope: 'all' }).pairs).toEqual([])
  })

  it('a name + group carried twice on either side pairs with nothing and is flagged', () => {
    const existing = [ex('a', 'WC', 4, null), ex('b', 'WC', 1, null)]
    const incoming = [inc('WC', 5, null)]
    const r = reviewCountsImport({ incoming, existing, alternateTags: [], scope: 'all' })
    expect(r.changed).toEqual([])
    expect(r.added).toHaveLength(1)
    expect(r.ambiguousAdded.has(r.added[0]!)).toBe(true)
    expect(r.missing.map((m) => m.id)).toEqual(['a', 'b'])
    expect(r.ambiguousMissing).toEqual(new Set(['a', 'b']))
    expect(r.pairs).toEqual([])
  })
})

describe('the write plan from the choices', () => {
  const existing = [ex('a', 'WC', 12, 'Restroom A', '2, 4'), ex('t', 'Trap primer', 2, 'Restroom B', '4'), ex('h', 'Hose bibb', 1, 'Break room', '7'), ex('s', 'UR', 4, 'Restroom A', '2')]
  const incoming = [inc('WC', 14, 'Restroom A', '2, 4, 6'), inc('Trap primer TP-1', 2, 'Restroom B', '4'), inc('Mop sink', 1, 'Janitor', '6'), inc('UR', 4, 'Restroom A', '2')]
  const review = reviewCountsImport({ incoming, existing, alternateTags: [], scope: 'all' })

  it('the defaults: update all, add all, remove all on a full copy, no pair accepted', () => {
    const c = defaultCountsImportChoices(review)
    expect([...c.update]).toEqual(['a'])
    expect([...c.add]).toEqual([0, 1])
    expect([...c.remove].sort()).toEqual(['h', 't'])
    expect(c.pair.size).toBe(0)
    const plan = buildCountsImportWritePlan(review, c)
    expect(plan.updates).toEqual([{ id: 'a', before: { count: 12, page: '2, 4' }, patch: { count: 14, page: '2, 4, 6' } }])
    expect(plan.inserts.map((r) => r.fixture)).toEqual(['Trap primer TP-1', 'Mop sink'])
    expect(plan.deletes.map((r) => r.id).sort()).toEqual(['h', 't'])
    expect(describeCountsImportWritePlan(plan, review.same.length)).toBe('Will update 1, add 2, remove 2. 1 unchanged.')
    expect(describeCountsImportApplied(plan, review.same.length)).toBe('Updated 1, added 2, removed 2 · 1 unchanged')
  })

  it('an accepted pair becomes one update and leaves both the delete and the insert lists, whatever their ticks say', () => {
    const c = defaultCountsImportChoices(review)
    c.pair.add(0)
    const plan = buildCountsImportWritePlan(review, c)
    expect(plan.updates.find((u) => u.id === 't')).toEqual({ id: 't', before: { fixture: 'Trap primer' }, patch: { fixture: 'Trap primer TP-1' } })
    expect(plan.inserts.map((r) => r.fixture)).toEqual(['Mop sink'])
    expect(plan.deletes.map((r) => r.id)).toEqual(['h'])
  })

  it('an unticked row is left alone; nothing ticked is an empty plan', () => {
    const c = defaultCountsImportChoices(review)
    c.update.clear()
    c.add.delete(1)
    c.remove.delete('h')
    const plan = buildCountsImportWritePlan(review, c)
    expect(plan.updates).toEqual([])
    expect(plan.inserts.map((r) => r.fixture)).toEqual(['Trap primer TP-1'])
    expect(plan.deletes.map((r) => r.id)).toEqual(['t'])
    const none = buildCountsImportWritePlan(review, { update: new Set(), add: new Set(), remove: new Set(), pair: new Set() })
    expect(countsImportWritePlanIsEmpty(none)).toBe(true)
    expect(describeCountsImportWritePlan(none, 1)).toBe('Nothing to change. 1 unchanged.')
  })

  it('a Keep default on a partial copy removes nothing until asked', () => {
    const partial = reviewCountsImport({ incoming, existing, alternateTags: [], scope: 'partial' })
    const plan = buildCountsImportWritePlan(partial, defaultCountsImportChoices(partial))
    expect(plan.deletes).toEqual([])
  })
})
