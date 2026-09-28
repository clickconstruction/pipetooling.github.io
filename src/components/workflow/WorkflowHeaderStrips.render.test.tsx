// @vitest-environment jsdom
/**
 * v2.3943: the Workflow page's Jobs and Subs strips as components. Pins each seam — the Jobs strip
 * draws a chip per job it is handed and opens Job Detail with the job's id, shows + Create Job
 * only to a role that may create one; the Subs strip draws a pill per sub with its open count
 * and its tooltip.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderSettled } from '../../test/renderSmokeMocks'
import { WorkflowJobsStrip } from './WorkflowJobsStrip'
import { WorkflowSubsStrip } from './WorkflowSubsStrip'

const openJobDetail = vi.fn()
let modalAvailable = true
vi.mock('../../contexts/JobDetailModalContext', () => ({
  useJobDetailModal: () => (modalAvailable ? { openJobDetail } : null),
}))

const jobs = [
  { id: 'j1', hcp_number: '978', job_name: 'Elm St rough', status: 'working' },
  { id: 'j2', hcp_number: '', job_name: 'Elm St trim', status: 'working' },
  { id: 'j3', hcp_number: '', job_name: '', status: 'working' },
]

afterEach(() => {
  cleanup()
  openJobDetail.mockReset()
  modalAvailable = true
})

describe('WorkflowJobsStrip', () => {
  it('says None with no jobs, and offers + Create Job to a role that may create one', async () => {
    await renderSettled(<WorkflowJobsStrip projectId="p-1" projectJobs={[]} canCreateJobs />, {
      loaded: () => screen.findByText('Jobs:'),
    })
    expect(screen.getByText('None')).toBeTruthy()
    expect(screen.getByRole('link', { name: '+ Create Job' }).getAttribute('href')).toBe(
      '/jobs?newJob=true&project=p-1&tab=stages',
    )
  })

  it('hides + Create Job from a role that may not', async () => {
    await renderSettled(<WorkflowJobsStrip projectId="p-1" projectJobs={jobs} canCreateJobs={false} />, {
      loaded: () => screen.findByText('Jobs:'),
    })
    expect(screen.queryByRole('link', { name: '+ Create Job' })).toBeNull()
  })

  it('draws a chip per job — number, else name, else Job — and opens Job Detail with its id', async () => {
    await renderSettled(<WorkflowJobsStrip projectId="p-1" projectJobs={jobs} canCreateJobs />, {
      loaded: () => screen.findByText('978'),
    })
    expect(screen.queryByText('None')).toBeNull()
    expect(screen.getAllByTitle('Open job detail').map((b) => b.textContent)).toEqual(['978', 'Elm St trim', 'Job'])
    fireEvent.click(screen.getByText('Elm St trim'))
    expect(openJobDetail).toHaveBeenCalledTimes(1)
    expect(openJobDetail).toHaveBeenCalledWith({ jobId: 'j2' })
  })

  it('does nothing on a chip click where Job Detail is not mounted', async () => {
    modalAvailable = false
    await renderSettled(<WorkflowJobsStrip projectId="p-1" projectJobs={jobs} canCreateJobs />, {
      loaded: () => screen.findByText('978'),
    })
    fireEvent.click(screen.getByText('978'))
    expect(openJobDetail).not.toHaveBeenCalled()
  })
})

describe('WorkflowSubsStrip', () => {
  const entries = [
    { key: 'p-behar', name: 'Behar Plumbing', personId: 'p-behar', activeStepCount: 2, totalStepCount: 3, currentStepName: 'Top Out' },
    { key: 'name:ace drain', name: 'Ace Drain', personId: null, activeStepCount: 0, totalStepCount: 1, currentStepName: null },
  ]

  it('draws a pill per sub: the open count while any step is open, the name alone once all are finished', async () => {
    await renderSettled(<WorkflowSubsStrip entries={entries} />, { loaded: () => screen.findByText('Subs:') })
    const open = screen.getByTitle('Behar Plumbing — on Top Out (2 of 3 steps open)')
    expect(open.textContent).toBe('🔧 Behar Plumbing · 2 open')
    const done = screen.getByTitle('Ace Drain — all 1 assigned steps finished')
    expect(done.textContent).toBe('🔧 Ace Drain')
  })
})
