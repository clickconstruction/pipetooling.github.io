// @vitest-environment jsdom
/**
 * Render tests for the "Move day" row in the Edit schedule block modal.
 *
 * The row is opt-in via `onChangeWorkDate` so the four drag-and-drop surfaces
 * that share this modal keep their existing chrome; Dispatch Mode (phone, no
 * drag-and-drop) is the caller that turns it on.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

import { fireEvent, screen } from '@testing-library/react'
import { ScheduleDispatchAddBlockModal } from './ScheduleDispatchAddBlockModal'
import { renderWithProviders } from '../../test/renderSmokeMocks'

type ModalProps = Parameters<typeof ScheduleDispatchAddBlockModal>[0]

function makeProps(overrides: Partial<ModalProps> = {}): ModalProps {
  return {
    open: true,
    mode: 'edit',
    jobTitle: '878 · Take 5- Seguin',
    personLabel: 'Malachi',
    workDate: '2026-08-03',
    timeStart: '06:00',
    timeEnd: '08:00',
    note: 'In progress',
    saving: false,
    error: null,
    onClose: vi.fn(),
    onChangeStart: vi.fn(),
    onChangeEnd: vi.fn(),
    onChangeNote: vi.fn(),
    onSave: vi.fn(),
    ...overrides,
  }
}

describe('ScheduleDispatchAddBlockModal — move day row', () => {
  it('is absent when the caller does not opt in', () => {
    renderWithProviders(<ScheduleDispatchAddBlockModal {...makeProps()} />)
    expect(screen.queryByText('Move day')).toBeNull()
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeTruthy()
  })

  it('is absent in add mode even when a handler is passed', () => {
    renderWithProviders(
      <ScheduleDispatchAddBlockModal
        {...makeProps({ mode: 'add', onChangeWorkDate: vi.fn() })}
      />,
    )
    expect(screen.queryByText('Move day')).toBeNull()
  })

  it('renders one day back through two days forward, with the current day pressed', () => {
    renderWithProviders(
      <ScheduleDispatchAddBlockModal {...makeProps({ onChangeWorkDate: vi.fn() })} />,
    )
    expect(screen.getByText('Move day')).toBeTruthy()
    const group = screen.getByRole('group', { name: 'Move day' })
    const labels = Array.from(group.querySelectorAll('button'))
      .map((b) => b.getAttribute('title'))
      .filter((t): t is string => Boolean(t))
    expect(labels).toEqual([
      'Sunday, August 2, 2026',
      'Monday, August 3, 2026',
      'Tuesday, August 4, 2026',
      'Wednesday, August 5, 2026',
      'Pick another date',
    ])
    expect(
      screen.getByRole('button', { name: /Mon.*Aug 3/s }).getAttribute('aria-pressed'),
    ).toBe('true')
  })

  it('reports the picked day to the caller, backward and forward', () => {
    const onChangeWorkDate = vi.fn()
    renderWithProviders(<ScheduleDispatchAddBlockModal {...makeProps({ onChangeWorkDate })} />)
    fireEvent.click(screen.getByRole('button', { name: /Sun.*Aug 2/s }))
    expect(onChangeWorkDate).toHaveBeenCalledWith('2026-08-02')
    fireEvent.click(screen.getByRole('button', { name: /Wed.*Aug 5/s }))
    expect(onChangeWorkDate).toHaveBeenCalledWith('2026-08-05')
  })

  it('names the target day and relabels save once a different day is picked', () => {
    renderWithProviders(
      <ScheduleDispatchAddBlockModal
        {...makeProps({ onChangeWorkDate: vi.fn(), newWorkDate: '2026-08-02' })}
      />,
    )
    expect(screen.getByText('Moving to Sunday, August 2, 2026')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Move and save' })).toBeTruthy()
    expect(
      screen.getByRole('button', { name: /Sun.*Aug 2/s }).getAttribute('aria-pressed'),
    ).toBe('true')
  })

  it('shows the selected day in the header instead of the original', () => {
    renderWithProviders(
      <ScheduleDispatchAddBlockModal
        {...makeProps({ onChangeWorkDate: vi.fn(), newWorkDate: '2026-08-01' })}
      />,
    )
    expect(screen.getByTitle('2026-08-01').textContent).toBe('Saturday, August 1, 2026')
  })

  it('keeps save unlabelled as a move while the original day is selected', () => {
    renderWithProviders(
      <ScheduleDispatchAddBlockModal
        {...makeProps({ onChangeWorkDate: vi.fn(), newWorkDate: '2026-08-03' })}
      />,
    )
    expect(screen.queryByText(/^Moving to/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeTruthy()
  })

  it('reveals a date input on demand for days beyond the chips', () => {
    const onChangeWorkDate = vi.fn()
    renderWithProviders(<ScheduleDispatchAddBlockModal {...makeProps({ onChangeWorkDate })} />)
    expect(screen.queryByLabelText('Move this block to a specific date')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Pick another date' }))
    const input = screen.getByLabelText('Move this block to a specific date')
    fireEvent.change(input, { target: { value: '2026-07-20' } })
    expect(onChangeWorkDate).toHaveBeenCalledWith('2026-07-20')
  })

  it('keeps the date input open when the selection is off the chips', () => {
    renderWithProviders(
      <ScheduleDispatchAddBlockModal
        {...makeProps({ onChangeWorkDate: vi.fn(), newWorkDate: '2026-07-20' })}
      />,
    )
    expect(screen.getByLabelText('Move this block to a specific date')).toBeTruthy()
    expect(screen.getByText('Moving to Monday, July 20, 2026')).toBeTruthy()
  })

  it('disables every day control while saving', () => {
    renderWithProviders(
      <ScheduleDispatchAddBlockModal {...makeProps({ onChangeWorkDate: vi.fn(), saving: true })} />,
    )
    const group = screen.getByRole('group', { name: 'Move day' })
    const buttons = Array.from(group.querySelectorAll('button'))
    expect(buttons.length).toBe(5)
    expect(buttons.every((b) => b.hasAttribute('disabled'))).toBe(true)
  })
})

describe('ScheduleDispatchAddBlockModal — remove button', () => {
  it('is absent when the caller does not opt in', () => {
    renderWithProviders(<ScheduleDispatchAddBlockModal {...makeProps()} />)
    expect(screen.queryByRole('button', { name: 'Remove this block from the schedule' })).toBeNull()
  })

  it('is absent in add mode even when a handler is passed', () => {
    renderWithProviders(
      <ScheduleDispatchAddBlockModal {...makeProps({ mode: 'add', onRemove: vi.fn() })} />,
    )
    expect(screen.queryByRole('button', { name: 'Remove this block from the schedule' })).toBeNull()
  })

  it('renders in edit mode and hands off to the caller on click', () => {
    const onRemove = vi.fn()
    renderWithProviders(<ScheduleDispatchAddBlockModal {...makeProps({ onRemove })} />)
    const btn = screen.getByRole('button', { name: 'Remove this block from the schedule' })
    expect(btn.textContent).toBe('Remove')
    fireEvent.click(btn)
    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  it('is disabled while saving', () => {
    renderWithProviders(
      <ScheduleDispatchAddBlockModal {...makeProps({ onRemove: vi.fn(), saving: true })} />,
    )
    expect(
      screen
        .getByRole('button', { name: 'Remove this block from the schedule' })
        .hasAttribute('disabled'),
    ).toBe(true)
  })
})
