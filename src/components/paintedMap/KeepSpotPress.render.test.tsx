// @vitest-environment jsdom
/**
 * ＋ Keep this spot on the job (punch list #413, step 2): the press on a photo that is being added
 * anyway. One press reads the phone, hands the photo on the screen to the job's list of places and
 * opens the place sheet. Once the place is saved the press says so and goes quiet.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

type Spot = { file: File; reading: Promise<unknown>; takenMs: number | null; onKept?: () => void }
const io = vi.hoisted(() => ({
  reads: 0,
  opened: [] as Array<{ job: unknown; spot: Spot }>,
  answer: { ok: true } as { ok: true } | { ok: false; error: string },
  previews: [] as Array<{ url: string; takenAt: string | null | undefined }>,
  fileFails: false,
}))
vi.mock('../../lib/paintedMap/paintedSpotIo', () => ({
  readSpotNow: async () => {
    io.reads += 1
    return { ok: true, fix: { lat: 29.5, lng: -98.2, accuracyM: 6 } }
  },
  spotFileFromPreview: async (url: string, takenAt: string | null | undefined) => {
    io.previews.push({ url, takenAt })
    if (io.fileFails) throw new Error('The photo is gone from this phone.')
    return new File(['x'], 'spot.jpg', { type: 'image/jpeg', lastModified: takenAt ? Date.parse(takenAt) : 1_800_000_000_000 })
  },
  openSpotOnJob: async (job: unknown, spot: Spot) => {
    io.opened.push({ job, spot })
    return io.answer
  },
}))

import { KeepSpotPress } from './KeepSpotPress'

const JOB = { jobId: 'j1', label: 'ZZ Test 4127', address: '418 Made Up Run' }
const wrap = () => document.querySelector('[data-keep-spot]') as HTMLElement
const press = () => wrap().querySelector('button') as HTMLButtonElement

afterEach(() => {
  cleanup()
  io.reads = 0
  io.opened = []
  io.answer = { ok: true }
  io.previews = []
  io.fileFails = false
})

describe('KeepSpotPress', () => {
  it('is one press, 48 px tall and the width it is given', () => {
    render(<KeepSpotPress job={JOB} previewUrl="blob:one" />)
    expect(press().textContent).toBe('＋ Keep this spot on the job')
    expect(press().style.minHeight).toBe('48px')
    expect(press().style.width).toBe('100%')
    expect(wrap().getAttribute('data-keep-spot')).toBe('ready')
  })

  it('reads the phone once and opens the job’s places with the photo on the screen and its own time', async () => {
    render(<KeepSpotPress job={JOB} previewUrl="blob:one" takenAt="2026-11-21T18:00:00.000Z" />)
    fireEvent.click(press())
    await waitFor(() => expect(io.opened).toHaveLength(1))
    expect(io.reads).toBe(1)
    expect(io.previews).toEqual([{ url: 'blob:one', takenAt: '2026-11-21T18:00:00.000Z' }])
    expect(io.opened[0]!.job).toEqual(JOB)
    expect(io.opened[0]!.spot.file.name).toBe('spot.jpg')
    expect(io.opened[0]!.spot.takenMs).toBe(Date.parse('2026-11-21T18:00:00.000Z'))
    expect(await io.opened[0]!.spot.reading).toEqual({ ok: true, fix: { lat: 29.5, lng: -98.2, accuracyM: 6 } })
    await waitFor(() => expect(wrap().getAttribute('data-keep-spot')).toBe('ready'))
  })

  it('says the place is kept once it is saved, and takes no second press', async () => {
    render(<KeepSpotPress job={JOB} previewUrl="blob:one" />)
    fireEvent.click(press())
    await waitFor(() => expect(io.opened).toHaveLength(1))
    act(() => io.opened[0]!.spot.onKept?.())
    expect(press().textContent).toBe('✓ Kept on this job')
    expect(press().disabled).toBe(true)
    expect(wrap().getAttribute('data-keep-spot')).toBe('kept')
    fireEvent.click(press())
    expect(io.opened).toHaveLength(1)
  })

  it('says why when the job’s places could not be opened, and can be pressed again', async () => {
    io.answer = { ok: false, error: 'No signal. The map did not load.' }
    render(<KeepSpotPress job={JOB} previewUrl="blob:one" />)
    fireEvent.click(press())
    expect((await screen.findByRole('alert')).textContent).toBe('No signal. The map did not load.')
    expect(press().disabled).toBe(false)
    io.answer = { ok: true }
    fireEvent.click(press())
    await waitFor(() => expect(io.opened).toHaveLength(2))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })

  it('says why when the photo could not be read back', async () => {
    io.fileFails = true
    render(<KeepSpotPress job={JOB} previewUrl="blob:gone" />)
    fireEvent.click(press())
    expect((await screen.findByRole('alert')).textContent).toBe('The photo is gone from this phone.')
    expect(io.opened).toHaveLength(0)
  })

  it('waits while the phone still reads the photo', () => {
    render(<KeepSpotPress job={JOB} previewUrl="blob:one" waiting />)
    expect(press().disabled).toBe(true)
    fireEvent.click(press())
    expect(io.reads).toBe(0)
  })

  it('under a small tile says it in three words, still 44 px tall, and names the whole act to a screen reader', async () => {
    render(<KeepSpotPress compact job={JOB} previewUrl="blob:one" />)
    expect(press().textContent).toBe('Keep this spot')
    expect(press().getAttribute('aria-label')).toBe('Keep this spot on the job')
    expect(press().style.minHeight).toBe('44px')
    fireEvent.click(press())
    await waitFor(() => expect(io.opened).toHaveLength(1))
    act(() => io.opened[0]!.spot.onKept?.())
    expect(press().textContent).toBe('✓ Kept')
  })

  it('does not hand its press to the row it sits in', () => {
    let rowPresses = 0
    render(
      <div onClick={() => (rowPresses += 1)}>
        <KeepSpotPress job={JOB} previewUrl="blob:one" />
      </div>,
    )
    fireEvent.click(press())
    expect(rowPresses).toBe(0)
  })
})
