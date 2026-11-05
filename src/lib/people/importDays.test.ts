import { describe, expect, it } from 'vitest'
import { importClockRows, importResultWords, jobNumberDigits, parseImportDayLines, readImportAnswer } from './importDays'

describe('parseImportDayLines', () => {
  it('reads one day a line, with a comma or a tab, the note everything after the hours', () => {
    const { rows, problems } = parseImportDayLines('2026-10-06, 8, bank row of Oct 10\n\n2026-10-07\t7.5\tbank row of Oct 10, second line\n')
    expect(problems).toEqual([])
    expect(rows).toEqual([
      { line: 1, work_date: '2026-10-06', hours: 8, note: 'bank row of Oct 10' },
      { line: 3, work_date: '2026-10-07', hours: 7.5, note: 'bank row of Oct 10, second line' },
    ])
  })
  it('names each line that will not read and keeps the rest', () => {
    const { rows, problems } = parseImportDayLines('10/06/2026, 8, note\n2026-10-06, 0, note\n2026-10-06, 17, note\n2026-10-06, 8\n2026-10-08, 8, fine')
    expect(rows.map((r) => r.line)).toEqual([5])
    expect(problems).toEqual([
      { line: 1, reason: 'the day must read YYYY-MM-DD' },
      { line: 2, reason: 'the hours must be a number over 0 and at most 16' },
      { line: 3, reason: 'the hours must be a number over 0 and at most 16' },
      { line: 4, reason: 'the note must name where the day came from' },
    ])
  })
})

describe('importClockRows', () => {
  it('starts each day at 8 in the company zone and runs the hours', () => {
    const [row] = importClockRows([{ line: 1, work_date: '2026-10-06', hours: 8, note: 'n' }], { userId: 'u1', jobId: 'j1' })
    expect(row).toMatchObject({ user_id: 'u1', job_ledger_id: 'j1', work_date: '2026-10-06', notes: 'n' })
    // 08:00 in America/Chicago on 2026-10-06 (CDT) is 13:00Z; eight hours later is 21:00Z.
    expect(row!.clocked_in_at).toBe('2026-10-06T13:00:00.000Z')
    expect(row!.clocked_out_at).toBe('2026-10-06T21:00:00.000Z')
  })
})

describe('readImportAnswer and the words', () => {
  it('reads the answer and refuses a shape it cannot', () => {
    expect(readImportAnswer({ inserted: 2, skipped: 1, refused: [{ row: 3, reason: 'a day of more than sixteen hours' }] })).toEqual({ inserted: 2, skipped: 1, refused: [{ row: 3, reason: 'a day of more than sixteen hours' }] })
    expect(() => readImportAnswer(null)).toThrow('shape')
  })
  it('says each outcome on its line', () => {
    const lines = [{ line: 1, work_date: '2026-10-06', hours: 8, note: 'n' }, { line: 2, work_date: '2026-10-07', hours: 8, note: 'n' }, { line: 4, work_date: '2026-10-08', hours: 8, note: 'n' }]
    const words = importResultWords({ inserted: 1, skipped: 1, refused: [{ row: 3, reason: 'no such job, or a billing-only job' }] }, [{ line: 3, reason: 'the note must name where the day came from' }], lines)
    expect(words).toEqual(['1 day went in, waiting for approval.', '1 day was already there and was skipped.', 'Line 4: refused — no such job, or a billing-only job.', 'Line 3: not sent — the note must name where the day came from.'])
  })
  it('reads a job number as the digits the ledger holds', () => {
    expect(jobNumberDigits('JP1064')).toBe('1064')
    expect(jobNumberDigits(' #1064 ')).toBe('1064')
    expect(jobNumberDigits('1064')).toBe('1064')
    expect(jobNumberDigits('sink')).toBeNull()
  })
})
