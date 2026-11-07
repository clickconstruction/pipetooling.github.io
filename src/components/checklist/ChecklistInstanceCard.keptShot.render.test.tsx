// @vitest-environment jsdom
/**
 * Task cards (#273, v2.6628): a shot taken on the % sheet with no signal. The send is lost to the signal, so the shot is
 * kept on the phone and a `task-photo` press goes into the outbox with the shot's facts; the percent is tried as it is
 * today. When the percent lands the sheet closes; when it does not, the sheet stays open, the tile reads *Kept on the
 * phone*, and a second Set sends the shot no more. A refusal that is not the signal keeps the sheet with its reason.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ChecklistInstanceCard } from './ChecklistInstanceCard'

vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => false }))
vi.mock('../../lib/getCurrentUserName', () => ({ getCurrentUserName: async () => 'Mateo Ruiz' }))
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

const keep = vi.fn().mockResolvedValue(true)
const drop = vi.fn().mockResolvedValue(undefined)
vi.mock('../../lib/offline/keptPhotos', () => ({ keptPhotos: { keep: (...a: unknown[]) => keep(...a), drop: (...a: unknown[]) => drop(...a) } }))

const press = vi.fn()
vi.mock('../../lib/offline/pressThroughOutbox', () => ({ pressThroughOutbox: (...a: unknown[]) => press(...a) }))

/** What `sendTaskPhoto` throws when the phone has no signal: its own class by name, with the network kind. */
function lostSignal(): Error {
  return Object.assign(new Error('The phone has no signal.'), { name: 'PhotoSendError', kind: 'network' })
}

function renderCard(onSetPercent: (percent: number, words: string) => Promise<boolean>) {
  render(
    <ul>
      <ChecklistInstanceCard
        instance={{ id: 'inst-1', completed_at: null, reviewed_at: null, percent_complete: 50 }}
        title="Put the plumbing tools in a neat home"
        events={[]}
        nameById={{ 'me-1': 'Mateo Ruiz' }}
        currentUserId="me-1"
        onToggleComplete={vi.fn()}
        onPostComment={vi.fn().mockResolvedValue(true)}
        lines={[]}
        ring
        onSetPercent={onSetPercent}
      />
    </ul>,
  )
}

/** Open the % sheet, put a shot on its tile, pick 75. */
async function openSheetWithShot() {
  fireEvent.click(screen.getByRole('button', { name: /Set where it stands/ }))
  const input = screen.getByTestId('task-photo-input') as HTMLInputElement
  const file = new File([new Uint8Array(10)], 'shot.jpg', { type: 'image/jpeg', lastModified: Date.parse('2026-11-07T20:41:00Z') })
  fireEvent.change(input, { target: { files: [file] } })
  await waitFor(() => expect(screen.getByText('📷 Photo taken')).toBeTruthy())
  fireEvent.click(screen.getByRole('button', { name: '75' }))
}

describe('a task shot with no signal', () => {
  beforeEach(() => {
    sendTaskPhoto.mockReset()
    keep.mockClear()
    drop.mockClear()
    press.mockReset()
    ;(URL as unknown as { createObjectURL: () => string }).createObjectURL = () => 'blob:shot'
    ;(URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => undefined
  })

  it('keeps the shot and queues a task-photo press with its facts, and the percent that lands closes the sheet', async () => {
    sendTaskPhoto.mockRejectedValue(lostSignal())
    press.mockResolvedValue({ kind: 'queued', press: { id: 'p1' } })
    const onSetPercent = vi.fn().mockResolvedValue(true)
    renderCard(onSetPercent)
    await openSheetWithShot()
    fireEvent.click(screen.getByRole('button', { name: 'Set 75%' }))
    await waitFor(() => expect(press).toHaveBeenCalledTimes(1))
    const [args, io] = press.mock.calls[0] as [Record<string, unknown>, Record<string, unknown>]
    expect(io).toEqual({ forceQueue: true })
    expect(args).toMatchObject({ kind: 'task-photo', userId: 'me-1', about: 'Put the plumbing tools in a neat home', door: '/checklist' })
    const payload = args.payload as { instanceId: string; photos: Array<Record<string, unknown>> }
    expect(payload.instanceId).toBe('inst-1')
    expect(payload.photos).toHaveLength(1)
    expect(payload.photos[0]).toMatchObject({ sent: false, kind: 'progress', percentAt: 75, criterionId: null, lineBody: null, byName: 'Mateo Ruiz', bytes: 4, originalBytes: 10, width: 1600, height: 1200, takenAt: '2026-11-07T20:41:00.000Z' })
    // The bytes were kept under the same id the press carries, and the live send was tried first with that id.
    expect(keep).toHaveBeenCalledWith(payload.photos[0]!.id, expect.any(Blob))
    expect(sendTaskPhoto.mock.calls[0]![0]).toMatchObject({ id: payload.photos[0]!.id, instanceId: 'inst-1', kind: 'progress', percentAt: 75 })
    await waitFor(() => expect(onSetPercent).toHaveBeenCalledWith(75, ''))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Where does it stand?' })).toBeNull())
  })

  it('when the percent does not land either, the sheet stays open with the tile reading Kept on the phone, and a second Set sends the shot no more', async () => {
    sendTaskPhoto.mockRejectedValue(lostSignal())
    press.mockResolvedValue({ kind: 'queued', press: { id: 'p1' } })
    const onSetPercent = vi.fn().mockResolvedValue(false)
    renderCard(onSetPercent)
    await openSheetWithShot()
    fireEvent.click(screen.getByRole('button', { name: 'Set 75%' }))
    await waitFor(() => expect(screen.getByTestId('task-photo-kept')).toBeTruthy())
    expect(screen.getByText('📷 Kept on the phone')).toBeTruthy()
    expect(screen.getByText('It goes to the card when the signal is back.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Where does it stand?' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Set 75%' }))
    await waitFor(() => expect(onSetPercent).toHaveBeenCalledTimes(2))
    expect(sendTaskPhoto).toHaveBeenCalledTimes(1)
    expect(press).toHaveBeenCalledTimes(1)
  })

  it('a refusal that is not the signal keeps nothing and shows its reason', async () => {
    sendTaskPhoto.mockRejectedValue(Object.assign(new Error('The photo is over 2 MB.'), { name: 'PhotoSendError', kind: 'server' }))
    const onSetPercent = vi.fn().mockResolvedValue(true)
    renderCard(onSetPercent)
    await openSheetWithShot()
    fireEvent.click(screen.getByRole('button', { name: 'Set 75%' }))
    await waitFor(() => expect(screen.getByText('The photo is over 2 MB.')).toBeTruthy())
    expect(keep).not.toHaveBeenCalled()
    expect(press).not.toHaveBeenCalled()
    expect(onSetPercent).not.toHaveBeenCalled()
    expect(screen.getByText('📷 Photo taken')).toBeTruthy()
  })

  it('a phone with nowhere to keep the bytes shows the signal’s reason and queues nothing', async () => {
    sendTaskPhoto.mockRejectedValue(lostSignal())
    keep.mockResolvedValueOnce(false)
    renderCard(vi.fn().mockResolvedValue(true))
    await openSheetWithShot()
    fireEvent.click(screen.getByRole('button', { name: 'Set 75%' }))
    await waitFor(() => expect(screen.getByText('The phone has no signal.')).toBeTruthy())
    expect(press).not.toHaveBeenCalled()
  })
})
