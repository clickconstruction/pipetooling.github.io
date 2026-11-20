// @vitest-environment jsdom
/**
 * The Google canvas's doors to OpenStreetMap, with the Maps library stood in: the paint clock
 * (`paintClock.ts`), which runs only while the frame is in the window, the load timeout and
 * `gm_authFailure`. Google builds no map until its own observer sees the div, so a card far down a
 * long page has an empty frame with a good key, and must not be taken for a rejected one.
 */
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'

/** The stand-in script: it loads at once unless a case holds it back. */
const script = vi.hoisted(() => ({ loads: true }))
vi.mock('@vis.gl/react-google-maps', async () => {
  const { forwardRef, useEffect } = await import('react')
  return {
    APIProvider: (p: { onLoad?: () => void; children?: ReactNode }) => {
      const { onLoad } = p
      useEffect(() => {
        if (script.loads) onLoad?.()
        // once, as the library's own loader calls it
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])
      return <>{p.children}</>
    },
    // The map's own div. Google fills it with `.gm-style` when it paints; a case does that by hand.
    Map: (p: { children?: ReactNode; zoomControlOptions?: { position: number } }) => <div data-testid="map-div" data-zoom-at={p.zoomControlOptions ? String(p.zoomControlOptions.position) : 'google’s own'}>{p.children}</div>,
    // Google's own numbers for where a control sits.
    ControlPosition: { LEFT_TOP: 5, RIGHT_BOTTOM: 9 },
    Marker: forwardRef(() => null),
    InfoWindow: () => null,
    useMap: () => null,
    useMarkerRef: () => [() => {}, null],
  }
})

import PinsMapGoogleCanvas from './PinsMapGoogleCanvas'

/** The window's observer, stood in: a case says when the frame comes into the window and leaves it. */
class ObserverStub {
  static made: ObserverStub[] = []
  watched: Element[] = []
  connected = true
  constructor(
    readonly callback: (entries: Array<{ isIntersecting: boolean; target: Element }>) => void,
    readonly options?: { rootMargin?: string },
  ) {
    ObserverStub.made.push(this)
  }
  observe(el: Element) {
    this.watched.push(el)
  }
  unobserve() {}
  disconnect() {
    this.connected = false
  }
  takeRecords() {
    return []
  }
}

const PINS = [{ id: 'pump', lat: 29.55, lng: -98.3, color: '#7c3aed', title: 'Pump house' }]
const NEVER_PAINTED = 'render: the Maps API loaded but never painted a map (key rejected or blocked?)'

function mount() {
  const onUnavailable = vi.fn<(reason: string) => void>()
  const view = render(<PinsMapGoogleCanvas apiKey="test-key" onUnavailable={onUnavailable} pins={PINS} selectedId={null} onSelect={() => {}} fitSignal={0} height={300} isMobile={false} />)
  const observer = ObserverStub.made[ObserverStub.made.length - 1]
  // Its own map's div: a case may mount two canvases, and the page then holds two.
  const mapDiv = view.container.querySelector('[data-testid="map-div"]') as HTMLElement
  return {
    onUnavailable,
    view,
    observer,
    /** The frame comes into the window, or leaves it. */
    see: (isIntersecting: boolean) => act(() => observer?.callback([{ isIntersecting, target: mapDiv }])),
    /** Google paints. */
    paint: () => {
      const style = document.createElement('div')
      style.className = 'gm-style'
      mapDiv.appendChild(style)
    },
  }
}

const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms))

beforeEach(() => {
  vi.useFakeTimers()
  script.loads = true
  ObserverStub.made = []
  vi.stubGlobal('IntersectionObserver', ObserverStub)
  vi.stubGlobal('google', { maps: { SymbolPath: { CIRCLE: 0 } } })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  delete (window as Window & { gm_authFailure?: () => void }).gm_authFailure
})

describe('the paint clock', () => {
  it('watches the frame the map is in, with no margin of its own', () => {
    const { observer, view } = mount()
    expect(ObserverStub.made).toHaveLength(1)
    expect(observer?.watched).toEqual([view.getByTestId('map-div').parentElement])
    // Google's margin is 2,500 px at the least. Ours must never be wider, or the clock would start first.
    expect(observer?.options?.rootMargin).toBeUndefined()
  })

  it('a rejected key: a frame in the window that stays empty falls back at eight seconds', () => {
    const { onUnavailable, see } = mount()
    see(true)
    wait(7500)
    expect(onUnavailable).not.toHaveBeenCalled()
    wait(500)
    expect(onUnavailable).toHaveBeenCalledTimes(1)
    expect(onUnavailable).toHaveBeenCalledWith(NEVER_PAINTED)
    // Said once: the canvas stops looking.
    wait(20000)
    expect(onUnavailable).toHaveBeenCalledTimes(1)
  })

  it('a map that loads off screen is not taken for a rejected key, however long the page is left alone', () => {
    const { onUnavailable, see, paint } = mount()
    see(false)
    wait(60000)
    expect(onUnavailable).not.toHaveBeenCalled()
    // Scrolled to: Google's wait is over and it paints.
    see(true)
    wait(2000)
    paint()
    wait(60000)
    expect(onUnavailable).not.toHaveBeenCalled()
  })

  it('reads off screen until the window says otherwise, so the clock never starts on a guess', () => {
    const { onUnavailable } = mount()
    wait(60000)
    expect(onUnavailable).not.toHaveBeenCalled()
  })

  it('a rejected key far down the page still falls back, eight seconds after the card is scrolled to', () => {
    const { onUnavailable, see } = mount()
    see(false)
    wait(20000)
    see(true)
    wait(7500)
    expect(onUnavailable).not.toHaveBeenCalled()
    wait(500)
    expect(onUnavailable).toHaveBeenCalledWith(NEVER_PAINTED)
  })

  it('stops counting while the card is scrolled away, and picks up where it was', () => {
    const { onUnavailable, see } = mount()
    see(true)
    wait(5000)
    see(false)
    wait(30000)
    expect(onUnavailable).not.toHaveBeenCalled()
    see(true)
    wait(2500)
    expect(onUnavailable).not.toHaveBeenCalled()
    wait(500)
    expect(onUnavailable).toHaveBeenCalledTimes(1)
  })

  it('a map that paints in time is kept', () => {
    const { onUnavailable, see, paint } = mount()
    see(true)
    wait(3000)
    paint()
    wait(60000)
    expect(onUnavailable).not.toHaveBeenCalled()
  })

  it('a browser with no observer gets no wait from Google, so its clock runs from the load as before', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    const { onUnavailable } = mount()
    wait(7500)
    expect(onUnavailable).not.toHaveBeenCalled()
    wait(500)
    expect(onUnavailable).toHaveBeenCalledWith(NEVER_PAINTED)
  })

  it('lets go of the window when the map leaves the screen', () => {
    const { observer, view, onUnavailable } = mount()
    view.unmount()
    expect(observer?.connected).toBe(false)
    wait(60000)
    expect(onUnavailable).not.toHaveBeenCalled()
  })
})

describe('the other doors, as they were', () => {
  it('a script that never loads times out at ten seconds, wherever the frame is', () => {
    script.loads = false
    const { onUnavailable, see } = mount()
    see(false)
    wait(9999)
    expect(onUnavailable).not.toHaveBeenCalled()
    wait(1)
    expect(onUnavailable).toHaveBeenCalledTimes(1)
    expect(onUnavailable).toHaveBeenCalledWith('timeout: Maps JavaScript API did not load')
  })

  it('a script that loaded is not timed out', () => {
    const { onUnavailable, see } = mount()
    see(false)
    wait(30000)
    expect(onUnavailable).not.toHaveBeenCalled()
  })

  it('Google’s own word that the key is rejected falls back at once, off screen too', () => {
    const { onUnavailable, see } = mount()
    see(false)
    act(() => (window as Window & { gm_authFailure?: () => void }).gm_authFailure?.())
    expect(onUnavailable).toHaveBeenCalledWith('auth: Google rejected the browser key for this page')
  })

  it('two Google maps on one screen are both told the key is rejected, the one that came first too', () => {
    // A window with a map of its own, open over a page with one. The global holds one function.
    const page = mount()
    const over = mount()
    act(() => (window as Window & { gm_authFailure?: () => void }).gm_authFailure?.())
    expect(page.onUnavailable).toHaveBeenCalledWith('auth: Google rejected the browser key for this page')
    expect(over.onUnavailable).toHaveBeenCalledWith('auth: Google rejected the browser key for this page')
    expect(page.onUnavailable).toHaveBeenCalledTimes(1)
    expect(over.onUnavailable).toHaveBeenCalledTimes(1)
  })

  it('a map still hears when the one that came before it leaves first', () => {
    const first = mount()
    const second = mount()
    first.view.unmount()
    act(() => (window as Window & { gm_authFailure?: () => void }).gm_authFailure?.())
    expect(first.onUnavailable).not.toHaveBeenCalled()
    expect(second.onUnavailable).toHaveBeenCalledWith('auth: Google rejected the browser key for this page')
  })
})

describe('where the zoom buttons sit (v2.8032)', () => {
  it('a map leaves them where Google puts them unless it keeps the bottom right for a press of its own', () => {
    const plain = mount()
    expect(plain.view.container.querySelector('[data-testid="map-div"]')?.getAttribute('data-zoom-at')).toBe('google’s own')
    plain.view.unmount()
    const view = render(<PinsMapGoogleCanvas apiKey="test-key" onUnavailable={() => {}} pins={PINS} selectedId={null} onSelect={() => {}} fitSignal={0} height={300} isMobile={false} zoomAtTopLeft />)
    expect(view.container.querySelector('[data-testid="map-div"]')?.getAttribute('data-zoom-at')).toBe('5')
  })
})
