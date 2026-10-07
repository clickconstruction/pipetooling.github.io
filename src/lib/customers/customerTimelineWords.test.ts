import { describe, expect, it } from 'vitest'
import type { TimelineSummary } from './customerTimeline'
import { customerTimelineAsOfWords, customerTimelineJobWords, customerTimelineTiles, customerTimelineWhoWords } from './customerTimelineWords'
import { parseCustomerProfileView } from './customerProfileView'

const summary = (over: Partial<TimelineSummary> = {}): TimelineSummary => ({
  owed: 33650,
  openBillCount: 2,
  owedJobCount: 2,
  oldestOpenBillDays: 79,
  promise: { promisedYmd: '2026-10-15', jobId: 'j901', kept: false, broken: false },
  notYetBilled: 4200,
  notYetBilledJobCount: 1,
  booked: 0,
  bookedJobCount: 0,
  unpaidHours: 46,
  unpaidCrewDays: 7,
  unpaidHoursJobCount: 2,
  unpaidMaterials: 9550,
  unpaidTicketCount: 3,
  openJobCount: 3,
  paidJobCount: 3,
  daysToPay: { medianDays: 27, samples: 2 },
  ...over,
})

describe('customerTimelineTiles', () => {
  it('says what they owe, what is not billed, and the unpaid hours and materials', () => {
    const tiles = customerTimelineTiles(summary())
    expect(tiles.map((t) => [t.label, t.value, t.sub])).toEqual([
      ['Owes us', '$33,650', '2 bills on 2 jobs · oldest 79 days · they said Oct 15'],
      ['Not yet billed', '$4,200', '1 job working'],
      ['Unpaid hours', '46h 00m', '7 crew days on 2 open jobs'],
      ['Unpaid materials', '$9,550', '3 supply tickets on open jobs'],
    ])
    expect(tiles[0]?.alert).toBe(true)
  })

  it('names a broken promise, booked work, and a customer who owes nothing', () => {
    const broken = customerTimelineTiles(summary({ promise: { promisedYmd: '2026-10-01', jobId: 'j', kept: false, broken: true } }))
    expect(broken[0]?.sub).toBe('2 bills on 2 jobs · oldest 79 days · said Oct 1, not paid')
    const booked = customerTimelineTiles(summary({ booked: 50950, bookedJobCount: 4 }))
    expect(booked[1]?.sub).toBe('1 job working · $50,950 booked on 4 waiting')
    const clear = customerTimelineTiles(
      summary({ owed: 0, openBillCount: 0, owedJobCount: 0, oldestOpenBillDays: null, promise: null, notYetBilled: 0, notYetBilledJobCount: 0, unpaidHours: 0, unpaidCrewDays: 0, unpaidHoursJobCount: 0, unpaidMaterials: 0, unpaidTicketCount: 0 }),
    )
    expect(clear.map((t) => t.sub)).toEqual(['nothing open', 'nothing waiting to bill', 'no crew hours on open jobs', 'no supply tickets on open jobs'])
    expect(clear[0]?.alert).toBe(false)
  })
})

describe('the bar’s other words', () => {
  it('reads what stood on the day under the bar', () => {
    expect(customerTimelineAsOfWords('2026-05-12', { owed: 22000, unpaidHours: 22, unpaidMaterials: 8940 })).toBe(
      'On May 12, 2026: owed $22,000 · 22h 00m unpaid · $8,940 materials',
    )
  })

  it('says how many jobs, the GC count, since when and how fast they pay', () => {
    const jobs = [{ role: 'customer' }, { role: 'gc' }, { role: 'both' }] as Parameters<typeof customerTimelineWhoWords>[0]['jobs']
    expect(customerTimelineWhoWords({ jobs, summary: summary() }, '2024-11-12')).toEqual(['3 jobs · 3 open', 'GC on 2 jobs', 'customer since Nov 2024', 'pays in ~27 days'])
    expect(customerTimelineWhoWords({ jobs: jobs.slice(0, 1), summary: summary({ openJobCount: 1, daysToPay: null }) }, null)).toEqual(['1 job · 1 open'])
  })

  it('names a job by number and words, and reads a stored view', () => {
    expect(customerTimelineJobWords({ numberLabel: '901', label: 'Bluff Springs clinic' })).toBe('901 · Bluff Springs clinic')
    expect(parseCustomerProfileView('timeline')).toBe('timeline')
    expect(parseCustomerProfileView('anything else')).toBe('profile')
    expect(parseCustomerProfileView(null)).toBe('profile')
  })
})
