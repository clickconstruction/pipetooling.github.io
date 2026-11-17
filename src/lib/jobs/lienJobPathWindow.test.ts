import { describe, expect, it } from 'vitest'
import { LIEN_JOB_PATH_BACK_DOES, buildLienJobPathWindow, lienJobPathBackLabel, lienJobPathBackToast, lienJobPathOffDoes, lienJobPathOffLabel, lienJobPathOffToast, type LienJobPathFacts } from './lienJobPathWindow'

const facts = (over: Partial<LienJobPathFacts> = {}): LienJobPathFacts => ({
  number: '977',
  name: 'ZZ Trip Charges',
  unpaid: 1050,
  status: 'billed',
  attorneySince: null,
  papers: [{ kind: 'notice_53_056', status: 'approved', months: ['2026-09'], sent_at: null, approved_at: '2026-10-05T15:00:00Z', voided_at: null }],
  billLines: [{ name: '  3 separate trip charges to pick up checks  ', amount: 1050 }, { name: '', amount: 5 }, { name: 'A line with no price', amount: null }],
  off: false,
  reason: '',
  since: null,
  byName: '',
  ...over,
})

describe('the window that takes a job off the lien path', () => {
  it('on a job on the path: the title, the job with its money, the bill’s own lines and what went out', () => {
    const w = buildLienJobPathWindow(facts())
    expect(w.mode).toBe('off')
    expect(w.title).toBe('Take this job off the lien path?')
    expect(w.sub).toBe('977 · ZZ Trip Charges · $1,050 unpaid')
    expect(w.billLines).toEqual([
      { name: '3 separate trip charges to pick up checks', amountWords: '$1,050' },
      { name: 'A line with no price', amountWords: '' },
    ])
    expect(w.wentOut).toBe('No lien paper has gone out. A lien notice was approved Oct 5 and not sent.')
    expect(w.cameOff).toBeNull()
  })

  it('offers the attorney’s list as a tick, and says first when the Collections flag will hold the job', () => {
    expect(buildLienJobPathWindow(facts()).list).toEqual({ tick: true, line: null, note: null })
    expect(buildLienJobPathWindow(facts({ status: 'working' })).list).toEqual({ tick: true, line: null, note: '977 is still being worked, so it cannot go on the Collections list yet. It still leaves the lien path.' })
  })

  it('offers no tick for a job already on the attorney’s list, and says since when', () => {
    expect(buildLienJobPathWindow(facts({ attorneySince: '2026-10-08T15:00:00Z' })).list).toEqual({ tick: false, line: 'It is on the attorney’s list already, since Oct 8.', note: null })
  })

  it('on a job off the path: the way back, with why it came off, who and the day', () => {
    const w = buildLienJobPathWindow(facts({ off: true, reason: 'The bill is for trips, not for work.', since: '2026-11-16T21:00:00Z', byName: 'Dana' }))
    expect(w.mode).toBe('back')
    expect(w.title).toBe('Put this job back on the lien path?')
    expect(w.cameOff).toBe('Taken off since Nov 16, by Dana. The reason given: The bill is for trips, not for work.')
    expect(buildLienJobPathWindow(facts({ off: true })).cameOff).toBe('Taken off. The reason given: No reason was written down.')
  })

  it('names a job with no name by its number alone', () => {
    expect(buildLienJobPathWindow(facts({ name: '' })).sub).toBe('977 · $1,050 unpaid')
  })

  it('says what the press does before it is pressed, with the list by the tick', () => {
    expect(lienJobPathOffDoes(true)).toHaveLength(5)
    expect(lienJobPathOffDoes(true)[3]).toBe('It goes on the attorney’s list, with your reason as the note.')
    expect(lienJobPathOffDoes(false)[3]).toBe('It does not go on the attorney’s list.')
    expect(lienJobPathOffDoes(false)[1]).toContain('Nothing is filed, voided or deleted.')
    expect(LIEN_JOB_PATH_BACK_DOES[1]).toBe('Its lien dates did not stop while it was off. Check each one first.')
  })

  it('names the act and the job on each press', () => {
    expect(lienJobPathOffLabel('977')).toBe('Take 977 off the lien path')
    expect(lienJobPathBackLabel('977')).toBe('Put 977 back on the lien path')
  })

  it('says afterwards what happened, and what the attorney’s list said when it was asked', () => {
    const r = { answer: 'off_path' as const, changed: true, onAttorneyList: false, alreadyOnList: false, held: null }
    expect(lienJobPathOffToast('977', false, r)).toEqual({ words: '977 is off the lien path.', tone: 'success' })
    expect(lienJobPathOffToast('977', true, { ...r, onAttorneyList: true })).toEqual({ words: '977 is off the lien path. It is on the attorney’s list.', tone: 'success' })
    expect(lienJobPathOffToast('977', true, { ...r, onAttorneyList: true, alreadyOnList: true })).toEqual({ words: '977 is off the lien path. It was on the attorney’s list already.', tone: 'success' })
    expect(lienJobPathOffToast('977', true, { ...r, held: 'Job must be in Billed Awaiting Payment to change Collections' })).toEqual({
      words: '977 is off the lien path. It did not go on the attorney’s list: Job must be in Billed Awaiting Payment to change Collections.',
      tone: 'warning',
    })
    expect(lienJobPathBackToast('977')).toBe('977 is back on the lien path. Its papers are on the Lien desk again.')
  })
})
