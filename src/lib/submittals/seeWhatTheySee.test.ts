import { describe, expect, it } from 'vitest'
import { describeForReviewer, emailedRecordLine, isRoomClosed, linkListLine, linkRevisionsAfterShare, linkShowsRevOf, linkViewOf, toRoomItemSource } from './seeWhatTheySee'
import { roomRowFrom, type RoomItemSource } from '../../../supabase/functions/_shared/submittalRoomPayload'
import { revisionStandings, type TypedAnswerSource } from '../../../supabase/functions/_shared/submittalRecord'

const typedOn = (at: string): TypedAnswerSource => ({ decision_source: 'entered', review_decision: 'approved', reviewed_at: at })
/** BP398's shape (2026-10-06): Rev 2 shared Sep 16, Rev 3 answered by email Oct 2 and never shared, Rev 4 a draft, Rev 1 replaced unseen. */
const bp398 = (o: { rev4Shared?: boolean; rev3Package?: boolean; rev3File?: boolean } = {}) =>
  revisionStandings(
    [
      { id: 'r4', rev_number: 4, shared_at: o.rev4Shared ? '2026-10-06T15:00:00Z' : null, package_path: 'b/r4/package.pdf' },
      { id: 'r3', rev_number: 3, shared_at: null, package_path: o.rev3Package === false ? null : 'b/r3/package.pdf', reviewer_files: o.rev3File ? [{ path: 'b/r3/reviewer/0-GC_email.eml', name: 'GC email.eml', kind: 'email' }] : [] },
      { id: 'r2', rev_number: 2, shared_at: '2026-09-16T03:03:49.265Z', package_path: 'b/r2/package.pdf' },
      { id: 'r1', rev_number: 1, shared_at: null, package_path: null },
    ],
    new Map([
      ['r3', [typedOn('2026-10-02T17:00:00Z'), { decision_source: 'room', review_decision: null }]],
      // A call carried onto the new draft from the revision before is not an answer to it.
      ['r4', [{ decision_source: 'carried', review_decision: 'approved', reviewed_at: '2026-10-02T17:00:00Z' }]],
    ]),
  )
const sharedOnly = (revs: ReadonlyArray<{ id?: string; rev_number: number; shared_at: string | null }>) =>
  revisionStandings(revs.map((r) => ({ id: r.id ?? `r${r.rev_number}`, rev_number: r.rev_number, shared_at: r.shared_at, package_path: null })), new Map())

const item = (o: Partial<RoomItemSource> & Pick<RoomItemSource, 'id' | 'tag' | 'status'>): RoomItemSource => ({
  sequence_order: 1, specified_manufacturer: null, specified_model: null, specified_description: null, submitted_manufacturer: null, submitted_model: null, submitted_label: null,
  reason_kind: null, reason_note: null, lead_time_days: null, sheet_pages: null, review_decision: null, review_note: null, reviewed_by_name: null, reviewed_by_person_id: null, reviewed_at: null,
  ...o,
})

const neverShared = { rev: 1, linkShowsRev: null, roomClosed: false }

describe('describeForReviewer (v2.4174, #62 Layer 1)', () => {
  it('quotes the room’s own headline and subline for the draft, and says the GC sees nothing until you share', () => {
    const r = describeForReviewer(
      [
        item({ id: 'a', tag: 'WC-1', status: 'as_specified', sequence_order: 1 }),
        item({ id: 'b', tag: 'DWH-1', status: 'alternate', reason_kind: 'lead_time', sequence_order: 2 }),
        item({ id: 'c', tag: 'PRV-1', status: 'missing', sequence_order: 3 }),
        item({ id: 'd', tag: '', status: 'accessory', sequence_order: 4 }),
      ],
      neverShared,
    )
    expect(r.lead).toBe('The GC’s page will read:')
    expect(r.line).toBe('“1 product needs your answer” — 1 product matches the plans and is marked approved. 1 differs — each says why. 1 has no product yet. 1 is accessory the plans leave to us.')
    expect(r.note).toBe('The GC sees nothing until you share.')
    expect(r.intro).toBe('This is the page the GC will open from your link. It is drawn from your rows as they stand.')
  })

  it('a shared revision reads as what the link shows now; a clean draft reads as matching', () => {
    const r = describeForReviewer([item({ id: 'a', tag: 'WC-1', status: 'as_specified' })], { rev: 2, linkShowsRev: 2, roomClosed: false })
    expect(r.lead).toBe('The GC’s page reads:')
    expect(r.line).toBe('“Everything matches the plans” — 1 product matches the plans and is marked approved.')
    expect(r.note).toBe('That is what the link shows now.')
    expect(r.intro).toBe('This is the page the GC opens from your link. It is drawn from your rows as they stand.')
    expect(describeForReviewer([], neverShared).line).toBe('“Nothing to review yet”')
  })
})

describe('what the link shows today (v2.4593, #62)', () => {
  const rows = [item({ id: 'b', tag: 'DWH-1', status: 'alternate', reason_kind: 'lead_time' })]

  it('a draft over a shared revision: the link shows the shared one until this one is shared', () => {
    const r = describeForReviewer(rows, { rev: 3, linkShowsRev: 2, roomClosed: false })
    expect(r.lead).toBe('The GC’s page will read:')
    expect(r.note).toBe('Until you share Rev 3, the link shows Rev 2.')
    expect(r.intro).toContain('the GC will open from your link')
  })

  it('a closed room: its link says only that the review is closed, shared or not', () => {
    const shared = describeForReviewer(rows, { rev: 2, linkShowsRev: 2, roomClosed: true })
    expect(shared.lead).toBe('The GC’s page will read:')
    expect(shared.note).toBe('The room is closed. Its link says only that the review is closed. Reopen it to show this again.')
    expect(shared.intro).toContain('will open')
    expect(describeForReviewer(rows, { rev: 3, linkShowsRev: 2, roomClosed: true }).note).toBe('The room is closed. Its link says only that the review is closed. Reopen it, then share Rev 3.')
    expect(describeForReviewer(rows, { rev: 1, linkShowsRev: null, roomClosed: true }).note).toBe('The room is closed. Its link says only that the review is closed. Reopen it, then share Rev 1.')
  })

  it('BP398 today (2026-10-06): Rev 3 was answered by email and has its package, so the link shows it, answered by email', () => {
    expect(linkShowsRevOf(bp398())).toBe(3)
    expect(describeForReviewer(rows, { rev: 4, ...linkViewOf(bp398(), false) }).note).toBe('Until you share Rev 4, the link shows Rev 3, answered by email.')
    expect(describeForReviewer(rows, { rev: 4, ...linkViewOf(bp398({ rev4Shared: true }), false) }).note).toBe('That is what the link shows now.')
  })

  it('the guard: answered by email with no package, Rev 3 waits, and the link shows Rev 2', () => {
    expect(linkShowsRevOf(bp398({ rev3Package: false }))).toBe(2)
    expect(describeForReviewer(rows, { rev: 4, ...linkViewOf(bp398({ rev3Package: false }), false) }).note).toBe('Until you share Rev 4, the link shows Rev 2.')
  })

  it('the link’s revision is the newest on the record, in any order; none while nothing is', () => {
    expect(linkShowsRevOf(sharedOnly([{ rev_number: 1, shared_at: '2026-09-15T00:00:00Z' }, { rev_number: 3, shared_at: '2026-09-20T00:00:00Z' }, { rev_number: 2, shared_at: '2026-09-18T00:00:00Z' }]))).toBe(3)
    expect(linkShowsRevOf(sharedOnly([{ rev_number: 1, shared_at: null }]))).toBeNull()
    expect(linkShowsRevOf([])).toBeNull()
  })

  it('a room is closed by its status or its close date; no room is not closed', () => {
    expect(isRoomClosed(null)).toBe(false)
    expect(isRoomClosed({ status: 'open', closed_at: null })).toBe(false)
    expect(isRoomClosed({ status: 'closed', closed_at: null })).toBe(true)
    expect(isRoomClosed({ status: 'open', closed_at: '2026-10-01T00:00:00Z' })).toBe(true)
  })
})

describe('the list the GC will see after the share (v2.4606, #62 PR 1b)', () => {
  it('BP398: Rev 4 as current, then Rev 3 answered by email, then Rev 2; Rev 1 was never shared, and the line says so', () => {
    const list = linkRevisionsAfterShare(bp398(), 4)
    expect(list.chips).toEqual([
      { id: 'r4', rev: 4, current: true, sharedAt: null },
      { id: 'r3', rev: 3, current: false, sharedAt: null, answeredByEmailAt: '2026-10-02T17:00:00Z' },
      { id: 'r2', rev: 2, current: false, sharedAt: '2026-09-16T03:03:49.265Z', answeredByEmailAt: null },
    ])
    expect(list.neverShared).toEqual([1])
    expect(list.waitsForPackage).toEqual([])
    expect(linkListLine(list)).toBe('Older revisions stay under it as the record. Rev 1 is not on their page, because it was never shared.')
  })

  it('the guard: Rev 3 with no package waits off the list, and the line says what it waits for', () => {
    const list = linkRevisionsAfterShare(bp398({ rev3Package: false }), 4)
    expect(list.chips.map((c) => c.rev)).toEqual([4, 2])
    expect(list.waitsForPackage).toEqual([3])
    expect(linkListLine(list)).toBe('Older revisions stay under it as the record. Rev 1 is not on their page, because it was never shared. Rev 3 goes on their page once it has a package or a reviewer’s file.')
  })

  it('2026-10-09 · Rev 3 with no package but the GC’s email dropped on it is on the list, answered by email', () => {
    const list = linkRevisionsAfterShare(bp398({ rev3Package: false, rev3File: true }), 4)
    expect(list.chips.map((c) => [c.rev, c.answeredByEmailAt ?? null])).toEqual([[4, null], [3, '2026-10-02T17:00:00Z'], [2, null]])
    expect(list.waitsForPackage).toEqual([])
    expect(linkViewOf(bp398({ rev3Package: false, rev3File: true }), false)).toEqual({ linkShowsRev: 3, linkShowsByEmail: true, roomClosed: false })
  })

  it('a first share lists one revision and says nothing; a shared newest lists the room as it is', () => {
    const first = linkRevisionsAfterShare(sharedOnly([{ id: 'r1', rev_number: 1, shared_at: null }]), 1)
    expect(first).toEqual({ chips: [{ id: 'r1', rev: 1, current: true, sharedAt: null }], neverShared: [], waitsForPackage: [] })
    expect(linkListLine(first)).toBe('')
    const live = linkRevisionsAfterShare(sharedOnly([{ id: 'r2', rev_number: 2, shared_at: '2026-09-20T00:00:00Z' }, { id: 'r1', rev_number: 1, shared_at: '2026-09-15T00:00:00Z' }]), 2)
    expect(live.chips.map((c) => `${c.rev}${c.current ? ' current' : ''}`)).toEqual(['2 current', '1'])
    expect(linkListLine(live)).toBe('Older revisions stay under it as the record.')
    expect(linkListLine(linkRevisionsAfterShare(sharedOnly([{ id: 'r2', rev_number: 2, shared_at: null }, { id: 'r1', rev_number: 1, shared_at: null }]), 2))).toBe('Rev 1 is not on their page, because it was never shared.')
  })
})

describe('the heads-up in Their call (2026-10-06)', () => {
  it('on a revision nobody shared, says what typing their answer does, before and after, with and without a package', () => {
    expect(emailedRecordLine({ rev: 3, shared: false, hasPackage: true, hasAnswer: false })).toBe('Typing their answer puts Rev 3 on the GC’s page as the record.')
    expect(emailedRecordLine({ rev: 3, shared: false, hasPackage: false, hasAnswer: false })).toBe('Typing their answer will put Rev 3 on the GC’s page once it has a package or a reviewer’s file.')
    expect(emailedRecordLine({ rev: 3, shared: false, hasPackage: true, hasAnswer: true })).toBe('Rev 3 is on the GC’s page as the record, answered by email.')
    expect(emailedRecordLine({ rev: 3, shared: false, hasPackage: false, hasAnswer: true })).toBe('Rev 3 goes on the GC’s page as the record once it has a package or a reviewer’s file.')
  })

  it('2026-10-09 · a reviewer’s file kept on the revision counts as the package does', () => {
    expect(emailedRecordLine({ rev: 3, shared: false, hasPackage: false, hasReviewerFile: true, hasAnswer: false })).toBe('Typing their answer puts Rev 3 on the GC’s page as the record.')
    expect(emailedRecordLine({ rev: 3, shared: false, hasPackage: false, hasReviewerFile: true, hasAnswer: true })).toBe('Rev 3 is on the GC’s page as the record, answered by email.')
  })

  it('says nothing on a shared revision', () => {
    expect(emailedRecordLine({ rev: 2, shared: true, hasPackage: true, hasAnswer: true })).toBe('')
  })
})

describe('v2.5023 · the preview prints a design change’s call and sign-off as the room does', () => {
  it('keeps the four columns on the way to the room row', () => {
    const stored = item({ id: 'dc', tag: 'FV-1', status: 'design_change', call_by: 'engineer', signoff_name: 'Pat Lee', signoff_on: '2026-10-09', signoff_via: 'email' })
    expect(roomRowFrom(toRoomItemSource(stored)).designCall).toBe("The engineer's call · signed off by Pat Lee on Oct 9, 2026, by email.")
  })
})
