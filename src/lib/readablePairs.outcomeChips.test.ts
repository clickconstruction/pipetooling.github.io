import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PURSUIT_OUTCOME_CHIP_COLORS } from './bids/pursuitOutcomeColors'
import { contrastRatio, over, parseRgb } from './lens/lensAudit'
import { hexToRgba, parseThemeTokens, type ThemeName } from './lens/lensTokens'

/**
 * The Bid Costs tab's Open, Won and Lost chips (v2.6081): each chip's words on its wash laid over the
 * page and over the surface with the lens's own `over`, and the unsent chip's plain pair. Each color as
 * the theme draws it, read from src/index.css. Its own file so the sweep's PRs queue together without
 * sharing a line; the pins move into readablePairs.test.ts once every one is on main.
 */
const tokens = parseThemeTokens(readFileSync('src/index.css', 'utf8'))
const THEMES: readonly ThemeName[] = ['light', 'dark']

/** A hex as is; a token from that theme's block, or the light block's when dark leaves it alone. */
function drawn(color: string, theme: ThemeName): string {
  const name = /^var\((--[a-z0-9-]+)\)$/.exec(color)?.[1]
  if (!name) return color
  const find = (t: ThemeName) => tokens[t].find((d) => d.name === name)?.value
  const value = (theme === 'dark' ? find('dark') : undefined) ?? find('light')
  if (!value) throw new Error(`src/index.css declares no ${name}`)
  return value
}

const ratio = (fg: string, bg: string, theme: ThemeName) => contrastRatio(hexToRgba(drawn(fg, theme)), hexToRgba(drawn(bg, theme)))

/** A chip's rgba wash laid over a ground token, as the theme draws it. */
const washed = (wash: string, ground: string, theme: ThemeName) => {
  const w = parseRgb(wash)
  if (!w) throw new Error(`not an rgba wash: ${wash}`)
  return over(w, hexToRgba(drawn(ground, theme)))
}

describe("the Bid Costs tab's outcome chips, in both themes (v2.6081)", () => {
  for (const theme of THEMES) {
    it(`the unsent chip, ${theme}: 4.5:1 or better`, () => {
      expect(ratio(PURSUIT_OUTCOME_CHIP_COLORS.unsent.fg, PURSUIT_OUTCOME_CHIP_COLORS.unsent.bg, theme)).toBeGreaterThanOrEqual(4.5)
    })
  }
  for (const [outcome, c] of Object.entries(PURSUIT_OUTCOME_CHIP_COLORS)) {
    if (!c.bg.startsWith('rgba')) continue
    for (const ground of ['var(--bg-page)', 'var(--surface)']) {
      for (const theme of THEMES) {
        it(`the ${outcome} chip on its wash over ${ground}, ${theme}: 4.5:1 or better`, () => {
          expect(contrastRatio(hexToRgba(drawn(c.fg, theme)), washed(c.bg, ground, theme))).toBeGreaterThanOrEqual(4.5)
        })
      }
    }
  }
})
