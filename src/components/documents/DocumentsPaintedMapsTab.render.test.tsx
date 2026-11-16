// @vitest-environment jsdom
/**
 * The Documents page's Painted maps tab (punch list #345): every painted map the reader can open,
 * each a door to the map as it is now. Nothing is stored in the tab. Every map here is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Landed, PaintedMapWhole } from '../../lib/paintedMap/paintedMapIo'
import type { PaintedLine, PaintedMap, PaintedPlace } from '../../lib/paintedMap/paintedMap'
import type { PaintedMapSearchRow } from '../../lib/paintedMap/paintedMapSearch'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import { onPaintedMapAsk, paintedMapsChanged, type PaintedMapAsk } from '../../lib/paintedMap/paintedMapDoor'
import { DocumentsPaintedMapsTab } from './DocumentsPaintedMapsTab'

const map = (id: string, name: string, createdAt: string, home: Partial<PaintedMap>): PaintedMap => ({ id, name, words: '', jobId: null, developmentId: null, createdBy: 'dana', createdAt, ...home })
const line = (mapId: string, lengthM: number): PaintedLine => ({ id: `l-${mapId}`, mapId, label: '', how: 'drawn', points: [{ lat: 29.5, lng: -98.3 }, { lat: 29.51, lng: -98.3 }], poorParts: [], fixedByHand: false, lengthM, marginM: null, measuredFt: null, measuredHow: null, madeBy: 'dana', madeAt: '2026-11-13T15:00:00Z' })
const dot = (mapId: string, n: number): PaintedPlace => ({ id: `p-${mapId}-${n}`, mapId, name: `Place ${n}`, words: '', lat: 29.5, lng: -98.3, accuracyM: null, photoPath: null, setBy: 'dana', setAt: '2026-11-13T15:00:00Z' })
const WAY: PaintedMapWhole = { map: map('way', 'The way in for deliveries', '2026-11-13T15:00:00Z', { jobId: 'job-14', words: 'Start at the truck gate.' }), lines: [line('way', 253)], places: [dot('way', 1), dot('way', 2)] }
const SITE: PaintedMapWhole = { map: map('site', 'The site road', '2026-11-10T15:00:00Z', { developmentId: 'dev-1' }), lines: [line('site', 900)], places: [] }
const LOOSE: PaintedMapWhole = { map: map('loose', 'Where to park', '2026-11-09T15:00:00Z', {}), lines: [], places: [] }
const HOMES: PaintedMapSearchRow[] = [
  { id: 'way', name: 'The way in for deliveries', words: 'Start at the truck gate.', jobLabel: 'J14 · Juniper Ridge, Lot 14', developmentLabel: null, hasHome: true },
  { id: 'site', name: 'The site road', words: '', jobLabel: null, developmentLabel: 'Juniper Ridge', hasHome: true },
  { id: 'loose', name: 'Where to park', words: '', jobLabel: null, developmentLabel: null, hasHome: false },
]

const names = () => Promise.resolve(new Map([['dana', 'Dana']]))
const homes = () => Promise.resolve(HOMES)
const landed = (wholes: PaintedMapWhole[]) => () => Promise.resolve<Landed<PaintedMapWhole[]>>({ ok: true, value: wholes })
const rowTexts = () => [...document.querySelectorAll('[data-testid="documents-painted-map"]')].map((r) => [...r.querySelectorAll('td')].map((td) => td.textContent).join(' | '))
const many = (n: number): PaintedMapWhole[] => Array.from({ length: n }, (_, i) => ({ map: map(`m${i}`, i === 3 ? 'The meter run' : `Map ${i}`, '2026-11-01T15:00:00Z', {}), lines: [], places: [] }))

let asks: PaintedMapAsk[] = []
let stopListening = () => {}
beforeEach(() => {
  asks = []
  stopListening = onPaintedMapAsk((ask) => asks.push(ask))
})
afterEach(() => {
  stopListening()
  cleanup()
})

describe('DocumentsPaintedMapsTab', () => {
  it('lists every map with where it is, what is on it and who painted it', async () => {
    render(<DocumentsPaintedMapsTab loadMaps={landed([WAY, SITE, LOOSE])} loadHomes={homes} loadNames={names} />)
    expect(screen.getByRole('heading', { name: 'Painted maps' })).toBeTruthy()
    await waitFor(() => expect(rowTexts()).toHaveLength(3))
    expect(rowTexts()).toEqual([
      'The way in for deliveriesStart at the truck gate. | J14 · Juniper Ridge, Lot 14 | about 830 ft · 2 places | Painted by Dana on Nov 13.',
      'The site road | Juniper Ridge, every lot | about 2,950 ft | Painted by Dana on Nov 10.',
      'Where to park | On no job yet | nothing on it yet | Painted by Dana on Nov 9.',
    ])
    expect(document.querySelector('[data-documents-painted-maps-count]')?.textContent).toBe('3 painted maps')
    // A short list needs no find box.
    expect(screen.queryByRole('searchbox')).toBeNull()
  })

  it('a press on a map\'s name opens the map as it is now', async () => {
    render(<DocumentsPaintedMapsTab loadMaps={landed([WAY])} loadHomes={homes} loadNames={names} />)
    fireEvent.click(await screen.findByRole('button', { name: 'The way in for deliveries' }))
    expect(asks).toEqual([{ kind: 'open', mapId: 'way', address: null }])
  })

  it('Paint a map starts one that is on no job yet', async () => {
    render(<DocumentsPaintedMapsTab loadMaps={landed([WAY])} loadHomes={homes} loadNames={names} />)
    await screen.findByRole('button', { name: 'The way in for deliveries' })
    fireEvent.click(screen.getByRole('button', { name: 'Paint a map' }))
    expect(asks).toEqual([{ kind: 'start', home: {} }])
  })

  it('with no map it says so and offers the press that starts one', async () => {
    render(<DocumentsPaintedMapsTab loadMaps={landed([])} loadHomes={homes} loadNames={names} />)
    expect(await screen.findByText(/No painted map yet\./)).toBeTruthy()
    const presses = screen.getAllByRole('button', { name: 'Paint a map' })
    fireEvent.click(presses[presses.length - 1]!)
    expect(asks).toEqual([{ kind: 'start', home: {} }])
  })

  it('a long list has a find box, and a search with no match offers to clear it', async () => {
    render(<DocumentsPaintedMapsTab loadMaps={landed(many(8))} loadHomes={() => Promise.resolve([])} loadNames={names} />)
    await waitFor(() => expect(rowTexts()).toHaveLength(8))
    const box = screen.getByRole('searchbox', { name: 'Find a map by its name, its job or its words' })
    fireEvent.change(box, { target: { value: 'meter' } })
    expect(rowTexts()).toHaveLength(1)
    expect(document.querySelector('[data-documents-painted-maps-count]')?.textContent).toBe('1 of 8 painted maps')
    fireEvent.change(box, { target: { value: 'zebra' } })
    expect(screen.getByText('Nothing matches “zebra”.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Clear the search' }))
    expect(rowTexts()).toHaveLength(8)
  })

  it('reads again when a painted map changes anywhere in the app', async () => {
    let wholes = [WAY]
    render(<DocumentsPaintedMapsTab loadMaps={() => landed(wholes)()} loadHomes={homes} loadNames={names} />)
    await waitFor(() => expect(rowTexts()).toHaveLength(1))
    wholes = [WAY, SITE]
    act(() => paintedMapsChanged())
    await waitFor(() => expect(rowTexts()).toHaveLength(2))
  })

  it('a read that fails says why and Try again reads it', async () => {
    let fail = true
    render(<DocumentsPaintedMapsTab loadMaps={() => (fail ? Promise.resolve({ ok: false, error: 'No signal.' }) : landed([WAY])())} loadHomes={homes} loadNames={names} />)
    await waitFor(() => expect(document.querySelector('[data-documents-painted-maps-failed]')?.textContent).toBe('The painted maps did not load: No signal. Try again'))
    fail = false
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(rowTexts()).toHaveLength(1))
  })

  it('the homes and the names failing cost their words and never the list', async () => {
    render(<DocumentsPaintedMapsTab loadMaps={landed([WAY, LOOSE])} loadHomes={() => Promise.reject(new Error('nope'))} loadNames={() => Promise.reject(new Error('nope'))} />)
    await waitFor(() => expect(rowTexts()).toEqual(['The way in for deliveriesStart at the truck gate. | On a job | about 830 ft · 2 places | Painted on Nov 13.', 'Where to park | On no job yet | nothing on it yet | Painted on Nov 9.']))
  })
})
