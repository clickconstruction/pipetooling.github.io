import { describe, expect, it } from 'vitest'
import { awayBackWords, awayDistanceWords, awayDoorPlace, awayGroupCount, awayLeftWords, awayNoteFirstLine, awayRestoreConfirm, awaySectionTitle, awayShortDate, awayWhenTitle, awayWhenWords, daysBetweenYmd, splitAwayFromArchived } from './awaySection'

const TODAY = '2026-11-08'

const nadia = { id: 'u-nadia', name: 'Nadia', email: 'nadia@example.com', role: 'helpers', archived_at: '2026-11-08T17:01:23.219+00:00' }
const gone = { id: 'u-gone', name: 'Gone Person', email: null, role: 'helpers', archived_at: '2026-06-01T15:00:00+00:00' }
const nadiaRow = { id: 'p-nadia', name: 'Nadia', email: 'nadia@example.com', archived_at: '2026-11-08T17:01:23.226+00:00', end_date: '2026-11-03', account_user_id: 'u-nadia' }
const goneRow = { id: 'p-gone', name: 'Gone Person', email: null, archived_at: '2026-06-01T15:00:00+00:00', end_date: null, account_user_id: 'u-gone' }
const loneRow = { id: 'p-lone', name: 'Roster Only', email: null, archived_at: '2026-05-01T15:00:00+00:00', end_date: null, account_user_id: null }

describe('daysBetweenYmd', () => {
  it('counts whole calendar days either way and refuses a non-date', () => {
    expect(daysBetweenYmd('2026-11-08', '2029-11-08')).toBe(1096)
    expect(daysBetweenYmd('2026-11-08', '2026-11-08')).toBe(0)
    expect(daysBetweenYmd('2026-11-08', '2026-11-05')).toBe(-3)
    expect(daysBetweenYmd('2026-11-08', 'soon')).toBeNull()
  })
})

describe('awayBackWords', () => {
  it('names the day back with the days left, the day itself, a day gone by, and no day', () => {
    expect(awayBackWords('2029-11-08', TODAY)).toBe('Back on Thursday, Nov 8, 2029 · 1,096 days')
    expect(awayBackWords('2026-11-09', TODAY)).toBe('Back on Monday, Nov 9, 2026 · 1 day')
    expect(awayBackWords(TODAY, TODAY)).toBe('Back today')
    expect(awayBackWords('2026-11-05', TODAY)).toBe('Due back Nov 5, 2026 · 3 days ago')
    expect(awayBackWords(null, TODAY)).toBe('No day back set')
  })
})

describe('awayLeftWords', () => {
  it('reads Left from an end date and Archived without one', () => {
    expect(awayLeftWords('2026-11-03', '2026-11-08')).toBe('Left Nov 3, 2026')
    expect(awayLeftWords(null, '2026-11-08')).toBe('Archived Nov 8, 2026')
  })
})

describe('splitAwayFromArchived', () => {
  it('moves an archived login with a note out of the lists and folds its roster row in', () => {
    const split = splitAwayFromArchived({
      logins: [nadia, gone],
      rosterRows: [nadiaRow, goneRow, loneRow],
      notes: [{ user_id: 'u-nadia', countdown_ymd: '2029-11-08', alert_on_day: true }],
      todayYmd: TODAY,
    })
    expect(split.away).toHaveLength(1)
    const row = split.away[0]!
    expect(row).toMatchObject({ userId: 'u-nadia', personId: 'p-nadia', displayName: 'Nadia', loginName: 'Nadia', role: 'helpers', leftYmd: '2026-11-03', backYmd: '2029-11-08', due: false, alertOn: true, door: 'bring_back', hasLogin: true })
    expect(row.leftWords).toBe('Left Nov 3, 2026')
    expect(row.backWords).toBe('Back on Thursday, Nov 8, 2029 · 1,096 days')
    expect(split.logins.map((u) => u.id)).toEqual(['u-gone'])
    expect(split.rosterRows.map((r) => r.id)).toEqual(['p-gone', 'p-lone'])
  })

  it('leaves every row under Archived when there are no notes to read', () => {
    const split = splitAwayFromArchived({ logins: [nadia, gone], rosterRows: [nadiaRow, goneRow, loneRow], notes: [], todayYmd: TODAY })
    expect(split.away).toEqual([])
    expect(split.logins).toHaveLength(2)
    expect(split.rosterRows).toHaveLength(3)
  })

  it('ignores a note on a login that is not archived', () => {
    const split = splitAwayFromArchived({ logins: [gone], rosterRows: [goneRow], notes: [{ user_id: 'u-nadia', countdown_ymd: '2029-11-08' }], todayYmd: TODAY })
    expect(split.away).toEqual([])
    expect(split.logins).toHaveLength(1)
  })

  it('offers Restore and reads Archived when the roster row never ended, and counts from the archive day', () => {
    const split = splitAwayFromArchived({ logins: [gone], rosterRows: [goneRow], notes: [{ user_id: 'u-gone', countdown_ymd: null }], todayYmd: TODAY })
    const row = split.away[0]!
    expect(row.door).toBe('restore')
    expect(row.leftWords).toBe('Archived Jun 1, 2026')
    expect(row.backWords).toBe('No day back set')
    expect(row.due).toBe(false)
    expect(row.personId).toBe('p-gone')
  })

  it('reads a users row with no login as such, so the note window says nothing opens', () => {
    const split = splitAwayFromArchived({ logins: [{ ...gone, login_attached_at: null }], rosterRows: [], notes: [{ user_id: 'u-gone', countdown_ymd: null }], todayYmd: TODAY })
    expect(split.away[0]!.hasLogin).toBe(false)
  })

  it('sorts the due rows first by the oldest day, then the soonest day back, then the rows with no day, ties by name', () => {
    const logins = [
      { id: 'a', name: 'Zed', email: null, role: 'helpers', archived_at: '2026-01-01T00:00:00+00:00' },
      { id: 'b', name: 'Amy', email: null, role: 'helpers', archived_at: '2026-01-01T00:00:00+00:00' },
      { id: 'c', name: 'Cal', email: null, role: 'helpers', archived_at: '2026-01-01T00:00:00+00:00' },
      { id: 'd', name: 'Dee', email: null, role: 'helpers', archived_at: '2026-01-01T00:00:00+00:00' },
      { id: 'e', name: 'Eli', email: null, role: 'helpers', archived_at: '2026-01-01T00:00:00+00:00' },
    ]
    const notes = [
      { user_id: 'a', countdown_ymd: null },
      { user_id: 'b', countdown_ymd: null },
      { user_id: 'c', countdown_ymd: '2027-01-01' },
      { user_id: 'd', countdown_ymd: '2026-11-01' },
      { user_id: 'e', countdown_ymd: '2026-10-01' },
    ]
    const split = splitAwayFromArchived({ logins, rosterRows: [], notes, todayYmd: TODAY })
    expect(split.away.map((r) => r.displayName)).toEqual(['Eli', 'Dee', 'Cal', 'Amy', 'Zed'])
    expect(split.away.slice(0, 2).every((r) => r.due)).toBe(true)
  })

  it('names a login with no name by its roster row, then its email', () => {
    const split = splitAwayFromArchived({
      logins: [{ ...gone, name: null, email: 'g@example.com' }],
      rosterRows: [goneRow],
      notes: [{ user_id: 'u-gone', countdown_ymd: null }],
      todayYmd: TODAY,
    })
    expect(split.away[0]!.displayName).toBe('Gone Person')
    const noRow = splitAwayFromArchived({ logins: [{ ...gone, name: null, email: 'g@example.com' }], rosterRows: [], notes: [{ user_id: 'u-gone', countdown_ymd: null }], todayYmd: TODAY })
    expect(noRow.away[0]!.displayName).toBe('g@example.com')
  })
})

describe('awaySectionTitle', () => {
  it('counts', () => {
    expect(awaySectionTitle(1)).toBe('Away (1)')
  })
})

// v2.6863: the Away rows drawn as roster rows, their days in plain words.
describe('awayShortDate', () => {
  it('leaves the year off in the year we are in and shows it in any other', () => {
    expect(awayShortDate('2026-11-03', TODAY)).toBe('Nov 3')
    expect(awayShortDate('2029-11-08', TODAY)).toBe('Nov 8, 2029')
    expect(awayShortDate('2025-12-31', TODAY)).toBe('Dec 31, 2025')
    expect(awayShortDate('soon', TODAY)).toBe('soon')
  })
})

describe('awayDistanceWords', () => {
  it('counts in days, then weeks, then months, then years, ahead of today', () => {
    expect(awayDistanceWords(1)).toBe('tomorrow')
    expect(awayDistanceWords(2)).toBe('in 2 days')
    expect(awayDistanceWords(13)).toBe('in 13 days')
    expect(awayDistanceWords(14)).toBe('in 2 weeks')
    expect(awayDistanceWords(35)).toBe('in 5 weeks')
    expect(awayDistanceWords(62)).toBe('in 9 weeks')
    expect(awayDistanceWords(63)).toBe('in 2 months')
    expect(awayDistanceWords(203)).toBe('in 7 months')
    expect(awayDistanceWords(700)).toBe('in 23 months')
    expect(awayDistanceWords(731)).toBe('in 2 years')
    expect(awayDistanceWords(1094)).toBe('in 3 years')
  })

  it('counts the same steps behind today, and says nothing on the day', () => {
    expect(awayDistanceWords(-1)).toBe('yesterday')
    expect(awayDistanceWords(-3)).toBe('3 days ago')
    expect(awayDistanceWords(-21)).toBe('3 weeks ago')
    expect(awayDistanceWords(-400)).toBe('13 months ago')
    expect(awayDistanceWords(0)).toBeNull()
  })
})

describe('awayWhenWords', () => {
  const base = { endYmd: '2026-11-03', archivedYmd: '2026-11-08', todayYmd: TODAY }

  it('reads the day they left and the day back with how far off it is', () => {
    expect(awayWhenWords({ ...base, backYmd: '2029-11-08' })).toEqual({ left: 'Left Nov 3', back: 'back Nov 8, 2029', distance: 'in 3 years', text: 'Left Nov 3 · back Nov 8, 2029, in 3 years' })
    expect(awayWhenWords({ ...base, backYmd: '2026-11-20' }).text).toBe('Left Nov 3 · back Nov 20, in 12 days')
    expect(awayWhenWords({ ...base, backYmd: '2026-11-09' }).text).toBe('Left Nov 3 · back Nov 9, tomorrow')
  })

  it('reads due back after the day, back today on it, and no day back set without one', () => {
    expect(awayWhenWords({ ...base, backYmd: '2026-11-05' })).toEqual({ left: 'Left Nov 3', back: 'due back Nov 5', distance: '3 days ago', text: 'Left Nov 3 · due back Nov 5, 3 days ago' })
    expect(awayWhenWords({ ...base, backYmd: TODAY })).toEqual({ left: 'Left Nov 3', back: 'back today', distance: null, text: 'Left Nov 3 · back today' })
    expect(awayWhenWords({ ...base, backYmd: null }).text).toBe('Left Nov 3 · no day back set')
    expect(awayWhenWords({ ...base, backYmd: 'soon' }).text).toBe('Left Nov 3 · no day back set')
  })

  it('reads Archived when the roster row never ended', () => {
    expect(awayWhenWords({ endYmd: null, archivedYmd: '2026-06-01', backYmd: null, todayYmd: TODAY }).text).toBe('Archived Jun 1 · no day back set')
  })
})

describe('awayNoteFirstLine', () => {
  it('takes the first line with words on it and closes up its spaces', () => {
    expect(awayNoteFirstLine('\n  Rest up,   Nadia.  \nYour desk is as you left it.')).toBe('Rest up, Nadia.')
    expect(awayNoteFirstLine('One line')).toBe('One line')
  })

  it('is null for a note with no words', () => {
    expect(awayNoteFirstLine('')).toBeNull()
    expect(awayNoteFirstLine('  \n ')).toBeNull()
    expect(awayNoteFirstLine(null)).toBeNull()
    expect(awayNoteFirstLine(undefined)).toBeNull()
  })
})

describe('the Away group as roster rows', () => {
  it('counts the group and the rows due back', () => {
    expect(awayGroupCount([{ due: false }])).toBe('1')
    expect(awayGroupCount([{ due: true }, { due: false }, { due: false }, { due: true }])).toBe('4 · 2 due back')
  })

  it('keeps the door in the menu until the day back is here, then puts it on the row', () => {
    expect(awayDoorPlace({ due: false })).toBe('menu')
    expect(awayDoorPlace({ due: true })).toBe('row')
  })

  it('keeps the long day and the count of days for the hover title', () => {
    expect(awayWhenTitle({ leftWords: 'Left Nov 3, 2026', backWords: 'Back on Thursday, Nov 8, 2029 · 1,096 days' })).toBe('Left Nov 3, 2026 · Back on Thursday, Nov 8, 2029 · 1,096 days')
  })

  it('asks before Restore with a button that names the act', () => {
    expect(awayRestoreConfirm(' Nadia Test ')).toEqual({ title: 'Restore Nadia Test?', message: 'They can sign in again with the same email and history. It takes the note down.', confirmLabel: 'Restore' })
    expect(awayRestoreConfirm('').title).toBe('Restore this teammate?')
  })

  it('fills the row with its line of days and the note it carries', () => {
    const split = splitAwayFromArchived({
      logins: [nadia, gone],
      rosterRows: [nadiaRow, goneRow],
      notes: [
        { user_id: 'u-nadia', countdown_ymd: '2026-11-05', alert_on_day: true, words: 'Rest up, Nadia.\nSee you soon.' },
        { user_id: 'u-gone', countdown_ymd: null, words: '' },
      ],
      todayYmd: TODAY,
    })
    expect(split.away.map((r) => [r.displayName, r.when.text, r.noteLine, awayDoorPlace(r)])).toEqual([
      ['Nadia', 'Left Nov 3 · due back Nov 5, 3 days ago', 'Rest up, Nadia.', 'row'],
      ['Gone Person', 'Archived Jun 1 · no day back set', null, 'menu'],
    ])
  })
})
