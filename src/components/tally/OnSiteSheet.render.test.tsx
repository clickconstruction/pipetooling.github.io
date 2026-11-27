// @vitest-environment jsdom
/**
 * The On site tab's sheet (punch list #209): its × is 48 by 48, the bar a box's screen holds every press to
 * (punch list #398). The phone walk of 2026-11-21 read it at 39 by 38 on a box's More sheet. A layout is a browser's
 * to measure, so this holds the sizes the measure rests on, and the margins that keep the title row where it was.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SHEET_CLOSE_STYLE, SHEET_TOUCH_MIN, Sheet } from './OnSiteSheet'

afterEach(cleanup)

describe('the On site sheet’s ×', () => {
  it('is 48 by 48 and closes the sheet', () => {
    const onClose = vi.fn()
    render(
      <Sheet title="More for G12" onClose={onClose}>
        <p>Edit G12</p>
      </Sheet>,
    )
    const x = screen.getByRole('button', { name: 'Close' })
    expect(SHEET_TOUCH_MIN).toBe(48)
    expect([x.style.minHeight, x.style.minWidth]).toEqual(['48px', '48px'])
    fireEvent.click(x)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('gives the title row back what it grew by, so the row and the × stay where they were', () => {
    // 38 px drawn: 5 comes back over it and 5 under it. 39 px wide: 4.5 comes back at the right, where it grew past its old edge.
    expect([SHEET_CLOSE_STYLE.marginTop, SHEET_CLOSE_STYLE.marginBottom, SHEET_CLOSE_STYLE.marginRight]).toEqual([-5, -5, -4.5])
    expect(Number(SHEET_CLOSE_STYLE.minHeight) + Number(SHEET_CLOSE_STYLE.marginTop) + Number(SHEET_CLOSE_STYLE.marginBottom)).toBe(38)
    expect(SHEET_CLOSE_STYLE.marginLeft).toBe('auto')
  })
})

describe('the On site sheet and the keyboard (punch list #398)', () => {
  const setPhone = (phone: boolean) => {
    window.matchMedia = ((query: string) => ({ matches: phone && query.includes('max-width'), media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia
  }
  const setShows = (box: { height: number; offsetTop: number } | null) => {
    if (box) Object.defineProperty(window, 'visualViewport', { value: { ...box, addEventListener: () => {}, removeEventListener: () => {} }, configurable: true })
    else delete (window as unknown as { visualViewport?: unknown }).visualViewport
  }
  afterEach(() => {
    setShows(null)
    delete (window as unknown as { matchMedia?: unknown }).matchMedia
  })
  const scrim = () => document.querySelector('[data-on-site-sheet]') as HTMLElement

  it('on a phone with the number pad up, the scrim is the part of the page above the keys', () => {
    setPhone(true)
    setShows({ height: 498, offsetTop: 0 })
    render(
      <Sheet title="Add a part to ZZ4" onClose={() => {}} footer={<button type="button">Add 1 and another part</button>}>
        <p>How many?</p>
      </Sheet>,
    )
    expect(scrim().getAttribute('data-on-site-sheet')).toBe('band')
    expect(scrim().style.height).toBe('498px')
    expect(scrim().style.bottom).toBe('')
    expect(scrim().style.justifyContent).toBe('flex-end')
    // The sheet is held inside that band, so its foot and the footer's presses end at the top of the keys.
    expect((screen.getByRole('dialog', { name: 'Add a part to ZZ4' }) as HTMLElement).style.maxHeight).toBe('90%')
    expect(screen.getByRole('button', { name: 'Add 1 and another part' })).toBeTruthy()
  })

  it('at a desk, and on a phone that cannot say what shows, the scrim keeps the page box', () => {
    setPhone(false)
    setShows({ height: 498, offsetTop: 0 })
    const desk = render(<Sheet title="More for G12" onClose={() => {}}><p>Edit G12</p></Sheet>)
    expect(scrim().getAttribute('data-on-site-sheet')).toBe('page')
    expect(scrim().style.height).toBe('')
    desk.unmount()
    setPhone(true)
    setShows(null)
    render(<Sheet title="More for G12" onClose={() => {}}><p>Edit G12</p></Sheet>)
    expect(scrim().getAttribute('data-on-site-sheet')).toBe('page')
  })

  it('in the short room a small phone’s number pad leaves, the sheet takes the whole room and drops its handle (finding 310)', () => {
    setPhone(true)
    setShows({ height: 320, offsetTop: 0 })
    render(
      <Sheet title="Add a part to ZZ4" onClose={() => {}} footer={<button type="button">Add 1 to ZZ4</button>}>
        <p>How many?</p>
      </Sheet>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Add a part to ZZ4' }) as HTMLElement
    expect(dialog.style.maxHeight).toBe('100%')
    expect(document.querySelector('[data-on-site-sheet-handle]')).toBeNull()
    const [, body, foot] = Array.from(dialog.children) as HTMLElement[]
    expect([body!.style.padding, body!.style.gap]).toEqual(['0.4rem 1rem 0.75rem', '0.5rem'])
    expect(foot!.style.padding).toContain('0.4rem 1rem')
  })

  it('with the keys away the sheet is as it was: 90% of the room, its handle and its padding', () => {
    setPhone(true)
    setShows({ height: 553, offsetTop: 0 })
    render(
      <Sheet title="Add a part to ZZ4" onClose={() => {}} footer={<button type="button">Add 1 to ZZ4</button>}>
        <p>How many?</p>
      </Sheet>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Add a part to ZZ4' }) as HTMLElement
    expect(dialog.style.maxHeight).toBe('90%')
    expect(document.querySelector('[data-on-site-sheet-handle]')).toBeTruthy()
    const [, body] = Array.from(dialog.children) as HTMLElement[]
    expect([body!.style.padding, body!.style.gap]).toEqual(['0.6rem 1rem 1rem', '0.75rem'])
  })

  it('where the sheet follows the room its surface runs on under its foot, and a press there closes nothing', () => {
    setPhone(true)
    setShows({ height: 320, offsetTop: 0 })
    const onClose = vi.fn()
    const phone = render(<Sheet title="Add a part to ZZ4" onClose={onClose}><p>How many?</p></Sheet>)
    const tail = document.querySelector('[data-on-site-sheet-tail]') as HTMLElement
    expect(tail.parentElement).toBe(scrim())
    expect([tail.style.top, tail.style.background, tail.getAttribute('aria-hidden')]).toEqual(['100%', 'var(--surface)', 'true'])
    fireEvent.click(tail)
    expect(onClose).not.toHaveBeenCalled()
    phone.unmount()
    setPhone(false)
    render(<Sheet title="More for G12" onClose={() => {}}><p>Edit G12</p></Sheet>)
    expect(document.querySelector('[data-on-site-sheet-tail]')).toBeNull()
  })
})
