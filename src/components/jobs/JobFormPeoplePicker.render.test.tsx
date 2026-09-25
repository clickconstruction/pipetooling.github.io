// @vitest-environment jsdom
/**
 * The Add people dialog reports open/closed to its host (v2.3839) so Edit Job
 * pauses its Escape-to-close while the dialog is up — before, Escape closed the
 * whole form underneath it.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { JobFormPeoplePicker } from './JobFormPeoplePicker'

describe('JobFormPeoplePicker · onOverlayOpenChange', () => {
  it('reports the Add people dialog opening and closing, and false on unmount', () => {
    const onOverlayOpenChange = vi.fn()
    const { unmount } = render(
      <JobFormPeoplePicker users={[{ id: 'u1', name: 'Tech One' }]} teamMemberIds={[]} setTeamMemberIds={() => {}} onOverlayOpenChange={onOverlayOpenChange} />,
    )
    expect(onOverlayOpenChange).toHaveBeenLastCalledWith(false)
    fireEvent.click(screen.getAllByRole('button', { name: 'Add people to this job' })[0]!)
    expect(onOverlayOpenChange).toHaveBeenLastCalledWith(true)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onOverlayOpenChange).toHaveBeenLastCalledWith(false)
    fireEvent.click(screen.getAllByRole('button', { name: 'Add people to this job' })[0]!)
    expect(onOverlayOpenChange).toHaveBeenLastCalledWith(true)
    unmount()
    expect(onOverlayOpenChange).toHaveBeenLastCalledWith(false)
  })
})
