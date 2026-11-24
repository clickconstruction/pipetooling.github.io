import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { plainSentence } from '../valuesInPlace'
import type { LienPayoffAffidavit, LienPayoffPayment, LienPayoffRelease } from './lienPayoff'
import { RELEASE_OF_RECORD_WORDS, pickReleaseTarget, releaseMoneyGate, releasePaymentDay, releaseRecordedSentence, releaseSaveFields, releaseStampDayCheck, releaseStampPatch, releaseTargets } from './lienReleaseOfRecord'

// Every job, instrument and amount here is made up.
const TODAY = '2026-11-24'
const aff = (over: Partial<LienPayoffAffidavit> = {}): LienPayoffAffidavit => ({ id: 'a1', job_id: 'j1', amount: 7420, county: 'Travis', recording_number: '2026-0412207', filed_at: '2026-11-09', ...over })
const rel = (over: Partial<LienPayoffRelease> = {}): LienPayoffRelease => ({ id: 'r1', job_id: 'j1', created_at: '2026-11-24T18:00:00Z', filed_at: null, recording_number: '2026-0412207', fields: {}, ...over })
const check = (over: Partial<LienPayoffPayment> = {}): LienPayoffPayment => ({ amount: 7420, paid_on: '2026-11-24', payment_type: 'Check', reference_number: '1184', ...over })

describe('releaseTargets and the pick', () => {
  it('gives each filed lien its own release, oldest filing first, and leaves out a draft', () => {
    const second = aff({ id: 'a2', recording_number: '2026-0500001', filed_at: '2026-11-16' })
    const targets = releaseTargets([second, aff(), aff({ id: 'draft', filed_at: null })], [rel({ fields: { releasesFilingId: 'a2' }, filed_at: '2026-12-03' })])
    expect(targets.map((t) => [t.affidavit.id, t.state])).toEqual([
      ['a1', 'none'],
      ['a2', 'recorded'],
    ])
  })

  it('reads a saved release as made until the county’s day is on it', () => {
    expect(releaseTargets([aff()], [rel()])[0]!.state).toBe('made')
    expect(releaseTargets([aff()], [rel({ filed_at: '2026-12-03' })])[0]!.state).toBe('recorded')
    expect(releaseTargets([], [rel()])).toEqual([])
  })

  it('opens on the lien picked, else the first still to record, else the first', () => {
    const targets = releaseTargets([aff(), aff({ id: 'a2', recording_number: '2026-0500001', filed_at: '2026-11-16' })], [rel({ filed_at: '2026-12-03' })])
    expect(pickReleaseTarget(targets, null)?.affidavit.id).toBe('a2')
    expect(pickReleaseTarget(targets, 'a1')?.affidavit.id).toBe('a1')
    expect(pickReleaseTarget(targets, 'gone')?.affidavit.id).toBe('a2')
    expect(pickReleaseTarget(releaseTargets([aff()], [rel({ filed_at: '2026-12-03' })]), null)?.affidavit.id).toBe('a1')
    expect(pickReleaseTarget([], null)).toBeNull()
  })
})

describe('releaseMoneyGate', () => {
  const gate = (over: Partial<Parameters<typeof releaseMoneyGate>[0]> = {}) => releaseMoneyGate({ open: 0, payments: [], todayYmd: TODAY, anywayReason: '', ...over })

  it('holds the release while the bills still owe', () => {
    const g = gate({ open: 1455.5 })
    expect(g).toMatchObject({ hold: true, tone: 'red' })
    expect(plainSentence(g.say)).toBe('$1,455.50 is still open on this job’s bills. Record the payment first.')
  })

  it('lets it go with a reason, and still says what is open', () => {
    const g = gate({ open: 1455.5, anywayReason: ' settled for less ' })
    expect(g).toMatchObject({ hold: false, tone: 'amber' })
    expect(plainSentence(g.say)).toBe('$1,455.50 is still open on this job’s bills. The release goes out anyway.')
    expect(gate({ open: 1455.5, anywayReason: '   ' }).hold).toBe(true)
  })

  it('only warns while a check clears, and is green once it has', () => {
    const clearing = gate({ payments: [check()] })
    expect(clearing).toMatchObject({ hold: false, tone: 'amber' })
    expect(plainSentence(clearing.say)).toBe('Paid Nov 24 by check 1184. The check clears about Dec 1.')
    const cleared = gate({ payments: [check()], todayYmd: '2026-12-01' })
    expect(cleared).toMatchObject({ hold: false, tone: 'green' })
    expect(plainSentence(cleared.say)).toBe('Paid Nov 24 by check 1184.')
    expect(plainSentence(gate({ payments: [check({ payment_type: 'Cash', reference_number: null })] }).say)).toBe('Paid Nov 24 by cash.')
    expect(plainSentence(gate().say)).toBe('The bills read paid.')
  })

  it('keeps every sentence to plain words', () => {
    for (const g of [gate({ open: 9 }), gate({ open: 9, anywayReason: 'x' }), gate({ payments: [check()] }), gate()]) expect(plainWordsFailures(plainSentence(g.say))).toEqual([])
    expect(plainWordsFailures(RELEASE_OF_RECORD_WORDS.saved)).toEqual([])
  })
})

describe('the paper’s date, its saved fields and the county’s stamp', () => {
  it('starts the payment date on the last payment, or today', () => {
    expect(releasePaymentDay([check({ paid_on: '2026-11-20' }), check({ paid_on: '2026-11-22' })], TODAY)).toBe('2026-11-22')
    expect(releasePaymentDay([], TODAY)).toBe(TODAY)
  })

  it('saves the affidavit the release names, and the reason only when one was typed', () => {
    expect(releaseSaveFields({ county: 'Travis' }, 'a1', '')).toEqual({ county: 'Travis', releasesFilingId: 'a1' })
    expect(releaseSaveFields({ county: 'Travis' }, 'a1', ' settled ')).toEqual({ county: 'Travis', releasesFilingId: 'a1', releasedUnpaidReason: 'settled' })
  })

  it('patches the day and the instrument apart, and keeps the paper’s other fields', () => {
    const saved = rel({ fields: { releasesFilingId: 'a1', paymentDate: '2026-11-24' } })
    expect(releaseStampPatch(saved, { day: '2026-12-03' })).toEqual({ filed_at: '2026-12-03' })
    expect(releaseStampPatch(saved, { instrument: ' 2026-0431955 ' })).toEqual({ fields: { releasesFilingId: 'a1', paymentDate: '2026-11-24', releaseInstrument: '2026-0431955' } })
    expect(releaseStampPatch(rel({ fields: { releaseInstrument: 'x', paymentDate: 'p' } }), { instrument: '', day: '' })).toEqual({ filed_at: null, fields: { paymentDate: 'p' } })
    expect(releaseStampPatch(rel({ fields: null }), { instrument: '7' })).toEqual({ fields: { releaseInstrument: '7' } })
  })

  it('refuses a recorded day still to come, or before the lien was filed', () => {
    expect(releaseStampDayCheck('2026-11-25', '2026-11-09', TODAY)).toBe(RELEASE_OF_RECORD_WORDS.futureDay)
    expect(releaseStampDayCheck('2026-11-08', '2026-11-09', TODAY)).toBe(RELEASE_OF_RECORD_WORDS.beforeLien)
    expect(releaseStampDayCheck('2026-11-24', '2026-11-09', TODAY)).toBeNull()
    expect(releaseStampDayCheck('', '2026-11-09', TODAY)).toBeNull()
  })

  it('says a recorded release in one line', () => {
    expect(releaseRecordedSentence(rel())).toBeNull()
    expect(plainSentence(releaseRecordedSentence(rel({ filed_at: '2026-12-03' })) ?? '')).toBe('Released. The county recorded it Dec 3.')
    expect(plainSentence(releaseRecordedSentence(rel({ filed_at: '2026-12-03', fields: { releaseInstrument: '2026-0431955' } })) ?? '')).toBe('Released. The county recorded it Dec 3 as 2026-0431955.')
  })
})
