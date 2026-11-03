/**
 * The form side of the signed hours statement (punch list #212, PR 3): the document's name and path, the stated boxes'
 * keys, the office's seed values, a worker's typed day and hours read back, the stated rows out of a signing, the
 * paper path's rows checked, and the person copy's note.
 */
import { describe, expect, it } from 'vitest'
import {
  HOURS_STATEMENT_BLANK_STATED_ROWS,
  HOURS_STATEMENT_DOC_TYPE,
  hoursStatementDocumentName,
  hoursStatementDocumentNote,
  hoursStatementTemplatePath,
  parseStatedDay,
  parseStatedDayRows,
  parseStatedHours,
  statedBoxKeys,
  statedByWords,
  statedDaysFromFormValues,
  statedRowCount,
  statedSeedValues,
} from './hoursStatementForm'

// Every name and number here is made up.
describe('the statement as a form (punch list #212, PR 3)', () => {
  it('names the document and its template path from the record id and the statement id', () => {
    expect(HOURS_STATEMENT_DOC_TYPE).toBe('hours_statement')
    expect(hoursStatementDocumentName('HS-1042-0007')).toBe('Hours statement HS-1042-0007')
    expect(hoursStatementDocumentName('')).toBe('Hours statement draft')
    expect(hoursStatementTemplatePath('0f1e2d3c')).toBe('hours-statements/0f1e2d3c/statement.pdf')
  })

  it('keys the stated boxes by row and counts the rows as the stated days plus the blank ones', () => {
    expect(statedBoxKeys(1)).toEqual({ day: 'stated_1_day', hours: 'stated_1_hours', note: 'stated_1_note' })
    expect(statedBoxKeys(0).day).toBe('stated_1_day')
    expect(statedRowCount([])).toBe(HOURS_STATEMENT_BLANK_STATED_ROWS)
    expect(statedRowCount([{}, {}])).toBe(2 + HOURS_STATEMENT_BLANK_STATED_ROWS)
  })

  it('seeds the boxes from the days the office stated, leaving a blank hours cell blank', () => {
    expect(statedSeedValues([{ day: '2025-09-15', hours: 8, note: 'Rough-in', statedBy: 'Office, 2026-11-02' }, { day: '2025-09-16', hours: null, note: '', statedBy: '' }])).toEqual({
      stated_1_day: '2025-09-15',
      stated_1_hours: '8',
      stated_1_note: 'Rough-in',
      stated_2_day: '2025-09-16',
    })
  })

  it('reads a day as a worker types it, in the shapes they use, and refuses what is not a day', () => {
    expect(parseStatedDay('2025-09-15')).toBe('2025-09-15')
    expect(parseStatedDay('9/15/2025')).toBe('2025-09-15')
    expect(parseStatedDay('9/15/25')).toBe('2025-09-15')
    expect(parseStatedDay('09-15-2025')).toBe('2025-09-15')
    expect(parseStatedDay('9/15', 2025)).toBe('2025-09-15')
    expect(parseStatedDay('9/15')).toBeNull()
    expect(parseStatedDay('2025-02-30')).toBeNull()
    expect(parseStatedDay('Monday')).toBeNull()
    expect(parseStatedDay('')).toBeNull()
  })

  it('reads hours as a worker types them and refuses nonsense', () => {
    expect(parseStatedHours('8')).toBe(8)
    expect(parseStatedHours('8.5')).toBe(8.5)
    expect(parseStatedHours('8,5')).toBe(8.5)
    expect(parseStatedHours('8 h')).toBe(8)
    expect(parseStatedHours('8hrs')).toBe(8)
    expect(parseStatedHours('25')).toBeNull()
    expect(parseStatedHours('0')).toBeNull()
    expect(parseStatedHours('eight')).toBeNull()
    expect(parseStatedHours('')).toBeNull()
  })

  it('reads the stated days out of a signing: rows with a day, in day order, a day alone kept, a row with no day dropped', () => {
    const rows = statedDaysFromFormValues(
      {
        printed_name: 'Marcus Reyes',
        stated_1_day: '9/16/2025',
        stated_1_hours: '8',
        stated_1_note: 'Water lines',
        stated_2_day: '9/15/2025',
        stated_2_hours: '',
        stated_2_note: '',
        stated_3_day: '',
        stated_3_hours: '4',
        stated_3_note: 'no day here',
        stated_4_day: '9/17',
        stated_4_hours: '6.5',
        stated_4_note: 'Trim',
      },
      'Marcus Reyes, 2026-11-02',
      { yearHint: 2025 },
    )
    expect(rows).toEqual([
      { day: '2025-09-15', hours: null, note: '', statedBy: 'Marcus Reyes, 2026-11-02' },
      { day: '2025-09-16', hours: 8, note: 'Water lines', statedBy: 'Marcus Reyes, 2026-11-02' },
      { day: '2025-09-17', hours: 6.5, note: 'Trim', statedBy: 'Marcus Reyes, 2026-11-02' },
    ])
    expect(statedDaysFromFormValues({ printed_name: 'x' }, 'x')).toEqual([])
    expect(statedByWords('Marcus Reyes', '2026-11-02')).toBe('Marcus Reyes, 2026-11-02')
    expect(statedByWords('  ', '2026-11-02')).toBe('The worker, 2026-11-02')
  })

  it('checks the paper path’s rows: a real day each, hours a number up to 24, and says which row is wrong', () => {
    expect(parseStatedDayRows(undefined, 'x')).toEqual([])
    expect(parseStatedDayRows([{ day: '2025-09-16', hours: '8', note: 'Rough-in' }, { day: '2025-09-15', hours: 4 }], 'Marcus Reyes, 2026-11-01')).toEqual([
      { day: '2025-09-15', hours: 4, note: '', statedBy: 'Marcus Reyes, 2026-11-01' },
      { day: '2025-09-16', hours: 8, note: 'Rough-in', statedBy: 'Marcus Reyes, 2026-11-01' },
    ])
    expect(parseStatedDayRows([{ day: 'someday' }], 'x')).toEqual({ error: 'Stated row 1 needs a day (YYYY-MM-DD).' })
    expect(parseStatedDayRows([{ day: '2025-09-15', hours: 30 }], 'x')).toEqual({ error: 'Stated row 1: hours must be a number up to 24.' })
    expect(parseStatedDayRows('nope', 'x')).toEqual({ error: 'stated_days must be a list of { day, hours, note }.' })
  })

  it('writes the person copy’s note by how the statement went out', () => {
    expect(hoursStatementDocumentNote({ recordId: 'HS-1042-0007', jobNumber: '1042', how: 'email', byName: 'Dana Office' })).toBe('Hours statement HS-1042-0007 · job 1042 · emailed by Dana Office')
    expect(hoursStatementDocumentNote({ recordId: 'HS-1042-0007', jobNumber: '1042', how: 'in_person', byName: 'Dana Office' })).toBe('Hours statement HS-1042-0007 · job 1042 · handed to the worker in person by Dana Office')
    expect(hoursStatementDocumentNote({ recordId: 'HS-1042-0007', jobNumber: '1042', how: 'paper', byName: '' })).toBe('Hours statement HS-1042-0007 · job 1042 · signed on paper, filed by the office')
    expect(hoursStatementDocumentNote({ recordId: 'HS-1042-0007', jobNumber: '1042', how: 'text', byName: 'Dana Office' })).toContain('link texted by')
    expect(hoursStatementDocumentNote({ recordId: 'HS-1042-0007', jobNumber: '1042', how: 'link', byName: 'Dana Office' })).toContain('link copied by')
  })
})
