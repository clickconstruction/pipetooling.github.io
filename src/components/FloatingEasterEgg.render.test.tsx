// @vitest-environment jsdom
/**
 * Render + state-machine smoke for the ring game (v2.3282): drives the visit's
 * requestAnimationFrame loop and pointer events by hand — enter → play → press
 * (caught, ring shown) → drag (arc drawn) → release (flight) → the shot ends
 * and the visit finishes. The physics rules themselves live in
 * easterEggRing.test.ts; this proves the component wires them.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { FloatingEasterEggVisit } from './FloatingEasterEgg'
import { EASTER_EGG_CATCH_DEFAULTS, EASTER_EGG_TUNING_DEFAULTS } from '../lib/easterEggsConfig'
import { EGG_MOTION } from '../lib/easterEggMotion'

let clock = 0
let queue: FrameRequestCallback[] = []

function frames(n: number, ms = 16.67) {
  for (let i = 0; i < n; i++) {
    clock += ms
    const q = queue
    queue = []
    for (const cb of q) cb(clock)
  }
}

function pointer(type: string, target: EventTarget, x: number, y: number) {
  const ev = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y }) as MouseEvent & { pointerId: number }
  Object.defineProperty(ev, 'pointerId', { value: 1 })
  target.dispatchEvent(ev)
}

function spriteCentre(img: HTMLImageElement) {
  const m = /translate3d\(([-\d.]+)px, ([-\d.]+)px/.exec(img.style.transform)
  return { x: Number(m![1]) + EGG_MOTION.SPRITE_W / 2, y: Number(m![2]) + EGG_MOTION.SPRITE_H / 2 }
}

describe('FloatingEasterEggVisit — catch, aim, shoot', () => {
  beforeEach(() => {
    clock = 0
    queue = []
    Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 720, configurable: true })
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      queue.push(cb)
      return queue.length
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
    vi.spyOn(performance, 'now').mockImplementation(() => clock)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('walks the whole state machine and ends the visit after the last shot', () => {
    const onDone = vi.fn()
    const { container } = render(
      <FloatingEasterEggVisit src="/easter-eggs/floaty.webp" tuning={{ ...EASTER_EGG_TUNING_DEFAULTS }} catchCfg={{ ...EASTER_EGG_CATCH_DEFAULTS, shots: 1 }} onDone={onDone} />,
    )
    const img = container.querySelector('img.easter-egg-sprite') as HTMLImageElement
    const ring = container.querySelector('svg.easter-egg-ring') as SVGSVGElement
    const dots = container.querySelector('g[fill]') as SVGGElement
    const caption = container.querySelector('div.easter-egg-layer') as HTMLDivElement
    expect(img).toBeTruthy()
    expect(ring.style.opacity).toBe('0')

    // Enter (0.9s) → play: he becomes catchable.
    act(() => frames(70))
    expect(img.style.pointerEvents).toBe('auto')
    expect(img.style.opacity).toBe('1')

    // Press on him: caught, ring appears.
    const c = spriteCentre(img)
    act(() => pointer('pointerdown', img, c.x, c.y))
    act(() => frames(2))
    expect(ring.style.opacity).toBe('1')
    expect(Number(ring.style.left.replace('px', ''))).toBeGreaterThanOrEqual(40)
    expect(caption.textContent).toMatch(/Caught him/)

    // Drag him back away from the ring: the arc appears.
    const ringCx = Number(ring.style.left.replace('px', '')) + Number(ring.getAttribute('width')) / 2
    const dir = ringCx > c.x ? 1 : -1
    act(() => pointer('pointermove', window, c.x - dir * 20, c.y + 10))
    act(() => pointer('pointermove', window, c.x - dir * 110, c.y + 60))
    act(() => frames(2))
    expect(dots.querySelectorAll('circle').length).toBeGreaterThan(5)

    // Release: flight. He is no longer catchable mid-air, the arc is gone.
    act(() => pointer('pointerup', window, c.x - dir * 110, c.y + 60))
    act(() => frames(1))
    expect(dots.querySelectorAll('circle').length).toBe(0)
    expect(img.style.pointerEvents).toBe('none')
    const start = spriteCentre(img)
    act(() => frames(10))
    const later = spriteCentre(img)
    expect((later.x - start.x) * dir).toBeGreaterThan(50) // flying toward the ring

    // The single shot resolves either way — swish or off-screen — and the visit ends.
    act(() => frames(400))
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(ring.style.opacity).toBe('0')
  })

  it('a plain click only holds him; he wriggles free after holdSec and the ring goes', () => {
    const onDone = vi.fn()
    const { container } = render(
      <FloatingEasterEggVisit src="/easter-eggs/floaty.webp" tuning={{ ...EASTER_EGG_TUNING_DEFAULTS }} catchCfg={{ ...EASTER_EGG_CATCH_DEFAULTS, holdSec: 5 }} onDone={onDone} />,
    )
    const img = container.querySelector('img.easter-egg-sprite') as HTMLImageElement
    const ring = container.querySelector('svg.easter-egg-ring') as SVGSVGElement
    act(() => frames(70))
    const c = spriteCentre(img)
    act(() => pointer('pointerdown', img, c.x, c.y))
    act(() => pointer('pointerup', window, c.x + 2, c.y + 1))
    act(() => frames(2))
    expect(ring.style.opacity).toBe('1')
    const held = spriteCentre(img)
    act(() => frames(60)) // one second: still held, roughly where he was
    expect(Math.abs(spriteCentre(img).x - held.x)).toBeLessThan(6)
    expect(ring.style.opacity).toBe('1')
    act(() => frames(60 * 5)) // past holdSec: free again, ring gone, visit resumes
    expect(ring.style.opacity).toBe('0')
    expect(onDone).not.toHaveBeenCalled()
  })

  it('with catch off he is never catchable', () => {
    const { container } = render(
      <FloatingEasterEggVisit src="/easter-eggs/floaty.webp" tuning={{ ...EASTER_EGG_TUNING_DEFAULTS }} catchCfg={{ ...EASTER_EGG_CATCH_DEFAULTS, enabled: false }} onDone={() => {}} />,
    )
    const img = container.querySelector('img.easter-egg-sprite') as HTMLImageElement
    const ring = container.querySelector('svg.easter-egg-ring') as SVGSVGElement
    act(() => frames(70))
    expect(img.style.pointerEvents).toBe('none')
    const c = spriteCentre(img)
    act(() => pointer('pointerdown', img, c.x, c.y))
    act(() => frames(2))
    expect(ring.style.opacity).toBe('0')
  })
})
