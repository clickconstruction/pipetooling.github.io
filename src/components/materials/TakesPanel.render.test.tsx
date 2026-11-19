// @vitest-environment jsdom
/**
 * Render smoke for a job's takes (Take from a box, step 4): a card a take with its chip, the box as the person before
 * left it beside the box as found and the box after, a dashed square where a photo was skipped, and the office's
 * filters. Every name is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { PhotoNote } from '../../lib/materials/photo'
import type { TakeMovement } from '../../lib/materials/takeRun'
import { takesOf } from '../../lib/materials/takes'

const readBoxPhotoBytes = vi.fn()
vi.mock('../../lib/materials/boxPhotoBytesIo', () => ({ readBoxPhotoBytes: (...a: unknown[]) => readBoxPhotoBytes(...a) }))
vi.mock('../../lib/materials/onSiteStore', () => ({ updatePhoto: vi.fn() }))
vi.mock('../../lib/materials/boxPhotoShoot', () => ({ shootBoxPhoto: vi.fn() }))
vi.mock('../../lib/materials/photoUpload', () => ({ sendBoxPhoto: vi.fn() }))

import TakesPanel from './TakesPanel'

let seq = 0
const row = (over: Partial<TakeMovement>): TakeMovement => ({ id: `m${++seq}`, jobId: 'job', partId: null, partName: 'ZZ test elbow', manufacturer: null, quantity: 1, reason: 'used', fromContainerId: 'g12', toContainerId: null, note: '', byUserId: 'u1', byName: 'Mateo Ruiz', at: '2026-11-18T20:16:00Z', source: null, itemId: null, takeId: null, ...over })
const photo = (over: Partial<PhotoNote>): PhotoNote => ({ id: `p${++seq}`, jobId: 'job', containerId: 'g12', fileName: `${over.words ?? 'x'}.jpg`, byUserId: 'u1', byName: 'Mateo Ruiz', at: '2026-11-18T20:14:00Z', bytes: 1, width: 1, height: 1, status: 'filed', driveFileId: 'd', storagePath: null, kind: null, takeId: null, ...over })

const takes = takesOf(
  [row({ takeId: 'old', byName: 'Jordan Lee', at: '2026-11-12T15:00:00Z' }), row({ takeId: 'new', quantity: 2 }), row({ takeId: 'new', partName: 'ZZ test tee', quantity: 5 }), row({ takeId: 'short', fromContainerId: 'g31', at: '2026-11-17T15:00:00Z' })],
  [
    photo({ takeId: 'old', kind: 'after', byName: 'Jordan Lee', at: '2026-11-12T15:01:00Z', words: 'G12 after a take' }),
    photo({ takeId: 'new', kind: 'before', words: 'G12 as found' }),
    photo({ takeId: 'new', kind: 'after', at: '2026-11-18T20:17:00Z', words: 'G12 after a take' }),
    photo({ takeId: 'short', containerId: 'g31', kind: 'before', at: '2026-11-17T14:59:00Z', words: 'G31 as found' }),
  ],
)
const labelOf = (id: string) => id.toUpperCase()

beforeEach(() => {
  readBoxPhotoBytes.mockReset()
  readBoxPhotoBytes.mockImplementation(async (p: PhotoNote, size: string) => ({ url: `blob:${size}-${p.id}`, blob: null, source: 'drive' }))
  URL.revokeObjectURL = vi.fn()
})
afterEach(() => cleanup())

describe('TakesPanel', () => {
  it('draws a take with what was taken, its chip, and the three pictures side by side', async () => {
    renderWithProviders(<TakesPanel takes={takes} labelOf={labelOf} />)
    const cards = screen.getAllByTestId('take-card')
    expect(cards).toHaveLength(3)
    const card = cards[0]!
    expect(card.getAttribute('data-state')).toBe('whole')
    expect(card.textContent).toContain('G12 · Mateo Ruiz took 7')
    expect(card.textContent).toContain('Both photos')
    expect(card.textContent).toContain('2 × ZZ test elbow · 5 × ZZ test tee')
    expect(card.textContent).toContain('As left by Jordan Lee')
    await waitFor(() => expect(within(card).getAllByRole('img')).toHaveLength(3))
  })

  it('leaves a dashed square where a photo was skipped, and says which', () => {
    renderWithProviders(<TakesPanel takes={takes} labelOf={labelOf} />)
    const short = screen.getAllByTestId('take-card').find((c) => c.getAttribute('data-state') === 'no-after')!
    expect(short.textContent).toContain('G31 · Mateo Ruiz took 1')
    expect(within(short).getByTestId('take-tile-none').textContent).toBe('No photo after')
    // A box nobody took from before has no picture as left: two squares, not three.
    expect(short.textContent).not.toContain('As left by')
  })

  it('narrows to the takes with a photo missing, and says when a filter is empty', () => {
    renderWithProviders(<TakesPanel takes={takes} labelOf={labelOf} filters />)
    expect(screen.getByRole('button', { name: 'All takes · 3' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'A photo missing · 2' }))
    expect(screen.getAllByTestId('take-card').map((c) => c.getAttribute('data-state'))).toEqual(['no-after', 'no-before'])
    fireEvent.click(screen.getByRole('button', { name: 'Nothing marked · 0' }))
    expect(screen.queryAllByTestId('take-card')).toHaveLength(0)
    expect(screen.getByText('Nothing waiting on this filter.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'All takes' }))
    expect(screen.getAllByTestId('take-card')).toHaveLength(3)
  })

  it('shows the newest few with a press for the rest, and opens a picture whole', async () => {
    renderWithProviders(<TakesPanel takes={takes} labelOf={labelOf} limit={1} />)
    expect(screen.getAllByTestId('take-card')).toHaveLength(1)
    fireEvent.click(await screen.findByRole('button', { name: 'Open the photo of G12 as found' }))
    expect(await screen.findByRole('dialog', { name: 'Photo of G12 as found' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close the photo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Show all 3 takes' }))
    expect(screen.getAllByTestId('take-card')).toHaveLength(3)
  })

  it('says what fills it when a job has no take', () => {
    renderWithProviders(<TakesPanel takes={[]} labelOf={labelOf} filters />)
    expect(screen.getByText('Nothing taken with photos yet.')).toBeTruthy()
  })
})
