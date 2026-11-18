// @vitest-environment jsdom
/**
 * A copy of a painted map (punch list #345, PR 4b; re-laid by #394): a picture and a page to print,
 * drawn through the Share sheet as a person meets them. **Make a picture** is a tile among the
 * first presses and the picture then takes the sheet alone. The page and the two files sit behind
 * **Print or a file**. A copy says the day it was made and makes the link itself when none is out,
 * so it always carries the way back. A print is filed with the job.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { NumberedPlace, PaintedLine } from '../../lib/paintedMap/paintedMap'
import type { PictureInput } from '../../lib/paintedMap/paintedMapPictureIo'

vi.mock('../../lib/sent/sentCopiesIo', () => ({ printWhenReadyAndFile: async () => true }))
vi.mock('../../lib/paintedMap/paintedMapIo', () => ({ paintedPlacePhotoUrls: async () => new Map() }))
vi.mock('../../hooks/useModalStackEntry', () => ({ useModalStackEntry: () => () => true }))
vi.mock('qrcode.react', () => ({ QRCodeSVG: () => <svg data-testid="qr" /> }))

/** The link's own calls: whether this device holds one, how many were made, and a refusal. */
const link = vi.hoisted(() => ({ held: false, minted: 0, refuse: null as string | null }))
vi.mock('../../lib/paintedMap/paintedMapLinkIo', () => ({
  loadPaintedMapVisits: async () => ({ ok: true, value: [] }),
  loadPaintedMapLinks: async () => ({ ok: true, value: link.held || link.minted > 0 ? [{ id: 'link-0', made_at: '2026-11-10T16:00:00Z', expires_at: '2999-01-01T00:00:00Z', ended_at: null, open_count: 0 }] : [] }),
  mintPaintedMapLink: async () => {
    if (link.refuse) throw new Error(link.refuse)
    link.minted += 1
    return { code: 'q7m2kd4x9p', endsOn: '2027-02-11' }
  },
  endPaintedMapLinks: async () => 1,
  rememberPaintedMapLink: () => {},
  rememberedPaintedMapLink: () => (link.held ? { code: 'q7m2kd4x9p', endsOn: '2027-02-11' } : null),
}))

import type { PaintedMapCopiesIo } from './PaintedMapCopies'
import { PaintedMapShareSheet } from './PaintedMapShareSheet'

const LINE: PaintedLine = { id: 'l1', mapId: 'm1', label: '', how: 'walked', points: [{ lat: 29.5, lng: -98.2 }, { lat: 29.501, lng: -98.2 }], poorParts: [], fixedByHand: false, lengthM: 265, marginM: 9, measuredFt: null, measuredHow: null, madeBy: 'me', madeAt: '2026-11-13T15:05:00Z' }
const PLACE = (over: Partial<NumberedPlace> = {}): NumberedPlace => ({ id: 'p1', mapId: 'm1', name: 'Truck gate', words: 'Close it behind you.', lat: 29.5, lng: -98.2, accuracyM: null, photoPath: 'm1/gate.jpg', setBy: 'me', setAt: '2026-11-13T15:10:00Z', number: 1, ...over })
const MAP = { id: 'm1', name: 'The way in for deliveries', words: 'Start at the truck gate.', jobId: 'j1' as string | null }

/** The sheet over a map, as the map's window opens it. `held` says this device already holds a link. */
const draw = (io: PaintedMapCopiesIo, over: { map?: typeof MAP; lines?: PaintedLine[]; places?: NumberedPlace[]; held?: boolean } = {}) => {
  link.held = over.held ?? false
  const map = over.map ?? MAP
  return render(<PaintedMapShareSheet mapId={map.id} mapName={map.name} whole={{ map, lines: over.lines ?? [LINE], places: over.places ?? [] }} origin="https://example.test" phone openMessages={async () => true} copiesIo={io} onClose={() => {}} />)
}
const openFold = () => fireEvent.click(screen.getByRole('button', { name: 'Print or a file' }))

type Fake = PaintedMapCopiesIo & { drew: PictureInput[]; printed: Array<{ html: string; filing: unknown }>; shared: string[]; downloaded: string[]; phone: boolean; popup: boolean; missing: number; canDraw: boolean }
const fake = (): Fake => {
  const f: Fake = {
    drew: [], printed: [], shared: [], downloaded: [], phone: false, popup: true, missing: 0, canDraw: true,
    draw: async (input) => {
      f.drew.push(input)
      return f.canDraw ? { blob: new Blob(['jpeg'], { type: 'image/jpeg' }), tilesMissing: f.missing } : null
    },
    dataUrl: async () => 'data:image/jpeg;base64,AAAA',
    photoUrls: async (paths) => new Map(paths.filter((p): p is string => !!p).map((p) => [p, `https://signed.test/${p}`])),
    thumb: async () => 'data:image/jpeg;base64,BBBB',
    qr: async (url) => `<svg data-qr="${url}"></svg>`,
    print: async (build, filing) => {
      if (!f.popup) return false
      f.printed.push({ html: await build(), filing })
      return true
    },
    canShare: () => f.phone,
    share: async (file) => {
      f.shared.push(file.name)
      return true
    },
    download: (file) => void f.downloaded.push(file.name),
    today: () => '2026-11-13',
  }
  return f
}

beforeEach(() => {
  let n = 0
  Object.defineProperty(URL, 'createObjectURL', { value: () => `blob:picture-${++n}`, configurable: true })
  Object.defineProperty(URL, 'revokeObjectURL', { value: () => {}, configurable: true })
})
afterEach(() => {
  cleanup()
  link.held = false
  link.minted = 0
  link.refuse = null
})

const RULE = 'A copy cannot be taken back, and it goes out of date. Send the link when you can.'

describe('a copy of a painted map, on the Share sheet', () => {
  it('keeps the copy’s rule for where a copy is made: under Print or a file, and on the picture', async () => {
    draw(fake())
    expect(screen.queryByText(RULE)).toBeNull()
    expect(screen.queryByText('Or hand over a copy')).toBeNull()
    openFold()
    expect(screen.getByText(RULE)).toBeTruthy()
    expect(document.querySelector('[data-painted-picture]')).toBeNull()
    openFold()
    fireEvent.click(screen.getByRole('button', { name: 'Make a picture' }))
    await waitFor(() => expect(document.querySelector('[data-painted-picture]')).toBeTruthy())
    expect(screen.getByText(RULE)).toBeTruthy()
  })

  it('makes a picture with the map\'s name, its summary, the company, the day and the link under it', async () => {
    const io = fake()
    draw(io, { places: [PLACE()], held: true })
    fireEvent.click(screen.getByRole('button', { name: /Make a picture/ }))
    await waitFor(() => expect(document.querySelector('[data-painted-picture]')?.getAttribute('src')).toBe('blob:picture-1'))
    expect(link.minted).toBe(0)
    const band = io.drew[0]!.band!
    expect(band.name).toBe('The way in for deliveries')
    expect(band.summary).toBe('About 870 ft · 1 place')
    expect(band.foot[0]).toMatch(/ · Made Nov 13, 2026$/)
    expect(band.foot[1]).toBe('example.test/way/q7m2kd4x9p')
    expect(band.foot[2]).toBe('A length here is a guide for how far. It is not a measurement.')
    expect(io.drew[0]!.places).toEqual([{ number: 1, name: 'Truck gate', words: 'Close it behind you.', lat: 29.5, lng: -98.2 }])
    expect(io.shared).toEqual([])
    expect(io.downloaded).toEqual([])
  })

  it('makes the link itself when none is out, so the picture carries the way back', async () => {
    const io = fake()
    draw(io, { lines: [], places: [PLACE()] })
    fireEvent.click(screen.getByRole('button', { name: /Make a picture/ }))
    await waitFor(() => expect(io.drew).toHaveLength(1))
    expect(link.minted).toBe(1)
    expect(io.drew[0]!.band!.foot).toEqual([expect.stringMatching(/ · Made Nov 13, 2026$/), 'example.test/way/q7m2kd4x9p'])
  })

  it('still makes the picture, with no address and no alarm, when the link cannot be made', async () => {
    const io = fake()
    link.refuse = 'Failed to fetch'
    draw(io, { lines: [], places: [PLACE()] })
    fireEvent.click(screen.getByRole('button', { name: /Make a picture/ }))
    await waitFor(() => expect(document.querySelector('[data-painted-picture]')).toBeTruthy())
    expect(io.drew[0]!.band!.foot).toHaveLength(1)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows the picture alone, goes back on Every way to share, and does not draw it twice', async () => {
    const io = fake()
    draw(io, { held: true })
    fireEvent.click(screen.getByRole('button', { name: /Make a picture/ }))
    await waitFor(() => expect(document.querySelector('[data-painted-picture]')).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Text it from my phone…' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Every way to share/ }))
    expect(document.querySelector('[data-painted-picture]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Make a picture/ }))
    await waitFor(() => expect(document.querySelector('[data-painted-picture]')).toBeTruthy())
    expect(io.drew).toHaveLength(1)
  })

  it('hands the picture to the phone\'s share sheet on a press of its own', async () => {
    const io = fake()
    io.phone = true
    draw(io)
    fireEvent.click(screen.getByRole('button', { name: /Make a picture/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Share the picture' }))
    await waitFor(() => expect(io.shared).toEqual(['the-way-in-for-deliveries.jpg']))
    expect((await screen.findByRole('status')).textContent).toBe('The picture was handed to your phone to send.')
  })

  it('saves the picture as a file where there is no share sheet', async () => {
    const io = fake()
    draw(io)
    fireEvent.click(screen.getByRole('button', { name: /Make a picture/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Save the picture' }))
    await waitFor(() => expect(io.downloaded).toEqual(['the-way-in-for-deliveries.jpg']))
    expect(screen.getByRole('status').textContent).toBe('Saved as the-way-in-for-deliveries.jpg, where this browser keeps its downloads.')
  })

  it('says so when part of the picture under the line did not load', async () => {
    const io = fake()
    io.missing = 3
    draw(io)
    fireEvent.click(screen.getByRole('button', { name: /Make a picture/ }))
    expect(await screen.findByText(/Part of the picture under the line did not load\. The line and the places are right\./)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Make it again' })).toBeTruthy()
  })

  it('says why no picture was made', async () => {
    const io = fake()
    io.canDraw = false
    draw(io)
    fireEvent.click(screen.getByRole('button', { name: /Make a picture/ }))
    expect((await screen.findByRole('alert')).textContent).toBe('The picture was not made. This browser would not draw it.')
  })

  it('prints a page that carries its own pictures and the code, and files it with the job', async () => {
    const io = fake()
    draw(io, { places: [PLACE(), PLACE({ id: 'p2', number: 2, name: 'Meter', words: '', photoPath: null })], held: true })
    openFold()
    fireEvent.click(screen.getByRole('button', { name: /Print, or save as a PDF/ }))
    await waitFor(() => expect(io.printed).toHaveLength(1))
    const { html, filing } = io.printed[0]!
    expect(filing).toEqual({ kind: 'painted_map_print', title: 'Painted map: The way in for deliveries', jobIds: ['j1'], source: { table: 'painted_maps', id: 'm1' } })
    expect(io.drew[0]!.band).toBeNull()
    expect(html).toContain('<img class="map" src="data:image/jpeg;base64,AAAA"')
    expect(html).toContain('<img src="data:image/jpeg;base64,BBBB" alt="">')
    expect(html).not.toContain('signed.test')
    expect(html).toContain('<svg data-qr="https://example.test/way/q7m2kd4x9p"></svg>')
    expect(html).toContain('About 870 ft, give or take 30 ft · walked')
    expect(html).toContain('The link ends by itself on Feb 11.')
    expect(html).toContain('Made Nov 13, 2026.')
    expect((await screen.findByRole('status')).textContent).toBe('The page opened to print. A copy is kept with the job.')
  })

  it('makes the link for the page when none is out, so the page always carries its code', async () => {
    const io = fake()
    draw(io, { map: { ...MAP, jobId: null } })
    openFold()
    expect(screen.queryByText(/Make a link first/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Print, or save as a PDF/ }))
    await waitFor(() => expect(io.printed).toHaveLength(1))
    expect(link.minted).toBe(1)
    expect(io.printed[0]!.html).toContain('<svg data-qr="https://example.test/way/q7m2kd4x9p"></svg>')
    expect((io.printed[0]!.filing as { jobIds: string[] }).jobIds).toEqual([])
    expect((await screen.findByRole('status')).textContent).toBe('The page opened to print. A copy is kept in Documents.')
  })

  it('prints with no code when the link cannot be made', async () => {
    const io = fake()
    link.refuse = 'Failed to fetch'
    draw(io)
    openFold()
    fireEvent.click(screen.getByRole('button', { name: /Print, or save as a PDF/ }))
    await waitFor(() => expect(io.printed).toHaveLength(1))
    expect(io.printed[0]!.html).not.toContain('class="code"')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('saves a .kml file of the lines and places, named after the map', async () => {
    const io = fake()
    const files: File[] = []
    io.download = (file) => void files.push(file)
    draw(io, { places: [PLACE()] })
    openFold()
    expect(screen.getByText(/The lines and the places with their words\. No photos\./)).toBeTruthy()
    expect(screen.getByRole('button', { name: /A \.kml file/ }).textContent).toBe('A .kml fileGoogle Earth and Google My Maps')
    fireEvent.click(screen.getByRole('button', { name: /A \.kml file/ }))
    await waitFor(() => expect(files).toHaveLength(1))
    expect(files[0]!.name).toBe('the-way-in-for-deliveries.kml')
    expect(files[0]!.type).toBe('application/vnd.google-earth.kml+xml')
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.readAsText(files[0]!)
    })
    expect(text).toContain('<coordinates>-98.200000,29.500000,0 -98.200000,29.501000,0</coordinates>')
    expect(text).toContain('<name>1. Truck gate</name>')
    expect(text).toContain('About 870 ft, give or take 30 ft')
    expect(text).not.toContain('gate.jpg')
    expect(screen.getByRole('status').textContent).toBe('Saved as the-way-in-for-deliveries.kml, where this browser keeps its downloads.')
  })

  it('hands a .gpx file to the phone\'s share sheet where it takes files', async () => {
    const io = fake()
    io.phone = true
    draw(io)
    openFold()
    fireEvent.click(screen.getByRole('button', { name: /A \.gpx file/ }))
    await waitFor(() => expect(io.shared).toEqual(['the-way-in-for-deliveries.gpx']))
    expect(screen.getByRole('status').textContent).toBe('The file was handed to your phone to send.')
  })

  it('says what to do when the print window was blocked', async () => {
    const io = fake()
    io.popup = false
    draw(io)
    openFold()
    fireEvent.click(screen.getByRole('button', { name: /Print, or save as a PDF/ }))
    expect((await screen.findByRole('alert')).textContent).toBe('The page did not open. Allow pop-ups for this site, then press again.')
  })
})
