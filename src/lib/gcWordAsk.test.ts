import { describe, expect, it } from 'vitest'
import {
  isNoChangeNote,
  noChangeNote,
  validateWordAskAnswers,
  wordAskEmail,
  wordAskLinkMessage,
  wordAskLinkProblem,
  wordAskPageGcs,
  wordAskTextMessage,
  wordAskUrl,
  type WordAskWeekItem,
} from './gcWordAsk'

const NOW = Date.parse('2026-09-28T15:00:00Z')

const item = (gc: string, over: Partial<WordAskWeekItem> = {}): WordAskWeekItem => ({
  gc_id: gc,
  gc_name: `GC ${gc}`,
  amount: 26000,
  oldest_age_days: 41,
  over_90: 0,
  last_word: null,
  last_temperature: null,
  expected_pay_by: null,
  promise_late: false,
  days_late: 0,
  ...over,
})

const withWord = item('kestrin', { last_word: { note: 'Check run is the 20th.', by: 'Malachi', at: '2026-09-18T15:00:00Z', temperature: 'warm' }, expected_pay_by: '2026-09-20', promise_late: true, days_late: 8 })
const repeated = item('halden', { last_word: { note: noChangeNote({ note: 'Fine, no date.', at: '2026-09-11T15:00:00Z' }), by: 'Malachi', at: '2026-09-18T15:00:00Z', temperature: 'warm' } })

describe('the link', () => {
  it('opens while it is live, and says why when it is not', () => {
    expect(wordAskLinkProblem({ revoked_at: null, expires_at: '2026-10-05T15:00:00Z' }, NOW)).toBeNull()
    expect(wordAskLinkProblem({ revoked_at: null, expires_at: '2026-09-28T14:59:59Z' }, NOW)).toBe('expired')
    expect(wordAskLinkProblem({ revoked_at: '2026-09-27T00:00:00Z', expires_at: '2026-10-05T15:00:00Z' }, NOW)).toBe('revoked')
    expect(wordAskLinkProblem(null, NOW)).toBe('missing')
    expect(wordAskLinkProblem({ revoked_at: null, expires_at: 'soon' }, NOW)).toBe('expired')
  })

  it('never tells a stranger whether a link ever existed', () => {
    expect(wordAskLinkMessage('missing')).toBe(wordAskLinkMessage('revoked'))
    expect(wordAskLinkMessage('expired')).toMatch(/run out/)
  })

  it('is one address, with the token escaped', () => {
    expect(wordAskUrl('https://clicktooling.com/', 'abc def')).toBe('https://clicktooling.com/ask?t=abc%20def')
  })
})

describe('wordAskPageGcs', () => {
  it('shows only the GCs the ask names, in the week’s order, with his answers', () => {
    const gcs = wordAskPageGcs([withWord, item('lowbeck'), item('other')], ['lowbeck', 'kestrin', 'paid-down'], [{ gc_customer_id: 'lowbeck', temperature: 'cool', note: 'Dodging the date again.', expected_pay_by: null, no_change: false, status: 'pending' }])
    expect(gcs.map((g) => g.gcId)).toEqual(['kestrin', 'lowbeck'])
    expect(gcs[0]).toMatchObject({ lastWord: { temperature: 'warm', note: 'Check run is the 20th.', by: 'Malachi' }, promise: { payBy: '2026-09-20', late: true, daysLate: 8 }, noChangeAllowed: true, answer: null })
    expect(gcs[1]).toMatchObject({ lastWord: null, promise: null, noChangeAllowed: false, answer: { temperature: 'cool', note: 'Dodging the date again.', noChange: false, status: 'pending' } })
  })

  it('allows "no change" once', () => {
    expect(wordAskPageGcs([repeated], ['halden'], [])[0]?.noChangeAllowed).toBe(false)
    expect(isNoChangeNote(repeated.last_word!.note)).toBe(true)
  })
})

describe('validateWordAskAnswers', () => {
  const page = wordAskPageGcs([withWord, item('lowbeck'), repeated], ['kestrin', 'lowbeck', 'halden'], [])

  it('takes a read with its sentence, and skips a row left blank', () => {
    expect(
      validateWordAskAnswers(
        [
          { gcId: 'kestrin', temperature: 'cool', note: '  Missed the 20th, now says the 10th.  ', payBy: '2026-10-10' },
          { gcId: 'lowbeck', temperature: null, note: '', payBy: '' },
        ],
        page,
      ),
    ).toEqual({ ok: true, answers: [{ gcId: 'kestrin', temperature: 'cool', note: 'Missed the 20th, now says the 10th.', payBy: '2026-10-10', noChange: false }] })
  })

  it('holds a started row to the office’s own bar', () => {
    expect(validateWordAskAnswers([{ gcId: 'kestrin', note: 'They say the check is coming.' }], page)).toEqual({ ok: false, error: 'GC kestrin: pick their temperature.' })
    expect(validateWordAskAnswers([{ gcId: 'kestrin', temperature: 'warm', note: 'fine' }], page)).toEqual({ ok: false, error: 'GC kestrin: a sentence, not a word.' })
    expect(validateWordAskAnswers([{ gcId: 'kestrin', temperature: 'boiling', note: 'A whole sentence here.' }], page)).toEqual({ ok: false, error: 'GC kestrin: pick their temperature.' })
    expect(validateWordAskAnswers([{ gcId: 'kestrin', temperature: 'warm', note: 'A whole sentence here.', payBy: 'Friday' }], page)).toEqual({ ok: false, error: 'GC kestrin: the pay date is not a date.' })
  })

  it('takes "no change" only where there is a word to repeat', () => {
    expect(validateWordAskAnswers([{ gcId: 'kestrin', noChange: true }], page)).toEqual({ ok: true, answers: [{ gcId: 'kestrin', temperature: null, note: '', payBy: null, noChange: true }] })
    expect(validateWordAskAnswers([{ gcId: 'lowbeck', noChange: true }], page).ok).toBe(false)
    expect(validateWordAskAnswers([{ gcId: 'halden', noChange: true }], page)).toEqual({ ok: false, error: 'GC halden: the last word was already “no change” — say where they stand this time.' })
  })

  it('refuses anything about a GC the link does not name', () => {
    expect(validateWordAskAnswers([{ gcId: 'someone-else', temperature: 'hot', note: 'Paying Friday, for sure.' }], page)).toEqual({ ok: false, error: 'That GC is not on this link.' })
    expect(validateWordAskAnswers([{ gcId: 'kestrin', noChange: true }, { gcId: 'kestrin', noChange: true }], page)).toEqual({ ok: false, error: 'GC kestrin is answered twice.' })
  })

  it('refuses nothing, garbage, and a flood', () => {
    expect(validateWordAskAnswers([], page)).toEqual({ ok: false, error: 'Nothing to save — answer at least one GC.' })
    expect(validateWordAskAnswers('hot', page).ok).toBe(false)
    expect(validateWordAskAnswers([null], page).ok).toBe(false)
    expect(validateWordAskAnswers(Array.from({ length: 61 }, () => ({ gcId: 'kestrin' })), page)).toEqual({ ok: false, error: 'Too many answers.' })
  })

  it('cuts a sentence at the cap', () => {
    const r = validateWordAskAnswers([{ gcId: 'kestrin', temperature: 'warm', note: 'x'.repeat(900) }], page)
    expect(r.ok && r.answers[0]?.note.length).toBe(600)
  })
})

describe('what he is sent', () => {
  it('a text she can paste, short and signed', () => {
    expect(wordAskTextMessage({ ownerName: 'Malachi Douglas', askedByName: 'Taunya Smith', gcCount: 7, url: 'https://x.test/ask?t=abc' })).toBe('Malachi — where do your 7 GCs stand on paying? Two minutes, no sign-in: https://x.test/ask?t=abc — Taunya')
    expect(wordAskTextMessage({ ownerName: null, askedByName: '', gcCount: 1, url: 'u' })).toBe('there — where do your GC stand on paying? Two minutes, no sign-in: u — there')
  })

  it('an email that names the GCs, the broken promises and the link', () => {
    const mail = wordAskEmail({ ownerName: 'Malachi', askedByName: 'Taunya', gcs: [{ gcName: 'Kestrin <& Sons>', amount: 26000, promise: { payBy: '2026-09-20', late: true, daysLate: 8 } }, { gcName: 'Lowbeck', amount: 22000, promise: null }], url: 'https://x.test/ask?t=abc', expiresLabel: 'Monday, Oct 5' })
    expect(mail.subject).toBe('Malachi, where do your 2 GCs stand? — $48,000 owed')
    expect(mail.text).toContain('Kestrin <& Sons> — $26,000 · promised 2026-09-20, 8 days late')
    expect(mail.text).toContain('Answer here — two minutes, no sign-in: https://x.test/ask?t=abc')
    expect(mail.html).toContain('Kestrin &lt;&amp; Sons&gt;')
    expect(mail.html).not.toContain('Kestrin <& Sons>')
    expect(mail.html).toContain('1 of them broke a promise')
    expect(mail.html).toContain('href="https://x.test/ask?t=abc"')
    expect(mail.html).toContain('Monday, Oct 5')
  })
})
