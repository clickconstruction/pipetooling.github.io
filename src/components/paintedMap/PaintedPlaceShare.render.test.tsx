// @vitest-environment jsdom
/**
 * Send more…, beside the press that sends one place (v2.7844). The one press stays one press. The
 * second is drawn only when the row has more to offer, and opens a sheet of up to three ways: the
 * place with its photo through the phone's share sheet, every place of the row's set in one text,
 * and the whole map. The gate, the slab and the trench are made up; nothing is a real row.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { smsHref } from '../../lib/gc/followUpSheet'
import type { PlaceSendMoreIo } from '../../lib/paintedMap/paintedPlaceSendMoreIo'

vi.mock('../../hooks/useModalStackEntry', () => ({ useModalStackEntry: () => () => true }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import { PaintedPlaceShare } from './PaintedPlaceShare'

afterEach(() => cleanup())

const GATE = { name: 'Truck gate', words: 'Close it behind you.', kind: 'gate', lat: 29.5, lng: -98.2 }
const SLAB = { name: 'The slab', words: '', kind: null, lat: 29.5002, lng: -98.2001 }
const TRENCH = { name: 'Open trench', words: 'Keep the truck off it.', kind: 'hazard', lat: 29.5004, lng: -98.2003 }
const LINK = (lat: string, lng: string) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
const GATE_WORDS = `Truck gate. Close it behind you.\n${LINK('29.500000', '-98.200000')}`
const ALL_WORDS = `${GATE_WORDS}\n\nThe slab.\n${LINK('29.500200', '-98.200100')}\n\nHazard: Open trench. Keep the truck off it.\n${LINK('29.500400', '-98.200300')}`

type Calls = { loads: Array<[string, string]>; shares: Array<{ file: File; text: string }>; copies: string[] }

/** A stand-in for the browser: the photo is handed over when the test lets it, the share sheet answers as told. */
function makeIo(opts: { canShare?: boolean; photo?: 'loads' | 'gone'; share?: 'shared' | 'backed-out' | 'refused'; copy?: 'refused' } = {}): { io: PlaceSendMoreIo; calls: Calls; land: () => Promise<void> } {
  const calls: Calls = { loads: [], shares: [], copies: [] }
  let hand: ((file: File | null) => void) | null = null
  const io: PlaceSendMoreIo = {
    canSharePhoto: () => opts.canShare ?? false,
    loadPhoto: (path, name) => {
      calls.loads.push([path, name])
      return new Promise<File | null>((resolve) => {
        hand = resolve
      })
    },
    share: (file, text) => {
      calls.shares.push({ file, text })
      if (opts.share === 'refused') return Promise.reject(new Error('NotAllowedError'))
      return Promise.resolve(opts.share !== 'backed-out')
    },
    copy: async (text) => {
      if (opts.copy === 'refused') throw new Error('NotAllowedError')
      calls.copies.push(text)
    },
  }
  const land = async () => {
    await act(async () => {
      hand?.(opts.photo === 'gone' ? null : new File(['jpeg'], calls.loads[0]?.[1] ?? 'x.jpg', { type: 'image/jpeg' }))
    })
  }
  return { io, calls, land }
}

const sheet = () => document.querySelector('[data-place-send-more-sheet]')
const way = (name: string) => document.querySelector(`[data-send-more="${name}"]`) as HTMLElement | null
const more = () => document.querySelector('[data-place-send-more]') as HTMLButtonElement | null

describe('the press beside Text this place…', () => {
  it('is not drawn for a row that was handed nothing more to send', () => {
    render(<PaintedPlaceShare place={GATE} phone />)
    expect(screen.getByText('Text this place…').getAttribute('href')).toBe(smsHref('', GATE_WORDS))
    expect(more()).toBeNull()
    expect(document.querySelector('[data-place-no-photo]')).toBeNull()
  })

  it('is not drawn when the sheet would have no way to offer: one place, no photo, a map this person cannot share', () => {
    const { io } = makeIo({ canShare: true })
    render(<PaintedPlaceShare place={GATE} phone io={io} more={{ set: [GATE], setKind: 'map' }} />)
    expect(more()).toBeNull()
  })

  it('leaves the one press as it was, and opens a sheet only on the second', () => {
    const { io } = makeIo()
    render(<PaintedPlaceShare place={GATE} phone io={io} more={{ set: [GATE, SLAB, TRENCH], setKind: 'job' }} />)
    expect(screen.getByText('Text this place…').getAttribute('href')).toBe(smsHref('', GATE_WORDS))
    expect(more()?.textContent).toBe('Send more…')
    expect(sheet()).toBeNull()
    fireEvent.click(more()!)
    expect(screen.getByRole('dialog', { name: 'Send more: Truck gate' })).toBeTruthy()
  })
})

describe('every place in one text', () => {
  it('on a phone is a link that opens Messages with each place and its map link, nobody picked', () => {
    const { io } = makeIo()
    render(<PaintedPlaceShare place={GATE} phone io={io} more={{ set: [GATE, SLAB, TRENCH], setKind: 'job' }} />)
    fireEvent.click(more()!)
    const all = way('all') as HTMLAnchorElement
    expect(all.tagName).toBe('A')
    expect(all.textContent).toBe('All 3 places on this job3 map pins in one text')
    expect(all.getAttribute('href')).toBe(smsHref('', ALL_WORDS))
    expect(way('photo')).toBeNull()
    expect(way('map')).toBeNull()
  })

  it('at a desk copies the same words and says so', async () => {
    const { io, calls } = makeIo()
    render(<PaintedPlaceShare place={GATE} phone={false} io={io} more={{ set: [GATE, SLAB, TRENCH], setKind: 'map' }} />)
    fireEvent.click(more()!)
    const all = way('all')!
    expect(all.tagName).toBe('BUTTON')
    expect(all.textContent).toBe('All 3 places on this mapCopies 3 map pins')
    fireEvent.click(all)
    await waitFor(() => expect(calls.copies).toEqual([ALL_WORDS]))
    expect(document.querySelector('[data-send-more-said]')?.textContent).toBe('Copied. Paste it into a text or an email.')
  })

  it('says so when the browser will not copy', async () => {
    const { io } = makeIo({ copy: 'refused' })
    render(<PaintedPlaceShare place={GATE} phone={false} io={io} more={{ set: [GATE, SLAB], setKind: 'map' }} />)
    fireEvent.click(more()!)
    expect(way('all')!.textContent).toBe('Both places on this mapCopies 2 map pins')
    fireEvent.click(way('all')!)
    await waitFor(() => expect(document.querySelector('[data-send-more-said]')?.textContent).toBe('This browser would not copy it. Open the map on a phone and press Send more….'))
  })
})

describe('this place with its photo', () => {
  const PHOTO = 'maps/m1/p1.jpg'

  it('says beside the press that a text leaves the photo behind', () => {
    const { io } = makeIo({ canShare: true })
    render(<PaintedPlaceShare place={GATE} phone io={io} more={{ set: [GATE], setKind: 'map', photoPath: PHOTO }} />)
    expect(document.querySelector('[data-place-no-photo]')?.textContent).toBe('A text carries the spot, not the photo.')
    expect(more()).toBeTruthy()
  })

  it('says the same of a copy at a desk, where nothing can carry the photo and no way is offered for it', () => {
    const { io } = makeIo({ canShare: false })
    render(<PaintedPlaceShare place={GATE} phone={false} io={io} more={{ set: [GATE], setKind: 'map', photoPath: PHOTO }} />)
    expect(document.querySelector('[data-place-no-photo]')?.textContent).toBe('A copy carries the spot, not the photo.')
    expect(more()).toBeNull()
  })

  it('reads the photo when the sheet opens, and its press is dead until the photo is in hand', async () => {
    const { io, calls, land } = makeIo({ canShare: true })
    render(<PaintedPlaceShare place={TRENCH} phone io={io} more={{ set: [TRENCH], setKind: 'map', photoPath: PHOTO }} />)
    expect(calls.loads).toEqual([])
    fireEvent.click(more()!)
    expect(calls.loads).toEqual([[PHOTO, 'Hazard-Open-trench.jpg']])
    const press = way('photo') as HTMLButtonElement
    expect(press.disabled).toBe(true)
    expect(press.textContent).toBe('This place with its photoGetting the photo…')
    fireEvent.click(press)
    expect(calls.shares).toEqual([])
    await land()
    expect((way('photo') as HTMLButtonElement).disabled).toBe(false)
    expect(way('photo')!.textContent).toBe('This place with its photoNobody signs in')
  })

  it('hands the photo and the place’s words to the phone’s share sheet inside the press, and closes once shared', async () => {
    const { io, calls, land } = makeIo({ canShare: true, share: 'shared' })
    render(<PaintedPlaceShare place={TRENCH} phone io={io} more={{ set: [TRENCH], setKind: 'map', photoPath: PHOTO }} />)
    fireEvent.click(more()!)
    await land()
    fireEvent.click(way('photo')!)
    // Asked for before anything is awaited: a phone opens its share sheet only inside the press.
    expect(calls.shares).toHaveLength(1)
    expect(calls.shares[0]?.file.name).toBe('Hazard-Open-trench.jpg')
    expect(calls.shares[0]?.text).toBe(`Hazard: Open trench. Keep the truck off it.\n${LINK('29.500400', '-98.200300')}`)
    await waitFor(() => expect(sheet()).toBeNull())
  })

  it('stays open and says nothing when the person backs out of the share sheet', async () => {
    const { io, calls, land } = makeIo({ canShare: true, share: 'backed-out' })
    render(<PaintedPlaceShare place={TRENCH} phone io={io} more={{ set: [TRENCH], setKind: 'map', photoPath: PHOTO }} />)
    fireEvent.click(more()!)
    await land()
    fireEvent.click(way('photo')!)
    await act(async () => {})
    expect(calls.shares).toHaveLength(1)
    expect(sheet()).toBeTruthy()
    expect(document.querySelector('[data-send-more-said]')).toBeNull()
  })

  it('says what to do when the phone refuses its share sheet', async () => {
    const { io, land } = makeIo({ canShare: true, share: 'refused' })
    render(<PaintedPlaceShare place={TRENCH} phone io={io} more={{ set: [TRENCH], setKind: 'map', photoPath: PHOTO }} />)
    fireEvent.click(more()!)
    await land()
    fireEvent.click(way('photo')!)
    await waitFor(() => expect(document.querySelector('[data-send-more-said]')?.textContent).toBe('This phone would not open its share sheet. Text the place by itself.'))
    expect(sheet()).toBeTruthy()
  })

  it('keeps the press dead and says so when the photo will not load', async () => {
    const { io, land } = makeIo({ canShare: true, photo: 'gone' })
    render(<PaintedPlaceShare place={TRENCH} phone io={io} more={{ set: [TRENCH], setKind: 'map', photoPath: PHOTO }} />)
    fireEvent.click(more()!)
    await land()
    expect((way('photo') as HTMLButtonElement).disabled).toBe(true)
    expect(document.querySelector('[data-send-more-said]')?.textContent).toBe('The photo would not load. Close this and open it again.')
  })
})

describe('the whole map', () => {
  it('closes the sheet and opens the map’s own Share, for whoever was handed that door', () => {
    const { io } = makeIo()
    const onShareMap = vi.fn()
    render(<PaintedPlaceShare place={GATE} phone io={io} more={{ set: [GATE], setKind: 'map', onShareMap }} />)
    fireEvent.click(more()!)
    expect(way('map')!.textContent).toBe('The whole mapWith its lines and photos. They give their name first.')
    fireEvent.click(way('map')!)
    expect(onShareMap).toHaveBeenCalledTimes(1)
    expect(sheet()).toBeNull()
  })

  it('names a job’s list as a list', () => {
    const { io } = makeIo()
    render(<PaintedPlaceShare place={GATE} phone io={io} more={{ set: [GATE], setKind: 'job', list: true, onShareMap: () => {} }} />)
    fireEvent.click(more()!)
    expect(way('map')!.textContent).toBe('The whole listWith its photos. They give their name first.')
  })

  it('draws the three ways in one order', async () => {
    const { io, land } = makeIo({ canShare: true })
    render(<PaintedPlaceShare place={GATE} phone io={io} more={{ set: [GATE, SLAB, TRENCH], setKind: 'map', photoPath: 'maps/m1/p1.jpg', onShareMap: () => {} }} />)
    fireEvent.click(more()!)
    await land()
    expect([...document.querySelectorAll('[data-send-more]')].map((el) => el.getAttribute('data-send-more'))).toEqual(['photo', 'all', 'map'])
  })
})

describe('closing the sheet', () => {
  it('closes on Close, on Escape and on a press outside it, and never passes that press to the window behind', () => {
    const { io } = makeIo()
    const behind = vi.fn()
    render(
      <div onClick={behind}>
        <PaintedPlaceShare place={GATE} phone io={io} more={{ set: [GATE, SLAB], setKind: 'job' }} />
      </div>,
    )
    fireEvent.click(more()!)
    behind.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(sheet()).toBeNull()

    fireEvent.click(more()!)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(sheet()).toBeNull()

    fireEvent.click(more()!)
    behind.mockClear()
    fireEvent.click(sheet()!)
    expect(sheet()).toBeNull()
    expect(behind).not.toHaveBeenCalled()

    // A press inside the sheet does not close it or reach the window either.
    fireEvent.click(more()!)
    behind.mockClear()
    fireEvent.click(screen.getByRole('dialog'))
    expect(sheet()).toBeTruthy()
    expect(behind).not.toHaveBeenCalled()
  })
})
