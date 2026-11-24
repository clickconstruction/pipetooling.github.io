// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LAND_ON_HOLD_MS } from '../../lib/landOn'
import { LIEN_GATE_QUIET_FOCUS, landOnLienGate } from './useLienGateLanding'

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

  // v2.8509: Safari drew the keyboard's ring on a gate a tap had landed on, and it stayed after the light had gone.
  it('after a tap or a mouse press the row takes the keyboard quietly, until it loses the keyboard', () => {
    const { host, row } = pane({ viewHeight: 600, bodyTop: 200, rowTop: 240 })
    landOnLienGate(host, { key: 'legal', focus: true }, { index: 1, count: 5, phone: true, reducedMotion: false, quietFocus: true })
    expect(document.activeElement).toBe(row)
    expect(row.getAttribute(LIEN_GATE_QUIET_FOCUS)).toBe('yes')
    // The light going off leaves the row quiet: the ring must not come up in its place.
    vi.advanceTimersByTime(LAND_ON_HOLD_MS + 1000)
    expect(row.hasAttribute('data-landed')).toBe(false)
    expect(row.getAttribute(LIEN_GATE_QUIET_FOCUS)).toBe('yes')
    row.blur()
    expect(row.hasAttribute(LIEN_GATE_QUIET_FOCUS)).toBe(false)
  })

  it('a key pressed on a quietly focused row brings the ring back', () => {
    const { host, row } = pane({ viewHeight: 600, bodyTop: 200, rowTop: 240 })
    landOnLienGate(host, { key: 'legal', focus: true }, { index: 1, count: 5, phone: false, reducedMotion: false, quietFocus: true })
    row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    expect(row.hasAttribute(LIEN_GATE_QUIET_FOCUS)).toBe(false)
    expect(document.activeElement).toBe(row)
  })

  it('a press the keyboard made keeps the ring, and a row with no door is never marked', () => {
    const keys = pane({ viewHeight: 600, bodyTop: 200, rowTop: 240 })
    landOnLienGate(keys.host, { key: 'legal', focus: true }, { index: 1, count: 5, phone: false, reducedMotion: false })
    expect(document.activeElement).toBe(keys.row)
    expect(keys.row.hasAttribute(LIEN_GATE_QUIET_FOCUS)).toBe(false)
    const shut = pane({ viewHeight: 600, bodyTop: 200, rowTop: 240, disabled: true })
    landOnLienGate(shut.host, { key: 'legal', focus: false }, { index: 1, count: 5, phone: false, reducedMotion: false, quietFocus: true })
    expect(shut.row.hasAttribute(LIEN_GATE_QUIET_FOCUS)).toBe(false)
  })

  // v2.8509: in Safari under reduced motion the pane jumped, the job's path then grew 38 px, and the pane stayed short.
  it('follows a pane it has moved while it settles, and leaves alone one it never moved', () => {
    let settle: (() => void) | null = null
    vi.stubGlobal('ResizeObserver', class { constructor(cb: () => void) { settle = cb } observe() {} disconnect() { settle = null } })
    try {
      const o = { viewHeight: 400, scrollTop: 0, bodyTop: 600, rowTop: 640 }
      const { host, scroll } = pane(o)
      landOnLienGate(host, { key: 'legal', focus: true }, { index: 1, count: 5, phone: false, reducedMotion: true })
      expect(scroll).toHaveBeenLastCalledWith({ top: 552, behavior: 'auto' })
      // The pane is where the jump put it, the row on the screen. The path over the gates grows 38 px.
      o.scrollTop = 552
      host.scrollTop = 552
      o.bodyTop = 638
      o.rowTop = 678
      settle!()
      expect(scroll).toHaveBeenCalledTimes(2)
      expect(scroll).toHaveBeenLastCalledWith({ top: 590, behavior: 'auto' })
      // The same size again asks for nothing.
      o.scrollTop = 590
      host.scrollTop = 590
      settle!()
      expect(scroll).toHaveBeenCalledTimes(2)
      // After the hold the pane is the reader's again.
      vi.advanceTimersByTime(LAND_ON_HOLD_MS)
      expect(settle).toBeNull()

      // A pane whose gate was on the screen at the press is never moved, however its sections settle.
      const still = { viewHeight: 600, scrollTop: 0, bodyTop: 200, rowTop: 240 }
      const quiet = pane(still)
      landOnLienGate(quiet.host, { key: 'legal', focus: true }, { index: 1, count: 5, phone: false, reducedMotion: true })
      still.bodyTop = 238
      still.rowTop = 278
      settle!()
      expect(quiet.scroll).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('the undo takes the quiet mark off with the light', () => {
    const { host, row } = pane({ viewHeight: 600, bodyTop: 200, rowTop: 240 })
    const undo = landOnLienGate(host, { key: 'legal', focus: true }, { index: 1, count: 5, phone: false, reducedMotion: false, quietFocus: true })
    undo?.()
    expect(row.hasAttribute(LIEN_GATE_QUIET_FOCUS)).toBe(false)
  })
})
