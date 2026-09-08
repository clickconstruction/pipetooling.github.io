import { describe, expect, it } from 'vitest'
import { calibrationStandardSummary, calibrationStandardToast, teacherCandidates, type TeacherCandidate } from './twinTeachers'

const user = (over: Partial<TeacherCandidate>): TeacherCandidate => ({
  id: over.id ?? over.email ?? 'u',
  name: null,
  email: 'x@example.com',
  role: 'estimator',
  is_digital_twin: false,
  archived_at: null,
  calibration_standard: false,
  ...over,
})

describe('teacherCandidates', () => {
  it('offers estimating roles, skips twins, archived users and field roles', () => {
    const out = teacherCandidates([
      user({ id: 'w', name: 'Wendi', role: 'estimator' }),
      user({ id: 'r', name: 'Robert', role: 'dev' }),
      user({ id: 'm', name: 'Malachi', role: 'master_technician' }),
      user({ id: 't', name: 'Twin Estimator 1', role: 'estimator', is_digital_twin: true }),
      user({ id: 'a', name: 'Old Hand', role: 'estimator', archived_at: '2026-01-01' }),
      user({ id: 'h', name: 'Helper', role: 'helpers' }),
    ])
    expect(out.map((u) => u.id)).toEqual(['m', 'r', 'w'])
  })

  it('never hides a flagged user, even a twin or an archived one, and lists standards first', () => {
    const out = teacherCandidates([
      user({ id: 'g', name: 'Grace', role: 'assistant' }),
      user({ id: 'w', name: 'Wendi', calibration_standard: true }),
      user({ id: 'a', name: 'Archived Standard', archived_at: '2026-01-01', calibration_standard: true }),
    ])
    expect(out.map((u) => u.id)).toEqual(['a', 'w', 'g'])
  })

  it('sorts by email when a name is missing', () => {
    const out = teacherCandidates([user({ id: '2', email: 'zed@x.com' }), user({ id: '1', email: 'amy@x.com' })])
    expect(out.map((u) => u.id)).toEqual(['1', '2'])
  })
})

describe('calibrationStandardSummary', () => {
  it('warns when nobody is the standard', () => {
    expect(calibrationStandardSummary([user({})])).toMatch(/No calibration standard set/)
  })
  it('names one standard', () => {
    expect(calibrationStandardSummary([user({ name: 'Wendi', calibration_standard: true })])).toBe(
      'Wendi is the calibration standard — only shadows scored against their sent numbers count toward Gate B.',
    )
  })
  it('lists several', () => {
    expect(calibrationStandardSummary([user({ name: 'Wendi', calibration_standard: true }), user({ id: 'b', name: 'Bill', calibration_standard: true })]))
      .toMatch(/^Wendi, Bill are calibration standards/)
  })
})

describe('calibrationStandardToast', () => {
  it('reads both directions', () => {
    expect(calibrationStandardToast('Wendi', true)).toMatch(/now a calibration standard/)
    expect(calibrationStandardToast('Grace', false)).toMatch(/no longer a calibration standard/)
  })
})
