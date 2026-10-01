import { describe, expect, it } from 'vitest'
import { arCaseDay, arCaseTakeOff, arCaseThisReplaces, arPayerCameBackNote, arPayerKey, arReplacementFor, arReturnCaseView, type ArReturnCaseRow } from './arReturnCase'
import type { ArDepositTrailRow } from './arDepositTrail'
import { helpGuidePlainWordsFailures } from '../plainWords'

const TODAY = '2026-10-01'

const base: ArReturnCaseRow = {
  mercury_transaction_id: 'tx-sp',
  counterparty_name: 'Southern Post',
  amount: '13680',
  kind: 'checkDeposit',
  posted_at: '2026-09-18T22:00:58Z',
  failed_at: '2026-09-23T15:00:00Z',
  bank_reason: 'Insufficient funds',
  source: 'bank',
  opened_at: '2026-09-23T15:00:00Z',
  closed_at: null,
  closed_reason: null,
  closed_note: null,
  closed_by: null,
  replaced_by_mercury_transaction_id: null,
  notified_at: null,
  live_payments: [],
  last_job: { job_id: 'job-878', job_number: '878', job_name: 'Take 5- Seguin', removed_at: '2026-09-24T13:43:00Z', removed_by: 'Taunya', job_revenue: 38625, job_payments_made: 0 },
  recorded_payment: null,
  promise: null,
}

const spTrail: ArDepositTrailRow[] = [
  {
    mercury_transaction_id: 'tx-sp',
    payment_id: 'p1',
    live: false,
    job_id: 'job-878',
    job_number: '878',
    job_name: 'Take 5- Seguin',
    invoice_id: 'inv-878-1',
    amount: 13680,
    applied_at: '2026-09-21T16:00:00Z',
    applied_by: 'Taunya',
    removed_at: '2026-09-24T13:43:00Z',
    removed_by: 'Taunya',
  },
]

describe('arReturnCaseView — the case as the pane says it', () => {
  it('Southern Post: off #878, the story in order, the stake, get a new check', () => {
    const v = arReturnCaseView({ row: base, trail: spTrail, todayYmd: TODAY })
    expect(v.chip).toEqual({ text: 'came back · Insufficient funds', tone: 'red' })
    expect(v.story.map((s) => `${s.day} ${s.text}`)).toEqual([
      'Sep 18 The check posted.',
      'Sep 21 Taunya applied it to #878 Take 5- Seguin.',
      'Sep 23 The bank sent it back. Insufficient funds.',
      'Sep 24 Taunya took it off #878.',
    ])
    expect(v.stake).toEqual({ text: '#878 owes the $13,680 again.', detail: 'It owes $38,625 in all.', jobId: 'job-878', tone: 'red' })
    expect(v.next).toEqual({ kind: 'new_check', sentence: 'Get a new check from Southern Post. It has been 8 days.' })
    expect(v.rowLine).toBe('off #878 since 9/24 · no new check in 8 days')
    expect(v.promiseJob).toEqual({ jobId: 'job-878', label: '#878 Take 5- Seguin' })
    expect(v.watch).toBe('When a $13,680 deposit from Southern Post lands, it shows here to pick.')
    expect(v.billsItPaid).toEqual([{ invoiceId: 'inv-878-1', jobId: 'job-878', amount: 13680 }])
    expect(v.takeOff).toBeNull()
  })

  it('Loberg: a stop payment asks why, and came back today reads so', () => {
    const row: ArReturnCaseRow = {
      ...base,
      mercury_transaction_id: 'tx-l',
      counterparty_name: 'Loberg',
      amount: 5622.49,
      posted_at: '2026-09-28T22:00:00Z',
      failed_at: '2026-10-01T13:41:00Z',
      bank_reason: 'Stop payment',
      last_job: { job_id: 'job-650', job_number: '650', job_name: 'ATI Schertz — As per plans', removed_at: '2026-10-01T02:19:00Z', removed_by: 'Taunya', job_revenue: 33500, job_payments_made: 24477.51 },
    }
    const v = arReturnCaseView({ row, trail: [], todayYmd: TODAY })
    expect(v.next.sentence).toBe('Ask Loberg why they stopped it.')
    expect(v.rowLine).toBe('off #650 since 9/30 · came back today')
    expect(v.stake?.text).toBe('#650 owes the $5,622.49 again.')
    expect(v.stake?.detail).toBe('It owes $9,022.49 in all.')
  })

  it('a promise after the bounce: the story says it and the next step waits', () => {
    const row: ArReturnCaseRow = { ...base, promise: { job_id: 'job-878', promised_date: '2026-10-08', said_by: 'Ana', created_at: '2026-09-29T15:00:00Z' } }
    const v = arReturnCaseView({ row, trail: spTrail, todayYmd: TODAY })
    expect(v.story[v.story.length - 1]).toEqual({ ymd: '2026-09-29', day: 'Sep 29', text: 'Ana said the new check comes by Oct 8.', tone: 'good' })
    expect(v.next.sentence).toBe('Waiting for the new check. Ana said Oct 8.')
    expect(v.rowLine).toBe('off #878 since 9/24 · they said 10/8')
  })

  it('Iannotti: a check that never reached the bank, matched to a payment recorded by hand', () => {
    const row: ArReturnCaseRow = {
      ...base,
      mercury_transaction_id: 'tx-i',
      counterparty_name: 'Sal Iannotti',
      amount: 600,
      posted_at: null,
      failed_at: '2026-09-25T15:00:00Z',
      bank_reason: 'There was an issue with this transaction. Please contact help@mercury.com.',
      source: 'rejected',
      last_job: null,
      recorded_payment: { payment_id: 'p9', job_id: 'job-1040', job_number: '1040', job_name: 'Iannotti PRV', amount: 600, paid_on: '2026-09-29', job_revenue: 600, job_payments_made: 600 },
    }
    const v = arReturnCaseView({ row, trail: [], todayYmd: TODAY })
    expect(v.chip).toEqual({ text: 'never reached the bank', tone: 'amber' })
    expect(v.story.map((s) => `${s.day} ${s.text}`)).toEqual([
      'Sep 25 Mercury could not take this check in. It never posted.',
      'Sep 29 $600 was recorded as paid on #1040 Iannotti PRV. No deposit is linked to it.',
    ])
    expect(v.stake?.text).toBe('#1040 reads paid in full. The money is not in the bank.')
    expect(v.next).toEqual({ kind: 'deposit_again', sentence: 'Find the check and deposit it again.' })
    expect(v.rowLine).toBe('never posted · #1040 reads paid')
    expect(v.recorded).toEqual({ paymentId: 'p9', jobId: 'job-1040', label: '#1040 Iannotti PRV', amount: 600 })
  })

  it('Peter Garza: an old return nobody linked, the job it reads paid on, the year in the dates', () => {
    const row: ArReturnCaseRow = {
      ...base,
      mercury_transaction_id: 'tx-g',
      counterparty_name: 'Peter Garza',
      amount: 2700,
      posted_at: null,
      failed_at: '2025-07-11T15:00:00Z',
      opened_at: '2025-07-11T15:00:00Z',
      last_job: null,
      recorded_payment: { payment_id: 'p7', job_id: 'job-120', job_number: '120', job_name: 'Pete Garza — Install water softener, 5 hose bibs', amount: 2700, paid_on: '2025-07-07', job_revenue: 2700, job_payments_made: 2700 },
    }
    const v = arReturnCaseView({ row, trail: [], todayYmd: TODAY })
    expect(v.story.map((s) => `${s.day} ${s.text}`)).toEqual(['Jul 11, 2025 The bank sent it back. Insufficient funds.'])
    expect(v.stake?.text).toBe('#120 still reads paid. $2,700 was recorded there with no deposit.')
    expect(v.rowLine).toBe('#120 reads paid · came back 7/11/25')
    expect(v.next.sentence).toBe('Get a new check from Peter Garza. It has been 447 days.')
  })

  it('Texas Mutual: a hand mark says the bank never said so', () => {
    const row: ArReturnCaseRow = { ...base, mercury_transaction_id: 'tx-t', counterparty_name: 'Texas Mutual', amount: 119.56, bank_reason: null, source: 'hand', failed_at: null, opened_at: '2026-08-19T17:29:00Z', last_job: null }
    const v = arReturnCaseView({ row, trail: [], todayYmd: TODAY })
    expect(v.chip.text).toBe('came back')
    expect(v.handNote).toBe("Marked returned by hand. The bank did not say Texas Mutual's check came back.")
    expect(v.rowLine).toBe('on no job · came back 8/19')
  })
})

describe('arCaseTakeOff — what comes off each job, read back before the press', () => {
  it('KCG across three jobs: per job, biggest first, the paid bill going back', () => {
    const t = arCaseTakeOff({
      live_payments: [
        { payment_id: 'a', job_id: 'j977', job_number: '977', job_name: 'Springtown', amount: 11181.48, invoice_id: 'i2', invoice_sequence_order: 1, invoice_status: 'billed' },
        { payment_id: 'b', job_id: 'j963', job_number: '963', job_name: 'Knight Springtown Vet', amount: 2090, invoice_id: 'i1', invoice_sequence_order: 0, invoice_status: 'billed' },
        { payment_id: 'c', job_id: 'j978', job_number: '978', job_name: 'Springtown- HVAC', amount: 1980, invoice_id: 'i3', invoice_sequence_order: 0, invoice_status: 'paid' },
        { payment_id: 'd', job_id: 'j977', job_number: '977', job_name: 'Springtown', amount: 0.3, invoice_id: 'i2', invoice_sequence_order: 1, invoice_status: 'billed' },
        { payment_id: 'e', job_id: 'j963', job_number: '963', job_name: 'Knight Springtown Vet', amount: 1482, invoice_id: 'i4', invoice_sequence_order: 2, invoice_status: 'billed' },
        { payment_id: 'f', job_id: 'j978', job_number: '978', job_name: 'Springtown- HVAC', amount: 1018.87, invoice_id: 'i5', invoice_sequence_order: 1, invoice_status: 'billed' },
      ],
    })!
    expect(t.jobs.map((j) => `${j.label}: ${j.words}`)).toEqual([
      '#977 Springtown: $11,181.78 comes off bill 2.',
      '#963 Knight Springtown Vet: $3,572 comes off bills 1 and 3.',
      '#978 Springtown- HVAC: $2,998.87 comes off bills 1 and 2. Bill 1 goes back to Billed.',
    ])
    expect(t.summary).toBe("6 payments on 3 jobs. Each job's history keeps the removal and who did it.")
    expect(t.blocked).toBe(false)
  })
  it('a bill Stripe holds as paid blocks the press and says where to go', () => {
    const t = arCaseTakeOff({
      live_payments: [{ payment_id: 'c', job_id: 'j978', job_number: '978', job_name: 'Springtown- HVAC', amount: 1980, invoice_id: 'i3', invoice_sequence_order: 0, invoice_status: 'paid', stripe_bill: true }],
    })!
    expect(t.blocked).toBe(true)
    expect(t.jobs[0]!.blocker).toBe("Bill 1 is marked paid in Stripe. Press Check didn't clear on it in #978 first.")
  })
  it('a paid job goes back to Billed Awaiting Payment', () => {
    const t = arCaseTakeOff({ live_payments: [{ payment_id: 'x', job_id: 'j1', job_number: '1', job_name: 'One', amount: 250, invoice_id: null, job_status: 'paid' }] })!
    expect(t.jobs[0]!.words).toBe('$250 comes off the job. The job goes back to Billed Awaiting Payment.')
  })
  it('no live payments, nothing to take off', () => {
    expect(arCaseTakeOff({ live_payments: [] })).toBeNull()
  })
})

describe('the new check', () => {
  const view = arReturnCaseView({ row: base, trail: spTrail, todayYmd: TODAY })
  const dep = (id: string, name: string, amount: number, posted: string, remaining = amount) => ({ mercury_transaction_id: id, counterparty_name: name, amount, posted_at: posted, remaining_available: remaining })
  it('same payer (first five letters), same cents, untouched, after it came back — oldest first', () => {
    const r = arReplacementFor(view, [
      dep('late', 'Southern Post Construction', 13680, '2026-10-03T15:00:00Z'),
      dep('early', 'SOUTHERN POST', 13680, '2026-09-30T15:00:00Z'),
      dep('before', 'Southern Post', 13680, '2026-09-20T15:00:00Z'),
      dep('other', 'Poolcorp', 13680, '2026-09-30T15:00:00Z'),
      dep('part', 'Southern Post', 13680, '2026-09-30T15:00:00Z', 100),
      dep('cents', 'Southern Post', 13680.01, '2026-09-30T15:00:00Z'),
    ])
    expect(r?.mercury_transaction_id).toBe('early')
  })
  it('the reverse: a deposit names the case it may replace', () => {
    expect(arCaseThisReplaces(dep('early', 'SOUTHERN POST', 13680, '2026-09-30T15:00:00Z'), [view])?.id).toBe('tx-sp')
    expect(arCaseThisReplaces(dep('x', 'DRF', 250, '2026-09-30T15:00:00Z'), [view])).toBeNull()
  })
  it('arPayerKey', () => {
    expect(arPayerKey('M&M Roofing Co')).toBe(arPayerKey('M & M Roofing'))
    expect(arPayerKey('DR')).toBeNull()
  })
})

describe('the words are plain', () => {
  it('every sentence a case can say passes the plain-words rules', () => {
    const views = [
      arReturnCaseView({ row: base, trail: spTrail, todayYmd: TODAY }),
      arReturnCaseView({ row: { ...base, bank_reason: 'Stop payment', last_job: null }, trail: [], todayYmd: TODAY }),
    ]
    for (const v of views) {
      const text = [v.next.sentence, v.stake?.text, v.stake?.detail, v.watch, v.handNote, ...v.story.map((s) => s.text)].filter(Boolean).join(' ')
      expect(helpGuidePlainWordsFailures(`---\ntitle: x\n---\n${text}\n`)).toEqual([])
    }
  })
  it('arCaseDay', () => {
    expect(arCaseDay('2026-09-18', TODAY)).toBe('Sep 18')
    expect(arCaseDay('2025-07-11', TODAY)).toBe('Jul 11, 2025')
  })
})

describe('v2.4328: the payer remembers', () => {
  const c = (id: string, name: string, failed: string, source = 'bank') => ({ mercury_transaction_id: id, counterparty_name: name, source, failed_at: failed, opened_at: failed })
  it('Poolcorp: two in April on a new deposit, the deposit itself left out, older than a year dropped', () => {
    const cases = [c('a', 'Poolcorp', '2026-04-01T15:00:00Z'), c('b', 'POOLCORP', '2026-04-13T15:00:00Z'), c('old', 'Poolcorp', '2025-03-01T15:00:00Z'), c('h', 'Poolcorp', '2026-05-01T15:00:00Z', 'hand')]
    expect(arPayerCameBackNote('Poolcorp', cases, '2026-10-01')).toBe('2 came back · Apr')
    expect(arPayerCameBackNote('Poolcorp', cases, '2026-10-01', 'b')).toBe('1 came back · Apr')
    expect(arPayerCameBackNote('DRF', cases, '2026-10-01')).toBeNull()
    expect(arPayerCameBackNote('Peter Garza', [c('g', 'Peter Garza', '2025-11-11T15:00:00Z')], '2026-10-01')).toBe('1 came back · Nov 2025')
  })
})
