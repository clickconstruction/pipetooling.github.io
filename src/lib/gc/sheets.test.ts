import { describe, expect, it } from 'vitest'
import { tradesForSheets } from './plans'
import { disciplineOf, nextSheetNumber, readSheetLines, readTitleBlock, rowProblems, sheetsOfRows, withPickedDisciplines, type PdfTextItem, type SheetIndexRow } from './sheets'

describe('the sheet index as one table: a plan PDF, a paste or typing', () => {
  it('reads any pasted layout line by line, and says why each line it skips was skipped', () => {
    const lines = readSheetLines(
      ['ARCHITECTURAL', 'A-101\tFIRST FLOOR PLAN', 'A1.02  Roof plan', 'FLOOR FINISH PLAN ........ A-103', '4. P-101 PLUMBING PLAN 09/15/2026', 'Sheet E-201 - Lighting plan', 'Issued for bid 10/01', 'A-101 First floor plan', 'S-101 FOUNDATION PLAN ........ 12'].join('\n'),
      ['P-101'],
    )
    expect(lines.map((l) => (l.sheet ? `${l.sheet.id} ${l.sheet.title}` : l.why))).toEqual([
      'A heading, with no sheet number.',
      'A-101 First floor plan',
      'A1.02 Roof plan',
      'A-103 Floor finish plan',
      'Sheet P-101 is already in the list.',
      'E-201 Lighting plan',
      'No sheet number at the start or the end of the line.',
      'Sheet A-101 is already in the list.',
      'S-101 Foundation plan',
    ])
  })

  it('gives the number after the last one, keeping its width and its dot', () => {
    expect(nextSheetNumber('A-101')).toBe('A-102')
    expect(nextSheetNumber('A1.09')).toBe('A1.10')
    expect(nextSheetNumber('E-9')).toBe('E-10')
    expect(nextSheetNumber('M-201A')).toBe('M-202')
    expect(nextSheetNumber('')).toBe('')
  })

  it('keeps the rows with a number, says which rows want one or repeat one, and keeps a picked discipline', () => {
    const rows: SheetIndexRow[] = [
      { key: 'a', id: 'a-101', title: ' First floor plan ', from: 'typed' },
      { key: 'b', id: '', title: '', page: 3, from: 'pdf', problem: 'Page 3: no sheet number on it.' },
      { key: 'c', id: 'A101', title: 'Again', from: 'paste' },
      { key: 'd', id: 'X-1', title: 'Kitchen equipment', discipline: 'Plumbing', page: 4, from: 'pdf' },
      { key: 'e', id: 'P-101', title: 'Plumbing plan', discipline: 'Plumbing', from: 'typed' },
    ]
    expect(rowProblems(rows)).toEqual({ b: 'Page 3: no sheet number on it.', c: 'Sheet A101 is listed twice.' })
    expect(sheetsOfRows(rows)).toEqual([
      { id: 'A-101', title: 'First floor plan' },
      { id: 'X-1', title: 'Kitchen equipment', discipline: 'Plumbing', page: 4 },
      { id: 'P-101', title: 'Plumbing plan' },
    ])
    expect(disciplineOf({ id: 'X-1', title: '', discipline: 'Plumbing' })).toBe('Plumbing')
    expect(disciplineOf({ id: 'P-101', title: '' })).toBe('Plumbing')
  })

  it('suggests the trades for a sheet put in a discipline its letters do not say', () => {
    const sheets = [
      { id: 'A-101', title: 'Floor plan' },
      { id: 'X-1', title: 'Kitchen equipment', discipline: 'Plumbing' },
    ]
    const guesses = withPickedDisciplines(tradesForSheets(sheets), sheets, (trade) => ({ trade, from: [] }))
    expect(guesses.find((g) => g.trade === 'Plumbing')?.from).toEqual(['X-1'])
    expect(withPickedDisciplines(tradesForSheets(sheets.slice(0, 1)), sheets.slice(0, 1), (trade) => ({ trade, from: [] }))).toEqual(tradesForSheets(sheets.slice(0, 1)))
  })

  it('reads a sheet number and title from the title block in the bottom right of a page', () => {
    const page: PdfTextItem[] = [
      { str: 'GENERAL NOTES', x: 40, y: 560, size: 12 },
      { str: '1. VERIFY ALL DIMENSIONS. SEE A-501.', x: 40, y: 540, size: 9 },
      { str: 'Ortiz Architects', x: 620, y: 200, size: 10 },
      { str: 'Hill Country Clinic', x: 620, y: 180, size: 10 },
      { str: 'SHEET TITLE', x: 620, y: 140, size: 7 },
      { str: 'FIRST', x: 620, y: 124, size: 12 },
      { str: 'FLOOR PLAN', x: 657, y: 124, size: 12 },
      { str: 'SHEET NO.', x: 620, y: 90, size: 7 },
      { str: 'A-101', x: 620, y: 50, size: 28 },
    ]
    expect(readTitleBlock(page, 792, 612)).toEqual({ id: 'A-101', title: 'First floor plan' })
    expect(readTitleBlock(page.filter((i) => i.str !== 'SHEET TITLE'), 792, 612)).toEqual({ id: 'A-101', title: 'First floor plan' })
    const twoLines = page.map((i) => (i.str === 'FLOOR PLAN' ? { ...i, str: 'FLOOR AND' } : i)).concat([{ str: 'FINISH PLAN', x: 620, y: 110, size: 12 }])
    expect(readTitleBlock(twoLines, 792, 612)).toEqual({ id: 'A-101', title: 'First floor and finish plan' })
    expect(readTitleBlock([{ str: 'COVER', x: 300, y: 300, size: 40 }], 792, 612)).toBeNull()
  })
})
