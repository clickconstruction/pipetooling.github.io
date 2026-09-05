import { describe, expect, it } from 'vitest'
import {
  agoLabel,
  appendNoteLine,
  backNoteLine,
  benchNoteLine,
  compareSubsForBench,
  currentBenchReason,
  daysBetweenYmd,
  shortDateLabel,
  subBenchStatus,
  type SubBenchInput,
} from './subBench'

const TODAY = '2026-09-05'
const base: SubBenchInput = { endDate: null, startDate: '2025-03-01', createdYmd: '2025-03-01', notes: null, lastWorkedYmd: null }

describe('subBenchStatus — active subs', () => {
  it('worked lately: green, no nudge', () => {
    const s = subBenchStatus({ ...base, lastWorkedYmd: '2026-08-28' }, TODAY)
    expect(s).toMatchObject({ kind: 'active', since: null, tone: 'green', nudge: null, lastWorkedLine: 'last worked Aug 28' })
  })
  it('quiet two months: amber, still no nudge (the nudge waits for 90 days)', () => {
    const s = subBenchStatus({ ...base, lastWorkedYmd: '2026-07-01' }, TODAY)
    expect(s.tone).toBe('amber')
    expect(s.nudge).toBeNull()
    expect(s.lastWorkedLine).toBe('last worked Jul 1 · 2 months')
  })
  it('quiet four months: amber with a Bench nudge; seven months: gray', () => {
    expect(subBenchStatus({ ...base, lastWorkedYmd: '2026-05-02' }, TODAY)).toMatchObject({ tone: 'amber', nudge: { kind: 'bench', text: 'Quiet for 4 months' } })
    expect(subBenchStatus({ ...base, lastWorkedYmd: '2026-02-11' }, TODAY)).toMatchObject({ tone: 'gray', nudge: { kind: 'bench', text: 'Quiet for 6 months' }, lastWorkedLine: 'last worked Feb 11 · 6 months' })
  })
  it('never worked: amber while new, gray with a nudge after 60 days on the roster', () => {
    expect(subBenchStatus({ ...base, createdYmd: '2026-08-20' }, TODAY)).toMatchObject({ tone: 'amber', nudge: null, lastWorkedLine: 'never worked · added Aug 20' })
    expect(subBenchStatus({ ...base, createdYmd: '2026-07-01T14:00:00Z' }, TODAY)).toMatchObject({ tone: 'gray', nudge: { kind: 'bench', text: 'No work in 2 months' } })
    expect(subBenchStatus({ ...base, createdYmd: null }, TODAY)).toMatchObject({ tone: 'amber', nudge: null, lastWorkedLine: 'never worked' })
  })
  it('labels a prior year', () => {
    expect(subBenchStatus({ ...base, lastWorkedYmd: '2025-11-03' }, TODAY).lastWorkedLine).toBe('last worked Nov 3, 2025 · 10 months')
  })
})

describe('subBenchStatus — on the bench', () => {
  it('reads the bench date from end_date and the reason from the notes', () => {
    const s = subBenchStatus({ ...base, endDate: '2026-06-02', notes: 'Old note\n[bench 2026-06-02] Moved to Houston, call if he is back', lastWorkedYmd: '2026-02-11' }, TODAY)
    expect(s).toMatchObject({ kind: 'bench', since: '2026-06-02', reason: 'Moved to Houston, call if he is back', tone: 'gray', nudge: null })
  })
  it('a sheet after the bench date turns amber with a Reactivate nudge', () => {
    const s = subBenchStatus({ ...base, endDate: '2026-08-01', notes: '[bench 2026-08-01] Test account', lastWorkedYmd: '2026-09-04' }, TODAY)
    expect(s).toMatchObject({ kind: 'bench', tone: 'amber', nudge: { kind: 'reactivate', text: 'New work on Sep 4' } })
  })
  it('a previous stint\'s reason does not leak after a [back] line', () => {
    expect(currentBenchReason('[bench 2026-01-01] Slow\n[back 2026-03-01]')).toBeNull()
    expect(currentBenchReason('[bench 2026-01-01] Slow\n[back 2026-03-01]\n[bench 2026-06-02] Again')).toBe('Again')
    expect(currentBenchReason('[bench 2026-06-02]')).toBeNull()
    expect(currentBenchReason(null)).toBeNull()
  })
})

describe('note lines and helpers', () => {
  it('writes and appends dated lines without losing existing notes', () => {
    expect(benchNoteLine('2026-06-02', '  Moved to   Houston ')).toBe('[bench 2026-06-02] Moved to Houston')
    expect(benchNoteLine('2026-06-02', '')).toBe('[bench 2026-06-02]')
    expect(backNoteLine('2026-09-05')).toBe('[back 2026-09-05]')
    expect(appendNoteLine('Existing note\n', '[bench 2026-06-02] x')).toBe('Existing note\n[bench 2026-06-02] x')
    expect(appendNoteLine(null, '[back 2026-09-05]')).toBe('[back 2026-09-05]')
  })
  it('civil-day math and labels', () => {
    expect(daysBetweenYmd('2026-08-28', '2026-09-05')).toBe(8)
    expect(daysBetweenYmd('nope', '2026-09-05')).toBeNull()
    expect(shortDateLabel('2026-09-04', TODAY)).toBe('Sep 4')
    expect(shortDateLabel('2025-09-04', TODAY)).toBe('Sep 4, 2025')
    expect([agoLabel(3), agoLabel(1), agoLabel(9), agoLabel(20), agoLabel(45), agoLabel(130)]).toEqual(['3 days', '1 day', '1 week', '2 weeks', '1 month', '4 months'])
  })
  it('sorts active before bench, money first among active, then most recently worked', () => {
    const rows = [
      { name: 'Cale', balanceDue: 0, committedTotal: 0, s: subBenchStatus({ ...base, endDate: '2026-06-02', lastWorkedYmd: '2026-02-11' }, TODAY) },
      { name: 'Behar', balanceDue: 0, committedTotal: 0, s: subBenchStatus({ ...base, lastWorkedYmd: '2026-08-28' }, TODAY) },
      { name: 'Texas R & A', balanceDue: 40000, committedTotal: 0, s: subBenchStatus({ ...base, lastWorkedYmd: '2026-08-14' }, TODAY) },
      { name: 'Bill', balanceDue: 0, committedTotal: 0, s: subBenchStatus({ ...base, createdYmd: '2026-07-01' }, TODAY) },
    ]
    const sorted = [...rows].sort((a, b) => compareSubsForBench(a, b, a.s, b.s)).map((r) => r.name)
    expect(sorted).toEqual(['Texas R & A', 'Behar', 'Bill', 'Cale'])
  })
})
