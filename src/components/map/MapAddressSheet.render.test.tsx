// @vitest-environment jsdom
/**
 * The Map page's address sheet and the memory of a miss (punch list #408, step 3): a row for an
 * address nobody could place says the day it was checked and the day the app asks again, each day
 * drawn as a value, and **Try again** asks now and says what it found. Every address is made up.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MapAddressSheet } from './MapAddressSheet'
import type { MapPageEntity } from '../../hooks/useMapPageData'
import type { NotFoundGroup } from '../../lib/map/mapPageUnplaced'
import type { TryAgainOutcome } from '../../lib/map/unplacedMemory'

vi.mock('../../lib/openInExternalBrowser', () => ({ openInExternalBrowser: vi.fn() }))
vi.mock('../../lib/map/invokeGeocodeOneRefreshGoogleOnly', () => ({ GOOGLE_ONLY_REFRESH_PACING_MS: 0, invokeGeocodeOneRefreshGoogleOnly: vi.fn() }))

const job: MapPageEntity = { kind: 'job', id: 'j1', addressKey: 'zz the pasture behind the made up barn', addressLabel: 'ZZ the pasture behind the made up barn', lat: null, lng: null, tableLabel: 'ZZ Test barn', sublabel: 'J9001', linkTo: '/jobs?edit=j1', meta: 'working' }
const group = (checkedAt: string | null): NotFoundGroup<MapPageEntity> => ({ addressKey: job.addressKey, addressLabel: job.addressLabel, items: [job], error: 'Address not found', checkedAt })

function sheet(over: Partial<Parameters<typeof MapAddressSheet>[0]> = {}) {
  const props = {
    open: true,
    onClose: vi.fn(),
    noAddress: [],
    notFound: [group('2026-11-20T18:00:00Z')],
    resolving: 0,
    far: [],
    anchor: null,
    canRecheck: false,
    onOpen: vi.fn(),
    onShow: vi.fn(),
    onAfterRecheck: vi.fn(),
    onReviewAll: vi.fn(),
    onTryAgain: vi.fn(async (): Promise<TryAgainOutcome> => ({ kind: 'placed' })),
    ...over,
  }
  render(<MapAddressSheet {...props} />)
  return props
}

afterEach(cleanup)

describe('MapAddressSheet · an address nobody could place (punch list #408)', () => {
  it('says why, the day it was checked and the day the app asks again, with each day a value', () => {
    sheet()
    const row = document.querySelector('[data-not-found-row]')!
    expect(row.textContent).toContain('Address not found')
    const checked = row.querySelector('[data-miss-checked]')!
    expect(checked.textContent).toBe('Checked Nov 20. The app asks again by itself on Dec 20.')
    expect([...checked.querySelectorAll('[data-value="worked-out"]')].map((b) => b.textContent)).toEqual(['Nov 20', 'Dec 20'])
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'J9001 · ZZ Test barn' })).toBeTruthy()
  })

  it('a miss nobody kept has no day, and still offers Try again', () => {
    sheet({ notFound: [group(null)] })
    expect(document.querySelector('[data-miss-checked]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
  })

  it('Try again that places the address asks once, says so and reloads the map', async () => {
    const props = sheet()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(document.querySelector('[data-try-again-result="placed"]')).not.toBeNull())
    expect(props.onTryAgain).toHaveBeenCalledTimes(1)
    expect(props.onTryAgain).toHaveBeenCalledWith('ZZ the pasture behind the made up barn')
    expect(document.querySelector('[data-try-again-result]')!.textContent).toBe('Placed. The map is reloading with it.')
    await waitFor(() => expect(props.onAfterRecheck).toHaveBeenCalledTimes(1))
  })

  it('Try again that still finds no match moves the day to today and does not reload', async () => {
    const now = new Date().toISOString()
    const props = sheet({ onTryAgain: vi.fn(async (): Promise<TryAgainOutcome> => ({ kind: 'missed', reason: 'Address not found', checkedAt: now })) })
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(document.querySelector('[data-try-again-result="missed"]')).not.toBeNull())
    expect(document.querySelector('[data-try-again-result]')!.textContent).toBe('Still no match. Open the record and fix the address to place it.')
    expect(document.querySelector('[data-miss-checked]')!.textContent).not.toContain('Nov 20.')
    expect(props.onAfterRecheck).not.toHaveBeenCalled()
    // The press is live again for another try.
    expect((screen.getByRole('button', { name: 'Try again' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('a failed ask says its reason', async () => {
    sheet({ onTryAgain: vi.fn(async (): Promise<TryAgainOutcome> => ({ kind: 'failed', reason: 'Geocoding requires an active app account' })) })
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(document.querySelector('[data-try-again-result="failed"]')).not.toBeNull())
    expect(document.querySelector('[data-try-again-result]')!.textContent).toBe('Could not ask the map services. Geocoding requires an active app account')
  })

  it('while it asks, the press says so and is dead', async () => {
    let done: (o: TryAgainOutcome) => void = () => {}
    sheet({ onTryAgain: vi.fn(() => new Promise<TryAgainOutcome>((r) => (done = r))) })
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    const busy = await screen.findByRole('button', { name: 'Asking the map services…' })
    expect((busy as HTMLButtonElement).disabled).toBe(true)
    done({ kind: 'placed' })
    await waitFor(() => expect(document.querySelector('[data-try-again-result="placed"]')).not.toBeNull())
  })

  it('with nothing left to fix, the sheet says so as the good state', () => {
    sheet({ notFound: [] })
    const empty = document.querySelector('[data-empty-state]')!
    expect(empty.textContent).toContain('Nothing waiting on an address.')
    expect(empty.textContent).toContain('Every record with an address is on the map, and none is far from the office.')
  })
})
