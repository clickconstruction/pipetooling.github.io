// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LAND_ON_HOLD_MS } from '../../lib/landOn'
import { landOnLienGate } from './useLienGateLanding'

/**
 * The page side of a row press that lands on its open gate (punch list #364). jsdom lays nothing out, so each
 * measure is stood in: the pane's window, where it is scrolled, and where the gates sit inside it.
 */
function pane(o: { viewHeight: number; scrollTop?: number; bodyTop: number; rowTop: number; disabled?: boolean }) {
  document.body.innerHTML = `<div id="pane"><div data-lien-pane-body="gates"><button data-lien-gate-row="owner">Owner</button><button data-lien-gate-row="legal" ${o.disabled ? 'disabled' : ''}>Legal</button></div></div>`
  const host = document.getElementById('pane')!
  const body = host.querySelector<HTMLElement>('[data-lien-pane-body]')!
  const row = host.querySelector<HTMLButtonElement>('[data-lien-gate-row="legal"]')!
  const box = (top: number, height: number) => ({ top, height }) as DOMRect
  host.getBoundingClientRect = () => box(100, o.viewHeight)
  // The page reads a place on the screen; inside the pane it sits `scrollTop` further down.
  body.getBoundingClientRect = () => box(100 + o.bodyTop - (o.scrollTop ?? 0), 200)
  row.getBoundingClientRect = () => box(100 + o.rowTop - (o.scrollTop ?? 0), 24)
  Object.defineProperty(host, 'clientHeight', { value: o.viewHeight })
  host.scrollTop = o.scrollTop ?? 0
  const scroll = vi.fn()
  host.scrollTo = scroll as never
  return { host, row, scroll }
}

describe('landing on a gate row inside the affidavit pane', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('glides the pane to the gates section, puts the keyboard on the row and lights it', () => {
    const { host, row, scroll } = pane({ viewHeight: 400, bodyTop: 600, rowTop: 640 })
    landOnLienGate(host, { key: 'legal', focus: true }, { index: 1, count: 5, phone: false, reducedMotion: false })
    expect(scroll).toHaveBeenCalledWith({ top: 600 - 48, behavior: 'smooth' })
    expect(document.activeElement).toBe(row)
    expect(row.getAttribute('data-landed')).toBe('yes')
  })

  it('under reduced motion jumps with no glide, and the light stands for the hold alone', () => {
    const { host, row, scroll } = pane({ viewHeight: 400, bodyTop: 600, rowTop: 640 })
    landOnLienGate(host, { key: 'legal', focus: true }, { index: 1, count: 5, phone: false, reducedMotion: true })
    expect(scroll).toHaveBeenCalledWith({ top: 600 - 48, behavior: 'auto' })
    vi.advanceTimersByTime(LAND_ON_HOLD_MS)
    expect(row.hasAttribute('data-landed')).toBe(false)
  })

  it('on a phone lands the section under the one pinned head', () => {
    const { host, scroll } = pane({ viewHeight: 420, bodyTop: 520, rowTop: 580 })
    landOnLienGate(host, { key: 'legal', focus: true }, { index: 1, count: 5, phone: true, reducedMotion: false })
    const [to] = scroll.mock.calls[0] as [{ top: number; behavior: string }]
    // The phone's head is one thumb tall, whatever the section's place in the pane.
    expect(520 - to.top).toBeGreaterThanOrEqual(40)
    expect(580 - to.top).toBeLessThan(420)
  })

  it('leaves a pane alone whose gate is already on the screen, and still lights the row', () => {
    const { host, row, scroll } = pane({ viewHeight: 600, bodyTop: 200, rowTop: 240 })
    landOnLienGate(host, { key: 'legal', focus: true }, { index: 1, count: 5, phone: false, reducedMotion: false })
    expect(scroll).not.toHaveBeenCalled()
    expect(row.getAttribute('data-landed')).toBe('yes')
  })

  it('reads where the pane is scrolled: a pane past its gates comes back to them', () => {
    const { host, scroll } = pane({ viewHeight: 400, scrollTop: 1500, bodyTop: 600, rowTop: 640 })
    landOnLienGate(host, { key: 'legal', focus: true }, { index: 1, count: 5, phone: false, reducedMotion: false })
    expect(scroll).toHaveBeenCalledWith({ top: 600 - 48, behavior: 'smooth' })
  })

  it('brings a row with no door into view and leaves the keyboard where it was', () => {
    const { host, row, scroll } = pane({ viewHeight: 400, bodyTop: 600, rowTop: 640, disabled: true })
    landOnLienGate(host, { key: 'legal', focus: false }, { index: 1, count: 5, phone: false, reducedMotion: false })
    expect(scroll).toHaveBeenCalledTimes(1)
    expect(document.activeElement).not.toBe(row)
    expect(row.getAttribute('data-landed')).toBe('yes')
  })

  it('answers nothing for a gate the pane does not draw', () => {
    const { host, scroll } = pane({ viewHeight: 400, bodyTop: 600, rowTop: 640 })
    expect(landOnLienGate(host, { key: 'homestead', focus: true }, { index: 1, count: 5, phone: false, reducedMotion: false })).toBeNull()
    expect(scroll).not.toHaveBeenCalled()
  })

  it('the undo takes the light off early', () => {
    const { host, row } = pane({ viewHeight: 600, bodyTop: 200, rowTop: 240 })
    const undo = landOnLienGate(host, { key: 'legal', focus: true }, { index: 1, count: 5, phone: false, reducedMotion: false })
    undo?.()
    expect(row.hasAttribute('data-landed')).toBe(false)
  })
})
