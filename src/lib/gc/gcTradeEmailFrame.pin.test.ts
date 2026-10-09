/**
 * The GC trade email's frame (`buildGcTradeEmail`, the Portal lane's P3), pinned byte for byte before the Board's
 * B6-b-i gives it an optional action (agreed with the Portal lane, 2026-10-09). Every email to a trade partner goes
 * through it, so with no action its output must not move. `gcTradeEmailFrame.pin.json` holds what main's own code gave
 * on these inputs (origin/main abd08c17c): English and Spanish, a list line with and without its title, one, two and
 * three names and none, HTML to escape, a spaced subject. Never regenerate it to make this pass.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildGcTradeEmail, type GcTradeEmailInput } from '../../../supabase/functions/_shared/gcTradeEmail'

type Pinned = { input: GcTradeEmailInput; email: ReturnType<typeof buildGcTradeEmail> }
const cases = JSON.parse(readFileSync(resolve(__dirname, 'gcTradeEmailFrame.pin.json'), 'utf8')) as Record<string, Pinned>

describe('the GC trade email frame as main sends it', () => {
  it('has every pinned case', () => {
    expect(Object.keys(cases)).toEqual(['enOneName', 'esTwoNamesList', 'enThreeNamesNoLines', 'enNoNames'])
  })

  it.each(Object.keys(cases))('%s: subject, text and HTML are byte for byte main’s', (name) => {
    const c = cases[name]!
    expect(buildGcTradeEmail(c.input)).toEqual(c.email)
  })
})
