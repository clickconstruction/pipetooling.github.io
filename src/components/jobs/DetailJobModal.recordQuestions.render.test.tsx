// @vitest-environment jsdom
/**
 * The Job window carries its own Questions on this job (punch list #208 PR 4b): the section under Where
 * it stands with Ask the estimators and Ask Dispatch, the sheet opening on this job, and Escape closing
 * the sheet alone, the window staying.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'

import DetailJobModal from './DetailJobModal'
import { UpdateFocusOpenerBridgeProvider } from '../../contexts/UpdateFocusOpenerBridgeContext'
import { makeJob, renderWithProviders } from '../../test/renderSmokeMocks'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

const detailJob = makeJob({ id: 'job-1', hcp_number: '9001', job_name: 'Kitchen rough-in' })

vi.mock('../../lib/fetchJobWithDetailsById', () => ({
  fetchJobWithDetailsById: async () => detailJob,
}))

const read = vi.fn(async () => ({
  requests: [{ id: 'q1', lane: 'dispatch', title: 'Is a crew booked for the tie-in?', status: 'open', priority: null, created_at: '2026-10-26T15:00:00Z', closed_at: null, closed_note: null, from_user_id: 'u1', bid_id: null, job_ledger_id: 'job-1', development_id: null, reference_summary: 'J9001 Kitchen rough-in', notes: [] }],
  names: new Map([['u1', 'Robert']]),
}))
vi.mock('../../lib/developments/fetchRecordQuestions', () => ({ fetchRecordQuestions: (...args: unknown[]) => read(...(args as [])) }))

beforeAll(() => {
  vi.stubGlobal('scrollTo', vi.fn())
})

describe('DetailJobModal · Questions on this job', () => {
  it('draws the section with its log, opens the sheet on this job, and Escape closes the sheet alone', async () => {
    const onClose = vi.fn()
    renderWithProviders(
      <UpdateFocusOpenerBridgeProvider>
        <DetailJobModal open onClose={onClose} jobId="job-1" authRole="dev" assignedJobsRows={[]} scheduleContext={null} />
      </UpdateFocusOpenerBridgeProvider>,
    )
    const section = await screen.findByTestId('record-questions-job')
    expect(within(section).getByText('Questions on this job')).toBeTruthy()
    await waitFor(() => expect(read).toHaveBeenCalledWith({ kind: 'job', id: 'job-1' }, null))
    expect(await within(section).findByText('Is a crew booked for the tie-in?')).toBeTruthy()
    fireEvent.click(within(section).getByRole('button', { name: 'Ask the estimators' }))
    const sheet = await screen.findByRole('dialog', { name: 'Ask a question' })
    const about = within(sheet).getByTestId('ask-about') as HTMLSelectElement
    expect(Array.from(about.options).map((o) => o.textContent)).toEqual(['J9001 Kitchen rough-in'])
    fireEvent.keyDown(within(sheet).getByTestId('ask-title'), { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Ask a question' })).toBeNull())
    expect(onClose).not.toHaveBeenCalled()
  })
})
