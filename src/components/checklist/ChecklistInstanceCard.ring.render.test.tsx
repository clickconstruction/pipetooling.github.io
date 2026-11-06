// @vitest-environment jsdom
/**
 * Task cards (#273, PR 3): the ring on the card. With `ring` the tick box gives way to the ring; a press opens the
 * % sheet, whose Set lands through `onSetPercent` and whose Done through `onToggleComplete`; a done ring reopens on a
 * press; the thread's last progress line reads under the title in the sheet.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ChecklistInstanceCard } from './ChecklistInstanceCard'

vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => false }))

function renderCard(overrides: Partial<Parameters<typeof ChecklistInstanceCard>[0]> = {}) {
  const onToggleComplete = vi.fn()
  const onSetPercent = vi.fn().mockResolvedValue(true)
  render(
    <ul>
      <ChecklistInstanceCard
        instance={{ id: 'inst-1', completed_at: null, reviewed_at: null, percent_complete: 50 }}
        title="Clear the back half of the floor"
        events={[{ id: 'e1', instance_id: 'inst-1', event_type: 'progress', actor_user_id: 'worker-1', body: '', created_at: '2026-11-03T20:12:00Z', percent: 50 }]}
        nameById={{ 'worker-1': 'Mateo' }}
        currentUserId="me-1"
        onToggleComplete={onToggleComplete}
        onPostComment={vi.fn().mockResolvedValue(true)}
        ring
        onSetPercent={onSetPercent}
        {...overrides}
      />
    </ul>,
  )
  return { onToggleComplete, onSetPercent }
}

describe('ChecklistInstanceCard with the ring', () => {
  it('draws the ring with the percent in the tick’s seat and opens the sheet on a press', async () => {
    const { onSetPercent } = renderCard()
    expect(screen.queryByRole('button', { name: 'Mark done' })).toBeNull()
    const ring = screen.getByRole('button', { name: '50% done: Clear the back half of the floor. Set where it stands' })
    expect(ring.textContent).toBe('50')
    fireEvent.click(ring)
    expect(screen.getByRole('dialog', { name: 'Where does it stand?' })).toBeTruthy()
    expect(screen.getByText(/was 50%/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '75' }))
    fireEvent.click(screen.getByRole('button', { name: 'Set 75%' }))
    await waitFor(() => expect(onSetPercent).toHaveBeenCalledWith(75, ''))
  })

  it('Done on the sheet takes the tick’s own path', async () => {
    const { onToggleComplete } = renderCard()
    fireEvent.click(screen.getByRole('button', { name: /Set where it stands/ }))
    fireEvent.click(screen.getByRole('button', { name: '✓ Done' }))
    await waitFor(() => expect(onToggleComplete).toHaveBeenCalledTimes(1))
  })

  it('a done ring reopens on a press, with no sheet', () => {
    const { onToggleComplete } = renderCard({ instance: { id: 'inst-1', completed_at: '2026-11-06T16:00:00Z', reviewed_at: null, percent_complete: 100 } })
    fireEvent.click(screen.getByRole('button', { name: 'Done, tap to reopen: Clear the back half of the floor' }))
    expect(onToggleComplete).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('the row variant draws a smaller ring', () => {
    renderCard({ variant: 'row' })
    const ring = screen.getByRole('button', { name: /Set where it stands/ })
    expect(ring.style.width).toBe('30px')
  })

  it('without `ring` the tick box stays', () => {
    renderCard({ ring: false })
    expect(screen.getByRole('button', { name: 'Mark done' })).toBeTruthy()
  })
})
