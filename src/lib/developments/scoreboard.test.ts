import { describe, expect, it } from 'vitest'
import type { MemberJob } from './overview'
import type { SiteCostsRead } from './siteCosts'
import type { SiteLaborRead } from './siteLabor'
import {
  buildScoreboard,
  nextScoreboardSort,
  scoreboardCellStands,
  scoreboardCellWords,
  scoreboardCompactWords,
  scoreboardColumnsFor,
  scoreboardFoldWords,
  scoreboardFoldedKeys,
  scoreboardPct,
  scoreboardWorkWords,
  SCOREBOARD_COLUMNS,
  scoreboardMembers,
  scoreboardNoMembersWords,
  scoreboardPendingWords,
  type ScoreboardMembersInput,
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
    people: 5, daysKnown: true,
  },
}
const costRow = (jobId: string, subs: number, supply: number, card: number) => ({ jobId, subLabor: subs, parts: { supplyInvoices: supply, cardCharges: card, tallyParts: 0, otherCharges: 0 }, total: subs + supply + card, breakdown: { subs: [], suppliers: [], cardLines: [], tallyLines: 0, otherLines: 0 } })
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
    expect(scoreboardWorkWords(model.work)).toBe(`${Math.round(((89831 - 186 - 7216 + 27257) / (241431 + 3200 + 27257)) * 100)}% on work`)
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

describe('the rows under an open job (v2.6457)', () => {
  const person = (over: Partial<{ personName: string; personId: string | null; userId: string | null; hours: number; costUsd: number; days: number; leadDays: number }>) => ({
    personName: 'Mateo', personId: 'p-mateo', userId: null, hours: 100, costUsd: 3000, days: 12, leadDays: 0, ...over,
  })
  const laborRead: SiteLaborRead = {
    state: 'read',
    labor: {
      byJobId: new Map([
        ['j1', { jobId: 'j1', hours: 0, costUsd: 0, days: 0, people: [person({}), person({ personName: 'Luis', personId: 'p-luis', userId: 'u-luis', hours: 80, costUsd: 2800, days: 10, leadDays: 6 }), person({ personName: 'Tom', personId: null, hours: 120, costUsd: 3240, days: 14 })] }],
      ]),
      siteDays: 20,
      people: 3, daysKnown: true,
    },
  }
  const costsRead: SiteCostsRead = {
    state: 'read',
    byJobId: new Map([
      [
        'j1',
        {
          jobId: 'j1',
          parts: { supplyInvoices: 5000, cardCharges: 900, tallyParts: 120, otherCharges: 400 },
          subLabor: 1800,
          total: 8220,
          breakdown: {
            subs: [{ name: 'Reyes Excavating', usd: 1800, sheets: 2 }],
            // the allocation read came back short: the houses hold 4,800 of the 5,000
            suppliers: [{ name: 'Ferguson', usd: 3600, invoices: 4 }, { name: 'Moore Supply', usd: 1200, invoices: 1 }],
            cardLines: [{ txId: 'tx1', usd: 500 }, { txId: 'tx2', usd: 300 }, { txId: 'tx3', usd: 100 }],
            tallyLines: 3,
            otherLines: 2,
          },
        },
      ],
    ]),
  }
  const overheadRead: SiteOverheadRead = { state: 'read', byJobId: new Map([['j1', { usd: 610, days: 9 }]]) }
  const holders = { state: 'read' as const, byTxId: new Map([['tx1', { cardId: 'c1', name: 'Luis', userId: 'u-luis' }], ['tx2', { cardId: 'c2', name: 'Shop card', userId: null }], ['tx3', { cardId: 'c1', name: 'Luis', userId: 'u-luis' }]]) }
  const jobCost = 3000 + 2800 + 3240 + 1800 + 5000 + 900 + 120 + 400 + 610
  const base: ScoreboardMembersInput = {
    jobId: 'j1',
    jobCost,
    seesCosts: true,
    labor: laborRead,
    costs: costsRead,
    overhead: overheadRead,
    cardHolders: holders,
    invoices: [{ job_id: 'j1', sent_by_user_id: 'u-dana' }, { job_id: 'j1', sent_by_user_id: 'u-dana' }, { job_id: 'j2', sent_by_user_id: 'u-dana' }],
    payments: [{ job_id: 'j1', created_by: 'u-dana' }, { job_id: 'j1', created_by: 'u-sam' }],
    names: new Map([['u-dana', 'Dana'], ['u-sam', 'Sam']]),
    viewer: { userId: 'u-dana', name: 'Dana' },
  }

  it('every row with money fills Cost, and the rows add up to the job’s Cost', () => {
    const { members, pending } = scoreboardMembers(base)
    expect(pending).toBeNull()
    const sum = members.reduce((t, m) => t + (m.cost ?? 0), 0)
    expect(sum).toBeCloseTo(jobCost, 2)
    const shares = members.reduce((t, m) => t + (m.share ?? 0), 0)
    expect(shares).toBeCloseTo(1, 6)
  })

  it('the order: leads, the crew by hours, subs, houses with their gap, card holders, the tally, other charges, overhead, the office', () => {
    const { members } = scoreboardMembers(base)
    expect(members.map((m) => `${m.kind}:${m.name}`)).toEqual([
      'lead:Luis',
      'crew:Tom',
      'crew:Mateo',
      'sub:Reyes Excavating',
      'supplier:Ferguson',
      'supplier:Moore Supply',
      'supplier:Other supply invoices',
      'card:Luis',
      'card:Shop card',
      'tally:The tally',
      'other:Other job charges',
      'overhead:Day share',
      'office:Dana',
      'office:Sam',
    ])
  })

  it('each row says what it put in, in its own cells, with the small words beside its name', () => {
    const { members } = scoreboardMembers(base)
    const by = (k: string) => members.find((m) => `${m.kind}:${m.name}` === k)!
    expect(by('lead:Luis')).toMatchObject({ kit: 'led 6 of 10 days', m: { hours: 80, days: 10, labor: 2800 }, cost: 2800 })
    expect(by('crew:Tom').kit).toBeNull()
    expect(by('sub:Reyes Excavating')).toMatchObject({ kit: '2 sheets', m: { subs: 1800 } })
    expect(by('supplier:Other supply invoices')).toMatchObject({ m: { parts: 200 }, cost: 200 })
    expect(by('card:Luis')).toMatchObject({ kit: '2 charges', m: { parts: 600 } })
    expect(by('tally:The tally').kit).toBe('3 lines')
    expect(by('overhead:Day share')).toMatchObject({ kit: '9 days charged', m: { overhead: 610 } })
    expect(by('office:Dana')).toMatchObject({ words: 'sent 2 bills · booked 1 payment', cost: null, share: null })
    expect(by('office:Sam').words).toBe('booked 1 payment')
  })

  it('the gold row: the viewer by login, a person with no login by name, the viewer’s card', () => {
    const asLuis = scoreboardMembers({ ...base, viewer: { userId: 'u-luis', name: 'Luis Ortega' } }).members
    expect(asLuis.filter((m) => m.you).map((m) => `${m.kind}:${m.name}`)).toEqual(['lead:Luis', 'card:Luis'])
    const asTom = scoreboardMembers({ ...base, viewer: { userId: 'u-tom', name: ' tom ' } }).members
    expect(asTom.filter((m) => m.you).map((m) => m.name)).toEqual(['Tom'])
    // a person with a login is never matched by name alone
    const asMateoByName = scoreboardMembers({ ...base, viewer: { userId: 'u-other', name: 'Luis' } }).members
    expect(asMateoByName.filter((m) => m.you)).toEqual([])
    expect(scoreboardMembers(base).members.filter((m) => m.you).map((m) => `${m.kind}:${m.name}`)).toEqual(['office:Dana'])
  })

  it('the lead’s board lists the people with hours and days and nothing else', () => {
    const { members } = scoreboardMembers({ ...base, seesCosts: false })
    expect(members.map((m) => m.name)).toEqual(['Luis', 'Tom', 'Mateo'])
    expect(members.every((m) => m.cost === null && m.share === null && m.m.labor === undefined)).toBe(true)
    expect(members[0]!.m).toEqual({ hours: 80, days: 10 })
  })

  it('the card read not in yet, or failed: one Card row for the job, still adding up', () => {
    for (const cardHolders of [{ state: 'reading' as const }, { state: 'failed' as const }, undefined]) {
      const { members } = scoreboardMembers({ ...base, cardHolders })
      const cards = members.filter((m) => m.kind === 'card')
      expect(cards.map((m) => [m.name, m.kit, m.cost])).toEqual([['Card', '3 charges', 900]])
    }
  })

  it('a card total the lines fall short of gets its reconciling row', () => {
    const j1Row = costsRead.state === 'read' ? costsRead.byJobId.get('j1')! : null
    const short: SiteCostsRead = { state: 'read', byJobId: new Map([['j1', { ...j1Row!, parts: { supplyInvoices: 4800, cardCharges: 1000, tallyParts: 0, otherCharges: 0 } }]]) }
    const { members } = scoreboardMembers({ ...base, costs: short })
    expect(members.filter((m) => m.kind === 'card').map((m) => [m.name, m.cost])).toEqual([
      ['Luis', 600],
      ['Shop card', 300],
      ['Card charges not split', 100],
    ])
    expect(members.some((m) => m.name === 'Other supply invoices')).toBe(false)
  })

  it('a read still out says so in one line; a refusal names that the Job window has the rows', () => {
    expect(scoreboardMembers({ ...base, costs: { state: 'reading' } }).pending).toBe('reading')
    expect(scoreboardMembers({ ...base, overhead: { state: 'failed' }, costs: { state: 'reading' } }).pending).toBe('failed')
    expect(scoreboardMembers({ ...base, seesCosts: false, costs: { state: 'failed' } }).pending).toBeNull()
    expect(scoreboardPendingWords('reading')).toBe('Some rows are still reading.')
    expect(scoreboardPendingWords('failed')).toBe('A source would not read. The Job window has these rows.')
    expect(scoreboardPendingWords(null)).toBeNull()
    expect(scoreboardNoMembersWords(true)).toBe('Nothing is on this job yet.')
    expect(scoreboardNoMembersWords(false)).toBe('No hours are on this job yet.')
  })
})

describe('scoreboardCompactWords (v2.6457)', () => {
  it('money reads short as the phone strip reads it; hours and days stay whole; a loss keeps its sign', () => {
    expect(scoreboardCompactWords('earned', 2_099_313)).toBe('$2.1M')
    expect(scoreboardCompactWords('earned', 2_000_000)).toBe('$2M')
    expect(scoreboardCompactWords('earned', 12_400_000)).toBe('$12M')
    expect(scoreboardCompactWords('parts', 684_445)).toBe('$684k')
    expect(scoreboardCompactWords('overhead', 13_395)).toBe('$13k')
    expect(scoreboardCompactWords('labor', 9_446)).toBe('$9,446')
    expect(scoreboardCompactWords('profit', -27_160)).toBe('−$27k')
    expect(scoreboardCompactWords('profit', -186)).toBe('−$186')
    expect(scoreboardCompactWords('hours', 12_345)).toBe('12,345 h')
    expect(scoreboardCompactWords('days', 57)).toBe('57 d')
  })
})

describe('a reader with the hours but not the days (v2.6457)', () => {
  it('the lead’s board drops Days; the full board keeps its money three folded', () => {
    expect(scoreboardColumnsFor(false, false).map((c) => c.key)).toEqual(['hours', 'earned'])
    expect([...scoreboardFoldedKeys(scoreboardColumnsFor(false, false))]).toEqual(['hours', 'earned'])
    expect([...scoreboardFoldedKeys(scoreboardColumnsFor(true, false))]).toEqual(['earned', 'cost', 'profit'])
    expect(scoreboardColumnsFor(true, false).some((c) => c.key === 'days')).toBe(false)
  })
  it('a person’s row carries hours alone, and nobody reads as a Lead without the days', () => {
    const labor: SiteLaborRead = {
      state: 'read',
      labor: { byJobId: new Map([['j1', { jobId: 'j1', hours: 50, costUsd: 0, days: 0, people: [{ personName: 'Luis', personId: null, userId: null, hours: 50, costUsd: 0, days: 0, leadDays: 3 }] }]]), siteDays: 0, people: 1, daysKnown: false },
    }
    const { members } = scoreboardMembers({ jobId: 'j1', jobCost: 0, seesCosts: false, labor, invoices: [], payments: [], names: new Map(), viewer: { userId: null, name: 'Luis' } })
    expect(members).toEqual([{ key: 'person:Luis', kind: 'crew', name: 'Luis', kit: null, m: { hours: 50 }, cost: null, share: null, words: null, you: true }])
  })
})
