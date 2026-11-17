// @vitest-environment jsdom
/**
 * The card's 📷 Photo press (punch list #369, step B2): a photo at any time. On an open card the shot goes as a
 * `progress` photo at where the card stands, on a done card as a `finish` photo. It finishes nothing and sets no percent.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ChecklistInstanceCard } from './ChecklistInstanceCard'

vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => false }))
vi.mock('../../lib/getCurrentUserName', () => ({ getCurrentUserName: async () => 'Theo' }))
vi.mock('../../lib/impersonationSession', () => ({ isImpersonationSessionActive: () => false }))
vi.mock('../../lib/photos/reportPhotosIo', () => ({ loadReportPhotoSize: async () => 'medium' }))
vi.mock('../../lib/photos/shrink', () => ({
  shrinkReportPhoto: async (file: File) => ({ blob: new Blob([new Uint8Array(4)], { type: 'image/jpeg' }), width: 1600, height: 1200, shrunk: true, originalBytes: file.size }),
}))

const sendTaskPhoto = vi.fn()
vi.mock('../../lib/photos/taskPhotosIo', () => ({
  sendTaskPhoto: (...args: unknown[]) => sendTaskPhoto(...args),
  loadTaskPhotos: vi.fn().mockResolvedValue([]),
  taskPhotoPreviewUrls: vi.fn().mockResolvedValue(new Map()),
  attachPhotoToTick: vi.fn(),
}))

function renderFresh(over: Partial<Parameters<typeof ChecklistInstanceCard>[0]> = {}) {
  const onToggleComplete = vi.fn()
  const onSetPercent = vi.fn().mockResolvedValue(true)
  const onPhotoAdded = vi.fn()
  render(
    <ul>
      <ChecklistInstanceCard
        instance={{ id: 'inst-1', completed_at: null, reviewed_at: null, percent_complete: 0 }}
        title="Check the truck fluids"
        events={[]}
        nameById={{ 'me-1': 'Theo' }}
        currentUserId="me-1"
        onToggleComplete={onToggleComplete}
        onPostComment={vi.fn().mockResolvedValue(true)}
        onSetPercent={onSetPercent}
        onPhotoAdded={onPhotoAdded}
        variant="fresh"
        {...over}
      />
    </ul>,
  )
  return { onToggleComplete, onSetPercent, onPhotoAdded }
}

async function addPhoto() {
  fireEvent.click(screen.getByRole('button', { name: '📷 Photo' }))
  const input = screen.getByTestId('task-photo-input') as HTMLInputElement
  fireEvent.change(input, { target: { files: [new File([new Uint8Array(8)], 'shot.jpg', { type: 'image/jpeg' })] } })
  const press = await screen.findByRole('button', { name: 'Add the photo' })
  await waitFor(() => expect((press as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(press)
}

beforeEach(() => {
  sendTaskPhoto.mockReset()
  sendTaskPhoto.mockImplementation(async (a: { id: string }) => ({ id: a.id }))
  // jsdom has no object URLs; the tile's preview asks for one.
  ;(URL as unknown as { createObjectURL: () => string }).createObjectURL = () => 'blob:shot'
  ;(URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => {}
})

describe('the card’s 📷 Photo press', () => {
  it('on an open task sends a progress photo, tells the strip, and finishes nothing', async () => {
    const { onToggleComplete, onSetPercent, onPhotoAdded } = renderFresh()
    await addPhoto()
    await waitFor(() => expect(sendTaskPhoto).toHaveBeenCalledTimes(1))
    expect(sendTaskPhoto.mock.calls[0]![0]).toMatchObject({ instanceId: 'inst-1', kind: 'progress', percentAt: 0, criterionId: null, byUserId: 'me-1' })
    await waitFor(() => expect(onPhotoAdded).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(onToggleComplete).not.toHaveBeenCalled()
    expect(onSetPercent).not.toHaveBeenCalled()
  })

  it('on a done task sends a finish photo', async () => {
    renderFresh({ instance: { id: 'inst-1', completed_at: new Date().toISOString(), reviewed_at: null, percent_complete: 100 } })
    await addPhoto()
    await waitFor(() => expect(sendTaskPhoto).toHaveBeenCalledTimes(1))
    expect(sendTaskPhoto.mock.calls[0]![0]).toMatchObject({ kind: 'finish', percentAt: null })
  })

  it('a send that is refused keeps the sheet open with the reason', async () => {
    sendTaskPhoto.mockRejectedValue(new Error('The bucket said no.'))
    renderFresh()
    await addPhoto()
    await screen.findByText('The bucket said no.')
    expect(screen.getByRole('dialog', { name: 'Add a photo' })).toBeTruthy()
  })
})
