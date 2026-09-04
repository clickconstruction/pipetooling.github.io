// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import ScheduleDispatchMoveBlockSheet from './ScheduleDispatchMoveBlockSheet'

const WEEK = ['2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04']

function renderSheet(onSave = vi.fn()) {
  renderWithProviders(
    <ScheduleDispatchMoveBlockSheet
      open
      title="J1004 · Kane- Hot water line leak"
      windowLabel="4:00 PM–5:30 PM"
      sourceYmd="2026-09-03"
      sourceUserId="abraham"
      visibleDayKeys={WEEK}
      people={[
        { userId: 'abraham', displayName: 'Abraham' },
        { userId: 'paige', displayName: 'Paige' },
      ]}
      saving={false}
      error={null}
      onClose={() => {}}
      onSave={onSave}
    />,
  )
  return onSave
}

describe('ScheduleDispatchMoveBlockSheet', () => {
  it('opens on the current cell with nothing to move', () => {
    renderSheet()
    expect(screen.getByText('J1004 · Kane- Hot water line leak')).toBeTruthy()
    const save = screen.getByRole('button', { name: 'Nothing to move' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    expect(screen.getByRole('button', { name: /Thu/ }).getAttribute('aria-pressed')).toBe('true')
  })

  it('tapping Fri then Save hands back the new day for the same person', () => {
    const onSave = renderSheet()
    fireEvent.click(screen.getByRole('button', { name: /Fri/ }))
    const save = screen.getByRole('button', { name: 'Move to Fri 9/4' }) as HTMLButtonElement
    expect(save.disabled).toBe(false)
    fireEvent.click(save)
    expect(onSave).toHaveBeenCalledWith({ workDate: '2026-09-04', assigneeUserId: 'abraham' })
  })

  it('a different person alone reads as a person move', () => {
    const onSave = renderSheet()
    fireEvent.click(screen.getByRole('button', { name: 'Paige' }))
    fireEvent.click(screen.getByRole('button', { name: 'Move to Paige' }))
    expect(onSave).toHaveBeenCalledWith({ workDate: '2026-09-03', assigneeUserId: 'paige' })
  })
})
