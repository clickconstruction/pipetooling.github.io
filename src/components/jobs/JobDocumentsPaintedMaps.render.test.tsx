// @vitest-environment jsdom
/**
 * The Documents tab's Painted maps (punch list #345): the job's maps and its development's, each a
 * door to the map as it is now, and the press that starts one. Nothing is stored in the tab. Every
 * map here is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Landed, PaintedMapWhole } from '../../lib/paintedMap/paintedMapIo'
import type { PaintedLine, PaintedMap, PaintedPlace } from '../../lib/paintedMap/paintedMap'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

vi.mock('../paintedMap/PaintedMapShareSheet', () => ({
  PaintedMapShareSheet: (props: { mapId: string; mapName: string; mayText?: boolean; jobId?: string | null; onClose: () => void }) => (
    <div data-testid="share-sheet">
      {props.mapId}|{props.mapName}|{String(props.mayText)}|{props.jobId}
      <button type="button" onClick={props.onClose}>
        Close the sheet
      </button>
    </div>
  ),
}))

import { onPaintedMapAsk, paintedMapsChanged, type PaintedMapAsk } from '../../lib/paintedMap/paintedMapDoor'
import { JobDocumentsPaintedMaps } from './JobDocumentsPaintedMaps'

const map = (id: string, name: string, createdAt: string, home: Partial<PaintedMap>): PaintedMap => ({ id, name, words: '', jobId: null, developmentId: null, createdBy: 'dana', createdAt, ...home })
const line = (mapId: string, lengthM: number): PaintedLine => ({ id: `l-${mapId}`, mapId, label: '', how: 'drawn', points: [{ lat: 29.5, lng: -98.3 }, { lat: 29.51, lng: -98.3 }], poorParts: [], fixedByHand: false, lengthM, marginM: null, measuredFt: null, measuredHow: null, madeBy: 'dana', madeAt: '2026-11-13T15:00:00Z' })
const dot = (mapId: string, n: number): PaintedPlace => ({ id: `p-${mapId}-${n}`, mapId, name: `Place ${n}`, words: '', lat: 29.5, lng: -98.3, accuracyM: null, photoPath: null, setBy: 'dana', setAt: '2026-11-13T15:00:00Z' })
const WAY: PaintedMapWhole = { map: map('way', 'The way in for deliveries', '2026-11-13T15:00:00Z', { jobId: 'job-14' }), lines: [line('way', 253)], places: [dot('way', 1), dot('way', 2), dot('way', 3)] }
const SITE: PaintedMapWhole = { map: map('site', 'The site road', '2026-11-10T15:00:00Z', { developmentId: 'dev-1' }), lines: [line('site', 900)], places: [] }
const JOB = { id: 'job-14', job_name: 'Juniper Ridge, Lot 14', job_address: '14 Made Up Road', development_id: 'dev-1', development: { id: 'dev-1', name: 'Juniper Ridge' } }

const names = () => Promise.resolve(new Map([['dana', 'Dana']]))
const landed = (wholes: PaintedMapWhole[]) => () => Promise.resolve<Landed<PaintedMapWhole[]>>({ ok: true, value: wholes })
const rowTexts = () => [...document.querySelectorAll('[data-testid="job-documents-painted-map"]')].map((r) => r.textContent)

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

describe('JobDocumentsPaintedMaps', () => {
  it('lists the job\'s maps and its development\'s, each with what it holds and who painted it', async () => {
    const asked: unknown[] = []
    render(
      <JobDocumentsPaintedMaps
        job={JOB}
        loadNames={names}
        loadMaps={(home) => {
          asked.push(home)
          return landed([SITE, WAY])()
        }}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Painted maps' })).toBeTruthy()
    await waitFor(() => expect(rowTexts()).toHaveLength(2))
    expect(asked).toEqual([{ jobId: 'job-14', developmentId: 'dev-1' }])
    expect(rowTexts()).toEqual(['The way in for deliveriesabout 830 ft · 3 places · Painted by Dana on Nov 13.Share', 'The site roadabout 2,950 ft · Painted by Dana on Nov 10.from Juniper RidgeShare'])
  })

  it('a press on a map\'s name opens the map as it is now, at the job\'s address', async () => {
    render(<JobDocumentsPaintedMaps job={JOB} loadNames={names} loadMaps={landed([WAY])} />)
    fireEvent.click(await screen.findByRole('button', { name: 'The way in for deliveries' }))
    expect(asks).toEqual([{ kind: 'open', mapId: 'way', address: '14 Made Up Road' }])
  })

  it('Paint a map starts one for this job and its development', async () => {
    render(<JobDocumentsPaintedMaps job={JOB} loadNames={names} loadMaps={landed([WAY])} />)
    await screen.findByRole('button', { name: 'The way in for deliveries' })
    fireEvent.click(screen.getByRole('button', { name: 'Paint a map' }))
    expect(asks).toEqual([{ kind: 'start', home: { jobId: 'job-14', developmentId: 'dev-1', label: 'Juniper Ridge, Lot 14', developmentLabel: 'Juniper Ridge', address: '14 Made Up Road' } }])
  })

  it('a job with no painted map says so and offers the press that starts one', async () => {
    render(<JobDocumentsPaintedMaps job={{ id: 'job-14' }} loadNames={names} loadMaps={landed([])} />)
    expect(await screen.findByText(/No painted map is on this job\./)).toBeTruthy()
    const presses = screen.getAllByRole('button', { name: 'Paint a map' })
    fireEvent.click(presses[presses.length - 1]!)
    expect(asks).toHaveLength(1)
    expect(asks[0]).toMatchObject({ kind: 'start', home: { jobId: 'job-14', developmentId: null } })
  })

  it('says where a fixed copy is to whoever can see sent copies, and only that the map is live to whoever cannot', async () => {
    render(<JobDocumentsPaintedMaps job={JOB} sentCopiesShown loadNames={names} loadMaps={landed([WAY])} />)
    expect(await screen.findByText('A map here is the map as it is now. A copy printed or saved as a PDF is under Sent from this job, with the day it was made.')).toBeTruthy()
    cleanup()
    render(<JobDocumentsPaintedMaps job={JOB} loadNames={names} loadMaps={landed([WAY])} />)
    expect(await screen.findByText('A map here is the map as it is now.')).toBeTruthy()
  })

  it('reads again when a painted map changes anywhere in the app', async () => {
    let wholes = [WAY]
    render(<JobDocumentsPaintedMaps job={JOB} loadNames={names} loadMaps={() => landed(wholes)()} />)
    await waitFor(() => expect(rowTexts()).toHaveLength(1))
    wholes = [WAY, SITE]
    act(() => paintedMapsChanged())
    await waitFor(() => expect(rowTexts()).toHaveLength(2))
  })

  it('a read that fails says why and Try again reads it', async () => {
    let fail = true
    render(<JobDocumentsPaintedMaps job={JOB} loadNames={names} loadMaps={() => (fail ? Promise.resolve({ ok: false, error: 'No signal.' }) : landed([WAY])())} />)
    await waitFor(() => expect(document.querySelector('[data-job-documents-painted-maps-failed]')?.textContent).toBe('The painted maps did not load: No signal. Try again'))
    fail = false
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(rowTexts()).toHaveLength(1))
  })

  it('the names failing to read costs the names and never the list', async () => {
    render(<JobDocumentsPaintedMaps job={JOB} loadNames={() => Promise.reject(new Error('nope'))} loadMaps={landed([WAY])} />)
    await waitFor(() => expect(rowTexts()).toEqual(['The way in for deliveriesabout 830 ft · 3 places · Painted on Nov 13.Share']))
  })

  it('Share on a row opens that map\'s Share sheet for this job, without opening the map', async () => {
    render(<JobDocumentsPaintedMaps job={JOB} mayText loadNames={names} loadMaps={landed([WAY, SITE])} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Share The site road' }))
    expect(screen.getByTestId('share-sheet').textContent).toContain('site|The site road|true|job-14')
    expect(asks).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'Close the sheet' }))
    expect(screen.queryByTestId('share-sheet')).toBeNull()
  })
})

// A build once failed on `window is not defined`: the section's read landed after the test that mounted it
// had ended, and it set state with no page left under it. Here the page is taken away on purpose.
describe('a read that lands after the section is taken down', () => {
  for (const kind of ['fails', 'lands'] as const) {
    it(`sets nothing when the read ${kind} late`, async () => {
      let land: (res: Landed<PaintedMapWhole[]>) => void = () => {}
      const namesAsked = vi.fn(names)
      render(<JobDocumentsPaintedMaps job={JOB} loadNames={namesAsked} loadMaps={() => new Promise<Landed<PaintedMapWhole[]>>((r) => (land = r))} />)
      cleanup()
      const page = globalThis as { window?: unknown }
      const held = page.window
      delete page.window
      try {
        land(kind === 'fails' ? { ok: false, error: 'no signal' } : { ok: true, value: [WAY] })
        // Past the read and the names after it. A state set in here throws, and the run reports it against this test.
        await new Promise((r) => setTimeout(r, 0))
      } finally {
        page.window = held
      }
      expect(namesAsked).not.toHaveBeenCalled()
    })
  }
})
