/**
 * v2.8315 (punch list #85, a review residual): the lien grid's *Paid out to GC* and *10 % reserved* stayed
 * blank after the owner answered. The two columns read the owner's call as four facts.
 */
import { describe, expect, it } from 'vitest'
import { LIEN_OWNER_FACT_KEYS, lienOwnerFactsByJob, lienOwnerFactsFromCall, lienOwnerFactsWords, parseLienOwnerFacts, parseLienOwnerFactsByJob, withSampleOwnerFacts } from '../../../supabase/functions/_shared/lienOwnerFacts'
import { sampleLegalPortalResponse } from '../../../supabase/functions/_shared/customerSampleFixtures'
import { ownerCallByJobFrom } from './lienOwnerCall'
import type { LienDeskItemRow } from './lienDesk'

const fmt = { day: (ymd: string) => `on ${ymd}`, money: (n: number) => `$${n.toLocaleString('en-US')}` }
const call = (over: Record<string, unknown> = {}) => ({ at: '2026-10-01T16:30:00Z', name: 'Taunya', owesGc: 'yes', owesAmount: 12_000, reserved: 'held', originalContractCompletedOn: null, note: 'Jordan called after the letter.', ...over })
const item = (job_id: string, fields: unknown, over: Record<string, unknown> = {}) => ({ id: `i-${job_id}`, job_id, kind: 'notice_53_056', voided_at: null, fields, ...over })

describe('the facts off one call', () => {
  it('reads paid out as the other side of still owes, and keeps the figure only when the owner still owes', () => {
    expect(lienOwnerFactsFromCall(call())).toEqual({ paidOut: 'no', owesAmount: 12_000, reserved: 'held', releasedOn: null })
    expect(lienOwnerFactsFromCall(call({ owesGc: 'no', owesAmount: 500, reserved: 'never' }))).toEqual({ paidOut: 'yes', owesAmount: null, reserved: 'never', releasedOn: null })
    expect(lienOwnerFactsFromCall(call({ owesGc: 'unknown', reserved: 'released', releasedOn: '2026-09-03' }))).toEqual({ paidOut: 'unknown', owesAmount: null, reserved: 'released', releasedOn: '2026-09-03' })
    expect(lienOwnerFactsFromCall(call({ reserved: 'held', releasedOn: '2026-09-03' }))?.releasedOn).toBeNull()
  })

  it('is null with no call, and carries only its four keys', () => {
    expect(lienOwnerFactsFromCall(null)).toBeNull()
    expect(lienOwnerFactsFromCall({ owesGc: 'yes' })).toBeNull()
    expect(Object.keys(lienOwnerFactsFromCall(call())!)).toEqual([...LIEN_OWNER_FACT_KEYS])
  })
})

describe('each job’s latest call', () => {
  it('takes the newest call on a live § 53.056 notice, without needing the notice’s draft block', () => {
    const facts = lienOwnerFactsByJob([
      item('j1', { ownerCall: call({ at: '2026-09-20T15:00:00Z', owesGc: 'yes', owesAmount: 20_000 }) }),
      item('j1', { ownerCall: call({ at: '2026-10-02T15:00:00Z', owesGc: 'no', reserved: 'released', releasedOn: '2026-09-28' }) }, { id: 'i-j1-b' }),
      item('j2', { ownerCall: call() }, { voided_at: '2026-10-03T00:00:00Z' }),
      item('j3', { ownerCall: call() }, { kind: 'affidavit' }),
      item('j4', { letterTwo: null }),
      item('j5', null),
    ])
    expect(facts).toEqual({ j1: { paidOut: 'yes', owesAmount: null, reserved: 'released', releasedOn: '2026-09-28' } })
  })

  it('agrees with the desk’s own pick on a full item', () => {
    const full = { ...item('j1', { notice: { ownerName: 'Elwick Holdings LLC' }, ownerCall: call() }), status: 'sent', months: ['2026-07'] } as unknown as LienDeskItemRow
    const desk = ownerCallByJobFrom([full]).j1!
    expect(lienOwnerFactsByJob([full]).j1).toEqual({ paidOut: desk.owesGc === 'yes' ? 'no' : 'yes', owesAmount: desk.owesAmount, reserved: desk.reserved, releasedOn: null })
  })
})

describe('the two cells in words', () => {
  it('words an answer, and leaves a blank where there is none', () => {
    expect(lienOwnerFactsWords({ paidOut: 'no', owesAmount: 12_000, reserved: 'held', releasedOn: null }, fmt)).toEqual({ paidOut: 'no · $12,000 owed', reserved: 'yes · held' })
    expect(lienOwnerFactsWords({ paidOut: 'no', owesAmount: null, reserved: 'never', releasedOn: null }, fmt)).toEqual({ paidOut: 'no', reserved: 'never' })
    expect(lienOwnerFactsWords({ paidOut: 'yes', owesAmount: null, reserved: 'released', releasedOn: '2026-09-03' }, fmt)).toEqual({ paidOut: 'yes', reserved: 'released on 2026-09-03' })
    expect(lienOwnerFactsWords({ paidOut: 'yes', owesAmount: null, reserved: 'released', releasedOn: null }, fmt).reserved).toBe('released')
    expect(lienOwnerFactsWords({ paidOut: 'unknown', owesAmount: null, reserved: 'unknown', releasedOn: null }, fmt)).toEqual({ paidOut: '', reserved: '' })
    expect(lienOwnerFactsWords(null, fmt)).toEqual({ paidOut: '', reserved: '' })
  })
})

describe('the facts as the portal’s payload carries them', () => {
  it('cuts each to its four keys and drops anything else', () => {
    expect(parseLienOwnerFacts({ paidOut: 'no', owesAmount: 12_000, reserved: 'held', releasedOn: null, note: 'private', name: 'Taunya' })).toEqual({ paidOut: 'no', owesAmount: 12_000, reserved: 'held', releasedOn: null })
    expect(parseLienOwnerFacts({ paidOut: 'maybe', owesAmount: 'lots', reserved: 'gone', releasedOn: 'soon' })).toEqual({ paidOut: 'unknown', owesAmount: null, reserved: 'unknown', releasedOn: null })
    expect(parseLienOwnerFacts('x')).toBeNull()
    expect(parseLienOwnerFactsByJob({ j1: { paidOut: 'yes', reserved: 'never' }, j2: 'x' })).toEqual({ j1: { paidOut: 'yes', owesAmount: null, reserved: 'never', releasedOn: null } })
    expect(parseLienOwnerFactsByJob(null)).toEqual({})
  })
})

describe('the sample', () => {
  it('reads its book’s facts off the sample matter’s own notice item, so the grid and the Paper tab tell one story', () => {
    const sample = sampleLegalPortalResponse({ name: 'Acme Mechanical' } as never, '2026-11-22') as unknown as { lienBook: { ownerFacts?: unknown }; matters: Array<{ jobs: Array<{ id: string }> }> }
    expect(sample.lienBook.ownerFacts).toBeUndefined()
    const withFacts = withSampleOwnerFacts(sample)
    const matterJob = sample.matters[0]!.jobs[0]!.id
    expect(withFacts.lienBook.ownerFacts).toEqual({ [matterJob]: { paidOut: 'no', owesAmount: 12_000, reserved: 'held', releasedOn: null } })
    // The fixture itself is untouched, and a payload with no book passes through.
    expect(sample.lienBook.ownerFacts).toBeUndefined()
    expect(withSampleOwnerFacts({ matters: [] })).toEqual({ matters: [] })
    expect(withSampleOwnerFacts(null)).toBeNull()
  })
})
