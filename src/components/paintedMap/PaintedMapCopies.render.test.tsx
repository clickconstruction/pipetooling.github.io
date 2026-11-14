// @vitest-environment jsdom
/**
 * A copy of a painted map (punch list #345, PR 4b): a picture and a page to print. A copy says the
 * day it was made and carries the link when one is out. A print is filed with the job.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { NumberedPlace, PaintedLine } from '../../lib/paintedMap/paintedMap'
import type { PictureInput } from '../../lib/paintedMap/paintedMapPictureIo'

vi.mock('../../lib/sent/sentCopiesIo', () => ({ printWhenReadyAndFile: async () => true }))
vi.mock('../../lib/paintedMap/paintedMapIo', () => ({ paintedPlacePhotoUrls: async () => new Map() }))

import { PaintedMapCopies, type PaintedMapCopiesIo } from './PaintedMapCopies'

const LINE: PaintedLine = { id: 'l1', mapId: 'm1', label: '', how: 'walked', points: [{ lat: 29.5, lng: -98.2 }, { lat: 29.501, lng: -98.2 }], poorParts: [], fixedByHand: false, lengthM: 265, marginM: 9, measuredFt: null, measuredHow: null, madeBy: 'me', madeAt: '2026-11-13T15:05:00Z' }
const PLACE = (over: Partial<NumberedPlace> = {}): NumberedPlace => ({ id: 'p1', mapId: 'm1', name: 'Truck gate', words: 'Close it behind you.', lat: 29.5, lng: -98.2, accuracyM: null, photoPath: 'm1/gate.jpg', setBy: 'me', setAt: '2026-11-13T15:10:00Z', number: 1, ...over })
const MAP = { id: 'm1', name: 'The way in for deliveries', words: 'Start at the truck gate.', jobId: 'j1' as string | null }
const LINK = { url: 'https://example.test/way/q7m2kd4x9p', endsOn: '2027-02-11' }

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
afterEach(cleanup)

describe('PaintedMapCopies', () => {
  it('says what a copy is before one is made', () => {
    render(<PaintedMapCopies map={MAP} lines={[LINE]} places={[PLACE()]} link={null} io={fake()} />)
    expect(screen.getByText('Or hand over a copy')).toBeTruthy()
    expect(screen.getByText('A copy cannot be taken back, and it goes out of date. Send the link when you can.')).toBeTruthy()
    expect(document.querySelector('[data-painted-picture]')).toBeNull()
  })

  it('makes a picture with the map\'s name, its summary, the company, the day and the link under it', async () => {
    const io = fake()
    render(<PaintedMapCopies map={MAP} lines={[LINE]} places={[PLACE()]} link={LINK} io={io} />)
    fireEvent.click(screen.getByRole('button', { name: /Make a picture/ }))
    await waitFor(() => expect(document.querySelector('[data-painted-picture]')?.getAttribute('src')).toBe('blob:picture-1'))
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

  it('carries no address on a picture when no link is out', async () => {
    const io = fake()
    render(<PaintedMapCopies map={MAP} lines={[]} places={[PLACE()]} link={null} io={io} />)
    fireEvent.click(screen.getByRole('button', { name: /Make a picture/ }))
    await waitFor(() => expect(io.drew).toHaveLength(1))
    expect(io.drew[0]!.band!.foot).toHaveLength(1)
  })

  it('hands the picture to the phone\'s share sheet on a press of its own', async () => {
    const io = fake()
    io.phone = true
    render(<PaintedMapCopies map={MAP} lines={[LINE]} places={[]} link={null} io={io} />)
    fireEvent.click(screen.getByRole('button', { name: /Make a picture/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Share the picture' }))
    await waitFor(() => expect(io.shared).toEqual(['the-way-in-for-deliveries.jpg']))
    expect((await screen.findByRole('status')).textContent).toBe('The picture was handed to your phone to send.')
  })

  it('saves the picture as a file where there is no share sheet', async () => {
    const io = fake()
    render(<PaintedMapCopies map={MAP} lines={[LINE]} places={[]} link={null} io={io} />)
    fireEvent.click(screen.getByRole('button', { name: /Make a picture/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Save the picture' }))
    await waitFor(() => expect(io.downloaded).toEqual(['the-way-in-for-deliveries.jpg']))
    expect(screen.getByRole('status').textContent).toBe('Saved as the-way-in-for-deliveries.jpg, where this browser keeps its downloads.')
  })

  it('says so when part of the picture under the line did not load', async () => {
    const io = fake()
    io.missing = 3
    render(<PaintedMapCopies map={MAP} lines={[LINE]} places={[]} link={null} io={io} />)
    fireEvent.click(screen.getByRole('button', { name: /Make a picture/ }))
    expect(await screen.findByText(/Part of the picture under the line did not load\. The line and the places are right\./)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Make it again' })).toBeTruthy()
  })

  it('says why no picture was made', async () => {
    const io = fake()
    io.canDraw = false
    render(<PaintedMapCopies map={MAP} lines={[LINE]} places={[]} link={null} io={io} />)
    fireEvent.click(screen.getByRole('button', { name: /Make a picture/ }))
    expect((await screen.findByRole('alert')).textContent).toBe('The picture was not made. This browser would not draw it.')
  })

  it('prints a page that carries its own pictures and the code, and files it with the job', async () => {
    const io = fake()
    render(<PaintedMapCopies map={MAP} lines={[LINE]} places={[PLACE(), PLACE({ id: 'p2', number: 2, name: 'Meter', words: '', photoPath: null })]} link={LINK} io={io} />)
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

  it('prints with no code when no link is out, and says how to get one on the page', async () => {
    const io = fake()
    render(<PaintedMapCopies map={{ ...MAP, jobId: null }} lines={[LINE]} places={[]} link={null} io={io} />)
    expect(screen.getByText('One page with the map and the places. Make a link first and the page carries its code.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Print, or save as a PDF/ }))
    await waitFor(() => expect(io.printed).toHaveLength(1))
    expect(io.printed[0]!.html).not.toContain('class="code"')
    expect((io.printed[0]!.filing as { jobIds: string[] }).jobIds).toEqual([])
    expect((await screen.findByRole('status')).textContent).toBe('The page opened to print. A copy is kept in Documents.')
  })

  it('says what to do when the print window was blocked', async () => {
    const io = fake()
    io.popup = false
    render(<PaintedMapCopies map={MAP} lines={[LINE]} places={[]} link={null} io={io} />)
    fireEvent.click(screen.getByRole('button', { name: /Print, or save as a PDF/ }))
    expect((await screen.findByRole('alert')).textContent).toBe('The page did not open. Allow pop-ups for this site, then press again.')
  })
})
