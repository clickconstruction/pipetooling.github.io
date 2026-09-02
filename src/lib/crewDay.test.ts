import { describe, expect, it } from 'vitest'
import {
  buildCrewDayView,
  crewDayNavWord,
  crewDayPctFromNoteBody,
  crewDayReportLabel,
  crewDaySummaryFor,
  isCrewDayOfficeRole,
  crewDayReportExcerpt,
  crewDaySessionMs,
  formatCrewDayBlockTime,
  formatCrewDayHours,
  isCrewDayEmailRole,
  isCrewDayRole,
  type CrewDayPayload,
} from './crewDay'

const NOW = Date.parse('2026-09-01T21:00:00Z') // 4:00p Chicago

const basePayload = (over: Partial<CrewDayPayload> = {}): CrewDayPayload => ({
  day: '2026-09-01',
  sessions: [],
  blocks: [],
  reports: [],
  pct_notes: [],
  users: [],
  jobs: [],
  ...over,
})

const job = (id: string, over: Partial<CrewDayPayload['jobs'][number]> = {}) => ({
  id,
  hcp_number: '4821',
  click_number: null,
  job_name: 'Maple Ridge Ph 2',
  job_address: '1402 Maple Ridge Rd',
  status: 'working',
  pct_complete: 60,
  ...over,
})

describe('crewDayPctFromNoteBody', () => {
  it('extracts the first N% complete', () => {
    expect(crewDayPctFromNoteBody('45% complete — rough moving')).toBe(45)
    expect(crewDayPctFromNoteBody('Now at 100 % complete')).toBe(100)
  })
  it('rejects out-of-range and missing patterns', () => {
    expect(crewDayPctFromNoteBody('150% complete')).toBeNull()
    expect(crewDayPctFromNoteBody('all done today')).toBeNull()
  })
})

describe('crewDayReportExcerpt', () => {
  it('joins string values, skipping signatures and empties', () => {
    expect(
      crewDayReportExcerpt({ a: 'Set flanges', sig: 'data:image/png;base64,xx', b: '  ', c: 'Inspector Thu' }),
    ).toBe('Set flanges · Inspector Thu')
  })
  it('truncates long text with an ellipsis', () => {
    const out = crewDayReportExcerpt({ a: 'x'.repeat(500) }, 50)
    expect(out.length).toBeLessThanOrEqual(50)
    expect(out.endsWith('…')).toBe(true)
  })
  it('tolerates junk shapes', () => {
    expect(crewDayReportExcerpt(null)).toBe('')
    expect(crewDayReportExcerpt([1, 2])).toBe('')
    expect(crewDayReportExcerpt('plain')).toBe('')
  })
})

describe('crewDayReportLabel', () => {
  it('shortens the default "Status Report" to "Report"; other templates keep their names', () => {
    expect(crewDayReportLabel('Status Report')).toBe('Report')
    expect(crewDayReportLabel('  status report ')).toBe('Report')
    expect(crewDayReportLabel('Safety Incident')).toBe('Safety Incident')
    expect(crewDayReportLabel('')).toBe('Report')
    expect(crewDayReportLabel(null)).toBe('Report')
  })
})

describe('crewDaySessionMs / formatters', () => {
  it('counts open sessions up to now and never goes negative', () => {
    const open = { user_id: 'u', job_id: null, clocked_in_at: '2026-09-01T19:00:00Z', clocked_out_at: null }
    expect(crewDaySessionMs(open, NOW)).toBe(2 * 3_600_000)
    const backwards = { ...open, clocked_out_at: '2026-09-01T18:00:00Z' }
    expect(crewDaySessionMs(backwards, NOW)).toBe(0)
    expect(crewDaySessionMs({ ...open, clocked_in_at: 'junk' }, NOW)).toBe(0)
  })
  it('formats hours and block times', () => {
    expect(formatCrewDayHours(8_200_000 * 3.6)).toBe('8.2 h')
    expect(formatCrewDayHours(0)).toBe('—')
    expect(formatCrewDayBlockTime('07:00:00')).toBe('7:00a')
    expect(formatCrewDayBlockTime('15:30:00')).toBe('3:30p')
    expect(formatCrewDayBlockTime('12:05:00')).toBe('12:05p')
    expect(formatCrewDayBlockTime('junk')).toBe('')
  })
})

describe('buildCrewDayView', () => {
  it('groups sessions, blocks, and reports per person per job with totals', () => {
    const view = buildCrewDayView(
      basePayload({
        users: [
          { id: 'u1', name: 'Marcus V.' },
          { id: 'u2', name: 'Taunya R.' },
        ],
        jobs: [job('j1'), job('j2', { hcp_number: '4802', job_name: 'Corte Vista 11' })],
        blocks: [
          { user_id: 'u1', job_id: 'j1', bid_id: null, time_start: '07:00:00', time_end: '15:00:00', note: null },
        ],
        sessions: [
          { user_id: 'u1', job_id: 'j1', clocked_in_at: '2026-09-01T12:00:00Z', clocked_out_at: '2026-09-01T20:00:00Z' },
          { user_id: 'u2', job_id: 'j2', clocked_in_at: '2026-09-01T12:00:00Z', clocked_out_at: '2026-09-01T14:00:00Z' },
        ],
        reports: [
          { id: 'r1', user_id: 'u1', job_id: 'j1', created_at: '2026-09-01T20:05:00Z', template_name: 'Field', field_values: { t: 'Rough complete' } },
        ],
      }),
      NOW,
    )
    expect(view.summary).toEqual({ people: 2, jobs: 2, totalMs: 10 * 3_600_000, reports: 1, flags: 2 })
    expect(view.people[0]?.name).toBe('Marcus V.') // 8h sorts above 2h
    expect(view.people[0]?.jobs[0]?.label).toBe('4821 · Maple Ridge Ph 2')
    expect(view.people[0]?.jobs[0]?.reports[0]?.excerpt).toBe('Rough complete')
    expect(view.people[0]?.flags).toEqual([])
    expect(view.people[1]?.flags).toEqual(['unscheduled_work', 'no_report']) // u2: no block + closed session, no report
  })

  it('flags scheduled_no_clock only when the person never clocked at all', () => {
    const view = buildCrewDayView(
      basePayload({
        users: [{ id: 'u3', name: 'DeShawn K.' }],
        jobs: [job('j1')],
        blocks: [
          { user_id: 'u3', job_id: 'j1', bid_id: null, time_start: '07:00:00', time_end: '15:30:00', note: null },
        ],
      }),
      NOW,
    )
    expect(view.people[0]?.flags).toEqual(['scheduled_no_clock'])
    expect(view.people[0]?.totalMs).toBe(0)
  })

  it('does not flag no_report while the only session is still open', () => {
    const view = buildCrewDayView(
      basePayload({
        users: [{ id: 'u4', name: 'Rosa M.' }],
        jobs: [job('j1')],
        sessions: [{ user_id: 'u4', job_id: 'j1', clocked_in_at: '2026-09-01T12:15:00Z', clocked_out_at: null }],
      }),
      NOW,
    )
    expect(view.people[0]?.open).toBe(true)
    expect(view.people[0]?.flags).toEqual(['unscheduled_work'])
  })

  it('computes pct movement from first note baseline to current job pct', () => {
    const view = buildCrewDayView(
      basePayload({
        users: [{ id: 'u1', name: 'M' }],
        jobs: [job('j1', { pct_complete: 60 })],
        sessions: [{ user_id: 'u1', job_id: 'j1', clocked_in_at: '2026-09-01T12:00:00Z', clocked_out_at: '2026-09-01T13:00:00Z' }],
        pct_notes: [
          { job_id: 'j1', body: '45% complete after rough', created_at: '2026-09-01T13:00:00Z' },
          { job_id: 'j1', body: '55% complete later', created_at: '2026-09-01T15:00:00Z' },
        ],
      }),
      NOW,
    )
    expect(view.pctMovement.get('j1')).toEqual({ from: 45, to: 60 })
  })

  it('labels job-less lines and unknown users safely', () => {
    const view = buildCrewDayView(
      basePayload({
        sessions: [{ user_id: 'ghost', job_id: null, clocked_in_at: '2026-09-01T12:00:00Z', clocked_out_at: '2026-09-01T13:00:00Z' }],
      }),
      NOW,
    )
    expect(view.people[0]?.name).toBe('Unknown')
    expect(view.people[0]?.jobs[0]?.label).toBe('No job association')
    expect(view.summary.jobs).toBe(0)
  })
})

describe('isCrewDayRole', () => {
  it('admits office roles and superintendent, excludes field roles', () => {
    for (const r of ['dev', 'master_technician', 'assistant', 'controller', 'superintendent']) {
      expect(isCrewDayRole(r)).toBe(true)
    }
    for (const r of ['subcontractor', 'helpers', 'estimator', 'primary', null, undefined]) {
      expect(isCrewDayRole(r)).toBe(false)
    }
  })
})

describe('office fold + nav word (v2.2617)', () => {
  it('buckets office-role people and recomputes summaries per subset', () => {
    const view = buildCrewDayView(
      basePayload({
        users: [
          { id: 'u1', name: 'Marcus V.', role: 'subcontractor' },
          { id: 'u2', name: 'Taunya R.', role: 'assistant' },
        ],
        jobs: [job('j1')],
        sessions: [
          { user_id: 'u1', job_id: 'j1', clocked_in_at: '2026-09-01T12:00:00Z', clocked_out_at: '2026-09-01T20:00:00Z' },
          { user_id: 'u2', job_id: 'j1', clocked_in_at: '2026-09-01T12:00:00Z', clocked_out_at: '2026-09-01T14:00:00Z' },
        ],
        reports: [
          { id: 'r1', user_id: 'u1', job_id: 'j1', created_at: '2026-09-01T20:05:00Z', template_name: 'Field', field_values: { t: 'done' } },
          { id: 'r2', user_id: 'u2', job_id: 'j1', created_at: '2026-09-01T14:05:00Z', template_name: 'Field', field_values: { t: 'office note' } },
        ],
      }),
      NOW,
    )
    expect(view.people.map((p) => [p.name, p.office])).toEqual([
      ['Marcus V.', false],
      ['Taunya R.', true],
    ])
    const field = view.people.filter((p) => !p.office)
    expect(crewDaySummaryFor(field)).toEqual({ people: 1, jobs: 1, totalMs: 8 * 3_600_000, reports: 1, flags: 1 }) // unscheduled_work (no block)
    expect(crewDaySummaryFor(view.people).people).toBe(2)
  })

  it('treats a role-less payload (pre-migration) as nobody-office', () => {
    const view = buildCrewDayView(
      basePayload({
        users: [{ id: 'u1', name: 'M' }],
        jobs: [job('j1')],
        sessions: [{ user_id: 'u1', job_id: 'j1', clocked_in_at: '2026-09-01T12:00:00Z', clocked_out_at: '2026-09-01T13:00:00Z' }],
        reports: [{ id: 'r1', user_id: 'u1', job_id: 'j1', created_at: '2026-09-01T13:01:00Z', template_name: 'F', field_values: {} }],
      }),
      NOW,
    )
    expect(view.people[0]?.office).toBe(false)
  })

  it('isCrewDayOfficeRole is the office set', () => {
    for (const r of ['dev', 'master_technician', 'assistant', 'controller']) expect(isCrewDayOfficeRole(r)).toBe(true)
    for (const r of ['superintendent', 'subcontractor', 'helpers', 'estimator', 'primary', null]) expect(isCrewDayOfficeRole(r)).toBe(false)
  })

  it('crewDayNavWord: Today / Yesterday / N days ago; blank for future or junk', () => {
    expect(crewDayNavWord('2026-09-01', '2026-09-01')).toBe('Today')
    expect(crewDayNavWord('2026-08-31', '2026-09-01')).toBe('Yesterday')
    expect(crewDayNavWord('2026-08-27', '2026-09-01')).toBe('5 days ago')
    expect(crewDayNavWord('2026-08-02', '2026-09-01')).toBe('30 days ago')
    expect(crewDayNavWord('2026-09-02', '2026-09-01')).toBe('')
    expect(crewDayNavWord('junk', '2026-09-01')).toBe('')
  })
})

describe('isCrewDayEmailRole', () => {
  it('is office-only — superintendents see the section but never the email (v2.2615)', () => {
    for (const r of ['dev', 'master_technician', 'assistant', 'controller']) {
      expect(isCrewDayEmailRole(r)).toBe(true)
    }
    for (const r of ['superintendent', 'subcontractor', 'helpers', 'estimator', 'primary', null, undefined]) {
      expect(isCrewDayEmailRole(r)).toBe(false)
    }
  })
})
