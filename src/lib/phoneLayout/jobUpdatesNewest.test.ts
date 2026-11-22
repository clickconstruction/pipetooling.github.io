import { describe, expect, it } from 'vitest'
import type { JobThreadActivityItem } from '../../components/JobThreadNotesPanel'
import {
  jobUpdatesLookKey,
  newestNote,
  newestNoteIsNew,
  newestNoteLine,
  noteDayWords,
  noteFirstWords,
  noteIsViewers,
  readJobUpdatesLook,
  writeJobUpdatesLook,
} from './jobUpdatesNewest'

// Sunday 22 November 2026, by the app's calendar (America/Chicago).
const TODAY = '2026-11-22'
const ME = { userId: 'u-me', name: 'Luis Ortega' }

const note = (id: string, createdAt: string, body: string, author: string | null, authorId: string | null = null): JobThreadActivityItem => ({
  kind: 'note',
  note: { id, body, created_at: createdAt, author: author == null ? null : { name: author }, author_user_id: authorId },
})

/** A line the app wrote, as the thread lists one: never a note. */
const systemLine = (at: string): JobThreadActivityItem =>
  ({ kind: 'event', event: { id: `e-${at}`, type: 'status_changed', created_at: at } }) as unknown as JobThreadActivityItem
const clockLine = (at: string): JobThreadActivityItem => ({ kind: 'clock_session', clock: { sortAt: at } }) as unknown as JobThreadActivityItem

function memoryStorage(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed))
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), keys: () => [...map.keys()] }
}

describe('newestNote', () => {
  it('is none for a thread with nothing in it', () => {
    expect(newestNote([])).toBeNull()
  })

  it('is none for a thread of system lines alone: a status change and a clock line are not notes', () => {
    expect(newestNote([systemLine('2026-11-22T15:00:00Z'), clockLine('2026-11-22T16:00:00Z')])).toBeNull()
  })

  it('is the newest note, whatever system lines came after it', () => {
    const got = newestNote([
      note('n1', '2026-11-19T15:00:00Z', 'First', 'Robert', 'u-robert'),
      note('n2', '2026-11-20T07:18:00Z', 'Is 25% right?', 'Robert', 'u-robert'),
      systemLine('2026-11-22T15:00:00Z'),
    ])
    expect(got).toEqual({ authorName: 'Robert', authorUserId: 'u-robert', createdAt: '2026-11-20T07:18:00Z', body: 'Is 25% right?' })
  })

  it('reads the times, not the order the list came in', () => {
    const got = newestNote([note('n2', '2026-11-20T07:18:00Z', 'Later', 'Robert'), note('n1', '2026-11-19T15:00:00Z', 'Earlier', 'Taunya')])
    expect(got?.body).toBe('Later')
  })

  it('of two written at one instant, takes the later in the list, and skips a note with no time', () => {
    const got = newestNote([note('a', '2026-11-20T07:18:00Z', 'One', 'Robert'), note('b', '2026-11-20T07:18:00Z', 'Two', 'Taunya'), note('c', 'not a time', 'Three', 'Sam')])
    expect(got?.body).toBe('Two')
  })
})

describe('the row’s second line', () => {
  it('says who, the day and the first words', () => {
    const n = newestNote([note('n', '2026-11-19T19:18:00Z', 'Is 25% right?', 'Robert')])!
    expect(newestNoteLine(n, TODAY)).toBe('Robert, Thu: Is 25% right?')
  })

  it('says today for a note of today, by the app’s calendar', () => {
    expect(noteDayWords('2026-11-22T14:05:00Z', TODAY)).toBe('today')
    // 04:30 UTC on the 23rd is still the evening of the 22nd in Chicago.
    expect(noteDayWords('2026-11-23T04:30:00Z', TODAY)).toBe('today')
  })

  it('says the weekday for the six days before, then the month and day', () => {
    expect(noteDayWords('2026-11-21T18:00:00Z', TODAY)).toBe('Sat')
    expect(noteDayWords('2026-11-16T18:00:00Z', TODAY)).toBe('Mon')
    expect(noteDayWords('2026-11-15T18:00:00Z', TODAY)).toBe('Nov 15')
    expect(noteDayWords('2026-11-08T18:00:00Z', TODAY)).toBe('Nov 8')
  })

  it('adds the year when the note is not of this year, and says nothing for a time it cannot read', () => {
    expect(noteDayWords('2025-12-30T18:00:00Z', TODAY)).toBe('Dec 30, 2025')
    expect(noteDayWords('not a time', TODAY)).toBe('')
  })

  it('takes the first line with words on it, with single spaces', () => {
    expect(noteFirstWords('\n\n  Gate code   is 4471  \nCall before you come')).toBe('Gate code is 4471')
    expect(noteFirstWords('')).toBe('')
  })

  it('keeps a long note short enough to draw: the screen cuts the line where it ends', () => {
    const long = 'word '.repeat(80)
    const got = noteFirstWords(long)
    expect(got.length).toBeLessThanOrEqual(141)
    expect(got.endsWith('…')).toBe(true)
  })

  it('opens on the day for a note whose writer cannot be shown, and leaves the colon off a note with no words', () => {
    expect(newestNoteLine({ authorName: null, authorUserId: null, createdAt: '2026-11-22T14:05:00Z', body: 'Bring the lift' }, TODAY)).toBe('today: Bring the lift')
    expect(newestNoteLine({ authorName: '  ', authorUserId: null, createdAt: '2026-11-19T19:18:00Z', body: 'Yes, 25% is right' }, TODAY)).toBe('Thu: Yes, 25% is right')
    expect(newestNoteLine({ authorName: 'Robert', authorUserId: null, createdAt: '2026-11-22T14:05:00Z', body: '  ' }, TODAY)).toBe('Robert, today')
    expect(newestNoteLine({ authorName: null, authorUserId: null, createdAt: 'not a time', body: 'Bring the lift' }, TODAY)).toBe('Bring the lift')
  })
})

describe('whose note it is', () => {
  it('is the viewer’s by account, whatever the names say', () => {
    expect(noteIsViewers({ authorName: 'Someone Else', authorUserId: 'u-me', createdAt: '', body: '' }, ME)).toBe(true)
    expect(noteIsViewers({ authorName: 'Luis Ortega', authorUserId: 'u-other', createdAt: '', body: '' }, ME)).toBe(false)
  })

  it('falls back to the name on a row with no account, as a note still on its way out has none', () => {
    expect(noteIsViewers({ authorName: ' luis ortega ', authorUserId: null, createdAt: '', body: '' }, ME)).toBe(true)
    expect(noteIsViewers({ authorName: 'Robert', authorUserId: null, createdAt: '', body: '' }, ME)).toBe(false)
    expect(noteIsViewers({ authorName: null, authorUserId: null, createdAt: '', body: '' }, { userId: 'u-me', name: null })).toBe(false)
  })
})

describe('newestNoteIsNew', () => {
  const theirs = (createdAt: string) => newestNote([note('n', createdAt, 'Is 25% right?', 'Robert', 'u-robert')])
  const mine = (createdAt: string) => newestNote([note('n', createdAt, 'On it', 'Luis Ortega', 'u-me')])

  it('no notes: nothing is new', () => {
    expect(newestNoteIsNew({ note: null, viewer: ME, lastLookIso: null, todayYmd: TODAY })).toBe(false)
  })

  it('only system lines: nothing is new', () => {
    expect(newestNoteIsNew({ note: newestNote([systemLine('2026-11-22T15:00:00Z')]), viewer: ME, lastLookIso: null, todayYmd: TODAY })).toBe(false)
  })

  it('the viewer’s own note newest: not new, looked or not', () => {
    expect(newestNoteIsNew({ note: mine('2026-11-22T15:00:00Z'), viewer: ME, lastLookIso: null, todayYmd: TODAY })).toBe(false)
    expect(newestNoteIsNew({ note: mine('2026-11-22T15:00:00Z'), viewer: ME, lastLookIso: '2026-11-01T00:00:00Z', todayYmd: TODAY })).toBe(false)
  })

  it('another person’s note written before the last look: not new', () => {
    expect(newestNoteIsNew({ note: theirs('2026-11-22T15:00:00Z'), viewer: ME, lastLookIso: '2026-11-22T15:30:00Z', todayYmd: TODAY })).toBe(false)
  })

  it('another person’s note written after the last look: new', () => {
    expect(newestNoteIsNew({ note: theirs('2026-11-22T15:00:00Z'), viewer: ME, lastLookIso: '2026-11-22T14:30:00Z', todayYmd: TODAY })).toBe(true)
    // A week-old note is new too, when the last look is older still.
    expect(newestNoteIsNew({ note: theirs('2026-11-15T15:00:00Z'), viewer: ME, lastLookIso: '2026-11-01T00:00:00Z', todayYmd: TODAY })).toBe(true)
  })

  it('no look recorded, a note from today: new', () => {
    expect(newestNoteIsNew({ note: theirs('2026-11-22T15:00:00Z'), viewer: ME, lastLookIso: null, todayYmd: TODAY })).toBe(true)
  })

  it('no look recorded, a note from last week: not new', () => {
    expect(newestNoteIsNew({ note: theirs('2026-11-15T15:00:00Z'), viewer: ME, lastLookIso: null, todayYmd: TODAY })).toBe(false)
  })

  it('a kept look that is not a time reads as no look', () => {
    expect(newestNoteIsNew({ note: theirs('2026-11-22T15:00:00Z'), viewer: ME, lastLookIso: 'garbage', todayYmd: TODAY })).toBe(true)
    expect(newestNoteIsNew({ note: theirs('2026-11-15T15:00:00Z'), viewer: ME, lastLookIso: 'garbage', todayYmd: TODAY })).toBe(false)
  })
})

describe('the look, kept on the device', () => {
  it('is kept per person and per job', () => {
    const storage = memoryStorage()
    writeJobUpdatesLook(storage, 'u-me', 'job-1', '2026-11-22T15:00:00.000Z')
    expect(storage.keys()).toEqual([jobUpdatesLookKey('u-me', 'job-1')])
    expect(jobUpdatesLookKey('u-me', 'job-1')).toBe('pt_job_updates_look_u-me_job-1')
    expect(readJobUpdatesLook(storage, 'u-me', 'job-1')).toBe('2026-11-22T15:00:00.000Z')
    expect(readJobUpdatesLook(storage, 'u-me', 'job-2')).toBeNull()
    expect(readJobUpdatesLook(storage, 'u-other', 'job-1')).toBeNull()
  })

  it('reads none with nobody signed in, with no storage, and for a kept value that is not a time', () => {
    expect(readJobUpdatesLook(memoryStorage(), null, 'job-1')).toBeNull()
    expect(readJobUpdatesLook(null, 'u-me', 'job-1')).toBeNull()
    expect(readJobUpdatesLook(memoryStorage({ [jobUpdatesLookKey('u-me', 'job-1')]: 'garbage' }), 'u-me', 'job-1')).toBeNull()
  })

  it('a phone whose storage throws keeps nothing and breaks nothing', () => {
    const broken = {
      getItem: () => {
        throw new Error('no storage')
      },
      setItem: () => {
        throw new Error('no storage')
      },
    }
    expect(readJobUpdatesLook(broken, 'u-me', 'job-1')).toBeNull()
    expect(() => writeJobUpdatesLook(broken, 'u-me', 'job-1', '2026-11-22T15:00:00.000Z')).not.toThrow()
    expect(() => writeJobUpdatesLook(memoryStorage(), null, 'job-1', '2026-11-22T15:00:00.000Z')).not.toThrow()
  })
})
