import { describe, expect, it } from 'vitest'
import { BENCH_REMOVE_CONFIRM, BENCH_REMOVE_PRESS, benchRemoveConfirmWords, benchRemoveHold, canRemoveFromBench } from './benchRemove'
import type { Partner } from './types'

/** A company just added from Prospects: the row, its contact, nothing else. */
function fresh(over: Partial<Partner> = {}): Partner {
  return {
    id: 'zz',
    company: 'ZZ Test Sprinkler Co',
    contact: 'Pat Test',
    trades: ['Fire sprinkler'],
    base: null,
    maxMiles: null,
    msa: 'none',
    msaSignedOn: null,
    coiExpires: null,
    w9: false,
    invited: 0,
    bids: 0,
    won: 0,
    promisesMade: 0,
    promisesKept: 0,
    vetting: { status: 'new' },
    ...over,
  }
}

describe('benchRemoveHold · v2.6749 (punch list #153)', () => {
  it('a company with no history may go: new to us with no form is not history', () => {
    expect(benchRemoveHold(fresh())).toBeNull()
    expect(canRemoveFromBench(fresh())).toBe(true)
    // A company we know (no vetting record) with nothing else may go too.
    const { vetting: _v, ...known } = fresh()
    expect(benchRemoveHold(known as Partner)).toBeNull()
  })

  it('the card’s four: a work order, a quote, an ask or a logged contact holds it, the heaviest named first', () => {
    expect(benchRemoveHold(fresh({ invited: 1 }))).toBe('They were asked to quote.')
    expect(benchRemoveHold(fresh({ invited: 2, bids: 1 }))).toBe('They quoted for us.')
    expect(benchRemoveHold(fresh({ invited: 2, bids: 1, won: 1 }))).toBe('They hold a work order with us.')
    expect(benchRemoveHold(fresh({ contacts: [{ on: '2026-11-08', by: 'Rosa', note: 'Met at the pre-bid.' }] }))).toBe('A contact is logged on them.')
    expect(canRemoveFromBench(fresh({ invited: 1 }))).toBe(false)
  })

  it('the rest of a record holds it too: a promise, papers either way, an opened portal, their form', () => {
    expect(benchRemoveHold(fresh({ promisesMade: 1 }))).toBe('They gave us a promise.')
    expect(benchRemoveHold(fresh({ msa: 'sent' }))).toBe('Papers went to them or came in.')
    expect(benchRemoveHold(fresh({ msaSentOn: '2026-11-01' }))).toBe('Papers went to them or came in.')
    expect(benchRemoveHold(fresh({ w9: true }))).toBe('Papers went to them or came in.')
    expect(benchRemoveHold(fresh({ w9SentOn: '2026-11-01' }))).toBe('Papers went to them or came in.')
    expect(benchRemoveHold(fresh({ coiExpires: '2027-06-30' }))).toBe('Papers went to them or came in.')
    expect(benchRemoveHold(fresh({ coiReceived: { id: 'f1', sentOn: '2026-11-01', expires: null } }))).toBe('Papers went to them or came in.')
    expect(benchRemoveHold(fresh({ portalOpenedOn: '2026-11-02' }))).toBe('They opened their portal.')
    expect(benchRemoveHold(fresh({ vetting: { status: 'new', form: { license: 'TX 1', insurance: '', yearsInBusiness: 3, references: '', pastJobs: '', sentOn: '2026-11-03' } } }))).toBe('They sent us their form.')
  })

  it('the press and the confirm name the act; the confirm says where a Prospects sub goes', () => {
    expect(BENCH_REMOVE_PRESS).toBe('Remove from the bench…')
    expect(BENCH_REMOVE_CONFIRM).toBe('Remove from the bench')
    const own = benchRemoveConfirmWords('Alamo Sprinkler Co', false)
    expect(own.title).toBe('Remove Alamo Sprinkler Co from the bench?')
    expect(own.message).toBe('Alamo Sprinkler Co has no quote, no ask, no work order and no contact logged. Their row leaves Trade partners.')
    expect(own.confirmLabel).toBe('Remove from the bench')
    const sub = benchRemoveConfirmWords('Alamo Sprinkler Co', true)
    expect(sub.message.endsWith(' Their card goes back on Prospects → Subs to call again.')).toBe(true)
    // Plain words: no sentence over 20 words, none joined by a dash or a semicolon.
    for (const s of sub.message.split(/(?<=\.)\s+/)) {
      expect(s.split(/\s+/).length).toBeLessThanOrEqual(20)
      expect(s).not.toMatch(/[;—]/)
    }
  })
})
