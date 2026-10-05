import { describe, expect, it } from 'vitest'
import { describeForReviewer, isRoomClosed, linkListLine, linkRevisionsAfterShare, linkShowsRevOf } from './seeWhatTheySee'
import type { RoomItemSource } from '../../../supabase/functions/_shared/submittalRoomPayload'

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

  it('BP398 today: Rev 3 was answered by email and never shared, so the link skips it and shows Rev 2', () => {
    const revisions = [
      { rev_number: 4, status: 'draft', shared_at: null },
      { rev_number: 3, status: 'superseded', shared_at: null },
      { rev_number: 2, status: 'shared', shared_at: '2026-09-16T03:03:49.265Z' },
      { rev_number: 1, status: 'superseded', shared_at: null },
    ]
    expect(linkShowsRevOf(revisions)).toBe(2)
    expect(describeForReviewer(rows, { rev: 4, linkShowsRev: linkShowsRevOf(revisions), roomClosed: false }).note).toBe('Until you share Rev 4, the link shows Rev 2.')
  })

  it('the link’s revision is the newest with a share date, in any order; none while nothing is shared', () => {
    expect(linkShowsRevOf([{ rev_number: 1, shared_at: '2026-09-15T00:00:00Z' }, { rev_number: 3, shared_at: '2026-09-20T00:00:00Z' }, { rev_number: 2, shared_at: '2026-09-18T00:00:00Z' }])).toBe(3)
    expect(linkShowsRevOf([{ rev_number: 1, shared_at: null }])).toBeNull()
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
  it('BP398: Rev 4 as current, then Rev 2; Rev 3 and Rev 1 were never shared, and the line says so', () => {
    const list = linkRevisionsAfterShare(
      [
        { id: 'r4', rev_number: 4, shared_at: null },
        { id: 'r3', rev_number: 3, shared_at: null },
        { id: 'r2', rev_number: 2, shared_at: '2026-09-16T03:03:49.265Z' },
        { id: 'r1', rev_number: 1, shared_at: null },
      ],
      4,
    )
    expect(list.chips).toEqual([
      { id: 'r4', rev: 4, current: true, sharedAt: null },
      { id: 'r2', rev: 2, current: false, sharedAt: '2026-09-16T03:03:49.265Z' },
    ])
    expect(list.neverShared).toEqual([3, 1])
    expect(linkListLine(list)).toBe('Older revisions stay under it as the record. Rev 3 and Rev 1 are not on their page, because they were never shared.')
  })

  it('a first share lists one revision and says nothing; a shared newest lists the room as it is', () => {
    const first = linkRevisionsAfterShare([{ id: 'r1', rev_number: 1, shared_at: null }], 1)
    expect(first).toEqual({ chips: [{ id: 'r1', rev: 1, current: true, sharedAt: null }], neverShared: [] })
    expect(linkListLine(first)).toBe('')
    const live = linkRevisionsAfterShare([{ id: 'r2', rev_number: 2, shared_at: '2026-09-20T00:00:00Z' }, { id: 'r1', rev_number: 1, shared_at: '2026-09-15T00:00:00Z' }], 2)
    expect(live.chips.map((c) => `${c.rev}${c.current ? ' current' : ''}`)).toEqual(['2 current', '1'])
    expect(linkListLine(live)).toBe('Older revisions stay under it as the record.')
    expect(linkListLine(linkRevisionsAfterShare([{ id: 'r2', rev_number: 2, shared_at: null }, { id: 'r1', rev_number: 1, shared_at: null }], 2))).toBe('Rev 1 is not on their page, because it was never shared.')
  })
})

