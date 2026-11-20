// @vitest-environment jsdom
/**
 * Render smoke for the pin ask on a box screen (punch list #372, step 3): the words, one press that pins the box where
 * the person stands, a reading too wide refused in words with Try again, and Not now. Every name and point is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { Container } from '../../lib/materials/onSite'

const pinContainer = vi.fn()
vi.mock('../../lib/materials/onSiteStore', () => ({ pinContainer: (...a: unknown[]) => pinContainer(...a) }))
vi.mock('../../hooks/useAuth', async () => (await import('../../test/renderSmokeMocks')).useAuthModuleMock())
/** Which phone the page takes itself to be on, for the Precise Location line's words (#402). */
const browser = vi.hoisted(() => ({ kind: 'iphone-safari' as string }))
vi.mock('../../hooks/usePreciseLocation', () => ({ usePhoneKind: () => browser.kind }))

import PinAskStrip from './PinAskStrip'

const box: Container = { id: 'a7', jobId: 'j1', label: 'A7', kind: 'cage', where: '', locationId: null, lat: null, lng: null, retiredAt: null, createdAt: '2026-10-20T15:00:00Z' }
const onPinned = vi.fn()
const onLater = vi.fn()
const phone = (accuracy: number | null) => Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (ok: (p: unknown) => void, fail: (e: unknown) => void) => (accuracy == null ? fail({ code: 1 }) : ok({ coords: { latitude: 29.5, longitude: -98.4, accuracy } })) } })

beforeEach(() => { pinContainer.mockReset(); onPinned.mockReset(); onLater.mockReset() })
afterEach(() => {
  cleanup()
  browser.kind = 'iphone-safari'
})

describe('PinAskStrip', () => {
  it('asks in one line and pins the box where the person stands', async () => {
    phone(5)
    renderWithProviders(<PinAskStrip container={box} byName="Priya Nair" onPinned={onPinned} onLater={onLater} />)
    expect(screen.getByRole('group', { name: 'Pin A7 where you stand?' }).textContent).toContain('The next person who looks for it starts from your pin.')
    fireEvent.click(screen.getByRole('button', { name: 'Pin it here' }))
    await waitFor(() => expect(pinContainer).toHaveBeenCalledWith('a7', { lat: 29.5, lng: -98.4 }, { accuracyM: 5, byName: 'Priya Nair' }))
    expect(onPinned).toHaveBeenCalledWith('A7 is pinned where you stand. Your phone was sure within 20 ft.')
  })

  it('a reading too wide is refused in words and the press becomes Try again', async () => {
    phone(120)
    renderWithProviders(<PinAskStrip container={box} byName="Priya Nair" onPinned={onPinned} onLater={onLater} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pin it here' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Your phone is only sure within 400 ft. A7 was not pinned. Try again in the open, or move the pin by hand.')
    expect(pinContainer).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
  })

  it('a reading that is only an area pins nothing and shows the way to the switch, not the open sky (#402)', async () => {
    phone(3200)
    renderWithProviders(<PinAskStrip container={box} byName="Priya Nair" onPinned={onPinned} onLater={onLater} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pin it here' }))
    const alert = await screen.findByRole('alert')
    expect(alert.querySelector('b')?.textContent).toBe('Precise Location looks off.')
    expect(alert.querySelector('[data-precise-compare]')?.textContent).toBe('Your phone nowwithin 2 milesWith Precise Location onwithin 20 ft')
    expect(alert.querySelector('[data-precise-note]')?.textContent).toBe('A7 was not pinned. Move the pin by hand, or turn the switch on and try again.')
    expect(alert.querySelectorAll('ol[data-precise-steps] li')).toHaveLength(5)
    expect(screen.getByTestId('pin-ask').textContent).not.toContain('Try again in the open')
    expect(pinContainer).not.toHaveBeenCalled()
    // The switch is on now: the same press pins the box.
    phone(5)
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(pinContainer).toHaveBeenCalledWith('a7', { lat: 29.5, lng: -98.4 }, { accuracyM: 5, byName: 'Priya Nair' }))
  })

  it('on a desk the rough reading names no switch (#402)', async () => {
    browser.kind = 'other'
    phone(3200)
    renderWithProviders(<PinAskStrip container={box} byName="Priya Nair" onPinned={onPinned} onLater={onLater} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pin it here' }))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('This device only knows the area it is in. It is only sure within 2 miles. A7 was not pinned. Move the pin by hand.')
    expect(alert.textContent).not.toMatch(/the switch/)
  })

  it('location switched off names the reason, and Not now puts the ask away', async () => {
    phone(null)
    renderWithProviders(<PinAskStrip container={box} byName="Priya Nair" onPinned={onPinned} onLater={onLater} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pin it here' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Location is off for this app.')
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(onLater).toHaveBeenCalledTimes(1)
  })
})
