import { describe, expect, it } from 'vitest'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { plainWordsFailures } from '../plainWords'
import { countStagesSearchHeldBack, countStagesZzHeldBack, stagesSearchHeldBackLines } from './stagesSearchHeldBack'

const job = (id: string, p: Partial<JobWithDetails> = {}): JobWithDetails =>
  ({ id, job_name: `Job ${id}`, job_address: '1 Main St', hcp_number: id, click_number: null, status: 'working', invoices: [], ...p }) as JobWithDetails
const billedBill = { id: 'b1', status: 'billed', amount: 100, sequence_order: 1 } as JobWithDetails['invoices'][number]

describe('countStagesSearchHeldBack', () => {
  const hidden = job('h1', { job_name: 'Sagemoor Lot 12', status: 'paid' })
  const shown = job('s1', { job_name: 'Sagemoor Lot 3' })
  const other = job('o1', { job_name: 'Oak Street' })

  it('counts the matches the filters took off, in any stage, and not the ones on the board', () => {
    expect(countStagesSearchHeldBack([hidden, shown, other], [shown, other], 'sagemoor')).toBe(1)
  })

  it('a job the filters took off that does not match is not counted', () => {
    expect(countStagesSearchHeldBack([hidden, other], [hidden], 'sagemoor')).toBe(0)
  })

  it('no search, or no filter taking anything off, holds nothing back', () => {
    expect(countStagesSearchHeldBack([hidden, shown], [shown], '  ')).toBe(0)
    expect(countStagesSearchHeldBack([hidden, shown], [hidden, shown], 'sagemoor')).toBe(0)
  })

  it('a job the lookup found by something the row does not print counts too', () => {
    const byCustomer = job('c1', { job_name: 'Lot 9' })
    expect(countStagesSearchHeldBack([byCustomer], [], 'sagemoor', new Set(['c1']))).toBe(1)
  })

  it('a row the board would never draw is never promised: a billing-only job with no bill', () => {
    const billingOnly = job('b1', { job_name: 'Sagemoor (GC)', billing_only: true })
    expect(countStagesSearchHeldBack([billingOnly], [], 'sagemoor')).toBe(0)
  })

  it('a billing-only job with a bill is drawn under Billed, once however many lists hold it', () => {
    const billingOnly = job('b2', { job_name: 'Sagemoor (GC)', billing_only: true, invoices: [billedBill] })
    expect(countStagesSearchHeldBack([billingOnly], [], 'sagemoor')).toBe(1)
    const billed = job('b3', { job_name: 'Sagemoor Billed', status: 'billed', invoices: [billedBill] })
    expect(countStagesSearchHeldBack([billed], [], 'sagemoor')).toBe(1)
  })
})

describe('countStagesZzHeldBack', () => {
  const zzJobIds = new Set(['z1', 'z2'])
  it('counts the lookup ids that are ZZ jobs while a dev hides them', () => {
    expect(countStagesZzHeldBack({ lookupIds: new Set(['z1', 'a1']), zzJobIds, devHidesZz: true })).toBe(1)
  })
  it('is zero for anyone whose switch does not hide them: every other role, a dev who shows them', () => {
    expect(countStagesZzHeldBack({ lookupIds: new Set(['z1']), zzJobIds, devHidesZz: false })).toBe(0)
  })
  it('a cache with no ids to read is zero', () => {
    expect(countStagesZzHeldBack({ lookupIds: new Set(['z1']), zzJobIds: undefined, devHidesZz: true })).toBe(0)
  })
})

describe('stagesSearchHeldBackLines', () => {
  const base = { searchActive: true, heldBackCount: 0, showingHeldBack: false, zzHeldBackCount: 0 }

  it('is silent with nothing held back, and with no search', () => {
    expect(stagesSearchHeldBackLines(base)).toEqual([])
    expect(stagesSearchHeldBackLines({ ...base, searchActive: false, heldBackCount: 3, zzHeldBackCount: 1 })).toEqual([])
  })

  it('names the count and the press, one and many', () => {
    expect(stagesSearchHeldBackLines({ ...base, heldBackCount: 1 })).toEqual([{ kind: 'filters', main: '1 match is hidden by your filters.', press: 'Show it' }])
    expect(stagesSearchHeldBackLines({ ...base, heldBackCount: 2 })).toEqual([{ kind: 'filters', main: '2 matches are hidden by your filters.', press: 'Show them' }])
  })

  it('while they show, says so and offers the way back', () => {
    expect(stagesSearchHeldBackLines({ ...base, heldBackCount: 1, showingHeldBack: true })).toEqual([{ kind: 'showing', main: 'Showing 1 match your filters hide.', press: 'Hide it' }])
    expect(stagesSearchHeldBackLines({ ...base, heldBackCount: 2, showingHeldBack: true })).toEqual([{ kind: 'showing', main: 'Showing 2 matches your filters hide.', press: 'Hide them' }])
  })

  it('showing with nothing behind the filters any more says nothing', () => {
    expect(stagesSearchHeldBackLines({ ...base, showingHeldBack: true })).toEqual([])
  })

  it('a dev’s ZZ matches get their own line, whose press goes to the switch', () => {
    expect(stagesSearchHeldBackLines({ ...base, zzHeldBackCount: 1 })).toEqual([{ kind: 'zz', main: '1 match is a ZZ test job.', press: 'Open Hide groups' }])
    expect(stagesSearchHeldBackLines({ ...base, heldBackCount: 2, zzHeldBackCount: 3 }).map((l) => l.main)).toEqual(['2 matches are hidden by your filters.', '3 matches are ZZ test jobs.'])
  })

  it('every sentence is plain words', () => {
    const all = [
      ...stagesSearchHeldBackLines({ ...base, heldBackCount: 1, zzHeldBackCount: 1 }),
      ...stagesSearchHeldBackLines({ ...base, heldBackCount: 12, zzHeldBackCount: 12 }),
      ...stagesSearchHeldBackLines({ ...base, heldBackCount: 1, showingHeldBack: true }),
      ...stagesSearchHeldBackLines({ ...base, heldBackCount: 12, showingHeldBack: true }),
    ]
    expect(all.flatMap((l) => plainWordsFailures(l.main))).toEqual([])
  })
})
