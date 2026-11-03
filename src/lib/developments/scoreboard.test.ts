import { describe, expect, it } from 'vitest'
import type { MemberJob } from './overview'
import type { SiteCostsRead } from './siteCosts'
import type { SiteLaborRead } from './siteLabor'
import {
  buildScoreboard,
  nextScoreboardSort,
  scoreboardCellStands,
  scoreboardCellWords,
  scoreboardColumnsFor,
  scoreboardFoldWords,
  scoreboardFoldedKeys,
  scoreboardPct,
  scoreboardWorkWords,
  SCOREBOARD_COLUMNS,
  type SiteOverheadRead,
} from './scoreboard'

function job(over: Partial<MemberJob> & { id: string }): MemberJob {
  return {
    hcp_number: null, click_number: over.id.replace('j', ''), job_name: `Job ${over.id}`, job_address: null, customer_id: null, customer_name: null, gc_customer_id: null,
    development_id: 'd1', bid_id: null, status: 'working', revenue: 0, payments_made: 0, pct_complete: null, last_work_date: null, last_bill_date: null, job_plans_link: null,
    created_at: null, updated_at: null, ...over,
  } as MemberJob
}
const label = (j: MemberJob) => `JP${j.click_number}`

const jobs = [
  job({ id: 'j612', status: 'paid', revenue: 241431 }),
  job({ id: 'j583', status: 'working', revenue: 16000, pct_complete: 20 }),
  job({ id: 'j1091', status: 'working', revenue: 0, pct_complete: 75 }),
  job({ id: 'j958', status: 'waiting', revenue: 54514 }),
  job({ id: 'j224', status: 'paid', revenue: 894971 }),
  job({ id: 'j953', status: 'waiting', revenue: 0 }),
]
const labor: SiteLaborRead = {
  state: 'read',
  labor: {
    byJobId: new Map([
      ['j612', { jobId: 'j612', hours: 1842, costUsd: 55410, days: 118, people: [] }],
      ['j583', { jobId: 'j583', hours: 54, costUsd: 1296, days: 5, people: [] }],
      ['j1091', { jobId: 'j1091', hours: 99, costUsd: 2594, days: 7, people: [] }],
    ]),
    siteDays: 125,
    people: 5,
  },
}
const costRow = (jobId: string, subs: number, supply: number, card: number) => ({ jobId, subLabor: subs, parts: { supplyInvoices: supply, cardCharges: card, tallyParts: 0, otherCharges: 0 }, total: subs + supply + card })
const costs: SiteCostsRead = {
  state: 'read',
  byJobId: new Map([
    ['j612', costRow('j612', 18400, 53770, 9100)],
    ['j583', costRow('j583', 0, 1480, 0)],
    ['j1091', costRow('j1091', 0, 0, 3732)],
    ['j224', costRow('j224', 0, 812300, 0)],
  ]),
}
const overhead: SiteOverheadRead = { state: 'read', byJobId: new Map([['j612', { usd: 14920, days: 118 }], ['j583', { usd: 610, days: 5 }], ['j1091', { usd: 890, days: 7 }]]) }

describe('buildScoreboard', () => {
  const model = buildScoreboard({ jobs, invoices: [], jobLabel: label, labor, costs, overhead })
  const row = (id: string) => [...model.rows, ...model.empties].find((r) => r.jobId === id)!

  it('every job: cost is the four together and profit is earned less cost', () => {
    const r = row('j612')
    expect(r.m).toEqual({ hours: 1842, days: 118, labor: 55410, subs: 18400, parts: 62870, overhead: 14920, earned: 241431, cost: 151600, profit: 89831 })
    for (const j of [...model.rows, ...model.empties]) {
      expect(j.m.cost).toBe(Math.round((j.m.labor + j.m.subs + j.m.parts + j.m.overhead) * 100) / 100)
      expect(j.m.profit).toBe(Math.round((j.m.earned - j.m.cost) * 100) / 100)
    }
  })

  it('earned follows the percent: paid is the contract, working the share, no percent half with the flags', () => {
    expect(row('j612')).toMatchObject({ pct: 100, pctSource: 'paid', finished: true })
    expect(row('j583').m.earned).toBe(3200)
    expect(row('j583').pct).toBe(20)
    expect(row('j958')).toMatchObject({ pct: null, flags: ['assumed-50', 'no-pct'] })
    expect(row('j958').m.earned).toBe(27257)
  })

  it('a job with no price that costs wears the flag and its profit is the loss', () => {
    expect(row('j1091').flags).toContain('no-price')
    expect(row('j1091').m.profit).toBe(-7216)
  })

  it('a pass-through job is materials only and set aside from the margin on work', () => {
    expect(row('j224').flags).toContain('materials-only')
    expect(model.work).toEqual({ earned: 241431 + 3200 + 0 + 27257, profit: 89831 + (3200 - 3386) + -7216 + 27257, jobs: 4 })
    expect(scoreboardWorkWords(model.work)).toBe(`${Math.round(((89831 - 186 - 7216 + 27257) / (241431 + 3200 + 27257)) * 100)}% on work alone`)
  })

  it('jobs with nothing on them fold, the rest sort by earned biggest first', () => {
    expect(model.empties.map((r) => r.jobId)).toEqual(['j953'])
    expect(model.rows.map((r) => r.jobId)).toEqual(['j224', 'j612', 'j958', 'j583', 'j1091'])
    expect(scoreboardFoldWords(1)).toBe('Nothing on them yet · 1 job')
  })

  it('the site is the sum of the rows, with days counted once across the site and the people from the clock', () => {
    expect(model.site.earned).toBe(241431 + 3200 + 0 + 27257 + 894971)
    expect(model.site.cost).toBe(151600 + 3386 + 7216 + 812300)
    expect(model.site.profit).toBe(model.site.earned - model.site.cost)
    expect(model.site.hours).toBe(1842 + 54 + 99)
    expect(model.site.days).toBe(125)
    expect(model.people).toBe(5)
  })

  it('a sort by profit the other way puts the loss first; the same tile turns the order', () => {
    const asc = buildScoreboard({ jobs, invoices: [], jobLabel: label, labor, costs, overhead, sort: { key: 'profit', desc: false } })
    expect(asc.rows[0]!.jobId).toBe('j1091')
    expect(nextScoreboardSort({ key: 'earned', desc: true }, 'earned')).toEqual({ key: 'earned', desc: false })
    expect(nextScoreboardSort({ key: 'earned', desc: false }, 'cost')).toEqual({ key: 'cost', desc: true })
  })

  it('while a read is out the figures are zero and the reads say so, cell by cell', () => {
    const reading = buildScoreboard({ jobs, invoices: [], jobLabel: label, labor: { state: 'reading' }, costs, overhead: { state: 'off' } })
    expect(reading.reads).toEqual({ labor: 'reading', costs: 'read', overhead: 'off' })
    expect(scoreboardCellStands('hours', reading.reads)).toBe('reading')
    expect(scoreboardCellStands('parts', reading.reads)).toBe('stands')
    expect(scoreboardCellStands('earned', reading.reads)).toBe('stands')
    expect(scoreboardCellStands('cost', reading.reads)).toBe('reading')
    expect(scoreboardCellStands('overhead', reading.reads)).toBe('off')
    const failed = buildScoreboard({ jobs, invoices: [], jobLabel: label, labor, costs: { state: 'failed' }, overhead })
    expect(scoreboardCellStands('profit', failed.reads)).toBe('failed')
    expect(failed.rows.find((r) => r.jobId === 'j612')!.m.parts).toBe(0)
  })

  it('paid bills that cover the contract finish a job that is not yet marked paid', () => {
    const j = job({ id: 'j7', status: 'billed', revenue: 1000, pct_complete: 40 })
    expect(scoreboardPct(j, [{ amount: 1000, status: 'paid' }])).toEqual({ pct: 100, source: 'paid-invoices' })
    expect(scoreboardPct(j, [{ amount: 400, status: 'paid' }])).toEqual({ pct: 40, source: 'office' })
  })
})

describe('the columns and the words', () => {
  it('the lead’s board is hours, days and earned, and folded shows all of them; the full board folds to the money three', () => {
    const lead = scoreboardColumnsFor(false)
    expect(lead.map((c) => c.key)).toEqual(['hours', 'days', 'earned'])
    expect([...scoreboardFoldedKeys(lead)]).toEqual(['hours', 'days', 'earned'])
    expect([...scoreboardFoldedKeys(SCOREBOARD_COLUMNS)]).toEqual(['earned', 'cost', 'profit'])
  })
  it('cells read as hours, days and whole dollars with a minus before a loss', () => {
    expect(scoreboardCellWords('hours', 1842.4)).toBe('1,842 h')
    expect(scoreboardCellWords('days', 118)).toBe('118 d')
    expect(scoreboardCellWords('profit', -7216.4)).toBe('−$7,216')
    expect(scoreboardCellWords('earned', 241431)).toBe('$241,431')
  })
})
