// @vitest-environment jsdom
/**
 * The photo sheet (punch list #313), mounted the way the dev server mounts it, with every effect run twice: a
 * chosen file lands in the ring and lights Save the photo, and the save hands back the new file with its place.
 * A flag that was only ever cleared on unmount once dropped the chosen photo without a word; this holds it.
 */
import { StrictMode } from 'react'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cardWordsFor } from '../../lib/brandKit/cardWords'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { PhotoRingSheet } from './PhotoRingSheet'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../lib/materials/photoShrink', () => ({
  shrinkPhoto: vi.fn(async (file: File) => ({ blob: new Blob([file.name], { type: 'image/jpeg' }), width: 400, height: 600, shrunk: true })),
}))
vi.mock('../../lib/brandKit/cardIo', async (real) => ({
  ...(await real<typeof import('../../lib/brandKit/cardIo')>()),
  readPicture: vi.fn(async () => ({ href: 'data:image/jpeg;base64,AAAA', w: 400, h: 600 })),
}))

const W = cardWordsFor(null)
const stageImg = () => document.querySelector('[data-photo-ring-stage] img')
const fileBox = () => document.querySelector('input[type=file]:not([capture])') as HTMLInputElement

afterEach(cleanup)

describe('PhotoRingSheet', () => {
  it('puts a chosen photo in the ring and saves it with its place, even when its effects run twice', async () => {
    const onSave = vi.fn(async () => undefined)
    renderWithProviders(
      <StrictMode>
        <PhotoRingSheet words={W} photo={null} crop={{ fx: 0.5, fy: 0.4, zoom: 1 }} onClose={() => undefined} onSave={onSave} />
      </StrictMode>,
    )
    const save = screen.getByRole('button', { name: 'Save the photo' })
    expect(save).toHaveProperty('disabled', true)
    expect(stageImg()).toBeNull()
    fireEvent.change(fileBox(), { target: { files: [new File(['x'], 'me.jpg', { type: 'image/jpeg' })] } })
    await waitFor(() => expect(stageImg()).not.toBeNull())
    expect(save).toHaveProperty('disabled', false)
    fireEvent.click(save)
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    const [blob, crop] = onSave.mock.calls[0] as unknown as [Blob, { fx: number; fy: number; zoom: number }]
    expect(blob).toBeInstanceOf(Blob)
    expect(crop.zoom).toBe(1)
    expect(crop.fx).toBeCloseTo(0.5, 6)
  })

  it('lights Save the photo only once the photo on file is moved', async () => {
    const onSave = vi.fn(async () => undefined)
    renderWithProviders(<PhotoRingSheet words={W} photo={{ href: 'data:image/jpeg;base64,AAAA', w: 400, h: 600 }} crop={{ fx: 0.5, fy: 0.4, zoom: 1 }} onClose={() => undefined} onSave={onSave} />)
    const save = screen.getByRole('button', { name: 'Save the photo' })
    expect(stageImg()).not.toBeNull()
    expect(save).toHaveProperty('disabled', true)
    fireEvent.change(screen.getByRole('slider'), { target: { value: '2' } })
    expect(save).toHaveProperty('disabled', false)
    fireEvent.click(save)
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(null, expect.objectContaining({ zoom: 2 })))
  })

  it('says why when the save is refused', async () => {
    const onSave = vi.fn(async () => {
      throw new Error('The photo was not saved. You may not have leave to change this account.')
    })
    renderWithProviders(<PhotoRingSheet words={W} photo={{ href: 'data:image/jpeg;base64,AAAA', w: 400, h: 600 }} crop={{ fx: 0.5, fy: 0.4, zoom: 1 }} onClose={() => undefined} onSave={onSave} />)
    fireEvent.change(screen.getByRole('slider'), { target: { value: '1.5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save the photo' }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain('You may not have leave')
  })
})
