// @vitest-environment jsdom
/**
 * The job window's Map tab (punch list #413, step 8): everything painted or kept for the job, on
 * one map, read only. A press on a dot opens its place and counts an open.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { PaintedMapAsk } from '../../lib/paintedMap/paintedMapDoor'

const io = vi.hoisted(() => ({
  maps: { ok: true, value: [] as unknown[] } as { ok: true; value: unknown[] } | { ok: false; error: string },
  kept: { ok: true, value: [] as unknown[] } as { ok: true; value: unknown[] } | { ok: false; error: string },
  asked: [] as unknown[],
  opened: [] as string[],
}))
vi.mock('../../lib/paintedMap/paintedMapIo', () => ({
  loadPaintedMapsFor: async (home: unknown) => {
    io.asked.push(home)
    return io.maps
  },
}))
vi.mock('../../lib/paintedMap/paintedAddressPlacesIo', () => ({
  loadAddressPlaceLists: async () => io.kept,
  notePaintedPlaceOpened: (id: string) => io.opened.push(id),
}))
const geo = vi.hoisted(() => ({ asked: 0 }))
vi.mock('../../hooks/useAddressGeocodeCoords', () => ({
  useAddressGeocodeCoords: (addresses: Array<{ key: string }>, enabled: boolean) => {
    if (enabled) geo.asked += 1
    return { coords: new Map(enabled ? addresses.map((a) => [a.key, { lat: 29.4, lng: -98.1 }] as const) : []), resolving: false }
  },
}))
/** The map, stood in for: it says what it draws, and each dot is a press. */
vi.mock('../paintedMap/PaintedMapCanvas', () => ({
  default: (props: { lines: Array<{ id: string; color?: string }>; places: Array<{ id: string; letter?: string; fromJob?: boolean }>; start?: { lat: number; lng: number } | null; onPlaceTap?: (id: string) => void; google?: unknown }) => (
    <div data-testid="canvas" data-lines={props.lines.map((l) => `${l.id}:${l.color ?? 'paint'}`).join(',')} data-start={props.start ? `${props.start.lat},${props.start.lng}` : 'none'} data-google={props.google ? 'asked' : 'no'}>
      {props.places.map((p) => (
        <button key={p.id} type="button" data-dashed={p.fromJob ? 'yes' : 'no'} onClick={() => props.onPlaceTap?.(p.id)}>
          dot {p.letter}
        </button>
      ))}
    </div>
  ),
}))

import { onPaintedMapAsk, paintedMapsChanged } from '../../lib/paintedMap/paintedMapDoor'
import JobWindowMapTab from './JobWindowMapTab'

const map = (id: string, jobList: boolean, createdAt: string, jobId = 'j1') => ({ id, name: jobList ? 'Places on this job' : 'The way in', words: '', jobId, developmentId: null, jobList, createdBy: 'u1', createdAt })
const line = (id: string, mapId: string) => ({ id, mapId, label: '', how: 'walked', points: [{ lat: 29.5, lng: -98.2 }, { lat: 29.501, lng: -98.2 }], poorParts: [], fixedByHand: false, lengthM: 30, marginM: 2, measuredFt: null, measuredHow: null, madeBy: 'u1', madeAt: '2026-11-21T15:00:00Z' })
const place = (id: string, mapId: string, name: string, setAt: string, more: Record<string, unknown> = {}) => ({ id, mapId, name, words: '', lat: 29.5, lng: -98.2, accuracyM: null, photoPath: null, kind: null, setBy: 'u1', setAt, ...more })
const JOB = [
  { map: map('list', true, '2026-11-18T15:00:00Z'), lines: [], places: [place('a', 'list', 'Meter', '2026-11-18T15:01:00Z'), place('b', 'list', 'Buried sewer line', '2026-11-18T15:02:00Z', { kind: 'buried_sewer', lineId: 'run' })] },
  { map: map('sewer', false, '2026-11-18T17:00:00Z'), lines: [line('run', 'sewer')], places: [] },
]
const EARLIER = [{ map: map('old', true, '2025-06-01T15:00:00Z', 'j0'), jobLabel: null, places: [{ ...place('o', 'old', 'Cleanout', '2025-06-01T15:01:00Z'), number: 1, letter: 'A' }] }]

const asks: PaintedMapAsk[] = []
let stop: (() => void) | null = null
afterEach(() => {
  cleanup()
  stop?.()
  stop = null
  asks.length = 0
  io.maps = { ok: true, value: [] }
  io.kept = { ok: true, value: [] }
  io.asked = []
  io.opened = []
  geo.asked = 0
})
const tab = () => document.querySelector('[data-job-map-tab]') as HTMLElement

describe('JobWindowMapTab', () => {
  it('draws the job’s lines and places and the ones an earlier job kept, on the old map', async () => {
    io.maps = { ok: true, value: JOB }
    io.kept = { ok: true, value: EARLIER }
    render(<JobWindowMapTab jobId="j1" developmentId="d1" address="1 Made Up Road" />)
    await waitFor(() => expect(tab().getAttribute('data-job-map-tab')).toBe('drawn'))
    expect(io.asked).toEqual([{ jobId: 'j1', developmentId: 'd1' }])
    const canvas = await screen.findByTestId('canvas')
    expect(canvas.getAttribute('data-lines')).toBe('run:#16a34a')
    expect(canvas.getAttribute('data-google')).toBe('no')
    expect([...canvas.querySelectorAll('button')].map((b) => `${b.textContent} ${b.getAttribute('data-dashed')}`)).toEqual(['dot A no', 'dot B no', 'dot A yes'])
    expect(document.querySelector('[data-job-map-summary]')?.textContent).toBe('1 painted map · 2 places on this job · 1 kept at this address · Press a dot to open its place.')
    // Lines and places frame themselves: the address is not looked up.
    expect(geo.asked).toBe(0)
    expect(canvas.getAttribute('data-start')).toBe('none')
  })

  it('a press on a dot opens its list on that place, and counts an open', async () => {
    stop = onPaintedMapAsk((a) => asks.push(a))
    io.maps = { ok: true, value: JOB }
    io.kept = { ok: true, value: EARLIER }
    render(<JobWindowMapTab jobId="j1" address="1 Made Up Road" />)
    const canvas = await screen.findByTestId('canvas')
    await waitFor(() => expect(canvas.querySelectorAll('button')).toHaveLength(3))
    fireEvent.click(canvas.querySelectorAll('button')[1]!)
    fireEvent.click(canvas.querySelectorAll('button')[2]!)
    expect(io.opened).toEqual(['b', 'o'])
    expect(asks).toEqual([
      { kind: 'open', mapId: 'list', address: '1 Made Up Road', place: 'b' },
      { kind: 'open', mapId: 'old', address: '1 Made Up Road', place: 'o' },
    ])
  })

  it('with nothing on it, says what fills it and opens on the job’s address', async () => {
    render(<JobWindowMapTab jobId="j1" address="1 Made Up Road" />)
    await waitFor(() => expect(tab().getAttribute('data-job-map-tab')).toBe('empty'))
    expect(document.querySelector('[data-job-map-none]')?.textContent).toBe('Nothing is on this job’s map yet. Press Photo of a spot under the address to set the first place.')
    expect(document.querySelector('[data-job-map-summary]')).toBeNull()
    const canvas = await screen.findByTestId('canvas')
    await waitFor(() => expect(canvas.getAttribute('data-start')).toBe('29.4,-98.1'))
  })

  it('reads again when a painted map changed', async () => {
    render(<JobWindowMapTab jobId="j1" />)
    await waitFor(() => expect(io.asked).toHaveLength(1))
    io.maps = { ok: true, value: JOB }
    paintedMapsChanged()
    await waitFor(() => expect(tab().getAttribute('data-job-map-tab')).toBe('drawn'))
    expect(io.asked).toHaveLength(2)
  })

  it('says why the read failed and offers another try', async () => {
    io.maps = { ok: false, error: 'No signal.' }
    render(<JobWindowMapTab jobId="j1" />)
    expect((await screen.findByRole('alert')).textContent).toContain('The map did not load. No signal.')
    io.maps = { ok: true, value: JOB }
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(tab().getAttribute('data-job-map-tab')).toBe('drawn')
  })

  it('still draws the job’s own map when the read of the address fails', async () => {
    io.maps = { ok: true, value: JOB }
    io.kept = { ok: false, error: 'No signal.' }
    render(<JobWindowMapTab jobId="j1" />)
    await waitFor(() => expect(tab().getAttribute('data-job-map-tab')).toBe('drawn'))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(document.querySelector('[data-job-map-summary]')?.textContent).toBe('1 painted map · 2 places on this job · Press a dot to open its place.')
  })
})
