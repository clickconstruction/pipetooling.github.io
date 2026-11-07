// @vitest-environment jsdom
/**
 * Task cards (#273, PR 4b): the photo flow on the card. On a card that asks for a photo, the last line's tick opens the
 * finishing sheet instead of ticking; a typed reason frees Done, which posts the reason and ticks the line; Done on the
 * % sheet opens the finishing sheet too; a card that does not ask ticks at once; the strip draws the photos.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ChecklistInstanceCard } from './ChecklistInstanceCard'
import type { LineState } from '../../lib/taskCriteria'

vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => false }))
vi.mock('../../lib/getCurrentUserName', () => ({ getCurrentUserName: async () => 'Mateo' }))
vi.mock('../../lib/photos/taskPhotosIo', () => ({ sendTaskPhoto: vi.fn(), loadTaskPhotos: vi.fn().mockResolvedValue([]), taskPhotoPreviewUrls: vi.fn().mockResolvedValue(new Map()), attachPhotoToTick: vi.fn() }))
vi.mock('../../lib/photos/reportPhotosIo', () => ({ loadReportPhotoSize: async () => 'medium' }))

const line = (id: string, body: string, checked: boolean): LineState => ({
  criterion: { id, checklist_item_id: 'item-1', roadmap_task_id: null, body, sort_index: 0 },
  checked,
  checkedAt: checked ? '2026-11-06T15:12:00Z' : null,
  checkedBy: checked ? 'me-1' : null,
  photoId: null,
})

function renderCard(overrides: Partial<Parameters<typeof ChecklistInstanceCard>[0]> = {}) {
  const onTickLine = vi.fn().mockResolvedValue(undefined)
  const onToggleComplete = vi.fn()
  const onPostComment = vi.fn().mockResolvedValue(true)
  render(
    <ul>
      <ChecklistInstanceCard
        instance={{ id: 'inst-1', completed_at: null, reviewed_at: null, percent_complete: 50 }}
        title="Put the plumbing tools in a neat home"
        events={[]}
        nameById={{ 'me-1': 'Mateo' }}
        currentUserId="me-1"
        onToggleComplete={onToggleComplete}
        onPostComment={onPostComment}
        lines={[line('c1', 'Pipe is racked by size', true), line('c2', 'Fittings are in labeled bins', false)]}
        onTickLine={onTickLine}
        ring
        onSetPercent={vi.fn().mockResolvedValue(true)}
        asksForPhoto
        {...overrides}
      />
    </ul>,
  )
  return { onTickLine, onToggleComplete, onPostComment }
}

describe('ChecklistInstanceCard photo flow', () => {
  it('the last line’s tick on a card that asks opens the finishing sheet, and a reason frees Done, which posts it and ticks', async () => {
    const { onTickLine, onPostComment } = renderCard()
    fireEvent.click(screen.getByRole('button', { name: 'Tick: Fittings are in labeled bins' }))
    expect(onTickLine).not.toHaveBeenCalled()
    const sheet = screen.getByRole('dialog', { name: 'Every line is ticked' })
    expect(sheet).toBeTruthy()
    const press = screen.getByRole('button', { name: 'Photo first' }) as HTMLButtonElement
    expect(press.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('No photo, here is why'), { target: { value: 'camera broke' } })
    fireEvent.click(screen.getByRole('button', { name: 'Done · 100%' }))
    await waitFor(() => expect(onPostComment).toHaveBeenCalledWith('No finishing photo: camera broke'))
    await waitFor(() => expect(onTickLine).toHaveBeenCalledWith('c2', true))
  })

  it('a tick that is not the last ticks at once', async () => {
    const { onTickLine } = renderCard({ lines: [line('c1', 'Pipe is racked by size', false), line('c2', 'Fittings are in labeled bins', false)] })
    fireEvent.click(screen.getByRole('button', { name: 'Tick: Pipe is racked by size' }))
    await waitFor(() => expect(onTickLine).toHaveBeenCalledWith('c1', true))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('Done on the % sheet of a card that asks opens the finishing sheet; on a card that does not, it finishes', async () => {
    const { onToggleComplete } = renderCard({ lines: [] })
    fireEvent.click(screen.getByRole('button', { name: /Set where it stands/ }))
    fireEvent.click(screen.getByRole('button', { name: '✓ Done' }))
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Finishing' })).toBeTruthy())
    expect(onToggleComplete).not.toHaveBeenCalled()
  })

  it('a card that does not ask ticks its last line at once', async () => {
    const { onTickLine } = renderCard({ asksForPhoto: false })
    fireEvent.click(screen.getByRole('button', { name: 'Tick: Fittings are in labeled bins' }))
    await waitFor(() => expect(onTickLine).toHaveBeenCalledWith('c2', true))
  })

  it('draws the photos as a strip with their standing', () => {
    renderCard({
      lines: [],
      photos: [
        { id: 'p1', instance_id: 'inst-1', kind: 'progress', percent_at: 50, criterion_id: null, caption: '50%', by_user_id: 'me-1', by_name: 'Mateo', taken_at: '2026-11-06T15:12:00Z', storage_path: 'inst-1/p1.jpg', drive_file_id: null, filed_at: null, fail_why: null, width: 1, height: 1, previewUrl: null },
      ],
    })
    expect(screen.getByTestId('task-photo-strip').textContent).toContain('1 photo')
    expect(screen.getByTitle(/50% · Mateo · .* · on its way/)).toBeTruthy()
  })
})
