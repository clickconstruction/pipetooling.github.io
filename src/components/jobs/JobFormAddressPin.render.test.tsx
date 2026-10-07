// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import JobFormAddressPin from './JobFormAddressPin'

const db = vi.hoisted(() => ({ cached: false, invoke: vi.fn(), refresh: vi.fn() }))

vi.mock('../../hooks/useAuth', () => ({ useOptionalAuth: () => ({ role: 'assistant', user: { id: 'u1' }, loading: false }) }))
vi.mock('../../lib/map/invokeGeocodeOneRefreshGoogleOnly', () => ({ invokeGeocodeOneRefreshGoogleOnly: (a: string) => db.refresh(a) }))
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: db.cached ? { lat: 1 } : null, error: null }) }) }) }),
    functions: { invoke: (name: string, opts: unknown) => db.invoke(name, opts) },
  },
}))

afterEach(() => {
  cleanup()
  db.cached = false
  db.invoke.mockReset()
  db.refresh.mockReset()
})

describe('JobFormAddressPin (v2.4783)', () => {
  it('a whole address pins itself after the pause and says its county and source; Google is one chip away', async () => {
    db.invoke.mockResolvedValue({ data: { ok: true, address_normalized: 'x', lat: 29.5, lng: -97.9, fromCache: false, source: 'nominatim', county: 'Guadalupe' }, error: null })
    db.refresh.mockResolvedValue({ ok: true, address_normalized: 'x', lat: 29.5, lng: -97.9, fromCache: false, source: 'google', county: 'Guadalupe', refreshed: true })
    render(<JobFormAddressPin address="380 TX-123, Seguin, TX 78155" />)
    await waitFor(() => expect(document.querySelector('[data-pin-state="unplaced"]')).not.toBeNull())
    await waitFor(() => expect(db.invoke).toHaveBeenCalledWith('geocode-one', { body: { address: '380 TX-123, Seguin, TX 78155' } }), { timeout: 3000 })
    await waitFor(() => expect(document.querySelector('[data-pin-state="placed"]')).not.toBeNull())
    const line = document.querySelector('[data-job-address-pin]')!
    expect(line.textContent).toContain('Guadalupe County')
    expect(line.textContent).toContain('pinned from the street map')
    fireEvent.click(screen.getByRole('button', { name: 'Not right? Pin from Google' }))
    await waitFor(() => expect(db.refresh).toHaveBeenCalledWith('380 TX-123, Seguin, TX 78155'))
    await waitFor(() => expect(document.querySelector('[data-job-address-pin]')!.textContent).toContain('pinned by Google'))
  })

  it('a fragment waits; the blur places it; a miss says why and offers another try', async () => {
    db.invoke.mockResolvedValue({ data: { ok: false, address_normalized: 'x', error: 'not_found' }, error: null })
    const { rerender } = render(<JobFormAddressPin address="6288 River Rd New Braunfels" blurSignal={0} />)
    await waitFor(() => expect(document.querySelector('[data-pin-state="unplaced"]')).not.toBeNull())
    expect(screen.getByRole('button', { name: 'Place it' })).toBeTruthy()
    await new Promise((r) => setTimeout(r, 1400))
    expect(db.invoke).not.toHaveBeenCalled()
    rerender(<JobFormAddressPin address="6288 River Rd New Braunfels" blurSignal={1} />)
    await waitFor(() => expect(db.invoke).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(document.querySelector('[data-pin-state="failed"]')).not.toBeNull())
    expect(document.querySelector('[data-job-address-pin]')!.textContent).toContain('it needs a street, a city or a ZIP')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
  })

  it('an address already in the cache reads placed at once, with no lookup', async () => {
    db.cached = true
    render(<JobFormAddressPin address="595 Cardinal Rd, Rosanky, TX 78953" />)
    await waitFor(() => expect(document.querySelector('[data-pin-state="placed"]')).not.toBeNull())
    expect(document.querySelector('[data-job-address-pin]')!.textContent).toContain('pinned earlier')
    expect(db.invoke).not.toHaveBeenCalled()
  })
})
