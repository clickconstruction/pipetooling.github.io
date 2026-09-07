import { describe, expect, it } from 'vitest'
import {
  buildTeamBoard,
  formatHourLabel,
  formatWindow,
  hhmmToHours,
  sessionWindow,
  targetKeyFor,
  teamCellStanding,
  teamLedgerRows,
  trackPct,
  wallClockHours,
  type TeamBoardBlock,
  type TeamBoardSession,
} from './teamBoard'

// 2026-09-05 is a Saturday; Chicago is CDT (UTC-5) that week.
const DAYS = ['2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05']
const iso = (ymd: string, hhmm: string) => `${ymd}T${hhmm}:00-05:00`

function sess(over: Partial<TeamBoardSession> & { id: string; personName: string; workDate: string; in: string; out: string | null }): TeamBoardSession {
  const { in: i, out: o, ...rest } = over
  return {
    userId: 'u-' + over.personName.toLowerCase(),
    clockedInAt: iso(over.workDate, i),
    clockedOutAt: o ? iso(over.workDate, o) : null,
    approvedAt: iso(over.workDate, '20:00'),
    jobId: null,
    bidId: null,
    ...rest,
  }
}
function block(over: Partial<TeamBoardBlock> & { id: string; personName: string; workDate: string; timeStart: string; timeEnd: string }): TeamBoardBlock {
  return { userId: 'u-' + over.personName.toLowerCase(), jobId: null, bidId: null, note: null, ...over }
}
const LABELS = {
  'job:j878': { label: 'J878 · Take 5- Seguin', sub: '380 TX-123' },
  'job:j650': { label: 'J650 · ATI Schertz', sub: '5498 Cibolo Valley Dr' },
  'job:office': { label: 'J000 · Office', sub: 'Kingsbury' },
}

describe('time helpers', () => {
  it('reads the company wall clock and formats windows', () => {
    expect(wallClockHours('2026-09-05T13:33:00Z')).toBeCloseTo(8.55, 2) // 8:33 CDT
    expect(hhmmToHours('13:30:00')).toBe(13.5)
    expect(formatHourLabel(8)).toBe('8a')
    expect(formatHourLabel(13.5)).toBe('1:30p')
    expect(formatHourLabel(23.9958)).toBe('12a') // 11:59:45p rounds up, never "11:60p"
    expect(formatHourLabel(24)).toBe('12a')
    expect(formatWindow({ start: 8, end: 16 })).toBe('8a–4p')
    expect(trackPct(6)).toBe(0)
    expect(trackPct(15)).toBe(50)
    expect(trackPct(30)).toBe(100)
  })

  it('clamps a cross-midnight session to the clock-in day and drops drift', () => {
    expect(sessionWindow({ clockedInAt: iso('2026-09-05', '22:00'), clockedOutAt: `2026-09-06T02:00:00-05:00` })).toEqual({ start: 22, end: 24 })
    expect(sessionWindow({ clockedInAt: iso('2026-09-05', '10:00'), clockedOutAt: iso('2026-09-05', '09:00') })).toBeNull()
    expect(sessionWindow({ clockedInAt: iso('2026-09-05', '10:00'), clockedOutAt: null })).toBeNull()
  })

  it('keys targets job-first, then bid, then none', () => {
    expect(targetKeyFor('j', 'b')).toBe('job:j')
    expect(targetKeyFor(null, 'b')).toBe('bid:b')
    expect(targetKeyFor(null, null)).toBe('none')
  })
})

describe('buildTeamBoard', () => {
  const sessions = [
    sess({ id: 's1', personName: 'Isiah', workDate: '2026-09-03', in: '08:10', out: '15:09', jobId: 'j878' }),
    sess({ id: 's2', personName: 'Paige', workDate: '2026-09-01', in: '08:23', out: '20:46', jobId: 'j650' }),
    sess({ id: 's3', personName: 'Tristen', workDate: '2026-09-02', in: '06:42', out: '16:34', jobId: 'j878' }),
    sess({ id: 's4', personName: 'Isiah', workDate: '2026-09-05', in: '08:33', out: '09:16' }),
    sess({ id: 's5', personName: 'Bryan', workDate: '2026-09-05', in: '14:30', out: '23:59', approvedAt: null }),
    sess({ id: 's6', personName: 'Taunya', workDate: '2026-09-03', in: '08:18', out: '15:56', jobId: 'office' }),
    sess({ id: 'open', personName: 'Malachi', workDate: '2026-09-04', in: '08:00', out: null, jobId: 'j878' }),
  ]
  const blocks = [
    block({ id: 'b1', personName: 'Isiah', workDate: '2026-09-03', timeStart: '08:00:00', timeEnd: '12:00:00', jobId: 'j878' }),
    block({ id: 'b2', personName: 'Paige', workDate: '2026-09-01', timeStart: '12:00:00', timeEnd: '14:00:00', jobId: 'j650' }),
    block({ id: 'b3', personName: 'Malachi', workDate: '2026-09-05', timeStart: '08:00:00', timeEnd: '16:00:00', jobId: 'j650' }),
    block({ id: 'b4', personName: 'Isiah', workDate: '2026-09-05', timeStart: '08:00:00', timeEnd: '16:00:00', jobId: 'j650' }),
    block({ id: 'b5', personName: 'Taunya', workDate: '2026-09-03', timeStart: '08:00:00', timeEnd: '16:00:00', jobId: 'office' }),
  ]
  const board = buildTeamBoard({ days: DAYS, sessions, blocks, labels: LABELS, officeJobId: 'office', payFlags: { Taunya: { is_salary: true }, Isiah: { is_salary: false } } })
  const cell = (t: string, d: string, p: string) => board.cells.find((c) => c.targetKey === t && c.workDate === d && c.personName === p)

  it('classifies every cell kind and applies the ran-long rule', () => {
    expect(cell('job:j878', '2026-09-03', 'Isiah')).toMatchObject({ kind: 'ok', over: true, planHours: 4 })
    expect(cell('job:j878', '2026-09-03', 'Isiah')!.clockHours).toBeCloseTo(6.98, 2)
    expect(cell('job:j650', '2026-09-01', 'Paige')).toMatchObject({ kind: 'ok', over: true, planHours: 2 })
    expect(cell('job:j878', '2026-09-02', 'Tristen')).toMatchObject({ kind: 'unplanned', over: false })
    expect(cell('job:j650', '2026-09-05', 'Malachi')).toMatchObject({ kind: 'miss', clockHours: 0, planHours: 8 })
    expect(cell('none', '2026-09-05', 'Bryan')).toMatchObject({ kind: 'unlinked', pending: true, unlinkedSessionIds: ['s5'] })
    expect(cell('job:office', '2026-09-03', 'Taunya')).toMatchObject({ kind: 'office' })
    // an open session contributes no cell
    expect(cell('job:j878', '2026-09-04', 'Malachi')).toBeUndefined()
  })

  it('does not flag a modest overrun as ran long', () => {
    const b = buildTeamBoard({
      days: DAYS,
      sessions: [sess({ id: 'x', personName: 'A', workDate: '2026-09-01', in: '08:00', out: '17:00', jobId: 'j878' })],
      blocks: [block({ id: 'y', personName: 'A', workDate: '2026-09-01', timeStart: '08:00', timeEnd: '16:00', jobId: 'j878' })],
      labels: LABELS,
    })
    expect(b.cells[0]).toMatchObject({ kind: 'ok', over: false, clockHours: 9, planHours: 8 })
  })

  it('orders job rows none → busiest field jobs → office, and marks exception rows', () => {
    expect(board.jobRows.map((r) => r.key)).toEqual(['none', 'job:j878', 'job:j650', 'job:office'])
    expect(board.jobRows[0]).toMatchObject({ kind: 'none', hasException: true })
    expect(board.jobRows[3]).toMatchObject({ kind: 'office', hasException: false, label: 'J000 · Office' })
    expect(board.jobRows[1]!.cellsByDay['2026-09-03']!.map((c) => c.personName)).toEqual(['Isiah'])
  })

  it('builds person rows with pay-config targets', () => {
    const taunya = board.personRows.find((r) => r.key === 'Taunya')!
    expect(taunya.target).toBe(40) // salaried: 5 weekdays × 8
    const isiah = board.personRows.find((r) => r.key === 'Isiah')!
    expect(isiah.target).toBe(12) // hourly: the planned hours (4 + 8)
    const bryan = board.personRows.find((r) => r.key === 'Bryan')!
    expect(bryan.target).toBeNull()
  })

  it('totals field time only (no office, no unlinked) per day and in the summary', () => {
    const thu = board.dayTotals.find((d) => d.workDate === '2026-09-03')!
    expect(thu.planned).toBe(4)
    expect(thu.clocked).toBeCloseTo(6.98, 2)
    expect(board.summary.plannedField).toBe(4 + 2 + 8 + 8)
    expect(board.summary.onPlanHours).toBeCloseTo(6.98 + 12.38, 1)
    expect(board.summary).toMatchObject({ unlinkedSessions: 2, pendingUnlinked: 1, missCount: 2, overCount: 2, unplannedCount: 1 })
    expect(board.summary.unlinkedHours).toBeCloseTo(0.72 + 9.48, 1)
  })

  it('lists exceptions newest day first with the dispatch suggestion for unlinked hours', () => {
    const kinds = board.exceptions.map((e) => `${e.workDate.slice(5)} ${e.kind} ${e.personName}`)
    expect(kinds.slice(0, 4)).toEqual(['09-05 unlinked Bryan', '09-05 unlinked Isiah', '09-05 miss Isiah', '09-05 miss Malachi'])
    const isiah = board.exceptions.find((e) => e.kind === 'unlinked' && e.personName === 'Isiah')!
    expect(isiah.suggestion).toEqual({ targetKey: 'job:j650', window: '8a–4p', blockId: 'b4' })
    expect(isiah.sessionIds).toEqual(['s4'])
    const bryan = board.exceptions.find((e) => e.personName === 'Bryan')!
    expect(bryan.suggestion).toBeNull()
    expect(bryan.pending).toBe(true)
  })

  it('names standings in the Subs vocabulary and sorts the ledger exceptions-first', () => {
    expect(teamCellStanding(cell('job:j878', '2026-09-03', 'Isiah')!)).toEqual({ tone: 'warn', text: 'Ran long' })
    expect(teamCellStanding(cell('job:j650', '2026-09-05', 'Malachi')!)).toEqual({ tone: 'miss', text: 'No clock' })
    expect(teamCellStanding(cell('none', '2026-09-05', 'Bryan')!)).toEqual({ tone: 'warn', text: 'Not on a job' })
    expect(teamCellStanding(cell('job:office', '2026-09-03', 'Taunya')!)).toEqual({ tone: 'office', text: 'Office' })
    const rows = teamLedgerRows(board)
    expect(rows[0]!.workDate).toBe('2026-09-05')
    expect(rows[0]!.kind).toBe('unlinked')
  })

  it('attaches sub sheets to their job row or gives them a row of their own', () => {
    const b = buildTeamBoard({
      days: DAYS,
      sessions: [sess({ id: 's', personName: 'Isiah', workDate: '2026-09-04', in: '08:00', out: '12:00', jobId: 'j878' })],
      blocks: [],
      subSheets: [
        { id: 'sh1', workDate: '2026-09-04', jobId: 'j878', jobNumber: '878', contractor: 'Behar Kraja', stage: 'working', address: '' },
        { id: 'sh2', workDate: '2026-09-04', jobId: null, jobNumber: '1004', contractor: 'Test Sub', stage: 'walkthrough', address: 'Somewhere' },
      ],
      labels: LABELS,
    })
    expect(b.jobRows.find((r) => r.key === 'job:j878')!.subSheetsByDay['2026-09-04']!.map((s) => s.contractor)).toEqual(['Behar Kraja'])
    const own = b.jobRows.find((r) => r.key === 'sheet:1004')!
    expect(own).toMatchObject({ label: 'J1004', sub: 'Somewhere' })
  })
})

// v2.2978 — action helpers
import { hoursToHhmmss, pickFromTargetKey, plannedWindowFromClock } from './teamBoard'

describe('action helpers', () => {
  it('turns a target key back into a pick', () => {
    expect(pickFromTargetKey('job:j1')).toEqual({ type: 'job', id: 'j1' })
    expect(pickFromTargetKey('bid:b1')).toEqual({ type: 'bid', id: 'b1' })
    expect(pickFromTargetKey('none')).toBeNull()
  })

  it('derives the dispatch block a clocked-not-planned day implies', () => {
    expect(hoursToHhmmss(8.5)).toBe('08:30:00')
    expect(hoursToHhmmss(23.9958)).toBe('24:00:00')
    expect(plannedWindowFromClock({ clock: [{ start: 9.7, end: 12 }, { start: 13, end: 18.55 }] })).toEqual({ time_start: '09:42:00', time_end: '18:33:00' })
    expect(plannedWindowFromClock({ clock: [] })).toBeNull()
  })
})
