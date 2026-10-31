import { describe, expect, it } from 'vitest'
import { PUT_IN_PREVIEW_CAP, putInConfirmRows, putInLabel, putInOutcomeWords, putInPreviewLines } from './putIn'
import type { MemberBid, MemberJob, Members } from './overview'

const bid = (id: string, name: string): MemberBid => ({ id, bid_number: id.toUpperCase(), project_name: name } as unknown as MemberBid)
const job = (id: string, name: string): MemberJob => ({ id, click_number: id.toUpperCase(), job_name: name } as unknown as MemberJob)
const members = (bids: MemberBid[], jobs: MemberJob[]): Members => ({ bids, jobs }) as unknown as Members
const labels = { bidLabel: (b: MemberBid) => `BP${b.bid_number}`, jobLabel: (j: MemberJob) => `JP${j.click_number}` }

describe('putInConfirmRows — the window says the counts now and after', () => {
  it('counts the bids and jobs in it before and after, and names the address and the customer', () => {
    const rows = putInConfirmRows({ atAddress: members([bid('b1', 'Lot 18')], [job('j1', 'Lot 14'), job('j2', 'Lot 12')]), inIt: members([], [job('j9', 'Lodge')]), name: 'Harlow Ranch', address: 'Harlow Ranch Rd', customerName: 'Ridgeway Builders' })
    expect(rows.map((r) => [r.label, r.before, r.after, r.changes])).toEqual([
      ['Development', 'not in Harlow Ranch', 'Harlow Ranch', true],
      ['Bids in it', '0', '1', true],
      ['Jobs in it', '1', '3', true],
      ['Address', 'Harlow Ranch Rd', null, false],
      ['Customer', 'Ridgeway Builders', null, false],
    ])
  })
  it('a kind with nothing to add does not change, and a missing address or customer reads as a dash', () => {
    const rows = putInConfirmRows({ atAddress: members([bid('b1', 'x')], []), inIt: members([], []), name: 'H', address: null, customerName: null })
    expect(rows[2]).toEqual({ label: 'Jobs in it', before: '0', after: '0', changes: false })
    expect(rows[3]?.before).toBe('—')
    expect(rows[4]?.before).toBe('—')
  })
})

describe('putInPreviewLines and putInLabel', () => {
  it('lists jobs then bids with their numbers, caps the list and counts the rest', () => {
    const jobs = Array.from({ length: 6 }, (_, i) => job(`j${i}`, `Lot ${i}`))
    const bids = Array.from({ length: 5 }, (_, i) => bid(`b${i}`, `Bid ${i}`))
    const out = putInPreviewLines(members(bids, jobs), labels)
    expect(out.lines).toHaveLength(PUT_IN_PREVIEW_CAP)
    expect(out.lines[0]).toBe('JPJ0 Lot 0')
    expect(out.lines[6]).toBe('BPB0 Bid 0')
    expect(out.more).toBe(3)
    expect(putInLabel(members(bids, jobs), 'Harlow Ranch')).toBe('Put the 11 in Harlow Ranch')
  })
  it('a blank name leaves the number alone', () => {
    expect(putInPreviewLines(members([bid('b1', '  ')], []), labels)).toEqual({ lines: ['BPB1'], more: 0 })
  })
})

describe('putInOutcomeWords — what moved, and what the rules held', () => {
  it('says the counts that moved, both kinds or one', () => {
    expect(putInOutcomeWords({ bids: 13, jobs: 21 }, { bids: 13, jobs: 21 }, 'Harlow Ranch')).toBe('Put 13 bids and 21 jobs in Harlow Ranch.')
    expect(putInOutcomeWords({ bids: 0, jobs: 1 }, { bids: 0, jobs: 1 }, 'Harlow Ranch')).toBe('Put 1 job in Harlow Ranch.')
  })
  it('names what stayed when fewer moved than were asked, and when nothing did', () => {
    expect(putInOutcomeWords({ bids: 1, jobs: 0 }, { bids: 2, jobs: 1 }, 'H')).toBe("Put 1 bid in H. 2 stayed as they were, which the bid's and job's own rules decide.")
    expect(putInOutcomeWords({ bids: 0, jobs: 0 }, { bids: 0, jobs: 1 }, 'H')).toBe("Nothing moved: the job or bid stayed as it was, which the bid's and job's own rules decide.")
  })
})
