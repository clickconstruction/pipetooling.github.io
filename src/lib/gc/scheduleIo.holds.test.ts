import { beforeEach, describe, expect, it, vi } from 'vitest'
import { scheduleHoldsState } from './scheduleIo'
import { loadGcCrewOnSite, loadGcDailyLogs } from './dailyLogIo'
import { loadGcSubmittals } from './submittalsIo'
import { loadGcRfis } from './rfisIo'
import type { DailyLogRow } from './dailyLogRows'
import { initialGcState } from './schedule/testState'
import type { GcState } from './types'

vi.mock('./dailyLogIo', () => ({ loadGcDailyLogs: vi.fn(), loadGcCrewOnSite: vi.fn() }))
vi.mock('./submittalsIo', () => ({ loadGcSubmittals: vi.fn(() => Promise.resolve({ submittals: [], holds: [], rounds: [] })) }))
vi.mock('./rfisIo', () => ({ loadGcRfis: vi.fn(() => Promise.resolve({ rfis: [], holds: [] })) }))

/** The board as the page reads it: Fair Oaks D with no logs laid yet. */
function board(): GcState {
  const s = initialGcState()
  return { ...s, projects: s.projects.map((p) => (p.id === 'fairoaksd' ? { ...p, dailyLogs: undefined } : p)) }
}
/** Tuesday Sep 29's log: rain, our plumbing crew typed as 3, the steel crew 4. */
const tuesday: DailyLogRow = {
  id: 'log-29', project_id: 'fairoaksd', log_date: '2026-09-29', sky: 'rain', high: 72, low: 61, weather_stop: false, done: 'Steel on the east bay.', visitors: '',
  photos_url: null, written_on: '2026-09-29', written_by: 'u1', created_at: '2026-09-29T22:00:00Z', updated_at: '2026-09-29T22:00:00Z',
  gc_daily_log_crews: [{ log_id: 'log-29', package_id: 'fplumb', workers: 3 }, { log_id: 'log-29', package_id: 'fsteel', workers: 4 }],
  gc_daily_log_delays: [{ id: 'd1', log_id: 'log-29', position: 0, package_id: 'fsteel', reason: 'weather', note: 'Rain until noon' }],
}
const fairOaks = (s: GcState) => s.projects.find((p) => p.id === 'fairoaksd')!

describe('scheduleHoldsState (the schedule’s PR 16a)', () => {
  beforeEach(() => {
    vi.mocked(loadGcDailyLogs).mockReset().mockResolvedValue([tuesday])
    vi.mocked(loadGcCrewOnSite).mockReset().mockResolvedValue([{ package_id: 'fplumb', work_date: '2026-09-29', people: 5 }])
    vi.mocked(loadGcSubmittals).mockClear()
    vi.mocked(loadGcRfis).mockClear()
  })

  it('lays the job’s logs over the board, with our crew’s clock-ins in place of its typed count', async () => {
    const s = await scheduleHoldsState(board(), 'fairoaksd', { logs: true, today: '2026-10-02' })
    expect(loadGcDailyLogs).toHaveBeenCalledWith(['fairoaksd'])
    expect(loadGcCrewOnSite).toHaveBeenCalledWith('fairoaksd', '2026-07-01', '2026-10-02')
    const log = fairOaks(s).dailyLogs?.find((l) => l.date === '2026-09-29')
    expect(log?.crews).toEqual([{ packageId: 'fsteel', workers: 4 }, { packageId: 'fplumb', workers: 5 }])
    expect(log?.delays).toEqual([{ packageId: 'fsteel', reason: 'weather', note: 'Rain until noon' }])
    expect(loadGcSubmittals).toHaveBeenCalledWith(['fairoaksd'])
    expect(loadGcRfis).toHaveBeenCalledWith(['fairoaksd'])
  })

  it('reads no logs for a reader who may not, and the board’s job keeps none', async () => {
    const s = await scheduleHoldsState(board(), 'fairoaksd')
    expect(loadGcDailyLogs).not.toHaveBeenCalled()
    expect(loadGcCrewOnSite).not.toHaveBeenCalled()
    expect(fairOaks(s).dailyLogs).toBeUndefined()
  })

  it('reads no clock-ins on a job not started, and still lays its logs', async () => {
    const notStarted = board()
    const s0 = { ...notStarted, projects: notStarted.projects.map((p) => (p.id === 'fairoaksd' ? { ...p, startedOn: null } : p)) }
    const s = await scheduleHoldsState(s0, 'fairoaksd', { logs: true, today: '2026-10-02' })
    expect(loadGcCrewOnSite).not.toHaveBeenCalled()
    expect(fairOaks(s).dailyLogs?.find((l) => l.date === '2026-09-29')?.crews).toEqual([{ packageId: 'fsteel', workers: 4 }, { packageId: 'fplumb', workers: 3 }])
  })
})
