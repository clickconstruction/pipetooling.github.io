import { describe, expect, it } from 'vitest'
import { awayBackWords, awayLeftWords, awaySectionTitle, daysBetweenYmd, splitAwayFromArchived } from './awaySection'

const TODAY = '2026-11-08'

const paige = { id: 'u-paige', name: 'Paige', email: 'paige@example.com', role: 'helpers', archived_at: '2026-11-08T17:01:23.219+00:00' }
const gone = { id: 'u-gone', name: 'Gone Person', email: null, role: 'helpers', archived_at: '2026-06-01T15:00:00+00:00' }
const paigeRow = { id: 'p-paige', name: 'Paige', email: 'paige@example.com', archived_at: '2026-11-08T17:01:23.226+00:00', end_date: '2026-11-03', account_user_id: 'u-paige' }
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
      logins: [paige, gone],
      rosterRows: [paigeRow, goneRow, loneRow],
      notes: [{ user_id: 'u-paige', countdown_ymd: '2029-11-08', alert_on_day: true }],
      todayYmd: TODAY,
    })
    expect(split.away).toHaveLength(1)
    const row = split.away[0]!
    expect(row).toMatchObject({ userId: 'u-paige', personId: 'p-paige', displayName: 'Paige', role: 'helpers', leftYmd: '2026-11-03', backYmd: '2029-11-08', due: false, alertOn: true, door: 'bring_back', hasLogin: true })
    expect(row.leftWords).toBe('Left Nov 3, 2026')
    expect(row.backWords).toBe('Back on Thursday, Nov 8, 2029 · 1,096 days')
    expect(split.logins.map((u) => u.id)).toEqual(['u-gone'])
    expect(split.rosterRows.map((r) => r.id)).toEqual(['p-gone', 'p-lone'])
  })

  it('leaves every row under Archived when there are no notes to read', () => {
    const split = splitAwayFromArchived({ logins: [paige, gone], rosterRows: [paigeRow, goneRow, loneRow], notes: [], todayYmd: TODAY })
    expect(split.away).toEqual([])
    expect(split.logins).toHaveLength(2)
    expect(split.rosterRows).toHaveLength(3)
  })

  it('ignores a note on a login that is not archived', () => {
    const split = splitAwayFromArchived({ logins: [gone], rosterRows: [goneRow], notes: [{ user_id: 'u-paige', countdown_ymd: '2029-11-08' }], todayYmd: TODAY })
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
