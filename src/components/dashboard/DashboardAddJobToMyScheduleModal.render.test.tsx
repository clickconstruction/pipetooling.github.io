// @vitest-environment jsdom
/**
 * Render smoke for My Schedule's add-a-job window (punch list #196): the slot step says the job
 * joins your crew instead of asking with a box the database ignored, and the save sends the
 * RPC `p_join_crew: true` with the picked job and window.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { DashboardAddJobToMyScheduleModal } from './DashboardAddJobToMyScheduleModal'

const rpc = vi.hoisted(() => ({ calls: [] as Array<{ name: string; args: Record<string, unknown> }> }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub()
  return {
    supabase: {
      ...stub,
      rpc: (name: string, args: Record<string, unknown>) => {
        rpc.calls.push({ name, args })
        const data =
          name === 'search_jobs_for_self_schedule'
            ? [
                {
                  id: 'job-1',
                  hcp_number: 'J-100',
                  click_number: null,
                  job_name: 'Lot 7 rough-in',
                  job_address: '12 Elm St',
                  status: 'working',
                  customer_name: 'Knight Contracting',
                },
              ]
            : null
        return Promise.resolve({ data, error: null })
      },
    },
  }
})

afterEach(() => {
  cleanup()
  rpc.calls = []
})

describe('DashboardAddJobToMyScheduleModal', () => {
  it('says the job joins your crew, asks nothing, and sends p_join_crew true', async () => {
    const onSaved = vi.fn()
    const onClose = vi.fn()
    renderWithProviders(
      <DashboardAddJobToMyScheduleModal
        todayYmd="2026-10-29"
        tomorrowYmd="2026-10-30"
        myBlocks={[]}
        blockLabels={new Map()}
        onClose={onClose}
        onSaved={onSaved}
      />,
    )
    const dialog = within(await screen.findByRole('dialog', { name: 'Add a job to my schedule' }))
    fireEvent.change(dialog.getByLabelText('Search jobs'), { target: { value: 'lot 7' } })
    fireEvent.click(await dialog.findByRole('button', { name: /J-100 · Lot 7 rough-in/ }, { timeout: 2000 }))

    expect(dialog.getByText('This job joins your crew, so it shows everywhere you look.')).toBeTruthy()
    expect(dialog.queryByRole('checkbox')).toBeNull()
    expect(dialog.queryByText(/Add me to the job crew/)).toBeNull()

    fireEvent.click(dialog.getByRole('button', { name: 'Add to my schedule' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    const add = rpc.calls.find((c) => c.name === 'self_schedule_add_block')
    expect(add?.args).toEqual({
      p_job_id: 'job-1',
      p_work_date: '2026-10-29',
      p_time_start: '08:00',
      p_time_end: '12:00',
      p_join_crew: true,
    })
    expect(onClose).toHaveBeenCalled()
  })
})
