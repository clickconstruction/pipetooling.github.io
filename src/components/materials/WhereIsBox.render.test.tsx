// @vitest-environment jsdom
/**
 * Render smoke for Where is it? on a box (punch list #372, step 2): the sentences, Show where I am with its distance,
 * I found it pinning the box where the finder stands, a reading too wide refused in words, the sheet of a box nobody
 * pinned, and Move the pin by hand. Every name, place and point is made up. The map is a stand-in that says what it
 * was handed.
 */
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
  default: (p: { pins: Array<{ label: string; tone?: string }>; me?: unknown; lineTo?: unknown; placing?: { label: string } | null; onCenterChange?: (c: { lat: number; lng: number }) => void }) => (
    <div data-testid="map" data-pins={p.pins.map((x) => `${x.label}:${x.tone}`).join(',')} data-me={p.me ? 'yes' : 'no'} data-line={p.lineTo ? 'yes' : 'no'} data-placing={p.placing?.label ?? ''}>
      {p.onCenterChange ? <button type="button" onClick={() => p.onCenterChange?.({ lat: 29.7, lng: -98.6 })}>drag the map</button> : null}
    </div>
  ),
}))

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
afterEach(() => cleanup())

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
