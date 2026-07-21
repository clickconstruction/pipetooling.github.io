// @vitest-environment jsdom
/**
 * Render-smoke tests for JobsSubLaborFormModal (extracted from Jobs.tsx in
 * v2.823). Exercises every imperative-handle entry point and the v2.823
 * `open()` quirk (bare open must NOT reset form state; `openNew()` must).
 */
import { act, createRef, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import JobsSubLaborFormModal, {
  type JobsSubLaborFormModalHandle,
  type JobsSubLaborFormModalProps,
} from './JobsSubLaborFormModal'
import { makeJob, makeLaborJob, renderWithProviders } from '../../test/renderSmokeMocks'
import type { LaborJob } from '../../types/laborJob'
import type { Person, UserRow } from '../../pages/Jobs'

const users: UserRow[] = [
  { id: 'u-1', name: 'Tech One', email: 'tech1@example.com', role: 'master_technician', notes: null },
]

const people: Person[] = [
  {
    id: 'p-1',
    master_user_id: 'u-1',
    kind: 'sub',
    name: 'Sub Sam',
    email: null,
    phone: null,
    notes: null,
  },
]

type HarnessProps = {
  handleRef: React.RefObject<JobsSubLaborFormModalHandle>
  overrides?: Partial<JobsSubLaborFormModalProps>
}

/** Owns the parent-side `editingLaborJob` state the modal drives via its setter prop. */
function Harness({ handleRef, overrides }: HarnessProps) {
  const [editingLaborJob, setEditingLaborJob] = useState<LaborJob | null>(null)
  const [error, setError] = useState<string | null>(null)
  return (
    <JobsSubLaborFormModal
      ref={handleRef}
      editingLaborJob={editingLaborJob}
      setEditingLaborJob={setEditingLaborJob}
      jobs={[makeJob({ hcp_number: 'HCP-12' })]}
      users={users}
      people={people}
      loadRoster={vi.fn(async () => {})}
      loadLaborJobs={vi.fn(async () => {})}
      deleteLaborJob={vi.fn(async () => true)}
      laborJobDeletingId={null}
      setLaborJobs={vi.fn()}
      error={error}
      setError={setError}
      defaultLaborRateValue=""
      setActiveTab={vi.fn()}
      onOpenMakePayment={vi.fn()}
      onOpenBackcharge={vi.fn()}
      onOpenEditPayment={vi.fn()}
      onClearEditPayment={vi.fn()}
      authUserId="smoke-auth-user-1"
      printJobSubSheet={vi.fn()}
      {...overrides}
    />
  )
}

function mountHarness(overrides?: Partial<JobsSubLaborFormModalProps>) {
  const handleRef = createRef<JobsSubLaborFormModalHandle>()
  const view = renderWithProviders(<Harness handleRef={handleRef} overrides={overrides} />)
  return { handleRef, view }
}

const hcpInput = () => screen.getByPlaceholderText('Optional') as HTMLInputElement
const addressInput = () => screen.getByPlaceholderText('Job address') as HTMLInputElement

describe('JobsSubLaborFormModal render smoke', () => {
  it('renders nothing while closed', () => {
    mountHarness()
    expect(screen.queryByText('New Sub Labor')).toBeNull()
    expect(screen.queryByText('Edit Sub Labor')).toBeNull()
  })

  it('openNew shows an empty New Sub Labor form', async () => {
    const { handleRef } = mountHarness()
    await act(async () => handleRef.current!.openNew())
    expect(screen.getByText('New Sub Labor')).toBeTruthy()
    expect(hcpInput().value).toBe('')
    expect(addressInput().value).toBe('')
  })

  it('openEdit populates the form from the labor job', async () => {
    const { handleRef } = mountHarness()
    const laborJob = makeLaborJob({
      assigned_to_name: 'Sub Sam',
      address: '500 Oak Ln, Austin, TX',
      job_number: 'HCP-77',
      distance_miles: 12,
    })
    await act(async () => handleRef.current!.openEdit(laborJob))
    expect(screen.getByText('Edit Sub Labor')).toBeTruthy()
    expect(hcpInput().value).toBe('HCP-77')
    expect(addressInput().value).toBe('500 Oak Ln, Austin, TX')
    expect(screen.getByDisplayValue('12')).toBeTruthy()
    // The one itemized fixture row from the labor job
    expect(screen.getByDisplayValue('Toilet')).toBeTruthy()
    // Assigned contractor checkbox is checked
    const samCheckbox = screen.getByLabelText('Sub Sam') as HTMLInputElement
    expect(samCheckbox.checked).toBe(true)
  })

  it('openNewWithJobNumber seeds only the HCP field', async () => {
    const { handleRef } = mountHarness()
    await act(async () => handleRef.current!.openNewWithJobNumber('HCP-9'))
    expect(screen.getByText('New Sub Labor')).toBeTruthy()
    expect(hcpInput().value).toBe('HCP-9')
    expect(addressInput().value).toBe('')
  })

  it('openWithBillingPrefill seeds HCP, address, and roster-known contractors only', async () => {
    const { handleRef } = mountHarness()
    await act(async () =>
      handleRef.current!.openWithBillingPrefill({
        jobNumber: 'HCP-12',
        address: '9 Prefill Rd, Austin, TX',
        teamMemberNames: ['Sub Sam', 'Ghost Not On Roster'],
      }),
    )
    expect(screen.getByText('New Sub Labor')).toBeTruthy()
    expect(hcpInput().value).toBe('HCP-12')
    expect(addressInput().value).toBe('9 Prefill Rd, Austin, TX')
    const samCheckbox = screen.getByLabelText('Sub Sam') as HTMLInputElement
    expect(samCheckbox.checked).toBe(true)
    expect(screen.queryByText('Ghost Not On Roster')).toBeNull()
  })

  it('bare open() preserves prior form state; openNew() resets it (v2.823 quirk)', async () => {
    const { handleRef } = mountHarness()
    await act(async () => handleRef.current!.openNewWithJobNumber('HCP-9'))
    fireEvent.change(addressInput(), { target: { value: 'Typed Address 1' } })
    expect(addressInput().value).toBe('Typed Address 1')
    // Bare open (the `?newJob=` deep-link path) must NOT reset what's in the form
    await act(async () => handleRef.current!.open())
    expect(hcpInput().value).toBe('HCP-9')
    expect(addressInput().value).toBe('Typed Address 1')
    // openNew() is the resetting entry point
    await act(async () => handleRef.current!.openNew())
    expect(hcpInput().value).toBe('')
    expect(addressInput().value).toBe('')
  })
})
