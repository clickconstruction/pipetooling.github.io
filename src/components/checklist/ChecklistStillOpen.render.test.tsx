// @vitest-environment jsdom
/**
 * Today's Still open list (punch list #369, step A2): no red frame, a row that says *given* with its age in amber,
 * red only for a due day that has passed, and a fold past three rows.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ChecklistOutstandingSection } from './ChecklistOutstandingSection'
import type { LedgerInstance } from '../../lib/checklistHistoryLedger'

vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => false }))

function inst(id: string, title: string, scheduled: string, due: string | null = null): LedgerInstance {
  return { id, scheduled_date: scheduled, completed_at: null, checklist_items: { title, due_date: due, repeat_type: 'once', show_until_completed: true } } as unknown as LedgerInstance
}

function renderList(instances: LedgerInstance[], openInstance: { id: string; n: number } | null = null) {
  const onToggleComplete = vi.fn()
  render(
    <ChecklistOutstandingSection
      instances={instances}
      eventsByInstance={new Map([['a', [{ id: 'e1', instance_id: 'a', event_type: 'comment', actor_user_id: 'u1', body: 'x', created_at: '2026-11-01T12:00:00Z' }, { id: 'e2', instance_id: 'a', event_type: 'comment', actor_user_id: 'u1', body: 'y', created_at: '2026-11-02T12:00:00Z' }]]])}
      currentUserId="me-1"
      todayStr="2026-11-16"
      titleFor={(i) => (i as unknown as { checklist_items: { title: string } }).checklist_items.title}
      activityFor={(i) => ({ item: { id: `item-${i.id}`, title: 't', created_at: null, created_by_user_id: null }, showInstanceDays: false })}
      onToggleComplete={onToggleComplete}
      setError={() => {}}
      openInstance={openInstance}
    />,
  )
  return { onToggleComplete }
}

const SIX = [
  inst('a', 'Give every carpentry tool a home', '2026-08-20'),
  inst('b', 'Order the shelf brackets', '2026-10-01', '2026-11-06'),
  inst('c', 'Label the pipe racks', '2026-11-13'),
  inst('d', 'Clear the back half of the floor', '2026-08-24'),
  inst('e', 'Set a marker at every mile', '2026-08-24'),
  inst('f', 'Sort the fittings wall', '2026-09-01'),
]

describe('Still open', () => {
  it('reads Still open with its count, and no red frame or need-doing pill', () => {
    renderList(SIX)
    expect(screen.getByRole('heading', { name: 'Still open · 6' })).toBeTruthy()
    expect(screen.queryByText(/need(s)? doing/)).toBeNull()
    expect(screen.queryByText('Outstanding')).toBeNull()
    const list = document.querySelector('[data-still-open] ul') as HTMLElement
    expect(list.style.border).not.toContain('220, 38, 38')
    expect(list.style.border).not.toContain('#dc2626')
  })

  it('a task with no due day says given and wears an amber age; a passed due day is the one red pill', () => {
    renderList(SIX)
    const first = document.querySelector('[data-task-instance="a"]') as HTMLElement
    expect(first.textContent).toContain('given ')
    expect(first.textContent).not.toContain('due ')
    expect(first.textContent).toContain('2 notes')
    expect(first.querySelector('[data-still-open-age]')?.getAttribute('data-still-open-age')).toBe('old')
    expect(first.querySelector('[data-still-open-age]')?.textContent).toBe('88 days')
    const late = document.querySelector('[data-task-instance="b"]') as HTMLElement
    expect(late.querySelector('[data-still-open-age]')?.getAttribute('data-still-open-age')).toBe('late')
    expect(late.querySelector('[data-still-open-age]')?.textContent).toBe('10 days late')
    const young = document.querySelector('[data-task-instance="c"]') as HTMLElement
    expect(young.querySelector('[data-still-open-age]')?.getAttribute('data-still-open-age')).toBe('soft')
    expect(document.querySelectorAll('[data-still-open-age="late"]')).toHaveLength(1)
  })

  it('folds past three rows behind Show 3 more, and the press opens the rest', () => {
    renderList(SIX)
    expect(document.querySelectorAll('[data-task-instance]')).toHaveLength(3)
    fireEvent.click(screen.getByRole('button', { name: 'Show 3 more' }))
    expect(document.querySelectorAll('[data-task-instance]')).toHaveLength(6)
    expect(screen.queryByRole('button', { name: /Show \d+ more/ })).toBeNull()
  })

  it('a list of four is drawn whole', () => {
    renderList(SIX.slice(0, 4))
    expect(document.querySelectorAll('[data-task-instance]')).toHaveLength(4)
    expect(document.querySelector('[data-still-open-more]')).toBeNull()
  })

  it('the tick still marks a row done', () => {
    const { onToggleComplete } = renderList(SIX.slice(0, 2))
    fireEvent.click(screen.getAllByRole('button', { name: 'Mark done' })[0]!)
    expect(onToggleComplete).toHaveBeenCalledTimes(1)
  })
})
