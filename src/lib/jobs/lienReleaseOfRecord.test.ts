import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { plainSentence } from '../valuesInPlace'
import type { LienPayoffAffidavit, LienPayoffPayment, LienPayoffRelease } from './lienPayoff'
import type { BankCheck } from './checkCleared'
import { RELEASE_OF_RECORD_WORDS, pickReleaseTarget, releaseMoneyBackWords, releaseMoneyGate, releaseNeedsBank, releasePaymentDay, releaseRecordedSentence, releaseSaveFields, releaseStampDayCheck, releaseStampPatch, releaseTargets } from './lienReleaseOfRecord'

// Every job, instrument and amount here is made up.
const TODAY = '2026-11-24'
const aff = (over: Partial<LienPayoffAffidavit> = {}): LienPayoffAffidavit => ({ id: 'a1', job_id: 'j1', amount: 7420, county: 'Travis', recording_number: '2026-0412207', filed_at: '2026-11-09', ...over })
const rel = (over: Partial<LienPayoffRelease> = {}): LienPayoffRelease => ({ id: 'r1', job_id: 'j1', created_at: '2026-11-24T18:00:00Z', filed_at: null, recording_number: '2026-0412207', fields: {}, ...over })
const bank = (over: Partial<BankCheck> = {}): BankCheck => ({ id: 'b1', amount: 16455.5, status: 'pending', depositedYmd: '2026-11-24', postedYmd: null, bankDayYmd: '2026-12-02', checkNumber: '01184', failureReason: null, ...over })
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
  const gate = (over: Partial<Parameters<typeof releaseMoneyGate>[0]> = {}) => releaseMoneyGate({ open: 0, payments: [], todayYmd: TODAY, anywayReason: '', bank: [], ...over })

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

  it('is green for money that needs no bank', () => {
    expect(gate({ payments: [check({ payment_type: 'Cash', reference_number: null })] })).toMatchObject({ hold: false, tone: 'green', why: null })
    expect(plainSentence(gate({ payments: [check({ payment_type: 'Cash', reference_number: null })] }).say)).toBe('Paid Nov 24 by cash.')
    expect(plainSentence(gate().say)).toBe('The bills read paid.')
  })

  it('holds the release while the bank has not cleared the check', () => {
    const atBank = gate({ payments: [check()], bank: [bank()] })
    expect(atBank).toMatchObject({ hold: true, tone: 'amber', why: 'check' })
    expect(plainSentence(atBank.say)).toBe('Paid Nov 24 by check 1184. Check 1184 is at the bank. The bank says it clears Dec 2. The release waits until then.')
    // Posted is not cleared.
    const posted = gate({ payments: [check()], bank: [bank({ status: 'sent', postedYmd: '2026-11-25' })], todayYmd: '2026-12-01' })
    expect(posted.hold).toBe(true)
    expect(plainSentence(posted.say)).toBe('Paid Nov 24 by check 1184. The bank posted check 1184 on Nov 25. It can still come back until Dec 2. The release waits until then.')
    const back = gate({ payments: [check()], bank: [bank({ status: 'failed', failureReason: 'Insufficient funds' })] })
    expect(back).toMatchObject({ hold: true, tone: 'red', why: 'check' })
  })

  it('is green the day the bank clears the check', () => {
    const cleared = gate({ payments: [check()], bank: [bank({ status: 'sent', postedYmd: '2026-11-25' })], todayYmd: '2026-12-02' })
    expect(cleared).toMatchObject({ hold: false, tone: 'green', why: null })
    expect(plainSentence(cleared.say)).toBe('Paid Nov 24 by check 1184.')
  })

  it('waits seven days from the day typed when the bank shows no deposit', () => {
    const waiting = gate({ payments: [check()] })
    expect(waiting).toMatchObject({ hold: true, tone: 'amber', why: 'check' })
    expect(plainSentence(waiting.say)).toBe('Paid Nov 24 by check 1184. The bank shows no deposit of check 1184. Without one it counts as cleared Dec 1. The release waits until then.')
    expect(gate({ payments: [check()], todayYmd: '2026-12-01' })).toMatchObject({ hold: false, tone: 'green' })
  })

  it('lets a release go before the check clears with a typed reason, and says so', () => {
    const g = gate({ payments: [check()], bank: [bank()], anywayReason: 'a cashier’s check' })
    expect(g).toMatchObject({ hold: false, tone: 'amber', why: 'check' })
    expect(plainSentence(g.say)).toBe('Paid Nov 24 by check 1184. Check 1184 is at the bank. The bank says it clears Dec 2. The release goes out anyway.')
  })

  it('holds while the bank is being asked, and when the bank could not be read', () => {
    const asking = gate({ payments: [check()], bank: undefined })
    expect(asking).toMatchObject({ hold: true, tone: 'amber', why: 'check' })
    expect(plainSentence(asking.say)).toBe('Paid Nov 24 by check 1184. Asking the bank about it.')
    const unread = gate({ payments: [check()], bank: null })
    expect(unread.hold).toBe(true)
    expect(plainSentence(unread.say)).toBe('Paid Nov 24 by check 1184. The bank’s record could not be read. Open this tab again.')
    // Money that needs no bank, an old check, or bills still open: the bank is not asked.
    expect(gate({ payments: [check({ payment_type: 'Cash' })], bank: undefined }).hold).toBe(false)
    expect(gate({ payments: [check({ paid_on: '2026-08-01' })], bank: undefined }).hold).toBe(false)
    expect(releaseNeedsBank(0, [check()], TODAY)).toBe(true)
    expect(releaseNeedsBank(0, [check({ payment_type: 'Cash' })], TODAY)).toBe(false)
    expect(releaseNeedsBank(0, [check({ paid_on: '2026-08-01' })], TODAY)).toBe(false)
    expect(releaseNeedsBank(300, [check()], TODAY)).toBe(false)
    expect(releaseNeedsBank(0, [], TODAY)).toBe(false)
  })

  it('keeps every sentence to plain words', () => {
    for (const g of [gate({ open: 9 }), gate({ open: 9, anywayReason: 'x' }), gate({ payments: [check()] }), gate({ payments: [check()], bank: [bank()] }), gate({ payments: [check()], bank: [bank()], anywayReason: 'x' }), gate({ payments: [check()], bank: undefined }), gate({ payments: [check()], bank: null }), gate()]) expect(plainWordsFailures(plainSentence(g.say))).toEqual([])
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
    // Released before the check cleared: the reason is kept under its own name.
    expect(releaseSaveFields({}, 'a1', ' a cashier’s check ', 'check')).toEqual({ releasesFilingId: 'a1', releasedBeforeClearedReason: 'a cashier’s check' })
    expect(releaseSaveFields({}, 'a1', 'stale', null)).toEqual({ releasesFilingId: 'a1' })
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

describe('the funds confirmed (punch list #435, piece 4)', () => {
  const FUNDS = { by: 'u1', name: 'Alex Rivera', at: '2026-11-26T15:04:00Z', note: 'the funds are good' }

  it('lets the release go before the bank’s day on a confirmation, and says whose word it rests on', () => {
    const g = releaseMoneyGate({ open: 0, payments: [check()], todayYmd: TODAY, anywayReason: '', bank: [bank()], funds: FUNDS })
    expect(g.hold).toBe(false)
    expect(g.tone).toBe('green')
    expect(g.why).toBeNull()
    expect(plainSentence(g.say)).toBe('Paid Nov 24 by check 1184. Alex Rivera confirmed the funds Nov 26.')
    expect(plainWordsFailures(plainSentence(g.say))).toEqual([])
  })

  it('still holds on a check that came back, and while the bank is being asked', () => {
    expect(releaseMoneyGate({ open: 0, payments: [check()], todayYmd: TODAY, anywayReason: '', bank: [bank({ status: 'failed', postedYmd: '2026-11-25', failureReason: 'Insufficient funds' })], funds: FUNDS }).hold).toBe(true)
    expect(releaseMoneyGate({ open: 0, payments: [check()], todayYmd: TODAY, anywayReason: '', bank: undefined, funds: FUNDS }).hold).toBe(true)
    expect(releaseMoneyGate({ open: 1455.5, payments: [check()], todayYmd: TODAY, anywayReason: '', bank: [bank()], funds: FUNDS }).hold).toBe(true)
  })

  it('saves the confirmation on the release, and nothing when there is none', () => {
    expect(releaseSaveFields({ paymentDate: '2026-11-24' }, 'a1', '', null, FUNDS)).toEqual({ paymentDate: '2026-11-24', releasesFilingId: 'a1', releasedOnConfirmedFunds: FUNDS })
    expect(releaseSaveFields({}, 'a1', '', null, null)).toEqual({ releasesFilingId: 'a1' })
  })
})

describe('a saved release on a check that came back (punch list #435, piece 6)', () => {
  const back = [bank({ status: 'failed', postedYmd: '2026-11-25', failureReason: 'Insufficient funds' })]

  it('says not to record it while the county has not, and that the record stands once it has', () => {
    expect(plainSentence(releaseMoneyBackWords({ recorded: false, payments: [check()], bank: back, todayYmd: TODAY }) ?? '')).toBe('Do not record this release. Check 1184 came back. The bank said insufficient funds.')
    expect(plainSentence(releaseMoneyBackWords({ recorded: true, payments: [check()], bank: back, todayYmd: TODAY }) ?? '')).toBe('Check 1184 came back. The bank said insufficient funds. The county’s record stands. Ask counsel.')
  })

  it('says nothing while the money stands, with no payment, and while the bank is unread', () => {
    expect(releaseMoneyBackWords({ recorded: false, payments: [check()], bank: [bank()], todayYmd: TODAY })).toBeNull()
    expect(releaseMoneyBackWords({ recorded: false, payments: [check({ payment_type: 'Cash', reference_number: null })], bank: back, todayYmd: TODAY })).toBeNull()
    expect(releaseMoneyBackWords({ recorded: false, payments: [], bank: back, todayYmd: TODAY })).toBeNull()
    expect(releaseMoneyBackWords({ recorded: false, payments: [check()], bank: undefined, todayYmd: TODAY })).toBeNull()
    expect(releaseMoneyBackWords({ recorded: false, payments: [check()], bank: null, todayYmd: TODAY })).toBeNull()
  })
})
