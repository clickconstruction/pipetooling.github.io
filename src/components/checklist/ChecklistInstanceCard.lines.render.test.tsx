// @vitest-environment jsdom
/**
 * Task cards (#273, PR 2): the Done when… lines on the card. The card variant draws them under the title with the
 * count line, a tick calls `onTickLine`, the next open line wears the amber ring, a done card's boxes are read-only,
 * and the row variant folds the lines behind a *2 of 3 done when…* chip.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ChecklistInstanceCard } from './ChecklistInstanceCard'
import type { LineState } from '../../lib/taskCriteria'

const line = (id: string, body: string, checked: boolean): LineState => ({
  criterion: { id, checklist_item_id: 'item-1', roadmap_task_id: null, body, sort_index: Number(id.slice(-1)) },
  checked,
  checkedAt: checked ? '2026-11-06T15:12:00Z' : null,
  checkedBy: checked ? 'worker-1' : null,
  photoId: null,
})

const LINES = [line('c1', 'Pipe is racked by size', true), line('c2', 'Fittings are in labeled bins', false), line('c3', 'The cart is clear', false)]

function renderCard(overrides: Partial<Parameters<typeof ChecklistInstanceCard>[0]> = {}) {
  const onTickLine = vi.fn()
  render(
    <ul>
      <ChecklistInstanceCard
        instance={{ id: 'inst-1', completed_at: null, reviewed_at: null }}
        title="Put the plumbing tools in a neat home"
        events={[]}
        nameById={{ 'worker-1': 'Mateo' }}
        currentUserId="me-1"
        onToggleComplete={vi.fn()}
        onPostComment={vi.fn().mockResolvedValue(true)}
        lines={LINES}
        onTickLine={onTickLine}
        {...overrides}
      />
    </ul>,
  )
  return { onTickLine }
}

describe('ChecklistInstanceCard with Done when… lines', () => {
  it('draws the lines under the title with the count, the stamp on a ticked one, and ticks on a press', () => {
    const { onTickLine } = renderCard()
    expect(screen.getByText('1 of 3 done when…')).toBeTruthy()
    expect(screen.getByText('Pipe is racked by size')).toBeTruthy()
    expect(screen.getByText(/Mateo · /)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Tick: Fittings are in labeled bins' }))
    expect(onTickLine).toHaveBeenCalledWith('c2', true)
    fireEvent.click(screen.getByRole('button', { name: 'Untick: Pipe is racked by size' }))
    expect(onTickLine).toHaveBeenCalledWith('c1', false)
  })

  it('marks the next open line with the amber ring and no other', () => {
    renderCard()
    const next = screen.getByRole('button', { name: 'Tick: Fittings are in labeled bins' })
    const later = screen.getByRole('button', { name: 'Tick: The cart is clear' })
    // jsdom reads the hex back as rgb.
    expect(next.style.border).toContain('rgb(217, 119, 6)')
    expect(later.style.border).not.toContain('rgb(217, 119, 6)')
  })

  it('a done card’s boxes are read-only', () => {
    renderCard({ instance: { id: 'inst-1', completed_at: '2026-11-06T16:00:00Z', reviewed_at: null }, lines: LINES.map((l) => ({ ...l, checked: true })) })
    expect((screen.getByRole('button', { name: 'Untick: Pipe is racked by size' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('the row variant folds the lines behind the count chip', () => {
    renderCard({ variant: 'row' })
    expect(screen.queryByText('Fittings are in labeled bins')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '1 of 3 done when…' }))
    expect(screen.getByText('Fittings are in labeled bins')).toBeTruthy()
  })

  it('draws nothing extra on a card without lines', () => {
    renderCard({ lines: [] })
    expect(screen.queryByText(/done when…/)).toBeNull()
  })

  it('reads a criterion event and a progress event on the thread', () => {
    renderCard({
      lines: [],
      events: [
        { id: 'e1', instance_id: 'inst-1', event_type: 'criterion', actor_user_id: 'worker-1', body: '✓ Pipe is racked by size', created_at: '2026-11-06T15:12:00Z' },
        { id: 'e2', instance_id: 'inst-1', event_type: 'progress', actor_user_id: 'worker-1', body: 'puddy and the glue', created_at: '2026-11-06T15:20:00Z', percent: 75 },
        { id: 'e3', instance_id: 'inst-1', event_type: 'comment', actor_user_id: 'worker-1', body: 'a note', created_at: '2026-11-06T15:21:00Z' },
      ],
    })
    fireEvent.click(screen.getByRole('button', { name: /Notes/ }))
    expect(screen.getByText(/✓ Pipe is racked by size · Mateo/)).toBeTruthy()
    expect(screen.getByText(/75%/)).toBeTruthy()
    expect(screen.getByText(/puddy and the glue/)).toBeTruthy()
  })
})
