import { describe, expect, it } from 'vitest'
import { lienDeskRowFromState, lienDeskStateForView, lienDeskStateWithRow, lienJobScreen, lienJobScreenClosesOnAct, lienRowHasPaper } from './lienPhoneJobScreen'
import type { LienNextUpRow } from './lienNextUp'

const row = (over: Partial<LienNextUpRow> = {}): LienNextUpRow => ({
  key: 'aff:j1', kind: 'affidavit', jobId: 'j1', gcId: null, title: '412 · Oak Hollow remodel', sub: 'Ready to file', dueOn: '2026-11-16', daysLeft: 3, severity: 'red', group: 'now',
  action: 'file_affidavit', button: 'File the affidavit', target: { open: 'affidavits', jobId: 'j1' }, ...over,
})
const card = { kindWords: 'Affidavit', deadline: 'File by Nov 16 · 3 days left', tone: 'red' as const }
const all = { paper: true, lienWindow: true, job: true }

describe('lienJobScreen', () => {
  it('says the job, what it owes, when the paper is due and the row’s own press', () => {
    const s = lienJobScreen(row(), card, { amount: 8400, gaps: 2, can: all })
    expect(s).toMatchObject({ title: '412 · Oak Hollow remodel', kindWords: 'Affidavit', owes: '$8,400 open', due: 'File by Nov 16 · 3 days left', tone: 'red', state: 'Ready to file', secondary: null })
    expect(s.press).toEqual({ label: 'File the affidavit', primary: true })
    expect(s.doors.map((d) => d.key)).toEqual(['paper', 'lien_window', 'job'])
    expect(s.doors[0]).toEqual({ key: 'paper', label: 'Open the affidavit as it stands', hint: '2 details missing', warn: true })
  })

  it('a paper with nothing missing says so, and one the desk has not counted says nothing', () => {
    expect(lienJobScreen(row({ kind: 'notice' }), card, { amount: null, gaps: 0, can: all }).doors[0]).toEqual({ key: 'paper', label: 'Open the notice as it stands', hint: 'Nothing missing', warn: false })
    expect(lienJobScreen(row(), card, { amount: null, gaps: 1, can: all }).doors[0]!.hint).toBe('1 detail missing')
    expect(lienJobScreen(row(), card, { amount: null, gaps: null, can: all }).doors[0]!.hint).toBe('')
  })

  it('a row this viewer has no move on still opens, with a plain press', () => {
    expect(lienJobScreen(row({ button: null }), card, { amount: null, gaps: null, can: all }).press).toEqual({ label: 'Open', primary: false })
  })

  it('no amount and a zero amount read as no amount', () => {
    expect(lienJobScreen(row(), card, { amount: null, gaps: null, can: all }).owes).toBeNull()
    expect(lienJobScreen(row(), card, { amount: 0, gaps: null, can: all }).owes).toBeNull()
  })

  it('a retainage notice has no paper door; a door the desk cannot open is not drawn', () => {
    expect(lienJobScreen(row({ kind: 'retainage' }), card, { amount: null, gaps: null, can: all }).doors.map((d) => d.key)).toEqual(['lien_window', 'job'])
    expect(lienJobScreen(row(), card, { amount: null, gaps: null, can: { paper: false, lienWindow: false, job: true } }).doors.map((d) => d.key)).toEqual(['job'])
  })

  it('a run row lists its jobs, has no doors of its own and keeps its second press', () => {
    const run = row({ key: 'run:printed', jobId: null, kind: 'notice', title: '4 notices printed Nov 9', button: 'Record the mailing', action: 'record_mailing', target: { open: 'run', gcId: null }, secondary: { words: 'Take back…', target: { open: 'run', gcId: null, takeBack: true } }, jobs: [{ jobId: 'a', title: '455 · Service visit', dueOn: '2026-11-15' }] })
    const s = lienJobScreen(run, card, { amount: null, gaps: null, can: all })
    expect(s.kindWords).toBe('Run')
    expect(s.doors).toEqual([])
    expect(s.jobs).toHaveLength(1)
    expect(s.secondary).toBe('Take back…')
  })
})

describe('lienRowHasPaper', () => {
  it('is a job’s notice or affidavit', () => {
    expect(lienRowHasPaper({ jobId: 'j', kind: 'notice' })).toBe(true)
    expect(lienRowHasPaper({ jobId: 'j', kind: 'affidavit' })).toBe(true)
    expect(lienRowHasPaper({ jobId: 'j', kind: 'retainage' })).toBe(false)
    expect(lienRowHasPaper({ jobId: null, kind: 'notice' })).toBe(false)
    expect(lienRowHasPaper({ jobId: 'j', kind: 'notice', jobs: [] })).toBe(false)
  })
})

describe('lienJobScreenClosesOnAct', () => {
  it('stays open behind a window and closes when the desk goes elsewhere', () => {
    expect(lienJobScreenClosesOnAct({ open: 'run', gcId: null })).toBe(false)
    expect(lienJobScreenClosesOnAct({ open: 'lien_window', jobId: 'j', tab: 'affidavit' })).toBe(false)
    expect(lienJobScreenClosesOnAct({ open: 'affidavits', jobId: 'j' })).toBe(true)
    expect(lienJobScreenClosesOnAct({ open: 'retainage', jobId: 'j' })).toBe(true)
    expect(lienJobScreenClosesOnAct({ open: 'notices', jobId: 'j', pile: 'sent' })).toBe(true)
  })
})

describe('the open row in a history entry', () => {
  it('reads the row’s key, and nothing from a state that names none', () => {
    expect(lienDeskRowFromState({ row: 'aff:j1' })).toBe('aff:j1')
    expect([null, undefined, 'x', 3, [], {}, { row: '' }, { row: 4 }].map(lienDeskRowFromState)).toEqual([null, null, null, null, null, null, null, null])
  })

  it('opens a row beside what the entry already held', () => {
    expect(lienDeskStateWithRow({ fromList: true }, 'aff:j1')).toEqual({ fromList: true, row: 'aff:j1' })
    expect(lienDeskStateWithRow(null, 'k')).toEqual({ row: 'k' })
  })

  it('keeps the row on the first view and drops it on any other', () => {
    const state = { fromList: true, row: 'k' }
    expect(lienDeskStateForView(state, 'next')).toBe(state)
    expect(lienDeskStateForView(state, 'affidavit')).toEqual({ fromList: true })
    expect(lienDeskStateForView({ row: 'k' }, 'calendar')).toBeNull()
    const other = { fromList: true }
    expect(lienDeskStateForView(other, 'notice')).toBe(other)
    expect(lienDeskStateForView(null, 'notice')).toBeNull()
  })
})
