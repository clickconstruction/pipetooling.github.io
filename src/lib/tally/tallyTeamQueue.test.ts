import { describe, expect, it } from 'vitest'
import type { CardChargeWindowRow } from '../banking/cardChargesWindow'
import type { StaleStaffRow } from './teamPurchaseRows'
import {
  buildTallyTeamQueue,
  tallyCategoryFromRaw,
  tallyChargeMadeAt,
  tallyThroughDate,
  type TallyQueueScheduleRow,
  type TallyQueueSessionRow,
} from './tallyTeamQueue'

// Made-up holders, stores and jobs. Chicago daylight time.
const at = (ymd: string, hm: string) => `${ymd}T${hm}:00-05:00`
const NOW = Date.parse(at('2026-09-30', '17:00'))

const staff = (p: Partial<StaleStaffRow> & { id: string; holder: string; name: string; ymd: string; hm: string; amount: number; store: string; cat?: string; postedYmd?: string; postedHm?: string; noSwipeTime?: boolean }): StaleStaffRow =>
  ({
    target_user_id: p.holder,
    target_name: p.name,
    target_email: '',
    target_phone: '',
    mercury_transaction_id: p.id,
    posted_at: at(p.postedYmd ?? p.ymd, p.postedHm ?? p.hm),
    amount: p.amount,
    counterparty_name: p.store,
    note: '',
    mercury_account_id: 'acct',
    currency: 'USD',
    mercury_id: `m-${p.id}`,
    raw: { ...(p.cat ? { mercuryCategory: p.cat } : {}), ...(p.noSwipeTime ? {} : { createdAt: new Date(at(p.ymd, p.hm)).toISOString() }) },
    job_splits: [],
  }) as StaleStaffRow

// Asserted, not annotated: the row type gains fields as #52 grows the read (purchasedAt, v2.4665),
// and these fixtures only need the ones the queue reads.
const windowRow = (p: { id: string; holder: string; ymd: string; hm: string; amount: number; store: string; jobs?: Array<[string, number]>; invoices?: number; payroll?: boolean; by?: string }): CardChargeWindowRow => ({
  id: p.id,
  postedAt: at(p.ymd, p.hm),
  amount: p.amount,
  counterpartyName: p.store,
  kind: p.amount > 0 ? 'other' : 'debitCardTransaction',
  status: 'sent',
  bankCategory: null,
  debitCardId: 'card',
  cardNickname: null,
  cardRole: null,
  holderUserId: p.holder,
  holderName: null,
  attributedUserId: null,
  attributedPersonId: null,
  labelId: null,
  labelDefaultKey: null,
  payrollMarked: p.payroll ?? false,
  splits: (p.jobs ?? []).map(([jobId, amount]) => ({ jobId, amount, hcpNumber: null, clickNumber: null, jobName: null, serviceTypeId: null })),
  invoiceLinks: Array.from({ length: p.invoices ?? 0 }, (_, i) => ({ invoiceId: `inv-${i}`, invoiceNumber: `${i}`, supplyHouseName: 'Ridge Supply', amount: 1 })),
  sortedAt: p.jobs || p.invoices || p.payroll ? at(p.ymd, '18:00') : null,
  sortedByName: p.by ?? null,
  viewerCanSort: true,
}) as CardChargeWindowRow

const session = (holder: string, ymd: string, jobId: string | null, from: string, to: string | null): TallyQueueSessionRow => ({
  user_id: holder,
  work_date: ymd,
  job_ledger_id: jobId,
  clocked_in_at: at(ymd, from),
  clocked_out_at: to ? at(ymd, to) : null,
})

const QUEUE: StaleStaffRow[] = [
  staff({ id: 'a1', holder: 'u-ann', name: 'Ann', ymd: '2026-09-30', hm: '06:03', amount: -31.47, store: 'Corner Fuel', cat: 'FuelAndGas' }),
  staff({ id: 'b1', holder: 'u-bo', name: 'Bo', ymd: '2026-09-30', hm: '08:41', amount: -152.1, store: 'Pipe Depot', cat: 'Retail' }),
  staff({ id: 'a2', holder: 'u-ann', name: 'Ann', ymd: '2026-09-29', hm: '12:18', amount: -205.3, store: 'Ridge Supply', cat: 'Retail' }),
  staff({ id: 'a3', holder: 'u-ann', name: 'Ann', ymd: '2026-09-29', hm: '10:05', amount: -61, store: 'Truck Wash Co', cat: 'VehicleExpenses' }),
  staff({ id: 'c1', holder: 'u-cy', name: 'Cy', ymd: '2026-09-26', hm: '10:08', amount: -70.15, store: 'Corner Fuel', cat: 'FuelAndGas' }),
]
const HISTORY: CardChargeWindowRow[] = [
  windowRow({ id: 'h1', holder: 'u-ann', ymd: '2026-09-29', hm: '12:39', amount: -40.15, store: 'Ridge Supply', jobs: [['job-office', -40.15]], by: 'An Office Sorter' }),
  windowRow({ id: 'h2', holder: 'u-ann', ymd: '2026-09-29', hm: '13:00', amount: -10, store: 'Pipe Depot', invoices: 1 }),
  windowRow({ id: 'h3', holder: 'u-bo', ymd: '2026-09-25', hm: '09:00', amount: -20, store: 'Pipe Depot', jobs: [['job-b', -20]] }),
  windowRow({ id: 'h4', holder: 'u-bo', ymd: '2026-09-21', hm: '09:00', amount: -20, store: 'Pipe Depot', jobs: [['job-b', -20]] }),
  windowRow({ id: 'h5', holder: 'u-bo', ymd: '2026-09-27', hm: '09:00', amount: 12, store: 'Pipe Depot', jobs: [['job-f', 12]] }),
  windowRow({ id: 'h6', holder: 'u-cy', ymd: '2026-09-26', hm: '09:00', amount: -5, store: 'Pay app', payroll: true }),
]
const SESSIONS: TallyQueueSessionRow[] = [
  session('u-ann', '2026-09-30', 'job-a', '07:10', '16:40'),
  session('u-ann', '2026-09-29', 'job-a', '07:14', '17:02'),
  session('u-cy', '2026-09-25', 'job-d', '07:00', '14:48'),
]
const SCHEDULE: TallyQueueScheduleRow[] = [{ assignee_user_id: 'u-bo', work_date: '2026-09-30', job_id: 'job-b' }]

const build = () =>
  buildTallyTeamQueue({ queue: QUEUE, history: HISTORY, sessions: SESSIONS, schedule: SCHEDULE, officeJobId: 'job-office', nowMs: NOW })

describe('buildTallyTeamQueue', () => {
  it('makes one card per person per day, newest day first, by name within a day', () => {
    const q = build()
    expect(q.days.map((d) => [d.ymd, d.cards.map((c) => c.holderName)])).toEqual([
      ['2026-09-30', ['Ann', 'Bo']],
      ['2026-09-29', ['Ann']],
      ['2026-09-26', ['Cy']],
    ])
    expect(q.charges).toBe(5)
    expect(q.dayCount).toBe(4)
  })

  it('puts a card’s charges in posted order and totals them', () => {
    const card = build().days[1]!.cards[0]!
    expect(card.charges.map((c) => c.charge.id)).toEqual(['a3', 'a2'])
    expect(card.total).toBe(-266.3)
  })

  it('reads the category from the staff row and gives the kernel the day', () => {
    const card = build().days[0]!.cards[0]!
    expect(card.charges[0]!.charge.category).toBe('FuelAndGas')
    expect(card.suggestion.best?.choice).toEqual({ kind: 'job', jobId: 'job-a' })
  })

  it('shows the day’s sorted charges on the card: to a job, to invoices, or as payroll', () => {
    const q = build()
    expect(q.days[1]!.cards[0]!.sorted.map((h) => h.id)).toEqual(['h1', 'h2'])
    expect(q.days[2]!.cards[0]!.sorted.map((h) => h.id)).toEqual(['h6'])
  })

  it('feeds the holder’s purchases to the kernel as history, never a refund', () => {
    const bo = build().days[0]!.cards[1]!
    expect(bo.suggestion.lines[0]!.own).toEqual([
      { choice: { kind: 'job', jobId: 'job-b' }, rule: 'store-last', confidence: 'none', facts: { store: 'Pipe Depot', count: 2 } },
    ])
  })

  it('puts the person furthest behind first on the strip', () => {
    expect(build().people.map((p) => [p.holderName, p.charges, p.days, p.oldestYmd])).toEqual([
      ['Cy', 1, 1, '2026-09-26'],
      ['Ann', 3, 2, '2026-09-29'],
      ['Bo', 1, 1, '2026-09-30'],
    ])
  })

  it('says everything is sorted through the day before the oldest charge', () => {
    expect(build().throughYmd).toBe('2026-09-25')
  })

  it('an empty queue has no days, no strip and no through-date', () => {
    const q = buildTallyTeamQueue({ queue: [], history: HISTORY, sessions: [], schedule: [], officeJobId: null, nowMs: NOW })
    expect(q).toEqual({ days: [], people: [], throughYmd: null, charges: 0, dayCount: 0 })
  })
})

describe('tallyThroughDate', () => {
  it('is the day before the oldest day, across a month end', () => {
    expect(tallyThroughDate(['2026-10-02', '2026-10-01'])).toBe('2026-09-30')
    expect(tallyThroughDate([])).toBeNull()
  })
})

describe('tallyCategoryFromRaw', () => {
  it('reads Mercury’s category, or null', () => {
    expect(tallyCategoryFromRaw({ mercuryCategory: 'Software' })).toBe('Software')
    expect(tallyCategoryFromRaw({ mercuryCategory: { name: 'Retail' } })).toBe('Retail')
    expect(tallyCategoryFromRaw({})).toBeNull()
    expect(tallyCategoryFromRaw(null)).toBeNull()
  })
})

describe('the day of a charge is the day of the swipe', () => {
  it('a charge swiped Monday and posted Tuesday overnight sits on Monday’s card, with Monday’s job', () => {
    const q = buildTallyTeamQueue({
      queue: [staff({ id: 'x1', holder: 'u-ann', name: 'Ann', ymd: '2026-09-28', hm: '09:17', postedYmd: '2026-09-29', postedHm: '01:30', amount: -127.82, store: 'Ridge Supply', cat: 'Retail' })],
      history: [],
      sessions: [session('u-ann', '2026-09-28', 'job-a', '07:00', '15:00'), session('u-ann', '2026-09-29', 'job-b', '07:00', '15:00')],
      schedule: [],
      officeJobId: 'job-office',
      nowMs: NOW,
    })
    expect(q.days.map((d) => d.ymd)).toEqual(['2026-09-28'])
    expect(q.days[0]!.cards[0]!.suggestion.best?.choice).toEqual({ kind: 'job', jobId: 'job-a' })
  })

  it('reads the swipe time from raw.createdAt, and falls back to posted_at', () => {
    const swiped = staff({ id: 'x2', holder: 'u', name: 'U', ymd: '2026-09-28', hm: '09:00', postedYmd: '2026-09-29', postedHm: '02:00', amount: -1, store: 'S' })
    expect(tallyChargeMadeAt(swiped)).toBe(new Date(at('2026-09-28', '09:00')).toISOString())
    const noSwipe = staff({ id: 'x3', holder: 'u', name: 'U', ymd: '2026-09-28', hm: '09:00', amount: -1, store: 'S', noSwipeTime: true })
    expect(tallyChargeMadeAt(noSwipe)).toBe(at('2026-09-28', '09:00'))
  })
})
