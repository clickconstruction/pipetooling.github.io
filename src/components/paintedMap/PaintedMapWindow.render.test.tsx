// @vitest-environment jsdom
/**
 * A painted map's window (punch list #345, PR 2). A new map is drawn by hand and saved with its
 * first line, and not before. A saved map lists its lines with an honest length, takes a measured
 * length typed in, and lets its maker or the office change it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { PaintedLine, PaintedMap } from '../../lib/paintedMap/paintedMap'
import type { PaintedMapWhole } from '../../lib/paintedMap/paintedMapIo'
import type { PaintedCanvasDraft } from './PaintedMapCanvas'

const auth = vi.hoisted(() => ({ value: { user: { id: 'me' } as { id: string } | null, role: 'helpers' as string } }))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => auth.value }))
vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => true }))
vi.mock('../../hooks/useModalStackEntry', () => ({ useModalStackEntry: () => () => true }))
const opened = vi.hoisted(() => [] as string[])
vi.mock('../../lib/openInExternalBrowser', () => ({ openInExternalBrowser: (url: string) => opened.push(url) }))
vi.mock('../../lib/materials/myLocation', () => ({ requestMyLocation: (ok: (p: unknown) => void) => ok({ lat: 29.6, lng: -98.3, accuracyM: 5 }) }))
/** The camera, stood in for: a test puts a shot here before the panel opens. */
const camera = vi.hoisted(() => ({ shot: null as null | { id: string; blob: Blob; previewUrl: string } }))
vi.mock('../../hooks/useTaskShot', () => ({ useTaskShot: () => ({ shot: camera.shot, shrinking: false, kept: false, error: null, pick: async () => {}, clear: () => {}, markKept: () => {} }) }))

const io = vi.hoisted(() => ({
  whole: null as unknown,
  calls: [] as Array<{ fn: string; args: unknown[] }>,
  refuse: null as string | null,
  refuseUpload: null as string | null,
}))
vi.mock('../../lib/paintedMap/paintedMapIo', () => {
  const landed = <T,>(value: T) => (io.refuse ? { ok: false as const, error: io.refuse } : { ok: true as const, value })
  const line = (id: string, mapId: string, draft: { how: string; points: unknown[]; marginM?: number | null }, by: string) => ({ id, mapId, label: '', how: draft.how, points: draft.points, poorParts: [], fixedByHand: false, lengthM: 150, marginM: draft.marginM ?? null, measuredFt: null, measuredHow: null, madeBy: by, madeAt: '2026-11-13T16:00:00Z' })
  return {
    loadPaintedMap: async (...args: unknown[]) => { io.calls.push({ fn: 'loadPaintedMap', args }); return { ok: true, value: io.whole } },
    loadPainterNames: async () => new Map([['dana', 'Dana Whitlock'], ['me', 'Marcus Hale']]),
    createPaintedMap: async (input: { id: string; name: string; words?: string; jobId?: string | null; developmentId?: string | null; by: string }) => { io.calls.push({ fn: 'createPaintedMap', args: [input] }); return landed({ id: input.id, name: input.name, words: input.words ?? '', jobId: input.jobId ?? null, developmentId: input.developmentId ?? null, createdBy: input.by, createdAt: '2026-11-13T16:00:00Z' }) },
    addPaintedLine: async (mapId: string, draft: { how: string; points: unknown[]; marginM?: number | null }, by: string) => { io.calls.push({ fn: 'addPaintedLine', args: [mapId, draft, by] }); return landed(line('new-line', mapId, draft, by)) },
    savePaintedLineShape: async (l: { id: string; mapId: string }, draft: { how: string; points: unknown[] }, by: string) => { io.calls.push({ fn: 'savePaintedLineShape', args: [l.id, draft, by] }); return landed(line(l.id, l.mapId, draft, by)) },
    savePaintedLineMeasure: async (lineId: string, measured: { feet: number; how: string } | null) => { io.calls.push({ fn: 'savePaintedLineMeasure', args: [lineId, measured] }); return landed({ ...(io.whole as PaintedMapWhole).lines.find((l) => l.id === lineId)!, measuredFt: measured?.feet ?? null, measuredHow: measured?.how ?? null }) },
    deletePaintedLine: async (lineId: string) => { io.calls.push({ fn: 'deletePaintedLine', args: [lineId] }); return landed(true) },
    deletePaintedMap: async (mapId: string) => { io.calls.push({ fn: 'deletePaintedMap', args: [mapId] }); return landed(true) },
    savePaintedMapWords: async (mapId: string, input: { name: string; words: string }) => { io.calls.push({ fn: 'savePaintedMapWords', args: [mapId, input] }); return landed({ ...(io.whole as PaintedMapWhole).map, ...input }) },
    paintedPlacePhotoUrls: async (paths: Array<string | null>) => new Map(paths.filter((p): p is string => !!p).map((p) => [p, `https://signed.test/${p}`])),
    uploadPaintedPlacePhoto: async (mapId: string, photoId: string) => { io.calls.push({ fn: 'uploadPaintedPlacePhoto', args: [mapId, photoId] }); return io.refuseUpload ? { ok: false as const, error: io.refuseUpload } : { ok: true as const, value: `${mapId}/${photoId}.jpg` } },
    removePaintedPlacePhotoFile: async (path: string | null) => { io.calls.push({ fn: 'removePaintedPlacePhotoFile', args: [path] }) },
    addPaintedPlace: async (mapId: string, place: { lat: number; lng: number; name?: string; words?: string; accuracyM?: number | null; photoPath?: string | null }, by: string) => { io.calls.push({ fn: 'addPaintedPlace', args: [mapId, place, by] }); return landed({ id: 'new-place', mapId, name: place.name || 'A place', words: place.words ?? '', lat: place.lat, lng: place.lng, accuracyM: place.accuracyM ?? null, photoPath: place.photoPath ?? null, setBy: by, setAt: '2026-11-13T16:10:00Z' }) },
    savePaintedPlace: async (placeId: string, change: Record<string, unknown>) => { io.calls.push({ fn: 'savePaintedPlace', args: [placeId, change] }); const old = (io.whole as PaintedMapWhole).places.find((p) => p.id === placeId)!; return landed({ ...old, ...change, accuracyM: (change.accuracyM as number | null) ?? null, photoPath: (change.photoPath as string | null) ?? null }) },
    deletePaintedPlace: async (placeId: string) => { io.calls.push({ fn: 'deletePaintedPlace', args: [placeId] }); return landed(true) },
  }
})

/** The map, stood in for: it says what it draws, and its two presses add a corner to the draft. */
const canvas = vi.hoisted(() => ({ draft: null as null | PaintedCanvasDraft }))
vi.mock('./PaintedMapCanvas', async () => {
  const { useEffect } = await import('react')
  return {
    default: function CanvasStub(props: { lines: Array<{ id: string }>; places: Array<{ id: string; number: number }>; draft?: PaintedCanvasDraft | null; dot?: { point: { lat: number; lng: number }; onMove: (p: { lat: number; lng: number }) => void } | null; onView?: (c: { lat: number; lng: number }) => void; onPlaceTap?: (id: string) => void }) {
      canvas.draft = props.draft ?? null
      const { onView } = props
      // The map says where it is looking once it has settled, as the real one does.
      useEffect(() => {
        onView?.({ lat: 29.55, lng: -98.25 })
      }, [onView])
      return (
        <div data-testid="canvas">
          lines:{props.lines.map((l) => l.id).join(',')} corners:{props.draft ? props.draft.points.length : 'none'} dots:{props.places.map((p) => p.number).join(',')} dot:{props.dot ? `${props.dot.point.lat},${props.dot.point.lng}` : 'none'}
          {props.draft ? <button type="button" onClick={() => props.draft!.onAdd({ lat: 29.5 + props.draft!.points.length * 0.001, lng: -98.2 })}>add a corner</button> : null}
          {props.dot ? <button type="button" onClick={() => props.dot!.onMove({ lat: 29.7, lng: -98.4 })}>drag the dot</button> : null}
          {props.places.map((p) => <button key={p.id} type="button" onClick={() => props.onPlaceTap?.(p.id)}>dot {p.number}</button>)}
        </div>
      )
    },
  }
})

import { PaintedMapWindow } from './PaintedMapWindow'

const MAP: PaintedMap = { id: 'm1', name: 'The way in for deliveries', words: 'Start at the truck gate.', jobId: 'j1', developmentId: null, createdBy: 'dana', createdAt: '2026-11-13T15:00:00Z' }
const LINE = (over: Partial<PaintedLine> = {}): PaintedLine => ({ id: 'l1', mapId: 'm1', label: '', how: 'drawn', points: [{ lat: 29.5, lng: -98.2 }, { lat: 29.501, lng: -98.2 }], poorParts: [], fixedByHand: false, lengthM: 253, marginM: 2.12, measuredFt: null, measuredHow: null, madeBy: 'dana', madeAt: '2026-11-13T15:05:00Z', ...over })

afterEach(() => {
  cleanup()
  io.whole = null
  io.calls = []
  io.refuse = null
  io.refuseUpload = null
  camera.shot = null
  opened.length = 0
  auth.value = { user: { id: 'me' }, role: 'helpers' }
})

const names = () => io.calls.map((c) => c.fn)
/** The first place in the list, once it is drawn. */
const placeRow = async (): Promise<Element> => {
  await waitFor(() => expect(document.querySelector('[data-painted-place-row]')).not.toBeNull())
  return document.querySelector('[data-painted-place-row]')!
}

describe('a new map', () => {
  const start = { id: 'new-map', name: 'The way in', words: '', home: { jobId: 'j1', label: 'Lot 14' } }

  it('opens ready to draw, saves nothing until Save the map, and Save is dead until the line is a line', async () => {
    render(<PaintedMapWindow ask={{ start }} center={{ lat: 29.5, lng: -98.2 }} onClose={() => {}} />)
    expect(screen.getByRole('heading', { name: 'Draw it by hand' })).toBeTruthy()
    const add = await screen.findByRole('button', { name: 'add a corner' })
    const save = screen.getByRole('button', { name: 'Save the map' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    fireEvent.click(add)
    expect(save.disabled).toBe(true)
    fireEvent.click(add)
    expect(save.disabled).toBe(false)
    expect(names()).toEqual([])
    expect(document.querySelector('[data-painted-readout]')?.textContent).toContain('2 corners · drawn by hand')
  })

  it('makes the map and then its first line, drawn by hand, signed by the painter', async () => {
    render(<PaintedMapWindow ask={{ start }} onClose={() => {}} />)
    const add = await screen.findByRole('button', { name: 'add a corner' })
    fireEvent.click(add)
    fireEvent.click(add)
    fireEvent.click(screen.getByRole('button', { name: 'Save the map' }))
    await waitFor(() => expect(names()).toEqual(['createPaintedMap', 'addPaintedLine']))
    expect(io.calls[0]!.args[0]).toMatchObject({ id: 'new-map', name: 'The way in', jobId: 'j1', by: 'me' })
    const [mapId, draft, by] = io.calls[1]!.args as [string, { how: string; points: unknown[]; marginM: number }, string]
    expect(mapId).toBe('new-map')
    expect(by).toBe('me')
    expect(draft.how).toBe('drawn')
    expect(draft.points).toHaveLength(2)
    expect(draft.marginM).toBeCloseTo(2.12, 1)
    // Back on the map, with its line listed.
    await screen.findByRole('button', { name: 'Draw a line' })
    expect(document.querySelectorAll('[data-painted-line]')).toHaveLength(1)
  })

  it('takes a step back with Undo', async () => {
    render(<PaintedMapWindow ask={{ start }} onClose={() => {}} />)
    const add = await screen.findByRole('button', { name: 'add a corner' })
    fireEvent.click(add)
    fireEvent.click(add)
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(document.querySelector('[data-painted-readout]')?.textContent).toContain('1 corner · drawn by hand')
    expect((screen.getByRole('button', { name: 'Save the map' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('says why a save was refused and keeps the line on the screen', async () => {
    io.refuse = 'This account is in training and cannot save.'
    render(<PaintedMapWindow ask={{ start }} onClose={() => {}} />)
    const add = await screen.findByRole('button', { name: 'add a corner' })
    fireEvent.click(add)
    fireEvent.click(add)
    fireEvent.click(screen.getByRole('button', { name: 'Save the map' }))
    expect((await screen.findByRole('alert')).textContent).toBe('This account is in training and cannot save.')
    expect(document.querySelector('[data-painted-readout]')?.textContent).toContain('2 corners')
  })

  it('asks before a drawn line is lost, and goes back to the empty map with nothing saved', async () => {
    let closed = 0
    render(<PaintedMapWindow ask={{ start }} onClose={() => (closed += 1)} />)
    fireEvent.click(await screen.findByRole('button', { name: 'add a corner' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByText('Stop without saving?')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Stop, and lose the line' }))
    expect(closed).toBe(0)
    expect(names()).toEqual([])
    expect(screen.getByText(/Nothing is painted on this map yet\. Press Draw a line or ＋ Place to start it\. Nothing is saved until then\./)).toBeTruthy()
  })

  it('may start with a place: the map is made by that first save', async () => {
    render(<PaintedMapWindow ask={{ start: { ...start, first: 'place' } }} center={{ lat: 29.5, lng: -98.2 }} onClose={() => {}} />)
    expect(screen.getByRole('heading', { name: 'A place on the map' })).toBeTruthy()
    fireEvent.click(await screen.findByRole('button', { name: 'Gate' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add this place' }))
    await waitFor(() => expect(names()).toEqual(['createPaintedMap', 'addPaintedPlace']))
    expect(io.calls[1]!.args[1]).toMatchObject({ lat: 29.5, lng: -98.2, name: 'Gate', accuracyM: null, photoPath: null })
  })
})

describe('a saved map', () => {
  it('lists its lines with an honest length, how each was made and by whom', async () => {
    io.whole = { map: MAP, lines: [LINE(), LINE({ id: 'l2', how: 'walked', fixedByHand: true, lengthM: 125, marginM: 12, madeBy: 'me' })], places: [] }
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    await screen.findByRole('heading', { name: 'The way in for deliveries' })
    expect(screen.getByText('Start at the truck gate.')).toBeTruthy()
    expect(document.querySelector('[data-painted-summary]')?.textContent).toBe('About 1,250 ft')
    const lines = [...document.querySelectorAll('[data-painted-line]')].map((e) => e.textContent ?? '')
    expect(lines[0]).toContain('About 830 ft, give or take 10 ft')
    expect(lines[0]).toContain('drawn by hand by Dana Whitlock')
    expect(lines[1]).toContain('About 410 ft, give or take 40 ft')
    expect(lines[1]).toContain('walked, a part drawn by hand by Marcus Hale')
    expect(screen.getByText('Painted by Dana Whitlock on Nov 13.')).toBeTruthy()
  })

  it('offers change presses on my own line only, when I am not the office', async () => {
    io.whole = { map: MAP, lines: [LINE(), LINE({ id: 'l2', madeBy: 'me' })], places: [] }
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    await screen.findByRole('heading', { name: 'The way in for deliveries' })
    expect(screen.getAllByRole('button', { name: 'Remove this line' })).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Throw this map away' })).toBeNull()
  })

  it('lets the office change anyone\'s line and the map', async () => {
    auth.value = { user: { id: 'me' }, role: 'assistant' }
    io.whole = { map: MAP, lines: [LINE()], places: [] }
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    await screen.findByRole('heading', { name: 'The way in for deliveries' })
    expect(screen.getAllByRole('button', { name: 'Remove this line' })).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Throw this map away' })).toBeTruthy()
  })

  it('takes a measured length typed in, and shows it in place of the guess', async () => {
    auth.value = { user: { id: 'dana' }, role: 'helpers' }
    io.whole = { map: MAP, lines: [LINE()], places: [] }
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Type a length measured with a wheel or a tape' }))
    fireEvent.change(screen.getByLabelText('The measured length, in feet'), { target: { value: 'about 600' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save the length' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Type the length in feet')
    fireEvent.change(screen.getByLabelText('The measured length, in feet'), { target: { value: '612' } })
    fireEvent.click(screen.getByRole('button', { name: 'A tape' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save the length' }))
    await waitFor(() => expect(io.calls.find((c) => c.fn === 'savePaintedLineMeasure')?.args).toEqual(['l1', { feet: 612, how: 'tape' }]))
    await waitFor(() => expect(document.querySelector('[data-painted-line]')?.textContent).toContain('612 ft, measured with a tape'))
  })

  it('removes a line only after a confirm that names the act', async () => {
    auth.value = { user: { id: 'dana' }, role: 'helpers' }
    io.whole = { map: MAP, lines: [LINE()], places: [] }
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Remove this line' }))
    expect(names()).not.toContain('deletePaintedLine')
    fireEvent.click(screen.getByRole('button', { name: 'Remove the line' }))
    await waitFor(() => expect(names()).toContain('deletePaintedLine'))
    await waitFor(() => expect(document.querySelectorAll('[data-painted-line]')).toHaveLength(0))
    expect(screen.getByText('Nothing is painted on this map yet. Press Draw a line or ＋ Place to start it.')).toBeTruthy()
  })

  it('opens directions to where the map starts', async () => {
    io.whole = { map: MAP, lines: [LINE()], places: [] }
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Directions to the start' }))
    expect(opened[0]).toContain('destination=29.500000,-98.200000')
  })

  it('moves the corners of a line drawn by hand and saves its shape', async () => {
    auth.value = { user: { id: 'dana' }, role: 'helpers' }
    io.whole = { map: MAP, lines: [LINE()], places: [] }
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Move its corners' }))
    expect(screen.getByRole('heading', { name: 'Move the corners' })).toBeTruthy()
    // The line being moved is the draft now, not a second drawing of itself under it.
    expect(screen.getByTestId('canvas').textContent).toContain('lines: corners:2')
    fireEvent.click(screen.getByRole('button', { name: 'add a corner' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save the line' }))
    await waitFor(() => expect(names()).toContain('savePaintedLineShape'))
    const call = io.calls.find((c) => c.fn === 'savePaintedLineShape')!
    expect((call.args[1] as { points: unknown[] }).points).toHaveLength(3)
    expect(names()).not.toContain('createPaintedMap')
  })

  it('says so when the map is gone or not the reader\'s', async () => {
    io.whole = null
    render(<PaintedMapWindow ask={{ mapId: 'gone' }} onClose={() => {}} />)
    expect(await screen.findByText('This painted map is gone, or it is not yours to open.')).toBeTruthy()
  })
})

describe('places on a map', () => {
  const PLACE = { id: 'p1', mapId: 'm1', name: 'Truck gate', words: 'Close it behind you.', lat: 29.5, lng: -98.2, accuracyM: 4, photoPath: 'm1/gate.jpg', setBy: 'dana', setAt: '2026-11-13T15:02:00Z' }

  it('adds a place where the map is looking, named from a chip, placed by hand', async () => {
    io.whole = { map: MAP, lines: [LINE()], places: [] }
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: '＋ Place' }))
    expect(screen.getByTestId('canvas').textContent).toContain('dot:29.55,-98.25')
    fireEvent.click(screen.getByRole('button', { name: 'Meter' }))
    fireEvent.change(screen.getByLabelText('A word for whoever comes next'), { target: { value: 'Behind the hedge.' } })
    expect(screen.getByText(/Never type a gate code or a lock code here/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Add this place' }))
    await waitFor(() => expect(names()).toContain('addPaintedPlace'))
    const [mapId, place, by] = io.calls.find((c) => c.fn === 'addPaintedPlace')!.args as [string, Record<string, unknown>, string]
    expect(mapId).toBe('m1')
    expect(by).toBe('me')
    expect(place).toMatchObject({ lat: 29.55, lng: -98.25, name: 'Meter', words: 'Behind the hedge.', accuracyM: null, photoPath: null })
    const row = await placeRow()
    expect(row.textContent).toContain('Meter')
    expect(row.textContent).toContain('placed by hand')
    expect(names()).not.toContain('uploadPaintedPlacePhoto')
  })

  it('keeps the phone\'s margin only while the dot sits on the reading', async () => {
    io.whole = { map: MAP, lines: [], places: [] }
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: '＋ Place' }))
    fireEvent.click(screen.getByRole('button', { name: 'Put the dot where I am' }))
    expect((await screen.findByRole('status')).textContent).toBe('Found you. Your phone is sure within 20 ft.')
    fireEvent.click(screen.getByRole('button', { name: 'drag the dot' }))
    expect(screen.getByRole('status').textContent).toBe('You moved the dot. The place is where the dot is now.')
    fireEvent.click(screen.getByRole('button', { name: 'Add this place' }))
    await waitFor(() => expect(names()).toContain('addPaintedPlace'))
    expect(io.calls.find((c) => c.fn === 'addPaintedPlace')!.args[1]).toMatchObject({ lat: 29.7, lng: -98.4, accuracyM: null })
  })

  it('saves the reading\'s margin when the dot is left on it', async () => {
    io.whole = { map: MAP, lines: [], places: [] }
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: '＋ Place' }))
    fireEvent.click(screen.getByRole('button', { name: 'Put the dot where I am' }))
    await screen.findByRole('status')
    fireEvent.click(screen.getByRole('button', { name: 'Add this place' }))
    await waitFor(() => expect(names()).toContain('addPaintedPlace'))
    expect(io.calls.find((c) => c.fn === 'addPaintedPlace')!.args[1]).toMatchObject({ lat: 29.6, lng: -98.3, accuracyM: 5 })
  })

  it('sends a photo first and saves the place with it', async () => {
    camera.shot = { id: 'shot1', blob: new Blob(['x']), previewUrl: 'blob:preview' }
    io.whole = { map: MAP, lines: [], places: [] }
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: '＋ Place' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add this place' }))
    await waitFor(() => expect(names()).toContain('addPaintedPlace'))
    expect(names().indexOf('uploadPaintedPlacePhoto')).toBeLessThan(names().indexOf('addPaintedPlace'))
    expect(io.calls.find((c) => c.fn === 'addPaintedPlace')!.args[1]).toMatchObject({ photoPath: 'm1/shot1.jpg' })
    fireEvent.click(await screen.findByRole('button', { name: 'Open the photo of A place' }))
    expect(document.querySelector('[data-painted-photo-view] img')?.getAttribute('src')).toBe('https://signed.test/m1/shot1.jpg')
  })

  it('takes the photo back out when the place does not save', async () => {
    camera.shot = { id: 'shot1', blob: new Blob(['x']), previewUrl: 'blob:preview' }
    io.whole = { map: MAP, lines: [], places: [] }
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: '＋ Place' }))
    io.refuse = 'new row violates row-level security policy'
    fireEvent.click(screen.getByRole('button', { name: 'Add this place' }))
    expect((await screen.findByRole('alert')).textContent).toBe('new row violates row-level security policy')
    expect(io.calls.find((c) => c.fn === 'removePaintedPlacePhotoFile')?.args).toEqual(['m1/shot1.jpg'])
  })

  it('says why a photo did not upload and saves no place', async () => {
    camera.shot = { id: 'shot1', blob: new Blob(['x']), previewUrl: 'blob:preview' }
    io.refuseUpload = 'The photo did not upload.'
    io.whole = { map: MAP, lines: [], places: [] }
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: '＋ Place' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add this place' }))
    expect((await screen.findByRole('alert')).textContent).toBe('The photo did not upload.')
    expect(names()).not.toContain('addPaintedPlace')
  })

  it('lists a place with its number, its words, how sure the phone was and its photo', async () => {
    io.whole = { map: MAP, lines: [], places: [PLACE] }
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    const row = await placeRow()
    expect(row.textContent).toContain('1')
    expect(row.textContent).toContain('Truck gate')
    expect(row.textContent).toContain('Close it behind you.')
    expect(row.textContent).toContain('the phone was sure within 15 ft · Dana Whitlock')
    expect(screen.getByRole('button', { name: 'Open the photo of Truck gate' })).toBeTruthy()
    expect(document.querySelector('[data-painted-summary]')?.textContent).toBe('1 place')
    // Dana's place is not mine to change, and I am not the office.
    expect(screen.queryByRole('button', { name: 'Change this place' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'dot 1' }))
    expect(row.getAttribute('data-picked')).toBe('true')
  })

  it('changes a place I set: its words, and its dot by hand, which drops the margin', async () => {
    auth.value = { user: { id: 'dana' }, role: 'helpers' }
    io.whole = { map: MAP, lines: [], places: [PLACE] }
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Change this place' }))
    expect(screen.getByRole('heading', { name: 'Change this place' })).toBeTruthy()
    // Its numbered dot gives way to the blue one while it is being moved.
    expect(screen.getByTestId('canvas').textContent).toContain('dots: dot:29.5,-98.2')
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Truck gate')
    fireEvent.click(screen.getByRole('button', { name: 'drag the dot' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save the place' }))
    await waitFor(() => expect(names()).toContain('savePaintedPlace'))
    expect(io.calls.find((c) => c.fn === 'savePaintedPlace')!.args).toEqual(['p1', { name: 'Truck gate', words: 'Close it behind you.', lat: 29.7, lng: -98.4, accuracyM: null, photoPath: 'm1/gate.jpg' }])
    // The photo it already had is kept, not sent again and not removed.
    expect(names()).not.toContain('uploadPaintedPlacePhoto')
    expect(names()).not.toContain('removePaintedPlacePhotoFile')
  })

  it('removes a place and its photo only after a confirm that names the act', async () => {
    auth.value = { user: { id: 'dana' }, role: 'helpers' }
    io.whole = { map: MAP, lines: [], places: [PLACE] }
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Change this place' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove this place' }))
    expect(names()).not.toContain('deletePaintedPlace')
    fireEvent.click(screen.getByRole('button', { name: 'Remove the place' }))
    await waitFor(() => expect(names()).toContain('deletePaintedPlace'))
    expect(io.calls.find((c) => c.fn === 'removePaintedPlacePhotoFile')?.args).toEqual(['m1/gate.jpg'])
    await waitFor(() => expect(document.querySelectorAll('[data-painted-place-row]')).toHaveLength(0))
  })
})
