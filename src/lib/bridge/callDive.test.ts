import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { DIVE_SHOWN, isSupplyMove, moveDive, type DiveFacts } from './callDive'

// Made-up customers, jobs and supply houses.
const facts: DiveFacts = {
  payers: [
    { key: 'p-alder', name: 'Alder Builders', lateUsd: 40_000, usd: 52_000, oldestAgeDays: 71 },
    { key: 'p-birch', name: 'Birch and Sons', lateUsd: 12_500, usd: 12_500, oldestAgeDays: 1 },
    { key: 'p-cedar', name: 'Cedar Homes', lateUsd: 0, usd: 9_000, oldestAgeDays: null },
    { key: 'p-dogwood', name: 'Dogwood Group', lateUsd: 3_000, usd: 3_000, oldestAgeDays: 40 },
    { key: 'Elm Street LLC', name: 'Elm Street LLC', lateUsd: 900, usd: 900, oldestAgeDays: 35 },
  ],
  billJobs: [
    { id: 'j201', label: '201 · Maple Lofts', usd: 18_000 },
    { id: 'j202', label: '202 · Oak Court', usd: 6_400 },
  ],
  noPctJobs: [
    { id: 'j301', label: '301 · Pine Row', revenueUsd: 30_000 },
    { id: 'j302', label: '302 · Spruce Hall', revenueUsd: null },
  ],
  noPriceJobs: [{ id: 'j401', label: '401 · Willow Walk' }],
  supplyBills: [
    { houseId: 'h-north', name: 'Northside Supply', usd: 7_200, dueYmd: '2026-03-04', bills: 4 },
    { houseId: null, name: 'Riverbend Pipe', usd: 1_100, dueYmd: null, bills: 1 },
  ],
  dayLabel: (ymd) => `d${ymd.slice(8)}`,
}
const jobsDoor = { to: '/jobs?tab=stages', label: 'Price the jobs' }

// An item without its to-do card, which `callTodo.test.ts` reads by itself, and without its cells.
const bareOne = <T extends object>(x: T): Omit<T, 'todo' | 'row'> => {
  const { todo: _todo, row: _row, ...rest } = x as T & { todo?: unknown; row?: unknown }
  return rest as Omit<T, 'todo' | 'row'>
}
const bare = <T extends { projects?: ReadonlyArray<object> }>(items: ReadonlyArray<T> | undefined) =>
  items?.map((i) => {
    const one = bareOne(i) as Record<string, unknown>
    return i.projects ? { ...one, projects: i.projects.map(bareOne) } : one
  })

describe('moveDive', () => {
  it('names the first customers to call and opens the Collect window', () => {
    const d = moveDive({ key: 'chase', title: 'Chase the 9 late invoices.', door: null }, facts)
    expect(bare(d?.items.slice(0, 3))).toEqual([
      { title: 'Alder Builders', detail: '$40.0k late. Oldest bill 71 days.', target: { kind: 'desk', stage: 'collect', payerKey: 'p-alder' } },
      { title: 'Birch and Sons', detail: '$12.5k late. Oldest bill 1 day.', target: { kind: 'desk', stage: 'collect', payerKey: 'p-birch' } },
      { title: 'Cedar Homes', detail: '$9.0k open.', target: { kind: 'desk', stage: 'collect', payerKey: 'p-cedar' } },
    ])
    // Every customer is handed over; the row draws the first few and the rest on a press.
    expect(d?.items.length).toBe(5)
    expect(d?.shown).toBe(DIVE_SHOWN)
    expect(d?.press).toBe('See who to call')
    expect(d?.target).toEqual({ kind: 'desk', stage: 'collect' })
  })

  it('says what each customer promised, and opens to their projects with a press that sets a pay date', () => {
    const withWords: DiveFacts = {
      ...facts,
      payers: [
        {
          key: 'p-alder',
          name: 'Alder Builders',
          lateUsd: 40_000,
          usd: 52_000,
          oldestAgeDays: 71,
          promise: { state: 'broken', ymd: '2026-03-01' },
          projects: [
            { key: 'inv:1', jobId: 'j201', label: '201 · Maple Lofts', usd: 30_000, ageDays: 71, broken: true, promisedYmd: '2026-03-01', promisedBy: 'Dana' },
            { key: 'inv:2', jobId: 'j202', label: '202 · Oak Court', usd: 22_000, ageDays: 12, broken: false, promisedYmd: null, promisedBy: null },
            { key: 'inv:3', jobId: null, label: 'A bill with no job', usd: 500, ageDays: null, broken: false, promisedYmd: null, promisedBy: null },
          ],
        },
        { key: 'p-birch', name: 'Birch and Sons', lateUsd: 12_500, usd: 12_500, oldestAgeDays: 9, promise: { state: 'promised', ymd: '2026-03-20' }, projects: [{ key: 'inv:4', jobId: 'j301', label: '301 · Pine Row', usd: 12_500, ageDays: 9, broken: false, promisedYmd: '2026-03-20', promisedBy: 'Dana' }] },
        { key: 'p-cedar', name: 'Cedar Homes', lateUsd: 0, usd: 9_000, oldestAgeDays: null, promise: { state: 'none', ymd: null } },
      ],
    }
    const d = moveDive({ key: 'chase', title: 'Chase the 3 late invoices.', door: null }, withWords)
    expect(d?.items.map((i) => i.detail)).toEqual(['$40.0k late. Oldest bill 71 days. They said d01. That day has passed.', '$12.5k late. Oldest bill 9 days. They said d20.', '$9.0k open. No pay date yet.'])
    expect(bare(d?.items)?.[0]?.projects).toEqual([
      {
        key: 'inv:1',
        title: '201 · Maple Lofts',
        detail: '$30.0k owed. Billed 71 days ago. They said d01. That day has passed.',
        press: { label: 'Change the pay date', target: { kind: 'promise', jobId: 'j201', jobLabel: 'Alder Builders · 201 · Maple Lofts', ymd: '2026-03-01', context: '$30.0k owed. Billed 71 days ago.' } },
      },
      {
        key: 'inv:2',
        title: '202 · Oak Court',
        detail: '$22.0k owed. Billed 12 days ago. No pay date yet.',
        press: { label: 'Set a pay date', target: { kind: 'promise', jobId: 'j202', jobLabel: 'Alder Builders · 202 · Oak Court', ymd: null, context: '$22.0k owed. Billed 12 days ago.' } },
      },
      // A bill with no job has nothing for the sheet to write to.
      { key: 'inv:3', title: 'A bill with no job', detail: '$500 owed. No pay date yet.', press: null },
    ])
    expect(d?.items[1]?.projects?.[0]?.detail).toBe('$12.5k owed. Billed 9 days ago. They said d20, written down by Dana.')
    // A customer with no projects handed in does not open.
    expect(d?.items[2]?.projects).toBeUndefined()
    for (const i of d?.items ?? []) {
      expect(plainWordsFailures(i.detail)).toEqual([])
      for (const p of i.projects ?? []) expect(plainWordsFailures(p.detail)).toEqual([])
    }
  })

  it('names the finished jobs and opens the Bill window, with no "more" when all are shown', () => {
    const d = moveDive({ key: 'bill', title: 'Bill the 2 finished jobs.', door: null }, facts)
    expect(bare(d?.items)).toEqual([
      { title: '201 · Maple Lofts', detail: '$18.0k finished, not billed.', target: { kind: 'page', to: '/jobs?tab=stages&edit=j201' } },
      { title: '202 · Oak Court', detail: '$6.4k finished, not billed.', target: { kind: 'page', to: '/jobs?tab=stages&edit=j202' } },
    ])
    expect(d?.target).toEqual({ kind: 'desk', stage: 'bill' })
  })

  it('names the jobs with no percent or no price, each a press to that job, with no press to a page', () => {
    const pct = moveDive({ key: 'pct', title: 'Set a percent on the 2 jobs without one.', door: jobsDoor }, facts)
    expect(bare(pct?.items)).toEqual([
      { title: '301 · Pine Row', detail: '$30.0k contract. No percent set.', target: { kind: 'page', to: '/jobs?tab=stages&edit=j301' } },
      { title: '302 · Spruce Hall', detail: 'No percent set.', target: { kind: 'page', to: '/jobs?tab=stages&edit=j302' } },
    ])
    // The Jobs page would add nothing: each job acts by itself.
    expect(pct?.press).toBeNull()
    expect(pct?.target).toBeNull()
    const price = moveDive({ key: 'price', title: 'Price the 1 job with no price.', door: jobsDoor }, facts)
    expect(bare(price?.items)).toEqual([{ title: '401 · Willow Walk', detail: 'No price set.', target: { kind: 'page', to: '/jobs?tab=stages&edit=j401' } }])
    expect(price?.press).toBeNull()
  })

  it('gives a job its own Set the percent when the page can hand the percent window that job', () => {
    const pctJob = { id: 'j301', hcpNumber: '301', jobName: 'Pine Row', label: '301 · Pine Row' }
    const withJob: DiveFacts = { ...facts, noPctJobs: [{ id: 'j301', label: '301 · Pine Row', revenueUsd: 30_000, pctJob }, { id: 'j302', label: '302 · Spruce Hall', revenueUsd: null, pctJob: null }] }
    const d = moveDive({ key: 'pct', title: 'Set a percent on the 2 jobs without one.', door: null }, withJob)
    expect(d?.items[0]?.press).toEqual({ label: 'Set the percent', target: { kind: 'pct', job: pctJob } })
    // A job the window cannot take keeps its press to the job itself, and no second one.
    expect(d?.items[1]?.press).toBeUndefined()
    expect(d?.items[1]?.target).toEqual({ kind: 'page', to: '/jobs?tab=stages&edit=j302' })
    // A job set on this visit stays where it was and says so.
    const set = moveDive({ key: 'pct', title: '', door: null }, { ...withJob, noPctJobs: [{ id: 'j301', label: '301 · Pine Row', revenueUsd: 30_000, pctJob, setPct: 60 }] })
    expect(set?.items[0]).toMatchObject({ detail: '$30.0k contract. Set to 60% just now.', press: { label: 'Change the percent' } })
    expect(plainWordsFailures(set?.items[0]?.detail ?? '')).toEqual([])
  })

  it('gives the hours a press and no list', () => {
    expect(moveDive({ key: 'approve', title: 'Approve the 40 hours waiting.', door: { to: '/people?tab=hours&approvals=1', label: 'Approve' } }, facts)).toEqual({ items: [], shown: DIVE_SHOWN, press: 'Open approvals', target: { kind: 'page', to: '/people?tab=hours&approvals=1' } })
  })

  it('names the supply bills behind the cash call’s ask and opens Money', () => {
    const move = { key: 'other' as const, title: 'Ask the supply houses for more days.', door: null }
    expect(isSupplyMove(move)).toBe(true)
    const d = moveDive(move, facts)
    expect(bare(d?.items)).toEqual([
      { title: 'Northside Supply', detail: '$7.2k due d04, on 4 bills.', target: { kind: 'page', to: '/materials?tab=supply-houses&house=h-north&due=2026-03-04' } },
      // A house with no id on its bill falls back to the bills behind Money.
      { title: 'Riverbend Pipe', detail: '$1.1k.', target: { kind: 'money' } },
    ])
    expect(d?.press).toBe('See the bills')
    expect(d?.target).toEqual({ kind: 'money' })
  })

  it('hands each line its facts as cells under the move’s headings, with a unit for a phone', () => {
    const withWords: DiveFacts = {
      ...facts,
      payers: [
        { key: 'p-alder', name: 'Alder Builders', lateUsd: 40_000, usd: 52_000, oldestAgeDays: 71, promise: { state: 'broken', ymd: '2026-03-01' }, projects: [{ key: 'inv:1', jobId: 'j201', label: '201 · Maple Lofts', usd: 30_000, ageDays: 71, broken: false, promisedYmd: '2026-03-20', promisedBy: 'Dana' }] },
        { key: 'p-cedar', name: 'Cedar Homes', lateUsd: 0, usd: 9_000, oldestAgeDays: null, promise: { state: 'none', ymd: null } },
      ],
    }
    const chase = moveDive({ key: 'chase', title: '', door: null }, withWords)
    expect(chase?.columns).toEqual({ name: 'Customer', a: 'Late', b: 'Oldest bill', text: 'Pay date' })
    expect(chase?.items[0]?.row).toEqual({ a: { text: '$40.0k', phone: '$40.0k late' }, b: { text: '71 days', phone: 'oldest bill 71 days', muted: true }, text: { text: 'Said d01, passed', warn: true } })
    // Nothing late yet: what is open is said as open, so the heading does not call it late.
    expect(chase?.items[1]?.row).toEqual({ a: { text: '$9.0k open', muted: true }, b: undefined, text: { text: 'None yet', muted: true } })
    expect(chase?.items[0]?.projects?.[0]?.row).toEqual({ a: { text: '$30.0k', phone: '$30.0k owed' }, b: { text: '71 days', phone: 'billed 71 days ago', muted: true }, text: { text: 'Said d20' } })
    const bill = moveDive({ key: 'bill', title: '', door: null }, facts)
    expect(bill?.columns).toEqual({ name: 'Job', a: 'To bill', b: '', text: '' })
    expect(bill?.items[0]?.row).toEqual({ a: { text: '$18.0k', phone: '$18.0k to bill' } })
    const pct = moveDive({ key: 'pct', title: '', door: null }, { ...facts, noPctJobs: [{ id: 'j301', label: '301 · Pine Row', revenueUsd: 30_000 }, { id: 'j302', label: '302 · Spruce Hall', revenueUsd: null, setPct: 60 }] })
    expect(pct?.columns).toEqual({ name: 'Job', a: 'Hours', b: 'Contract', text: 'Worked by' })
    expect(pct?.items[0]?.row).toEqual({ b: { text: '$30.0k', phone: '$30.0k contract', muted: true } })
    // A job with no price says so where the contract would be, never $0 and never a blank.
    expect(pct?.items[1]?.row).toEqual({ b: { text: 'No price', phone: 'No price yet', warn: true }, text: { text: 'Set to 60% just now' } })
    const supply = moveDive({ key: 'other', title: 'Ask the supply houses for more days.', door: null }, facts)
    expect(supply?.columns).toEqual({ name: 'Supply house', a: 'Due', b: 'Bills', text: 'Due day' })
    expect(supply?.items[0]?.row).toEqual({ a: { text: '$7.2k', phone: '$7.2k due' }, b: { text: '4', phone: '4 bills', muted: true }, text: { text: 'd04' } })
    expect(supply?.items[1]?.row).toEqual({ a: { text: '$1.1k', phone: '$1.1k due' }, b: { text: '1', phone: '1 bill', muted: true } })
  })

  it('says a job’s hours and who worked them, as a cell that opens the detail (#334, PR 10)', () => {
    const pctJob = { id: 'j301', hcpNumber: '301', jobName: 'Pine Row', label: '301 · Pine Row' }
    const withHours: DiveFacts = {
      ...facts,
      noPctJobs: [
        { id: 'j301', label: '301 · Pine Row', revenueUsd: 30_000, pctJob, hoursLine: '24 hours by Dana and Sam', hoursCell: { text: '24', phone: '24 hours', by: 'Dana and Sam' } },
        { id: 'j302', label: '302 · Spruce Hall', revenueUsd: null, hoursLine: 'No hours yet', hoursCell: { text: '0', phone: 'No hours yet', by: '' } },
        { id: 'j303', label: '303 · Fir Lane', revenueUsd: null, pctJob, setPct: 40, hoursLine: '8 hours by Lee', hoursCell: { text: '8', phone: '8 hours', by: 'Lee' } },
      ],
    }
    const d = moveDive({ key: 'pct', title: '', door: null }, withHours)
    const hours = { kind: 'hours', jobId: 'j301', jobLabel: '301 · Pine Row', pctJob }
    expect(d?.items[0]?.row).toEqual({ a: { text: '24', phone: '24 hours', target: hours, label: 'See the hours on 301 · Pine Row: 24 hours by Dana and Sam' }, b: { text: '$30.0k', phone: '$30.0k contract', muted: true }, text: { text: 'Dana and Sam', muted: true } })
    // No hours yet: the cell still opens the window, which says so. A job the percent window cannot take hands it none.
    expect(d?.items[1]?.row).toEqual({ a: { text: '0', phone: 'No hours yet', target: { kind: 'hours', jobId: 'j302', jobLabel: '302 · Spruce Hall', pctJob: null }, label: 'See the hours on 302 · Spruce Hall: No hours yet' }, b: { text: 'No price', phone: 'No price yet', warn: true } })
    // A percent set on this visit says so where the people were.
    expect(d?.items[2]?.row?.text).toEqual({ text: 'Set to 40% just now' })
  })

  it('says the last day a job was worked, by whom and from which reading, once that is read (v2.7221)', () => {
    const hoursCell = { text: '24', phone: '24 hours', by: 'Dana and Sam' }
    const d = moveDive(
      { key: 'pct', title: '', door: null },
      {
        ...facts,
        noPctJobs: [
          { id: 'j301', label: '301 · Pine Row', revenueUsd: 30_000, hoursLine: '24 hours by Dana and Sam', hoursCell, lastWorked: { text: 'Mar 5, 5 days ago', phone: 'Last worked Mar 5, 5 days ago', sub: 'Dana and Sam', muted: false }, address: '14 Pine Row, Cedar Falls' },
          { id: 'j302', label: '302 · Spruce Hall', revenueUsd: null, lastWorked: { text: 'Not worked yet', phone: 'Not worked yet', sub: 'Next scheduled Mar 18', muted: true } },
          // Set to 0% on this visit: it still has no percent, so it stays, and says what was set.
          { id: 'j303', label: '303 · Fir Lane', revenueUsd: 500, setPct: 0, lastWorked: { text: 'Mar 6, 4 days ago', phone: 'Last worked Mar 6, 4 days ago', sub: 'Scheduled for Ana', muted: false } },
        ],
      },
    )
    // The heading follows the cell: the day leads, where the people with hours stood.
    expect(d?.columns).toEqual({ name: 'Job', a: 'Hours', b: 'Contract', text: 'Last worked' })
    // The day and how long ago, with the people as soft words under it (v2.7245).
    expect(d?.items[0]?.row?.text).toEqual({ text: 'Mar 5, 5 days ago', phone: 'Last worked Mar 5, 5 days ago', sub: 'Dana and Sam' })
    expect(d?.items[1]?.row).toEqual({ b: { text: 'No price', phone: 'No price yet', warn: true }, text: { text: 'Not worked yet', phone: 'Not worked yet', sub: 'Next scheduled Mar 18', muted: true } })
    expect(d?.items[2]?.row?.text).toEqual({ text: 'Set to 0% just now' })
    // Where the job is sits under its name (v2.7232). A job with no address has no such line.
    expect(d?.items.map((i) => i.sub)).toEqual(['14 Pine Row, Cedar Falls', undefined, undefined])
    // A job with no price says where it is the same way (v2.7243), and its to-do card is the one it had.
    const price = moveDive({ key: 'price', title: '', door: null }, { ...facts, noPriceJobs: [{ id: 'j401', label: '401 · Willow Walk', address: '7 Willow Walk, Cedar Falls' }, { id: 'j402', label: '402 · Alder Yard', address: null }] })
    expect(price?.items.map((i) => i.sub)).toEqual(['7 Willow Walk, Cedar Falls', undefined])
    expect(price?.items[0]?.todo?.key).toBe('price.j401')
  })

  it('hands every named thing a to-do card of its own', () => {
    const chase = moveDive({ key: 'chase', title: 'Chase the 9 late invoices.', door: null }, facts)
    expect(chase?.items[0]?.todo?.title).toBe('Call Alder Builders about $40.0k late. Get a pay date for each bill.')
    expect(moveDive({ key: 'bill', title: '', door: null }, facts)?.items[0]?.todo?.title).toBe('Bill 201 · Maple Lofts. $18.0k is finished and not billed.')
    expect(moveDive({ key: 'pct', title: '', door: null }, facts)?.items[0]?.todo?.title).toBe('Set the percent done on 301 · Pine Row. It is a $30.0k contract.')
    expect(moveDive({ key: 'price', title: '', door: null }, facts)?.items[0]?.todo?.title).toBe('Put a price on 401 · Willow Walk. Its hours earn nothing until then.')
    expect(moveDive({ key: 'other', title: 'Ask the supply houses for more days.', door: null }, facts)?.items[0]?.todo).toMatchObject({ title: 'Ask Northside Supply for more days on $7.2k due d04, on 4 bills.', paths: ['/materials?tab=supply-houses&house=h-north&due=2026-03-04'] })
    // A job whose percent was set on this visit needs no card.
    expect(moveDive({ key: 'pct', title: '', door: null }, { ...facts, noPctJobs: [{ id: 'j301', label: '301 · Pine Row', revenueUsd: 30_000, setPct: 60 }] })?.items[0]?.todo).toBeUndefined()
  })

  it('leaves a move alone when there is nothing to name and nowhere to send', () => {
    expect(moveDive({ key: 'other', title: 'Walk the two biggest jobs.', door: null }, facts)).toBeNull()
    expect(moveDive({ key: 'pct', title: 'Set a percent on the 2 jobs without one.', door: null }, { ...facts, noPctJobs: [] })).toBeNull()
    expect(moveDive({ key: 'price', title: 'Price the 1 job with no price.', door: null }, { ...facts, noPriceJobs: [] })).toBeNull()
    expect(moveDive({ key: 'chase', title: 'Chase the late invoices.', door: null }, null)).toBeNull()
  })

  it('keeps every line plain', () => {
    const moves = [
      { key: 'chase' as const, title: '', door: null },
      { key: 'bill' as const, title: '', door: null },
      { key: 'pct' as const, title: '', door: jobsDoor },
      { key: 'price' as const, title: '', door: jobsDoor },
      { key: 'other' as const, title: 'Ask the supply houses for more days.', door: null },
    ]
    for (const m of moves) for (const item of moveDive(m, facts)?.items ?? []) expect(plainWordsFailures(item.detail)).toEqual([])
  })
})
