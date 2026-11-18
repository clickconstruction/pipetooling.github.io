import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { JOB_MODE_SHORT_WORDS, jobModeShortOn, jobModeShortScheduleRead, jobModeShortTomorrow } from './jobModeShort'

describe('jobModeShort · a superintendent’s one-screen home (punch list #384)', () => {
  it('is on for a superintendent whose view is Short with Job Mode on, and for nobody else', () => {
    expect(jobModeShortOn({ view: 'short', role: 'superintendent', jobModeOn: true })).toBe(true)
    // Full, or Job Mode off: the page he sees today, or the short Dashboard.
    expect(jobModeShortOn({ view: 'full', role: 'superintendent', jobModeOn: true })).toBe(false)
    expect(jobModeShortOn({ view: 'short', role: 'superintendent', jobModeOn: false })).toBe(false)
    // A leader and a dev in Job Mode keep the full card, as #365 decided.
    expect(jobModeShortOn({ view: 'short', role: 'master_technician', jobModeOn: true })).toBe(false)
    expect(jobModeShortOn({ view: 'short', role: 'dev', jobModeOn: true })).toBe(false)
    // Field crew take no view, so a stray value on the row draws nothing.
    for (const role of ['subcontractor', 'helpers', 'estimator', 'assistant', null, undefined]) expect(jobModeShortOn({ view: 'short', role, jobModeOn: true }), String(role)).toBe(false)
  })

  it('says tomorrow in one line: how many stops and when the first is', () => {
    expect(jobModeShortTomorrow([{ timeStart: '08:00:00', label: '2050 · Linden vanity faucet' }])).toEqual({ title: 'Tomorrow', note: '1 stop. First at 8:00 AM, 2050 Linden vanity faucet.' })
    // The first is the earliest, whatever order the blocks came in.
    expect(
      jobModeShortTomorrow([
        { timeStart: '13:00:00', label: '2061 · Calloway bath' },
        { timeStart: '07:30:00', label: '2058 · Harlan repipe' },
        { timeStart: '09:30', label: '2060 · Oakmont drain' },
      ]).note,
    ).toBe('3 stops. First at 7:30 AM, 2058 Harlan repipe.')
    // A block with no label still says when.
    expect(jobModeShortTomorrow([{ timeStart: '10:00:00', label: ' ' }]).note).toBe('1 stop. First at 10:00 AM.')
    // A date typed into the job's name reads as the day and the month and day, as on the card.
    expect(jobModeShortTomorrow([{ timeStart: '07:00:00', label: '1113 · ZZ Test Walk Project 2026-11-08' }]).note).toBe('1 stop. First at 7:00 AM, 1113 ZZ Test Walk Project Sun, Nov 8.')
  })

  it('says so when tomorrow holds no stop, and never mutates the blocks', () => {
    expect(jobModeShortTomorrow([])).toEqual({ title: 'Tomorrow', note: 'No stops yet. Tap for your schedule.' })
    const stops = [
      { timeStart: '13:00:00', label: 'b' },
      { timeStart: '07:30:00', label: 'a' },
    ]
    jobModeShortTomorrow(stops)
    expect(stops.map((s) => s.label)).toEqual(['b', 'a'])
  })

  it('counts nothing while the schedule is being read or after its read failed', () => {
    const stops = [{ timeStart: '08:00:00', label: '2050 · Linden vanity faucet' }]
    expect(jobModeShortTomorrow(stops, 'reading').note).toBe('Reading your schedule.')
    expect(jobModeShortTomorrow([], 'reading').note).toBe('Reading your schedule.')
    expect(jobModeShortTomorrow(stops, 'failed').note).toBe('Your schedule could not be read. Tap to open it.')
    expect(jobModeShortTomorrow(stops, 'ready').note).toBe('1 stop. First at 8:00 AM, 2050 Linden vanity faucet.')
    // A day kept on the phone is in, whatever the read is doing behind it.
    expect(jobModeShortScheduleRead({ loading: true, failed: true, kept: true })).toBe('ready')
    expect(jobModeShortScheduleRead({ loading: false, failed: true, kept: false })).toBe('failed')
    expect(jobModeShortScheduleRead({ loading: true, failed: false, kept: false })).toBe('reading')
    expect(jobModeShortScheduleRead({ loading: false, failed: false, kept: false })).toBe('ready')
  })

  it('the door says what is behind it and how many courses are owed', () => {
    const w = JOB_MODE_SHORT_WORDS
    expect(w.doorNote(0)).toBe('Your hours, your schedule, training and the full Dashboard.')
    expect(w.doorNote(1)).toBe('Your hours, your schedule, training and the full Dashboard. 1 course to do.')
    expect(w.doorNote(2)).toBe('Your hours, your schedule, training and the full Dashboard. 2 courses to do.')
    expect(w.doorNote(-1)).toBe(w.doorNote(0))
  })

  it('every word on the page is plain words', () => {
    const w = JOB_MODE_SHORT_WORDS
    const sentences = [
      w.openJob.title,
      w.openJob.note,
      w.openJob.openTitle,
      w.openJob.openNote,
      w.pace.open,
      w.pace.fold,
      w.waiting,
      w.tomorrow.title,
      w.tomorrow.none,
      w.tomorrow.reading,
      w.tomorrow.failed,
      w.door,
      w.doorNote(0),
      w.doorNote(1),
      w.doorNote(3),
      w.back,
      jobModeShortTomorrow([{ timeStart: '08:00:00', label: '2050 · Linden vanity faucet' }]).note,
      jobModeShortTomorrow([
        { timeStart: '08:00:00', label: '2050 · Linden vanity faucet' },
        { timeStart: '10:00:00', label: '2051 · Park heater' },
      ]).note,
    ]
    for (const s of sentences) expect(plainWordsFailures(s), s).toEqual([])
  })
})
