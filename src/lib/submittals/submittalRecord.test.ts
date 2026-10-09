import { describe, expect, it } from 'vitest'
import {
  answeredByEmailAt,
  hasReviewerFile,
  isOnRecord,
  isReviewerAnswer,
  isTypedAnswer,
  linkShows,
  loadRevisionStandings,
  onRecord,
  recordStanding,
  revisionStandings,
  type RecordDb,
} from '../../../supabase/functions/_shared/submittalRecord'

describe('the GC’s record: what counts as a typed answer', () => {
  it('an answer the office typed from the reviewer’s words, or the robot read and a person confirmed', () => {
    expect(isTypedAnswer({ decision_source: 'entered', review_decision: 'approved' })).toBe(true)
    expect(isTypedAnswer({ decision_source: 'robot', review_decision: 'revise' })).toBe(true)
    expect(isTypedAnswer({ decision_source: 'entered', review_decision: 'rejected', on_submittal: true })).toBe(true)
  })

  it('not a call the reviewer tapped on the link, a call carried from the revision before, or a row with no call', () => {
    expect(isTypedAnswer({ decision_source: 'room', review_decision: 'approved' })).toBe(false)
    expect(isTypedAnswer({ decision_source: 'carried', review_decision: 'approved' })).toBe(false)
    expect(isTypedAnswer({ decision_source: 'entered', review_decision: null })).toBe(false)
  })

  it('the reviewer’s answers that keep a revision on the record: typed, read by the robot, or given on the link; never carried', () => {
    expect(isReviewerAnswer({ decision_source: 'entered', review_decision: 'approved' })).toBe(true)
    expect(isReviewerAnswer({ decision_source: 'room', review_decision: 'revise' })).toBe(true)
    expect(isReviewerAnswer({ decision_source: 'carried', review_decision: 'approved' })).toBe(false)
    expect(isReviewerAnswer({ decision_source: 'room', review_decision: null })).toBe(false)
  })

  it('not a call on something the GC never sees: an order-only row or a part off the submittal', () => {
    expect(isTypedAnswer({ decision_source: 'entered', review_decision: 'approved', order_only: true })).toBe(false)
    expect(isTypedAnswer({ decision_source: 'entered', review_decision: 'approved', on_submittal: false })).toBe(false)
  })
})

describe('the GC’s record: the rule', () => {
  it('shared, or answered by email with its package built; a typed answer with no package waits', () => {
    expect(recordStanding({ shared_at: '2026-09-16T00:00:00Z', package_path: null, hasAnswer: false })).toBe('shared')
    expect(recordStanding({ shared_at: null, package_path: 'p.pdf', hasAnswer: true })).toBe('answered_by_email')
    expect(recordStanding({ shared_at: null, package_path: null, hasAnswer: true })).toBe('waits_for_package')
    expect(recordStanding({ shared_at: null, package_path: 'p.pdf', hasAnswer: false })).toBe('never')
    expect(['shared', 'answered_by_email', 'waits_for_package', 'never'].map((s) => isOnRecord(s as Parameters<typeof isOnRecord>[0]))).toEqual([true, true, false, false])
  })

  it('2026-10-09 · (b): a reviewer’s file kept on the revision stands in for the package; a file with no answer does not publish it', () => {
    expect(recordStanding({ shared_at: null, package_path: null, hasAnswer: true, hasReviewerFile: true })).toBe('answered_by_email')
    expect(recordStanding({ shared_at: null, package_path: 'p.pdf', hasAnswer: true, hasReviewerFile: true })).toBe('answered_by_email')
    expect(recordStanding({ shared_at: null, package_path: null, hasAnswer: false, hasReviewerFile: true })).toBe('never')
    expect(recordStanding({ shared_at: null, package_path: null, hasAnswer: true, hasReviewerFile: false })).toBe('waits_for_package')
  })

  it('a reviewer’s file is an entry with a path, as the tab reads them', () => {
    expect(hasReviewerFile([{ path: 'b398/r3/reviewer/0-GC_email.eml', name: 'GC email.eml', kind: 'email' }])).toBe(true)
    expect(hasReviewerFile([null, { name: 'no path' }, { path: '' }])).toBe(false)
    expect(hasReviewerFile([])).toBe(false)
    expect(hasReviewerFile(null)).toBe(false)
    expect(hasReviewerFile('[]')).toBe(false)
  })

  it('every revision with its standing, newest first, dated by its newest typed answer', () => {
    const list = revisionStandings(
      [
        { id: 'r1', rev_number: 1, shared_at: '2026-09-15T00:00:00Z', package_path: 'a' },
        { id: 'r2', rev_number: 2, shared_at: null, package_path: 'b' },
      ],
      new Map([['r2', [{ decision_source: 'entered', review_decision: 'approved', reviewed_at: '2026-10-01T10:00:00Z' }, { decision_source: 'robot', review_decision: 'revise', reviewed_at: '2026-10-02T10:00:00Z' }]]]),
    )
    expect(list.map((r) => [r.rev_number, r.standing, r.typedAnswerAt])).toEqual([
      [2, 'answered_by_email', '2026-10-02T10:00:00Z'],
      [1, 'shared', null],
    ])
    expect(onRecord(list).map((r) => r.rev_number)).toEqual([2, 1])
    expect(answeredByEmailAt(list[0]!)).toBe('2026-10-02T10:00:00Z')
    expect(answeredByEmailAt(list[1]!)).toBeNull()
    expect(linkShows(list)).toEqual({ rev: 2, byEmail: true, answeredAt: '2026-10-02T10:00:00Z' })
    expect(linkShows([])).toBeNull()
  })
})

type Builder = {
  select(columns: string): Builder
  eq(column: string, value: unknown): Builder
  in(column: string, values: ReadonlyArray<unknown>): Builder
  order(column: string, options?: unknown): Builder
  then<T>(resolve: (v: { data: unknown; error: unknown }) => T, reject?: (e: unknown) => T): Promise<T>
}

/** A client that answers from fixed rows and records what was asked. */
function fakeDb(tables: Record<string, Array<Record<string, unknown>>>, opts: { partsError?: boolean } = {}) {
  const calls: Array<{ table: string; select: string; filters: Array<[string, string, unknown]> }> = []
  const db: RecordDb = {
    from(table: string) {
      const call = { table, select: '', filters: [] as Array<[string, string, unknown]> }
      calls.push(call)
      const rows = () =>
        call.filters.reduce((out, [op, col, val]) => out.filter((r) => (op === 'eq' ? r[col] === val : (val as ReadonlyArray<unknown>).includes(r[col]))), tables[table] ?? [])
      const b: Builder = {
        select(columns) {
          call.select = columns
          return b
        },
        eq(column, value) {
          call.filters.push(['eq', column, value])
          return b
        },
        in(column, values) {
          call.filters.push(['in', column, values])
          return b
        },
        order() {
          return b
        },
        then(resolve, reject) {
          const result = opts.partsError && table === 'bid_submittal_item_parts' ? { data: null, error: { message: 'no such table' } } : { data: rows(), error: null }
          return Promise.resolve(result).then(resolve, reject)
        },
      }
      return b
    },
  }
  return { db, calls }
}

/** BP398's shape (2026-10-06): Rev 2 shared Sep 16; Rev 3 answered by email Oct 2, never shared, its package built; Rev 4 a draft. */
const bp398Tables = (o: { rev4Shared?: boolean; rev3Package?: boolean; rev3Files?: unknown } = {}) => ({
  bid_submittals: [
    { id: 'r4', bid_id: 'b398', rev_number: 4, shared_at: o.rev4Shared ? '2026-10-06T15:00:00Z' : null, package_path: null, reviewer_files: [] },
    { id: 'r3', bid_id: 'b398', rev_number: 3, shared_at: null, package_path: o.rev3Package === false ? null : 'b398/r3/package.pdf', reviewer_files: o.rev3Files ?? [] },
    { id: 'r2', bid_id: 'b398', rev_number: 2, shared_at: '2026-09-16T03:03:49.265Z', package_path: 'b398/r2/package.pdf' },
    { id: 'rx', bid_id: 'other', rev_number: 9, shared_at: null, package_path: 'x.pdf' },
  ],
  bid_submittal_items: [
    { id: 'i3-ks', submittal_id: 'r3', order_only: false, decision_source: 'entered', review_decision: 'approved', reviewed_at: '2026-10-02T17:00:00Z' },
    { id: 'i3-wc', submittal_id: 'r3', order_only: false, decision_source: 'room', review_decision: null, reviewed_at: null },
    { id: 'i3-oo', submittal_id: 'r3', order_only: true, decision_source: 'entered', review_decision: 'approved', reviewed_at: '2026-10-05T09:00:00Z' },
    { id: 'i4-wc', submittal_id: 'r4', order_only: false, decision_source: 'room', review_decision: null, reviewed_at: null },
    { id: 'ix', submittal_id: 'rx', order_only: false, decision_source: 'entered', review_decision: 'approved', reviewed_at: '2026-10-01T00:00:00Z' },
  ],
  bid_submittal_item_parts: [
    { item_id: 'i3-wc', on_submittal: true, decision_source: 'entered', review_decision: 'approved', reviewed_at: '2026-10-02T18:00:00Z' },
    // A call carried onto Rev 4's draft from Rev 3: the draft was not answered.
    { item_id: 'i4-wc', on_submittal: true, decision_source: 'carried', review_decision: 'approved', reviewed_at: '2026-10-02T18:00:00Z' },
  ],
})

describe('the GC’s record: the loader the three functions and the tab share', () => {
  it('BP398 before Rev 4 is shared: Rev 3, answered by email, is current, Rev 2 under it', async () => {
    const { db, calls } = fakeDb(bp398Tables())
    const list = await loadRevisionStandings(db, 'b398')
    expect(list.map((r) => [r.rev_number, r.standing])).toEqual([
      [4, 'never'],
      [3, 'answered_by_email'],
      [2, 'shared'],
    ])
    // The part's call is the newest typed answer on Rev 3; the order-only row's later call is not counted.
    expect(list[1]!.typedAnswerAt).toBe('2026-10-02T18:00:00Z')
    expect(onRecord(list).map((r) => r.rev_number)).toEqual([3, 2])
    // Only the revisions nobody shared are read for their calls, and parts only by a typed source.
    expect(calls.find((c) => c.table === 'bid_submittal_items')!.filters).toEqual([['in', 'submittal_id', ['r4', 'r3']]])
    expect(calls.find((c) => c.table === 'bid_submittal_item_parts')!.filters).toContainEqual(['in', 'decision_source', ['entered', 'robot', 'room']])
    // The revisions are read with their reviewer files, the second way onto the record.
    expect(calls.find((c) => c.table === 'bid_submittals')!.select).toContain('reviewer_files')
  })

  it('BP398 after Rev 4 is shared: Rev 4 current, then Rev 3 answered by email, then Rev 2', async () => {
    const list = await loadRevisionStandings(fakeDb(bp398Tables({ rev4Shared: true })).db, 'b398')
    expect(onRecord(list).map((r) => `${r.rev_number} ${r.standing}`)).toEqual(['4 shared', '3 answered_by_email', '2 shared'])
  })

  it('the guard: Rev 3 with no package waits, and the link stays on Rev 2', async () => {
    const list = await loadRevisionStandings(fakeDb(bp398Tables({ rev3Package: false })).db, 'b398')
    expect(list.find((r) => r.rev_number === 3)!.standing).toBe('waits_for_package')
    expect(linkShows(list)).toEqual({ rev: 2, byEmail: false, answeredAt: null })
  })

  it('2026-10-09 · BP398 as it is: Rev 3 has no package, and the GC’s Oct 2 email dropped on it puts it on the record', async () => {
    const file = { path: 'b398/r3/reviewer/0-Re_Submittal_Rev_3.eml', name: 'Re: Submittal Rev 3.eml', kind: 'email', dropped_at: '2026-10-09T15:00:00Z' }
    const list = await loadRevisionStandings(fakeDb(bp398Tables({ rev3Package: false, rev3Files: [file] })).db, 'b398')
    expect(list.find((r) => r.rev_number === 3)).toMatchObject({ standing: 'answered_by_email', hasReviewerFile: true, package_path: null, typedAnswerAt: '2026-10-02T18:00:00Z' })
    expect(linkShows(list)).toEqual({ rev: 3, byEmail: true, answeredAt: '2026-10-02T18:00:00Z' })
    // Rev 4's draft has no file and no answer of its own: still not on their page.
    expect(list.find((r) => r.rev_number === 4)).toMatchObject({ standing: 'never', hasReviewerFile: false })
  })

  it('once on the record by email, the GC answering it on the link keeps it there', async () => {
    const tables = bp398Tables()
    // Dana re-answers Rev 3's rows on the link: its part's typed answer still dates it.
    tables.bid_submittal_items = tables.bid_submittal_items.map((it) => (it.submittal_id === 'r3' ? { ...it, decision_source: 'room', review_decision: 'approved', reviewed_at: '2026-10-07T12:00:00Z' } : it))
    expect((await loadRevisionStandings(fakeDb(tables).db, 'b398')).find((r) => r.rev_number === 3)).toMatchObject({ standing: 'answered_by_email', typedAnswerAt: '2026-10-02T18:00:00Z' })
    // And its part too: no typed answer is left, and the revision stays, dated by the newest answer.
    tables.bid_submittal_item_parts = tables.bid_submittal_item_parts.map((p) => (p.item_id === 'i3-wc' ? { ...p, decision_source: 'room', reviewed_at: '2026-10-07T12:30:00Z' } : p))
    expect((await loadRevisionStandings(fakeDb(tables).db, 'b398')).find((r) => r.rev_number === 3)).toMatchObject({ standing: 'answered_by_email', typedAnswerAt: '2026-10-07T12:30:00Z' })
  })

  it('a parts table that cannot be read counts as no parts: the rows’ own calls still count', async () => {
    const list = await loadRevisionStandings(fakeDb(bp398Tables(), { partsError: true }).db, 'b398')
    expect(list.find((r) => r.rev_number === 3)).toMatchObject({ standing: 'answered_by_email', typedAnswerAt: '2026-10-02T17:00:00Z' })
  })

  it('a bid where everything was shared reads no calls at all', async () => {
    const { db, calls } = fakeDb({ bid_submittals: [{ id: 'a', bid_id: 'b', rev_number: 1, shared_at: '2026-09-01T00:00:00Z', package_path: null }] })
    expect((await loadRevisionStandings(db, 'b')).map((r) => r.standing)).toEqual(['shared'])
    expect(calls.map((c) => c.table)).toEqual(['bid_submittals'])
  })
})
