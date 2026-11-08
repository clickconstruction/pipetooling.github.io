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
import { fireEvent, screen, waitFor } from '@testing-library/react'

// The Job photos window a card's Photos line opens reads who is signed in (punch list #244, v2.6451).
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant' })
})

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
    expect(screen.getByText('Job folder')).toBeTruthy()
    expect(screen.getByText('Photos')).toBeTruthy()
    expect(screen.queryByText('Hazmat fee')).toBeNull()
    expect(screen.queryByText('Send back')).toBeNull()
    fireEvent.click(screen.getByText('View job'))
    expect(openStagesDetailJobModal).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('View job')).toBeNull()
  })

  it('the sheet’s Photos line opens the Job photos window on that card’s job (v2.6451; the cards drew no window before)', async () => {
    const job = makeJob({ job_name: 'Card Photos' })
    renderWithProviders(<JobsStagesCardList {...makeProps({ jobList: [job] })} />)
    await settle()
    fireEvent.click(screen.getByTitle('More actions'))
    fireEvent.click(screen.getByText('Photos'))
    await waitFor(() => expect(document.querySelector('[data-job-photos-window]')?.getAttribute('data-job-photos-window')).toBe(job.id))
  })

  it('the sheet’s Job folder opens the Documents tab and says when the folder is not made yet (v2.6301)', async () => {
    const openEdit = vi.fn()
    const job = makeJob({ job_name: 'Card Folder' })
    renderWithProviders(<JobsStagesCardList {...makeProps({ jobList: [job], openEdit })} />)
    await settle()
    fireEvent.click(screen.getByTitle('More actions'))
    expect(screen.getByText('not made yet')).toBeTruthy()
    fireEvent.click(screen.getByText('Job folder'))
    expect(openEdit).toHaveBeenCalledWith(job, { initialTab: 'documents' })
    expect(screen.queryByText('Job folder')).toBeNull()
  })

  it('the sheet’s Checklists line carries the job’s standing and opens the row’s sheet; a job with no stage that takes a checklist has no line (#246)', async () => {
    const openChecklistDoor = vi.fn()
    const job = makeJob({ job_name: 'Card Stages', fixtures: [{ id: 'f3', name: 'Trim Set', count: 1, line_unit_price: 4100, sequence_order: 3 }] })
    const notReady = { kind: 'trim_set', asked: 6, answered: 3, standing: 'not_ready', ready: false } as const
    renderWithProviders(<JobsStagesCardList {...makeProps({ jobList: [job], openChecklistDoor, checklistMarksFor: () => new Map([['f3', notReady]]) })} />)
    await settle()
    fireEvent.click(screen.getByTitle('More actions'))
    expect(screen.getByText('Checklists')).toBeTruthy()
    expect(screen.getByText('3 of 6')).toBeTruthy()
    fireEvent.click(screen.getByText('Checklists'))
    expect(openChecklistDoor).toHaveBeenCalledWith(job)
    expect(screen.queryByText('Checklists')).toBeNull()
  })

  it('the Checklists line is left off a service call and without the opener (#246)', async () => {
    const service = makeJob({ job_name: 'Card Service', fixtures: [{ id: 's1', name: 'Water heater', count: 1, line_unit_price: 900, sequence_order: 1 }] })
    renderWithProviders(<JobsStagesCardList {...makeProps({ jobList: [service], openChecklistDoor: vi.fn() })} />)
    await settle()
    fireEvent.click(screen.getByTitle('More actions'))
    expect(screen.getByText('Job folder')).toBeTruthy()
    expect(screen.queryByText('Checklists')).toBeNull()
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

describe('JobsStagesCardList empty group (#184)', () => {
  it('phone rows: a Needs me filter that hides every row says nothing in the group needs you, and All shows them', async () => {
    const onShowAll = vi.fn()
    const quiet = { line: 'Next: nothing booked', chip: null, needsMe: false, today: false }
    const phoneRows = { filter: 'needs' as const, nextLineFor: () => quiet, advanceConfirm: 'sheet' as const, advanceConsequence: () => '', onChip: vi.fn(), onShowAll }
    renderWithProviders(<JobsStagesCardList {...makeProps({ jobList: [makeJob({ job_name: 'Card Delta' })], phoneRows, groupEmpty: { group: 'Working', search: '', filtered: false } })} />)
    await settle()
    const empty = document.querySelector('[data-empty-state]') as HTMLElement
    expect(empty.textContent).toBe('Nothing in Working needs you. All shows the other 1.')
    fireEvent.click(screen.getByRole('button', { name: 'All' }))
    expect(onShowAll).toHaveBeenCalledTimes(1)
  })

  it('cards: a group with no job reads the good state', async () => {
    renderWithProviders(<JobsStagesCardList {...makeProps({ jobList: [], groupEmpty: { group: 'Waiting', search: '', filtered: false } })} />)
    await settle()
    expect(screen.getByText('Nothing in Waiting needs you.')).toBeTruthy()
  })
})

describe('JobsStagesCardList customer line teaser (v2.6689, punch list #125)', () => {
  it('the card’s teaser is the customer’s text when it is newer than the note, with its channel word, and opens the sheet', async () => {
    const onOpenCustomerDoor = vi.fn()
    const job = makeJob({ job_name: 'Card Lines', customer_id: 'cust-dana', customer_name: 'Dana Whitfield' })
    const dana = { id: 'c-dana', name: 'Dana Whitfield', goesBy: null, kind: 'customer' as const }
    renderWithProviders(
      <JobsStagesCardList
        {...makeProps({
          jobList: [job],
          jobThreadStatsByJobId: { [job.id]: { note_count: 1, last_note_at: '2026-08-11T14:28:00Z', last_note_body: 'Inspector confirmed.', last_note_author_name: 'Rosa', last_report_at: null, report_count: 0, last_report_author_name: null, last_report_template_name: null, last_report_preview: null } },
          customerLinesByJobId: new Map([[job.id, [{ id: 'm-in', contactId: 'c-dana', contact: dana, channel: 'text' as const, direction: 'in' as const, at: '2026-08-12T01:15:00Z', who: '', body: 'Can you do Thursday after 10 instead?', tied: true }]]]),
          onOpenCustomerDoor,
        })}
      />,
    )
    await settle()
    expect(screen.getByText(/Can you do Thursday after 10 instead\?/)).toBeTruthy()
    expect(screen.queryByText(/Inspector confirmed/)).toBeNull()
    fireEvent.click(screen.getByLabelText('Open the conversation with the customer'))
    expect(onOpenCustomerDoor).toHaveBeenCalledWith(job)
  })
})
