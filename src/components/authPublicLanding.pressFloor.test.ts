/**
 * The sign-in card's two presses on a phone (finding 303, a simulator's read of 2026-11-27: **Sign in** and
 * **Continue with Google** each stood 40.8 px at 375 px, 4 under a fingertip). The rule is in the card's stylesheet,
 * and a test page applies no screen-width rule, so this reads the stylesheet's words. The heights are measured in the
 * fragment's picture.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PHONE_PRESS_MIN_HEIGHT } from '../lib/phonePress'

/** The app's phone line, as `useIsMobile` draws it. */
const PHONE_WIDTH = 640

const css = readFileSync(join(process.cwd(), 'src/components/authPublicLanding.css'), 'utf8')

/** Every block the stylesheet writes for a phone's width, as `[selectors, declarations]` of each rule inside it. */
function phoneRules(): Array<[string, string]> {
  const out: Array<[string, string]> = []
  const opener = `@media (max-width: ${PHONE_WIDTH}px) {`
  let from = css.indexOf(opener)
  while (from !== -1) {
    let depth = 1
    let i = from + opener.length
    for (; i < css.length && depth > 0; i += 1) {
      if (css[i] === '{') depth += 1
      else if (css[i] === '}') depth -= 1
    }
    const body = css.slice(from + opener.length, i - 1)
    for (const m of body.matchAll(/([^{}]+)\{([^{}]*)\}/g)) out.push([m[1]!.replace(/\s+/g, ' ').trim(), m[2]!.replace(/\s+/g, ' ').trim()])
    from = css.indexOf(opener, i)
  }
  return out
}

describe('the sign-in card’s presses on a phone', () => {
  it('stand a fingertip tall at the app’s phone width, both of them, in one rule', () => {
    const rule = phoneRules().find(([selectors]) => selectors.includes('__signin-submit') && selectors.includes('__signin-google'))
    expect(rule, 'no phone rule names both presses').toBeTruthy()
    expect(rule![1]).toBe(`min-height: ${PHONE_PRESS_MIN_HEIGHT}px;`)
    expect(rule![0].split(',').map((s) => s.trim())).toEqual(['.auth-public-landing .auth-public-landing__signin-submit', '.auth-public-landing .auth-public-landing__signin-google'])
  })

  it('leave the presses as they were at a desk: no height is set outside the phone block', () => {
    const outside = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '')
    const submit = outside.match(/\.auth-public-landing \.auth-public-landing__signin-submit \{([^}]*)\}/)
    const google = outside.match(/\.auth-public-landing \.auth-public-landing__signin-google \{([^}]*)\}/)
    expect(submit?.[1]).toBeTruthy()
    expect(google?.[1]).toBeTruthy()
    expect(submit![1]).not.toMatch(/min-height|(^|\s)height:/)
    expect(google![1]).not.toMatch(/min-height|(^|\s)height:/)
  })
})
