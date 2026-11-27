/**
 * The app-health strip's pill on a phone (finding 312, a simulator's read of 2026-11-27: the red banner's own
 * **Retry** stood 22 to 28 px tall). The rule is in `src/index.css`, and a test page applies no screen-width rule, so
 * this reads the stylesheet's words. The heights are measured in the fragment.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PHONE_PRESS_MIN_HEIGHT, thumbInLine } from '../lib/phonePress'

const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8')

/** The height the pill is drawn at: 12 px words on the strip's 1.35 line, 2 px of padding and a 1 px border each side. */
const PILL_DRAWN = 22

/** The declarations of the first rule for `selector` inside a phone block that follows the strip's own rule. */
function phoneRule(selector: string): Record<string, string> {
  const from = css.indexOf('.appHealthStripRetry {')
  const block = css.indexOf('@media (max-width: 640px) {', from)
  expect(from, 'the strip’s pill has no rule').toBeGreaterThan(-1)
  expect(block, 'no phone block follows the pill’s rule').toBeGreaterThan(from)
  const at = css.indexOf(`${selector} {`, block)
  expect(at, `no phone rule for ${selector}`).toBeGreaterThan(block)
  const body = css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at))
  return Object.fromEntries(
    body
      .split(';')
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => [d.slice(0, d.indexOf(':')).trim(), d.slice(d.indexOf(':') + 1).trim()]),
  )
}

describe('the app-health strip’s pill on a phone', () => {
  it('takes a fingertip, and gives the growth back so the strip is no taller', () => {
    const press = phoneRule('.appHealthStripRetry')
    const grown = thumbInLine(PILL_DRAWN)
    expect(press['min-height']).toBe(`${PHONE_PRESS_MIN_HEIGHT}px`)
    expect(press['margin-top']).toBe(`${grown.marginTop}px`)
    expect(press['margin-bottom']).toBe(`${grown.marginBottom}px`)
  })

  it('draws the pill behind the words at the size it had, so it looks as it did', () => {
    const press = phoneRule('.appHealthStripRetry')
    const pill = phoneRule('.appHealthStripRetry::before')
    // The press itself draws nothing: its outline and its fill are the pill's.
    expect(press['border-color']).toBe('transparent')
    expect(press.background).toBe('transparent')
    expect(pill.height).toBe(`${PILL_DRAWN}px`)
    expect(pill.border).toBe('1px solid currentColor')
    expect(pill.background).toBe('var(--surface)')
    expect(pill['z-index']).toBe('-1')
  })

  it('leaves the pill as it was at a desk', () => {
    const from = css.indexOf('.appHealthStripRetry {')
    const desk = css.slice(from, css.indexOf('}', from))
    expect(desk).toContain('padding: 2px 10px;')
    expect(desk).not.toMatch(/min-height/)
  })
})
