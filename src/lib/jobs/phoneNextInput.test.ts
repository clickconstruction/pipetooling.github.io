/**
 * The phone rows' input for one job (the Stages map's step 18). The kernel gathers; the wording is `jobNextLine`'s.
 * So these cases pin the gathering: which of the board's side maps feeds which field, and the gates on the fields
 * that only a billed or Collections row carries. Made-up jobs, payers and days.
 */
import { describe, expect, it, vi } from 'vitest'

// The real pay model, with its calls kept, so a case can read what the kernel handed it.
vi.mock('./billedDuePay', async (original) => {
  const actual = await original<typeof import('./billedDuePay')>()
  return { ...actual, billedPayModel: vi.fn(actual.billedPayModel) }
})

import { phoneNextLineInput, type PhoneNextInputSources } from './phoneNextInput'
import { billedPayModel } from './billedDuePay'
import { contractRowChipForJob } from './contractRowChip'
import { effectiveInvoiceEstBillDate } from './invoiceBilling'
import { calendarSourceFor } from './payCalendar'
import { paceInputFor, sentFromHereOf } from './payPace'
import { phoneBillWords } from './phoneBillWords'
import { progressPaymentForJob } from './progressPaymentForJob'
import { stagesBillSentPctAlert } from './stagesBillSentPctAlert'
import { uncollectiblePhoneLine } from './uncollectible'
import { deriveStagesBillingActivityDetail } from '../stagesJobReferenceDates'
import type { StageRow } from '../jobsStagesBoard'
import { makeInvoice, makeJob } from '../../test/renderSmokeMocks'

const TODAY = '2026-11-18'
/** Pay speeds enough for the model to answer: the company's, and the made-up diner's own. */
const SPEEDS = {
  company: { medianDays: 11, samples: 40 },
  customers: { 'cust-diner': { medianDays: 21, samples: 9 } },
  segments: { residential: null, commercial: { medianDays: 18, samples: 30 } },
  customerTypes: { 'cust-diner': 'commercial' },
  receipts: {},
  quality: null,
} as unknown as PhoneNextInputSources['billedPaySpeeds']

function sources(over: Partial<PhoneNextInputSources> = {}): PhoneNextInputSources {
  return {
    todayYmd: TODAY,
    crewByJobId: new Map(),
    billedPaySpeeds: null,
    promisedPayDates: null,
    billedPaceContext: null as unknown as PhoneNextInputSources['billedPaceContext'],
    payCalendars: null as unknown as PhoneNextInputSources['payCalendars'],
    acceptedByInvoice: null,
    followupQuietByJobId: new Map(),
    bankReturnedByJobId: new Map(),
    canSeeJobContracts: true,
    jobContractCoverageByJobId: new Map(),
    stagesUpcomingByJobId: {},
    stagesWorkedByJobId: {},
    uncollectibleFactsFor: () => null,
    lienRunwayFor: () => null,
    lienStateFor: () => null,
    ...over,
  }
}
const workingJob = () => makeJob({ id: 'w1', job_name: 'Phone Duplex', status: 'working', revenue: 5000, payments_made: 1000, pct_complete: 40, created_at: '2026-10-01T15:00:00Z' })
function billedRow(extra: Record<string, unknown> = {}) {
  const job = makeJob({ id: 'b1', job_name: 'Phone Diner', status: 'billed', revenue: 900, payments_made: 0, customer_id: 'cust-diner', customer_name: 'Made Up Diner', ...extra })
  const inv = makeInvoice({ id: 'inv-b1', job_id: 'b1', amount: 900, status: 'billed', billed_at: '2026-11-10T18:00:00Z' })
  return { job, inv, row: { kind: 'invoice', job, inv } as StageRow }
}

describe('phoneNextLineInput — what every row carries', () => {
  it('passes the stage and today through, and takes the job’s start day off the job', () => {
    const job = workingJob()
    const i = phoneNextLineInput(job, null, 'working', sources())
    expect(i.stage).toBe('working')
    expect(i.todayYmd).toBe(TODAY)
    expect(i.createdAt).toBe('2026-10-01T15:00:00Z')
  })

  it('reads the money and the view as the row’s progress bar does, with the job’s crew from the crew map', () => {
    const job = workingJob()
    const crew: NonNullable<Parameters<typeof progressPaymentForJob>[1]> = { jobId: 'w1', lastWorkYmd: '2026-11-17', lastDayPeople: ['Ana Made'], onSiteToday: false, sessions60d: 3, people60d: 1, sheet: null, report: { pct: 55, at: '2026-11-17T20:00:00Z' }, pctManualAt: null, pctSetAt: null, pctSource: null }
    const i = phoneNextLineInput(job, null, 'working', sources({ crewByJobId: new Map([['w1', crew], ['other', { ...crew, jobId: 'other', report: null }]]) }))
    expect(i.crew).toBe(crew)
    const want = progressPaymentForJob(job, crew)
    expect(i.money).toEqual(want.model)
    expect(i.view).toEqual(want.view)
    expect(i.billSentAlert).toEqual(stagesBillSentPctAlert(job))
    // No crew on the map is no crew, not another job's.
    const alone = phoneNextLineInput(job, null, 'working', sources({ crewByJobId: new Map([['other', crew]]) }))
    expect(alone.crew).toBeNull()
    expect(alone.view).toEqual(progressPaymentForJob(job, null).view)
  })

  it('takes quiet days, a returned deposit and the next booking from the job’s own entry in each map, and null with none', () => {
    const job = workingJob()
    const returned = { amount: 250 } as unknown as NonNullable<ReturnType<typeof phoneNextLineInput>['bankReturned']>
    const upcoming = { ymd: '2026-11-20' } as PhoneNextInputSources['stagesUpcomingByJobId'][string]
    const i = phoneNextLineInput(
      job,
      null,
      'working',
      sources({ followupQuietByJobId: new Map([['w1', 9]]), bankReturnedByJobId: new Map([['w1', returned]]), stagesUpcomingByJobId: { w1: upcoming } }),
    )
    expect(i.quietDays).toBe(9)
    expect(i.bankReturned).toBe(returned)
    expect(i.upcoming).toBe(upcoming)
    const bare = phoneNextLineInput(job, null, 'working', sources({ followupQuietByJobId: new Map([['x', 9]]), bankReturnedByJobId: new Map([['x', returned]]), stagesUpcomingByJobId: { x: upcoming } }))
    expect(bare.quietDays).toBeNull()
    expect(bare.bankReturned).toBeNull()
    expect(bare.upcoming).toBeNull()
  })

  it('a working job’s bill words come from its latest billing event', () => {
    const job = workingJob()
    const i = phoneNextLineInput(job, null, 'working', sources())
    expect(i.billDisplay).toBe(phoneBillWords({ stage: 'working', inv: null, detail: deriveStagesBillingActivityDetail(job), todayYmd: TODAY }))
  })
})

describe('phoneNextLineInput — the contract', () => {
  const coverage = { kind: 'none' } as PhoneNextInputSources['jobContractCoverageByJobId'] extends { get(id: string): infer T | undefined } ? T : never

  it('a role that cannot see contracts carries no contract fact and no ask, whatever is on file', () => {
    const job = workingJob()
    const i = phoneNextLineInput(job, null, 'working', sources({ canSeeJobContracts: false, jobContractCoverageByJobId: new Map([['w1', coverage]]), stagesUpcomingByJobId: { w1: { ymd: '2026-11-19' } as never } }))
    expect(i.contract).toBeUndefined()
    expect(i.contractAsk).toBeNull()
  })

  it('a role that can see them carries the job’s coverage, or null with none on the map', () => {
    const job = workingJob()
    expect(phoneNextLineInput(job, null, 'working', sources({ jobContractCoverageByJobId: new Map([['w1', coverage]]) })).contract).toBe(coverage)
    expect(phoneNextLineInput(job, null, 'working', sources()).contract).toBeNull()
  })

  it('asks when the desktop row’s chip asks, in the phone’s words, from the same four facts', () => {
    const job = workingJob()
    const upcoming = { ymd: '2026-11-19' } as PhoneNextInputSources['stagesUpcomingByJobId'][string]
    const weekSoFar = { worked: [{}], bookedYmds: ['2026-11-17'] } as unknown as PhoneNextInputSources['stagesWorkedByJobId'][string]
    const chip = contractRowChipForJob(job, { coverage, upcoming, weekSoFar, todayYmd: TODAY })
    // The made-up job is one the chip asks about: a crew on site and nothing on file.
    if (!(chip.show && chip.tone === 'ask' && chip.phoneLabel)) throw new Error('the made-up job should be one the chip asks about')
    const i = phoneNextLineInput(job, null, 'working', sources({ jobContractCoverageByJobId: new Map([['w1', coverage]]), stagesUpcomingByJobId: { w1: upcoming }, stagesWorkedByJobId: { w1: weekSoFar } }))
    expect(i.contractAsk).toEqual({ label: chip.phoneLabel, title: chip.title })
  })

  it('does not ask where the chip does not', () => {
    const job = makeJob({ id: 'q1', status: 'waiting', revenue: 0, pct_complete: 0 })
    const chip = contractRowChipForJob(job, { coverage: undefined, upcoming: null, weekSoFar: null, todayYmd: TODAY })
    expect(chip.show && chip.tone === 'ask').toBe(false)
    expect(phoneNextLineInput(job, null, 'waiting', sources()).contractAsk).toBeNull()
  })
})

describe('phoneNextLineInput — what only a billed or Collections bill row carries', () => {
  it('reckons when the money is expected from the bill’s day, its payer, the promise, the pace and the Pay calendar', () => {
    const { job, inv, row } = billedRow()
    const promise = { promisedYmd: '2026-11-25', markedByName: 'Office Made' }
    const src = sources({ billedPaySpeeds: SPEEDS, promisedPayDates: { b1: promise, other: { promisedYmd: '2026-12-30', markedByName: 'Nobody' } }, acceptedByInvoice: new Map([['inv-b1', '2026-11-12'], ['inv-other', '2026-11-01']]) })
    vi.mocked(billedPayModel).mockClear()
    const i = phoneNextLineInput(job, row, 'billed', src)
    // What the kernel handed the pay model: this bill's own accepted day, this job's own promise.
    const handed = vi.mocked(billedPayModel).mock.calls[0]!
    expect(handed[0]).toEqual({ billedAtIso: inv.billed_at, estBillYmd: effectiveInvoiceEstBillDate(inv), customerId: 'cust-diner', payerName: 'Made Up Diner', acceptedYmd: '2026-11-12' })
    expect(handed[3]).toBe(promise)
    const want = billedPayModel(
      { billedAtIso: inv.billed_at, estBillYmd: effectiveInvoiceEstBillDate(inv), customerId: 'cust-diner', payerName: 'Made Up Diner', acceptedYmd: '2026-11-12' },
      src.billedPaySpeeds,
      TODAY,
      promise,
      paceInputFor(src.billedPaceContext, { payerId: 'cust-diner', jobId: 'b1', sentFromHere: sentFromHereOf(inv) }, src.billedPaySpeeds),
      calendarSourceFor(src.payCalendars, { payerId: 'cust-diner', jobId: 'b1', invoiceId: 'inv-b1' }),
    )
    expect(want).not.toBeNull()
    expect(i.expectedPay).toEqual(want)
    // The job's own promise and its bill's own accepted day went in, not another's and not none.
    const bare = billedPayModel({ billedAtIso: inv.billed_at, estBillYmd: effectiveInvoiceEstBillDate(inv), customerId: 'cust-diner', payerName: 'Made Up Diner', acceptedYmd: null }, src.billedPaySpeeds, TODAY, null, null, null)
    expect(i.expectedPay).not.toEqual(bare)
    // Collections reads it the same way.
    expect(phoneNextLineInput(job, row, 'collections', src).expectedPay).toEqual(want)
  })

  it('carries no expected pay before the bill is out, on a row with no bill, or on a job paid in kind', () => {
    const { job, row } = billedRow()
    const src = sources({ billedPaySpeeds: SPEEDS })
    // The same bill on a billed row does carry one, so the nulls below are the gates' doing.
    expect(phoneNextLineInput(job, row, 'billed', src).expectedPay).not.toBeNull()
    expect(phoneNextLineInput(job, row, 'ready_to_bill', src).expectedPay).toBeNull()
    expect(phoneNextLineInput(job, { kind: 'job', job }, 'billed', src).expectedPay).toBeNull()
    expect(phoneNextLineInput(job, null, 'billed', src).expectedPay).toBeNull()
    const inKind = billedRow({ in_kind_arrangement_id: 'arr-1' })
    expect(phoneNextLineInput(inKind.job, inKind.row, 'billed', src).expectedPay).toBeNull()
  })

  it('a bill row reads the bill’s own day for its words, not the job’s latest event', () => {
    const { job, inv, row } = billedRow()
    const i = phoneNextLineInput(job, row, 'billed', sources())
    expect(i.billDisplay).toBe(phoneBillWords({ stage: 'billed', inv, detail: deriveStagesBillingActivityDetail(job), todayYmd: TODAY }))
    expect(i.billDisplay).toMatch(/^billed /)
  })

  it('asks the lien clock and the Lien desk only for Billed and Collections, with the row’s bill', () => {
    const { job, inv, row } = billedRow()
    const runway = { kind: 'safe' } as unknown as ReturnType<PhoneNextInputSources['lienRunwayFor']>
    const lienRunwayFor = vi.fn(() => runway)
    const lienStateFor = vi.fn(() => ({ act: 'send', paper: 'notice', dueOn: '2026-12-15', lead: 'ignored', tone: 'ignored' }) as never)
    for (const stage of ['billed', 'collections'] as const) {
      const i = phoneNextLineInput(job, row, stage, sources({ lienRunwayFor, lienStateFor }))
      expect(i.lienRunway).toBe(runway)
      expect(lienRunwayFor).toHaveBeenLastCalledWith(job, inv)
      // Only the three facts the chip words itself with.
      expect(i.lienDesk).toEqual({ act: 'send', paper: 'notice', dueOn: '2026-12-15' })
      expect(lienStateFor).toHaveBeenLastCalledWith('b1')
    }
    lienRunwayFor.mockClear()
    lienStateFor.mockClear()
    for (const stage of ['waiting', 'working', 'ready_to_bill'] as const) {
      const i = phoneNextLineInput(job, row, stage, sources({ lienRunwayFor, lienStateFor }))
      expect(i.lienRunway).toBeNull()
      expect(i.lienDesk).toBeNull()
    }
    expect(lienRunwayFor).not.toHaveBeenCalled()
    expect(lienStateFor).not.toHaveBeenCalled()
  })

  it('a job with no word from the Lien desk carries none', () => {
    const { job, row } = billedRow()
    expect(phoneNextLineInput(job, row, 'billed', sources({ lienStateFor: () => null })).lienDesk).toBeNull()
  })

  it('only a Collections row reads as given up on, with the office’s reason as its line', () => {
    const { job, row } = billedRow()
    const facts = { markedYmd: '2026-11-15', reason: 'Owner moved away' } as NonNullable<ReturnType<PhoneNextInputSources['uncollectibleFactsFor']>>
    const uncollectibleFactsFor = vi.fn(() => facts)
    expect(phoneNextLineInput(job, row, 'collections', sources({ uncollectibleFactsFor })).uncollectible).toEqual({ line: uncollectiblePhoneLine(facts) })
    expect(uncollectibleFactsFor).toHaveBeenCalledWith(job)
    uncollectibleFactsFor.mockClear()
    expect(phoneNextLineInput(job, row, 'billed', sources({ uncollectibleFactsFor })).uncollectible).toBeNull()
    expect(uncollectibleFactsFor).not.toHaveBeenCalled()
    // A Collections job still being chased has no such line.
    expect(phoneNextLineInput(job, row, 'collections', sources()).uncollectible).toBeNull()
  })
})
