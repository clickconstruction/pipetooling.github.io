/**
 * What a sub said back from their page, as the office reads it (punch list #371, step 3): a quiet chip for a
 * payment marked received, and a flag for a note that something is wrong, until someone marks it answered.
 */
import { describe, expect, it } from 'vitest'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { answerDayWords, noteAnsweredWords, noteFlagWords, notesForSheet, NO_SUB_PAPER_ANSWERS, paymentReceivedDay, receivedChipWords, subPaperAnswers, waitingNotes, type SubPaperAckRow } from './subPaperAnswers'

// Made-up rows. An instant late in the evening UTC is still the same day in Central time; 03:00 UTC is the day before.
const dayOf = (iso: string) => calendarYmdInAppTzFromIso(iso)
const row = (over: Partial<SubPaperAckRow>): SubPaperAckRow => ({ id: 'a', kind: 'received', person_id: 'harlan', labor_job_id: null, sending_id: null, payment_id: null, note: null, said_by_name: 'Harlan Mechanical', created_at: '2026-11-13T18:00:00Z', ...over })

const ROWS: SubPaperAckRow[] = [
  row({ id: 'r1', sending_id: 's231', created_at: '2026-11-14T03:00:00Z' }),
  row({ id: 'r2', sending_id: 's231', created_at: '2026-11-20T18:00:00Z' }),
  row({ id: 'r3', payment_id: 'p-old', created_at: '2026-09-05T18:00:00Z' }),
  row({ id: 'n1', kind: 'something_wrong', labor_job_id: 'cedar-1', note: ' The back-charge was never talked about with me. ', created_at: '2026-11-13T18:00:00Z' }),
  row({ id: 'n2', kind: 'something_wrong', sending_id: 's226', note: 'The check was short.', created_at: '2026-11-01T18:00:00Z', answered_at: '2026-11-02T16:00:00Z', answered_by_name: 'Rosa Office' }),
  row({ id: 'n3', kind: 'something_wrong', payment_id: 'p-old', note: 'Never got it.', created_at: '2026-09-06T18:00:00Z', said_by_name: null }),
  row({ id: 'c1', kind: 'confirmed', labor_job_id: 'cedar-1' }),
]
const answers = subPaperAnswers(ROWS, dayOf)
const TODAY = '2026-11-16'

describe('a payment marked received', () => {
  it('reads by its sending, or by its own row for a payment from before sendings, on the day of the first answer', () => {
    expect(paymentReceivedDay(answers, { id: 'p1', amount: 1000, sending_id: 's231' })).toBe('2026-11-13')
    expect(paymentReceivedDay(answers, { id: 'p2', amount: 1200, sending_id: 's231' })).toBe('2026-11-13')
    expect(paymentReceivedDay(answers, { id: 'p-old', amount: 900, sending_id: null })).toBe('2026-09-05')
  })

  it('a payment nobody marked says nothing, and a back-charge is never received', () => {
    expect(paymentReceivedDay(answers, { id: 'p3', amount: 1500, sending_id: 's226' })).toBe('')
    expect(paymentReceivedDay(answers, { id: 'p-other', amount: 400, sending_id: null })).toBe('')
    expect(paymentReceivedDay(answers, { id: 'p-old', amount: -100, sending_id: null })).toBe('')
    expect(paymentReceivedDay(NO_SUB_PAPER_ANSWERS, { id: 'p1', amount: 1000, sending_id: 's231' })).toBe('')
  })

  it('the chip says the day and where the word came from', () => {
    expect(receivedChipWords('2026-11-13', TODAY)).toBe('Received Nov 13 · from their page')
    expect(receivedChipWords('2025-12-30', TODAY)).toBe('Received Dec 30, 2025 · from their page')
    expect(receivedChipWords('', TODAY)).toBe('Received · from their page')
  })
})

describe('a note that something is wrong', () => {
  const cedar1 = { id: 'cedar-1', payments: [{ id: 'p0', sending_id: 's226' }, { id: 'p1', sending_id: 's231' }] }
  const alder = { id: 'alder-1', payments: [{ id: 'p-old', sending_id: null }] }

  it('shows on its sheet, and a note about a payment shows on every sheet that payment paid on', () => {
    expect(notesForSheet(answers, cedar1).map((n) => n.id)).toEqual(['n1', 'n2'])
    expect(notesForSheet(answers, alder).map((n) => n.id)).toEqual(['n3'])
    expect(notesForSheet(answers, { id: 'ridge-1', payments: [] })).toEqual([])
    expect(notesForSheet(answers, { id: 'no-payments' })).toEqual([])
  })

  it('waits until the office marks it answered: waiting ones first, and only they count', () => {
    const notes = notesForSheet(answers, cedar1)
    expect(notes.map((n) => [n.id, n.answeredOn])).toEqual([
      ['n1', ''],
      ['n2', '2026-11-02'],
    ])
    expect(waitingNotes(notes)).toBe(1)
    expect(waitingNotes(notesForSheet(answers, alder))).toBe(1)
  })

  it('reads who said it, when, and their own words', () => {
    const [n1, n2] = notesForSheet(answers, cedar1)
    expect(noteFlagWords(n1!, TODAY)).toBe('Harlan Mechanical says something is wrong, Nov 13: “The back-charge was never talked about with me.”')
    expect(noteFlagWords(n2!, TODAY)).toBe('Harlan Mechanical says something is wrong on a payment, Nov 1: “The check was short.”')
    expect(noteAnsweredWords(n2!, TODAY)).toBe('Answered Nov 2 by Rosa Office')
    expect(noteAnsweredWords(n1!, TODAY)).toBe('')
    // A row with no name still reads.
    expect(noteFlagWords(notesForSheet(answers, alder)[0]!, TODAY)).toBe('The sub says something is wrong on a payment, Sep 6: “Never got it.”')
  })

  it('a confirm is not a note: it is not built, and reads as nothing', () => {
    expect(answers.notes.some((n) => n.id === 'c1')).toBe(false)
  })
})

describe('a day, in words', () => {
  it('leaves the year off this year', () => {
    expect(answerDayWords('2026-11-02', TODAY)).toBe('Nov 2')
    expect(answerDayWords('2025-11-02', TODAY)).toBe('Nov 2, 2025')
    expect(answerDayWords('soon', TODAY)).toBe('')
  })
})
