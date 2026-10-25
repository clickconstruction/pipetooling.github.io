import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../../plainWords'
import { COLLECT_ANSWERS, COLLECT_DISPUTE_REASONS, COLLECT_NO_DATE_REASONS, collectOutcomePlan, mailedCheckYmd } from './collectOutcome'

const md = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const opts = { graceDays: 7, quietDays: 3, dayLabel: md }
const plain = (s: string) => expect(plainWordsFailures(s), s).toEqual([])

describe('collectOutcomePlan (v2.5855)', () => {
  it('dates a mailed check by the mail day plus five', () => {
    expect(mailedCheckYmd('2026-11-06')).toBe('2026-11-11')
    expect(mailedCheckYmd('2026-10-23', 3)).toBe('2026-10-26')
  })

  it('records money in the bank as a payment first and a note after the call', () => {
    const p = collectOutcomePlan({ answer: 'paid', words: 'check 4471' }, opts)
    expect(p.recordPaymentFirst).toBe(true)
    expect(p.writes).toEqual([{ kind: 'touch', outcome: 'note', note: 'Paid after the call. check 4471' }])
    expect(p.friday).toBe('landed')
    for (const t of p.then) plain(t)
  })

  it('records a named date as a promise with who said it and their words', () => {
    const p = collectOutcomePlan({ answer: 'promised', ymd: '2026-11-11', saidBy: ' Dana, accounts payable ', words: 'Check run is Thursday the 5th, in the mail Friday' }, opts)
    expect(p.writes).toEqual([{ kind: 'promise', ymd: '2026-11-11', saidBy: 'Dana, accounts payable', note: 'Check run is Thursday the 5th, in the mail Friday' }])
    expect(p.then[0]).toBe('The forecast moves the money to Nov 11.')
    expect(p.then[2]).toBe("If Nov 11 passes unpaid, the row turns to past a promise after the 7-day grace. It is then Monday's first call.")
    expect(p.friday).toBe('dated')
    for (const t of p.then) plain(t)
  })

  it('records no answer or a wrong contact as could not reach, and spoke with no day as a note; a resend adds a resent touch', () => {
    const a = collectOutcomePlan({ answer: 'nodate', reason: 'no_answer' }, opts)
    expect(a.writes).toEqual([{ kind: 'touch', outcome: 'cant_reach', note: 'No answer, left a message' }])
    const w = collectOutcomePlan({ answer: 'nodate', reason: 'wrong_contact', words: 'ask for Dana' }, opts)
    expect(w.writes[0]).toEqual({ kind: 'touch', outcome: 'cant_reach', note: 'Wrong contact. ask for Dana' })
    const s = collectOutcomePlan({ answer: 'nodate', reason: 'no_day', words: 'the check went out Friday', resend: true }, opts)
    expect(s.writes).toEqual([
      { kind: 'touch', outcome: 'note', note: 'Spoke, they would not name a day. the check went out Friday' },
      { kind: 'touch', outcome: 'resend', note: 'The bill, sent again after the call.' },
    ])
    expect(s.friday).toBe('no_date')
    expect(s.then[0]).toContain('a note with their words')
    for (const t of [...a.then, ...s.then]) plain(t)
  })

  it('records a dispute with what they dispute and their words, for the owner', () => {
    const d = collectOutcomePlan({ answer: 'dispute', reason: 'payapp_rejected', words: 'the August quantities' }, opts)
    expect(d.writes).toEqual([{ kind: 'touch', outcome: 'dispute', note: 'A pay app they rejected. the August quantities' }])
    expect(d.friday).toBe('on_the_owner')
    for (const t of d.then) plain(t)
  })

  it('keeps the answers and reasons in plain words', () => {
    for (const a of COLLECT_ANSWERS) {
      plain(a.label)
      plain(a.sub)
    }
    for (const r of [...COLLECT_NO_DATE_REASONS, ...COLLECT_DISPUTE_REASONS]) plain(r.label)
  })
})
