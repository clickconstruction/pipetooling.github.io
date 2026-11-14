// @vitest-environment jsdom
/**
 * The painted maps of a job, as lines under its address (punch list #345, PR 2). A job with none
 * shows one quiet press. A map shows as a line that opens it, a development's map says where it
 * is from, and a read that fails says why and offers another try.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { PaintedMapWhole } from '../../lib/paintedMap/paintedMapIo'
import type { PaintedMapAsk } from '../../lib/paintedMap/paintedMapDoor'

const io = vi.hoisted(() => ({ answer: { ok: true as const, value: [] as unknown[] } as { ok: true; value: unknown[] } | { ok: false; error: string }, calls: 0, asked: [] as unknown[] }))
vi.mock('../../lib/paintedMap/paintedMapIo', () => ({
  loadPaintedMapsFor: async (home: unknown) => {
    io.calls += 1
    io.asked.push(home)
    return io.answer
  },
}))

import { onPaintedMapAsk, paintedMapsChanged } from '../../lib/paintedMap/paintedMapDoor'
import { DevelopmentPaintedMapsStrip, JobPaintedMapsStrip } from './JobPaintedMapsStrip'

const whole = (id: string, name: string, home: { jobId?: string; developmentId?: string }, lengthM: number, placeCount: number): PaintedMapWhole => ({
  map: { id, name, words: '', jobId: home.jobId ?? null, developmentId: home.developmentId ?? null, createdBy: 'u1', createdAt: `2026-11-13T15:0${id.length}:00Z` },
  lines: lengthM > 0 ? [{ id: `${id}-l`, mapId: id, label: '', how: 'drawn', points: [{ lat: 29.5, lng: -98.2 }, { lat: 29.501, lng: -98.2 }], poorParts: [], fixedByHand: false, lengthM, marginM: 2, measuredFt: null, measuredHow: null, madeBy: 'u1', madeAt: 'x' }] : [],
  places: Array.from({ length: placeCount }, (_, i) => ({ id: `${id}-p${i}`, mapId: id, name: 'Gate', words: '', lat: 29.5, lng: -98.2, accuracyM: null, photoPath: null, setBy: 'u1', setAt: `2026-11-13T15:0${i}:00Z` })),
})

const asks: PaintedMapAsk[] = []
let stop: (() => void) | null = null
const listen = () => {
  stop = onPaintedMapAsk((a) => asks.push(a))
}

afterEach(() => {
  cleanup()
  stop?.()
  stop = null
  asks.length = 0
  io.answer = { ok: true, value: [] }
  io.calls = 0
  io.asked = []
})

describe('JobPaintedMapsStrip', () => {
  it('shows one quiet press on a job with no painted map, and starts one for that job', async () => {
    listen()
    render(<JobPaintedMapsStrip jobId="j1" developmentId="d1" jobLabel="Lot 14" developmentLabel="Juniper Ridge" address="1 Made Up Road" />)
    await waitFor(() => expect(io.calls).toBe(1))
    expect(document.querySelectorAll('[data-painted-map-line]')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: '＋ Paint a map' }))
    expect(asks).toEqual([{ kind: 'start', home: { jobId: 'j1', developmentId: 'd1', label: 'Lot 14', developmentLabel: 'Juniper Ridge', address: '1 Made Up Road' } }])
  })

  it('draws a line for each map with its length and places, and opens the one pressed', async () => {
    listen()
    io.answer = { ok: true, value: [whole('m1', 'The way in for deliveries', { jobId: 'j1' }, 253, 3)] }
    render(<JobPaintedMapsStrip jobId="j1" address="1 Made Up Road" />)
    const line = await screen.findByRole('button', { name: /The way in for deliveries/ })
    expect(line.textContent).toContain('about 830 ft · 3 places')
    fireEvent.click(line)
    expect(asks).toEqual([{ kind: 'open', mapId: 'm1', address: '1 Made Up Road' }])
  })

  it('says a development\'s map is from the development, after the job\'s own', async () => {
    io.answer = { ok: true, value: [whole('dv', 'Truck route', { developmentId: 'd1' }, 500, 0), whole('m1', 'Side door', { jobId: 'j1' }, 0, 1)] }
    render(<JobPaintedMapsStrip jobId="j1" developmentId="d1" developmentLabel="Juniper Ridge" />)
    await screen.findByRole('button', { name: /Truck route/ })
    const lines = [...document.querySelectorAll('[data-painted-map-line]')].map((e) => e.textContent)
    expect(lines[0]).toContain('Side door')
    expect(lines[0]).toContain('1 place')
    expect(lines[1]).toContain('Truck route')
    expect(lines[1]).toContain('from Juniper Ridge')
  })

  it('reads again when a map was made or changed', async () => {
    render(<JobPaintedMapsStrip jobId="j1" />)
    await waitFor(() => expect(io.calls).toBe(1))
    io.answer = { ok: true, value: [whole('m1', 'New map', { jobId: 'j1' }, 100, 0)] }
    paintedMapsChanged()
    await screen.findByRole('button', { name: /New map/ })
    expect(io.calls).toBe(2)
  })

  it('says why a read failed, keeps the press, and tries again on a press', async () => {
    io.answer = { ok: false, error: 'permission denied for table painted_maps' }
    render(<JobPaintedMapsStrip jobId="j1" />)
    expect((await screen.findByRole('status')).textContent).toContain('The painted maps did not load: permission denied for table painted_maps')
    expect(screen.getByRole('button', { name: '＋ Paint a map' })).toBeTruthy()
    io.answer = { ok: true, value: [] }
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
  })
})

describe('JobPaintedMapsStrip, the maps alone', () => {
  it('draws nothing at all for a job with no painted map', async () => {
    const r = render(<JobPaintedMapsStrip jobId="j1" only="maps" />)
    await waitFor(() => expect(io.calls).toBe(1))
    expect(r.container.textContent).toBe('')
  })

  it('shows the maps and no press to paint one', async () => {
    listen()
    io.answer = { ok: true, value: [whole('m1', 'The way in', { jobId: 'j1' }, 253, 1)] }
    render(<JobPaintedMapsStrip jobId="j1" only="maps" />)
    fireEvent.click(await screen.findByRole('button', { name: /The way in/ }))
    expect(screen.getByText('Painted for this job')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '＋ Paint a map' })).toBeNull()
    expect(asks).toEqual([{ kind: 'open', mapId: 'm1', address: null }])
  })

  it('stays quiet when the read fails: the sheet it sits on is about something else', async () => {
    io.answer = { ok: false, error: 'no signal' }
    const r = render(<JobPaintedMapsStrip jobId="j1" only="maps" />)
    await waitFor(() => expect(io.calls).toBe(1))
    expect(r.container.textContent).toBe('')
  })
})

describe('DevelopmentPaintedMapsStrip', () => {
  const JOBS = [
    { id: 'j1', label: 'Lot 14' },
    { id: 'j2', label: 'Lot 15' },
  ]

  it('reads the site\'s maps and its lots\' maps in one ask', async () => {
    render(<DevelopmentPaintedMapsStrip developmentId="d1" developmentLabel="Juniper Ridge" jobs={JOBS} />)
    await waitFor(() => expect(io.calls).toBe(1))
    expect(io.asked[0]).toEqual({ developmentId: 'd1', jobIds: ['j1', 'j2'] })
  })

  it('lists the site\'s own maps first and names the lot on a lot\'s map', async () => {
    io.answer = { ok: true, value: [whole('lot', 'Side door', { jobId: 'j2' }, 0, 1), whole('site', 'Truck route', { developmentId: 'd1' }, 500, 0)] }
    render(<DevelopmentPaintedMapsStrip developmentId="d1" developmentLabel="Juniper Ridge" jobs={JOBS} />)
    await screen.findByRole('button', { name: /Truck route/ })
    const lines = [...document.querySelectorAll('[data-painted-map-line]')].map((e) => e.textContent ?? '')
    expect(lines[0]).toContain('Truck route')
    expect(lines[0]).not.toContain('Lot')
    expect(lines[1]).toContain('Side door')
    expect(lines[1]).toContain('Lot 15 · 1 place')
  })

  it('starts a map for the whole development', async () => {
    listen()
    render(<DevelopmentPaintedMapsStrip developmentId="d1" developmentLabel="Juniper Ridge" jobs={JOBS} address="1 Made Up Road" />)
    await waitFor(() => expect(io.calls).toBe(1))
    fireEvent.click(screen.getByRole('button', { name: '＋ Paint a map' }))
    expect(asks).toEqual([{ kind: 'start', home: { developmentId: 'd1', developmentLabel: 'Juniper Ridge', address: '1 Made Up Road' } }])
  })
})
