import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  decideAutoCreateJob,
  findNameValueTwin,
  foldJobName,
  revenueMatchesTotal,
  type AutoCreateJobGuardCandidateJob,
  type AutoCreateJobGuardEstimate,
} from './autoCreateJobGuard'
import { decideAutoCreateJob as sharedDecide } from '../../../supabase/functions/_shared/autoCreateJobGuard'

const now = new Date('2026-09-05T15:00:00Z')
const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000).toISOString()

const estimate: AutoCreateJobGuardEstimate = {
  id: 'est-1',
  docKind: 'estimate',
  jobLedgerId: null,
  bidId: null,
  customerId: 'cust-a',
  title: 'SPACEX BA-02N',
  totalCents: 24_971_566,
}

const job = (over: Partial<AutoCreateJobGuardCandidateJob>): AutoCreateJobGuardCandidateJob => ({
  id: 'job-x',
  bidId: null,
  customerId: 'cust-a',
  gcCustomerId: null,
  jobName: 'SPACEX BA-02N',
  revenue: 249_715.66,
  createdAt: daysAgo(3),
  ...over,
})

describe('decideAutoCreateJob (v2.2838 guard)', () => {
  it('creates when nothing matches', () => {
    expect(decideAutoCreateJob({ estimate, candidateJobs: [], now, switchOn: true })).toEqual({
      create: true,
      reason: 'no_existing_job',
      matchedJobId: null,
      via: null,
    })
  })

  it('switch off → skip switch_off, before any other rule', () => {
    const d = decideAutoCreateJob({ estimate: { ...estimate, docKind: 'change_order' }, candidateJobs: [job({})], now, switchOn: false })
    expect(d.create).toBe(false)
    expect(d.reason).toBe('switch_off')
  })

  it('estimate already linked → already_linked via estimate_link, even for a change order', () => {
    const d = decideAutoCreateJob({ estimate: { ...estimate, docKind: 'change_order', jobLedgerId: 'job-linked' }, candidateJobs: [], now, switchOn: true })
    expect(d).toEqual({ create: false, reason: 'already_linked', matchedJobId: 'job-linked', via: 'estimate_link' })
  })

  it('unlinked change order → skip change_order, never create, even with a bid twin present', () => {
    const d = decideAutoCreateJob({
      estimate: { ...estimate, docKind: 'change_order', bidId: 'bid-1' },
      candidateJobs: [job({ id: 'job-bid', bidId: 'bid-1' })],
      now,
      switchOn: true,
    })
    expect(d).toEqual({ create: false, reason: 'change_order', matchedJobId: null, via: null })
  })

  it('a job carrying the estimate bid → already_linked via bid_link (newest wins)', () => {
    const d = decideAutoCreateJob({
      estimate: { ...estimate, bidId: 'bid-1' },
      candidateJobs: [
        job({ id: 'job-old', bidId: 'bid-1', jobName: 'other', revenue: 1, createdAt: daysAgo(400) }),
        job({ id: 'job-new', bidId: 'bid-1', jobName: 'other', revenue: 1, createdAt: daysAgo(2) }),
      ],
      now,
      switchOn: true,
    })
    expect(d).toEqual({ create: false, reason: 'already_linked', matchedJobId: 'job-new', via: 'bid_link' })
  })

  it('hand-typed twin: same customer + folded name + same cents within 90 days → duplicate_by_name_value', () => {
    const d = decideAutoCreateJob({
      estimate,
      candidateJobs: [job({ id: 'job-twin', jobName: '  spacex   ba-02n ' })],
      now,
      switchOn: true,
    })
    expect(d).toEqual({ create: false, reason: 'duplicate_by_name_value', matchedJobId: 'job-twin', via: 'name_value' })
  })

  it('twin matched through the GC customer column too', () => {
    const d = decideAutoCreateJob({
      estimate,
      candidateJobs: [job({ id: 'job-gc', customerId: 'someone-else', gcCustomerId: 'cust-a' })],
      now,
      switchOn: true,
    })
    expect(d.reason).toBe('duplicate_by_name_value')
    expect(d.matchedJobId).toBe('job-gc')
  })

  it('twin outside the 90-day window → create', () => {
    const d = decideAutoCreateJob({ estimate, candidateJobs: [job({ createdAt: daysAgo(91) })], now, switchOn: true })
    expect(d.create).toBe(true)
  })

  it('same name and value but a different customer → create', () => {
    const d = decideAutoCreateJob({ estimate, candidateJobs: [job({ customerId: 'cust-b' })], now, switchOn: true })
    expect(d.create).toBe(true)
  })

  it('same customer and name but value outside ±1% / ±$1 → create', () => {
    const d = decideAutoCreateJob({ estimate, candidateJobs: [job({ revenue: 240_000 })], now, switchOn: true })
    expect(d.create).toBe(true)
  })

  it('no customer or no name on the estimate → the twin rule cannot fire', () => {
    expect(findNameValueTwin({ ...estimate, customerId: null }, [job({})], now)).toBeNull()
    expect(findNameValueTwin({ ...estimate, title: '   ' }, [job({ jobName: '   ' })], now)).toBeNull()
  })

  it('bid_proposal is treated like an estimate (creates when clear)', () => {
    const d = decideAutoCreateJob({ estimate: { ...estimate, docKind: 'bid_proposal', bidId: 'bid-9' }, candidateJobs: [], now, switchOn: true })
    expect(d.create).toBe(true)
  })
})

describe('value + name folding', () => {
  it('revenueMatchesTotal: ±1% for big totals, ±$1 for small ones', () => {
    expect(revenueMatchesTotal(249_715.66, 24_971_566)).toBe(true)
    expect(revenueMatchesTotal(252_000, 24_971_566)).toBe(true) // +0.9%
    expect(revenueMatchesTotal(253_000, 24_971_566)).toBe(false) // +1.3%
    expect(revenueMatchesTotal(50.99, 5_000)).toBe(true) // 99¢ off on a $50 job (±$1 floor)
    expect(revenueMatchesTotal(52, 5_000)).toBe(false)
    expect(revenueMatchesTotal(null, 5_000)).toBe(false)
    expect(revenueMatchesTotal(10, null)).toBe(false)
  })
  it('foldJobName trims, collapses whitespace, lowercases', () => {
    expect(foldJobName('  Connell   House ')).toBe('connell house')
    expect(foldJobName(null)).toBe('')
  })
})

describe('app twin parity with _shared/autoCreateJobGuard', () => {
  it('is byte-identical', () => {
    const app = readFileSync(resolve(__dirname, 'autoCreateJobGuard.ts'), 'utf8')
    const shared = readFileSync(resolve(__dirname, '../../../supabase/functions/_shared/autoCreateJobGuard.ts'), 'utf8')
    expect(app).toBe(shared)
  })
  it('decides the same', () => {
    const input = { estimate, candidateJobs: [job({ id: 'job-twin' })], now, switchOn: true }
    expect(sharedDecide(input)).toEqual(decideAutoCreateJob(input))
  })
})
