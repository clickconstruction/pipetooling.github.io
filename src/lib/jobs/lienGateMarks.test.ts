import { describe, expect, it } from 'vitest'
import { affidavitGates, type LienAffidavitRow } from './lienDeskAffidavits'
import { LIEN_GATE_MARK_SLOTS, lienGateMarks, lienGateMarksMissingWords, lienGateMarksSummary, lienGateRowParts } from './lienGateMarks'

function row(partial: Partial<LienAffidavitRow> & { job_id: string }): LienAffidavitRow {
  return {
    last_month: '2026-07',
    deadline: '2026-11-16',
    is_sub: true,
    noticed: true,
    filed: false,
    open_balance: 2_918,
    customer_id: 'c',
    gc_customer_id: 'gc',
    property_kind: 'commercial',
    has_owner: true,
    has_legal: true,
    homestead: false,
    has_contractor_address: true,
    desk_item_id: null,
    desk_status: null,
    ...partial,
  }
}

describe('lienGateMarks', () => {
  it('maps the five gates to five marks in the pane order, every one clear on a ready sub job', () => {
    const marks = lienGateMarks(affidavitGates(row({ job_id: 'a' })), true)
    expect(marks.map((m) => m.slot)).toEqual([...LIEN_GATE_MARK_SLOTS])
    expect(marks.map((m) => m.state)).toEqual(['ok', 'ok', 'ok', 'ok', 'ok'])
    expect(marks[0]!.title).toBe('Owner of record with a mailing address')
    expect(lienGateMarksMissingWords(marks)).toBeNull()
    expect(lienGateMarksSummary(marks)).toBe('All 5 clear')
  })

  it('an open gate is red with the row word in its tooltip; a public owner lands in the owner slot', () => {
    const marks = lienGateMarks(affidavitGates(row({ job_id: 'b', owner_public: true })), true)
    expect(marks[0]).toEqual({ slot: 'owner', state: 'open', title: 'Missing a private owner', missingWord: 'a private owner' })
    expect(lienGateMarksMissingWords(marks)).toBe('missing a private owner')
    expect(lienGateMarksSummary(marks)).toBe('4 of 5 clear · missing a private owner')
  })

  it('three open gates read in slot order, the same words the row showed before', () => {
    const marks = lienGateMarks(affidavitGates(row({ job_id: 'c', has_owner: false, has_legal: false, noticed: false })), true)
    expect(marks.map((m) => m.state)).toEqual(['open', 'open', 'ok', 'open', 'ok'])
    expect(lienGateMarksMissingWords(marks)).toBe('missing owner, legal, a mailed notice')
    expect(marks[3]!.title).toBe('Missing a mailed notice')
  })

  it("the GC's address and the homestead answer carry their own words", () => {
    const marks = lienGateMarks(affidavitGates(row({ job_id: 'd', has_contractor_address: false, property_kind: 'residential', homestead_answered: false })), true)
    expect(marks[2]).toMatchObject({ state: 'open', title: "Missing the GC's address" })
    expect(marks[4]).toMatchObject({ slot: 'homestead', state: 'open', title: 'Missing the homestead answer' })
  })

  it('a job contracted with the owner keeps five marks, with the GC and notice slots skipped and not green', () => {
    const marks = lienGateMarks(affidavitGates(row({ job_id: 'e', is_sub: false, noticed: false, gc_customer_id: null, has_contractor_address: null })), false)
    expect(marks.map((m) => m.state)).toEqual(['ok', 'ok', 'skipped', 'skipped', 'ok'])
    expect(marks[2]!.title).toBe('No general contractor to name (contracted with the owner)')
    expect(marks[3]!.title).toBe('No monthly notice required (contracted with the owner)')
    expect(lienGateMarksSummary(marks)).toBe('All 3 asked clear')
  })

  it('a gate list missing a slot still draws five marks', () => {
    const marks = lienGateMarks([{ key: 'owner', ok: false, label: 'Owner of record with a mailing address' }], true)
    expect(marks).toHaveLength(5)
    expect(marks[1]).toMatchObject({ slot: 'legal', state: 'skipped', title: 'Not asked on this job' })
    expect(lienGateMarksSummary(marks)).toBe('0 of 1 clear · missing owner')
  })

  it('the strip shows in the two early piles; the words show where it does not, and on a phone always', () => {
    expect(lienGateRowParts('needs_property', false)).toEqual({ strip: true, words: false })
    expect(lienGateRowParts('to_draft', false)).toEqual({ strip: true, words: false })
    expect(lienGateRowParts('to_draft', true)).toEqual({ strip: true, words: true })
    for (const pile of ['awaiting', 'ready', 'held', 'filed', 'missed'] as const) expect(lienGateRowParts(pile, false)).toEqual({ strip: false, words: true })
  })
})
