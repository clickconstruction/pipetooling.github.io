// @vitest-environment jsdom
/**
 * Render smokes for the row's quick-action icon stack (the Stages map's step 9, v2.5109:
 * moved out of jobsStagesRowShared as a component). Each door shows for the roles and jobs
 * it served before the move and opens the same thing.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { installDomShims, makeJob, makeTeamMember, renderWithProviders } from '../../test/renderSmokeMocks'
import { getDefaultWeekRange } from '../../utils/dateUtils'
import { scheduleDispatchWeekUrl } from '../../lib/scheduleDispatchDayLink'
import type { StagesRowRenderContext } from './jobsStagesRowShared'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

import { StagesQuickActionsStack } from './StagesQuickActionsStack'

const ctxWith = (over: Partial<StagesRowRenderContext> = {}) =>
  ({
    canOpenJobScheduleModal: true,
    openQuickAssignForJob: vi.fn(),
    navigate: vi.fn(),
    authRole: 'dev',
    dispatchTaskModal: { openDispatchModal: vi.fn() },
    checklistAddModal: { openAddModal: vi.fn() },
    ...over,
  }) as unknown as StagesRowRenderContext

const crewedJob = () =>
  makeJob({ job_name: 'Palomino Trail', customer_phone: '(512) 555-0142', team_members: [makeTeamMember('u-1', 'Abraham')] })

beforeAll(installDomShims)
afterEach(cleanup)

describe('StagesQuickActionsStack', () => {
  it('a planner on a crewed job gets every door, and each opens its own thing', () => {
    const ctx = ctxWith()
    const job = crewedJob()
    renderWithProviders(<StagesQuickActionsStack ctx={ctx} job={job} />)

    fireEvent.click(screen.getByRole('button', { name: 'Assign work — pick people and a time' }))
    expect(ctx.openQuickAssignForJob).toHaveBeenCalledWith(job)

    fireEvent.click(screen.getByRole('button', { name: 'Open week dispatch' }))
    expect(ctx.navigate).toHaveBeenCalledWith(scheduleDispatchWeekUrl(job.id, getDefaultWeekRange().start))

    expect(screen.getByRole('link', { name: 'Call customer at (512) 555-0142' }).getAttribute('href')).toBe('tel:+15125550142')

    fireEvent.click(screen.getByRole('button', { name: 'Send job to Dispatch' }))
    expect(ctx.dispatchTaskModal?.openDispatchModal).toHaveBeenCalledWith({
      reference: expect.objectContaining({ source: 'job', id: job.id, hcp_number: job.hcp_number, job_name: 'Palomino Trail' }),
    })

    fireEvent.click(screen.getByRole('button', { name: 'Send job as a task' }))
    expect(ctx.checklistAddModal?.openAddModal).toHaveBeenCalledTimes(1)
    expect(vi.mocked(ctx.checklistAddModal!.openAddModal).mock.calls[0]![0]).toHaveProperty('preset')
  })

  it('a job with no crew has no week dispatch, and no phone means no call link', () => {
    renderWithProviders(<StagesQuickActionsStack ctx={ctxWith()} job={makeJob()} />)
    expect(screen.getByRole('button', { name: 'Assign work — pick people and a time' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Open week dispatch' })).toBeNull()
    expect(screen.queryByRole('link', { name: /^Call customer/ })).toBeNull()
  })

  it('someone who cannot schedule gets neither calendar door; a role outside Dispatch gets no Dispatch door; the task door stays', () => {
    renderWithProviders(<StagesQuickActionsStack ctx={ctxWith({ canOpenJobScheduleModal: false, authRole: 'primary' })} job={crewedJob()} />)
    expect(screen.queryByRole('button', { name: 'Assign work — pick people and a time' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Open week dispatch' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Send job to Dispatch' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Send job as a task' })).toBeTruthy()
  })
})
