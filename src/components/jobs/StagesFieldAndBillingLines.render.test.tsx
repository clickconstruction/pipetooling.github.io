// @vitest-environment jsdom
/**
 * Render smokes for the Crew & Dates cell's lines (the Stages map's step 9, v2.5109: moved out
 * of jobsStagesRowShared as a component) — Next / Ends, Not scheduled, Done, the bill line and
 * the man-hours chip.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { installDomShims, makeJob, renderWithProviders } from '../../test/renderSmokeMocks'
import { scheduleTodayDateKey } from '../../lib/jobScheduleChicago'
import type { StagesUpcomingAppointment } from '../../lib/stagesUpcomingSchedule'
import type { StagesRowRenderContext } from './jobsStagesRowShared'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

import { StagesFieldAndBillingLines } from './StagesFieldAndBillingLines'

const ctxWith = (over: Partial<StagesRowRenderContext> = {}) =>
  ({
    showToast: vi.fn(),
    stagesManHoursByJobId: new Map<string, number>(),
    stagesManHoursLoading: false,
    stagesLaborBreakdownByJobId: new Map(),
    openJobCalendar: vi.fn(),
    crewByJobId: new Map(),
    stagesUpcomingByJobId: {},
    stagesWorkedByJobId: {},
    canOpenJobScheduleModal: true,
    openQuickAssignForJob: vi.fn(),
    ...over,
  }) as unknown as StagesRowRenderContext

const daysFromToday = (n: number) => {
  const d = new Date(`${scheduleTodayDateKey()}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

const NEXT = 'Next scheduled appointment — open the job calendar'
const ENDS = 'Last day on the calendar — open the job calendar'
const ACTIVITY = 'Latest field activity — open the job calendar'
const DONE = 'Nothing on the calendar — open the job calendar'

beforeAll(installDomShims)
afterEach(cleanup)

describe('StagesFieldAndBillingLines', () => {
  it('a booked job reads Next and Ends, and each opens the job calendar', () => {
    const job = makeJob()
    const up: StagesUpcomingAppointment = { ymd: daysFromToday(2), timeStart: '08:00', timeEnd: '16:00', assigneeNames: ['Abraham'], note: null, bookedYmds: [daysFromToday(2), daysFromToday(4)], lastYmd: daysFromToday(4), visitCount: 2 }
    const ctx = ctxWith({ stagesUpcomingByJobId: { [job.id]: up } })
    renderWithProviders(<StagesFieldAndBillingLines ctx={ctx} job={job} />)
    fireEvent.click(screen.getByTitle(NEXT))
    fireEvent.click(screen.getByTitle(ENDS))
    expect(ctx.openJobCalendar).toHaveBeenCalledTimes(2)
    expect(ctx.openJobCalendar).toHaveBeenCalledWith(job)
    expect(screen.queryByText('Not scheduled')).toBeNull()
  })

  it('a working job with nothing booked: a planner gets the Not scheduled door, anyone else the words', () => {
    const job = makeJob({ status: 'working', last_work_date: daysFromToday(-3) })
    const ctx = ctxWith()
    renderWithProviders(<StagesFieldAndBillingLines ctx={ctx} job={job} />)
    fireEvent.click(screen.getByRole('button', { name: 'Not scheduled. Assign work' }))
    expect(ctx.openQuickAssignForJob).toHaveBeenCalledWith(job)
    expect(screen.getByTitle(ACTIVITY)).toBeTruthy()
    cleanup()
    renderWithProviders(<StagesFieldAndBillingLines ctx={ctxWith({ canOpenJobScheduleModal: false })} job={job} />)
    expect(screen.queryByRole('button', { name: 'Not scheduled. Assign work' })).toBeNull()
    expect(screen.getByText('Not scheduled')).toBeTruthy()
  })

  it('a job past Working reads Done', () => {
    renderWithProviders(<StagesFieldAndBillingLines ctx={ctxWith()} job={makeJob({ status: 'ready_to_bill', last_work_date: daysFromToday(-9) })} />)
    expect(screen.getByTitle(DONE)).toBeTruthy()
    expect(screen.queryByText('Not scheduled')).toBeNull()
  })

  it('the bill line tells its date on a tap, and goes when the row’s dates block already prints the Billed day; a Paid line stays', () => {
    const billed = makeJob({ status: 'billed', invoices: [{ id: 'inv-1', status: 'billed', amount: 900, sequence_order: 1, billed_at: '2026-10-01T15:00:00Z', sent_to_customer_at: null }] })
    const ctx = ctxWith()
    renderWithProviders(<StagesFieldAndBillingLines ctx={ctx} job={billed} />)
    const line = screen.getByTitle(/^Latest: Invoice billed \(2026-10-01\)/)
    expect(line.querySelector('b')?.textContent).toBe('Billed')
    fireEvent.click(line)
    expect(ctx.showToast).toHaveBeenCalledWith(line.getAttribute('title'), 'info', 2500, expect.any(Object))
    cleanup()
    renderWithProviders(<StagesFieldAndBillingLines ctx={ctxWith()} job={billed} datesBilledYmd="2026-10-01" />)
    expect(screen.queryByTitle(/^Latest: Invoice billed/)).toBeNull()
    cleanup()
    const paid = { ...billed, payments: [{ id: 'p-1', amount: 900, paid_on: '2026-10-05' }] } as typeof billed
    renderWithProviders(<StagesFieldAndBillingLines ctx={ctxWith()} job={paid} datesBilledYmd="2026-10-01" />)
    expect(screen.getByTitle(/^Latest: Payment recorded/).querySelector('b')?.textContent).toBe('Paid')
  })

  it('the man-hours chip reads … while loading, then the hours, and opens the work story by click or Enter', () => {
    const job = makeJob()
    renderWithProviders(<StagesFieldAndBillingLines ctx={ctxWith({ stagesManHoursLoading: true })} job={job} />)
    expect(screen.getByLabelText('Man-hours applied: loading')).toBeTruthy()
    cleanup()
    const openJobHoursStory = vi.fn()
    const openSessionNotesForJob = vi.fn()
    const ctx = ctxWith({
      stagesManHoursByJobId: new Map([[job.id, 22.5]]),
      stagesLaborBreakdownByJobId: new Map([[job.id, [{ personName: 'Abraham', hours: 22.5 }]]]),
      openJobHoursStory,
      openSessionNotesForJob,
    })
    renderWithProviders(<StagesFieldAndBillingLines ctx={ctx} job={job} />)
    const chip = screen.getByRole('button', { name: 'Man-hours applied: 22h 30m — open the work story' })
    expect(chip.getAttribute('title')).toBe("Abraham 22h 30m — click for the job's work story")
    fireEvent.click(chip)
    expect(openJobHoursStory).toHaveBeenCalledWith(expect.objectContaining({ jobId: job.id, hcpNumber: job.hcp_number, jobName: job.job_name }))
    openJobHoursStory.mock.calls[0]![0].onOpenSessionNotes()
    expect(openSessionNotesForJob).toHaveBeenCalledWith(job)
    fireEvent.keyDown(chip, { key: 'Enter' })
    expect(openJobHoursStory).toHaveBeenCalledTimes(2)
  })
})
