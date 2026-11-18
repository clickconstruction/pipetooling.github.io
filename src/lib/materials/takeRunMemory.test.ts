import { describe, expect, it } from 'vitest'
import { TAKE_OPEN_MS, newTakeRun, takeMark, takeSaved } from './takeRun'
import { forgetTakeRun, keepTakeRun, readTakeRun, readTakeRuns } from './takeRunMemory'

function fakeStore() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() { return m.size },
    raw: m,
  }
}
const NOW = '2026-11-18T20:14:00.000Z'
const T0 = new Date(NOW).getTime()
const run = (containerId: string, startedAt = NOW) => newTakeRun({ id: `take-${containerId}`, jobId: 'job', containerId, lines: [], now: startedAt })

describe('the run kept on the phone', () => {
  it('comes back as it was kept, marks and all', () => {
    const s = fakeStore()
    const kept = takeSaved(takeMark(run('a1'), 'text:elbow', 3), NOW)
    keepTakeRun(kept, s)
    expect(readTakeRun('job', 'a1', T0 + 1000, s)).toEqual(kept)
    expect(readTakeRun('job', 'a2', T0, s)).toBeNull()
    expect(readTakeRun('other', 'a1', T0, s)).toBeNull()
  })

  it('is forgotten after twelve hours, and when the run ends', () => {
    const s = fakeStore()
    keepTakeRun(run('a1'), s)
    expect(readTakeRun('job', 'a1', T0 + TAKE_OPEN_MS + 1, s)).toBeNull()
    expect(s.raw.size).toBe(0)
    keepTakeRun(run('a1'), s)
    forgetTakeRun('job', 'a1', s)
    expect(readTakeRun('job', 'a1', T0, s)).toBeNull()
  })

  it('lists a job’s runs oldest first and leaves other jobs’ alone', () => {
    const s = fakeStore()
    keepTakeRun(run('b2', '2026-11-18T20:30:00.000Z'), s)
    keepTakeRun(run('a1'), s)
    keepTakeRun({ ...run('z9'), jobId: 'other' }, s)
    expect(readTakeRuns('job', T0 + 60_000 * 20, s).map((r) => r.containerId)).toEqual(['a1', 'b2'])
  })

  it('throws away what is not a run', () => {
    const s = fakeStore()
    s.setItem('pt.onSite.take.job.a1', '{"id":1}')
    s.setItem('pt.onSite.take.job.a2', 'not json')
    expect(readTakeRun('job', 'a1', T0, s)).toBeNull()
    expect(readTakeRun('job', 'a2', T0, s)).toBeNull()
    expect(readTakeRuns('job', T0, null)).toEqual([])
  })
})
