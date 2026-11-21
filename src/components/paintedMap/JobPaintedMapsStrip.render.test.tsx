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
  paintedPlacePhotoUrls: async (paths: Array<string | null>) => new Map(paths.filter((p): p is string => !!p).map((p) => [p, `https://signed.test/${p}`])),
}))
/** The places earlier jobs kept at this job's address, and the opens that were counted. */
const kept = vi.hoisted(() => ({ lists: [] as unknown[], asked: [] as string[], opened: [] as string[], fails: false }))
vi.mock('../../lib/paintedMap/paintedAddressPlacesIo', () => ({
  loadAddressPlaceLists: async (jobId: string) => {
    kept.asked.push(jobId)
    return kept.fails ? { ok: false, error: 'No signal.' } : { ok: true, value: kept.lists }
  },
  notePaintedPlaceOpened: (placeId: string) => {
    kept.opened.push(placeId)
  },
}))

const phone = vi.hoisted(() => ({ reads: 0, answer: { ok: true, fix: { lat: 29.5004, lng: -98.2004, accuracyM: 6 } } as unknown }))
vi.mock('../../lib/paintedMap/paintedSpotIo', () => ({
  readSpotNow: async () => {
    phone.reads += 1
    return phone.answer
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
  phone.reads = 0
  kept.lists = []
  kept.asked = []
  kept.opened = []
  kept.fails = false
  phone.answer = { ok: true, fix: { lat: 29.5004, lng: -98.2004, accuracyM: 6 } }
})

/** A job's own list of places: a painted map marked as the list, with so many places. */
const listWhole = (id: string, jobId: string, placeCount: number, createdAt: string): PaintedMapWhole => {
  const w = whole(id, 'Places on this job', { jobId }, 0, placeCount)
  return { ...w, map: { ...w.map, jobList: true, createdAt }, places: w.places.map((p, i) => ({ ...p, kind: i === 0 ? 'gate' : null })) }
}

describe('the job\'s own list of places (#393)', () => {
  it('has a line of its own, apart from the painted maps, and opens the list', async () => {
    listen()
    io.answer = { ok: true, value: [whole('way', 'The way in', { jobId: 'j1' }, 265, 2), listWhole('list', 'j1', 3, '2026-11-18T15:00:00Z')] }
    render(<JobPaintedMapsStrip jobId="j1" jobLabel="Lot 14" address="1 Made Up Road" />)
    await waitFor(() => expect(document.querySelector('[data-job-places-line]')).not.toBeNull())
    // The list is not counted among the maps somebody painted.
    expect([...document.querySelectorAll('[data-painted-map-line]')].map((e) => e.textContent)).toEqual(['The way inabout 870 ft · 2 places ›'])
    const line = document.querySelector('[data-job-places-line]') as HTMLElement
    expect(line.textContent).toBe('APlaces on this job3 places ›')
    expect(line.querySelector('[data-place-mark]')?.getAttribute('data-place-mark')).toBe('gate')
    fireEvent.click(line)
    expect(asks).toEqual([{ kind: 'open', mapId: 'list', address: '1 Made Up Road' }])
  })

  it('＋ Place on this job opens the job\'s list already adding a place', async () => {
    listen()
    io.answer = { ok: true, value: [listWhole('list', 'j1', 1, '2026-11-18T15:00:00Z')] }
    render(<JobPaintedMapsStrip jobId="j1" jobLabel="Lot 14" address="1 Made Up Road" />)
    await waitFor(() => expect(document.querySelector('[data-job-places-line]')).not.toBeNull())
    fireEvent.click(screen.getByRole('button', { name: '＋ Place on this job' }))
    expect(asks).toEqual([{ kind: 'open', mapId: 'list', address: '1 Made Up Road', add: 'place' }])
  })

  it('with no list yet, the press starts one that is saved with its first place, and no line shows', async () => {
    listen()
    render(<JobPaintedMapsStrip jobId="j1" developmentId="d1" jobLabel="Lot 14" address="1 Made Up Road" />)
    await waitFor(() => expect(io.calls).toBe(1))
    expect(document.querySelector('[data-job-places-line]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '＋ Place on this job' }))
    expect(asks).toHaveLength(1)
    const ask = asks[0] as Extract<PaintedMapAsk, { kind: 'paint' }>
    expect(ask.kind).toBe('paint')
    // A list is its job's own: it never hangs on the development, and it opens on a place, not a line.
    expect(ask.start).toMatchObject({ name: 'Places on this job', words: '', first: 'place', jobList: true, home: { jobId: 'j1', developmentId: null, label: 'Lot 14', address: '1 Made Up Road' } })
    expect(typeof ask.start.id).toBe('string')
    expect(ask.start.id.length).toBeGreaterThan(8)
  })

  it('reads two lists on one job as one, and opens the older', async () => {
    listen()
    io.answer = { ok: true, value: [listWhole('list-new', 'j1', 2, '2026-11-18T17:00:00Z'), listWhole('list-old', 'j1', 1, '2026-11-18T16:00:00Z')] }
    render(<JobPaintedMapsStrip jobId="j1" address={null} />)
    await waitFor(() => expect(document.querySelector('[data-job-places-line]')).not.toBeNull())
    expect(document.querySelectorAll('[data-job-places-line]')).toHaveLength(1)
    expect(document.querySelector('[data-job-places-line]')?.textContent).toContain('3 places ›')
    fireEvent.click(document.querySelector('[data-job-places-line]') as HTMLElement)
    expect(asks).toEqual([{ kind: 'open', mapId: 'list-old', address: null }])
  })

  it('shows the list\'s line on a sheet that shows the maps alone, with no press to add', async () => {
    io.answer = { ok: true, value: [listWhole('list', 'j1', 2, '2026-11-18T15:00:00Z')] }
    render(<JobPaintedMapsStrip jobId="j1" only="maps" />)
    await waitFor(() => expect(document.querySelector('[data-job-places-line]')).not.toBeNull())
    expect(screen.queryByRole('button', { name: '＋ Place on this job' })).toBeNull()
    expect(screen.queryByRole('button', { name: '＋ Paint a map' })).toBeNull()
  })

  it('leaves a list with nothing on it off the strip', async () => {
    io.answer = { ok: true, value: [listWhole('list', 'j1', 0, '2026-11-18T15:00:00Z')] }
    render(<JobPaintedMapsStrip jobId="j1" />)
    await waitFor(() => expect(io.calls).toBe(1))
    expect(document.querySelector('[data-job-places-line]')).toBeNull()
    expect(document.querySelectorAll('[data-painted-map-line]')).toHaveLength(0)
  })
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

/**
 * Photo of a spot (punch list #413): the camera first. The press opens the camera and reads the phone once in the
 * same press, and the photo that comes back opens the job's list already adding a place, with the photo and the
 * reading of that moment.
 */
describe('Photo of a spot (#413)', () => {
  const press = () => document.querySelector('[data-job-spot]') as HTMLButtonElement
  const input = () => document.querySelector('[data-job-spot-input]') as HTMLInputElement
  const photo = (lastModified = Date.now()) => new File(['x'], 'spot.jpg', { type: 'image/jpeg', lastModified })
  const choose = (file: File) => fireEvent.change(input(), { target: { files: [file] } })

  it('is a press of its own, before Paint a map and Place on this job', async () => {
    render(<JobPaintedMapsStrip jobId="j1" jobLabel="Lot 14" address="1 Made Up Road" />)
    await waitFor(() => expect(io.calls).toBe(1))
    expect(press().textContent).toBe('Photo of a spot')
    expect([...document.querySelectorAll('[data-job-spot], [data-paint-a-map], [data-job-place-add]')].map((b) => b.textContent)).toEqual(['Photo of a spot', '＋ Paint a map', '＋ Place on this job'])
    expect(input().accept).toBe('image/*')
    expect(input().getAttribute('aria-label')).toBe('Photo of a spot on this job')
  })

  it('on a phone is the full width and 56 px tall, over the two quiet presses', async () => {
    render(<JobPaintedMapsStrip jobId="j1" jobLabel="Lot 14" address="1 Made Up Road" addCentred />)
    await waitFor(() => expect(io.calls).toBe(1))
    expect(document.querySelectorAll('[data-job-spot]')).toHaveLength(1)
    expect(press().style.minHeight).toBe('56px')
    expect(press().style.width).toBe('100%')
  })

  it('opens the camera and reads the phone once, in the one press', async () => {
    render(<JobPaintedMapsStrip jobId="j1" jobLabel="Lot 14" address="1 Made Up Road" />)
    await waitFor(() => expect(io.calls).toBe(1))
    let opened = 0
    input().click = () => {
      opened += 1
    }
    fireEvent.click(press())
    expect(opened).toBe(1)
    expect(phone.reads).toBe(1)
  })

  it('with no list yet, starts one that is saved with this first place, and hands it the photo and the reading', async () => {
    listen()
    render(<JobPaintedMapsStrip jobId="j1" jobLabel="Lot 14" address="1 Made Up Road" />)
    await waitFor(() => expect(io.calls).toBe(1))
    input().click = () => {}
    fireEvent.click(press())
    const file = photo(1_800_000_000_000)
    choose(file)
    expect(asks).toHaveLength(1)
    const ask = asks[0] as Extract<PaintedMapAsk, { kind: 'paint' }>
    expect(ask.kind).toBe('paint')
    expect(ask.start).toMatchObject({ name: 'Places on this job', first: 'place', jobList: true, home: { jobId: 'j1', label: 'Lot 14', address: '1 Made Up Road' } })
    expect(ask.start.spot?.file).toBe(file)
    expect(ask.start.spot?.takenMs).toBe(1_800_000_000_000)
    expect(await ask.start.spot?.reading).toEqual({ ok: true, fix: { lat: 29.5004, lng: -98.2004, accuracyM: 6 } })
    // The press read the phone. The photo coming back did not read it again.
    expect(phone.reads).toBe(1)
  })

  it('with a list, opens it already adding a place, with the photo', async () => {
    listen()
    io.answer = { ok: true, value: [listWhole('list', 'j1', 2, '2026-11-18T15:00:00Z')] }
    render(<JobPaintedMapsStrip jobId="j1" jobLabel="Lot 14" address="1 Made Up Road" />)
    await waitFor(() => expect(document.querySelector('[data-job-places-line]')).not.toBeNull())
    input().click = () => {}
    fireEvent.click(press())
    const file = photo()
    choose(file)
    expect(asks).toHaveLength(1)
    const ask = asks[0] as Extract<PaintedMapAsk, { kind: 'open' }>
    expect(ask).toMatchObject({ kind: 'open', mapId: 'list', address: '1 Made Up Road', add: 'place' })
    expect(ask.spot?.file).toBe(file)
  })

  it('hands on why no reading came, and still opens the sheet with the photo', async () => {
    listen()
    phone.answer = { ok: false, why: 'refused' }
    render(<JobPaintedMapsStrip jobId="j1" jobLabel="Lot 14" address="1 Made Up Road" />)
    await waitFor(() => expect(io.calls).toBe(1))
    input().click = () => {}
    fireEvent.click(press())
    choose(photo())
    const ask = asks[0] as Extract<PaintedMapAsk, { kind: 'paint' }>
    expect(await ask.start.spot?.reading).toEqual({ ok: false, why: 'refused' })
  })

  it('a camera put down with no photo opens nothing', async () => {
    listen()
    render(<JobPaintedMapsStrip jobId="j1" jobLabel="Lot 14" address="1 Made Up Road" />)
    await waitFor(() => expect(io.calls).toBe(1))
    input().click = () => {}
    fireEvent.click(press())
    fireEvent.change(input(), { target: { files: [] } })
    expect(asks).toHaveLength(0)
  })

  it('is not on a sheet that shows the maps alone', async () => {
    io.answer = { ok: true, value: [whole('way', 'The way in', { jobId: 'j1' }, 265, 2)] }
    render(<JobPaintedMapsStrip jobId="j1" only="maps" />)
    await waitFor(() => expect(document.querySelector('[data-painted-map-line]')).not.toBeNull())
    expect(press()).toBeNull()
    expect(input()).toBeNull()
  })
})

/**
 * Places kept at this address, and each place as a row (punch list #413, steps 4 and 5). An earlier job at the same
 * customer address kept a list of places, and this job reads it under its own lines. With `rows` each place is a row
 * with its photo, and a press on a row opens its list on that place and counts an open.
 */
describe('places kept at this address, and each place as a row (#413)', () => {
  const jp = (id: string, mapId: string, letter: string, name: string, more: Record<string, unknown> = {}) => ({ id, mapId, name, words: '', lat: 29.5, lng: -98.2, accuracyM: null, photoPath: null, kind: null, setBy: 'u9', setAt: '2026-11-21T15:00:00Z', number: letter.charCodeAt(0) - 64, letter, ...more })
  const earlier = (places: unknown[], jobLabel: string | null = '4135 Sewer line') => ({ map: { id: 'old-list', name: 'Places on this job', words: '', jobId: 'j0', developmentId: null, jobList: true, createdBy: 'u9', createdAt: '2026-11-21T15:00:00Z' }, places, jobLabel })
  const rowsOf = (listId: string) => [...document.querySelectorAll(`[data-job-place-rows="${listId}"] [data-job-place-row]`)] as HTMLButtonElement[]

  it('asks for the lists kept at this job’s address, and shows a line for one with the job that kept it', async () => {
    listen()
    kept.lists = [earlier([jp('p1', 'old-list', 'A', 'Meter'), jp('p2', 'old-list', 'B', 'Cleanout', { kind: 'cleanout' })])]
    render(<JobPaintedMapsStrip jobId="j1" jobLabel="Drain call" address="1 Made Up Road" />)
    await waitFor(() => expect(document.querySelector('[data-address-places-line]')).not.toBeNull())
    expect(kept.asked).toEqual(['j1'])
    const line = document.querySelector('[data-address-places-line]') as HTMLButtonElement
    expect(line.textContent).toBe('AKept at this address2 places · from 4135 Sewer line, Nov 2026 ›')
    expect(line.style.borderStyle).toBe('dashed')
    // No rows on a strip that was not asked for them.
    expect(document.querySelector('[data-job-place-row]')).toBeNull()
    fireEvent.click(line)
    expect(asks).toEqual([{ kind: 'open', mapId: 'old-list', address: '1 Made Up Road' }])
  })

  it('says the month alone when the reader cannot read the job that kept the list', async () => {
    kept.lists = [earlier([jp('p1', 'old-list', 'A', 'Meter')], null)]
    render(<JobPaintedMapsStrip jobId="j1" />)
    await waitFor(() => expect(document.querySelector('[data-address-places-line]')).not.toBeNull())
    expect(document.querySelector('[data-address-places-line]')?.textContent).toBe('AKept at this address1 place · kept Nov 2026 ›')
  })

  it('a read of the address that fails shows none, and the job’s own maps still stand', async () => {
    kept.fails = true
    io.answer = { ok: true, value: [whole('way', 'The way in', { jobId: 'j1' }, 265, 2)] }
    render(<JobPaintedMapsStrip jobId="j1" />)
    await waitFor(() => expect(document.querySelector('[data-painted-map-line]')).not.toBeNull())
    await waitFor(() => expect(kept.asked).toEqual(['j1']))
    expect(document.querySelector('[data-address-places-line]')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('shows on a sheet that shows the maps alone, where a tech reads the way in before driving', async () => {
    kept.lists = [earlier([jp('p1', 'old-list', 'A', 'Meter')])]
    render(<JobPaintedMapsStrip jobId="j1" only="maps" />)
    await waitFor(() => expect(document.querySelector('[data-address-places-line]')).not.toBeNull())
    expect(document.querySelector('[data-job-spot]')).toBeNull()
  })

  it('with rows, draws each place of the earlier list with its photo, its mark and the start of its words', async () => {
    const long = '4 in. PVC sewer, from the house to the tap at the street. About 4 ft deep at the walk and 6 ft at the curb. It runs straight.'
    kept.lists = [earlier([jp('p1', 'old-list', 'A', 'Meter'), jp('p2', 'old-list', 'B', 'Buried sewer line', { kind: 'buried_sewer', words: long, photoPath: 'old-list/line.jpg' })])]
    render(<JobPaintedMapsStrip jobId="j1" rows address="1 Made Up Road" />)
    await waitFor(() => expect(rowsOf('old-list')).toHaveLength(2))
    const [meter, line] = rowsOf('old-list')
    expect(meter!.getAttribute('aria-label')).toBe('Meter: open this place')
    expect(meter!.style.minHeight).toBe('64px')
    expect(meter!.querySelector('img')).toBeNull()
    await waitFor(() => expect(line!.querySelector('img')?.getAttribute('src')).toBe('https://signed.test/old-list/line.jpg'))
    expect(line!.querySelector('[data-place-mark]')?.getAttribute('data-place-mark')).toBe('buried_sewer')
    expect(line!.textContent).toContain('Buried sewer line')
    expect(line!.textContent).toContain('4 in. PVC sewer, from the house to the tap at the street.')
    expect(line!.textContent).not.toContain('It runs straight.')
  })

  it('a press on a row opens its list on that place and counts an open', async () => {
    listen()
    kept.lists = [earlier([jp('p1', 'old-list', 'A', 'Meter'), jp('p2', 'old-list', 'B', 'Cleanout')])]
    render(<JobPaintedMapsStrip jobId="j1" rows address="1 Made Up Road" />)
    await waitFor(() => expect(rowsOf('old-list')).toHaveLength(2))
    fireEvent.click(rowsOf('old-list')[1]!)
    expect(kept.opened).toEqual(['p2'])
    expect(asks).toEqual([{ kind: 'open', mapId: 'old-list', address: '1 Made Up Road', place: 'p2' }])
  })

  it('with rows, draws the job’s own places under its own line too', async () => {
    listen()
    io.answer = { ok: true, value: [listWhole('list', 'j1', 2, '2026-11-18T15:00:00Z')] }
    render(<JobPaintedMapsStrip jobId="j1" rows address="1 Made Up Road" />)
    await waitFor(() => expect(rowsOf('list')).toHaveLength(2))
    fireEvent.click(rowsOf('list')[0]!)
    expect(asks).toEqual([{ kind: 'open', mapId: 'list', address: '1 Made Up Road', place: 'list-p0' }])
  })

  it('draws four rows of a long list and one press for the rest', async () => {
    listen()
    kept.lists = [earlier(['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((l, i) => jp(`p${i}`, 'old-list', l, `Place ${l}`)))]
    render(<JobPaintedMapsStrip jobId="j1" rows address="1 Made Up Road" />)
    await waitFor(() => expect(rowsOf('old-list')).toHaveLength(4))
    const more = document.querySelector('[data-job-place-rows-more]') as HTMLButtonElement
    expect(more.textContent).toBe('＋ 3 more ›')
    fireEvent.click(more)
    expect(asks).toEqual([{ kind: 'open', mapId: 'old-list', address: '1 Made Up Road' }])
  })
})
