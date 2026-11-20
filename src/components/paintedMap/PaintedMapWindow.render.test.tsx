// @vitest-environment jsdom
/**
 * A painted map's window (punch list #345, PR 2). A new map is drawn by hand and saved with its
 * first line, and not before. A saved map lists its lines with an honest length, takes a measured
 * length typed in, and lets its maker or the office change it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { PaintedLine, PaintedMap } from '../../lib/paintedMap/paintedMap'
import type { PaintedMapWhole } from '../../lib/paintedMap/paintedMapIo'
import type { PaintedCanvasDraft } from './PaintedMapCanvas'

const auth = vi.hoisted(() => ({ value: { user: { id: 'me' } as { id: string } | null, role: 'helpers' as string } }))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => auth.value }))
vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => true }))
/** The geocoder, stood in for: it places any address it is asked for, and counts the asks. */
const geo = vi.hoisted(() => ({ asked: 0 }))
vi.mock('../../hooks/useAddressGeocodeCoords', () => ({
  useAddressGeocodeCoords: (addresses: Array<{ key: string }>, enabled: boolean) => {
    if (enabled) geo.asked += 1
    return { coords: new Map(enabled ? addresses.map((a) => [a.key, { lat: 29.4, lng: -98.1 }] as const) : []), resolving: false }
  },
}))
vi.mock('../../hooks/useModalStackEntry', () => ({ useModalStackEntry: () => () => true }))
const opened = vi.hoisted(() => [] as string[])
vi.mock('../../lib/openInExternalBrowser', () => ({ openInExternalBrowser: (url: string) => opened.push(url) }))
/** The phone's one reading, stood in for: a test sets what the next Put the dot where I am gets. */
const here = vi.hoisted(() => ({ fix: { lat: 29.6, lng: -98.3, accuracyM: 5 as number | null } }))
vi.mock('../../lib/materials/myLocation', () => ({ requestMyLocation: (ok: (p: unknown) => void) => ok({ ...here.fix }) }))
/** Which phone the page takes itself to be on, for the Precise Location line's words. */
const browser = vi.hoisted(() => ({ kind: 'iphone-safari' as string }))
vi.mock('../../hooks/usePreciseLocation', async (real) => ({ ...(await real<typeof import('../../hooks/usePreciseLocation')>()), usePhoneKind: () => browser.kind }))
/** The camera, stood in for: a test puts a shot here before the panel opens. */
const camera = vi.hoisted(() => ({ shot: null as null | { id: string; blob: Blob; previewUrl: string } }))
vi.mock('../../hooks/useTaskShot', () => ({ useTaskShot: () => ({ shot: camera.shot, shrinking: false, kept: false, error: null, pick: async () => {}, clear: () => {}, markKept: () => {} }) }))

const io = vi.hoisted(() => ({
  whole: null as unknown,
  calls: [] as Array<{ fn: string; args: unknown[] }>,
  refuse: null as string | null,
  refuseUpload: null as string | null,
  /** The painted maps of the map's job, for the read of the job's own list of places. */
  jobWholes: [] as unknown[],
  jobReads: [] as unknown[],
}))
vi.mock('../../lib/paintedMap/paintedMapIo', () => {
  const landed = <T,>(value: T) => (io.refuse ? { ok: false as const, error: io.refuse } : { ok: true as const, value })
  const line = (id: string, mapId: string, draft: { how: string; points: unknown[]; marginM?: number | null }, by: string) => ({ id, mapId, label: '', how: draft.how, points: draft.points, poorParts: [], fixedByHand: false, lengthM: 150, marginM: draft.marginM ?? null, measuredFt: null, measuredHow: null, madeBy: by, madeAt: '2026-11-13T16:00:00Z' })
  return {
    loadPaintedMap: async (...args: unknown[]) => { io.calls.push({ fn: 'loadPaintedMap', args }); return { ok: true, value: io.whole } },
    // Kept off `calls`: the cases that pin the writes of a save read that list whole.
    loadPaintedMapsFor: async (home: unknown) => { io.jobReads.push(home); return { ok: true, value: io.jobWholes } },
    loadPainterNames: async () => new Map([['dana', 'Dana Whitlock'], ['me', 'Marcus Hale']]),
    createPaintedMap: async (input: { id: string; name: string; words?: string; jobId?: string | null; developmentId?: string | null; jobList?: boolean; by: string }) => { io.calls.push({ fn: 'createPaintedMap', args: [input] }); return landed({ id: input.id, name: input.name, words: input.words ?? '', jobId: input.jobId ?? null, developmentId: input.developmentId ?? null, jobList: input.jobList === true, createdBy: input.by, createdAt: '2026-11-13T16:00:00Z' }) },
    addPaintedLine: async (mapId: string, draft: { how: string; points: unknown[]; marginM?: number | null }, by: string) => { io.calls.push({ fn: 'addPaintedLine', args: [mapId, draft, by] }); return landed(line('new-line', mapId, draft, by)) },
    savePaintedLineShape: async (l: { id: string; mapId: string }, draft: { how: string; points: unknown[] }, by: string) => { io.calls.push({ fn: 'savePaintedLineShape', args: [l.id, draft, by] }); return landed(line(l.id, l.mapId, draft, by)) },
    savePaintedLineMeasure: async (lineId: string, measured: { feet: number; how: string } | null) => { io.calls.push({ fn: 'savePaintedLineMeasure', args: [lineId, measured] }); return landed({ ...(io.whole as PaintedMapWhole).lines.find((l) => l.id === lineId)!, measuredFt: measured?.feet ?? null, measuredHow: measured?.how ?? null }) },
    deletePaintedLine: async (lineId: string) => { io.calls.push({ fn: 'deletePaintedLine', args: [lineId] }); return landed(true) },
    deletePaintedMap: async (mapId: string) => { io.calls.push({ fn: 'deletePaintedMap', args: [mapId] }); return landed(true) },
    putPaintedMapOnJob: async (mapId: string, jobId: string) => { io.calls.push({ fn: 'putPaintedMapOnJob', args: [mapId, jobId] }); return landed({ ...(io.whole as PaintedMapWhole).map, jobId, developmentId: null }) },
    savePaintedMapWords: async (mapId: string, input: { name: string; words: string }) => { io.calls.push({ fn: 'savePaintedMapWords', args: [mapId, input] }); return landed({ ...(io.whole as PaintedMapWhole).map, ...input }) },
    paintedPlacePhotoUrls: async (paths: Array<string | null>) => new Map(paths.filter((p): p is string => !!p).map((p) => [p, `https://signed.test/${p}`])),
    uploadPaintedPlacePhoto: async (mapId: string, photoId: string) => { io.calls.push({ fn: 'uploadPaintedPlacePhoto', args: [mapId, photoId] }); return io.refuseUpload ? { ok: false as const, error: io.refuseUpload } : { ok: true as const, value: `${mapId}/${photoId}.jpg` } },
    removePaintedPlacePhotoFile: async (path: string | null) => { io.calls.push({ fn: 'removePaintedPlacePhotoFile', args: [path] }) },
    addPaintedPlace: async (mapId: string, place: { lat: number; lng: number; name?: string; words?: string; accuracyM?: number | null; photoPath?: string | null; kind?: string | null }, by: string) => { io.calls.push({ fn: 'addPaintedPlace', args: [mapId, place, by] }); return landed({ id: 'new-place', mapId, name: place.name || 'A place', words: place.words ?? '', lat: place.lat, lng: place.lng, accuracyM: place.accuracyM ?? null, photoPath: place.photoPath ?? null, kind: place.kind ?? null, setBy: by, setAt: '2026-11-13T16:10:00Z' }) },
    savePaintedPlace: async (placeId: string, change: Record<string, unknown>) => { io.calls.push({ fn: 'savePaintedPlace', args: [placeId, change] }); const old = (io.whole as PaintedMapWhole).places.find((p) => p.id === placeId)!; return landed({ ...old, ...change, accuracyM: (change.accuracyM as number | null) ?? null, photoPath: (change.photoPath as string | null) ?? null }) },
    deletePaintedPlace: async (placeId: string) => { io.calls.push({ fn: 'deletePaintedPlace', args: [placeId] }); return landed(true) },
  }
})

/** The map, stood in for: it says what it draws, and its two presses add a corner to the draft. */
const canvas = vi.hoisted(() => ({ draft: null as null | PaintedCanvasDraft, /** Each use the window told the canvas, in order. */ uses: [] as string[] }))
vi.mock('./PaintedMapCanvas', async () => {
  const { useEffect } = await import('react')
  return {
    default: function CanvasStub(props: { lines: Array<{ id: string }>; places: Array<{ id: string; number: number; kind?: string | null; letter?: string; fromJob?: boolean }>; draft?: PaintedCanvasDraft | null; dot?: { point: { lat: number; lng: number }; onMove: (p: { lat: number; lng: number }) => void } | null; onView?: (c: { lat: number; lng: number }) => void; onPlaceTap?: (id: string) => void; time?: { name: string } | null; google?: { screen: string; use: string; pictureUp?: boolean } | null }) {
      canvas.draft = props.draft ?? null
      if (props.google && canvas.uses[canvas.uses.length - 1] !== props.google.use) canvas.uses.push(props.google.use)
      const { onView } = props
      // The map says where it is looking once it has settled, as the real one does.
      useEffect(() => {
        onView?.({ lat: 29.55, lng: -98.25 })
      }, [onView])
      return (
        <div data-testid="canvas" data-time={props.time?.name ?? ''} data-google-screen={props.google?.screen ?? ''} data-google-use={props.google?.use ?? ''} data-google-picture={props.google?.pictureUp ? 'up' : 'no'}>
          lines:{props.lines.map((l) => l.id).join(',')} corners:{props.draft ? props.draft.points.length : 'none'} dots:{props.places.map((p) => p.number).join(',')} dot:{props.dot ? `${props.dot.point.lat},${props.dot.point.lng}` : 'none'}
          {props.draft ? <button type="button" onClick={() => props.draft!.onAdd({ lat: 29.5 + props.draft!.points.length * 0.001, lng: -98.2 })}>add a corner</button> : null}
          {props.dot ? <button type="button" onClick={() => props.dot!.onMove({ lat: 29.7, lng: -98.4 })}>drag the dot</button> : null}
          {props.places.map((p) => <button key={p.id} type="button" data-dot-kind={p.kind ?? 'plain'} data-dot-letter={p.letter ?? ''} data-dot-job={p.fromJob ? 'yes' : 'no'} onClick={() => props.onPlaceTap?.(p.id)}>dot {p.letter ?? p.number}</button>)}
        </div>
      )
    },
  }
})

/** The picker, stood in for: it says how it was opened, and one press picks a made-up job. */
vi.mock('./PaintAMapJobPicker', () => ({
  PaintAMapJobPicker: (props: { mode?: string; excludeJobId?: string | null; onPick: (job: { id: string }) => void; onClose: () => void }) => (
    <div data-testid="job-picker" data-mode={props.mode} data-exclude={props.excludeJobId ?? ''}>
      <button type="button" onClick={() => props.onPick({ id: 'j9' })}>pick J900</button>
      <button type="button" onClick={props.onClose}>cancel the picker</button>
    </div>
  ),
}))

/** The share sheet, stood in for: it says which map it was opened for. */
vi.mock('./PaintedMapShareSheet', () => ({
  PaintedMapShareSheet: (props: { mapId: string; mapName: string; onClose: () => void; onPictureShown?: (shown: boolean) => void }) => (
    <div data-testid="share-sheet">
      share:{props.mapId}:{props.mapName}
      <button type="button" onClick={() => props.onPictureShown?.(true)}>show a picture</button>
      <button type="button" onClick={() => props.onPictureShown?.(false)}>back from the picture</button>
      <button type="button" onClick={props.onClose}>close the sheet</button>
    </div>
  ),
}))

/** The Saved band, stood in for: it says its words and whether it carries the text press. */
vi.mock('./PaintedMapSavedBand', () => ({
  PaintedMapSavedBand: (props: { mapId: string; head: string; under: string; offersText: boolean }) => (
    <div data-testid="saved-band" data-offers-text={props.offersText ? 'yes' : 'no'}>
      {props.head}|{props.under}
    </div>
  ),
}))
/** Whether this is a phone, where the person's own Messages can be opened. Left null, the device itself answers, as the place-sending cases need. */
const device = vi.hoisted(() => ({ phone: null as boolean | null }))
vi.mock('../../lib/quo/dial', async () => {
  const actual = await vi.importActual<typeof import('../../lib/quo/dial')>('../../lib/quo/dial')
  return { ...actual, isPhoneDevice: (...args: Parameters<typeof actual.isPhoneDevice>) => device.phone ?? actual.isPhoneDevice(...args) }
})

import { onPaintedMapAsk, type PaintedMapAsk } from '../../lib/paintedMap/paintedMapDoor'
import { PaintedMapWindow } from './PaintedMapWindow'

const MAP: PaintedMap = { id: 'm1', name: 'The way in for deliveries', words: 'Start at the truck gate.', jobId: 'j1', developmentId: null, createdBy: 'dana', createdAt: '2026-11-13T15:00:00Z' }
const LINE = (over: Partial<PaintedLine> = {}): PaintedLine => ({ id: 'l1', mapId: 'm1', label: '', how: 'drawn', points: [{ lat: 29.5, lng: -98.2 }, { lat: 29.501, lng: -98.2 }], poorParts: [], fixedByHand: false, lengthM: 253, marginM: 2.12, measuredFt: null, measuredHow: null, madeBy: 'dana', madeAt: '2026-11-13T15:05:00Z', ...over })

afterEach(() => {
  cleanup()
  canvas.uses = []
  io.whole = null
  io.calls = []
  io.refuse = null
  io.refuseUpload = null
  io.jobWholes = []
  io.jobReads = []
  camera.shot = null
  geo.asked = 0
  opened.length = 0
  auth.value = { user: { id: 'me' }, role: 'helpers' }
  device.phone = null
  here.fix = { lat: 29.6, lng: -98.3, accuracyM: 5 }
  browser.kind = 'iphone-safari'
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

  it('after Save the map, says it was saved on the job and offers the text press on a phone (punch list #392)', async () => {
    device.phone = true
    render(<PaintedMapWindow ask={{ start }} onClose={() => {}} />)
    // Nothing is saved yet, so nothing says saved.
    expect(screen.queryByTestId('saved-band')).toBeNull()
    const add = await screen.findByRole('button', { name: 'add a corner' })
    fireEvent.click(add)
    fireEvent.click(add)
    fireEvent.click(screen.getByRole('button', { name: 'Save the map' }))
    const band = await screen.findByTestId('saved-band')
    expect(band.textContent).toBe('Saved on Lot 14|About 490 ft. Anyone on the job can open it.')
    expect(band.getAttribute('data-offers-text')).toBe('yes')
    // One blue press on the screen: Draw a line gives way to the band's.
    expect((screen.getByRole('button', { name: 'Draw a line' }) as HTMLElement).style.background).not.toBe('rgb(37, 99, 235)')
  })

  it('at a desk the band says saved with no text press, and Draw a line stays the blue press', async () => {
    render(<PaintedMapWindow ask={{ start }} onClose={() => {}} />)
    const add = await screen.findByRole('button', { name: 'add a corner' })
    fireEvent.click(add)
    fireEvent.click(add)
    fireEvent.click(screen.getByRole('button', { name: 'Save the map' }))
    const band = await screen.findByTestId('saved-band')
    expect(band.getAttribute('data-offers-text')).toBe('no')
    expect((screen.getByRole('button', { name: 'Draw a line' }) as HTMLElement).style.background).toBe('rgb(37, 99, 235)')
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
    expect(screen.getByText(/Nothing is painted on this map yet\. Press Draw a line or ＋ Place to start it\. The map is saved with its first line or place\./)).toBeTruthy()
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

describe('where a map opens', () => {
  it('looks the address up for a new map, and puts a first place\'s dot there', async () => {
    render(<PaintedMapWindow ask={{ start: { id: 'new-map', name: 'What is where', words: '', first: 'place', home: { jobId: 'j1' } } }} address="1 Made Up Road" onClose={() => {}} />)
    await screen.findByRole('heading', { name: 'A place on the map' })
    expect(geo.asked).toBeGreaterThan(0)
    expect(screen.getByTestId('canvas').textContent).toContain('dot:29.4,-98.1')
  })

  it('asks the geocoder nothing for a saved map that has a line to open on', async () => {
    io.whole = { map: MAP, lines: [LINE()], places: [] }
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} address="1 Made Up Road" onClose={() => {}} />)
    await screen.findByRole('heading', { name: 'The way in for deliveries' })
    expect(geo.asked).toBe(0)
  })

  it('looks the address up for a saved map with nothing on it yet', async () => {
    io.whole = { map: MAP, lines: [], places: [] }
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} address="1 Made Up Road" onClose={() => {}} />)
    await screen.findByRole('heading', { name: 'The way in for deliveries' })
    await waitFor(() => expect(geo.asked).toBeGreaterThan(0))
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

  it('hands the canvas Time while the map is only being read, and takes it back when a line is being drawn (punch list #395)', async () => {
    auth.value = { user: { id: 'me' }, role: 'assistant' }
    io.whole = { map: MAP, lines: [LINE()], places: [] }
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    await screen.findByRole('heading', { name: 'The way in for deliveries' })
    // The row calls the spot by the map's own name.
    expect(screen.getByTestId('canvas').getAttribute('data-time')).toBe('The way in for deliveries')
    fireEvent.click(screen.getByRole('button', { name: 'Draw a line' }))
    await screen.findByRole('heading', { name: 'Draw it by hand' })
    expect(screen.getByTestId('canvas').getAttribute('data-time')).toBe('')
  })

  it('tells the canvas where it is and what it is for, so the rule can pick the map under it (punch list #387)', async () => {
    auth.value = { user: { id: 'me' }, role: 'assistant' }
    io.whole = { map: MAP, lines: [LINE()], places: [] }
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    await screen.findByRole('heading', { name: 'The way in for deliveries' })
    const canvasBox = () => screen.getByTestId('canvas')
    expect(canvasBox().getAttribute('data-google-screen')).toBe('window')
    // A saved map opened to be read: the one use Google's map carries today.
    expect(canvasBox().getAttribute('data-google-use')).toBe('looking')
    fireEvent.click(screen.getByRole('button', { name: 'Draw a line' }))
    await screen.findByRole('heading', { name: 'Draw it by hand' })
    expect(canvasBox().getAttribute('data-google-use')).toBe('drawing')
  })

  it('says a place is being put down while its dot is on the map (punch list #387)', async () => {
    auth.value = { user: { id: 'me' }, role: 'assistant' }
    io.whole = { map: MAP, lines: [LINE()], places: [] }
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: '＋ Place' }))
    expect(screen.getByTestId('canvas').getAttribute('data-google-use')).toBe('placing')
  })

  it('tells the canvas while a picture of the map is on the screen, and stops when the sheet closes (punch list #387)', async () => {
    io.whole = { map: { ...MAP, createdBy: 'me' }, lines: [LINE({ madeBy: 'me' })], places: [] }
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Share' }))
    expect(screen.getByTestId('canvas').getAttribute('data-google-picture')).toBe('no')
    fireEvent.click(screen.getByRole('button', { name: 'show a picture' }))
    expect(screen.getByTestId('canvas').getAttribute('data-google-picture')).toBe('up')
    fireEvent.click(screen.getByRole('button', { name: 'back from the picture' }))
    expect(screen.getByTestId('canvas').getAttribute('data-google-picture')).toBe('no')
    // Closed with the picture up: the sheet is gone, and so is the picture.
    fireEvent.click(screen.getByRole('button', { name: 'show a picture' }))
    fireEvent.click(screen.getByRole('button', { name: 'close the sheet' }))
    expect(screen.getByTestId('canvas').getAttribute('data-google-picture')).toBe('no')
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

describe('a map on no job', () => {
  const LOOSE = { ...MAP, jobId: null, createdBy: 'me' }

  it('says who can open it, and is put on a job by whoever painted it', async () => {
    io.whole = { map: LOOSE, lines: [LINE({ madeBy: 'me' })], places: [] }
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    expect(await screen.findByText('This map is on no job. Only you and the office can open it.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Put it on a job…' }))
    fireEvent.click(screen.getByRole('button', { name: 'pick J900' }))
    await waitFor(() => expect(io.calls.find((c) => c.fn === 'putPaintedMapOnJob')?.args).toEqual(['m1', 'j9']))
    await waitFor(() => expect(document.querySelector('[data-painted-no-home]')).toBeNull())
  })

  it('says why it was not put on the job, and stays on none', async () => {
    io.whole = { map: LOOSE, lines: [LINE({ madeBy: 'me' })], places: [] }
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Put it on a job…' }))
    io.refuse = 'The map was not put on the job.'
    fireEvent.click(screen.getByRole('button', { name: 'pick J900' }))
    expect(await screen.findByText('The map was not put on the job.')).toBeTruthy()
    expect(document.querySelector('[data-painted-no-home]')).not.toBeNull()
  })

  it('has no such press on a map that is on a job', async () => {
    io.whole = { map: { ...MAP, createdBy: 'me' }, lines: [LINE({ madeBy: 'me' })], places: [] }
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    await screen.findByRole('heading', { name: 'The way in for deliveries' })
    expect(document.querySelector('[data-painted-no-home]')).toBeNull()
  })

  it('asks which job in the picker, as a first pick', async () => {
    io.whole = { map: LOOSE, lines: [LINE({ madeBy: 'me' })], places: [] }
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Put it on a job…' }))
    expect(screen.getByTestId('job-picker').getAttribute('data-mode')).toBe('pick')
    fireEvent.click(screen.getByRole('button', { name: 'cancel the picker' }))
    expect(screen.queryByTestId('job-picker')).toBeNull()
    expect(names()).not.toContain('putPaintedMapOnJob')
  })
})

describe('a map on the wrong job (punch list #392)', () => {
  it('is moved to another job by whoever painted it, and the picker leaves its own job out', async () => {
    io.whole = { map: { ...MAP, createdBy: 'me' }, lines: [LINE({ madeBy: 'me' })], places: [] }
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Move it to another job…' }))
    const picker = screen.getByTestId('job-picker')
    expect(picker.getAttribute('data-mode')).toBe('move')
    expect(picker.getAttribute('data-exclude')).toBe('j1')
    fireEvent.click(screen.getByRole('button', { name: 'pick J900' }))
    await waitFor(() => expect(io.calls.find((c) => c.fn === 'putPaintedMapOnJob')?.args).toEqual(['m1', 'j9']))
    await waitFor(() => expect(screen.queryByTestId('job-picker')).toBeNull())
  })

  it('says why a move was refused, on the map and not under the picker', async () => {
    io.whole = { map: { ...MAP, createdBy: 'me' }, lines: [LINE({ madeBy: 'me' })], places: [] }
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Move it to another job…' }))
    io.refuse = 'The map was not put on the job.'
    fireEvent.click(screen.getByRole('button', { name: 'pick J900' }))
    expect(await screen.findByText('The map was not put on the job.')).toBeTruthy()
    expect(screen.queryByTestId('job-picker')).toBeNull()
  })

  it('is not offered on someone else\'s map to a teammate who is not the office', async () => {
    io.whole = { map: MAP, lines: [LINE()], places: [] }
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    await screen.findByRole('heading', { name: 'The way in for deliveries' })
    expect(screen.queryByRole('button', { name: 'Move it to another job…' })).toBeNull()
  })

  it('is not offered on a map that is for every lot', async () => {
    io.whole = { map: { ...MAP, jobId: null, developmentId: 'd1', createdBy: 'me' }, lines: [LINE({ madeBy: 'me' })], places: [] }
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    await screen.findByRole('heading', { name: 'The way in for deliveries' })
    expect(screen.queryByRole('button', { name: 'Move it to another job…' })).toBeNull()
  })
})

describe('sharing a map', () => {
  it('offers Share to whoever painted the map, and opens the sheet for that map', async () => {
    io.whole = { map: { ...MAP, createdBy: 'me' }, lines: [LINE({ madeBy: 'me' })], places: [] }
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Share' }))
    expect(screen.getByTestId('share-sheet').textContent).toContain('share:m1:The way in for deliveries')
    fireEvent.click(screen.getByRole('button', { name: 'close the sheet' }))
    expect(screen.queryByTestId('share-sheet')).toBeNull()
  })

  it('offers Share to the office on anyone\'s map', async () => {
    auth.value = { user: { id: 'me' }, role: 'assistant' }
    io.whole = { map: MAP, lines: [LINE()], places: [] }
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    expect(await screen.findByRole('button', { name: 'Share' })).toBeTruthy()
  })

  it('does not offer Share on someone else\'s map to a teammate who is not the office', async () => {
    io.whole = { map: MAP, lines: [LINE()], places: [] }
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    await screen.findByRole('heading', { name: 'The way in for deliveries' })
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull()
  })

  it('does not offer Share on a map with nothing on it', async () => {
    io.whole = { map: { ...MAP, createdBy: 'me' }, lines: [], places: [] }
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    await screen.findByRole('heading', { name: 'The way in for deliveries' })
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull()
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

  it('a map that is only opened has no Saved band, and a place added to it brings one (punch list #392)', async () => {
    device.phone = true
    io.whole = { map: { ...MAP, createdBy: 'me' }, lines: [LINE({ madeBy: 'me' })], places: [] }
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: '＋ Place' }))
    expect(screen.queryByTestId('saved-band')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Gate' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add this place' }))
    const band = await screen.findByTestId('saved-band')
    // The job's words are not known for a map opened later.
    expect(band.textContent).toContain('Saved on its job|')
    expect(band.textContent).toContain('1 place. Anyone on the job can open it.')
    expect(band.getAttribute('data-offers-text')).toBe('yes')
  })

  it('someone else\'s map says saved to a teammate who added a place, with no text press', async () => {
    device.phone = true
    io.whole = { map: MAP, lines: [LINE()], places: [] }
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: '＋ Place' }))
    fireEvent.click(screen.getByRole('button', { name: 'Gate' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add this place' }))
    const band = await screen.findByTestId('saved-band')
    expect(band.getAttribute('data-offers-text')).toBe('no')
  })

  it('keeps the phone\'s margin only while the dot sits on the reading', async () => {
    io.whole = { map: MAP, lines: [], places: [] }
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: '＋ Place' }))
    fireEvent.click(screen.getByRole('button', { name: 'Put the dot where I am' }))
    await waitFor(() => expect(document.querySelector('[data-painted-place-fix="read"]')?.textContent).toBe('Precise Location is on. Sure within 20 ft.'))
    expect(screen.getByTestId('canvas').textContent).toContain('dot:29.6,-98.3')
    fireEvent.click(screen.getByRole('button', { name: 'drag the dot' }))
    expect(screen.getByRole('status').textContent).toBe('You moved the dot. The place is where the dot is now.')
    expect(document.querySelector('[data-precise]')).toBeNull()
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

  it('leaves the dot where it is on a rough reading, and shows the way to the switch (#402)', async () => {
    io.whole = { map: MAP, lines: [], places: [] }
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: '＋ Place' }))
    expect(screen.getByTestId('canvas').textContent).toContain('dot:29.55,-98.25')
    // The phone gives the middle of an area miles off, sure only within 2 miles.
    here.fix = { lat: 29.9, lng: -98.9, accuracyM: 3200 }
    fireEvent.click(screen.getByRole('button', { name: 'Put the dot where I am' }))
    const alert = await screen.findByRole('alert')
    expect(screen.getByTestId('canvas').textContent).toContain('dot:29.55,-98.25')
    expect(alert.querySelector('b')?.textContent).toBe('Precise Location looks off.')
    expect(alert.querySelector('[data-precise-compare]')?.textContent).toBe('Your phone nowwithin 2 milesWith Precise Location onwithin 20 ft')
    expect(alert.querySelector('[data-precise-note]')?.textContent).toBe('The dot was not moved. Drag it onto the spot by hand, or turn the switch on and press again.')
    expect(alert.querySelectorAll('ol[data-precise-steps] li')).toHaveLength(5)
    expect(alert.textContent).not.toMatch(/is off/)
    // The press is ready again, and the place can still be added where the dot is: no margin goes with it.
    expect(screen.getByRole('button', { name: 'Put the dot where I am' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Add this place' }))
    await waitFor(() => expect(names()).toContain('addPaintedPlace'))
    expect(io.calls.find((c) => c.fn === 'addPaintedPlace')!.args[1]).toMatchObject({ lat: 29.55, lng: -98.25, accuracyM: null })
  })

  it('moves the dot once the switch is on and the press is made again', async () => {
    io.whole = { map: MAP, lines: [], places: [] }
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: '＋ Place' }))
    here.fix = { lat: 29.9, lng: -98.9, accuracyM: 3200 }
    fireEvent.click(screen.getByRole('button', { name: 'Put the dot where I am' }))
    await screen.findByRole('alert')
    here.fix = { lat: 29.6, lng: -98.3, accuracyM: 4.5 }
    fireEvent.click(screen.getByRole('button', { name: 'Put the dot where I am' }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(screen.getByTestId('canvas').textContent).toContain('dot:29.6,-98.3')
    expect(document.querySelector('[data-painted-place-fix="read"]')?.textContent).toBe('Precise Location is on. Sure within 15 ft.')
  })

  it('keeps a good reading’s dot and margin when a later press gets a rough one', async () => {
    io.whole = { map: MAP, lines: [], places: [] }
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: '＋ Place' }))
    fireEvent.click(screen.getByRole('button', { name: 'Put the dot where I am' }))
    await waitFor(() => expect(screen.getByTestId('canvas').textContent).toContain('dot:29.6,-98.3'))
    here.fix = { lat: 29.9, lng: -98.9, accuracyM: 3200 }
    fireEvent.click(screen.getByRole('button', { name: 'Put the dot where I am' }))
    await screen.findByRole('alert')
    expect(screen.getByTestId('canvas').textContent).toContain('dot:29.6,-98.3')
    fireEvent.click(screen.getByRole('button', { name: 'Add this place' }))
    await waitFor(() => expect(names()).toContain('addPaintedPlace'))
    expect(io.calls.find((c) => c.fn === 'addPaintedPlace')!.args[1]).toMatchObject({ lat: 29.6, lng: -98.3, accuracyM: 5 })
  })

  it('moves the dot on a weak reading and asks for a drag the rest of the way', async () => {
    io.whole = { map: MAP, lines: [], places: [] }
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: '＋ Place' }))
    here.fix = { lat: 29.6, lng: -98.3, accuracyM: 35 }
    fireEvent.click(screen.getByRole('button', { name: 'Put the dot where I am' }))
    await waitFor(() => expect(screen.getByTestId('canvas').textContent).toContain('dot:29.6,-98.3'))
    expect(document.querySelector('[data-painted-place-fix="read"]')?.textContent).toBe('Precise Location is on, but the signal is weak here. Your phone is only sure within 120 ft. Drag the dot onto the spot.')
    expect(screen.queryByRole('alert')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Add this place' }))
    await waitFor(() => expect(names()).toContain('addPaintedPlace'))
    expect(io.calls.find((c) => c.fn === 'addPaintedPlace')!.args[1]).toMatchObject({ lat: 29.6, lng: -98.3, accuracyM: 35 })
  })

  it('names no switch on a desk, where the dot is not moved either', async () => {
    browser.kind = 'other'
    io.whole = { map: MAP, lines: [], places: [] }
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: '＋ Place' }))
    here.fix = { lat: 29.9, lng: -98.9, accuracyM: 3200 }
    fireEvent.click(screen.getByRole('button', { name: 'Put the dot where I am' }))
    const alert = await screen.findByRole('alert')
    expect(screen.getByTestId('canvas').textContent).toContain('dot:29.55,-98.25')
    expect(alert.querySelector('b')?.textContent).toBe('This device only knows the area it is in.')
    expect(alert.querySelector('[data-precise-note]')?.textContent).toBe(' The dot was not moved. Drag it onto the spot by hand.')
    expect(alert.textContent).not.toMatch(/switch/)
  })

  it('forgets a rough reading when the place panel closes', async () => {
    io.whole = { map: MAP, lines: [], places: [] }
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: '＋ Place' }))
    here.fix = { lat: 29.9, lng: -98.9, accuracyM: 3200 }
    fireEvent.click(screen.getByRole('button', { name: 'Put the dot where I am' }))
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(await screen.findByRole('button', { name: '＋ Place' }))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(document.querySelector('[data-precise]')).toBeNull()
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
    // The place was set by a reading days ago. Its margin is kept with it, and says nothing of this phone now (#402).
    expect(document.querySelector('[data-precise]')).toBeNull()
    expect(screen.getByText(/Drag the blue dot onto the spot, or press the map to bring it there\./)).toBeTruthy()
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Truck gate')
    fireEvent.click(screen.getByRole('button', { name: 'drag the dot' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save the place' }))
    await waitFor(() => expect(names()).toContain('savePaintedPlace'))
    expect(io.calls.find((c) => c.fn === 'savePaintedPlace')!.args).toEqual(['p1', { name: 'Truck gate', words: 'Close it behind you.', lat: 29.7, lng: -98.4, accuracyM: null, photoPath: 'm1/gate.jpg' }])
    // The photo it already had is kept, not sent again and not removed.
    expect(names()).not.toContain('uploadPaintedPlacePhoto')
    expect(names()).not.toContain('removePaintedPlacePhotoFile')
  })

  it('gives a place a kind from a chip: its mark is on the row and goes to the map (#393)', async () => {
    io.whole = { map: MAP, lines: [LINE()], places: [] }
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: '＋ Place' }))
    expect(screen.getByText('Each of these has its own mark on the map. Press one again to take it off.')).toBeTruthy()
    // A name somebody typed is theirs: the chip gives the kind and leaves the name alone.
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Open trench' } })
    const hazard = screen.getByRole('button', { name: 'Hazard' })
    expect(hazard.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(hazard)
    expect(hazard.getAttribute('aria-pressed')).toBe('true')
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Open trench')
    fireEvent.click(screen.getByRole('button', { name: 'Add this place' }))
    await waitFor(() => expect(names()).toContain('addPaintedPlace'))
    expect(io.calls.find((c) => c.fn === 'addPaintedPlace')!.args[1]).toMatchObject({ name: 'Open trench', kind: 'hazard' })
    const row = await placeRow()
    const mark = row.querySelector('[data-place-mark]')!
    expect(mark.getAttribute('data-place-mark')).toBe('hazard')
    expect(mark.getAttribute('aria-label')).toBe('Hazard, place 1')
    expect(mark.querySelector('[data-place-mark-number]')?.textContent).toBe('1')
    expect(mark.querySelector('svg path')?.getAttribute('d')).toContain('M12 4L21 19.5H3z')
    expect(screen.getByRole('button', { name: 'dot 1' }).getAttribute('data-dot-kind')).toBe('hazard')
  })

  it('a chip names a place that has no name, and a second press takes the kind and that name off (#393)', async () => {
    io.whole = { map: MAP, lines: [], places: [] }
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: '＋ Place' }))
    const name = () => (screen.getByLabelText('Name') as HTMLInputElement).value
    const pressed = () => Array.from(document.querySelectorAll('[data-place-kind][aria-pressed="true"]')).map((b) => b.getAttribute('data-place-kind'))
    fireEvent.click(screen.getByRole('button', { name: 'Gate' }))
    expect([name(), pressed()]).toEqual(['Gate', ['gate']])
    // Another chip swaps the name the first one gave.
    fireEvent.click(screen.getByRole('button', { name: 'Shutoff' }))
    expect([name(), pressed()]).toEqual(['Shutoff', ['shutoff']])
    fireEvent.click(screen.getByRole('button', { name: 'Shutoff' }))
    expect([name(), pressed()]).toEqual(['', []])
    // With no kind the place is the plain numbered dot it always was.
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'The slab' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add this place' }))
    await waitFor(() => expect(names()).toContain('addPaintedPlace'))
    expect(io.calls.find((c) => c.fn === 'addPaintedPlace')!.args[1]).toMatchObject({ name: 'The slab', kind: null })
    const mark = (await placeRow()).querySelector('[data-place-mark]')!
    expect(mark.getAttribute('data-place-mark')).toBe('plain')
    expect(mark.textContent).toBe('1')
    expect(screen.getByRole('button', { name: 'dot 1' }).getAttribute('data-dot-kind')).toBe('plain')
  })

  it('opens a place on its kind, and writes the kind only when it was changed (#393)', async () => {
    auth.value = { user: { id: 'dana' }, role: 'helpers' }
    io.whole = { map: MAP, lines: [], places: [{ ...PLACE, kind: 'gate' as const }] }
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    expect((await placeRow()).querySelector('[data-place-mark]')?.getAttribute('data-place-mark')).toBe('gate')
    fireEvent.click(screen.getByRole('button', { name: 'Change this place' }))
    expect(screen.getByRole('button', { name: 'Gate' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.change(screen.getByLabelText('A word for whoever comes next'), { target: { value: 'Chain it.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save the place' }))
    await waitFor(() => expect(names()).toContain('savePaintedPlace'))
    // The kind was not touched, so it is not sent: an older app never wipes a kind it does not know.
    expect(Object.keys(io.calls.find((c) => c.fn === 'savePaintedPlace')!.args[1] as object)).not.toContain('kind')

    io.calls = []
    fireEvent.click(await screen.findByRole('button', { name: 'Change this place' }))
    fireEvent.click(screen.getByRole('button', { name: 'Hazard' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save the place' }))
    await waitFor(() => expect(names()).toContain('savePaintedPlace'))
    expect(io.calls.find((c) => c.fn === 'savePaintedPlace')!.args[1]).toMatchObject({ name: 'Truck gate', kind: 'hazard' })
    await waitFor(() => expect(document.querySelector('[data-painted-place-row] [data-place-mark]')?.getAttribute('data-place-mark')).toBe('hazard'))
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

describe('a job\'s own list of places (#393)', () => {
  const LIST: PaintedMap = { id: 'list', name: 'Places on this job', words: '', jobId: 'j1', developmentId: null, jobList: true, createdBy: 'dana', createdAt: '2026-11-18T15:00:00Z' }
  const at = (id: string, name: string, setAt: string, kind: 'gate' | 'hazard' | null) => ({ id, mapId: 'list', name, words: name === 'Open trench' ? 'Keep the truck off it.' : '', lat: 29.5, lng: -98.2, accuracyM: null, photoPath: null, kind, setBy: 'dana', setAt })
  const GATE = at('jp1', 'Truck gate', '2026-11-18T15:01:00Z', 'gate')
  const SLAB = at('jp2', 'The slab', '2026-11-18T15:02:00Z', null)
  const TRENCH = at('jp3', 'Open trench', '2026-11-18T15:03:00Z', 'hazard')
  const listWhole = () => ({ map: LIST, lines: [], places: [GATE, SLAB, TRENCH] })
  const dot = (label: string) => screen.getByRole('button', { name: `dot ${label}` })

  it('opens in a places-only shape: letters for numbers, ＋ Place in blue, and no line to draw or walk', async () => {
    Object.defineProperty(navigator, 'geolocation', { value: {}, configurable: true })
    try {
      io.whole = listWhole()
      io.jobWholes = [listWhole()]
      render(<PaintedMapWindow ask={{ mapId: 'list' }} onClose={() => {}} />)
      await screen.findByRole('heading', { name: 'Places on this job' })
      expect(screen.getByText('These are on every painted map of this job.')).toBeTruthy()
      expect(screen.queryByRole('button', { name: 'Draw a line' })).toBeNull()
      expect(screen.queryByRole('button', { name: 'Walk or drive a line' })).toBeNull()
      expect(screen.queryByRole('button', { name: 'Directions to the start' })).toBeNull()
      expect((screen.getByRole('button', { name: '＋ Place' }) as HTMLElement).style.background).toBe('rgb(37, 99, 235)')
      // Each place wears its letter: on its mark's shoulder when it has a kind, in the dot when it has none.
      const rows = [...document.querySelectorAll('[data-painted-place-row]')]
      expect(rows.map((r) => r.querySelector('[data-place-mark]')?.getAttribute('data-place-mark'))).toEqual(['gate', 'plain', 'hazard'])
      expect(rows[0]!.querySelector('[data-place-mark-number]')?.textContent).toBe('A')
      expect(rows[1]!.querySelector('[data-place-mark]')?.textContent).toBe('B')
      expect(rows[2]!.querySelector('[data-place-mark-number]')?.textContent).toBe('C')
      // On the map they are the list's own dots: lettered, with a whole ring.
      await waitFor(() => expect(dot('A').getAttribute('data-dot-job')).toBe('no'))
      expect([dot('A'), dot('B'), dot('C')].map((d) => d.getAttribute('data-dot-kind'))).toEqual(['gate', 'plain', 'hazard'])
      // The list is not on itself a second time.
      expect(document.querySelector('[data-painted-job-places]')).toBeNull()
      // It keeps its name, and a helper cannot throw away a list that holds other people's places.
      expect(screen.queryByRole('button', { name: 'Rename this map' })).toBeNull()
      expect(screen.queryByRole('button', { name: 'Throw this map away' })).toBeNull()
      expect(screen.queryByRole('button', { name: 'Throw this list away' })).toBeNull()
    } finally {
      delete (navigator as unknown as { geolocation?: unknown }).geolocation
    }
  })

  it('says so when nothing is kept on the job yet', async () => {
    io.whole = { map: LIST, lines: [], places: [] }
    render(<PaintedMapWindow ask={{ mapId: 'list' }} onClose={() => {}} />)
    await screen.findByRole('heading', { name: 'Places on this job' })
    expect(screen.getByText('Nothing is kept on this job yet. Press ＋ Place to set the first place.')).toBeTruthy()
    expect(screen.queryByText(/Nothing is painted on this map yet/)).toBeNull()
  })

  it('lets the office alone throw the list away, with a question that says every place goes', async () => {
    auth.value = { user: { id: 'office' }, role: 'assistant' }
    io.whole = listWhole()
    render(<PaintedMapWindow ask={{ mapId: 'list' }} onClose={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Throw this list away' }))
    const ask = screen.getByRole('alertdialog')
    expect(ask.textContent).toContain('Throw this list away?')
    expect(ask.textContent).toContain('Every place kept on this job goes for everyone, with its photo. This cannot be undone.')
    expect(names()).not.toContain('deletePaintedMap')
    fireEvent.click(screen.getByRole('button', { name: 'Throw the list away' }))
    await waitFor(() => expect(io.calls.find((c) => c.fn === 'deletePaintedMap')?.args).toEqual(['list']))
    expect(screen.queryByRole('button', { name: 'Rename this map' })).toBeNull()
  })

  it('starts a job\'s list with its first place, and saves the map marked as the list', async () => {
    render(<PaintedMapWindow ask={{ start: { id: 'new-list', name: 'Places on this job', words: '', home: { jobId: 'j1' }, first: 'place', jobList: true } }} center={{ lat: 29.5, lng: -98.2 }} onClose={() => {}} />)
    expect(await screen.findByRole('heading', { name: 'A place on the map' })).toBeTruthy()
    expect(names()).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'Gate' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add this place' }))
    await waitFor(() => expect(names()).toEqual(['createPaintedMap', 'addPaintedPlace']))
    expect(io.calls[0]!.args[0]).toMatchObject({ id: 'new-list', name: 'Places on this job', jobId: 'j1', jobList: true })
    expect(io.calls[1]!.args[1]).toMatchObject({ name: 'Gate', kind: 'gate' })
    // Saved, it is the list: no line to draw, and its first place is A.
    await screen.findByRole('heading', { name: 'Places on this job' })
    expect(screen.queryByRole('button', { name: 'Draw a line' })).toBeNull()
    expect((await placeRow()).querySelector('[data-place-mark-number]')?.textContent).toBe('A')
  })

  it('opens already adding a place when the press that opened it said so', async () => {
    io.whole = listWhole()
    render(<PaintedMapWindow ask={{ mapId: 'list' }} openOn="place" onClose={() => {}} />)
    expect(await screen.findByRole('heading', { name: 'A place on the map' })).toBeTruthy()
    // The dot starts in the middle of what the map shows, as ＋ Place puts it.
    expect(screen.getByTestId('canvas').textContent).toContain('dot:29.55,-98.25')
    // Cancel goes to the list, and the panel does not open by itself a second time.
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('heading', { name: 'Places on this job' })).toBeTruthy()
  })

  it('tells the canvas it is placing from the first moment of a window opened to add a place (punch list #387)', async () => {
    io.whole = listWhole()
    render(<PaintedMapWindow ask={{ mapId: 'list' }} openOn="place" onClose={() => {}} />)
    await screen.findByRole('heading', { name: 'A place on the map' })
    // Never looking first: Google's map would be made only to be taken down when the panel opens.
    expect(canvas.uses).toEqual(['placing'])
    // Once the place is given up the window is reading its map again.
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(canvas.uses).toEqual(['placing', 'looking'])
  })

  it('draws the job\'s places on another map of the job: lettered, dashed, and under their own heading', async () => {
    const asks: PaintedMapAsk[] = []
    const stop = onPaintedMapAsk((a) => asks.push(a))
    let closed = 0
    try {
      io.whole = { map: MAP, lines: [LINE()], places: [{ id: 'p1', mapId: 'm1', name: 'Laydown yard', words: '', lat: 29.5, lng: -98.2, accuracyM: null, photoPath: null, setBy: 'dana', setAt: '2026-11-13T15:02:00Z' }] }
      io.jobWholes = [{ map: MAP, lines: [], places: [] }, listWhole()]
      render(<PaintedMapWindow ask={{ mapId: 'm1' }} address="1 Made Up Road" onClose={() => (closed += 1)} />)
      const section = await waitFor(() => {
        const el = document.querySelector('[data-painted-job-places]')
        expect(el).not.toBeNull()
        return el as HTMLElement
      })
      expect(io.jobReads).toEqual([{ jobId: 'j1' }])
      expect(section.querySelector('h3')?.textContent).toBe('On this job')
      const rows = [...section.querySelectorAll('[data-painted-job-place-row]')]
      expect(rows.map((r) => r.textContent)).toEqual(['ATruck gateCopy this placeSend more…', 'BThe slabCopy this placeSend more…', 'COpen trenchKeep the truck off it.Copy this placeSend more…'])
      expect(rows.map((r) => (r.querySelector('[data-place-mark]') as HTMLElement).getAttribute('data-place-mark'))).toEqual(['gate', 'plain', 'hazard'])
      // The plain one's ring is dashed, so it is not taken for the map's own place 1.
      expect((rows[1]!.querySelector('[data-place-mark]') as HTMLElement).style.borderStyle).toBe('dashed')
      expect(section.textContent).toContain('These are kept on the job, so they are on every map of it. A link or a copy of this map does not carry them. To send them, share Places on this job itself.')
      // The map keeps its own numbered place, and draws the job's as a second layer.
      expect((await placeRow()).textContent).toContain('Laydown yard')
      expect(dot('1').getAttribute('data-dot-job')).toBe('no')
      expect([dot('A'), dot('B'), dot('C')].map((d) => d.getAttribute('data-dot-job'))).toEqual(['yes', 'yes', 'yes'])
      // Nothing here changes a place of the job's: a row can be sent, alone or with more, and the one other press opens the list.
      expect([...section.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Copy this place', 'Send more…', 'Copy this place', 'Send more…', 'Copy this place', 'Send more…', 'Open Places on this job'])
      // Send more… from a place of the job's offers the job's places and never this map: its link does not carry them (v2.7844).
      fireEvent.click(rows[0]!.querySelector('[data-place-send-more]') as HTMLElement)
      expect([...document.querySelectorAll('[data-send-more]')].map((el) => el.textContent)).toEqual(['All 3 places on this jobCopies 3 map pins'])
      fireEvent.click(within(screen.getByRole('dialog', { name: 'Send more: Truck gate' })).getByRole('button', { name: 'Close' }))
      expect(document.querySelector('[data-place-send-more-sheet]')).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'Open Places on this job' }))
      expect(closed).toBe(1)
      await waitFor(() => expect(asks).toEqual([{ kind: 'open', mapId: 'list', address: '1 Made Up Road' }]))
    } finally {
      stop()
    }
  })

  it('reads no list for a map on no job, and shows none', async () => {
    io.whole = { map: { ...MAP, jobId: null, createdBy: 'me' }, lines: [LINE()], places: [] }
    io.jobWholes = [listWhole()]
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    await screen.findByRole('button', { name: 'Draw a line' })
    expect(io.jobReads).toEqual([])
    expect(document.querySelector('[data-painted-job-places]')).toBeNull()
  })
})

describe('one place, sent to someone (#393)', () => {
  const PLACE = { id: 'p1', mapId: 'm1', name: 'Open trench', words: 'Keep the truck off it.', lat: 29.5, lng: -98.2, accuracyM: null, photoPath: null, kind: 'hazard' as const, setBy: 'dana', setAt: '2026-11-13T15:02:00Z' }
  const WORDS = 'Hazard: Open trench. Keep the truck off it.\nhttps://www.google.com/maps/search/?api=1&query=29.500000,-98.200000'
  const onAPhone = (run: () => Promise<void>) => async () => {
    const was = Object.getOwnPropertyDescriptor(navigator, 'userAgent')
    Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', configurable: true })
    try {
      await run()
    } finally {
      if (was) Object.defineProperty(navigator, 'userAgent', was)
      else delete (navigator as unknown as { userAgent?: string }).userAgent
    }
  }

  it('on a phone, a place\'s press is a link that opens Messages with the place in words and a map link to the spot', onAPhone(async () => {
    // Dana set it and I did not: sending a place is anyone's who can see it.
    io.whole = { map: MAP, lines: [], places: [PLACE] }
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    const row = await placeRow()
    expect(screen.queryByRole('button', { name: 'Change this place' })).toBeNull()
    const link = row.querySelector('[data-place-share="text"]') as HTMLAnchorElement
    expect(link.textContent).toBe('Text this place…')
    // Nobody is picked: the sender picks who gets it, in their own Messages.
    expect(link.getAttribute('href')!.startsWith('sms:?&body=')).toBe(true)
    expect(decodeURIComponent(link.getAttribute('href')!.slice('sms:?&body='.length))).toBe(WORDS)
    // Nothing is sent by the app, and no link into the app is made for it.
    expect(names()).toEqual(['loadPaintedMap'])
  }))

  it('at a desk, the press copies the same words and says so', async () => {
    const copied: string[] = []
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t: string) => void copied.push(t) }, configurable: true })
    try {
      io.whole = { map: MAP, lines: [], places: [PLACE] }
      render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
      const row = await placeRow()
      expect(row.querySelector('[data-place-share="text"]')).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'Copy this place' }))
      await waitFor(() => expect(copied).toEqual([WORDS]))
      expect(row.querySelector('[data-place-share-said]')?.textContent).toBe('Copied. Paste it into a text or an email.')
    } finally {
      delete (navigator as unknown as { clipboard?: unknown }).clipboard
    }
  })

  it('says so when the browser will not copy', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('denied') } }, configurable: true })
    try {
      io.whole = { map: MAP, lines: [], places: [PLACE] }
      render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
      await placeRow()
      fireEvent.click(screen.getByRole('button', { name: 'Copy this place' }))
      expect((await screen.findByText('This browser would not copy it. Open the map on a phone and press Text this place….')).getAttribute('role')).toBe('status')
    } finally {
      delete (navigator as unknown as { clipboard?: unknown }).clipboard
    }
  })

  it('a place kept on the job can be sent from any map of the job', onAPhone(async () => {
    const LIST: PaintedMap = { id: 'list', name: 'Places on this job', words: '', jobId: 'j1', developmentId: null, jobList: true, createdBy: 'dana', createdAt: '2026-11-18T15:00:00Z' }
    io.whole = { map: MAP, lines: [LINE()], places: [] }
    io.jobWholes = [{ map: LIST, lines: [], places: [{ ...PLACE, id: 'jp1', mapId: 'list', name: 'Truck gate', words: '', kind: 'gate' as const }] }]
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    const row = await waitFor(() => {
      const el = document.querySelector('[data-painted-job-place-row]')
      expect(el).not.toBeNull()
      return el as HTMLElement
    })
    const href = (row.querySelector('[data-place-share="text"]') as HTMLAnchorElement).getAttribute('href')!
    // A name that says its kind is not said twice.
    expect(decodeURIComponent(href.slice('sms:?&body='.length))).toBe('Truck gate.\nhttps://www.google.com/maps/search/?api=1&query=29.500000,-98.200000')
  }))
})

describe('Send more…, from a place\'s row (v2.7844)', () => {
  const at = (id: string, name: string, photoPath: string | null = null) => ({ id, mapId: 'm1', name, words: '', lat: 29.5, lng: -98.2, accuracyM: null, photoPath, kind: null, setBy: 'dana', setAt: `2026-11-13T15:0${id.slice(1)}:00Z` })
  const ways = () => [...document.querySelectorAll('[data-send-more]')].map((el) => el.textContent)
  const openMore = (row: Element) => fireEvent.click(row.querySelector('[data-place-send-more]') as HTMLElement)

  it('is not drawn on a map\'s one place for someone who may not share the map', async () => {
    // Dana painted it and I am not the office: I can send the place, and there is nothing more of mine to send.
    io.whole = { map: MAP, lines: [LINE()], places: [at('p1', 'Truck gate')] }
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    const row = await placeRow()
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull()
    expect(row.querySelector('[data-place-share="copy"]')).not.toBeNull()
    expect(row.querySelector('[data-place-send-more]')).toBeNull()
  })

  it('offers every place of the map to anyone who can see them, and the map only to whoever may share it', async () => {
    io.whole = { map: MAP, lines: [LINE()], places: [at('p1', 'Truck gate'), at('p2', 'The slab')] }
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    const row = await placeRow()
    openMore(row)
    expect(ways()).toEqual(['Both places on this mapCopies 2 map pins'])
  })

  it('opens the map\'s own Share from The whole map, for its maker', async () => {
    auth.value = { user: { id: 'dana' }, role: 'helpers' }
    io.whole = { map: MAP, lines: [LINE()], places: [at('p1', 'Truck gate'), at('p2', 'The slab')] }
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    const row = await placeRow()
    openMore(row)
    expect(ways()).toEqual(['Both places on this mapCopies 2 map pins', 'The whole mapWith its lines and photos. They give their name first.'])
    expect(screen.queryByTestId('share-sheet')).toBeNull()
    fireEvent.click(document.querySelector('[data-send-more="map"]') as HTMLElement)
    expect(document.querySelector('[data-place-send-more-sheet]')).toBeNull()
    expect(screen.getByTestId('share-sheet').textContent).toContain('share:m1:The way in for deliveries')
  })

  it('never offers this map from a place of the job\'s, even to the map\'s maker: its link does not carry that place', async () => {
    const LIST: PaintedMap = { id: 'list', name: 'Places on this job', words: '', jobId: 'j1', developmentId: null, jobList: true, createdBy: 'dana', createdAt: '2026-11-18T15:00:00Z' }
    auth.value = { user: { id: 'dana' }, role: 'helpers' }
    io.whole = { map: MAP, lines: [LINE()], places: [at('p1', 'Laydown yard')] }
    io.jobWholes = [{ map: MAP, lines: [], places: [] }, { map: LIST, lines: [], places: [at('p2', 'Truck gate'), at('p3', 'The slab')].map((p) => ({ ...p, mapId: 'list' })) }]
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    const jobRow = await waitFor(() => {
      const el = document.querySelector('[data-painted-job-place-row]')
      expect(el).not.toBeNull()
      return el as HTMLElement
    })
    // Dana may share this map: her own place's row offers it.
    expect(screen.getByRole('button', { name: 'Share' })).toBeTruthy()
    openMore(await placeRow())
    expect(ways()).toEqual(['The whole mapWith its lines and photos. They give their name first.'])
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Send more: Laydown yard' })).getByRole('button', { name: 'Close' }))
    openMore(jobRow)
    expect(ways()).toEqual(['Both places on this jobCopies 2 map pins'])
  })

  it('says a place\'s photo stays behind, and at a desk offers no way to carry it', async () => {
    io.whole = { map: MAP, lines: [], places: [at('p1', 'Truck gate', 'm1/gate.jpg')] }
    render(<PaintedMapWindow ask={{ mapId: 'm1' }} onClose={() => {}} />)
    const row = await placeRow()
    expect(row.querySelector('[data-place-no-photo]')?.textContent).toBe('A copy carries the spot, not the photo.')
    expect(row.querySelector('[data-place-send-more]')).toBeNull()
  })

  it('on the job\'s own list, names the places as the job\'s and the map as a list', async () => {
    const LIST: PaintedMap = { id: 'list', name: 'Places on this job', words: '', jobId: 'j1', developmentId: null, jobList: true, createdBy: 'dana', createdAt: '2026-11-18T15:00:00Z' }
    auth.value = { user: { id: 'dana' }, role: 'helpers' }
    const places = [at('p1', 'Truck gate'), at('p2', 'The slab'), at('p3', 'Open trench')].map((p) => ({ ...p, mapId: 'list' }))
    io.whole = { map: LIST, lines: [], places }
    io.jobWholes = [{ map: LIST, lines: [], places }]
    render(<PaintedMapWindow ask={{ mapId: 'list' }} onClose={() => {}} />)
    const row = await placeRow()
    openMore(row)
    expect(ways()).toEqual(['All 3 places on this jobCopies 3 map pins', 'The whole listWith its photos. They give their name first.'])
  })
})
