import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import type { NudgeKept, NudgeNotSent, NudgeRun } from './nudgeDispatch'
import { RUN_HOUR, SUMMARY_REFUSED_MAX, runHourNow, runSummary, summaryWords } from './nudgeRunLog'

const kept = (why: NudgeNotSent, contactId = 'tom'): NudgeKept => ({ contactId, stepId: 'portal', jobId: null, why, words: '' })
const run = (notSent: NudgeKept[] = []): NudgeRun => ({ texts: [], notSent })
const NOW = new Date('2026-10-02T14:00:00Z')

describe('runHourNow: which cron tick runs', () => {
  it('runs at 14:00 UTC in summer, 9 AM Central, and not at 15:00', () => {
    expect(RUN_HOUR).toBe(9)
    expect(runHourNow(new Date('2026-10-02T14:00:00Z'))).toBe(true)
    expect(runHourNow(new Date('2026-10-02T15:00:00Z'))).toBe(false)
  })

  it('runs at 15:00 UTC in winter, 9 AM Central, and not at 14:00', () => {
    expect(runHourNow(new Date('2026-12-02T15:00:00Z'))).toBe(true)
    expect(runHourNow(new Date('2026-12-02T14:00:00Z'))).toBe(false)
  })

  it('runs on the change days too: Sun Nov 1 2026 is 9 AM at 15:00 UTC, Sun Mar 14 2027 at 14:00', () => {
    expect(runHourNow(new Date('2026-11-01T15:00:00Z'))).toBe(true)
    expect(runHourNow(new Date('2026-11-01T14:00:00Z'))).toBe(false)
    expect(runHourNow(new Date('2027-03-14T14:00:00Z'))).toBe(true)
  })
})

describe('runSummary: what the owner reads first', () => {
  it('counts the reminders kept back by why, and says them in order', () => {
    const s = runSummary({ run: run([kept('off'), kept('off', 'greg'), kept('no number', 'bill')]), sent: 0, refused: [], unread: 0, customersHeld: 0, now: NOW, dry: false })
    expect(s).toMatchObject({ at: '2026-10-02T14:00:00.000Z', dry: false, sent: 0, kept: { off: 2, 'no number': 1 }, textsOff: 0, refused: [], refusedCount: 0, unread: 0 })
    expect(s.words).toEqual([
      'No text went.',
      '2 reminders were kept back because the app does not send that step yet.',
      '1 reminder was kept back because there is no number on file.',
    ])
  })

  it('says a dry run first, and what would go', () => {
    expect(runSummary({ run: run(), sent: 1, refused: [], unread: 0, customersHeld: 0, now: NOW, dry: true }).words).toEqual([
      'A dry run. Nothing went and nothing was written.',
      '1 text would go.',
    ])
  })

  it('counts texts kept back while Send texts is off as kept back, never as texts that did not go', () => {
    const s = runSummary({ run: run(), sent: 0, refused: [], textsOff: 3, unread: 0, customersHeld: 0, now: NOW, dry: false })
    expect(s).toMatchObject({ sent: 0, textsOff: 3, refusedCount: 0 })
    expect(s.words).toEqual(['No text went.', '3 texts were kept back because Send texts is off in Settings.'])
  })

  it('says what did not go, who could not be read, and that customers wait', () => {
    const refused = Array.from({ length: SUMMARY_REFUSED_MAX + 3 }, (_, i) => ({ contactId: `c${i}`, stepId: 'portal', words: 'Quo did not take the text. It answered 500.' }))
    const s = runSummary({ run: run(), sent: 2, refused, unread: 1, customersHeld: 40, now: NOW, dry: false })
    expect(s.refused).toHaveLength(SUMMARY_REFUSED_MAX)
    expect(s.refusedCount).toBe(SUMMARY_REFUSED_MAX + 3)
    expect(s.words).toEqual(['2 texts went.', '23 texts did not go.', '1 person could not be read, so the run left them out.', 'Customers wait until the run can read their page.'])
  })

  it('reads in plain words for every reason and every line', () => {
    const all: NudgeNotSent[] = ['off', 'not a text', 'snoozed', 'sent lately', 'no number', 'opted out', 'one a morning']
    const words = [
      ...summaryWords({ at: '', dry: true, sent: 1, kept: Object.fromEntries(all.map((w) => [w, 1])), textsOff: 1, refused: [], refusedCount: 1, unread: 1, customersHeld: 1 }),
      ...summaryWords({ at: '', dry: false, sent: 2, kept: Object.fromEntries(all.map((w) => [w, 3])), textsOff: 2, refused: [], refusedCount: 2, unread: 2, customersHeld: 0 }),
    ]
    expect(words.length).toBeGreaterThan(all.length * 2)
    for (const w of words) expect(plainWordsFailures(w)).toEqual([])
  })
})
