// @vitest-environment jsdom
/**
 * Render smoke for Where is it? on a box (punch list #372, step 2): the sentences, Show where I am with its distance,
 * I found it pinning the box where the finder stands, a reading too wide refused in words, the sheet of a box nobody
 * pinned, and Move the pin by hand. Every name, place and point is made up. The map is a stand-in that says what it
 * was handed.
 */
import { act, useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { Container, ContainerMove, Movement, Place } from '../../lib/materials/onSite'

const pinContainer = vi.fn()
vi.mock('../../lib/materials/onSiteStore', () => ({ pinContainer: (...a: unknown[]) => pinContainer(...a), updatePhoto: vi.fn() }))
vi.mock('../../hooks/useAuth', async () => (await import('../../test/renderSmokeMocks')).useAuthModuleMock())
const opened: string[] = []
vi.mock('../../lib/openInExternalBrowser', () => ({ openInExternalBrowser: (url: string) => { opened.push(url) } }))
vi.mock('./OnSiteMap', () => ({
  default: function MapStub(p: { pins: Array<{ label: string; tone?: string }>; me?: unknown; lineTo?: unknown; placing?: { label: string } | null; flyTo?: { lat: number; lng: number } | null; onCenterChange?: (c: { lat: number; lng: number }) => void }) {
    const { flyTo, onCenterChange } = p
    // The real map says where its ring is each time it is flown somewhere.
    useEffect(() => {
      if (flyTo) onCenterChange?.({ lat: flyTo.lat, lng: flyTo.lng })
    }, [flyTo, onCenterChange])
    return (
      <div data-testid="map" data-pins={p.pins.map((x) => `${x.label}:${x.tone}`).join(',')} data-me={p.me ? 'yes' : 'no'} data-line={p.lineTo ? 'yes' : 'no'} data-placing={p.placing?.label ?? ''} data-fly={flyTo ? `${flyTo.lat},${flyTo.lng}` : ''}>
        {p.onCenterChange ? <button type="button" onClick={() => p.onCenterChange?.({ lat: 29.7, lng: -98.6 })}>drag the map</button> : null}
      </div>
    )
  },
}))
/** Which phone the page takes itself to be on, for the Precise Location line's words (#402). The wait is the real one. */
vi.mock('../../hooks/usePreciseLocation', async (real) => ({ ...(await real<typeof import('../../hooks/usePreciseLocation')>()), usePhoneKind: () => 'iphone-safari' }))

import WhereIsBox from './WhereIsBox'

// Noon on the company's calendar, Tuesday Nov 17 2026.
const NOW = new Date('2026-11-17T18:00:00Z')
const PIN = { lat: 29.5, lng: -98.4 }
const places: Place[] = [{ id: 'yard', jobId: 'j1', name: 'Laydown yard', createdAt: '' }]
const box = (over: Partial<Container> = {}): Container => ({ id: 'a7', jobId: 'j1', label: 'A7', kind: 'cage', where: 'by the north fence', locationId: 'yard', lat: null, lng: null, retiredAt: null, createdAt: '2026-10-20T15:00:00Z', ...over })
const pinned = box({ ...PIN, pinnedAt: '2026-11-12T15:00:00Z', pinnedByName: 'Marcus Reyes', pinAccuracyM: 5.5 })
const a3 = box({ id: 'a3', label: 'A3', lat: 29.5001, lng: -98.4001 })
const moves: ContainerMove[] = [{ id: 'm1', jobId: 'j1', containerId: 'a7', fromLocationId: null, toLocationId: 'yard', byName: 'Marcus Reyes', at: '2026-10-28T16:00:00Z' }]
const movements: Movement[] = [{ id: 'c1', jobId: 'j1', partId: null, partName: 'Elbow', manufacturer: null, quantity: 40, reason: 'counted', fromContainerId: 'a7', toContainerId: 'a7', note: '', byUserId: null, byName: 'Marcus Reyes', at: '2026-11-12T15:05:00Z', source: null, itemId: null }]
const onMoveBox = vi.fn()
const draw = (container: Container) => renderWithProviders(<WhereIsBox touch container={container} containers={[container, a3]} places={places} moves={moves} movements={movements} photos={[]} jobCenter={PIN} jobAddress="100 Made-up Way" byName="Priya Nair" onMoveBox={onMoveBox} now={NOW} />)

/** A phone that answers with this reading, once for a press and again for each watch. */
function phoneAt(fix: { lat: number; lng: number; accuracy: number } | null, code = 2) {
  const answer = (ok: (p: unknown) => void, fail: (e: unknown) => void) => { if (fix) ok({ coords: { latitude: fix.lat, longitude: fix.lng, accuracy: fix.accuracy } }); else fail({ code }) }
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: answer, watchPosition: (ok: (p: unknown) => void, fail: (e: unknown) => void) => { answer(ok, fail); return 7 }, clearWatch: vi.fn() } })
}

beforeEach(() => { pinContainer.mockReset(); onMoveBox.mockReset(); opened.length = 0 })
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('WhereIsBox', () => {
  it('a pinned box: the place, the pin’s day and person, the last count, and the others of its place faint on the map', async () => {
    draw(pinned)
    const words = screen.getByTestId('where-is-box-words')
    expect(words.textContent).toContain('A7 is at Laydown yard, by the north fence.')
    expect(words.textContent).toContain('Pinned on Nov 12 by Marcus Reyes, within 20 ft.')
    expect(words.textContent).toContain('Marcus Reyes counted it last, on Nov 12.')
    const map = await screen.findByTestId('map')
    expect(map.getAttribute('data-pins')).toBe('A3:dim,A7:target')
    expect(map.getAttribute('data-me')).toBe('no')
    fireEvent.click(screen.getByRole('button', { name: 'Directions' }))
    expect(opened).toEqual(['https://www.google.com/maps/dir/?api=1&destination=29.500000,-98.400000'])
  })

  it('Show where I am draws the dot and the line and says about how far, and nothing is sent', async () => {
    phoneAt({ lat: PIN.lat - (240 * 0.3048) / 111_195, lng: PIN.lng, accuracy: 7 })
    draw(pinned)
    fireEvent.click(screen.getByRole('button', { name: 'Show where I am' }))
    const far = await screen.findByTestId('where-is-box-far')
    expect(far.textContent).toContain('About 240 ft north of you.')
    expect(far.textContent).toContain('Your phone is sure within 25 ft. The line is straight. It knows no fence, wall or gate.')
    const map = screen.getByTestId('map')
    expect(map.getAttribute('data-me')).toBe('yes')
    expect(map.getAttribute('data-line')).toBe('yes')
    expect(screen.getByText(/Your location stays on this phone/)).toBeTruthy()
    expect(pinContainer).not.toHaveBeenCalled()
  })

  it('I found it pins the box where the finder stands, with the phone’s margin, then asks about the place', async () => {
    phoneAt({ lat: 29.5004, lng: -98.4003, accuracy: 4.2 })
    draw(pinned)
    fireEvent.click(screen.getByRole('button', { name: 'I found it' }))
    await waitFor(() => expect(pinContainer).toHaveBeenCalledWith('a7', { lat: 29.5004, lng: -98.4003 }, { accuracyM: 4.2, byName: 'Priya Nair' }))
    expect(screen.getByRole('status').textContent).toBe('A7 is pinned where you stand. Your phone was sure within 15 ft.')
    expect(screen.getByText('Is A7 still at Laydown yard?')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Move box' }))
    expect(onMoveBox).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Yes, same place' }))
    expect(screen.queryByText('Is A7 still at Laydown yard?')).toBeNull()
  })

  it('with the dot on, I found it uses the reading already on the screen and asks the phone nothing more', async () => {
    phoneAt({ lat: 29.5004, lng: -98.4003, accuracy: 5 })
    draw(pinned)
    fireEvent.click(screen.getByRole('button', { name: 'Show where I am' }))
    await screen.findByTestId('where-is-box-far')
    const once = vi.fn()
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: once, watchPosition: () => 7, clearWatch: vi.fn() } })
    fireEvent.click(screen.getByRole('button', { name: 'I found it' }))
    expect(pinContainer).toHaveBeenCalledWith('a7', { lat: 29.5004, lng: -98.4003 }, { accuracyM: 5, byName: 'Priya Nair' })
    expect(once).not.toHaveBeenCalled()
  })

  it('a reading too wide to keep is refused in words, with Try again and the map to drag', async () => {
    phoneAt({ lat: 29.5004, lng: -98.4003, accuracy: 120 })
    draw(pinned)
    fireEvent.click(screen.getByRole('button', { name: 'I found it' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Your phone is only sure within 400 ft. A7 was not pinned. Try again in the open, or move the pin by hand.')
    expect(pinContainer).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Move the pin by hand' })).toBeTruthy()
  })

  it('I found it on a reading that is only an area pins nothing and shows the way to the switch, not the open sky (#402)', async () => {
    phoneAt({ lat: 29.9, lng: -98.9, accuracy: 3200 })
    draw(pinned)
    fireEvent.click(screen.getByRole('button', { name: 'I found it' }))
    const alert = await screen.findByRole('alert')
    expect(alert.querySelector('b')?.textContent).toBe('Precise Location looks off.')
    expect(alert.querySelector('[data-precise-compare]')?.textContent).toBe('Your phone nowwithin 2 milesWith Precise Location onwithin 20 ft')
    expect(alert.querySelector('[data-precise-note]')?.textContent).toBe('A7 was not pinned. Move the pin by hand, or turn the switch on and try again.')
    expect(alert.querySelectorAll('ol[data-precise-steps] li')).toHaveLength(5)
    expect(screen.getByTestId('where-is-box').textContent).not.toContain('Try again in the open')
    expect(pinContainer).not.toHaveBeenCalled()
    // The same two ways on as any reading that was not kept.
    expect(screen.getByRole('button', { name: 'Move the pin by hand' })).toBeTruthy()
    phoneAt({ lat: 29.5004, lng: -98.4003, accuracy: 5 })
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(pinContainer).toHaveBeenCalledWith('a7', { lat: 29.5004, lng: -98.4003 }, { accuracyM: 5, byName: 'Priya Nair' }))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('Show where I am waits 4 seconds on a rough reading, then says no distance can be told, with no dot on the map (#402)', async () => {
    phoneAt({ lat: 29.9, lng: -98.9, accuracy: 3200 })
    draw(pinned)
    await screen.findByTestId('map')
    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: 'Show where I am' }))
    // A phone with the switch on can open with one reading off a cell tower: the sheet is still finding you.
    expect(screen.getByTestId('where-is-box-finding').textContent).toBe('Finding you… This takes a few seconds in the open.')
    expect(screen.queryByTestId('where-is-box-far')).toBeNull()
    expect(screen.getByTestId('map').getAttribute('data-me')).toBe('no')
    act(() => { vi.advanceTimersByTime(3999) })
    expect(screen.queryByRole('alert')).toBeNull()
    act(() => { vi.advanceTimersByTime(1) })
    const alert = screen.getByRole('alert')
    expect(alert.querySelector('b')?.textContent).toBe('Precise Location looks off.')
    expect(alert.querySelector('[data-precise-note]')?.textContent).toBe('How far cannot be told from a reading that wide.')
    expect(screen.queryByTestId('where-is-box-far')).toBeNull()
    expect(screen.getByTestId('map').getAttribute('data-me')).toBe('no')
  })

  it('with the dot on, I found it on an area draws the steps once, and the next sure reading takes that answer back (#402)', async () => {
    // A phone that keeps answering the watch, one reading at a time.
    let feed: (fix: { lat: number; lng: number; accuracy: number }) => void = () => {}
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn(),
        watchPosition: (ok: (p: unknown) => void) => {
          feed = (fix) => ok({ coords: { latitude: fix.lat, longitude: fix.lng, accuracy: fix.accuracy } })
          return 7
        },
        clearWatch: vi.fn(),
      },
    })
    draw(pinned)
    await screen.findByTestId('map')
    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: 'Show where I am' }))
    act(() => { feed({ lat: 29.9, lng: -98.9, accuracy: 3200 }) })
    act(() => { vi.advanceTimersByTime(4000) })
    act(() => { feed({ lat: 29.9, lng: -98.9, accuracy: 3100 }) })
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'I found it' }))
    // The press's own answer about the area stands in for the live line: one alert, and the steps drawn once.
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.getByTestId('where-is-box-rough').querySelector('[data-precise-note]')?.textContent).toBe('A7 was not pinned. Move the pin by hand, or turn the switch on and try again.')
    expect(screen.queryByTestId('where-is-box-far-rough')).toBeNull()
    expect(document.querySelectorAll('ol[data-precise-steps]')).toHaveLength(1)
    expect(pinContainer).not.toHaveBeenCalled()
    // The phone's next reading is the same area: the answer stands, so the person still reads that nothing was pinned.
    act(() => { feed({ lat: 29.9, lng: -98.9, accuracy: 3000 }) })
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.getByTestId('where-is-box-rough').querySelector('[data-precise-note]')?.textContent).toBe('A7 was not pinned. Move the pin by hand, or turn the switch on and try again.')
    // The switch is on now. The next reading is a spot: the sheet stops saying it looks off and says how far.
    act(() => { feed({ lat: 29.5004, lng: -98.4003, accuracy: 5 }) })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByTestId('where-is-box-rough')).toBeNull()
    expect(screen.getByTestId('where-is-box-far').textContent).toContain('Your phone is sure within 20 ft.')
    expect(screen.getByTestId('map').getAttribute('data-me')).toBe('yes')
    expect(screen.getByRole('button', { name: 'I found it' })).toBeTruthy()
    expect(pinContainer).not.toHaveBeenCalled()
  })

  it('Use my location on a rough reading does not move the map, and on a sure one says the switch is on (#402)', async () => {
    phoneAt({ lat: 29.9, lng: -98.9, accuracy: 3200 })
    draw(pinned)
    fireEvent.click(screen.getByRole('button', { name: 'Move the pin by hand' }))
    fireEvent.click(screen.getByRole('button', { name: 'Use my location' }))
    const alert = await screen.findByRole('alert')
    expect(alert.querySelector('b')?.textContent).toBe('Precise Location looks off.')
    expect(alert.querySelector('[data-precise-note]')?.textContent).toBe('The map was not moved. Drag it until the ring is on the spot, or turn the switch on and press again.')
    expect((await screen.findByTestId('map')).getAttribute('data-fly')).toBe('')
    // The switch is on now: the map goes to the reading, and the line says so for as long as the ring sits on it.
    phoneAt({ lat: 29.5004, lng: -98.4003, accuracy: 5 })
    fireEvent.click(screen.getByRole('button', { name: 'Use my location' }))
    await waitFor(() => expect(screen.getByTestId('map').getAttribute('data-fly')).toBe('29.5004,-98.4003'))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByTestId('where-is-box-fly-read').textContent).toBe('Precise Location is on. Sure within 20 ft.')
    fireEvent.click(screen.getByRole('button', { name: 'drag the map' }))
    expect(screen.queryByTestId('where-is-box-fly-read')).toBeNull()
  })

  it('Use my location on a weak signal moves the map and asks for the ring (#402)', async () => {
    phoneAt({ lat: 29.5004, lng: -98.4003, accuracy: 35 })
    draw(pinned)
    fireEvent.click(screen.getByRole('button', { name: 'Move the pin by hand' }))
    fireEvent.click(screen.getByRole('button', { name: 'Use my location' }))
    await waitFor(() => expect(screen.getByTestId('map').getAttribute('data-fly')).toBe('29.5004,-98.4003'))
    expect(screen.getByTestId('where-is-box-fly-read').textContent).toBe('Precise Location is on, but the signal is weak here. Your phone is only sure within 120 ft. Drag the map until the ring is on the spot.')
  })

  it('a phone that cannot say where it is names the reason', async () => {
    phoneAt(null, 1)
    draw(pinned)
    fireEvent.click(screen.getByRole('button', { name: 'I found it' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Location is off for this app.')
  })

  it('a box nobody pinned says so, offers I found it first and the drive to the site', async () => {
    draw(box())
    const words = screen.getByTestId('where-is-box-words')
    expect(words.textContent).toContain('Nobody has pinned A7.')
    expect(words.textContent).toContain('It is at Laydown yard, by the north fence.')
    expect(words.textContent).toContain('Marcus Reyes put it there on Oct 28.')
    expect(screen.getByText('No pin yet, so there is no line to draw. When you find A7, press I found it.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Show where I am' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Directions to the site' }))
    expect(opened[0]).toContain('destination=100%20Made-up%20Way')
    expect((await screen.findByTestId('map')).getAttribute('data-pins')).toBe('A3:dim')
  })

  it('an old pin carries its caution', () => {
    draw({ ...pinned, pinnedAt: '2026-10-06T15:00:00Z' })
    expect(screen.getByText('That pin is 6 weeks old. Boxes get moved. If A7 is not there, look near it, then press I found it.')).toBeTruthy()
  })

  it('a place with a painted way says so and opens it (step 4)', () => {
    const onOpenWay = vi.fn()
    renderWithProviders(<WhereIsBox touch container={pinned} containers={[pinned]} places={[{ ...places[0]!, wayMapId: 'way-1' }]} moves={moves} movements={movements} photos={[]} jobCenter={PIN} jobAddress="100 Made-up Way" byName="Priya Nair" onMoveBox={onMoveBox} onOpenWay={onOpenWay} now={NOW} />)
    expect(screen.getByTestId('where-is-box-way').textContent).toContain('The way to Laydown yard is painted.')
    fireEvent.click(screen.getByRole('button', { name: 'Open the way' }))
    expect(onOpenWay).toHaveBeenCalledWith('way-1')
  })

  it('Send someone to it hands the host a task for the box, and is not drawn with no host for it (step 5)', () => {
    const onSendSomeone = vi.fn()
    renderWithProviders(<WhereIsBox touch container={pinned} containers={[pinned]} places={[{ ...places[0]!, wayMapId: 'way-1' }]} moves={moves} movements={movements} photos={[]} jobCenter={PIN} jobAddress="100 Made-up Way" byName="Priya Nair" onMoveBox={onMoveBox} onSendSomeone={onSendSomeone} now={NOW} />)
    fireEvent.click(screen.getByRole('button', { name: 'Send someone to it' }))
    expect(onSendSomeone).toHaveBeenCalledWith({ title: 'Find A7 at Laydown yard, by the north fence', links: [], place: { ...PIN, name: 'A7 at Laydown yard', accuracyM: 5.5, mapId: 'way-1', mapName: 'The way to Laydown yard' } })
    cleanup()
    draw(pinned)
    expect(screen.queryByRole('button', { name: 'Send someone to it' })).toBeNull()
  })

  it('a place with no way draws no way line', () => {
    draw(pinned)
    expect(screen.queryByTestId('where-is-box-way')).toBeNull()
  })

  it('Move the pin by hand puts the pin where the ring is, with no margin, and can take the pin off', async () => {
    draw(pinned)
    fireEvent.click(screen.getByRole('button', { name: 'Move the pin by hand' }))
    const map = await screen.findByTestId('map')
    expect(map.getAttribute('data-placing')).toBe('A7')
    const put = screen.getByRole('button', { name: 'Put A7 here' }) as HTMLButtonElement
    expect(put.disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'drag the map' }))
    fireEvent.click(screen.getByRole('button', { name: 'Put A7 here' }))
    expect(pinContainer).toHaveBeenCalledWith('a7', { lat: 29.7, lng: -98.6 }, { accuracyM: null, byName: 'Priya Nair' })
    fireEvent.click(screen.getByRole('button', { name: 'Move the pin by hand' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove the pin' }))
    expect(pinContainer).toHaveBeenLastCalledWith('a7', null)
    expect(screen.getByRole('status').textContent).toBe('A7’s pin is removed.')
  })
})
