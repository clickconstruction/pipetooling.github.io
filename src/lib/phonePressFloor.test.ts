import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PHONE_PRESS_FLOOR_MAX_WIDTH_PX, PHONE_PRESS_FLOOR_PX, PHONE_PRESS_FLOOR_VAR, phoneGiveBack, phoneTall } from './phonePressFloor'

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')

/** What a browser makes of the two values, for a screen where the floor is `floor` px (0: a desk, where it is unset). */
const tall = (desk: number, floor: number) => Math.max(desk, floor)
const giveBack = (desk: number, floor: number) => Math.min(0, (desk - floor) / 2)

describe('phonePressFloor', () => {
  it('writes a min-height that is the desk size at a desk and a fingertip on a phone', () => {
    expect(phoneTall(32)).toBe('max(32px, var(--phone-press-min, 0px))')
    expect(tall(32, 0)).toBe(32)
    expect(tall(32, PHONE_PRESS_FLOOR_PX)).toBe(44)
    // A press taller than a fingertip keeps its size on a phone.
    expect(tall(56, PHONE_PRESS_FLOOR_PX)).toBe(56)
  })

  it('writes a margin that is nothing at a desk and gives a line back what the press grew by on a phone', () => {
    expect(phoneGiveBack(28)).toBe('min(0px, calc((28px - var(--phone-press-min, 0px)) / 2))')
    expect(giveBack(28, 0)).toBe(0)
    expect(giveBack(28, PHONE_PRESS_FLOOR_PX)).toBe(-8)
    // The press with its two margins stands as tall in its line as it was drawn.
    for (const desk of [18, 20, 28]) expect(tall(desk, 44) + 2 * giveBack(desk, 44)).toBe(desk)
    expect(giveBack(56, PHONE_PRESS_FLOOR_PX)).toBe(0)
  })

  it('has the stylesheet set the floor to 44 px at phone width and nowhere else', () => {
    expect(PHONE_PRESS_FLOOR_VAR).toBe('--phone-press-min')
    const rule = `@media (max-width: ${PHONE_PRESS_FLOOR_MAX_WIDTH_PX}px) { :root { ${PHONE_PRESS_FLOOR_VAR}: ${PHONE_PRESS_FLOOR_PX}px; } }`
    expect(css).toContain(rule)
    expect(css.split(`${PHONE_PRESS_FLOOR_VAR}:`)).toHaveLength(2)
  })
})
