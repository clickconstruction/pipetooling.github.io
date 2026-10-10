// @vitest-environment jsdom
/**
 * GC mode, the real build, the schedule's PR 16c: the money team's own lines on the Schedule window. The money is read once
 * per open beside the chart (`loadScheduleMoney`) and laid on a state of its own, so the late fee's dollars reach the money
 * team and nobody else, and a failed read leaves the chart whole with today's words. The late finish is the real one on
 * Fair Oaks D with 4 late days laid over it and a money line drawn from the project it is given, since the test state is
 * not late.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { GcScheduleWindow } from './GcScheduleWindow'
import { loadSchedule, loadScheduleMoney } from '../../lib/gc/scheduleIo'
import type { ScheduleMoney } from '../../lib/gc/scheduleMoney'
import { NO_DRAWS } from '../../lib/gc/drawRows'
import type { OwnerTermsRow } from '../../lib/gc/billCustomer'
import { initialGcState } from '../../lib/gc/schedule/testState'
import type { GcProject, GcState } from '../../lib/gc/types'
import { installDomShims } from '../../test/renderSmokeMocks'

installDomShims()

vi.mock('../../lib/gc/scheduleIo', () => {
  const loadSchedule = vi.fn()
  return { loadSchedule, loadScheduleWithHolds: vi.fn((state: unknown, id: string) => loadSchedule(state, id)), loadScheduleMoney: vi.fn() }
})

const SPLIT = 'Of the 4 late days, 4 are ours.'
const FEE = 'At $500 a day, the 4 days cost $2,000.'
vi.mock('../../lib/gc/lateFinish', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../lib/gc/lateFinish')>()
  return {
    ...real,
    lateFinish: vi.fn((state: GcState, project: GcProject) => {
      const perDay = project.ownerLateFinish?.perDay ?? null
      const fee = perDay ? FEE : null
      return { ...real.lateFinish(state, project), late: 4, perDay, money: fee, split: SPLIT, words: [fee, SPLIT].filter((w): w is string => Boolean(w)), ask: null }
    }),
  }
})

afterEach(() => {
  cleanup()
  vi.mocked(loadSchedule).mockReset()
  vi.mocked(loadScheduleMoney).mockReset()
})

const s = initialGcState()
const fairOaks = s.projects.find((p) => p.id === 'fairoaksd')!
const terms: OwnerTermsRow = {
  project_id: 'fairoaksd', owner_retainage_pct: 10, owner_retainage_step_at_pct: null, owner_retainage_step_to_pct: null, owner_retainage_step_way: null,
  owner_pay_days: null, owner_late_interest_pct_per_month: null, owner_late_finish_per_day: 500, billing_job_id: null, property_owner_customer_id: null,
}
const MONEY: ScheduleMoney = { bills: { terms: [terms], contract: [], billing: new Map(), names: {}, payDays: {} }, changeOrders: [], draws: NO_DRAWS }
const open = (reads: { money?: boolean }) => {
  vi.mocked(loadSchedule).mockResolvedValue({ state: s, project: fairOaks, version: 3 })
  render(<GcScheduleWindow state={s} project={fairOaks} by="Robert Douglas" reads={reads} onClose={vi.fn()} />)
}

describe('The money team’s lines on the schedule (PR 16c)', () => {
  it('the money team reads the late fee in dollars, from the money read for this job’s packages', async () => {
    vi.mocked(loadScheduleMoney).mockResolvedValue(MONEY)
    open({ money: true })
    expect(await screen.findByText(FEE)).toBeTruthy()
    expect(screen.getByText(SPLIT)).toBeTruthy()
    expect(loadScheduleMoney).toHaveBeenCalledWith('fairoaksd', fairOaks.packages.map((k) => k.id))
  })

  it('anyone else reads whose days with no dollar, and no money is read', async () => {
    open({})
    await screen.findByText(SPLIT)
    expect(screen.queryByText(FEE)).toBeNull()
    expect(document.body.textContent).not.toContain('$500')
    expect(loadScheduleMoney).not.toHaveBeenCalled()
  })

  it('a failed money read leaves the chart whole with today’s words', async () => {
    vi.mocked(loadScheduleMoney).mockRejectedValue(new Error('down'))
    open({ money: true })
    await screen.findByText(SPLIT)
    await waitFor(() => expect(loadScheduleMoney).toHaveBeenCalled())
    await Promise.resolve()
    expect(screen.queryByText(FEE)).toBeNull()
    expect(document.querySelector('[data-tour="gc-late-finish"]')).toBeTruthy()
  })
})
