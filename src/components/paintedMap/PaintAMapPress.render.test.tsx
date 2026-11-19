// @vitest-environment jsdom
/**
 * The Dashboard's Paint a map press (punch list #392, step 2): its three shapes, the job it opens
 * the start sheet on, and a press that never waits on a weak signal. Every job here is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: vi.fn() }))
vi.mock('../../lib/supabase', () => ({ supabase: {} }))

import { recordNavClick } from '../../lib/navClickTelemetry'
import { onPaintedMapAsk, type PaintedMapAsk } from '../../lib/paintedMap/paintedMapDoor'
import type { PaintPressDay } from '../../lib/paintedMap/paintedMapPressIo'
import { UpdateFocusOpenerBridgeProvider, useUpdateFocusOpenerBridge } from '../../contexts/UpdateFocusOpenerBridgeContext'
import { PAINT_PRESS_WAIT_MS, PaintAMapPress } from './PaintAMapPress'

const cedar = { id: 'j-cedar', number: 'J2417', name: 'Cedar Hollow 12', address: '1208 Wrenfield Loop' }
const pinto = { id: 'j-pinto', number: 'J2431', name: 'Pinto Ridge 3', address: '3 Pinto Ridge' }
const clockedOnCedar: PaintPressDay = { clock: { job: cedar }, todayStops: [] }
const nothing: PaintPressDay = { clock: null, todayStops: [] }
/** 10:00 AM Central on a made-up day. */
const TEN_AM = Date.parse('2026-11-18T16:00:00Z')

let asks: PaintedMapAsk[] = []
let stop = () => {}
beforeEach(() => {
  asks = []
  stop = onPaintedMapAsk((a) => asks.push(a))
  vi.mocked(recordNavClick).mockClear()
})
afterEach(() => {
  stop()
  cleanup()
  vi.useRealTimers()
})

const settle = async () => {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('PaintAMapPress · wide (Job Mode)', () => {
  it('reads the day when drawn and says the job the map will land on', async () => {
    const load = vi.fn(async () => clockedOnCedar)
    render(<PaintAMapPress userId="u1" role="subcontractor" shape="wide" load={load} now={() => TEN_AM} />)
    // Before the read lands it says nothing that could turn out wrong.
    expect(document.querySelector('[data-paint-a-map-press-line]')?.textContent).toBe('The way in, drawn or walked')
    await settle()
    expect(load).toHaveBeenCalledTimes(1)
    expect(document.querySelector('[data-paint-a-map-press-line]')?.textContent).toBe('On J2417 · Cedar Hollow 12')
    expect(screen.getByRole('button', { name: 'Paint a map. On J2417 · Cedar Hollow 12' })).toBeTruthy()
  })

  it('opens the start sheet on that job at once, with no second read', async () => {
    const load = vi.fn(async () => clockedOnCedar)
    render(<PaintAMapPress userId="u1" role="subcontractor" shape="wide" load={load} now={() => TEN_AM} />)
    await settle()
    fireEvent.click(document.querySelector('[data-paint-a-map-press="wide"]')!)
    await settle()
    expect(load).toHaveBeenCalledTimes(1)
    expect(asks).toHaveLength(1)
    expect(asks[0]).toMatchObject({ kind: 'start', home: { jobId: 'j-cedar', label: 'J2417 · Cedar Hollow 12', address: '1208 Wrenfield Loop', canChangeJob: true } })
    expect(recordNavClick).toHaveBeenCalledWith('u1', 'subcontractor', 'paint-a-map', '#dashboard-wide')
  })

  it('with no job today, says the person picks, and opens the sheet on no job', async () => {
    render(<PaintAMapPress userId="u1" role="subcontractor" shape="wide" load={async () => nothing} now={() => TEN_AM} />)
    await settle()
    expect(document.querySelector('[data-paint-a-map-press-line]')?.textContent).toBe('On your last job, or one you pick')
    fireEvent.click(document.querySelector('[data-paint-a-map-press="wide"]')!)
    await settle()
    expect(asks[0]).toMatchObject({ kind: 'start', home: { jobId: null } })
  })

  it('reads again when the clock changes', async () => {
    let day: PaintPressDay = nothing
    const load = vi.fn(async () => day)
    let tell = () => {}
    const Teller = () => {
      tell = useUpdateFocusOpenerBridge().notifySessionChanged
      return null
    }
    render(
      <UpdateFocusOpenerBridgeProvider>
        <Teller />
        <PaintAMapPress userId="u1" role="subcontractor" shape="wide" load={load} now={() => TEN_AM} />
      </UpdateFocusOpenerBridgeProvider>,
    )
    await settle()
    expect(document.querySelector('[data-paint-a-map-press-line]')?.textContent).toBe('On your last job, or one you pick')
    day = { clock: { job: pinto }, todayStops: [] }
    act(() => tell())
    await settle()
    expect(load).toHaveBeenCalledTimes(2)
    expect(document.querySelector('[data-paint-a-map-press-line]')?.textContent).toBe('On J2431 · Pinto Ridge 3')
  })
})

describe('PaintAMapPress · square and link', () => {
  it('a square reads nothing when drawn, and the day on the press', async () => {
    const load = vi.fn(async (): Promise<PaintPressDay> => ({ clock: null, todayStops: [{ job: pinto, timeStart: '09:00:00', timeEnd: '12:00:00' }] }))
    render(<PaintAMapPress userId="u1" role="master_technician" shape="square" load={load} now={() => TEN_AM} />)
    await settle()
    expect(load).not.toHaveBeenCalled()
    const press = screen.getByRole('button', { name: 'Paint a map' })
    expect(press.getAttribute('data-paint-a-map-press')).toBe('square')
    fireEvent.click(press)
    await settle()
    expect(load).toHaveBeenCalledTimes(1)
    // 10:00 is inside the 9 to 12 stop.
    expect(asks[0]).toMatchObject({ kind: 'start', home: { jobId: 'j-pinto', canChangeJob: true } })
    expect(recordNavClick).toHaveBeenCalledWith('u1', 'master_technician', 'paint-a-map', '#dashboard-square')
  })

  it('a link says Paint a map and opens the sheet the same way', async () => {
    render(<PaintAMapPress userId="u1" role="assistant" shape="link" load={async () => nothing} now={() => TEN_AM} />)
    const press = screen.getByRole('button', { name: 'Paint a map' })
    expect(press.getAttribute('data-paint-a-map-press')).toBe('link')
    fireEvent.click(press)
    await settle()
    expect(asks[0]).toMatchObject({ kind: 'start', home: { jobId: null } })
  })

  it('a read that fails opens the sheet with no job set', async () => {
    render(
      <PaintAMapPress
        userId="u1"
        role="master_technician"
        shape="square"
        load={async () => {
          throw new Error('no signal')
        }}
        now={() => TEN_AM}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Paint a map' }))
    await settle()
    expect(asks).toHaveLength(1)
    expect(asks[0]).toMatchObject({ kind: 'start', home: { jobId: null } })
  })

  it('a slow read does not hold the press: the sheet opens with no job set after the wait', async () => {
    vi.useFakeTimers()
    const load = vi.fn(() => new Promise<PaintPressDay>(() => {}))
    render(<PaintAMapPress userId="u1" role="master_technician" shape="square" load={load} now={() => TEN_AM} />)
    fireEvent.click(screen.getByRole('button', { name: 'Paint a map' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PAINT_PRESS_WAIT_MS - 1)
    })
    expect(asks).toHaveLength(0)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2)
    })
    expect(asks).toHaveLength(1)
    expect(asks[0]).toMatchObject({ kind: 'start', home: { jobId: null } })
  })

  it('a second press while the first is opening does nothing', async () => {
    let land: (d: PaintPressDay) => void = () => {}
    const load = vi.fn(() => new Promise<PaintPressDay>((resolve) => (land = resolve)))
    render(<PaintAMapPress userId="u1" role="master_technician" shape="square" load={load} now={() => TEN_AM} />)
    const press = screen.getByRole('button', { name: 'Paint a map' })
    fireEvent.click(press)
    fireEvent.click(press)
    await act(async () => land(clockedOnCedar))
    await settle()
    expect(load).toHaveBeenCalledTimes(1)
    expect(asks).toHaveLength(1)
    expect(asks[0]).toMatchObject({ home: { jobId: 'j-cedar' } })
  })
})

describe('PaintAMapPress · nobody signed in', () => {
  it('draws nothing', () => {
    const { container } = render(<PaintAMapPress userId={null} role={null} shape="square" load={async () => nothing} />)
    expect(container.innerHTML).toBe('')
  })
})
