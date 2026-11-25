// @vitest-environment jsdom
/**
 * The swipe that puts a row away (punch list #426): a touch that moves left past the mark calls
 * the act, a shorter one springs back, a touch that moves down is a scroll, and a desk gets the
 * same act as a word press. Since v2.8603 a row may go right, the way back, and a swipe the wrong
 * way is answered by the row showing its strip.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { SwipeAwayRow } from './SwipeAwayRow'
import { SWIPE_AWAY_SETTLE_AT, SWIPE_BACK_EDGE_GUARD, SWIPE_SHOW_MS, swipeShowReach } from '../../lib/swipeAway'

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

describe('SwipeAwayRow at a desk', () => {
  it('draws the act as a word press and no strip', () => {
    const { onAway, slide, strip } = row(false)
    expect(slide).toBeNull()
    expect(strip).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Hide, 88 Quarry Rd Ste 100' }))
    expect(onAway).toHaveBeenCalledTimes(1)
  })
})
