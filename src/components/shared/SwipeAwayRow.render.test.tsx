// @vitest-environment jsdom
/**
 * The swipe that puts a row away (punch list #426): a touch that moves left past the mark calls
 * the act, a shorter one springs back, a touch that moves down is a scroll, and a desk gets the
 * same act as a word press.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SwipeAwayRow } from './SwipeAwayRow'
import { SWIPE_AWAY_SETTLE_AT } from '../../lib/swipeAway'

const pointer = (el: Element, type: string, x: number, y = 10) => fireEvent(el, new window.MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 }))

function row(swipe: boolean) {
  const onAway = vi.fn()
  const onOpen = vi.fn()
  render(
    <SwipeAwayRow label="Hide" name="88 Quarry Rd Ste 100" swipe={swipe} onAway={onAway} radius={8}>
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

  it('a swipe to the right does nothing', () => {
    const { onAway, slide } = row(true)
    pointer(slide!, 'pointerdown', 100)
    pointer(slide!, 'pointermove', 130)
    pointer(slide!, 'pointermove', 300)
    expect(slide!.style.transform).toBe('translateX(0px)')
    pointer(slide!, 'pointerup', 300)
    expect(onAway).not.toHaveBeenCalled()
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

describe('SwipeAwayRow at a desk', () => {
  it('draws the act as a word press and no strip', () => {
    const { onAway, slide, strip } = row(false)
    expect(slide).toBeNull()
    expect(strip).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Hide, 88 Quarry Rd Ste 100' }))
    expect(onAway).toHaveBeenCalledTimes(1)
  })
})
