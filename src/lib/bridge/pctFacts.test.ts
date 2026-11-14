import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { jobHoursByJob, type JobHoursSession } from './jobHours'
import { PCT_FACTS_LINES_SHOWN, buildPctFacts, chargeCell, lastWorkedCell, lineUsd, pctFactsRows, pctRunAfterSave, pctRunPlace, shownLines, streetAndCity, usdWords, type PctFactsRead } from './pctFacts'

// Made-up people on made-up jobs.
const dayLabel = (ymd: string): string => `Mar ${Number(ymd.slice(8))}`
const TODAY = '2026-03-10'
const s = (over: Partial<JobHoursSession>): JobHoursSession => ({ jobId: 'j1', userId: 'u1', name: 'Dana Reyes', ymd: '2026-03-02', hours: 8, approved: true, ...over })
const hours = jobHoursByJob([
  s({ ymd: '2026-03-02', hours: 8 }),
  s({ ymd: '2026-03-05', hours: 3 }),
  s({ userId: 'u2', name: 'Sam Holt', ymd: '2026-03-05', hours: 6, approved: false }),
  // j2: clocked once, long before the schedule's last day.
  s({ jobId: 'j2', userId: 'u3', name: 'Lee Park', ymd: '2026-02-20', hours: 4 }),
])
const line = (over: Partial<PctFactsRead['lines'][number]>): PctFactsRead['lines'][number] => ({ jobId: 'j1', id: 'l1', name: 'Rough in', count: 1, unitPrice: 4000, lineKind: 'work', invoiceId: null, sequence: 0, ...over })
const read: PctFactsRead = {
  lines: [
    line({ id: 'l2', name: 'Top out', unitPrice: 3000, sequence: 1, invoiceId: 'i2' }),
    line({ id: 'l1', name: 'Rough in', unitPrice: 4000, sequence: 0, invoiceId: 'i1' }),
    line({ id: 'l3', name: 'Fixtures', count: 12, unitPrice: 250, sequence: 2 }),
    line({ id: 'l4', name: 'Good neighbour', unitPrice: -500, lineKind: 'discount', count: 0, sequence: 3 }),
    // A row with no name is not a line of the job.
    line({ id: 'l5', name: '  ', unitPrice: 999, sequence: 4 }),
    line({ jobId: 'j2', id: 'l6', name: 'Camera the line', unitPrice: null }),
  ],
  blocks: [
    // j1: on the schedule the day before the last clocked day, and twice ahead.
    { jobId: 'j1', userId: 'u1', name: 'Dana Reyes', ymd: '2026-03-04' },
    { jobId: 'j1', userId: 'u2', name: 'Sam Holt', ymd: '2026-03-12' },
    { jobId: 'j1', userId: 'u1', name: 'Dana Reyes', ymd: '2026-03-12' },
    { jobId: 'j1', userId: 'u1', name: 'Dana Reyes', ymd: '2026-03-16' },
    // j2: the schedule's last day is newer than its clock, and today is on it too.
    { jobId: 'j2', userId: 'u3', name: 'Lee Park', ymd: '2026-03-06' },
    { jobId: 'j2', userId: 'u4', name: 'Ana Ruiz', ymd: '2026-03-06' },
    { jobId: 'j2', userId: 'u3', name: 'Lee Park', ymd: '2026-03-06' },
    { jobId: 'j2', userId: 'u3', name: 'Lee Park', ymd: TODAY },
    // j4: only ahead.
    { jobId: 'j4', userId: 'u4', name: 'Ana Ruiz', ymd: '2026-03-18' },
  ],
  invoices: [
    { jobId: 'j1', id: 'i1', usd: 4000, status: 'paid' },
    // Marked ready and not sent: it has not gone out.
    { jobId: 'j1', id: 'i2', usd: 3000, status: 'ready_to_bill' },
  ],
  events: [
    { jobId: 'j1', pct: 30, at: '2026-02-01T15:00:00Z', ymd: '2026-02-01' },
    { jobId: 'j1', pct: 0, at: '2026-03-01T15:00:00Z', ymd: '2026-03-01' },
  ],
  addresses: [
    { jobId: 'j1', address: '14 Pine Row, Cedar Falls, TX 78000' },
    { jobId: 'j2', address: '9 Spruce Hall Lane Cedar Falls TX 78000' },
    { jobId: 'j3', address: null },
  ],
}
const jobs = [
  { id: 'j1', revenueUsd: 9500 },
  { id: 'j2', revenueUsd: null },
  { id: 'j3', revenueUsd: 0 },
  { id: 'j4', revenueUsd: 1200 },
]
const facts = buildPctFacts({ jobs, hours, read, todayYmd: TODAY })
const j1 = facts.get('j1')!
const j2 = facts.get('j2')!
const j3 = facts.get('j3')!
const j4 = facts.get('j4')!

describe('what a percent is judged from', () => {
  it('says where a job is by its street and city, with no state and no zip', () => {
    expect(j1.address).toBe('14 Pine Row, Cedar Falls')
    expect(j2.address).toBe('9 Spruce Hall Lane Cedar Falls')
    // No address on the job, and a job the read brought nothing for.
    expect(j3.address).toBe('')
    expect(j4.address).toBe('')
    expect(streetAndCity('14 Pine Row, Cedar Falls, TX')).toBe('14 Pine Row, Cedar Falls')
    expect(streetAndCity('14 Pine Row, Cedar Falls, Texas 78000-1234')).toBe('14 Pine Row, Cedar Falls')
    expect(streetAndCity('14 Pine Row, Cedar Falls, TX 78000, USA')).toBe('14 Pine Row, Cedar Falls')
    expect(streetAndCity('  14 Pine Row, Cedar Falls, tx 78000 Null ')).toBe('14 Pine Row, Cedar Falls')
    expect(streetAndCity('14 Pine Row, Cedar Falls 78000')).toBe('14 Pine Row, Cedar Falls')
    // A quarter of town is not a state: NE stays where no zip stood behind it, and so does a street's last word.
    expect(streetAndCity('12 Main St NE')).toBe('12 Main St NE')
    expect(streetAndCity('12 Main St')).toBe('12 Main St')
    expect(streetAndCity('12 County Road 40')).toBe('12 County Road 40')
    // Nothing but a state or a zip comes back as stored, never empty.
    expect(streetAndCity('TX 78000')).toBe('TX 78000')
    expect(streetAndCity('78000')).toBe('78000')
    expect(streetAndCity('')).toBe('')
  })

  it('prices a line as the job’s total does: a count of nothing is one, and a discount is one line', () => {
    expect(lineUsd({ count: 12, unitPrice: 250, lineKind: 'work' })).toBe(3000)
    expect(lineUsd({ count: 0, unitPrice: 4000, lineKind: 'work' })).toBe(4000)
    expect(lineUsd({ count: 3, unitPrice: -500, lineKind: 'discount' })).toBe(-500)
    expect(lineUsd({ count: 1, unitPrice: null, lineKind: 'work' })).toBeNull()
  })

  it('lists a job’s named lines in their order, each with its amount and whether its bill went out', () => {
    expect(j1.lines).toEqual([
      { key: 'l1', name: 'Rough in', usd: 4000, billed: true },
      // Its bill is only marked ready.
      { key: 'l2', name: 'Top out', usd: 3000, billed: false },
      { key: 'l3', name: 'Fixtures', usd: 3000, billed: false },
      { key: 'l4', name: 'Good neighbour', usd: -500, billed: false },
    ])
    expect(j2.lines).toEqual([{ key: 'l6', name: 'Camera the line', usd: null, billed: false }])
    expect(j3.lines).toEqual([])
  })

  it('says what we are charging, and never $0 for a job with no price', () => {
    expect(j1.chargeUsd).toBe(9500)
    expect(j2.chargeUsd).toBeNull()
    expect(j3.chargeUsd).toBeNull()
    expect(chargeCell(j1)).toEqual({ text: '$9.5k', phone: '$9.5k contract', warn: false })
    expect(chargeCell(j3)).toEqual({ text: 'No price', phone: 'No price yet', warn: true })
    expect(j1.billedUsd).toBe(4000)
    expect(j2.billedUsd).toBe(0)
  })

  it('takes the newest of the clock and the schedule for last worked, and says which', () => {
    // Clocked Mar 5, scheduled Mar 4: the clock is newer. Both people that day, the most hours first.
    expect(j1.lastWorked).toEqual({ ymd: '2026-03-05', source: 'clocked', people: ['Sam Holt', 'Dana Reyes'] })
    // Clocked Feb 20, on the schedule Mar 6: the schedule is newer. Each person once.
    expect(j2.lastWorked).toEqual({ ymd: '2026-03-06', source: 'scheduled', people: ['Ana Ruiz', 'Lee Park'] })
    expect(j3.lastWorked).toBeNull()
    // A day both name is a clocked day.
    const same = buildPctFacts({ jobs: [{ id: 'j1', revenueUsd: 1 }], hours, read: { ...read, blocks: [{ jobId: 'j1', userId: 'u9', name: 'Kit Moss', ymd: '2026-03-05' }] }, todayYmd: TODAY })
    expect(same.get('j1')!.lastWorked?.source).toBe('clocked')
  })

  it('never calls a day still to come last worked: it is the next scheduled day', () => {
    expect(j4.lastWorked).toBeNull()
    expect(j4.nextScheduled).toEqual({ ymd: '2026-03-18', people: ['Ana Ruiz'] })
    expect(j1.nextScheduled).toEqual({ ymd: '2026-03-12', people: ['Dana Reyes', 'Sam Holt'] })
    // Today on the schedule is still to come.
    expect(j2.nextScheduled).toEqual({ ymd: TODAY, people: ['Lee Park'] })
    expect(j3.nextScheduled).toBeNull()
  })

  it('keeps the newest percent written down', () => {
    expect(j1.lastPct).toEqual({ pct: 0, ymd: '2026-03-01' })
    expect(j2.lastPct).toBeNull()
  })

  it('works with the hours not read yet', () => {
    const bare = buildPctFacts({ jobs, hours: null, read, todayYmd: TODAY })
    expect(bare.get('j1')!.lastWorked).toEqual({ ymd: '2026-03-04', source: 'scheduled', people: ['Dana Reyes'] })
    expect(bare.get('j1')!.hoursLine).toBe('No hours yet')
  })
})

describe('the words', () => {
  it('writes the row’s cell: the day, the reading, and who', () => {
    expect(lastWorkedCell(j1, TODAY, dayLabel)).toEqual({ text: 'Mar 5, clocked · Sam and Dana', phone: 'Last clocked Mar 5 · Sam and Dana', muted: false })
    expect(lastWorkedCell(j2, TODAY, dayLabel)).toEqual({ text: 'Mar 6, scheduled · Ana and Lee', phone: 'Last scheduled Mar 6 · Ana and Lee', muted: false })
    expect(lastWorkedCell(j3, TODAY, dayLabel)).toEqual({ text: 'Not worked yet', phone: 'Not worked yet', muted: true })
    expect(lastWorkedCell(j4, TODAY, dayLabel).text).toBe('Not worked yet · next Mar 18')
    expect(lastWorkedCell({ lastWorked: null, nextScheduled: { ymd: TODAY, people: [] } }, TODAY, dayLabel).text).toBe('Not worked yet · scheduled today')
  })

  it('writes the facts beside the percent control, the money first', () => {
    expect(pctFactsRows(j1, TODAY, dayLabel)).toEqual([
      { key: 'address', label: 'Address', words: '14 Pine Row, Cedar Falls' },
      { key: 'charge', label: 'We are charging', words: '$9,500' },
      { key: 'billed', label: 'Billed so far', words: '$4,000 of $9,500' },
      { key: 'worked', label: 'Last worked', words: 'Mar 5. Clocked by Sam and Dana.' },
      { key: 'next', label: 'Next scheduled', words: 'Mar 12, for Dana and Sam.' },
      { key: 'hours', label: 'Hours so far', words: '11 hours by Dana and Sam.' },
      { key: 'last-pct', label: 'Last percent', words: '0%, set Mar 1.' },
    ])
    expect(pctFactsRows(j2, TODAY, dayLabel)).toEqual([
      { key: 'address', label: 'Address', words: '9 Spruce Hall Lane Cedar Falls' },
      { key: 'charge', label: 'We are charging', words: 'No price yet. It is also on the list “Price the jobs with no price”.', warn: true },
      { key: 'worked', label: 'Last worked', words: 'Mar 6. On the schedule for Ana and Lee, with no clock time since.' },
      { key: 'next', label: 'Next scheduled', words: 'Today, for Lee.' },
      { key: 'hours', label: 'Hours so far', words: '4 hours by Lee.' },
    ])
    expect(pctFactsRows(j3, TODAY, dayLabel).map((r) => r.words)).toEqual(['The job has no address yet.', 'No price yet. It is also on the list “Price the jobs with no price”.', 'Not worked yet.', 'No hours yet.'])
  })

  it('passes the plain-words rule', () => {
    // An address is the job's own, not a sentence of ours.
    for (const f of [j1, j2, j3, j4]) for (const r of pctFactsRows(f, TODAY, dayLabel)) if (r.key !== 'address' || r.warn) expect(plainWordsFailures(r.words), r.words).toEqual([])
  })

  it('writes whole dollars with commas', () => {
    expect(usdWords(12400.4)).toBe('$12,400')
    expect(usdWords(-500)).toBe('−$500')
  })

  it('shows the first few lines and counts the rest', () => {
    const many = Array.from({ length: PCT_FACTS_LINES_SHOWN + 3 }, (_, i) => ({ key: `l${i}`, name: `Line ${i}`, usd: 100, billed: false }))
    expect(shownLines(many, false)).toMatchObject({ more: 3 })
    expect(shownLines(many, false).shown.length).toBe(PCT_FACTS_LINES_SHOWN)
    expect(shownLines(many, true)).toMatchObject({ more: 0 })
    expect(shownLines(many.slice(0, PCT_FACTS_LINES_SHOWN), false)).toMatchObject({ more: 0 })
  })
})

describe('going down the list', () => {
  const run = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

  it('says where a job stands and what is either side', () => {
    expect(pctRunPlace(run, 'a')).toEqual({ index: 0, count: 3, prev: null, next: { id: 'b' } })
    expect(pctRunPlace(run, 'c')).toEqual({ index: 2, count: 3, prev: { id: 'b' }, next: null })
    expect(pctRunPlace(run, 'z')).toEqual({ index: -1, count: 3, prev: null, next: null })
  })

  it('moves to the next job not set yet after a save, then back to one skipped, then stops', () => {
    expect(pctRunAfterSave(run, 'a', new Set(['a']))).toEqual({ id: 'b' })
    // b was skipped: after c, the run comes back to it.
    expect(pctRunAfterSave(run, 'c', new Set(['a', 'c']))).toEqual({ id: 'b' })
    expect(pctRunAfterSave(run, 'b', new Set(['a', 'b', 'c']))).toBeNull()
    expect(pctRunAfterSave([{ id: 'a' }], 'a', new Set(['a']))).toBeNull()
  })
})
