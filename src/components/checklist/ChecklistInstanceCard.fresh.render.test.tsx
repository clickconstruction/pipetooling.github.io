// @vitest-environment jsdom
/**
 * The `fresh` look of the task card (punch list #369): Checklist → Today in the New task window's language. A quiet
 * note pill in place of the 48px bar, a done task as one line that says who hears, and the Next card with its one
 * solid blue press.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ChecklistInstanceCard } from './ChecklistInstanceCard'
import type { ChecklistCardEvent } from '../../lib/checklistCardEvents'
import { settle } from '../../test/renderSmokeMocks'

vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => false }))

function ev(partial: Partial<ChecklistCardEvent> & { event_type: string; created_at: string }): ChecklistCardEvent {
  return { id: partial.id ?? `${partial.event_type}-${partial.created_at}`, instance_id: 'inst-1', actor_user_id: 'worker-1', body: '', ...partial }
}

function renderFresh(overrides: Partial<Parameters<typeof ChecklistInstanceCard>[0]> = {}) {
  const onToggleComplete = vi.fn()
  const onPostComment = vi.fn().mockResolvedValue(true)
  const utils = render(
    <ul>
      <ChecklistInstanceCard
        instance={{ id: 'inst-1', completed_at: null, reviewed_at: null }}
        title="Check the truck fluids"
        events={[]}
        nameById={{ 'worker-1': 'Theo', 'lead-1': 'Imani' }}
        currentUserId="me-1"
        onToggleComplete={onToggleComplete}
        onPostComment={onPostComment}
        variant="fresh"
        {...overrides}
      />
    </ul>,
  )
  return { ...utils, onToggleComplete, onPostComment }
}

describe('ChecklistInstanceCard, the fresh look', () => {
  it('an open task: a 30px tick with its thick edge, a quiet ＋ Note pill, and no 48px note bar', async () => {
    const { onToggleComplete } = renderFresh()
    await settle()
    const tick = screen.getByRole('button', { name: 'Mark done' })
    expect(tick.style.width).toBe('30px')
    expect(tick.style.border).toContain('2.5px')
    fireEvent.click(tick)
    expect(onToggleComplete).toHaveBeenCalledTimes(1)
    const note = screen.getByRole('button', { name: '＋ Note' })
    expect(note.style.borderRadius).toBe('999px')
    expect(screen.queryByRole('button', { name: /Add a note/ })).toBeNull()
  })

  it('the note pill opens the thread with the composer, and lights while it is open', async () => {
    const { onPostComment } = renderFresh()
    await settle()
    const note = screen.getByRole('button', { name: '＋ Note' })
    fireEvent.click(note)
    expect(note.getAttribute('aria-expanded')).toBe('true')
    expect(note.style.fontWeight).toBe('700')
    const box = screen.getByPlaceholderText('Add a note…')
    fireEvent.change(box, { target: { value: 'Coolant was low' } })
    fireEvent.click(screen.getByRole('button', { name: 'Post' }))
    await settle()
    expect(onPostComment).toHaveBeenCalledWith('Coolant was low')
  })

  it('a task with notes reads their count on the pill', async () => {
    renderFresh({ events: [ev({ event_type: 'comment', created_at: '2026-11-16T15:00:00Z', body: 'one' }), ev({ event_type: 'comment', created_at: '2026-11-16T15:05:00Z', body: 'two' })] })
    await settle()
    expect(screen.getByRole('button', { name: '2 notes' })).toBeTruthy()
  })

  it('a done task is a struck line that says who hears, with no Waiting on review chip', async () => {
    renderFresh({ instance: { id: 'inst-1', completed_at: new Date().toISOString(), reviewed_at: null }, hearsName: 'Imani' })
    await settle()
    expect(screen.queryByText('Waiting on review')).toBeNull()
    const line = document.querySelector('[data-fresh-done]')
    expect(line?.textContent).toMatch(/^Done .+\. Imani hears it is done\.$/)
    expect(screen.getByRole('button', { name: 'Mark not done' })).toBeTruthy()
    expect(screen.getByText('Check the truck fluids').style.textDecoration).toBe('line-through')
  })

  it('a done task nobody is told about says only when', async () => {
    renderFresh({ instance: { id: 'inst-1', completed_at: new Date().toISOString(), reviewed_at: null } })
    await settle()
    expect(document.querySelector('[data-fresh-done]')?.textContent).toMatch(/^Done [^.]+\.$/)
  })

  it('a signed-off task names who signed it off', async () => {
    renderFresh({
      instance: { id: 'inst-1', completed_at: '2026-11-16T15:00:00Z', reviewed_at: '2026-11-16T16:00:00Z' },
      events: [ev({ event_type: 'accepted', created_at: '2026-11-16T16:00:00Z', actor_user_id: 'lead-1' })],
    })
    await settle()
    expect(document.querySelector('[data-fresh-done]')?.textContent).toContain('Signed off by Imani')
  })

  it('a task sent back keeps its amber callout with the reason', async () => {
    renderFresh({
      events: [ev({ event_type: 'reopened', created_at: '2026-11-16T15:00:00Z', actor_user_id: 'lead-1' }), ev({ event_type: 'comment', created_at: '2026-11-16T15:00:01Z', actor_user_id: 'lead-1', body: 'Washer fluid is still empty' })],
    })
    await settle()
    expect(screen.getByText(/Reopened by Imani/)).toBeTruthy()
    expect(screen.getByText(/Washer fluid is still empty/)).toBeTruthy()
  })

  it('the Next card: no tick box, one Mark done press 46px tall, the note pill in the row above it', async () => {
    const { onToggleComplete } = renderFresh({ lead: true })
    await settle()
    expect(document.querySelector('[data-fresh-lead]')).toBeTruthy()
    const done = screen.getAllByRole('button', { name: 'Mark done' })
    expect(done).toHaveLength(1)
    expect(done[0]!.hasAttribute('data-fresh-done-press')).toBe(true)
    expect(done[0]!.style.minHeight).toBe('46px')
    fireEvent.click(done[0]!)
    expect(onToggleComplete).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: '＋ Note' })).toBeTruthy()
  })

  it('the Next card of a task with a ring keeps the ring beside Mark done', async () => {
    const { onToggleComplete } = renderFresh({ lead: true, ring: true, onSetPercent: vi.fn().mockResolvedValue(true) })
    await settle()
    expect(screen.getByRole('button', { name: /Set where it stands/ })).toBeTruthy()
    fireEvent.click(document.querySelector('[data-fresh-done-press]') as HTMLElement)
    await settle()
    expect(onToggleComplete).toHaveBeenCalledTimes(1)
  })

  it('the parent\'s extras sit beside the note pill', async () => {
    renderFresh({ actions: <button type="button">Mute alerts</button> })
    await settle()
    const mute = screen.getByRole('button', { name: 'Mute alerts' })
    expect(mute.parentElement).toBe(screen.getByRole('button', { name: '＋ Note' }).parentElement)
  })

  it('an open task says who hears and that a photo is asked for, before the person starts', async () => {
    renderFresh({ hearsName: 'Imani', asksForPhoto: true })
    await settle()
    expect(document.querySelector('[data-fresh-before]')?.textContent).toBe('Imani hears when it is done. It asks for a photo at the finish.')
  })

  it('a task nobody hears and that asks for nothing says nothing before the start', async () => {
    renderFresh()
    await settle()
    expect(document.querySelector('[data-fresh-before]')).toBeNull()
  })

  it('📷 Photo sits beside the note pill once photos can be added, and opens the Add a photo sheet with a dead press', async () => {
    renderFresh({ onPhotoAdded: vi.fn() })
    await settle()
    const photo = screen.getByRole('button', { name: '📷 Photo' })
    expect(photo.parentElement).toBe(screen.getByRole('button', { name: '＋ Note' }).parentElement)
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(photo)
    const sheet = screen.getByRole('dialog', { name: 'Add a photo' })
    expect(sheet.textContent).toContain('Check the truck fluids')
    expect((screen.getByRole('button', { name: 'Add the photo' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('with no way to add a photo the press is not drawn', async () => {
    renderFresh()
    await settle()
    expect(screen.queryByRole('button', { name: '📷 Photo' })).toBeNull()
  })

  it('a task finished in this visit offers the photo and the note in words, once it is done', async () => {
    renderFresh({ instance: { id: 'inst-1', completed_at: new Date().toISOString(), reviewed_at: null }, hearsName: 'Imani', justDone: true })
    await settle()
    expect(document.querySelector('[data-fresh-just-done]')?.textContent).toBe('Add a photo or a note for Imani if it helps.')
  })

  it('a task finished before this visit keeps its done line alone', async () => {
    renderFresh({ instance: { id: 'inst-1', completed_at: new Date().toISOString(), reviewed_at: null }, hearsName: 'Imani' })
    await settle()
    expect(document.querySelector('[data-fresh-just-done]')).toBeNull()
  })
})
