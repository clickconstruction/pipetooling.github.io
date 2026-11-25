// @vitest-environment jsdom
/**
 * The swipe that puts a row away (punch list #426): a touch that moves left past the mark calls
 * the act, a shorter one springs back, a touch that moves down is a scroll, and a desk gets the
 * same act as a word press. Since v2.8603 a row may go right, the way back, and a swipe the wrong
 * way is answered by the row showing its strip. Since v2.8604 one row of a card shows the sign that
 * rows swipe, once it has stood in full view with no finger down and the page still.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { SwipeAwayRow } from './SwipeAwayRow'
import { SWIPE_AWAY_SETTLE_AT, SWIPE_BACK_EDGE_GUARD, SWIPE_SHOW_MS, swipeShowReach } from '../../lib/swipeAway'
import { SWIPE_SIGN_STILL_MS } from '../../lib/swipeSign'
import type { SwipeRowSign } from '../../hooks/useSwipeSign'

afterEach(() => {
  vi.useRealTimers()
})

const pointer = (el: Element, type: string, x: number, y = 10) => fireEvent(el, new window.MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 }))

function row(swipe: boolean, side?: 'left' | 'right') {
  const onAway = vi.fn()
  const onOpen = vi.fn()
  render(
    <SwipeAwayRow label={side === 'right' ? 'Show again' : 'Hide'} name="88 Quarry Rd Ste 100" swipe={swipe} side={side} onAway={onAway} radius={8}>
      {(press) => (
        <div>
          <button type="button" onClick={onOpen}>
            88 Quarry Rd Ste 100
          </button>
          {press}
        </div>
      )}
    </SwipeAwayRow>,
  )
  const slide = document.querySelector('[data-swipe-away-slide]') as HTMLElement | null
  const strip = document.querySelector('[data-swipe-away-strip]') as HTMLElement | null
  return { onAway, onOpen, slide, strip }
}

describe('SwipeAwayRow on a device held in the hand', () => {
  it('a swipe left past the mark turns the strip blue, and letting go puts the row away', () => {
    const { onAway, slide, strip } = row(true)
    pointer(slide!, 'pointerdown', 300)
    pointer(slide!, 'pointermove', 280)
    expect(strip!.getAttribute('data-swipe-away-strip')).toBe('rest')
    pointer(slide!, 'pointermove', 300 - SWIPE_AWAY_SETTLE_AT)
    expect(strip!.getAttribute('data-swipe-away-strip')).toBe('armed')
    expect(slide!.style.transform).toBe(`translateX(-${SWIPE_AWAY_SETTLE_AT}px)`)
    expect(onAway).not.toHaveBeenCalled()
    pointer(slide!, 'pointerup', 300 - SWIPE_AWAY_SETTLE_AT)
    expect(onAway).toHaveBeenCalledTimes(1)
  })

  it('a shorter swipe springs back and does nothing', () => {
    const { onAway, slide } = row(true)
    pointer(slide!, 'pointerdown', 300)
    pointer(slide!, 'pointermove', 280)
    pointer(slide!, 'pointermove', 300 - SWIPE_AWAY_SETTLE_AT + 10)
    pointer(slide!, 'pointerup', 300 - SWIPE_AWAY_SETTLE_AT + 10)
    expect(onAway).not.toHaveBeenCalled()
    expect(slide!.style.transform).toBe('translateX(0px)')
  })

  it('a touch that moves down is a scroll: the row does not move', () => {
    const { onAway, slide } = row(true)
    pointer(slide!, 'pointerdown', 300, 10)
    pointer(slide!, 'pointermove', 297, 60)
    pointer(slide!, 'pointermove', 150, 200)
    expect(slide!.style.transform).toBe('translateX(0px)')
    pointer(slide!, 'pointerup', 150, 200)
    expect(onAway).not.toHaveBeenCalled()
  })

  it('a swipe to the right puts nothing away: the row answers by showing its strip, then goes back', () => {
    vi.useFakeTimers()
    const { onAway, onOpen, slide, strip } = row(true)
    pointer(slide!, 'pointerdown', 100)
    pointer(slide!, 'pointermove', 130)
    // The row slides left by itself, far enough to read Hide and short of the mark.
    expect(slide!.style.transform).toBe(`translateX(-${swipeShowReach('Hide')}px)`)
    expect(slide!.getAttribute('data-swipe-away-showing')).toBe('true')
    expect(strip!.getAttribute('data-swipe-away-strip')).toBe('rest')
    // The rest of that touch moves nothing, however far it goes either way.
    pointer(slide!, 'pointermove', 300)
    pointer(slide!, 'pointermove', -200)
    expect(strip!.getAttribute('data-swipe-away-strip')).toBe('rest')
    pointer(slide!, 'pointerup', -200)
    expect(onAway).not.toHaveBeenCalled()
    // Letting go is not a press on the row either.
    fireEvent.click(screen.getByRole('button', { name: '88 Quarry Rd Ste 100' }))
    expect(onOpen).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(SWIPE_SHOW_MS.out + SWIPE_SHOW_MS.hold + SWIPE_SHOW_MS.back)
    })
    expect(slide!.style.transform).toBe('translateX(0px)')
    expect(slide!.getAttribute('data-swipe-away-showing')).toBeNull()
  })

  it('a right drag that began in the screen\'s left edge is the phone\'s Back: the row does not answer it', () => {
    const { onAway, slide } = row(true)
    pointer(slide!, 'pointerdown', SWIPE_BACK_EDGE_GUARD - 4)
    pointer(slide!, 'pointermove', 60)
    pointer(slide!, 'pointermove', 250)
    expect(slide!.style.transform).toBe('translateX(0px)')
    expect(slide!.getAttribute('data-swipe-away-showing')).toBeNull()
    pointer(slide!, 'pointerup', 250)
    expect(onAway).not.toHaveBeenCalled()
  })

  it('a touch stops a row that is showing its strip', () => {
    vi.useFakeTimers()
    const { slide } = row(true)
    pointer(slide!, 'pointerdown', 100)
    pointer(slide!, 'pointermove', 130)
    pointer(slide!, 'pointerup', 130)
    expect(slide!.getAttribute('data-swipe-away-showing')).toBe('true')
    pointer(slide!, 'pointerdown', 200)
    expect(slide!.style.transform).toBe('translateX(0px)')
    expect(slide!.getAttribute('data-swipe-away-showing')).toBeNull()
  })

  it('a person who asked for less motion gets no slide', () => {
    const real = window.matchMedia
    window.matchMedia = ((q: string) => ({ matches: q.includes('prefers-reduced-motion'), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
    try {
      const { onAway, slide } = row(true)
      pointer(slide!, 'pointerdown', 100)
      pointer(slide!, 'pointermove', 130)
      expect(slide!.style.transform).toBe('translateX(0px)')
      expect(slide!.getAttribute('data-swipe-away-showing')).toBeNull()
      pointer(slide!, 'pointerup', 130)
      expect(onAway).not.toHaveBeenCalled()
    } finally {
      window.matchMedia = real
    }
  })

  it('the strip is a real button, named for the act and the row: Tab slides the row aside and a press does the act', () => {
    const { onAway, slide } = row(true)
    const press = screen.getByRole('button', { name: 'Hide, 88 Quarry Rd Ste 100' })
    fireEvent.focus(press)
    expect(slide!.style.transform).toBe('translateX(-160px)')
    fireEvent.blur(press)
    expect(slide!.style.transform).toBe('translateX(0px)')
    fireEvent.click(press)
    expect(onAway).toHaveBeenCalledTimes(1)
  })

  it('a plain press on the row still reaches the row', () => {
    const { onOpen } = row(true)
    fireEvent.click(screen.getByRole('button', { name: '88 Quarry Rd Ste 100' }))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })
})

describe('SwipeAwayRow, the way back (side right)', () => {
  it('the strip is on the left, under the edge the row uncovers', () => {
    const { strip } = row(true, 'right')
    const holder = strip!.parentElement as HTMLElement
    expect(holder.style.left).toBe('0px')
    expect(holder.style.right).toBe('')
    expect(strip!.style.textAlign).toBe('left')
    expect(document.querySelector('[data-swipe-away-row]')!.getAttribute('data-swipe-away-row')).toBe('right')
  })

  it('a swipe right past the mark turns the strip blue, and letting go brings the row back', () => {
    const { onAway, slide, strip } = row(true, 'right')
    pointer(slide!, 'pointerdown', 100)
    pointer(slide!, 'pointermove', 120)
    expect(strip!.getAttribute('data-swipe-away-strip')).toBe('rest')
    pointer(slide!, 'pointermove', 100 + SWIPE_AWAY_SETTLE_AT)
    expect(strip!.getAttribute('data-swipe-away-strip')).toBe('armed')
    expect(slide!.style.transform).toBe(`translateX(${SWIPE_AWAY_SETTLE_AT}px)`)
    expect(onAway).not.toHaveBeenCalled()
    pointer(slide!, 'pointerup', 100 + SWIPE_AWAY_SETTLE_AT)
    expect(onAway).toHaveBeenCalledTimes(1)
  })

  it('a shorter swipe right springs back and does nothing', () => {
    const { onAway, slide } = row(true, 'right')
    pointer(slide!, 'pointerdown', 100)
    pointer(slide!, 'pointermove', 120)
    pointer(slide!, 'pointermove', 100 + SWIPE_AWAY_SETTLE_AT - 10)
    pointer(slide!, 'pointerup', 100 + SWIPE_AWAY_SETTLE_AT - 10)
    expect(onAway).not.toHaveBeenCalled()
    expect(slide!.style.transform).toBe('translateX(0px)')
  })

  it('a touch that starts in the screen\'s left edge does not move the row', () => {
    const { onAway, slide } = row(true, 'right')
    pointer(slide!, 'pointerdown', SWIPE_BACK_EDGE_GUARD - 4)
    pointer(slide!, 'pointermove', 60)
    pointer(slide!, 'pointermove', 260)
    expect(slide!.style.transform).toBe('translateX(0px)')
    pointer(slide!, 'pointerup', 260)
    expect(onAway).not.toHaveBeenCalled()
  })

  it('a swipe left brings nothing back: the row shows Show again on its left', () => {
    vi.useFakeTimers()
    const { onAway, slide } = row(true, 'right')
    pointer(slide!, 'pointerdown', 300)
    pointer(slide!, 'pointermove', 270)
    expect(slide!.style.transform).toBe(`translateX(${swipeShowReach('Show again')}px)`)
    pointer(slide!, 'pointerup', 270)
    expect(onAway).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(SWIPE_SHOW_MS.out + SWIPE_SHOW_MS.hold + SWIPE_SHOW_MS.back)
    })
    expect(slide!.style.transform).toBe('translateX(0px)')
  })

  it('Tab slides the row right to show its press, and the press does the act', () => {
    const { onAway, slide } = row(true, 'right')
    const press = screen.getByRole('button', { name: 'Show again, 88 Quarry Rd Ste 100' })
    fireEvent.focus(press)
    expect(slide!.style.transform).toBe('translateX(160px)')
    fireEvent.blur(press)
    expect(slide!.style.transform).toBe('translateX(0px)')
    fireEvent.click(press)
    expect(onAway).toHaveBeenCalledTimes(1)
  })

  it('at a desk it is the word press, as the way out is', () => {
    const { onAway, slide } = row(false, 'right')
    expect(slide).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show again, 88 Quarry Rd Ste 100' }))
    expect(onAway).toHaveBeenCalledTimes(1)
  })
})

describe('SwipeAwayRow, the sign that rows swipe (v2.8604)', () => {
  /** jsdom has no IntersectionObserver: this one is told what the row's share in view is. */
  let seen: Array<{ cb: IntersectionObserverCallback; gone: boolean }> = []
  const inView = (ratio: number) =>
    act(() => {
      for (const o of seen) if (!o.gone) o.cb([{ isIntersecting: ratio > 0, intersectionRatio: ratio } as IntersectionObserverEntry], {} as IntersectionObserver)
    })
  const pass = (ms: number) =>
    act(() => {
      vi.advanceTimersByTime(ms)
    })
  beforeEach(() => {
    seen = []
    vi.useFakeTimers()
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        private me: { cb: IntersectionObserverCallback; gone: boolean }
        constructor(cb: IntersectionObserverCallback) {
          this.me = { cb, gone: false }
          seen.push(this.me)
        }
        observe() {}
        unobserve() {}
        disconnect() {
          this.me.gone = true
        }
      },
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function signRow(sign: SwipeRowSign | undefined, opts: { swipe?: boolean; side?: 'left' | 'right'; onOwnSwipe?: () => void } = {}) {
    const onAway = vi.fn()
    render(
      <SwipeAwayRow label={opts.side === 'right' ? 'Mark unread' : 'Hide'} name="88 Quarry Rd Ste 100" swipe={opts.swipe ?? true} side={opts.side} onAway={onAway} sign={sign} onOwnSwipe={opts.onOwnSwipe}>
        {(press) => <div>88 Quarry Rd Ste 100{press}</div>}
      </SwipeAwayRow>,
    )
    return { onAway, slide: document.querySelector('[data-swipe-away-slide]') as HTMLElement | null }
  }
  const aSign = (may = true) => ({ mayPlay: vi.fn(() => may), played: vi.fn() })

  it('a row in full view, left alone for half a second, shows its strip and says it did', () => {
    const sign = aSign()
    const { onAway, slide } = signRow(sign)
    expect(document.querySelector('[data-swipe-away-sign]')).not.toBeNull()
    inView(1)
    pass(SWIPE_SIGN_STILL_MS - 1)
    expect(slide!.style.transform).toBe('translateX(0px)')
    expect(sign.played).not.toHaveBeenCalled()
    pass(1)
    expect(slide!.style.transform).toBe(`translateX(-${swipeShowReach('Hide')}px)`)
    expect(sign.played).toHaveBeenCalledTimes(1)
    expect(sign.played).toHaveBeenCalledWith(true)
    pass(SWIPE_SHOW_MS.out + SWIPE_SHOW_MS.hold + SWIPE_SHOW_MS.back)
    expect(slide!.style.transform).toBe('translateX(0px)')
    // The sign never does the act.
    expect(onAway).not.toHaveBeenCalled()
  })

  it('a put-away row shows the way back, to the right', () => {
    const sign = aSign()
    const { slide } = signRow(sign, { side: 'right' })
    inView(1)
    pass(SWIPE_SIGN_STILL_MS)
    expect(slide!.style.transform).toBe(`translateX(${swipeShowReach('Mark unread')}px)`)
  })

  it('a row only partly in view, or one that leaves before the half second, stays still', () => {
    const sign = aSign()
    const { slide } = signRow(sign)
    inView(0.6)
    pass(SWIPE_SIGN_STILL_MS * 2)
    expect(sign.mayPlay).not.toHaveBeenCalled()
    inView(1)
    pass(SWIPE_SIGN_STILL_MS - 100)
    inView(0)
    pass(SWIPE_SIGN_STILL_MS * 2)
    expect(sign.played).not.toHaveBeenCalled()
    expect(slide!.style.transform).toBe('translateX(0px)')
  })

  it('a finger on its way down holds the sign, and it waits the half second again after the finger lifts', () => {
    const sign = aSign()
    const { slide } = signRow(sign)
    inView(1)
    pass(SWIPE_SIGN_STILL_MS - 100)
    fireEvent(window, new window.MouseEvent('pointerdown', { bubbles: true }))
    pass(SWIPE_SIGN_STILL_MS * 3)
    expect(sign.played).not.toHaveBeenCalled()
    expect(slide!.style.transform).toBe('translateX(0px)')
    fireEvent(window, new window.MouseEvent('pointerup', { bubbles: true }))
    pass(SWIPE_SIGN_STILL_MS - 1)
    expect(sign.played).not.toHaveBeenCalled()
    pass(1)
    expect(sign.played).toHaveBeenCalledTimes(1)
  })

  it('a page that is still moving starts the wait over', () => {
    const sign = aSign()
    signRow(sign)
    inView(1)
    pass(SWIPE_SIGN_STILL_MS - 100)
    fireEvent.scroll(window)
    pass(SWIPE_SIGN_STILL_MS - 100)
    expect(sign.played).not.toHaveBeenCalled()
    pass(100)
    expect(sign.played).toHaveBeenCalledTimes(1)
  })

  it('a sign that may not play any more moves nothing and is not counted', () => {
    const sign = aSign(false)
    const { slide } = signRow(sign)
    inView(1)
    pass(SWIPE_SIGN_STILL_MS)
    expect(sign.mayPlay).toHaveBeenCalledTimes(1)
    expect(sign.played).not.toHaveBeenCalled()
    expect(slide!.style.transform).toBe('translateX(0px)')
  })

  it('a person who asked for less motion gets no slide, and the card is told so it can draw the words', () => {
    const real = window.matchMedia
    window.matchMedia = ((q: string) => ({ matches: q.includes('prefers-reduced-motion'), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
    try {
      const sign = aSign()
      const { slide } = signRow(sign)
      inView(1)
      pass(SWIPE_SIGN_STILL_MS)
      expect(slide!.style.transform).toBe('translateX(0px)')
      expect(sign.played).toHaveBeenCalledWith(false)
    } finally {
      window.matchMedia = real
    }
  })

  it('a row with no sign, and a row at a desk, watch nothing', () => {
    signRow(undefined)
    expect(seen.length).toBe(0)
    expect(document.querySelector('[data-swipe-away-sign]')).toBeNull()
    signRow(aSign(), { swipe: false })
    expect(seen.length).toBe(0)
  })

  it('a finger that does the act says so, and a press on the strip does not', () => {
    const onOwnSwipe = vi.fn()
    const { onAway, slide } = signRow(aSign(), { onOwnSwipe })
    fireEvent.click(screen.getByRole('button', { name: 'Hide, 88 Quarry Rd Ste 100' }))
    expect(onAway).toHaveBeenCalledTimes(1)
    expect(onOwnSwipe).not.toHaveBeenCalled()
    pointer(slide!, 'pointerdown', 300)
    pointer(slide!, 'pointermove', 280)
    pointer(slide!, 'pointermove', 300 - SWIPE_AWAY_SETTLE_AT)
    pointer(slide!, 'pointerup', 300 - SWIPE_AWAY_SETTLE_AT)
    expect(onAway).toHaveBeenCalledTimes(2)
    expect(onOwnSwipe).toHaveBeenCalledTimes(1)
  })

  it('the row stops watching when it leaves the page', () => {
    const sign = aSign()
    const { unmount } = render(
      <SwipeAwayRow label="Hide" name="Restroom Stalls" swipe onAway={() => {}} sign={sign}>
        {() => <div>Restroom Stalls</div>}
      </SwipeAwayRow>,
    )
    inView(1)
    unmount()
    pass(SWIPE_SIGN_STILL_MS * 2)
    expect(sign.played).not.toHaveBeenCalled()
    expect(seen.every((o) => o.gone)).toBe(true)
  })
})

describe('SwipeAwayRow at a desk', () => {
  it('draws the act as a word press and no strip', () => {
    const { onAway, slide, strip } = row(false)
    expect(slide).toBeNull()
    expect(strip).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Hide, 88 Quarry Rd Ste 100' }))
    expect(onAway).toHaveBeenCalledTimes(1)
  })
})
