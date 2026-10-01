// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { installModalBackdropGuard, isFullScreenFixedLayer } from './modalBackdropGuard'

// A window built the way the app builds them: a backdrop that closes on click, a panel that stops
// the click from reaching it, a text box and a drawing pad inside.
let backdrop: HTMLDivElement
let panel: HTMLDivElement
let box: HTMLInputElement
let pad: HTMLCanvasElement
let closes = 0
let uninstall: () => void = () => undefined

const press = (el: Element) => el.dispatchEvent(new Event('pointerdown', { bubbles: true }))
const release = (el: Element) => el.dispatchEvent(new Event('pointerup', { bubbles: true }))
/** The browser's click: on the common ancestor of the press and the release; detail 1 for a pointer, 0 for a key. */
const click = (el: Element, detail = 1) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail }))

beforeEach(() => {
  closes = 0
  document.body.innerHTML = ''
  backdrop = document.createElement('div')
  panel = document.createElement('div')
  box = document.createElement('input')
  pad = document.createElement('canvas')
  panel.append(box, pad)
  backdrop.append(panel)
  document.body.append(backdrop)
  backdrop.addEventListener('click', () => {
    closes++
  })
  panel.addEventListener('click', (e) => e.stopPropagation())
  uninstall = installModalBackdropGuard(document, { isBackdropLayer: (el) => el === backdrop })
})
afterEach(() => uninstall())

describe('installModalBackdropGuard', () => {
  it('a press in the text box let go on the backdrop does not close the window', () => {
    press(box)
    release(backdrop)
    click(backdrop)
    expect(closes).toBe(0)
  })

  it('a signature stroke that runs off the pad and ends on the backdrop does not close it', () => {
    press(pad)
    release(backdrop)
    click(backdrop)
    expect(closes).toBe(0)
  })

  it('a press on the backdrop let go inside the window does not close it either', () => {
    press(backdrop)
    release(box)
    click(backdrop)
    expect(closes).toBe(0)
  })

  it('a press and a release both on the backdrop closes it, as before', () => {
    press(backdrop)
    release(backdrop)
    click(backdrop)
    expect(closes).toBe(1)
  })

  it('keyboard and code clicks pass untouched', () => {
    click(backdrop, 0)
    expect(closes).toBe(1)
  })

  it('clicks inside the window are not its business', () => {
    let boxClicks = 0
    box.addEventListener('click', () => boxClicks++)
    press(box)
    release(box)
    click(box)
    expect(boxClicks).toBe(1)
    expect(closes).toBe(0)
  })

  it('a cancelled press (a scroll that took over) leaves nothing behind for the next click', () => {
    press(backdrop)
    document.dispatchEvent(new Event('pointercancel'))
    click(backdrop)
    expect(closes).toBe(0)
    press(backdrop)
    release(backdrop)
    click(backdrop)
    expect(closes).toBe(1)
  })

  it('a drag does not leave its press behind for the next real click', () => {
    press(box)
    release(backdrop)
    click(backdrop)
    press(backdrop)
    release(backdrop)
    click(backdrop)
    expect(closes).toBe(1)
  })

  it('removing the guard brings back the old behaviour', () => {
    uninstall()
    press(box)
    release(backdrop)
    click(backdrop)
    expect(closes).toBe(1)
  })
})

describe('isFullScreenFixedLayer', () => {
  const sized = (position: string, width: number, height: number) => {
    const el = document.createElement('div')
    el.style.position = position
    el.getBoundingClientRect = () => ({ width, height, x: 0, y: 0, top: 0, left: 0, right: width, bottom: height, toJSON: () => ({}) }) as DOMRect
    document.body.append(el)
    return el
  }
  const win = (w: number, h: number) => ({ innerWidth: w, innerHeight: h, getComputedStyle: window.getComputedStyle.bind(window) }) as unknown as Window

  it('a fixed layer covering the screen is a backdrop', () => {
    expect(isFullScreenFixedLayer(sized('fixed', 1440, 900), win(1440, 900))).toBe(true)
  })
  it('a backdrop that stops above the Job mode footer is one too, even on a phone', () => {
    expect(isFullScreenFixedLayer(sized('fixed', 1440, 836), win(1440, 900))).toBe(true)
    expect(isFullScreenFixedLayer(sized('fixed', 390, 746), win(390, 844))).toBe(true)
  })
  it('a side drawer is not', () => {
    expect(isFullScreenFixedLayer(sized('fixed', 420, 900), win(1440, 900))).toBe(false)
  })
  it('a fixed button is not, however it is pressed', () => {
    expect(isFullScreenFixedLayer(sized('fixed', 56, 56), win(1440, 900))).toBe(false)
  })
  it('a full-size layer that is not fixed is not', () => {
    expect(isFullScreenFixedLayer(sized('absolute', 1440, 900), win(1440, 900))).toBe(false)
  })
  it('with no viewport (a test, a hidden frame) nothing is', () => {
    expect(isFullScreenFixedLayer(sized('fixed', 0, 0), win(0, 0))).toBe(false)
  })
})
