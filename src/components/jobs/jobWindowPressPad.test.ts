// @vitest-environment jsdom
/**
 * The hit-area pad on the phone's job window (punch list #355, v2.7309): a small press is marked with its pad, a
 * thumb-sized one is not, the strip, the head, a press with a press inside and a clipped press are left alone,
 * and a mark comes off once the press has grown.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { padSmallPresses, watchSmallPresses } from './jobWindowPressPad'

function sized(el: HTMLElement, width: number, height: number): HTMLElement {
  el.getBoundingClientRect = () => ({ width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
  return el
}

function press(root: HTMLElement, width: number, height: number, html = 'Open'): HTMLButtonElement {
  const b = document.createElement('button')
  b.innerHTML = html
  // A press with no border, unless a case gives it one: the test page's own button comes with 2 px (finding 340).
  b.style.borderWidth = '0'
  root.appendChild(b)
  sized(b, width, height)
  return b
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('padSmallPresses', () => {
  it('marks a small press with its pad and leaves a thumb-sized one bare', () => {
    const root = document.body.appendChild(document.createElement('div'))
    const words = press(root, 86, 20)
    const square = press(root, 23, 23)
    const big = press(root, 300, 44)
    expect(padSmallPresses(root)).toBe(2)
    expect(words.getAttribute('data-press-pad')).toBe('')
    expect(words.style.getPropertyValue('--press-pad-x')).toBe('0px')
    expect(words.style.getPropertyValue('--press-pad-y')).toBe('12px')
    expect(square.style.getPropertyValue('--press-pad-x')).toBe('11px')
    expect(square.style.getPropertyValue('--press-pad-y')).toBe('11px')
    expect(big.hasAttribute('data-press-pad')).toBe(false)
  })

  it('a press with a border reaches 44: the border is added to the pad, which is drawn from inside it (finding 340)', () => {
    const root = document.body.appendChild(document.createElement('div'))
    const bordered = press(root, 120, 28)
    bordered.style.borderWidth = '1px'
    const thick = press(root, 30, 30)
    thick.style.borderWidth = '1px 2px 3px 2px'
    const bare = press(root, 120, 28)
    expect(padSmallPresses(root)).toBe(3)
    // 28 px wants 8 px over and under. Drawn from inside a 1 px border, that is 9: 28 less its two borders, and 9 twice, is 44.
    expect(bordered.style.getPropertyValue('--press-pad-y')).toBe('9px')
    expect(bordered.style.getPropertyValue('--press-pad-x')).toBe('0px')
    expect(28 - 2 + 2 * 9).toBe(44)
    // Borders that differ take the wider one on each axis, so a tap is never under 44.
    expect(thick.style.getPropertyValue('--press-pad-x')).toBe('9px')
    expect(thick.style.getPropertyValue('--press-pad-y')).toBe('10px')
    // No border: as before.
    expect(bare.style.getPropertyValue('--press-pad-y')).toBe('8px')
  })

  it('leaves the strip, the head, a press with a press inside, a clipped press and one not drawn alone', () => {
    const root = document.body.appendChild(document.createElement('div'))
    const strip = root.appendChild(document.createElement('div'))
    strip.setAttribute('role', 'tablist')
    const tab = press(strip, 50, 20)
    const head = root.appendChild(document.createElement('div'))
    head.setAttribute('data-testid', 'job-window-head')
    const pin = press(head, 30, 30)
    const nest = press(root, 200, 20, '<a href="#x">inner</a>')
    const clipped = press(root, 60, 20)
    clipped.style.overflow = 'hidden'
    const hidden = press(root, 0, 0)
    const plain = press(root, 60, 20)
    expect(padSmallPresses(root)).toBe(1)
    for (const el of [tab, pin, nest, clipped, hidden]) expect(el.hasAttribute('data-press-pad')).toBe(false)
    expect(plain.hasAttribute('data-press-pad')).toBe(true)
  })

  it('takes the mark off a press that has grown', () => {
    const root = document.body.appendChild(document.createElement('div'))
    const b = press(root, 60, 20)
    padSmallPresses(root)
    expect(b.hasAttribute('data-press-pad')).toBe(true)
    sized(b, 60, 44)
    expect(padSmallPresses(root)).toBe(0)
    expect(b.hasAttribute('data-press-pad')).toBe(false)
    expect(b.style.getPropertyValue('--press-pad-y')).toBe('')
  })
})

describe('watchSmallPresses', () => {
  it('pads now and again after a press is added, and stops when told', async () => {
    const root = document.body.appendChild(document.createElement('div'))
    const first = press(root, 60, 20)
    const stop = watchSmallPresses(root)
    await new Promise((r) => setTimeout(r, 120))
    expect(first.hasAttribute('data-press-pad')).toBe(true)
    const second = press(root, 60, 20)
    await new Promise((r) => setTimeout(r, 120))
    expect(second.hasAttribute('data-press-pad')).toBe(true)
    stop()
    const third = press(root, 60, 20)
    await new Promise((r) => setTimeout(r, 120))
    expect(third.hasAttribute('data-press-pad')).toBe(false)
  })
})
