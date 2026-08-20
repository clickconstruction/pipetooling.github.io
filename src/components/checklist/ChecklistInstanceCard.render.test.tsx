// @vitest-environment jsdom
/**
 * Render-smoke tests for the sunlight-pass checklist card (v2.1854): the
 * 48px split action bar (Notes · count / Add note), the single Add-a-note
 * button when no comments exist, the Waiting-on-review / Signed-off chips,
 * the reopened callout with reason, and the composer posting flow.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ChecklistInstanceCard } from './ChecklistInstanceCard'
import type { ChecklistCardEvent } from '../../lib/checklistCardEvents'

function ev(partial: Partial<ChecklistCardEvent> & { event_type: string; created_at: string }): ChecklistCardEvent {
  return {
    id: partial.id ?? `${partial.event_type}-${partial.created_at}`,
    instance_id: 'inst-1',
    actor_user_id: 'worker-1',
    body: '',
    ...partial,
  }
}

function renderCard(overrides: Partial<Parameters<typeof ChecklistInstanceCard>[0]> = {}) {
  const onToggleComplete = vi.fn()
  const onPostComment = vi.fn().mockResolvedValue(true)
  const utils = render(
    <ul>
      <ChecklistInstanceCard
        instance={{ id: 'inst-1', completed_at: null, reviewed_at: null }}
        title="Feed and water chickens"
        events={[]}
        nameById={{ 'worker-1': 'Michael A', 'lead-1': 'Robert' }}
        currentUserId="me-1"
        onToggleComplete={onToggleComplete}
        onPostComment={onPostComment}
        {...overrides}
      />
    </ul>,
  )
  return { ...utils, onToggleComplete, onPostComment }
}

describe('ChecklistInstanceCard (sunlight action bar)', () => {
  it('no comments: single Add a note button, no Notes button', () => {
    renderCard()
    expect(screen.getByText(/Add a note/)).toBeTruthy()
    expect(screen.queryByText(/^💬 Notes$/)).toBeNull()
  })

  it('no comments: Add a note sits on the right half behind a spacer (mis-tap buffer)', () => {
    renderCard()
    const btn = screen.getByText(/Add a note/).closest('button') as HTMLButtonElement
    const row = btn.parentElement as HTMLElement
    expect(row.children.length).toBe(2)
    const spacer = row.children[0] as HTMLElement
    expect(spacer.tagName).toBe('SPAN')
    expect(spacer.getAttribute('aria-hidden')).toBe('true')
    expect(row.children[1]).toBe(btn)
  })

  it('with comments: Notes with count replaces Add note, right half behind the spacer (v2.1864)', () => {
    renderCard({
      events: [
        ev({ event_type: 'comment', created_at: '2026-08-19T10:00:00Z', body: 'first' }),
        ev({ event_type: 'comment', created_at: '2026-08-19T11:00:00Z', body: 'second' }),
      ],
    })
    expect(screen.getByText('💬 Notes')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
    expect(screen.queryByText(/Add note|Add a note/)).toBeNull()
    const row = screen.getByText('💬 Notes').closest('button')!.parentElement as HTMLElement
    expect(row.children.length).toBe(2)
    expect((row.children[0] as HTMLElement).tagName).toBe('SPAN')
    expect((row.children[0] as HTMLElement).getAttribute('aria-hidden')).toBe('true')
  })

  it('Add a note opens the thread with the composer; posting calls back and clears', async () => {
    const { onPostComment } = renderCard()
    fireEvent.click(screen.getByText(/Add a note/))
    const input = screen.getByPlaceholderText('Add a note…') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'went smooth' } })
    fireEvent.click(screen.getByText('Post'))
    expect(onPostComment).toHaveBeenCalledWith('went smooth')
    await vi.waitFor(() => expect(input.value).toBe(''))
  })

  it('completed + unreviewed shows the Waiting on review chip', () => {
    renderCard({ instance: { id: 'inst-1', completed_at: '2026-08-19T16:00:00Z', reviewed_at: null } })
    expect(screen.getByText('Waiting on review')).toBeTruthy()
  })

  it('reviewed shows the Signed off chip with the accepter', () => {
    renderCard({
      instance: { id: 'inst-1', completed_at: '2026-08-19T16:00:00Z', reviewed_at: '2026-08-19T17:00:00Z' },
      events: [ev({ event_type: 'accepted', created_at: '2026-08-19T17:00:00Z', actor_user_id: 'lead-1' })],
    })
    expect(screen.getByText('Signed off')).toBeTruthy()
    expect(screen.getByText(/by Robert/)).toBeTruthy()
  })

  it('reopened card carries the reopener and reason in the callout', () => {
    renderCard({
      events: [
        ev({ event_type: 'completed', created_at: '2026-08-19T16:00:00Z' }),
        ev({ event_type: 'reopened', created_at: '2026-08-19T17:00:00Z', actor_user_id: 'lead-1' }),
        ev({ event_type: 'comment', created_at: '2026-08-19T17:00:00Z', actor_user_id: 'lead-1', body: 'check the wire gauge' }),
      ],
    })
    expect(screen.getByText(/Reopened by Robert/)).toBeTruthy()
    expect(screen.getByText(/check the wire gauge/)).toBeTruthy()
  })

  it('complete toggle fires and meets the 34px target', () => {
    const { onToggleComplete } = renderCard()
    const toggle = screen.getByLabelText('Mark done')
    fireEvent.click(toggle)
    expect(onToggleComplete).toHaveBeenCalled()
    expect(toggle.style.width).toBe('34px')
  })
})
