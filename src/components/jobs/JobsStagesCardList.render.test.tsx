// @vitest-environment jsdom
/**
 * Render tests for the Stages mobile card ⋯ more-actions sheet (v2.1402):
 * the card footer carries a visible ⋯ button, tapping it opens a bottom
 * sheet with the labeled desktop-row actions (gated like the desktop), and
 * choosing an action runs its handler and closes the sheet. The old
 * tap-revealed toolbelt is gone. A linked customer's name on a card opens
 * their profile, as on the desktop rows (v2.5441).
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const profile = vi.hoisted(() => ({ open: vi.fn() }))
vi.mock('../../contexts/CustomerProfileModalContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../contexts/CustomerProfileModalContext')>()),
  useCustomerProfileModal: () => ({ openCustomerProfile: profile.open }),
}))

import JobsStagesCardList from './JobsStagesCardList'
import { makeJob, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { makeStagesCardListProps as makeProps } from '../../test/stagesCardListProps'

describe('JobsStagesCardList more-actions sheet', () => {
  it('shows a ⋯ button per card and no always-hidden toolbelt', async () => {
    const job = makeJob({ job_name: 'Card Alpha' })
    renderWithProviders(<JobsStagesCardList {...makeProps({ jobList: [job] })} />)
    await settle()
    expect(screen.getByTitle('More actions')).toBeTruthy()
    expect(screen.queryByText('View job')).toBeNull()
  })

  it('opens the sheet with the core actions; choosing one runs the handler and closes the sheet', async () => {
    const openStagesDetailJobModal = vi.fn()
    const job = makeJob({ job_name: 'Card Alpha' })
    renderWithProviders(
      <JobsStagesCardList {...makeProps({ jobList: [job], openStagesDetailJobModal })} />,
    )
    await settle()
    fireEvent.click(screen.getByTitle('More actions'))
    expect(screen.getByText('View job')).toBeTruthy()
    expect(screen.getByText('Edit job')).toBeTruthy()
    expect(screen.getByText('Activity and notes')).toBeTruthy()
    expect(screen.getByText('Test report')).toBeTruthy()
    expect(screen.queryByText('Hazmat fee')).toBeNull()
    expect(screen.queryByText('Send back')).toBeNull()
    fireEvent.click(screen.getByText('View job'))
    expect(openStagesDetailJobModal).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('View job')).toBeNull()
  })

  it('gates hazmat and send-back rows on their props', async () => {
    const openHazmatFee = vi.fn()
    const onSendBack = vi.fn()
    const job = makeJob({ job_name: 'Card Beta' })
    renderWithProviders(
      <JobsStagesCardList
        {...makeProps({ jobList: [job], canCreateHazmatFee: true, openHazmatFee, onSendBack })}
      />,
    )
    await settle()
    fireEvent.click(screen.getByTitle('More actions'))
    expect(screen.getByText('Hazmat fee')).toBeTruthy()
    fireEvent.click(screen.getByText('Send back'))
    expect(onSendBack).toHaveBeenCalledTimes(1)
  })

  it('carries the demoted rail actions and the crew subtitle (zoned card)', async () => {
    const openQuickAssignForJob = vi.fn()
    const job = makeJob({
      job_name: 'Card Delta',
      team_members: [{ user_id: 'u1', users: { name: 'Malachi' } }] as ReturnType<typeof makeJob>['team_members'],
    })
    renderWithProviders(
      <JobsStagesCardList {...makeProps({ jobList: [job], openQuickAssignForJob })} />,
    )
    await settle()
    fireEvent.click(screen.getByTitle('More actions'))
    expect(screen.getByText('Crew: Malachi')).toBeTruthy()
    expect(screen.getByText('Send as task')).toBeTruthy()
    fireEvent.click(screen.getByText('Assign work'))
    expect(openQuickAssignForJob).toHaveBeenCalledTimes(1)
  })

  it('Cancel closes the sheet without running anything', async () => {
    const openEdit = vi.fn()
    const job = makeJob({ job_name: 'Card Gamma' })
    renderWithProviders(<JobsStagesCardList {...makeProps({ jobList: [job], openEdit })} />)
    await settle()
    fireEvent.click(screen.getByTitle('More actions'))
    fireEvent.click(screen.getByText('Cancel'))
    expect(openEdit).not.toHaveBeenCalled()
    expect(screen.queryByText('Edit job')).toBeNull()
  })
})

describe('JobsStagesCardList customer name', () => {
  it('a linked customer’s name opens their profile, as on the desktop rows', async () => {
    profile.open.mockClear()
    const job = makeJob({ job_name: 'Card Gamma', customer_id: 'cust-dana', customer_name: 'Dana Whitfield' })
    renderWithProviders(<JobsStagesCardList {...makeProps({ jobList: [job] })} />)
    await settle()
    fireEvent.click(screen.getByLabelText('Open customer profile for Dana Whitfield'))
    expect(profile.open).toHaveBeenCalledWith('cust-dana')
  })
})
