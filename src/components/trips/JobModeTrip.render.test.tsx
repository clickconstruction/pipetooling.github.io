// @vitest-environment jsdom
/**
 * The phone's trip on Job Mode's card (punch list #379, PR 7b): the question with its presses, the banner
 * with Heading home and End the trip, and a refusal said where it was pressed. The io is the hook's seam.
 * Every site, person, job and date is made up.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import type { TripPhoneIo } from '../../hooks/useTripPhone'
import type { TripPhoneStorage } from '../../lib/trips/tripPhone'
import { PHONE_PRESS_MIN_HEIGHT } from '../../lib/phonePress'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { JobModeTrip } from './JobModeTrip'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAddressGeocodeCoords', () => ({ useAddressGeocodeCoords: () => ({ coords: new Map(), resolving: false }) }))

afterEach(cleanup)

const TODAY = '2026-10-28'
const MINE = { trip_id: 't1', trip_number: 5, first_day: '2026-10-26', last_day: '2026-10-28', purpose: '', days: { '2026-10-26': 'road', '2026-10-27': 'site', '2026-10-28': 'site' }, with: ['Priya'] }
const LUIS = { trip_id: 't2', trip_number: 4, first_day: '2026-10-26', people: ['Luis'] }
const reply = (over: Record<string, unknown> = {}) => ({ ok: true, development_id: 'd-heron', development_name: 'Heron Point', has_trips: true, mine: null, open: [], today: TODAY, ...over })
// The real io throws the function's own refusal as its words alone (`sendTripPhoneAct`).
const REFUSAL = new Error('Training mode is read-only. No trip was changed.')

function makeIo(over: Partial<TripPhoneIo> = {}): TripPhoneIo {
  return { readState: vi.fn(async () => reply()), act: vi.fn(async () => undefined), readShop: vi.fn(async () => null), ...over }
}
function memory(): TripPhoneStorage {
  const kept = new Map<string, string>()
  return { getItem: (k) => kept.get(k) ?? null, setItem: (k, v) => void kept.set(k, v) }
}
const mount = (io: TripPhoneIo, storage: TripPhoneStorage | null = memory(), sessionId: string | null = 's1') =>
  renderWithProviders(<JobModeTrip jobId="j2101" sessionId={sessionId} travel={null} jobLabel="PLUM 2101 · Lift station" jobAddress="1 Heron Point Rd" io={io} storage={storage} />)

describe('JobModeTrip: the question', () => {
  it('draws nothing while the state is not in, and nothing for a caller not working the job', async () => {
    const io = makeIo({ readState: vi.fn(async () => ({ ok: false })) })
    mount(io)
    await waitFor(() => expect(io.readState).toHaveBeenCalled())
    expect(screen.queryByTestId('trip-phone-ask')).toBeNull()
    expect(screen.queryByTestId('trip-phone-banner')).toBeNull()
  })

  it('asks nothing before the clock in, and still draws the banner of an open trip', async () => {
    const quiet = makeIo({ readState: vi.fn(async () => reply({ open: [LUIS] })) })
    const first = mount(quiet, memory(), null)
    await waitFor(() => expect(quiet.readState).toHaveBeenCalled())
    await Promise.resolve()
    expect(screen.queryByTestId('trip-phone-ask')).toBeNull()
    first.unmount()

    mount(makeIo({ readState: vi.fn(async () => reply({ mine: MINE })) }), memory(), null)
    expect((await screen.findByTestId('trip-phone-banner-title')).textContent).toBe('Trip 5 · day 3 at Heron Point')
  })

  it('asks under the job’s name, with a press for a crewmate’s trip, in the card’s own words', async () => {
    mount(makeIo({ readState: vi.fn(async () => reply({ open: [LUIS] })) }))
    const sheet = await screen.findByTestId('trip-phone-ask')
    expect(screen.getByRole('dialog', { name: 'PLUM 2101 · Lift station' })).toBeTruthy()
    expect(screen.getByTestId('trip-phone-site').textContent).toBe('Heron Point')
    expect(sheet.textContent).toContain('This site is a trip from home. Is this a trip?')
    expect(screen.getByTestId('trip-phone-start').textContent).toBe('Start a trip')
    expect(screen.getByTestId('trip-phone-join').textContent).toBe('Join Luis’s trip, out since Mon')
    expect(screen.getByTestId('trip-phone-just-clock-in').textContent).toBe('Just clock in')
    expect(sheet.textContent).toContain('The office can change it later. Your hours are the same either way.')
    // Every press stands a fingertip tall.
    for (const id of ['trip-phone-start', 'trip-phone-join', 'trip-phone-just-clock-in']) {
      expect(parseInt(screen.getByTestId(id).style.minHeight, 10)).toBeGreaterThanOrEqual(PHONE_PRESS_MIN_HEIGHT)
    }
  })

  it('Start a trip starts it, and the banner takes the question’s place', async () => {
    let started = false
    const io = makeIo({
      readState: vi.fn(async () => (started ? reply({ mine: { ...MINE, first_day: TODAY, last_day: TODAY, days: { [TODAY]: 'site' }, with: [] } }) : reply())),
      act: vi.fn(async () => {
        started = true
      }),
    })
    mount(io)
    fireEvent.click(await screen.findByTestId('trip-phone-start'))
    expect((await screen.findByTestId('trip-phone-banner-title')).textContent).toBe('Trip 5 · day 1 at Heron Point')
    expect(io.act).toHaveBeenCalledWith({ action: 'start', job_id: 'j2101', kind: 'site' })
    expect(screen.queryByTestId('trip-phone-ask')).toBeNull()
  })

  it('Join joins the trip it names', async () => {
    const io = makeIo({ readState: vi.fn(async () => reply({ open: [LUIS] })) })
    mount(io)
    fireEvent.click(await screen.findByTestId('trip-phone-join'))
    await waitFor(() => expect(io.act).toHaveBeenCalledWith({ action: 'join', job_id: 'j2101', trip_id: 't2', kind: 'site' }))
  })

  it('a refusal is said in the sheet in the database’s words, and Just clock in still closes it', async () => {
    const io = makeIo({
      act: vi.fn(async () => {
        throw REFUSAL
      }),
    })
    mount(io)
    fireEvent.click(await screen.findByTestId('trip-phone-start'))
    expect((await screen.findByTestId('trip-phone-problem')).textContent).toBe('Training mode is read-only. No trip was changed.')
    fireEvent.click(screen.getByTestId('trip-phone-just-clock-in'))
    await waitFor(() => expect(screen.queryByTestId('trip-phone-ask')).toBeNull())
  })

  it('Just clock in sends nothing, and the same device does not ask again today', async () => {
    const storage = memory()
    const io = makeIo()
    const first = mount(io, storage)
    fireEvent.click(await screen.findByTestId('trip-phone-just-clock-in'))
    await waitFor(() => expect(screen.queryByTestId('trip-phone-ask')).toBeNull())
    expect(io.act).not.toHaveBeenCalled()
    first.unmount()

    const again = makeIo()
    mount(again, storage)
    await waitFor(() => expect(again.readState).toHaveBeenCalled())
    await Promise.resolve()
    expect(screen.queryByTestId('trip-phone-ask')).toBeNull()
  })

  it('closing the sheet is Just clock in', async () => {
    const io = makeIo()
    mount(io)
    await screen.findByTestId('trip-phone-ask')
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByTestId('trip-phone-ask')).toBeNull())
    expect(io.act).not.toHaveBeenCalled()
  })
})

describe('JobModeTrip: while out', () => {
  it('draws the banner with who it is with and when it started, and no question', async () => {
    mount(makeIo({ readState: vi.fn(async () => reply({ mine: MINE })) }))
    expect((await screen.findByTestId('trip-phone-banner-title')).textContent).toBe('Trip 5 · day 3 at Heron Point')
    expect(screen.getByTestId('trip-phone-banner-sub').textContent).toBe('with Priya · started Mon Oct 26')
    expect(screen.getByTestId('trip-phone-home-line').textContent).toBe('Heading home marks the drive as On the road.')
    expect(screen.queryByTestId('trip-phone-ask')).toBeNull()
    for (const id of ['trip-phone-heading-home', 'trip-phone-end']) {
      expect(parseInt(screen.getByTestId(id).style.minHeight, 10)).toBeGreaterThanOrEqual(PHONE_PRESS_MIN_HEIGHT)
    }
  })

  it('a trip made before numbers keeps the plain title, on the banner and on the End the trip sheet', async () => {
    mount(makeIo({ readState: vi.fn(async () => reply({ mine: { ...MINE, trip_number: null } })) }))
    expect((await screen.findByTestId('trip-phone-banner-title')).textContent).toBe('Trip · day 3 at Heron Point')
    fireEvent.click(screen.getByTestId('trip-phone-end'))
    expect((await screen.findByTestId('trip-phone-end-heading')).textContent).toBe('Trip to Heron Point')
  })

  it('Heading home paints today On the road, and the press gives way to the line that says so', async () => {
    const io = makeIo({ readState: vi.fn(async () => reply({ mine: MINE })) })
    mount(io)
    fireEvent.click(await screen.findByTestId('trip-phone-heading-home'))
    await waitFor(() => expect(screen.getByTestId('trip-phone-home-line').textContent).toBe('Today is marked On the road.'))
    expect(io.act).toHaveBeenCalledWith({ action: 'day', job_id: 'j2101', trip_id: 't1', kind: 'road' })
    expect(screen.queryByTestId('trip-phone-heading-home')).toBeNull()
    expect(screen.getByTestId('trip-phone-end')).toBeTruthy()
  })

  it('a refused Heading home says its reason on the banner', async () => {
    const io = makeIo({
      readState: vi.fn(async () => reply({ mine: MINE })),
      act: vi.fn(async () => {
        throw REFUSAL
      }),
    })
    mount(io)
    fireEvent.click(await screen.findByTestId('trip-phone-heading-home'))
    expect((await screen.findByTestId('trip-phone-problem')).textContent).toBe('Training mode is read-only. No trip was changed.')
    expect(screen.getByTestId('trip-phone-heading-home')).toBeTruthy()
  })

  it('End the trip opens its sheet with the person’s own days, and Not yet, still out closes it', async () => {
    const io = makeIo({ readState: vi.fn(async () => reply({ mine: MINE })) })
    mount(io)
    fireEvent.click(await screen.findByTestId('trip-phone-end'))
    const sheet = await screen.findByTestId('trip-phone-end-sheet')
    expect(screen.getByTestId('trip-phone-end-heading').textContent).toBe('Trip 5 to Heron Point')
    expect(screen.getByTestId('trip-phone-days').textContent).toBe('2 days at the site · 1 on the road')
    expect(sheet.textContent).toContain('How did it go? (you can skip this)')
    expect(screen.getByTestId('trip-phone-end-confirm').textContent).toBe('End the trip')
    fireEvent.click(screen.getByTestId('trip-phone-not-yet'))
    await waitFor(() => expect(screen.queryByTestId('trip-phone-end-sheet')).toBeNull())
    expect(io.act).not.toHaveBeenCalled()
    expect(screen.getByTestId('trip-phone-banner')).toBeTruthy()
  })

  it('End the trip sends what was typed, and the banner goes with no question after it', async () => {
    const io = makeIo({ readState: vi.fn(async () => reply({ mine: MINE })) })
    mount(io)
    fireEvent.click(await screen.findByTestId('trip-phone-end'))
    fireEvent.change(await screen.findByTestId('trip-phone-outcome'), { target: { value: 'Did the work. Counted 98 boxes.' } })
    fireEvent.click(screen.getByTestId('trip-phone-end-confirm'))
    await waitFor(() => expect(screen.queryByTestId('trip-phone-banner')).toBeNull())
    expect(io.act).toHaveBeenCalledWith({ action: 'end', job_id: 'j2101', trip_id: 't1', outcome: 'Did the work. Counted 98 boxes.' })
    expect(screen.queryByTestId('trip-phone-ask')).toBeNull()
  })

  it('a refused End the trip says its reason in the sheet and keeps the trip', async () => {
    const io = makeIo({
      readState: vi.fn(async () => reply({ mine: MINE })),
      act: vi.fn(async () => {
        throw REFUSAL
      }),
    })
    mount(io)
    fireEvent.click(await screen.findByTestId('trip-phone-end'))
    fireEvent.click(await screen.findByTestId('trip-phone-end-confirm'))
    expect((await screen.findByTestId('trip-phone-problem')).textContent).toBe('Training mode is read-only. No trip was changed.')
    expect(screen.getByTestId('trip-phone-end-sheet')).toBeTruthy()
  })
})
