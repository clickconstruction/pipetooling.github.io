// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TYPED_SHOWN_ATTR, TYPED_TOUR_LAND_MAX_MS, TYPED_TOUR_SETTLE_MS, TYPED_TOUR_SHOWN_MS, pageTourDeps, startTypedTextTour, type TypedTourDeps, type TypedTourEnd } from './typedTextTour'
import { __forgetTypedTextForTests } from './typedText'

/**
 * A page as the walk sees it: places at heights down a long page, and a screen that shows one stretch of it.
 * `bring` puts a place in the middle of the screen, as `scrollIntoView({ block: 'center' })` does.
 */
function page(tops: Record<string, number>, screen = 800, scrollTakesMs = 0) {
  let scrolled = 0
  /** A smooth scroll: where the page is going, and when it set off. */
  let move: { from: number; to: number; at: number } | null = null
  const settle = () => {
    if (!move) return
    const part = scrollTakesMs <= 0 ? 1 : Math.min(1, (Date.now() - move.at) / scrollTakesMs)
    scrolled = move.from + (move.to - move.from) * part
    if (part >= 1) move = null
  }
  const els = Object.keys(tops).map((id) => {
    const el = document.createElement('textarea')
    el.id = id
    document.body.appendChild(el)
    return el
  })
  const log: string[] = []
  const gone = new Set<Element>()
  const deps: TypedTourDeps = {
    fields: () => els.filter((el) => !gone.has(el)),
    canShow: (el) => !gone.has(el) && tops[el.id] >= 0,
    inView: (el) => {
      settle()
      return tops[el.id] >= scrolled && tops[el.id] + 40 <= scrolled + screen
    },
    bring: (el) => {
      settle()
      move = { from: scrolled, to: Math.max(0, tops[el.id] - screen / 2), at: Date.now() }
      settle()
      log.push(`bring ${el.id}`)
    },
    top: (el) => {
      settle()
      return Math.round(tops[el.id] - scrolled)
    },
    ring: (el, on) => {
      if (on) el.setAttribute(TYPED_SHOWN_ATTR, '')
      else el.removeAttribute(TYPED_SHOWN_ATTR)
      log.push(`${on ? 'ring' : 'lift'} ${el.id}`)
    },
    wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  }
  const ringed = () => els.filter((el) => el.hasAttribute(TYPED_SHOWN_ATTR)).map((el) => el.id)
  return {
    deps,
    log,
    ringed,
    remove: (id: string) => gone.add(els.find((el) => el.id === id) as Element),
    at: () => {
      settle()
      return scrolled
    },
  }
}

describe('startTypedTextTour: the walk through what was typed', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    document.body.innerHTML = ''
    __forgetTypedTextForTests()
  })
  afterEach(() => vi.useRealTimers())

  const ended = (done: Promise<TypedTourEnd>) => {
    let end: TypedTourEnd | 'running' = 'running'
    void done.then((e) => (end = e))
    return () => end
  }

  it('one place already on the screen: ringed at once, for a second, and the page does not wait to move', async () => {
    const p = page({ note: 300 })
    const tour = startTypedTextTour(p.deps)
    const end = ended(tour.done)
    expect(p.ringed()).toEqual(['note'])
    await vi.advanceTimersByTimeAsync(TYPED_TOUR_SHOWN_MS - 1)
    expect(p.ringed()).toEqual(['note'])
    expect(end()).toBe('running')
    await vi.advanceTimersByTimeAsync(1)
    expect(p.ringed()).toEqual([])
    expect(end()).toBe('shown')
  })

  it('a place down the page: the page goes to it, the ring rides with it, and it is held a second after it lands', async () => {
    const p = page({ message: 3000 })
    const tour = startTypedTextTour(p.deps)
    const end = ended(tour.done)
    expect(p.log.slice(0, 2)).toEqual(['bring message', 'ring message'])
    expect(p.at()).toBe(2600)
    await vi.advanceTimersByTimeAsync(TYPED_TOUR_SETTLE_MS + TYPED_TOUR_SHOWN_MS - 1)
    expect(p.ringed()).toEqual(['message'])
    await vi.advanceTimersByTimeAsync(1)
    expect(end()).toBe('shown')
    expect(p.ringed()).toEqual([])
  })

  it('a long smooth scroll: the second counts from when the place lands, not from when the page set off', async () => {
    // Seen in the built app: 51,000 pixels down a list took over a second, and the ring lifted as it arrived.
    const p = page({ message: 51_000 }, 800, 1_400)
    const tour = startTypedTextTour(p.deps)
    const end = ended(tour.done)
    await vi.advanceTimersByTimeAsync(1_400)
    expect(p.deps.inView(document.getElementById('message') as Element)).toBe(true)
    // Landed. It is judged still two looks later, and held a full second from there.
    await vi.advanceTimersByTimeAsync(TYPED_TOUR_SETTLE_MS + TYPED_TOUR_SHOWN_MS - 1)
    expect(p.ringed()).toEqual(['message'])
    expect(end()).toBe('running')
    await vi.advanceTimersByTimeAsync(1)
    expect(end()).toBe('shown')
  })

  it('says when each stop has landed, with its places, so the pill can step clear of them', async () => {
    const p = page({ name: 100, phone: 160, far: 51_000 }, 800, 1_400)
    const stops: Array<{ ids: string[]; farInView: boolean }> = []
    const far = () => document.getElementById('far') as Element
    const tour = startTypedTextTour({ ...p.deps, onStop: (places) => stops.push({ ids: places.map((el) => el.id), farInView: p.deps.inView(far()) }) })
    const end = ended(tour.done)
    expect(stops).toEqual([{ ids: ['name', 'phone'], farInView: false }])
    await vi.advanceTimersByTimeAsync(TYPED_TOUR_SHOWN_MS + 1_000)
    // The page is still on its way to the far place: no stop is said yet.
    expect(stops).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(400 + TYPED_TOUR_SETTLE_MS)
    expect(stops[1]).toEqual({ ids: ['far'], farInView: true })
    await vi.advanceTimersByTimeAsync(TYPED_TOUR_SHOWN_MS)
    expect(end()).toBe('shown')
  })

  it('a page that never stops moving is not waited on for ever', async () => {
    const p = page({ message: 51_000 }, 800, 60_000)
    const tour = startTypedTextTour(p.deps)
    const end = ended(tour.done)
    await vi.advanceTimersByTimeAsync(TYPED_TOUR_LAND_MAX_MS + TYPED_TOUR_SHOWN_MS - 1)
    expect(end()).toBe('running')
    await vi.advanceTimersByTimeAsync(1)
    expect(end()).toBe('shown')
  })

  it('several places: it takes the person between them, top first, one at a time', async () => {
    const p = page({ note: 200, report: 2400, message: 5200 })
    const tour = startTypedTextTour(p.deps)
    const end = ended(tour.done)
    expect(p.ringed()).toEqual(['note'])
    await vi.advanceTimersByTimeAsync(TYPED_TOUR_SHOWN_MS)
    expect(p.ringed()).toEqual(['report'])
    await vi.advanceTimersByTimeAsync(TYPED_TOUR_SETTLE_MS + TYPED_TOUR_SHOWN_MS)
    expect(p.ringed()).toEqual(['message'])
    expect(end()).toBe('running')
    await vi.advanceTimersByTimeAsync(TYPED_TOUR_SETTLE_MS + TYPED_TOUR_SHOWN_MS)
    expect(end()).toBe('shown')
    expect(p.ringed()).toEqual([])
    expect(p.log.filter((l) => l.startsWith('bring'))).toEqual(['bring note', 'bring report', 'bring message'])
  })

  it('places that can be seen together are one stop: a form of short fields is not six stops', async () => {
    const p = page({ name: 100, phone: 160, address: 220, note: 300, far: 4000 })
    const tour = startTypedTextTour(p.deps)
    const end = ended(tour.done)
    expect(p.ringed()).toEqual(['name', 'phone', 'address', 'note'])
    await vi.advanceTimersByTimeAsync(TYPED_TOUR_SHOWN_MS)
    expect(p.ringed()).toEqual(['far'])
    await vi.advanceTimersByTimeAsync(TYPED_TOUR_SETTLE_MS + TYPED_TOUR_SHOWN_MS)
    expect(end()).toBe('shown')
    // Two stops, each place ringed once.
    expect(p.log.filter((l) => l.startsWith('ring')).sort()).toEqual(['ring address', 'ring far', 'ring name', 'ring note', 'ring phone'])
  })

  it('a place that cannot be brought to the screen is passed over, and the others are still shown', async () => {
    const p = page({ folded: -1, note: 300 })
    const tour = startTypedTextTour(p.deps)
    const end = ended(tour.done)
    expect(p.ringed()).toEqual(['note'])
    await vi.advanceTimersByTimeAsync(TYPED_TOUR_SHOWN_MS)
    expect(end()).toBe('shown')
    expect(p.log.some((l) => l.includes('folded'))).toBe(false)
  })

  it('nothing it can show: it still takes a stop’s time, so the confirm is never live at once', async () => {
    const p = page({ folded: -1 })
    const tour = startTypedTextTour(p.deps)
    const end = ended(tour.done)
    await vi.advanceTimersByTimeAsync(TYPED_TOUR_SHOWN_MS - 1)
    expect(end()).toBe('running')
    await vi.advanceTimersByTimeAsync(1)
    expect(end()).toBe('nothing')
  })

  it('stopped: every ring lifts at once and the walk goes no further', async () => {
    const p = page({ note: 200, message: 5200 })
    const tour = startTypedTextTour(p.deps)
    const end = ended(tour.done)
    await vi.advanceTimersByTimeAsync(400)
    expect(p.ringed()).toEqual(['note'])
    tour.stop()
    expect(p.ringed()).toEqual([])
    await vi.advanceTimersByTimeAsync(10_000)
    expect(end()).toBe('stopped')
    expect(p.log.some((l) => l.includes('message'))).toBe(false)
  })

  it('a place that leaves the page while another is shown is not waited for', async () => {
    const p = page({ note: 200, message: 5200 })
    const tour = startTypedTextTour(p.deps)
    const end = ended(tour.done)
    p.remove('message')
    await vi.advanceTimersByTimeAsync(TYPED_TOUR_SHOWN_MS)
    expect(end()).toBe('shown')
  })
})

describe('pageTourDeps: the walk over the real page', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    __forgetTypedTextForTests()
  })

  /** jsdom lays nothing out: a box is given by hand. */
  const box = (el: Element, top: number, height = 60) => {
    el.getBoundingClientRect = () => ({ top, bottom: top + height, left: 10, right: 310, width: 300, height, x: 10, y: top, toJSON: () => ({}) })
  }

  it('reads the typed places off the page, and the ring is the attribute the stylesheet draws', () => {
    document.body.innerHTML = '<textarea id="a">Call before you come.</textarea><textarea id="b"></textarea>'
    const deps = pageTourDeps()
    const a = document.getElementById('a') as Element
    expect(deps.fields()).toEqual([a])
    deps.ring(a, true)
    expect(a.hasAttribute(TYPED_SHOWN_ATTR)).toBe(true)
    deps.ring(a, false)
    expect(a.hasAttribute(TYPED_SHOWN_ATTR)).toBe(false)
  })

  it('a place with no box (a folded section) cannot be shown; one with a box can', () => {
    document.body.innerHTML = '<textarea id="a">x</textarea><textarea id="b">y</textarea>'
    const deps = pageTourDeps()
    const a = document.getElementById('a') as Element
    const b = document.getElementById('b') as Element
    box(a, 100)
    box(b, 0, 0)
    expect(deps.canShow(a)).toBe(true)
    expect(deps.canShow(b)).toBe(false)
    a.remove()
    expect(deps.canShow(a)).toBe(false)
  })

  it('on the screen means inside it and with nothing over it', () => {
    document.body.innerHTML = '<textarea id="a">x</textarea><div id="cover"></div>'
    const deps = pageTourDeps()
    const a = document.getElementById('a') as Element
    box(a, 100)
    expect(deps.inView(a)).toBe(true)
    box(a, window.innerHeight + 200)
    expect(deps.inView(a)).toBe(false)
    box(a, -500)
    expect(deps.inView(a)).toBe(false)
    // A window drawn over it.
    box(a, 100)
    const cover = document.getElementById('cover')
    document.elementFromPoint = () => cover
    expect(deps.inView(a)).toBe(false)
    document.elementFromPoint = () => a
    expect(deps.inView(a)).toBe(true)
    // @ts-expect-error jsdom has none of its own: put it back as it was
    delete document.elementFromPoint
  })

  it('bring asks for the middle of the screen, and a page that cannot scroll is let be', () => {
    document.body.innerHTML = '<textarea id="a">x</textarea>'
    const deps = pageTourDeps()
    const a = document.getElementById('a') as HTMLElement
    expect(() => deps.bring(a)).not.toThrow()
    const scroll = vi.fn()
    a.scrollIntoView = scroll
    deps.bring(a)
    expect(scroll).toHaveBeenCalledWith(expect.objectContaining({ block: 'center' }))
  })
})
