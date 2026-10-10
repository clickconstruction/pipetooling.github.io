import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadScheduleMoney, scheduleHoldsState } from './scheduleIo'
import { loadGcCrewOnSite, loadGcDailyLogs } from './dailyLogIo'
import { loadGcSubmittals } from './submittalsIo'
import { loadGcRfis } from './rfisIo'
import { loadGcChangeOrdersOffice } from './changeOrderOfficeIo'
import { loadGcDraws } from './drawsIo'
import { loadGcBillingRows, loadGcChangeOrders } from './gcIo'
import { NO_DRAWS, withDraws, withTradeChanges, type DrawTables } from './drawRows'
import type { DailyLogRow } from './dailyLogRows'
import { initialGcState } from './schedule/testState'
import type { GcState } from './types'

vi.mock('./dailyLogIo', () => ({ loadGcDailyLogs: vi.fn(), loadGcCrewOnSite: vi.fn() }))
vi.mock('./submittalsIo', () => ({ loadGcSubmittals: vi.fn(() => Promise.resolve({ submittals: [], holds: [], rounds: [] })) }))
vi.mock('./rfisIo', () => ({ loadGcRfis: vi.fn(() => Promise.resolve({ rfis: [], holds: [] })) }))
vi.mock('./changeOrderOfficeIo', () => ({ loadGcChangeOrdersOffice: vi.fn(() => Promise.resolve([])) }))
vi.mock('./drawsIo', () => ({ loadGcDraws: vi.fn() }))
vi.mock('./gcIo', () => ({ loadGcBillingRows: vi.fn(), loadGcChangeOrders: vi.fn() }))
vi.mock('./drawRows', async (importOriginal) => {
  const real = await importOriginal<typeof import('./drawRows')>()
  return { ...real, withDraws: vi.fn(real.withDraws), withTradeChanges: vi.fn(real.withTradeChanges) }
})

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
const TABLES: DrawTables = { ...NO_DRAWS, sows: [{ id: 'sow-1', package_id: 'fplumb' }] }
const packageIds = () => fairOaks(board()).packages.map((k) => k.id)

describe('scheduleHoldsState (the schedule’s PR 16a)', () => {
  beforeEach(() => {
    vi.mocked(loadGcDailyLogs).mockReset().mockResolvedValue([tuesday])
    vi.mocked(loadGcCrewOnSite).mockReset().mockResolvedValue([{ package_id: 'fplumb', work_date: '2026-09-29', people: 5 }])
    vi.mocked(loadGcSubmittals).mockClear()
    vi.mocked(loadGcRfis).mockClear()
    vi.mocked(loadGcChangeOrdersOffice).mockReset().mockResolvedValue([])
    vi.mocked(loadGcDraws).mockReset().mockResolvedValue(TABLES)
    vi.mocked(withDraws).mockClear()
    vi.mocked(withTradeChanges).mockClear()
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

  it('lays the job’s change orders through the office’s view for every reader, their money hidden (16b-ii)', async () => {
    vi.mocked(loadGcChangeOrdersOffice).mockResolvedValue([
      { id: 'co-1', project_id: 'fairoaksd', number: 1, description: 'Thicker slab', reason: 'plans', schedule_words: '', package_id: 'fconc', status: 'signed', sent_on: '2026-09-24', answered_on: '2026-09-26', days: 2, days_on_chart: null },
    ])
    const s = await scheduleHoldsState(board(), 'fairoaksd')
    expect(loadGcChangeOrdersOffice).toHaveBeenCalledWith(['fairoaksd'])
    expect(fairOaks(s).changeOrders?.map((c) => [c.number, c.days, c.price, c.cost, c.pctDone])).toEqual([[1, 2, 0, 0, 0]])
  })

  it('lays the trades’ reported percents only behind the draws gate (16c)', async () => {
    await scheduleHoldsState(board(), 'fairoaksd', { logs: true, today: '2026-10-02' })
    expect(loadGcDraws).not.toHaveBeenCalled()
    expect(withDraws).not.toHaveBeenCalled()
    await scheduleHoldsState(board(), 'fairoaksd', { draws: true })
    expect(loadGcDraws).toHaveBeenCalledWith(packageIds())
    expect(withDraws).toHaveBeenCalledWith(expect.anything(), TABLES)
    expect(withTradeChanges).toHaveBeenCalledWith(expect.anything(), TABLES)
  })
})

describe('loadScheduleMoney (the schedule’s PR 16c)', () => {
  it('reads the job’s bills, its full change orders and its trades’ money, and nothing of the chart', async () => {
    const bills = { terms: [], contract: [], billing: new Map(), names: {}, payDays: {} }
    vi.mocked(loadGcBillingRows).mockResolvedValue(bills as never)
    vi.mocked(loadGcChangeOrders).mockResolvedValue([])
    vi.mocked(loadGcDraws).mockReset().mockResolvedValue(TABLES)
    const money = await loadScheduleMoney('fairoaksd', ['fplumb', 'fsteel'])
    expect(loadGcBillingRows).toHaveBeenCalledWith(['fairoaksd'])
    expect(loadGcChangeOrders).toHaveBeenCalledWith(['fairoaksd'])
    expect(loadGcDraws).toHaveBeenCalledWith(['fplumb', 'fsteel'])
    expect(money).toEqual({ bills, changeOrders: [], draws: TABLES })
  })
})
