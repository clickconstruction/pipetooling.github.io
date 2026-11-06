import { describe, expect, it } from 'vitest'
import type { MemberJob } from './overview'
import type { CardHolder } from './cardHolders'
import type { SiteCostsRead } from './siteCosts'
import type { SiteLaborRead } from './siteLabor'
import {
  buildScoreboard,
  nextScoreboardSort,
  scoreboardCellStands,
  scoreboardCellWords,
  scoreboardCompactWords,
  scoreboardColumnsFor,
  scoreboardColumnWidths,
  scoreboardFoldWords,
  scoreboardHeadline,
  scoreboardHeadlineWords,
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

  it('payments out of the bank with no card on them are one Bank row, counted as payments, still adding up', () => {
    const j1Row = costsRead.state === 'read' ? costsRead.byJobId.get('j1')! : null
    const withBank: SiteCostsRead = {
      state: 'read',
      byJobId: new Map([['j1', { ...j1Row!, parts: { ...j1Row!.parts, cardCharges: 1400 }, breakdown: { ...j1Row!.breakdown, cardLines: [...j1Row!.breakdown.cardLines, { txId: 'tx4', usd: 250 }, { txId: 'tx5', usd: 250 }] } }]]),
    }
    const bank: CardHolder = { cardId: null, name: 'Bank payments', userId: null, bank: true }
    const cardHolders = { state: 'read' as const, byTxId: new Map<string, CardHolder>([...holders.byTxId, ['tx4', bank], ['tx5', bank]]) }
    const { members } = scoreboardMembers({ ...base, jobCost: jobCost + 500, costs: withBank, cardHolders })
    expect(members.filter((m) => m.kind === 'card' || m.kind === 'bank').map((m) => [m.kind, m.name, m.kit, m.cost])).toEqual([
      ['card', 'Luis', '2 charges', 600],
      ['bank', 'Bank payments', '2 payments', 500],
      ['card', 'Shop card', '1 charge', 300],
    ])
    expect(members.reduce((t, m) => t + (m.cost ?? 0), 0)).toBeCloseTo(jobCost + 500, 2)
    expect(members.some((m) => m.name === 'Card charges not split')).toBe(false)
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

describe('scoreboardHeadline (v2.6467, punch list #250 PR 3)', () => {
  // An invented site: a paid job, a job with no percent (its earned is the assumed half), a job running at a loss,
  // a ticket with no price that is costing, and a job with nothing on it.
  const site = [
    job({ id: 'j10', status: 'paid', revenue: 120000 }),
    job({ id: 'j11', status: 'waiting', revenue: 300000 }),
    job({ id: 'j12', status: 'working', revenue: 90000, pct_complete: 50 }),
    job({ id: 'j13', status: 'working', revenue: 0 }),
    job({ id: 'j14', status: 'waiting', revenue: 0 }),
  ]
  const clock = (rows: Array<[string, number, number]>): SiteLaborRead => ({
    state: 'read',
    labor: { byJobId: new Map(rows.map(([id, hours, costUsd]) => [id, { jobId: id, hours, costUsd, days: 3, people: [] }])), siteDays: 9, people: 4, daysKnown: true },
  })
  const spend = (rows: Array<[string, number]>): SiteCostsRead => ({ state: 'read', byJobId: new Map(rows.map(([id, usd]) => [id, costRow(id, 0, usd, 0)])) })
  const none: SiteOverheadRead = { state: 'read', byJobId: new Map() }
  const full = (jobsIn: MemberJob[], l: SiteLaborRead, c: SiteCostsRead) => buildScoreboard({ jobs: jobsIn, invoices: [], jobLabel: label, labor: l, costs: c, overhead: none })
  const words = (h: ReturnType<typeof scoreboardHeadline>) => (h ? scoreboardHeadlineWords(h) : null)

  it('a job with no price that is costing comes first, the costliest of them, with its hours', () => {
    const model = full(site, clock([['j10', 400, 9000], ['j13', 31, 1200]]), spend([['j10', 61000], ['j12', 50000], ['j13', 3000]]))
    expect(words(scoreboardHeadline(model, true))).toBe('JP13 has no price yet: $4,200 spent over 31 h.')
    expect(scoreboardHeadline(model, true)).toMatchObject({ jobId: 'j13', label: 'JP13' })
    const noHours = full(site, clock([['j10', 400, 9000]]), spend([['j10', 61000], ['j13', 3000]]))
    expect(words(scoreboardHeadline(noHours, true))).toBe('JP13 has no price yet: $3,000 spent.')
  })

  it('else the job that carried the site, the most profit, leaving out an earned dollar that is the assumed half', () => {
    const model = full(site, clock([['j10', 400, 9000]]), spend([['j10', 61000], ['j11', 10000], ['j12', 50000]]))
    // j11's profit is the biggest, but half its price is assumed: j10 carried the site.
    expect(model.rows.find((r) => r.jobId === 'j11')!.m.profit).toBeGreaterThan(model.rows.find((r) => r.jobId === 'j10')!.m.profit)
    expect(words(scoreboardHeadline(model, true))).toBe('JP10 carried the site: $50,000 profit, 42% of what it earned.')
  })

  it('else the job that has cost the most past what it earned', () => {
    const losing = [job({ id: 'j20', status: 'working', revenue: 40000, pct_complete: 25 }), job({ id: 'j21', status: 'working', revenue: 10000, pct_complete: 50 })]
    const model = full(losing, clock([]), spend([['j20', 16000], ['j21', 5500]]))
    expect(words(scoreboardHeadline(model, true))).toBe('JP20 has cost $6,000 more than it earned.')
  })

  it('nothing until the reads it stands on are in, and nothing on a site with nothing on it', () => {
    const reading = buildScoreboard({ jobs: site, invoices: [], jobLabel: label, labor: clock([['j13', 31, 1200]]), costs: { state: 'reading' }, overhead: none })
    expect(scoreboardHeadline(reading, true)).toBeNull()
    const failed = buildScoreboard({ jobs: site, invoices: [], jobLabel: label, labor: clock([]), costs: { state: 'failed' }, overhead: none })
    expect(scoreboardHeadline(failed, true)).toBeNull()
    expect(scoreboardHeadline(full([job({ id: 'j30', status: 'waiting', revenue: 0 })], clock([]), spend([])), true)).toBeNull()
  })

  it('the leader’s board says no cost: a job with no price that has hours, else the job that earned the most', () => {
    const lead = (l: SiteLaborRead) => buildScoreboard({ jobs: site, invoices: [], jobLabel: label, labor: l })
    expect(words(scoreboardHeadline(lead(clock([['j10', 400, 0], ['j13', 31, 0]])), false))).toBe('JP13 has no price yet: 31 h on it.')
    const carried = lead(clock([['j10', 400, 0]]))
    expect(words(scoreboardHeadline(carried, false))).toBe(`JP10 carried the site: $120,000 earned, ${Math.round((120000 / carried.site.earned) * 100)}% of the site.`)
    expect(scoreboardHeadline(lead(clock([['j13', 31, 0]])), false)!.after).not.toContain('$')
    expect(scoreboardHeadline(buildScoreboard({ jobs: site, invoices: [], jobLabel: label, labor: { state: 'reading' } }), false)).toBeNull()
  })

  it('a job with hours on it is not folded under Nothing on them yet, though the leader’s board reads no cost', () => {
    const lead = buildScoreboard({ jobs: site, invoices: [], jobLabel: label, labor: clock([['j13', 31, 0]]) })
    expect(lead.rows.map((r) => r.jobId)).toContain('j13')
    expect(lead.empties.map((r) => r.jobId)).toEqual(['j14'])
    expect(lead.rows.find((r) => r.jobId === 'j13')).toMatchObject({ priced: false, empty: false })
    // and it wears *no price*, as its headline says, though that board reads no cost
    expect(lead.rows.find((r) => r.jobId === 'j13')!.flags).toContain('no-price')
    expect(lead.rows.find((r) => r.jobId === 'j10')).toMatchObject({ priced: true })
  })
})

describe('scoreboardCompactWords (v2.6457)', () => {
  it('money reads short as the phone strip reads it; hours and days stay whole; a loss keeps its sign', () => {
    expect(scoreboardCompactWords('earned', 2_437_520)).toBe('$2.4M')
    expect(scoreboardCompactWords('earned', 2_000_000)).toBe('$2M')
    expect(scoreboardCompactWords('earned', 12_400_000)).toBe('$12M')
    expect(scoreboardCompactWords('parts', 712_380)).toBe('$712k')
    expect(scoreboardCompactWords('overhead', 14_720)).toBe('$15k')
    expect(scoreboardCompactWords('labor', 9_380)).toBe('$9.4k')
    expect(scoreboardCompactWords('profit', -7_960)).toBe('−$8k')
    expect(scoreboardCompactWords('cost', 1_790)).toBe('$1.8k')
    expect(scoreboardCompactWords('cost', 999)).toBe('$999')
    expect(scoreboardCompactWords('profit', -26_840)).toBe('−$27k')
    expect(scoreboardCompactWords('profit', -214)).toBe('−$214')
    expect(scoreboardCompactWords('hours', 12_345)).toBe('12,345 h')
    expect(scoreboardCompactWords('days', 57)).toBe('57 d')
  })
})

describe('scoreboardColumnWidths (v2.6457)', () => {
  const pct = (w: string | undefined) => Number(String(w).replace('%', ''))
  it('the full board at whole dollars weights its columns: Profit the widest, Hours and Days the narrowest, all of it a hundred', () => {
    const cols = scoreboardColumnsFor(true)
    const { job, columns } = scoreboardColumnWidths(cols, false)
    const by = Object.fromEntries(cols.map((c, i) => [c.key, pct(columns[i])]))
    expect(job).toBe('25%')
    expect(by.profit).toBe(12)
    expect(by.hours).toBe(6.5)
    expect(by.days).toBe(6.5)
    expect(by.earned).toBeCloseTo(50 / 6, 2)
    expect(pct(job) + Object.values(by).reduce((a, b) => a + b, 0)).toBeCloseTo(100, 1)
  })
  it('without the days the money takes their room', () => {
    const cols = scoreboardColumnsFor(true, false)
    const { columns } = scoreboardColumnWidths(cols, false)
    expect(columns).toHaveLength(8)
    expect(25 + columns.reduce((a, w) => a + pct(w), 0)).toBeCloseTo(100, 1)
  })
  it('short money words share alike; the leader’s board gives the Job column nearly half', () => {
    expect(scoreboardColumnWidths(scoreboardColumnsFor(true), true)).toEqual({ job: '26%', columns: Array(9).fill(undefined) })
    expect(scoreboardColumnWidths(scoreboardColumnsFor(false), false)).toEqual({ job: '46%', columns: [undefined, undefined, undefined] })
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

describe('the window (v2.6558, punch list #250 PR 4)', () => {
  const day = (ymd: string, hours: number, costUsd: number) => ({ ymd, hours, costUsd })
  const windowed: SiteLaborRead = {
    state: 'read',
    labor: {
      byJobId: new Map([
        ['j612', { jobId: 'j612', hours: 100, costUsd: 3000, days: 3, people: [{ personName: 'Luis Ortega', personId: 'p1', userId: 'u1', hours: 60, costUsd: 1800, days: 2, leadDays: 2, byWorkDate: [day('2026-10-20', 20, 600), day('2026-11-02', 40, 1200)] }, { personName: 'Ana Reyes', personId: 'p2', userId: null, hours: 40, costUsd: 1200, days: 2, leadDays: 0, byWorkDate: [day('2026-11-02', 30, 900), day('2026-11-04', 10, 300)] }] }],
        ['j583', { jobId: 'j583', hours: 54, costUsd: 1296, days: 5, people: [{ personName: 'Luis Ortega', personId: 'p1', userId: 'u1', hours: 54, costUsd: 1296, days: 5, leadDays: 0, byWorkDate: [day('2026-09-01', 54, 1296)] }] }],
      ]),
      siteDays: 8,
      people: 2,
      daysKnown: true,
    },
  }
  const events = new Map([
    ['j612', [
      { source: 'sub_labor' as const, dateKey: '2026-11-03', amount: 4000, label: 'Reyes' },
      { source: 'sub_labor' as const, dateKey: '2026-10-01', amount: 14400, label: 'Reyes' },
      { source: 'supply_house' as const, dateKey: '2026-11-01', amount: 500, label: 'Ferguson' },
      { source: 'mercury_card' as const, dateKey: null, amount: 9100, label: 'Card' },
      { source: 'team_labor' as const, dateKey: '2026-11-02', amount: 999, label: 'Luis' },
    ]],
  ])
  const lines = (...days: Array<[string, number]>) => days.map(([ymd, shareUsd]) => ({ ymd, jobHours: 8, fieldHours: 8, poolUsd: 0, shareUsd }))
  const overheadDays: SiteOverheadRead = { state: 'read', byJobId: new Map([['j612', { usd: 14920, days: 118, lines: lines(['2026-10-20', 100], ['2026-11-02', 120], ['2026-11-04', 80]) }]]) }
  const nov = { from: '2026-11-01', to: '2026-11-05' }

  it('cuts hours, days and labor to the clock’s days inside the window, each day once across the people', () => {
    const m = buildScoreboard({ jobs, invoices: [], jobLabel: label, labor: windowed, costs, overhead: overheadDays, window: nov, chargeEvents: events })
    const j612 = m.rows.find((r) => r.jobId === 'j612')!
    expect(j612.m.hours).toBe(80)
    expect(j612.m.days).toBe(2)
    expect(j612.m.labor).toBe(2400)
    expect([...j612.dayKeys!]).toEqual(['2026-11-02', '2026-11-04'])
    // The other job's only day is outside: nothing on it, so it folds.
    expect(m.empties.map((r) => r.jobId)).toContain('j583')
    expect(m.site.days).toBe(2)
    expect(m.window).toEqual(nov)
  })
  it('sums subs and parts from the dated events inside the window; an undated charge and the clock’s own events stay out', () => {
    const m = buildScoreboard({ jobs, invoices: [], jobLabel: label, labor: windowed, costs, overhead: overheadDays, window: nov, chargeEvents: events })
    const j612 = m.rows.find((r) => r.jobId === 'j612')!
    expect(j612.m.subs).toBe(4000)
    expect(j612.m.parts).toBe(500)
    expect(j612.m.overhead).toBe(200)
    expect(j612.m.cost).toBe(2400 + 4000 + 500 + 200)
  })
  it('earns by the hours in the window as Job Summary does: a paid job earns its contract across its lifetime hours', () => {
    const m = buildScoreboard({ jobs, invoices: [], jobLabel: label, labor: windowed, costs, overhead: overheadDays, window: nov, chargeEvents: events })
    const j612 = m.rows.find((r) => r.jobId === 'j612')!
    // 80 of 100 lifetime hours in the window, on a paid job of $241,431.
    expect(j612.m.earned).toBe(Math.round(241431 * 0.8 * 100) / 100)
    expect(j612.flags).not.toContain('assumed-50')
    expect(j612.m.profit).toBe(Math.round((j612.m.earned - j612.m.cost) * 100) / 100)
  })
  it('without a window the measures are the whole life, and the days ride the rows for a part to count once', () => {
    const m = buildScoreboard({ jobs, invoices: [], jobLabel: label, labor: windowed, costs, overhead: overheadDays })
    const j612 = m.rows.find((r) => r.jobId === 'j612')!
    expect(j612.m).toMatchObject({ hours: 100, days: 3, labor: 3000, subs: 18400, overhead: 14920 })
    expect([...j612.dayKeys!].sort()).toEqual(['2026-10-20', '2026-11-02', '2026-11-04'])
    expect(m.window).toBeNull()
    // A read with no days rides no day keys.
    const plain = buildScoreboard({ jobs, invoices: [], jobLabel: label, labor, costs, overhead })
    expect(plain.rows.find((r) => r.jobId === 'j612')!.dayKeys).toBeNull()
  })
})
