import { describe, expect, it } from 'vitest'
import { planSetsForBid, type BidPlanSetRow } from './bidPlanSets'
import { partMovedOnNotes, pricedOnIsPinned, pricedOnItem, pricedOnLine, type BidJobPlanState } from './bidPricedOn'

function row(over: Partial<BidPlanSetRow> & { id: string; link: string }): BidPlanSetRow {
  return { bid_id: 'b1', name: 'Issued set', memo: '', plan_date: null, file_name: null, file_size: null, file_count: null, checked_at: null, check_note: null, created_by: null, created_at: '2026-09-14T12:00:00Z', updated_at: '2026-09-14T12:00:00Z', ...over }
}
const issued = row({ id: 'r1', link: 'https://drive.google.com/drive/folders/issued', plan_date: '2026-09-14' })
const addendum = row({ id: 'r2', name: 'Addendum 1', link: 'https://drive.google.com/drive/folders/add1', plan_date: '2026-10-02', created_at: '2026-10-02T12:00:00Z' })
const items = planSetsForBid([issued, addendum], { plans_link: 'https://drive.google.com/drive/folders/issued/' })

function state(over: Partial<BidJobPlanState> & { job_id: string }): BidJobPlanState {
  return { bid_id: 'b1', hcp_number: null, click_number: '972', job_name: 'Harlow Ranch gas test', part_id: 'p1', part_name: 'The Lodge', set_id: 's1', set_name: 'Issued set', set_kind: 'issued', set_dated: '2026-09-14', set_link: 'https://drive.google.com/drive/folders/issued', set_came_at: '2026-10-20T15:00:00Z', ...over }
}

describe('pricedOnItem', () => {
  it('falls back to the set the robot reads when nothing is pinned, by link however it is spelled', () => {
    expect(pricedOnItem(items, null)?.id).toBe('r1')
    expect(pricedOnIsPinned(items, null)).toBe(false)
    expect(pricedOnLine(items, null)).toBe('Priced on Issued set, the set the robot reads, since none is pinned.')
  })
  it('reads the pinned row and its date', () => {
    expect(pricedOnItem(items, 'r2')?.name).toBe('Addendum 1')
    expect(pricedOnIsPinned(items, 'r2')).toBe(true)
    expect(pricedOnLine(items, 'r2')).toBe('Priced on Addendum 1 · Oct 2, 2026.')
  })
  it('a pin pointing at a row that is gone falls back to the robot’s set', () => {
    expect(pricedOnItem(items, 'gone')?.id).toBe('r1')
    expect(pricedOnIsPinned(items, 'gone')).toBe(false)
  })
  it('a bid with only its own link reads as priced on that link, with no line to draw', () => {
    const own = planSetsForBid([], { plans_link: 'https://drive.google.com/drive/folders/own' })
    expect(pricedOnItem(own, null)?.onBid).toBe(true)
    expect(pricedOnLine(own, null)).toBeNull()
    expect(pricedOnItem([], null)).toBeNull()
  })
})

describe('partMovedOnNotes', () => {
  const priced = pricedOnItem(items, 'r1')
  it('says nothing while every job’s part still builds from the priced set, whatever the link’s spelling', () => {
    expect(partMovedOnNotes(priced, [state({ job_id: 'j1', set_link: 'https://drive.google.com/drive/folders/issued/?usp=sharing' })])).toEqual([])
  })
  it('says nothing for a job with no part or a part with no set, and for a bid with no plans', () => {
    expect(partMovedOnNotes(priced, [state({ job_id: 'j1', part_id: null, part_name: null, set_id: null, set_name: null, set_link: null })])).toEqual([])
    expect(partMovedOnNotes(priced, [state({ job_id: 'j1', set_id: null, set_name: null, set_link: null })])).toEqual([])
    expect(partMovedOnNotes(null, [state({ job_id: 'j1', set_link: 'https://x/other' })])).toEqual([])
  })
  it('one note per part that moved on, naming every job on it, the set and its date', () => {
    const notes = partMovedOnNotes(priced, [
      state({ job_id: 'j1', set_id: 's2', set_name: 'Addendum 2', set_dated: '2026-10-14', set_link: 'https://drive.google.com/drive/folders/add2' }),
      state({ job_id: 'j2', click_number: '980', set_id: 's2', set_name: 'Addendum 2', set_dated: '2026-10-14', set_link: 'https://drive.google.com/drive/folders/add2' }),
      state({ job_id: 'j3', click_number: '983', part_id: 'p2', part_name: 'The Bunker', set_id: 's3', set_name: 'Permit set', set_dated: null, set_link: 'https://drive.google.com/drive/folders/permit' }),
    ])
    expect(notes.map((n) => n.words)).toEqual([
      'On The Lodge, JP972 and JP980 now build from Addendum 2, dated Oct 14, 2026. This bid was priced on Issued set.',
      'On The Bunker, JP983 now builds from Permit set. This bid was priced on Issued set.',
    ])
    expect(notes[0]!.jobs.map((j) => j.id)).toEqual(['j1', 'j2'])
    expect(notes[1]!.setLink).toBe('https://drive.google.com/drive/folders/permit')
  })
})
