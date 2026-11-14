import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { READY_TO_BILL_WORDS, afterPctSave, pctSaveLabel, readyToBillHeldWords, readyToBillOffered } from './pctReadyToBill'

describe('Ready to Bill from the percent window', () => {
  it('offers the line only at 100 on a Working job', () => {
    expect(readyToBillOffered({ saveValue: 100, status: 'working' })).toBe(true)
    expect(readyToBillOffered({ saveValue: 95, status: 'working' })).toBe(false)
    expect(readyToBillOffered({ saveValue: null, status: 'working' })).toBe(false)
    // Already there, or not started: nothing to offer.
    for (const status of ['ready_to_bill', 'billed', 'paid', 'waiting', null]) expect(readyToBillOffered({ saveValue: 100, status })).toBe(false)
  })

  it('names the move on Save when the tick is on, and leaves Save alone when it is off', () => {
    expect(pctSaveLabel('Save 100%', true)).toBe('Save 100% and move to Ready to Bill')
    expect(pctSaveLabel('Save 100%', false)).toBe('Save 100%')
    // By line, the job's number is on the press already.
    expect(pctSaveLabel('Save · job 100%', true)).toBe('Save · job 100% and move to Ready to Bill')
  })

  it('makes the move only when it was asked for and the job is still Working', () => {
    expect(afterPctSave({ willMove: true, statusAfter: 'working' })).toBe('move')
    expect(afterPctSave({ willMove: false, statusAfter: 'working' })).toBe('close')
    // Moved by someone else while the window was open.
    expect(afterPctSave({ willMove: true, statusAfter: 'ready_to_bill' })).toBe('close')
    expect(afterPctSave({ willMove: true, statusAfter: null })).toBe('close')
  })

  it('says the percent is safe before the reason a move was refused', () => {
    expect(readyToBillHeldWords('You’re not allowed to change this job’s status.')).toBe('The percent is saved. The job did not move to Ready to Bill. You’re not allowed to change this job’s status.')
    expect(readyToBillHeldWords('  ')).toBe('The percent is saved. The job did not move to Ready to Bill.')
  })

  it('writes its own words plainly', () => {
    for (const w of [READY_TO_BILL_WORDS.attest, READY_TO_BILL_WORDS.held]) expect(plainWordsFailures(w), w).toEqual([])
  })
})
