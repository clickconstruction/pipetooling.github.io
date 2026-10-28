import { describe, expect, it } from 'vitest'
import type { PaySpeedData } from './billedExpectedPay'
import { PACE_RULES_DEFAULT, paceContextFor, paceInputFor, readsAsGc, sentFromHereOf } from './payPace'

// `gcPaceHere` and `paceFor` are held by collectPile.test.ts under the pile's names; this file holds the facts' side.
const speeds: PaySpeedData = {
  company: { medianDays: 7, samples: 286 },
  customers: { 'c-rmc': { medianDays: 35, samples: 4 }, 'c-harper': { medianDays: 74, samples: 1 } },
  segments: { residential: { medianDays: 2, samples: 136 }, commercial: { medianDays: 12, samples: 150 } },
  customerTypes: { 'c-structura': 'commercial', 'c-rmc': 'commercial', 'c-harper': 'commercial', 'c-tom': 'residential' },
  receipts: {},
  quality: null,
}
const facts = { gcPayerIds: new Set(['c-rmc', 'c-harper', 'c-southern']), payAppJobIds: new Set(['j-spacex']) }

describe('readsAsGc (decision 1)', () => {
  const args = { paySpeeds: speeds, facts, rules: PACE_RULES_DEFAULT }
  it('by record, by a pay application on the job, or by a commercial payer’s hand-marked bill', () => {
    expect(readsAsGc({ payerId: 'c-rmc', jobId: 'j-1' }, args)).toEqual({ isGc: true, gcByRecord: true })
    expect(readsAsGc({ payerId: 'c-structura', jobId: 'j-spacex' }, args)).toEqual({ isGc: true, gcByRecord: false })
    expect(readsAsGc({ payerId: 'c-structura', jobId: 'j-2', sentFromHere: false }, args)).toEqual({ isGc: true, gcByRecord: false })
    expect(readsAsGc({ payerId: 'c-structura', jobId: 'j-2', sentFromHere: true }, args)).toEqual({ isGc: false, gcByRecord: false })
    expect(readsAsGc({ payerId: 'c-structura', jobId: 'j-2', sentFromHere: null }, args)).toEqual({ isGc: false, gcByRecord: false })
    // A residential payer's hand-marked bill is not a pay application.
    expect(readsAsGc({ payerId: 'c-tom', jobId: 'j-3', sentFromHere: false }, args).isGc).toBe(false)
    expect(readsAsGc({ payerId: null, jobId: null }, args)).toEqual({ isGc: false, gcByRecord: false })
  })
  it('each of the two inferred rules can be turned off', () => {
    expect(readsAsGc({ payerId: 'c-structura', jobId: 'j-spacex' }, { ...args, rules: { ...PACE_RULES_DEFAULT, gcByPayApp: false } }).isGc).toBe(false)
    expect(readsAsGc({ payerId: 'c-structura', jobId: 'j-2', sentFromHere: false }, { ...args, rules: { ...PACE_RULES_DEFAULT, gcByHandMarked: false } }).isGc).toBe(false)
  })
})

describe('sentFromHereOf', () => {
  it('a send stamp is yes, none is marked by hand, an absent column or row is unknown', () => {
    expect(sentFromHereOf({ sent_to_customer_at: '2026-10-01T15:00:00Z' })).toBe(true)
    expect(sentFromHereOf({ sent_to_customer_at: null })).toBe(false)
    expect(sentFromHereOf({ id: 'lean' })).toBeNull()
    expect(sentFromHereOf({ sent_to_customer_at: undefined })).toBeNull()
    expect(sentFromHereOf(null)).toBeNull()
  })
})

describe('paceContextFor / paceInputFor', () => {
  it('rests the GC pace on the GC payers among the bills given, and hands each bill its input', () => {
    const ctx = paceContextFor({ facts, paySpeeds: speeds, payerIds: ['c-structura', 'c-rmc', 'c-harper', null, 'c-tom'] })!
    expect(ctx.gcPace).toEqual({ medianDays: 55, samples: 5 })
    expect(ctx.gcPacePayers).toBe(2)
    expect(ctx.rules).toEqual(PACE_RULES_DEFAULT)
    expect(paceInputFor(ctx, { payerId: 'c-structura', jobId: 'j-spacex' }, speeds)).toEqual({ isGc: true, gcPace: { medianDays: 55, samples: 5 }, gcPacePayers: 2, rules: PACE_RULES_DEFAULT })
    expect(paceInputFor(ctx, { payerId: 'c-tom', jobId: 'j-3' }, speeds)?.isGc).toBe(false)
    // Only the GC payers among these bills: Harper alone reads 74 over one payer.
    expect(paceContextFor({ facts, paySpeeds: speeds, payerIds: ['c-harper', 'c-structura'] })).toMatchObject({ gcPace: { medianDays: 74, samples: 1 }, gcPacePayers: 1 })
  })
  it('is null without the facts, and so is the input, which reads the payer as one that is not a GC', () => {
    expect(paceContextFor({ facts: null, paySpeeds: speeds, payerIds: ['c-rmc'] })).toBeNull()
    expect(paceInputFor(null, { payerId: 'c-rmc', jobId: 'j-1' }, speeds)).toBeNull()
  })
  it('takes the rules as an input', () => {
    const ctx = paceContextFor({ facts, paySpeeds: speeds, payerIds: ['c-rmc', 'c-harper'], rules: { minSamples: 2 } })!
    expect(ctx).toMatchObject({ gcPace: { medianDays: 35, samples: 4 }, gcPacePayers: 1 })
    expect(ctx.rules.minSamples).toBe(2)
  })
})
