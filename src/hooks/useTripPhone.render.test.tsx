// @vitest-environment jsdom
/**
 * The phone's trip hook (punch list #379, PR 7b): what it reads and when, the quiet paint, the four acts,
 * and Just clock in. The io is the hook's own seam; the site's point is the geocode hook's, stood in for
 * here. Every site, person and date is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { TripPhoneStorage, TripSessionTravel } from '../lib/trips/tripPhone'
import { useTripPhone, type TripPhoneIo } from './useTripPhone'

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

/** Whether the site's point was asked for, and what it answers. */
const geo: { asked: boolean; point: { lat: number; lng: number } | null } = { asked: false, point: null }
vi.mock('./useAddressGeocodeCoords', () => ({
  useAddressGeocodeCoords: (addresses: Array<{ key: string }>, enabled: boolean) => {
    if (enabled) geo.asked = true
    const coords = new Map<string, { lat: number; lng: number }>()
    if (enabled && geo.point && addresses[0]) coords.set(addresses[0].key, geo.point)
    return { coords, resolving: false }
  },
}))

const TODAY = '2026-10-28'
// The shop and a site about 1,180 miles off, both made up.
const SHOP = { lat: 30, lng: -97 }
const FAR = { lat: 47.1, lng: -97 }
const NEAR = { lat: 30.2, lng: -97 }
const MINE = { trip_id: 't1', trip_number: 5, first_day: '2026-10-26', last_day: '2026-10-28', purpose: '', days: { '2026-10-26': 'road', '2026-10-27': 'site', '2026-10-28': 'site' }, with: ['Priya'] }
const YESTERDAY = { ...MINE, last_day: '2026-10-27', days: { '2026-10-26': 'road', '2026-10-27': 'site' } }
const LUIS = { trip_id: 't2', trip_number: 4, first_day: '2026-10-26', people: ['Luis'] }
const reply = (over: Record<string, unknown> = {}) => ({ ok: true, development_id: 'd-heron', development_name: 'Heron Point', has_trips: false, mine: null, open: [], today: TODAY, ...over })

function makeIo(over: Partial<TripPhoneIo> = {}): TripPhoneIo {
  return { readState: vi.fn(async () => reply()), act: vi.fn(async () => undefined), readShop: vi.fn(async () => SHOP), ...over }
}
function memory(): TripPhoneStorage {
  const kept = new Map<string, string>()
  return { getItem: (k) => kept.get(k) ?? null, setItem: (k, v) => void kept.set(k, v) }
}
// The open session's stamps as the card hands them: none (a person at work), a drive, a drive that arrived,
// or 'reading' while the card has not read them yet.
const DRIVING: TripSessionTravel = { travelStartedAt: '2026-10-28T12:05:00Z', arrivedAt: null }
const ARRIVED: TripSessionTravel = { travelStartedAt: '2026-10-28T12:05:00Z', arrivedAt: '2026-10-28T14:40:00Z' }
type Props = { sessionId: string | null; travel?: TripSessionTravel | null | 'reading' }
const draw = (io: TripPhoneIo, opts: { jobId?: string | null; storage?: TripPhoneStorage | null; sessionId?: string | null; travel?: Props['travel'] } = {}) => {
  const initialProps: Props = { sessionId: opts.sessionId === undefined ? 's1' : opts.sessionId, travel: opts.travel }
  return renderHook(
    (p: Props) =>
      useTripPhone({
        jobId: opts.jobId === undefined ? 'j2101' : opts.jobId,
        sessionId: p.sessionId,
        travel: p.travel === 'reading' ? undefined : (p.travel ?? null),
        address: '1 Heron Point Rd',
        io,
        storage: opts.storage === undefined ? memory() : opts.storage,
      }),
    { initialProps },
  )
}

beforeEach(() => {
  geo.asked = false
  geo.point = null
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('useTripPhone: the reads', () => {
  it('reads nothing for a clock in with no job', async () => {
    const io = makeIo()
    const { result } = draw(io, { jobId: null })
    await act(async () => undefined)
    expect(io.readState).not.toHaveBeenCalled()
    expect(io.readShop).not.toHaveBeenCalled()
    expect(geo.asked).toBe(false)
    expect(result.current.view).toEqual({ kind: 'none' })
  })

  it('reads the state once for a job and its clock session, and again for a new session', async () => {
    const io = makeIo({ readState: vi.fn(async () => reply({ has_trips: true })) })
    const { result, rerender } = draw(io)
    await waitFor(() => expect(result.current.view.kind).toBe('ask'))
    rerender({ sessionId: 's1' })
    expect(io.readState).toHaveBeenCalledTimes(1)
    rerender({ sessionId: 's2' })
    await waitFor(() => expect(io.readState).toHaveBeenCalledTimes(2))
  })

  it('asks nothing when the read fails, when the caller is not working the job, or on a job on no site', async () => {
    for (const readState of [
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
      vi.fn(async () => ({ ok: false })),
      vi.fn(async () => reply({ development_id: null })),
    ]) {
      const io = makeIo({ readState })
      const { result, unmount } = draw(io)
      await waitFor(() => expect(readState).toHaveBeenCalled())
      await act(async () => undefined)
      expect(result.current.view).toEqual({ kind: 'none' })
      expect(io.readShop).not.toHaveBeenCalled()
      expect(geo.asked).toBe(false)
      expect(io.act).not.toHaveBeenCalled()
      unmount()
    }
  })

  it('reads the shop and the site’s point only when the distance alone would decide, and asks on a far site', async () => {
    geo.point = FAR
    const io = makeIo()
    const { result } = draw(io)
    await waitFor(() => expect(result.current.view.kind).toBe('ask'))
    expect(io.readShop).toHaveBeenCalledTimes(1)
    expect(geo.asked).toBe(true)
    expect(result.current.view).toMatchObject({ kind: 'ask', siteLine: 'Heron Point · 1,181 miles from the shop', joins: [] })
  })

  it('asks by the one setting: a site about 104 miles off is far at 90 miles and near at the default (v2.7888)', async () => {
    geo.point = { lat: 31.5, lng: -97 }
    const set = makeIo({ readFarMiles: vi.fn(async () => 90) })
    const a = draw(set)
    await waitFor(() => expect(a.result.current.view.kind).toBe('ask'))
    expect(set.readFarMiles).toHaveBeenCalledTimes(1)
    a.unmount()

    const plain = makeIo()
    const b = draw(plain)
    await waitFor(() => expect(plain.readShop).toHaveBeenCalled())
    await act(async () => undefined)
    expect(b.result.current.view).toEqual({ kind: 'none' })
    b.unmount()

    // A setting that will not read answers the default, and the phone still asks on a truly far site.
    geo.point = FAR
    const failing = makeIo({
      readFarMiles: vi.fn(async () => {
        throw new Error('no signal')
      }),
    })
    const c = draw(failing)
    await waitFor(() => expect(c.result.current.view.kind).toBe('ask'))
  })

  it('asks nothing on a near site with no trip, or when a point will not read', async () => {
    geo.point = NEAR
    const near = makeIo()
    const a = draw(near)
    await waitFor(() => expect(near.readShop).toHaveBeenCalled())
    await act(async () => undefined)
    expect(a.result.current.view).toEqual({ kind: 'none' })
    a.unmount()

    geo.point = FAR
    const noShop = makeIo({
      readShop: vi.fn(async () => {
        throw new Error('no signal')
      }),
    })
    const b = draw(noShop)
    await waitFor(() => expect(noShop.readShop).toHaveBeenCalled())
    await act(async () => undefined)
    expect(b.result.current.view).toEqual({ kind: 'none' })
  })

  it('reads no point where the site has had a trip or a crewmate is out: the state already answers', async () => {
    const io = makeIo({ readState: vi.fn(async () => reply({ has_trips: true, open: [LUIS] })) })
    const { result } = draw(io)
    await waitFor(() => expect(result.current.view.kind).toBe('ask'))
    expect(result.current.view).toMatchObject({ siteLine: 'Heron Point', joins: [{ tripId: 't2', label: 'Join Luis’s trip, out since Mon' }] })
    expect(io.readShop).not.toHaveBeenCalled()
    expect(geo.asked).toBe(false)
  })
})

describe('useTripPhone: before the clock in', () => {
  it('reads the state for the banner alone: no question, no distance, no paint', async () => {
    geo.point = FAR
    const io = makeIo({ readState: vi.fn(async () => reply({ has_trips: true, open: [LUIS] })) })
    const { result } = draw(io, { sessionId: null })
    await waitFor(() => expect(io.readState).toHaveBeenCalledTimes(1))
    await act(async () => undefined)
    expect(result.current.view).toEqual({ kind: 'none' })
    expect(io.readShop).not.toHaveBeenCalled()
    expect(geo.asked).toBe(false)
    expect(io.act).not.toHaveBeenCalled()
  })

  it('shows the banner of an open trip, counting today, and paints nothing until the clock in', async () => {
    const io = makeIo({ readState: vi.fn(async () => reply({ has_trips: true, mine: YESTERDAY })) })
    const { result, rerender } = draw(io, { sessionId: null })
    await waitFor(() => expect(result.current.view).toMatchObject({ kind: 'banner', title: 'Trip 5 · day 3 at Heron Point', todayKind: null }))
    expect(io.act).not.toHaveBeenCalled()
    // The clock in goes through: the state is read again, and today is painted At the site.
    rerender({ sessionId: 's1' })
    await waitFor(() => expect(io.act).toHaveBeenCalledWith({ action: 'day', job_id: 'j2101', trip_id: 't1', kind: 'site' }))
    expect(io.readState).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(result.current.view).toMatchObject({ kind: 'banner', todayKind: 'site' }))
  })

  it('asks once the clock in has gone through', async () => {
    const io = makeIo({ readState: vi.fn(async () => reply({ has_trips: true })) })
    const { result, rerender } = draw(io, { sessionId: null })
    await waitFor(() => expect(io.readState).toHaveBeenCalledTimes(1))
    await act(async () => undefined)
    expect(result.current.view.kind).toBe('none')
    rerender({ sessionId: 's1' })
    await waitFor(() => expect(result.current.view.kind).toBe('ask'))
  })
})

describe('useTripPhone: the quiet paint', () => {
  it('paints today At the site once for a person with an open trip, and counts the day without a second read', async () => {
    const io = makeIo({ readState: vi.fn(async () => reply({ has_trips: true, mine: YESTERDAY })) })
    const { result, rerender } = draw(io)
    await waitFor(() => expect(result.current.view).toMatchObject({ kind: 'banner', title: 'Trip 5 · day 3 at Heron Point', todayKind: 'site' }))
    rerender({ sessionId: 's1' })
    expect(io.act).toHaveBeenCalledTimes(1)
    expect(io.act).toHaveBeenCalledWith({ action: 'day', job_id: 'j2101', trip_id: 't1', kind: 'site' })
    expect(io.readState).toHaveBeenCalledTimes(1)
  })

  it('paints nothing when today is already the kind the session says', async () => {
    const atSite = makeIo({ readState: vi.fn(async () => reply({ has_trips: true, mine: MINE })) })
    const a = draw(atSite)
    await waitFor(() => expect(a.result.current.view).toMatchObject({ kind: 'banner', todayKind: 'site' }))
    await act(async () => undefined)
    expect(atSite.act).not.toHaveBeenCalled()
    a.unmount()

    const driving = makeIo({ readState: vi.fn(async () => reply({ has_trips: true, mine: { ...MINE, days: { ...YESTERDAY.days, [TODAY]: 'road' } } })) })
    const b = draw(driving, { travel: DRIVING })
    await waitFor(() => expect(b.result.current.view).toMatchObject({ kind: 'banner', todayKind: 'road' }))
    await act(async () => undefined)
    expect(driving.act).not.toHaveBeenCalled()
  })

  it('swallows a failed paint after one console warning, and does not try again', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const io = makeIo({
      readState: vi.fn(async () => reply({ has_trips: true, mine: YESTERDAY })),
      act: vi.fn(async () => {
        throw { message: 'Training mode is read-only. No trip was changed.', code: '42501' }
      }),
    })
    const { result, rerender } = draw(io)
    await waitFor(() => expect(warn).toHaveBeenCalledTimes(1))
    rerender({ sessionId: 's1' })
    await act(async () => undefined)
    expect(io.act).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledTimes(1)
    // The banner still draws, with today not painted.
    expect(result.current.view).toMatchObject({ kind: 'banner', title: 'Trip 5 · day 3 at Heron Point', daysLine: '1 day at the site · 1 on the road', todayKind: null })
  })
})

describe('useTripPhone: a day spent driving', () => {
  it('waits for the session’s stamps: nothing is asked or painted while the card is still reading them', async () => {
    const io = makeIo({ readState: vi.fn(async () => reply({ has_trips: true, mine: YESTERDAY })) })
    const { result, rerender } = draw(io, { travel: 'reading' })
    await waitFor(() => expect(result.current.view.kind).toBe('banner'))
    await act(async () => undefined)
    expect(io.act).not.toHaveBeenCalled()
    rerender({ sessionId: 's1', travel: DRIVING })
    await waitFor(() => expect(io.act).toHaveBeenCalledWith({ action: 'day', job_id: 'j2101', trip_id: 't1', kind: 'road' }))
    expect(io.act).toHaveBeenCalledTimes(1)
  })

  it('On my way and still driving: today is painted On the road, then At the site when the same session arrives', async () => {
    const io = makeIo({ readState: vi.fn(async () => reply({ has_trips: true, mine: YESTERDAY })) })
    const { result, rerender } = draw(io, { travel: DRIVING })
    await waitFor(() => expect(result.current.view).toMatchObject({ kind: 'banner', todayKind: 'road' }))
    expect(io.act).toHaveBeenCalledTimes(1)
    expect(io.act).toHaveBeenLastCalledWith({ action: 'day', job_id: 'j2101', trip_id: 't1', kind: 'road' })
    // The card reads the session again (I'm here): for a moment the stamps are unread, and nothing changes.
    rerender({ sessionId: 's1', travel: 'reading' })
    await act(async () => undefined)
    expect(io.act).toHaveBeenCalledTimes(1)
    rerender({ sessionId: 's1', travel: ARRIVED })
    await waitFor(() => expect(result.current.view).toMatchObject({ kind: 'banner', todayKind: 'site' }))
    expect(io.act).toHaveBeenCalledTimes(2)
    expect(io.act).toHaveBeenLastCalledWith({ action: 'day', job_id: 'j2101', trip_id: 't1', kind: 'site' })
    // Once: the same arrival read again paints nothing more, and no state was read for it.
    rerender({ sessionId: 's1', travel: ARRIVED })
    await act(async () => undefined)
    expect(io.act).toHaveBeenCalledTimes(2)
    expect(io.readState).toHaveBeenCalledTimes(1)
  })

  it('an arrival seen only after a reload still turns a road day into a site day', async () => {
    const io = makeIo({ readState: vi.fn(async () => reply({ has_trips: true, mine: { ...MINE, days: { ...YESTERDAY.days, [TODAY]: 'road' } } })) })
    draw(io, { travel: ARRIVED })
    await waitFor(() => expect(io.act).toHaveBeenCalledWith({ action: 'day', job_id: 'j2101', trip_id: 't1', kind: 'site' }))
    expect(io.act).toHaveBeenCalledTimes(1)
  })

  it('never turns a site day into a road day: a drive to the motel after work paints nothing', async () => {
    const io = makeIo({ readState: vi.fn(async () => reply({ has_trips: true, mine: MINE })) })
    const { result } = draw(io, { sessionId: 's2', travel: DRIVING })
    await waitFor(() => expect(result.current.view).toMatchObject({ kind: 'banner', todayKind: 'site' }))
    await act(async () => undefined)
    expect(io.act).not.toHaveBeenCalled()
  })

  it('leaves a Getting ready day alone: clocked in at home, on a drive, and when the session arrives', async () => {
    const ready = { ...MINE, days: { ...YESTERDAY.days, [TODAY]: 'ready' } }
    const io = makeIo({ readState: vi.fn(async () => reply({ has_trips: true, mine: ready })) })
    const { result, rerender } = draw(io, { travel: null })
    await waitFor(() => expect(result.current.view).toMatchObject({ kind: 'banner', todayKind: 'ready' }))
    await act(async () => undefined)
    rerender({ sessionId: 's1', travel: DRIVING })
    await act(async () => undefined)
    rerender({ sessionId: 's1', travel: ARRIVED })
    await act(async () => undefined)
    // A new clock session the same day leaves it alone too.
    rerender({ sessionId: 's2', travel: null })
    await waitFor(() => expect(io.readState).toHaveBeenCalledTimes(2))
    await act(async () => undefined)
    expect(io.act).not.toHaveBeenCalled()
    expect(result.current.view).toMatchObject({ kind: 'banner', todayKind: 'ready' })
    // Heading home is the person's own press, and does change it.
    await act(() => result.current.headHome())
    expect(io.act).toHaveBeenCalledTimes(1)
    expect(io.act).toHaveBeenLastCalledWith({ action: 'day', job_id: 'j2101', trip_id: 't1', kind: 'road' })
  })

  it('Start a trip and Join send On the road for a person still driving', async () => {
    const io = makeIo({ readState: vi.fn(async () => reply({ has_trips: true, open: [LUIS] })) })
    const { result } = draw(io, { travel: DRIVING })
    await waitFor(() => expect(result.current.view.kind).toBe('ask'))
    await act(() => result.current.start())
    expect(io.act).toHaveBeenLastCalledWith({ action: 'start', job_id: 'j2101', kind: 'road' })
    await act(() => result.current.join('t2'))
    expect(io.act).toHaveBeenLastCalledWith({ action: 'join', job_id: 'j2101', trip_id: 't2', kind: 'road' })
  })

  it('after Heading home nothing quiet paints in that session, on this screen or after a reload, and a new session may', async () => {
    const storage = memory()
    let days: Record<string, string> = { ...MINE.days }
    const io = makeIo({
      readState: vi.fn(async () => reply({ has_trips: true, mine: { ...MINE, days } })),
      act: vi.fn(async (a) => {
        if (a.action === 'day') days = { ...days, [TODAY]: a.kind }
      }),
    })
    const first = draw(io, { storage, travel: DRIVING })
    await waitFor(() => expect(first.result.current.view.kind).toBe('banner'))
    await act(() => first.result.current.headHome())
    expect(io.act).toHaveBeenCalledTimes(1)
    expect(io.act).toHaveBeenLastCalledWith({ action: 'day', job_id: 'j2101', trip_id: 't1', kind: 'road' })
    // The same session arrives: Heading home's road stays.
    first.rerender({ sessionId: 's1', travel: ARRIVED })
    await act(async () => undefined)
    expect(io.act).toHaveBeenCalledTimes(1)
    first.unmount()

    // The card is opened again in the same session, on the same device: still nothing.
    const again = draw(io, { storage, travel: ARRIVED })
    await waitFor(() => expect(again.result.current.view).toMatchObject({ kind: 'banner', todayKind: 'road' }))
    await act(async () => undefined)
    expect(io.act).toHaveBeenCalledTimes(1)

    // A new clock session at the site later that day paints At the site again.
    again.rerender({ sessionId: 's2', travel: null })
    await waitFor(() => expect(io.act).toHaveBeenCalledTimes(2))
    expect(io.act).toHaveBeenLastCalledWith({ action: 'day', job_id: 'j2101', trip_id: 't1', kind: 'site' })
  })
})

describe('useTripPhone: the acts', () => {
  it('Start a trip sends start and reads the state again', async () => {
    let started = false
    const io = makeIo({
      readState: vi.fn(async () => (started ? reply({ has_trips: true, mine: { ...MINE, first_day: TODAY, last_day: TODAY, days: { [TODAY]: 'site' }, with: [] } }) : reply({ has_trips: true }))),
      act: vi.fn(async () => {
        started = true
      }),
    })
    const { result } = draw(io)
    await waitFor(() => expect(result.current.view.kind).toBe('ask'))
    await act(() => result.current.start())
    expect(io.act).toHaveBeenCalledWith({ action: 'start', job_id: 'j2101', kind: 'site' })
    expect(result.current.view).toMatchObject({ kind: 'banner', title: 'Trip 5 · day 1 at Heron Point', sub: 'started Wed Oct 28' })
    expect(io.act).toHaveBeenCalledTimes(1)
  })

  it('Join sends the trip’s id', async () => {
    const io = makeIo({ readState: vi.fn(async () => reply({ has_trips: true, open: [LUIS] })) })
    const { result } = draw(io)
    await waitFor(() => expect(result.current.view.kind).toBe('ask'))
    await act(() => result.current.join('t2'))
    expect(io.act).toHaveBeenCalledWith({ action: 'join', job_id: 'j2101', trip_id: 't2', kind: 'site' })
    expect(io.readState).toHaveBeenCalledTimes(2)
  })

  it('a refused act throws the database’s words and leaves the question up', async () => {
    const refusal = { message: 'Training mode is read-only. No trip was changed.', code: '42501' }
    const io = makeIo({
      readState: vi.fn(async () => reply({ has_trips: true })),
      act: vi.fn(async () => {
        throw refusal
      }),
    })
    const { result } = draw(io)
    await waitFor(() => expect(result.current.view.kind).toBe('ask'))
    let thrown: unknown = null
    await act(async () => {
      await result.current.start().catch((e: unknown) => {
        thrown = e
      })
    })
    expect(thrown).toBe(refusal)
    expect(result.current.view.kind).toBe('ask')
  })

  it('Heading home paints today On the road, after the morning’s paint has landed', async () => {
    const order: string[] = []
    let release: () => void = () => undefined
    const io = makeIo({
      readState: vi.fn(async () => reply({ has_trips: true, mine: YESTERDAY })),
      act: vi.fn(async (a) => {
        if (a.action === 'day' && a.kind === 'site') await new Promise<void>((r) => (release = r))
        order.push(a.action === 'day' ? a.kind : a.action)
      }),
    })
    const { result } = draw(io)
    await waitFor(() => expect(io.act).toHaveBeenCalledTimes(1))
    let home: Promise<void> = Promise.resolve()
    act(() => {
      home = result.current.headHome()
    })
    release()
    await act(() => home)
    expect(order).toEqual(['site', 'road'])
    expect(result.current.view).toMatchObject({ kind: 'banner', todayKind: 'road' })
  })

  it('End the trip sends the outcome when typed, and the question waits for tomorrow', async () => {
    const storage = memory()
    const io = makeIo({ readState: vi.fn(async () => reply({ has_trips: true, mine: MINE })) })
    const { result } = draw(io, { storage })
    await waitFor(() => expect(result.current.view.kind).toBe('banner'))
    await act(() => result.current.end('  Did the work. Counted 98 boxes.  '))
    expect(io.act).toHaveBeenCalledWith({ action: 'end', job_id: 'j2101', trip_id: 't1', outcome: 'Did the work. Counted 98 boxes.' })
    expect(result.current.view).toEqual({ kind: 'none' })

    // Another screen on the same device, the same day: the site has had a trip, and nothing is asked.
    const again = makeIo({ readState: vi.fn(async () => reply({ has_trips: true })) })
    const b = draw(again, { storage })
    await waitFor(() => expect(again.readState).toHaveBeenCalled())
    await act(async () => undefined)
    expect(b.result.current.view).toEqual({ kind: 'none' })
  })

  it('End the trip with nothing typed sends no outcome', async () => {
    const io = makeIo({ readState: vi.fn(async () => reply({ has_trips: true, mine: MINE })) })
    const { result } = draw(io)
    await waitFor(() => expect(result.current.view.kind).toBe('banner'))
    await act(() => result.current.end('   '))
    expect(io.act).toHaveBeenCalledWith({ action: 'end', job_id: 'j2101', trip_id: 't1' })
  })

  it('Just clock in closes the question, holds on a device that cannot remember, and sends nothing', async () => {
    const io = makeIo({ readState: vi.fn(async () => reply({ has_trips: true })) })
    const { result } = draw(io, { storage: null })
    await waitFor(() => expect(result.current.view.kind).toBe('ask'))
    act(() => result.current.justClockIn())
    expect(result.current.view).toEqual({ kind: 'none' })
    expect(io.act).not.toHaveBeenCalled()
  })
})
