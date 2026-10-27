import { describe, expect, it } from 'vitest'
import { afterPayReportRetry, bulkPayReportFailuresFor, bulkPayReportOutcome, bulkPayReportWords } from './bulkPayReports'
import { plainWordsFailures } from '../plainWords'

describe('bulkPayReportOutcome — Draft Payroll keeps going past a report that fails (punch list #184)', () => {
  it('names each person whose report did not generate, with the reason, in the order run', () => {
    const out = bulkPayReportOutcome([
      { person: 'Marisol', run: { ok: true } },
      { person: 'Todd', run: { ok: false, why: 'Failed to create pay report: duplicate key value' } },
      { person: 'Ana', run: { ok: true } },
      { person: 'Lee', run: { ok: false, why: 'No one is signed in.' } },
    ])
    expect(out.generated).toEqual(['Marisol', 'Ana'])
    expect(out.failures).toEqual([
      { person: 'Todd', why: 'Failed to create pay report: duplicate key value' },
      { person: 'Lee', why: 'No one is signed in.' },
    ])
    expect(out.words).toEqual({ line: 'Generated 2 reports. 2 did not generate.', head: '2 reports did not generate. They stay here with the reason.', tone: 'warning' })
  })
  it('every report made: the count, no list', () => {
    const out = bulkPayReportOutcome([{ person: 'Marisol', run: { ok: true } }])
    expect(out.failures).toEqual([])
    expect(out.words).toEqual({ line: 'Generated 1 report.', head: null, tone: 'success' })
  })
  it('none made: an error toast', () => {
    expect(bulkPayReportWords(0, 2)).toEqual({ line: 'Nothing generated. 2 did not generate.', head: '2 reports did not generate. They stay here with the reason.', tone: 'error' })
  })
  it('its words keep to plain words', () => {
    const w = bulkPayReportWords(4, 1)
    expect(plainWordsFailures(w.line)).toEqual([])
    expect(plainWordsFailures(w.head ?? '')).toEqual([])
  })
})

describe('bulkPayReportFailuresFor — only the run’s own period', () => {
  const last = { start: '2026-10-18', end: '2026-10-24', failures: [{ person: 'Todd', why: 'x' }] }
  it('shows the failures on the period they were for', () => {
    expect(bulkPayReportFailuresFor(last, '2026-10-18', '2026-10-24')).toEqual([{ person: 'Todd', why: 'x' }])
  })
  it('hides them on another period, and with no run', () => {
    expect(bulkPayReportFailuresFor(last, '2026-10-25', '2026-10-31')).toEqual([])
    expect(bulkPayReportFailuresFor(null, '2026-10-18', '2026-10-24')).toEqual([])
  })
})

describe('afterPayReportRetry — one person tried again', () => {
  const failures = [
    { person: 'Todd', why: 'first reason' },
    { person: 'Lee', why: 'other reason' },
  ]
  it('made: they leave the list', () => {
    expect(afterPayReportRetry(failures, 'Todd', { ok: true })).toEqual([{ person: 'Lee', why: 'other reason' }])
  })
  it('failed again: the new reason replaces the old one', () => {
    expect(afterPayReportRetry(failures, 'Todd', { ok: false, why: 'second reason' })).toEqual([
      { person: 'Todd', why: 'second reason' },
      { person: 'Lee', why: 'other reason' },
    ])
  })
})
