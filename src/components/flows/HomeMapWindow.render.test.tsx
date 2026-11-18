// @vitest-environment jsdom
/**
 * Find their home on the map: the found place draws as one pin in the shared frame (punch list
 * #395), so the window has the Satellite and Streets switch and the Time press, and one pin is its
 * own spot.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('../../lib/supabase', () => ({ supabase: { functions: { invoke: vi.fn() } } }))
vi.mock('../../lib/map/olderPhotosIo', () => ({ walkOlderPhotos: async () => [] }))
vi.mock('../map/PinsMapGoogleCanvas', () => ({ default: () => <div data-testid="google-canvas" /> }))
vi.mock('../map/PinsMapImageryCanvas', () => ({
  default: (p: { pins: Array<{ id: string; title: string }>; layer: string; fitPoints?: Array<{ lat: number; lng: number }> | null }) => (
    <div data-testid="canvas" data-layer={p.layer} data-fit={p.fitPoints ? p.fitPoints.map((x) => `${x.lat.toFixed(4)},${x.lng.toFixed(4)}`).join(' ') : ''}>
      {p.pins.map((pin) => (
        <span key={pin.id}>pin {pin.title}</span>
      ))}
    </div>
  ),
}))

import { HomeMapWindow } from './HomeMapWindow'

beforeEach(() => {
  vi.stubEnv('VITE_GOOGLE_MAPS_BROWSER_KEY', '')
})
afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

describe('HomeMapWindow', () => {
  it('shows no map until a place is found', () => {
    render(<HomeMapWindow start={{ words: '', pin: null }} onPick={() => {}} onClose={() => {}} />)
    expect(screen.getByText('The map shows the place once it is found.')).toBeTruthy()
    expect(screen.queryByTestId('canvas')).toBeNull()
    expect(document.querySelector('[data-map-time-press]')).toBeNull()
  })

  it('draws the found place as one pin, on Streets, and hands it back', async () => {
    const onPick = vi.fn()
    render(<HomeMapWindow start={{ words: 'Juniper Flat', pin: { lat: 30.2, lng: -98.1 } }} onPick={onPick} onClose={() => {}} />)
    const canvas = await screen.findByTestId('canvas')
    expect(canvas.textContent).toBe('pin Juniper Flat')
    expect(canvas.getAttribute('data-layer')).toBe('streets')
    fireEvent.click(screen.getByRole('button', { name: 'Use this place' }))
    expect(onPick).toHaveBeenCalledWith({ words: 'Juniper Flat', pin: { lat: 30.2, lng: -98.1 } })
  })

  it('Time frames the one pin with no press on it', async () => {
    render(<HomeMapWindow start={{ words: 'Juniper Flat', pin: { lat: 30.2, lng: -98.1 } }} onPick={() => {}} onClose={() => {}} />)
    const canvas = await screen.findByTestId('canvas')
    fireEvent.click(document.querySelector('[data-map-time-press]') as HTMLButtonElement)
    await waitFor(() => expect(document.querySelector('[data-map-time-caption]')?.textContent).toBe('Today’s photo of Juniper Flat. The archive has no older photo of this spot.'))
    expect(canvas.getAttribute('data-layer')).toBe('satellite')
    expect(canvas.getAttribute('data-fit')).toBe('30.1995,-98.1005 30.2005,-98.0995')
  })
})
