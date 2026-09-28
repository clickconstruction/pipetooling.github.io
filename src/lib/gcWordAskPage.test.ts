import { describe, expect, it } from 'vitest'
import { gcWordAskDraftsFromPage, gcWordAskSubmission, parseGcWordAskPage, type GcWordAskPage } from './gcWordAskPage'

const raw = {
  ownerName: 'Malachi Douglas',
  askedByName: 'Taunya Smith',
  weekStart: '2026-09-28',
  expiresAt: '2026-10-06T15:00:00Z',
  answeredAt: null,
  gcs: [
    { gcId: 'knight', gcName: 'Knight Contracting', amount: 26000, oldestAgeDays: 41, over90: 0, lastWord: { temperature: 'warm', note: 'Check run is the 20th.', by: 'Malachi', at: '2026-09-18T15:00:00Z' }, promise: { payBy: '2026-09-20', late: true, daysLate: 8 }, noChangeAllowed: true, answer: null },
    { gcId: 'loberg', gcName: 'Loberg Contracting', amount: 22000, oldestAgeDays: null, over90: 0, lastWord: null, promise: null, noChangeAllowed: false, answer: { temperature: 'cool', note: 'Dodging the date again.', payBy: '2026-10-15', noChange: false, status: 'pending' } },
    { gcId: 'harper', gcName: 'TF Harper', amount: 30000, oldestAgeDays: 58, over90: 0, lastWord: null, promise: null, noChangeAllowed: false, answer: { temperature: 'hot', note: 'Paying Friday.', payBy: null, noChange: false, status: 'accepted' } },
  ],
}

const page = parseGcWordAskPage(raw) as GcWordAskPage

describe('parseGcWordAskPage', () => {
  it('reads what the function answers', () => {
    expect(page.gcs.map((g) => g.gcId)).toEqual(['knight', 'loberg', 'harper'])
    expect(page.gcs[0]?.promise).toEqual({ payBy: '2026-09-20', late: true, daysLate: 8 })
    expect(page.gcs[1]?.oldestAgeDays).toBeNull()
  })

  it('refuses a shape it does not know', () => {
    expect(parseGcWordAskPage(null)).toBeNull()
    expect(parseGcWordAskPage({ gcs: [] })).toBeNull()
    expect(parseGcWordAskPage({ expiresAt: 'x', gcs: [{ gcName: 'no id' }] })).toBeNull()
    expect(parseGcWordAskPage({ error: 'This link is no longer active.' })).toBeNull()
  })
})

describe('gcWordAskDraftsFromPage', () => {
  it('starts each row from what he already said, and leaves a read answer alone', () => {
    expect(gcWordAskDraftsFromPage(page)).toEqual({ loberg: { temperature: 'cool', note: 'Dodging the date again.', payBy: '2026-10-15', noChange: false } })
  })
})

describe('gcWordAskSubmission', () => {
  it('sends the rows that are complete', () => {
    const out = gcWordAskSubmission(page, { knight: { temperature: 'cool', note: 'Missed the 20th, now says the 10th.', payBy: '2026-10-10', noChange: false }, loberg: { temperature: null, note: '', payBy: '', noChange: false } })
    expect(out).toEqual({ answers: [{ gcId: 'knight', temperature: 'cool', note: 'Missed the 20th, now says the 10th.', payBy: '2026-10-10', noChange: false }], problem: null })
  })

  it('names a row he started and did not finish, and keeps the finished ones', () => {
    const out = gcWordAskSubmission(page, { knight: { temperature: null, note: '', payBy: '', noChange: true }, loberg: { temperature: 'warm', note: 'ok', payBy: '', noChange: false } })
    expect(out.answers).toEqual([{ gcId: 'knight', temperature: null, note: '', payBy: null, noChange: true }])
    expect(out.problem).toBe('Loberg Contracting: a sentence, not a word.')
  })

  it('never sends an answer for a GC the office has already read', () => {
    const out = gcWordAskSubmission(page, { harper: { temperature: 'cold', note: 'Changed my mind about them.', payBy: '', noChange: false } })
    expect(out.answers).toEqual([])
  })

  it('has nothing to send from a blank page', () => {
    expect(gcWordAskSubmission(page, {})).toEqual({ answers: [], problem: null })
  })
})
