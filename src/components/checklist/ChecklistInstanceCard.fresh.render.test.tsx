// @vitest-environment jsdom
/**
 * The `fresh` look of the task card (punch list #369): Checklist → Today in the New task window's language. A quiet
 * note pill in place of the 48px bar, a done task as one line that says who hears, and the Next card with its one
 * solid blue press.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ChecklistInstanceCard } from './ChecklistInstanceCard'
import type { ChecklistCardEvent } from '../../lib/checklistCardEvents'
import { settle } from '../../test/renderSmokeMocks'

const viewport = vi.hoisted(() => ({ phone: false }))
vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => viewport.phone }))
const openPaintedMap = vi.fn().mockReturnValue(true)
vi.mock('../../lib/paintedMap/paintedMapDoor', () => ({ openPaintedMap: (...a: unknown[]) => openPaintedMap(...a), paintPaintedMap: () => false }))
vi.mock('../../hooks/useTaskMapWhole', () => ({ useTaskMapWhole: () => ({ kind: 'none' }) }))

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
  afterEach(() => {
    viewport.phone = false
  })

  it('at a desk a row keeps its presses beside its words, in the box held to 55% (punch list #369)', async () => {
    renderFresh({ instance: { id: 'inst-1', completed_at: new Date().toISOString(), reviewed_at: null }, hearsName: 'Imani', onPhotoAdded: vi.fn(), actions: <button type="button">Follow-up</button> })
    await settle()
    const box = document.querySelector('[data-fresh-presses]') as HTMLElement
    expect(box.dataset.freshPresses).toBe('beside')
    expect(box.style.maxWidth).toBe('55%')
    // Beside: the box is in the same row as the words.
    expect(box.parentElement).toBe(screen.getByText('Check the truck fluids').parentElement?.parentElement)
  })

  it('on a phone a done row gives its words the width: the presses take a row of their own under them (punch list #369)', async () => {
    viewport.phone = true
    renderFresh({ instance: { id: 'inst-1', completed_at: new Date().toISOString(), reviewed_at: null }, hearsName: 'Imani', onPhotoAdded: vi.fn(), actions: <button type="button">Follow-up</button> })
    await settle()
    const boxes = document.querySelectorAll('[data-fresh-presses]')
    expect(boxes).toHaveLength(1)
    const box = boxes[0] as HTMLElement
    expect(box.dataset.freshPresses).toBe('under')
    expect(box.style.maxWidth).toBe('')
    // Under: the box follows the row that holds the tick and the words, and is not inside it.
    const wordsRow = screen.getByText('Check the truck fluids').parentElement?.parentElement as HTMLElement
    expect(wordsRow.contains(box)).toBe(false)
    expect(box.previousElementSibling).toBe(wordsRow)
    // The same presses, in the same order.
    expect([...box.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['＋ Note', '📷 Photo', 'Follow-up'])
    expect(document.querySelector('[data-fresh-done]')?.textContent).toMatch(/^Done .+\. Imani hears it is done\.$/)
    expect(wordsRow.contains(document.querySelector('[data-fresh-done]'))).toBe(true)
  })

  it('on a phone an open row that is not the Next card does the same, and the Next card is as it was', async () => {
    viewport.phone = true
    const { unmount } = renderFresh({ hearsName: 'Imani' })
    await settle()
    expect((document.querySelector('[data-fresh-presses]') as HTMLElement).dataset.freshPresses).toBe('under')
    unmount()
    renderFresh({ lead: true })
    await settle()
    const box = document.querySelector('[data-fresh-presses]') as HTMLElement
    expect(box.dataset.freshPresses).toBe('under')
    expect(box.style.marginTop).toBe('0.6rem')
  })

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

  it('a task that has a map wears a lit 🗺 Map press, which opens that map', async () => {
    renderFresh({ mapId: 'map-9' })
    await settle()
    const map = screen.getByRole('button', { name: '🗺 Map' })
    expect(map.style.fontWeight).toBe('700')
    fireEvent.click(map)
    expect(openPaintedMap).toHaveBeenCalledWith('map-9')
  })

  it('a place with a way in opens the way in, and a task with no map has no map press', async () => {
    openPaintedMap.mockClear()
    const { unmount } = renderFresh({ mapId: 'map-9', place: { lat: 29.55, lng: -98.28, name: 'Shop yard', accuracyM: null, setBy: null, setAt: null, mapId: 'way-1' } })
    await settle()
    fireEvent.click(screen.getByRole('button', { name: '🗺 Map' }))
    expect(openPaintedMap).toHaveBeenCalledWith('way-1')
    unmount()
    renderFresh()
    await settle()
    expect(screen.queryByRole('button', { name: '🗺 Map' })).toBeNull()
  })

  it('a task with no map offers an unlit 🗺 Map press once the person may add one, done or not', async () => {
    const { unmount } = renderFresh({ onMapAdded: vi.fn() })
    await settle()
    const map = screen.getByRole('button', { name: '🗺 Map' })
    expect(map.hasAttribute('data-doer-map')).toBe(true)
    expect(map.style.fontWeight).not.toBe('700')
    unmount()
    renderFresh({ onMapAdded: vi.fn(), instance: { id: 'inst-1', completed_at: new Date().toISOString(), reviewed_at: null } })
    await settle()
    expect(screen.getByRole('button', { name: '🗺 Map' })).toBeTruthy()
  })

  it('a task that has a map keeps its lit press, which opens the map and offers no new one', async () => {
    renderFresh({ onMapAdded: vi.fn(), mapId: 'map-9' })
    await settle()
    const map = screen.getByRole('button', { name: '🗺 Map' })
    expect(map.hasAttribute('data-fresh-map')).toBe(true)
  })

  it('a task closed as no longer applying says so and why, in place of Done', async () => {
    const at = new Date().toISOString()
    renderFresh({
      instance: { id: 'inst-1', completed_at: at, reviewed_at: null },
      hearsName: 'Imani',
      justDone: true,
      events: [ev({ event_type: 'completed', created_at: at }), ev({ event_type: 'dropped', created_at: at, body: 'Plans changed' })],
    })
    await settle()
    const line = document.querySelector('[data-fresh-dropped]')
    expect(line?.textContent).toMatch(/^Closed .+ as no longer applying\. Plans changed\.$/)
    expect(line?.textContent).not.toContain('hears it is done')
    expect(document.querySelector('[data-fresh-just-done]')).toBeNull()
  })

  it('a stuck task wears an amber Stuck line with what is in the way, until it is taken off', async () => {
    const { unmount } = renderFresh({ events: [ev({ event_type: 'stuck', created_at: '2026-11-16T15:00:00Z', body: 'Waiting on a part' })] })
    await settle()
    expect(document.querySelector('[data-fresh-stuck]')?.textContent).toBe('Stuck: Waiting on a part')
    unmount()
    renderFresh({ events: [ev({ event_type: 'stuck', created_at: '2026-11-16T15:00:00Z', body: 'Waiting on a part' }), ev({ event_type: 'unstuck', created_at: '2026-11-16T16:00:00Z' })] })
    await settle()
    expect(document.querySelector('[data-fresh-stuck]')).toBeNull()
  })
})
