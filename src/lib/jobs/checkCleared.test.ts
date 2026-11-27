import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { plainSentence } from '../valuesInPlace'
import { EARLY_ON_CHECK_ROLES, bankCheckAnswer, bankCheckForPayment, bankCheckFromRow, bankCheckTyped, canActBeforeCheckClears, checkAnswerWords, checkName, checkNumberKey, paymentCheckAnswer, type BankCheck, type CheckClearedPayment } from './checkCleared'

// Every check, number, day and amount here is made up.
const TODAY = '2026-11-24'
const bank = (over: Partial<BankCheck> = {}): BankCheck => ({ id: 'b1', amount: 16455.5, status: 'pending', depositedYmd: '2026-11-24', postedYmd: null, bankDayYmd: '2026-12-02', checkNumber: '01184', failureReason: null, ...over })
const paid = (over: Partial<CheckClearedPayment> = {}): CheckClearedPayment => ({ amount: 7420, paid_on: '2026-11-24', payment_type: 'Check', reference_number: '1184', ...over })
const words = (c: BankCheck, today = TODAY) => {
  const w = checkAnswerWords(bankCheckAnswer(c, today), checkName(c.checkNumber))
  return [plainSentence(w.say), w.wait, w.tone]
}

describe('bankCheckFromRow', () => {
  it('reads each instant as its day in the company’s calendar, and trims what the bank wrote', () => {
    // 03:10 UTC on Nov 25 is the evening of Nov 24 in the company's calendar.
    const row = { id: 'b1', amount: '16455.50', status: 'sent', created_at: '2026-11-25T03:10:00Z', posted_at: '2026-11-25T23:02:00Z', check_number: ' 01184 ', bank_day: '2026-12-02T22:00:00Z', failure_reason: ' ' }
    expect(bankCheckFromRow(row)).toEqual({ id: 'b1', amount: 16455.5, status: 'sent', depositedYmd: '2026-11-24', postedYmd: '2026-11-25', bankDayYmd: '2026-12-02', checkNumber: '01184', failureReason: null })
  })

  it('keeps a row the bank has not posted or dated', () => {
    const c = bankCheckFromRow({ id: 'b2', amount: 900, status: 'pending', created_at: '2026-11-24T15:00:00Z', posted_at: null, check_number: null, bank_day: null, failure_reason: null })
    expect(c).toMatchObject({ postedYmd: null, bankDayYmd: null, checkNumber: '' })
  })
})

describe('bankCheckAnswer', () => {
  it('holds a check the bank has not posted, and names the bank’s day', () => {
    expect(bankCheckAnswer(bank(), TODAY)).toMatchObject({ state: 'at_bank', cleared: false, clearsYmd: '2026-12-02' })
    expect(words(bank())).toEqual(['Check 01184 is at the bank. The bank says it clears Dec 2.', 'until then', 'amber'])
    expect(words(bank({ bankDayYmd: null }))).toEqual(['Check 01184 is at the bank. The bank has not posted it.', 'for the bank', 'amber'])
  })

  it('still holds once the bank posts it, until the bank’s own day', () => {
    const posted = bank({ status: 'sent', postedYmd: '2026-11-25' })
    expect(bankCheckAnswer(posted, '2026-11-26')).toMatchObject({ state: 'posted', cleared: false, clearsYmd: '2026-12-02' })
    expect(words(posted, '2026-11-26')).toEqual(['The bank posted check 01184 on Nov 25. It can still come back until Dec 2.', 'until then', 'amber'])
    expect(bankCheckAnswer(posted, '2026-12-01').cleared).toBe(false)
  })

  it('clears on the bank’s day, and not a day sooner', () => {
    const posted = bank({ status: 'sent', postedYmd: '2026-11-25' })
    expect(bankCheckAnswer(posted, '2026-12-02')).toMatchObject({ state: 'cleared', cleared: true, clearsYmd: '2026-12-02' })
    expect(words(posted, '2026-12-02')).toEqual(['The bank cleared check 01184 on Dec 2.', '', 'green'])
  })

  it('waits seven days from the posting when the bank named no day, and never clears before it posted', () => {
    expect(bankCheckAnswer(bank({ status: 'sent', postedYmd: '2026-11-25', bankDayYmd: null }), '2026-12-01').cleared).toBe(false)
    expect(bankCheckAnswer(bank({ status: 'sent', postedYmd: '2026-11-25', bankDayYmd: null }), '2026-12-02')).toMatchObject({ cleared: true, clearsYmd: '2026-12-02' })
    // Posted after the day the bank first named: it clears the day it posted.
    expect(bankCheckAnswer(bank({ status: 'sent', postedYmd: '2026-12-04' }), '2026-12-04')).toMatchObject({ cleared: true, clearsYmd: '2026-12-04' })
  })

  it('says late when the bank’s day passed and the check is not posted', () => {
    expect(bankCheckAnswer(bank(), '2026-12-03')).toMatchObject({ state: 'late', cleared: false })
    expect(words(bank(), '2026-12-03')).toEqual(['The bank named Dec 2 for check 01184. It has not posted it.', 'for the bank', 'amber'])
    // On the bank's own day it is not late yet.
    expect(bankCheckAnswer(bank(), '2026-12-02').state).toBe('at_bank')
  })

  it('tells a check the bank could not read from one the paying bank sent back', () => {
    expect(words(bank({ status: 'failed', failureReason: 'There was an issue with this transaction' }))).toEqual(['The bank could not read check 01184. Deposit it again.', 'for the new deposit', 'amber'])
    expect(words(bank({ status: 'failed', failureReason: 'Insufficient funds.' }))).toEqual(['Check 01184 came back. The bank said insufficient funds.', 'for a payment that holds', 'red'])
    // Posted, then failed: a return whatever the bank's words.
    expect(bankCheckAnswer(bank({ status: 'failed', postedYmd: '2026-11-25', failureReason: null }), TODAY)).toMatchObject({ state: 'came_back', cleared: false })
    expect(words(bank({ status: 'failed', postedYmd: '2026-11-25', failureReason: null }))[0]).toBe('Check 01184 came back.')
    expect(bankCheckAnswer(bank({ status: 'cancelled' }), TODAY).state).toBe('unread')
  })
})

describe('finding the bank’s deposit', () => {
  it('reads a check’s number the same however it is written', () => {
    expect(checkNumberKey('01184')).toBe('1184')
    expect(checkNumberKey(' ck# 1184 ')).toBe('1184')
    expect(checkNumberKey('Check 001184')).toBe('1184')
    expect(checkNumberKey('')).toBe('')
    expect(checkNumberKey(null)).toBe('')
  })

  it('takes the linked deposit first', () => {
    const linked = bank({ id: 'b9', checkNumber: '7', amount: 50 })
    expect(bankCheckForPayment(paid({ mercury_transaction_id: 'b9' }), [bank(), linked])).toBe(linked)
  })

  it('finds a deposit by the check’s number, for at least the payment, near its day', () => {
    expect(bankCheckForPayment(paid(), [bank()])?.id).toBe('b1')
    // One check over several bills: each payment is a part of it.
    expect(bankCheckForPayment(paid({ amount: 16455.5 }), [bank()])?.id).toBe('b1')
    expect(bankCheckForPayment(paid({ amount: 20000 }), [bank()])).toBeNull()
    expect(bankCheckForPayment(paid({ reference_number: '1185' }), [bank()])).toBeNull()
    expect(bankCheckForPayment(paid({ reference_number: null }), [bank()])).toBeNull()
    expect(bankCheckForPayment(paid({ paid_on: '2026-08-01' }), [bank()])).toBeNull()
  })

  it('takes the newest of two deposits of one number, so a check deposited again answers for itself', () => {
    const first = bank({ id: 'b1', status: 'failed', depositedYmd: '2026-11-20' })
    const again = bank({ id: 'b2', depositedYmd: '2026-11-24' })
    expect(bankCheckForPayment(paid(), [first, again])?.id).toBe('b2')
  })

  it('matches a typed check by its number and its amount to the cent', () => {
    expect(bankCheckTyped({ number: '1184', amount: 16455.5 }, [bank()])?.id).toBe('b1')
    expect(bankCheckTyped({ number: '1184', amount: 16455.49 }, [bank()])).toBeNull()
    expect(bankCheckTyped({ number: '', amount: 16455.5 }, [bank()])).toBeNull()
    expect(bankCheckTyped({ number: '1184', amount: null }, [bank()])).toBeNull()
  })
})

describe('paymentCheckAnswer', () => {
  it('never waits on money that is not a check', () => {
    expect(paymentCheckAnswer(paid({ payment_type: 'Card (external)' }), [bank()], TODAY)).toMatchObject({ state: 'not_check', cleared: true })
    expect(paymentCheckAnswer(paid({ payment_type: 'Cash' }), [], TODAY).cleared).toBe(true)
  })

  it('reads the bank when the check is there', () => {
    expect(paymentCheckAnswer(paid(), [bank()], TODAY)).toMatchObject({ state: 'at_bank', cleared: false })
    expect(paymentCheckAnswer(paid(), [bank({ status: 'sent', postedYmd: '2026-11-25' })], '2026-12-02')).toMatchObject({ state: 'cleared', cleared: true })
    // The bank's day rules, not the day typed: seven days from Nov 24 is Dec 1.
    expect(paymentCheckAnswer(paid(), [bank({ status: 'sent', postedYmd: '2026-11-25' })], '2026-12-01').cleared).toBe(false)
  })

  it('waits seven days from the day typed when the bank shows no deposit', () => {
    const waiting = paymentCheckAnswer(paid(), [], TODAY)
    expect(waiting).toMatchObject({ state: 'no_deposit', cleared: false, clearsYmd: '2026-12-01' })
    const w = checkAnswerWords(waiting, checkName('1184'))
    expect(plainSentence(w.say)).toBe('The bank shows no deposit of check 1184. Without one it counts as cleared Dec 1.')
    expect(paymentCheckAnswer(paid(), [], '2026-12-01')).toMatchObject({ state: 'no_deposit', cleared: true })
    expect(checkAnswerWords(paymentCheckAnswer(paid(), [], '2026-12-01'), checkName('1184')).say).toBe('')
  })
})

describe('the words', () => {
  it('names a check with what it is for', () => {
    const w = checkAnswerWords(bankCheckAnswer(bank(), TODAY), checkName('01184'), 16455.5)
    expect(plainSentence(w.say)).toBe('Check 01184 for $16,455.50 is at the bank. The bank says it clears Dec 2.')
    expect(checkName('')).toBe('the check')
    expect(plainSentence(checkAnswerWords(bankCheckAnswer(bank({ checkNumber: '' }), TODAY), checkName('')).say)).toBe('The check is at the bank. The bank says it clears Dec 2.')
  })

  it('keeps every sentence to plain words', () => {
    const rows: Array<[BankCheck, string]> = [
      [bank(), TODAY],
      [bank({ bankDayYmd: null }), TODAY],
      [bank(), '2026-12-03'],
      [bank({ status: 'sent', postedYmd: '2026-11-25' }), '2026-11-26'],
      [bank({ status: 'sent', postedYmd: '2026-11-25' }), '2026-12-02'],
      [bank({ status: 'failed', failureReason: 'There was an issue with this transaction' }), TODAY],
      [bank({ status: 'failed', failureReason: 'Insufficient funds' }), TODAY],
    ]
    for (const [c, today] of rows) expect(plainWordsFailures(plainSentence(checkAnswerWords(bankCheckAnswer(c, today), checkName(c.checkNumber), c.amount).say))).toEqual([])
    expect(plainWordsFailures(plainSentence(checkAnswerWords(paymentCheckAnswer(paid(), [], TODAY), checkName('1184')).say))).toEqual([])
  })
})

describe('who may act before the bank clears a check (punch list #437, call 4)', () => {
  it('is a leader, a controller or a dev, and nobody else', () => {
    expect([...EARLY_ON_CHECK_ROLES].sort()).toEqual(['controller', 'dev', 'master_technician'])
    for (const role of ['dev', 'master_technician', 'controller']) expect(canActBeforeCheckClears(role), role).toBe(true)
    // The assistant is not one of the three, though the controller is.
    for (const role of ['assistant', 'estimator', 'primary', 'superintendent', 'subcontractor', 'helper', '', null, undefined]) expect(canActBeforeCheckClears(role), String(role)).toBe(false)
  })
})
