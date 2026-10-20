// @vitest-environment jsdom
/**
 * PhoneSheet (Messages cut 10, P2): a centred window at a desk, a sheet from the bottom on a phone that keeps above the
 * software keyboard. The lead's case: a window opened inside the sheet still opens and closes with the keyboard up, and
 * each press closes only the window on top. A stand-in thread behind them closes on its own backdrop and on an Escape
 * nobody handled, as `ThreadWindow` does.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { resetModalStackForTests } from '../lib/modalStack'
import { PhoneSheet, PHONE_SHEET_QUERY } from './PhoneSheet'

const realMatchMedia = window.matchMedia
const realViewport = Object.getOwnPropertyDescriptor(window, 'visualViewport')

function screenIs(phone: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: phone && query === PHONE_SHEET_QUERY,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
}

/** The visual viewport: the room the keyboard leaves. `set` moves the keyboard and says so, as the browser does. */
function viewport(height: number) {
  const heard = new Set<() => void>()
  const vv = {
    height,
    addEventListener: (_type: string, f: () => void) => heard.add(f),
    removeEventListener: (_type: string, f: () => void) => heard.delete(f),
  }
  Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true })
  return {
    set(next: number) {
      vv.height = next
      act(() => heard.forEach((f) => f()))
    },
  }
}

/** A thread behind the sheets: its backdrop and an unhandled Escape close it. */
function Thread({ onClose }: { onClose: () => void }) {
  const [outer, setOuter] = useState(true)
  const [inner, setInner] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div data-thread-backdrop onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}>
        {outer ? (
          <PhoneSheet label="Who is this? (210) 555-0112" title="Who is this? (210) 555-0112" onClose={() => setOuter(false)}>
            <div>
              <input aria-label="Their name" />
              <button type="button" onClick={() => setInner(true)}>
                Pick a job
              </button>
              {inner && (
                <PhoneSheet label="Tie this line to a job" title="Tie this line to a job" onClose={() => setInner(false)}>
                  <div>
                    <button type="button">B482 Boerne Retail Shell</button>
                  </div>
                </PhoneSheet>
              )}
            </div>
          </PhoneSheet>
        ) : (
          <p>The sheet is closed.</p>
        )}
      </div>
    </div>
  )
}

const sheets = () => [...document.querySelectorAll<HTMLElement>('[data-phone-sheet]')]
const escape = () => fireEvent.keyDown(document, { key: 'Escape' })

beforeEach(() => {
  resetModalStackForTests()
  screenIs(true)
})
afterEach(() => {
  cleanup()
  window.matchMedia = realMatchMedia
  if (realViewport) Object.defineProperty(window, 'visualViewport', realViewport)
  else Reflect.deleteProperty(window, 'visualViewport')
})

describe('PhoneSheet on a phone', () => {
  it('rises from the bottom at full width with a grab bar, as tall as the room the keyboard leaves', () => {
    viewport(420)
    render(<Thread onClose={vi.fn()} />)
    const [sheet] = sheets()
    expect(sheet?.getAttribute('data-phone-sheet')).toBe('sheet')
    expect([sheet?.style.height, sheet?.style.justifyContent, sheet?.style.top]).toEqual(['420px', 'flex-end', '0px'])
    const panel = screen.getByRole('dialog', { name: 'Who is this? (210) 555-0112' })
    expect([panel.style.width, panel.style.maxHeight, panel.style.borderRadius]).toEqual(['100%', '85%', '14px 14px 0 0'])
    expect(panel.firstElementChild?.getAttribute('aria-hidden')).toBe('true')
  })

  it('opens a window inside the sheet with the keyboard up, keeps both above it as it moves, and closes only the top one', () => {
    const keyboard = viewport(420)
    const threadClosed = vi.fn()
    render(<Thread onClose={threadClosed} />)
    fireEvent.focus(screen.getByLabelText('Their name'))
    fireEvent.click(screen.getByRole('button', { name: 'Pick a job' }))
    expect(screen.getByRole('dialog', { name: 'Tie this line to a job' })).toBeTruthy()
    expect(sheets().map((s) => s.style.height)).toEqual(['420px', '420px'])

    keyboard.set(812)
    expect(sheets().map((s) => s.style.height)).toEqual(['812px', '812px'])
    keyboard.set(420)
    expect(sheets().map((s) => s.style.height)).toEqual(['420px', '420px'])

    escape()
    expect(screen.queryByRole('dialog', { name: 'Tie this line to a job' })).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Who is this? (210) 555-0112' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Pick a job' }))
    fireEvent.click(sheets()[1] as HTMLElement)
    expect(screen.queryByRole('dialog', { name: 'Tie this line to a job' })).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Who is this? (210) 555-0112' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Pick a job' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[1] as HTMLElement)
    expect(screen.queryByRole('dialog', { name: 'Tie this line to a job' })).toBeNull()
    expect(threadClosed).not.toHaveBeenCalled()

    escape()
    expect(screen.getByText('The sheet is closed.')).toBeTruthy()
    expect(threadClosed).not.toHaveBeenCalled()
    escape()
    expect(threadClosed).toHaveBeenCalledTimes(1)
  })

  it('a press inside the sheet closes nothing', () => {
    viewport(420)
    const threadClosed = vi.fn()
    render(<Thread onClose={threadClosed} />)
    fireEvent.click(screen.getByLabelText('Their name'))
    expect(sheets()).toHaveLength(1)
    expect(threadClosed).not.toHaveBeenCalled()
  })

  it('fills the screen where the browser cannot say where the keyboard is', () => {
    Reflect.deleteProperty(window, 'visualViewport')
    render(<Thread onClose={vi.fn()} />)
    expect(sheets()[0]?.style.height).toBe('100%')
  })
})

describe('PhoneSheet at a desk', () => {
  it('is the centred window the thread’s windows drew: its width, its title row with ×, no grab bar', () => {
    screenIs(false)
    viewport(800)
    const closed = vi.fn()
    render(
      <PhoneSheet label="Tie this line to a job" title="Tie this line to a job" width={480} maxHeight="80vh" dataAttrs={{ 'data-job-picker': '' }} onClose={closed}>
        <div>their jobs</div>
      </PhoneSheet>,
    )
    const [frame] = sheets()
    expect([frame?.getAttribute('data-phone-sheet'), frame?.style.alignItems, frame?.style.inset]).toEqual(['window', 'center', '0'])
    const panel = screen.getByRole('dialog', { name: 'Tie this line to a job' })
    expect([panel.style.width, panel.style.maxHeight, panel.hasAttribute('data-job-picker')]).toEqual(['min(480px, 100%)', 'min(80vh, 100%)', true])
    expect(panel.firstElementChild?.getAttribute('aria-hidden')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(closed).toHaveBeenCalledTimes(1)
  })
})
