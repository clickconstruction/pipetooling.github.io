// @vitest-environment jsdom
/**
 * v2.4066: the Workflow page's six step windows as a component. A harness holds the windows' state
 * the way the page does, so typing behaves as it does there. Pins the seam — nothing drawn while
 * every window is closed; delete asks for the step's name only when it has content, and resets
 * on close; Send Back and Skip hand their reason back (Skip only with one, "Not relevant" fills
 * it); Set Start's time; the Expected dates window keeps start, end and length in line, warns, and
 * closes on its backdrop; the Assign picker puts you first, filters, and assigns or clears.
 */
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { renderSettled, renderWithProviders } from '../../test/renderSmokeMocks'
import { WorkflowStepLifecycleModals, type ExpectedDatesWindow, type WorkflowStepLifecycleModalsProps } from './WorkflowStepLifecycleModals'

type Step = NonNullable<WorkflowStepLifecycleModalsProps['confirmDeleteStep']>

function step(extra: Partial<Step> = {}): Step {
  return {
    id: 's1',
    name: 'Top Out',
    status: 'pending',
    scheduled_start_date: null,
    scheduled_end_date: null,
    ...extra,
  } as Step
}

type Open = Partial<{
  confirmDeleteStep: Step
  rejectStep: { step: Step; reason: string }
  skipStep: { step: Step; reason: string }
  setStartStep: { step: Step; startDateTime: string }
  expectedDatesStep: ExpectedDatesWindow
  assignPersonStep: Step
}>

const calls = {
  deleteStep: vi.fn(async () => {}),
  submitReject: vi.fn(),
  submitSkip: vi.fn(),
  submitSetStart: vi.fn(),
  submitExpectedDates: vi.fn(),
  clearExpectedDates: vi.fn(),
  assignPersonFromPicker: vi.fn(),
}
let state: Record<string, unknown> = {}

function Harness({ open, empty = true, roster = [], currentUserName = null }: { open: Open; empty?: boolean; roster?: WorkflowStepLifecycleModalsProps['roster']; currentUserName?: string | null }) {
  const [confirmDeleteStep, setConfirmDeleteStep] = useState<Step | null>(open.confirmDeleteStep ?? null)
  const [deleteStepConfirmText, setDeleteStepConfirmText] = useState('')
  const [rejectStep, setRejectStep] = useState(open.rejectStep ?? null)
  const [skipStep, setSkipStep] = useState(open.skipStep ?? null)
  const [setStartStep, setSetStartStep] = useState(open.setStartStep ?? null)
  const [expectedDatesStep, setExpectedDatesStep] = useState<ExpectedDatesWindow | null>(open.expectedDatesStep ?? null)
  const [assignPersonStep, setAssignPersonStep] = useState<Step | null>(open.assignPersonStep ?? null)
  const [assignPersonFilter, setAssignPersonFilter] = useState('')
  state = { confirmDeleteStep, deleteStepConfirmText, rejectStep, skipStep, setStartStep, expectedDatesStep, assignPersonStep, assignPersonFilter }
  return (
    <WorkflowStepLifecycleModals
      confirmDeleteStep={confirmDeleteStep}
      setConfirmDeleteStep={setConfirmDeleteStep}
      deleteStepConfirmText={deleteStepConfirmText}
      setDeleteStepConfirmText={setDeleteStepConfirmText}
      isStepEmpty={() => empty}
      deleteStep={calls.deleteStep}
      rejectStep={rejectStep}
      setRejectStep={setRejectStep}
      submitReject={calls.submitReject}
      skipStep={skipStep}
      setSkipStep={setSkipStep}
      submitSkip={calls.submitSkip}
      setStartStep={setStartStep}
      setSetStartStep={setSetStartStep}
      submitSetStart={calls.submitSetStart}
      expectedDatesStep={expectedDatesStep}
      setExpectedDatesStep={setExpectedDatesStep}
      submitExpectedDates={calls.submitExpectedDates}
      clearExpectedDates={calls.clearExpectedDates}
      assignPersonStep={assignPersonStep}
      setAssignPersonStep={setAssignPersonStep}
      assignPersonFilter={assignPersonFilter}
      setAssignPersonFilter={setAssignPersonFilter}
      assignPersonFromPicker={calls.assignPersonFromPicker}
      roster={roster}
      currentUserName={currentUserName}
    />
  )
}

const expected = (extra: Partial<ExpectedDatesWindow> = {}): ExpectedDatesWindow => ({
  step: step(),
  expectedStart: '',
  expectedEnd: '',
  lengthDays: '',
  updateNextStage: false,
  hasNextStage: false,
  seededFromPrior: false,
  ...extra,
})

afterEach(() => {
  cleanup()
  for (const f of Object.values(calls)) f.mockClear()
})

describe('WorkflowStepLifecycleModals', () => {
  it('draws nothing while every window is closed', () => {
    const { container } = renderWithProviders(<Harness open={{}} />)
    // first paint
    expect(container.textContent).toBe('')
  })

  it('deletes an empty step without asking for its name, then closes', async () => {
    await renderSettled(<Harness open={{ confirmDeleteStep: step() }} />, { loaded: () => screen.findByText('Delete step: Top Out?') })
    expect(screen.getByText('This step has no assignee, notes, or line items.')).toBeTruthy()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Delete' })) })
    expect(calls.deleteStep).toHaveBeenCalledWith(expect.objectContaining({ id: 's1' }))
    expect(state.confirmDeleteStep).toBeNull()
  })

  it('asks for the name of a step with content, and forgets what was typed on Cancel', async () => {
    await renderSettled(<Harness open={{ confirmDeleteStep: step() }} empty={false} />, { loaded: () => screen.findByText('Delete step: Top Out?') })
    const del = screen.getByRole('button', { name: 'Delete' }) as HTMLButtonElement
    expect(del.disabled).toBe(true)
    fireEvent.change(screen.getByPlaceholderText('Top Out'), { target: { value: 'Top Ou' } })
    expect(del.disabled).toBe(true)
    fireEvent.change(screen.getByPlaceholderText('Top Out'), { target: { value: '  Top Out ' } })
    expect(del.disabled).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(state.confirmDeleteStep).toBeNull()
    expect(state.deleteStepConfirmText).toBe('')
    expect(calls.deleteStep).not.toHaveBeenCalled()
  })

  it('Send Back keeps the typed reason and hands off to the page', async () => {
    await renderSettled(<Harness open={{ rejectStep: { step: step(), reason: '' } }} />, { loaded: () => screen.findByText('Previous work incomplete: Top Out') })
    fireEvent.change(screen.getByPlaceholderText(/What is wrong/), { target: { value: 'Stub-outs too short' } })
    expect(state.rejectStep).toMatchObject({ reason: 'Stub-outs too short' })
    fireEvent.click(screen.getByRole('button', { name: 'Send Back: Previous Work Incomplete' }))
    expect(calls.submitReject).toHaveBeenCalledTimes(1)
  })

  it('Skip needs a reason; Not relevant fills one in', async () => {
    await renderSettled(<Harness open={{ skipStep: { step: step(), reason: '' } }} />, { loaded: () => screen.findByText('Skip step: Top Out') })
    const skip = screen.getByRole('button', { name: 'Skip' }) as HTMLButtonElement
    expect(skip.disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Not relevant' }))
    expect(state.skipStep).toMatchObject({ reason: 'Not relevant' })
    expect(skip.disabled).toBe(false)
    fireEvent.click(skip)
    expect(calls.submitSkip).toHaveBeenCalledTimes(1)
  })

  it('Set Start takes a date and time and hands off', async () => {
    await renderSettled(<Harness open={{ setStartStep: { step: step(), startDateTime: '2026-09-28T08:00' } }} />, { loaded: () => screen.findByText('Set Start Time: Top Out') })
    fireEvent.change(screen.getByLabelText('Start Date & Time'), { target: { value: '2026-09-28T07:30' } })
    expect(state.setStartStep).toMatchObject({ startDateTime: '2026-09-28T07:30' })
    fireEvent.click(screen.getByRole('button', { name: 'Set Start' }))
    expect(calls.submitSetStart).toHaveBeenCalledTimes(1)
  })

  it('Expected dates: a length moves the end from the start; a borrowed start is marked until changed', async () => {
    await renderSettled(<Harness open={{ expectedDatesStep: expected({ expectedStart: '2026-09-28', seededFromPrior: true }) }} />, {
      loaded: () => screen.findByText('Expected dates: Top Out'),
    })
    expect(screen.getByText("Start was prefilled from the previous stage's expected end.")).toBeTruthy()
    fireEvent.change(screen.getByPlaceholderText('e.g. 5'), { target: { value: '5' } })
    expect(state.expectedDatesStep).toMatchObject({ lengthDays: '5', expectedEnd: '2026-10-03' })
    fireEvent.change(screen.getByLabelText('Expected start'), { target: { value: '2026-10-01' } })
    expect(state.expectedDatesStep).toMatchObject({ expectedStart: '2026-10-01', expectedEnd: '2026-10-06', seededFromPrior: false })
    expect(screen.queryByText("Start was prefilled from the previous stage's expected end.")).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(calls.submitExpectedDates).toHaveBeenCalledTimes(1)
  })

  it('Expected dates: warns about a negative length and an end before the start', async () => {
    await renderSettled(<Harness open={{ expectedDatesStep: expected({ expectedStart: '2026-10-05', expectedEnd: '2026-10-01', lengthDays: '-4' }) }} />, {
      loaded: () => screen.findByText('Expected dates: Top Out'),
    })
    expect(screen.getByText('Length must be a non-negative number.')).toBeTruthy()
    expect(screen.getByText('Expected end is before expected start.')).toBeTruthy()
  })

  it('Expected dates: Clear only when the step has dates; the next-step box only when there is one; the backdrop closes', async () => {
    await renderSettled(<Harness open={{ expectedDatesStep: expected() }} />, { loaded: () => screen.findByText('Expected dates: Top Out') })
    expect((screen.getByRole('button', { name: 'Clear' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByRole('checkbox')).toBeNull()
    cleanup()
    await renderSettled(
      <Harness open={{ expectedDatesStep: expected({ step: step({ scheduled_end_date: '2026-10-01' }), hasNextStage: true, updateNextStage: true }) }} />,
      { loaded: () => screen.findByText('Expected dates: Top Out') },
    )
    const clear = screen.getByRole('button', { name: 'Clear' }) as HTMLButtonElement
    expect(clear.disabled).toBe(false)
    fireEvent.click(clear)
    expect(calls.clearExpectedDates).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(state.expectedDatesStep).toMatchObject({ updateNextStage: false })
    fireEvent.click(screen.getByRole('dialog'))
    expect(state.expectedDatesStep).toBeNull()
  })

  it('Assign puts you first, filters the roster, and assigns or clears', async () => {
    const roster = [
      { name: 'Behar Plumbing', personId: 'pp1' },
      { name: 'Pat Office', personId: null },
      { name: 'Sam Sub', personId: null },
    ]
    await renderSettled(<Harness open={{ assignPersonStep: step() }} roster={roster} currentUserName="Pat Office" />, {
      loaded: () => screen.findByText('Add person to: Top Out'),
    })
    const picks = () => screen.getAllByRole('button').map((b) => b.textContent).filter((t) => t !== 'Clear' && t !== 'Cancel')
    expect(picks()).toEqual(['Pat Office (You)', 'Behar Plumbing', 'Sam Sub'])
    fireEvent.change(screen.getByPlaceholderText('Filter...'), { target: { value: 'be' } })
    expect(picks()).toEqual(['Behar Plumbing'])
    fireEvent.click(screen.getByRole('button', { name: 'Behar Plumbing' }))
    expect(calls.assignPersonFromPicker).toHaveBeenLastCalledWith(expect.objectContaining({ id: 's1' }), 'Behar Plumbing', 'pp1')
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(calls.assignPersonFromPicker).toHaveBeenLastCalledWith(expect.objectContaining({ id: 's1' }), null)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(state.assignPersonStep).toBeNull()
    expect(state.assignPersonFilter).toBe('')
  })

  it('Assign with nobody to offer says where to add people', async () => {
    await renderSettled(<Harness open={{ assignPersonStep: step() }} />, { loaded: () => screen.findByText('Add person to: Top Out') })
    expect(screen.getByText('No people in your roster yet. Add them on the People page.')).toBeTruthy()
    expect(screen.queryByPlaceholderText('Filter...')).toBeNull()
  })
})
