import { describe, expect, it } from 'vitest'
import { courtesyByJobFrom, type CourtesyDeskSource } from './lienCourtesyDesk'
import type { LetterTwoStatus } from './lienLetterTwo'

const lt = (day: number, firstItemId = 'first'): LetterTwoStatus => ({ state: day >= 10 ? 'due' : 'waiting', day, clock: { kind: 'recorded', at: '2026-10-24T15:00:00Z', why: '' }, firstItemId, firstSentAt: '2026-10-24T15:00:00Z', letterTwo: null, gcAuthorized: null, words: `day ${day}` })

const base: CourtesyDeskSource = {
  todayYmd: '2026-11-02',
  letterTwoByJob: { j1: lt(9) },
  items: [{ id: 'first', months: ['2026-08'], fields: { notice: {} } }],
  entries: [{ jobId: 'j1', months: [{ key: '2026-08' }, { key: '2026-09' }] as never, propertyKind: 'non_residential', datedFromCreation: false }],
  jobsById: { j1: { revenue: 4850, payments_made: 0, customer_address_id: 'a1' } },
  addressesById: { a1: { property_kind: 'non_residential', homestead: false } },
  affidavits: [],
  filingsByJob: {},
}

describe('courtesyByJobFrom — the desk’s courtesy status per job', () => {
  it('names the affidavit’s day from the notice’s last month when the desk’s affidavit list does not reach the job', () => {
    const out = courtesyByJobFrom(base)
    // September on a commercial job: the 15th of the fourth month after, January 15 2027.
    expect(out.j1!).toMatchObject({ state: 'due', lienDay: '2027-01-15', words: 'day 9 · nothing since the packet' })
  })

  it('takes the desk’s affidavit entry first, and its homestead gate', () => {
    const out = courtesyByJobFrom({ ...base, affidavits: [{ jobId: 'j1', deadline: '2026-12-15', propertyKind: 'non_residential', lastMonthFromCreation: false, gates: [{ key: 'homestead', ok: false }] }] })
    expect(out.j1!.state).toBe('held')
    expect(out.j1!.reason).toMatch(/homestead/)
    const fine = courtesyByJobFrom({ ...base, affidavits: [{ jobId: 'j1', deadline: '2026-12-15', propertyKind: 'non_residential', lastMonthFromCreation: false, gates: [{ key: 'homestead', ok: true }] }] })
    expect(fine.j1!).toMatchObject({ state: 'due', lienDay: '2026-12-15' })
  })

  it('reads the property record’s homestead flag, a filed affidavit, the balance and the records on the first packet', () => {
    expect(courtesyByJobFrom({ ...base, addressesById: { a1: { property_kind: 'non_residential', homestead: true } } }).j1!.state).toBe('held')
    expect(courtesyByJobFrom({ ...base, filingsByJob: { j1: [{ kind: 'affidavit', filed_at: '2026-11-01', voided_at: null }] } }).j1!).toMatchObject({ state: 'closed', reason: 'the affidavit is filed · served next' })
    expect(courtesyByJobFrom({ ...base, jobsById: { j1: { revenue: 4850, payments_made: 4850, customer_address_id: 'a1' } } }).j1!).toMatchObject({ state: 'closed', reason: 'paid' })
    const sent = courtesyByJobFrom({ ...base, items: [{ id: 'first', months: ['2026-08'], fields: { courtesy: [{ at: '2026-10-31T14:00:00Z', by: 'Grace', lienDay: '2027-01-15', claim: 4850, to: [{ who: 'original_contractor', channel: 'email', address: 'x@y.example', ok: true, id: 'e1', reason: '' }] }] } }] })
    expect(sent.j1!).toMatchObject({ state: 'sent', lastSentAt: '2026-10-31T14:00:00Z' })
  })

  it('a job with no approved month reads held, as the demand letter does; a job without a sent notice is not listed', () => {
    const creation = courtesyByJobFrom({ ...base, entries: [{ jobId: 'j1', months: [{ key: '2026-10' }] as never, propertyKind: '', datedFromCreation: true }] })
    expect(creation.j1!).toMatchObject({ state: 'held', reason: 'no approved work month on the job yet — the filing window cannot be computed' })
    expect(Object.keys(courtesyByJobFrom({ ...base, letterTwoByJob: {} }))).toEqual([])
  })
})
