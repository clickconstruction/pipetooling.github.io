import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CLOCK_IN_ACCENT_ORANGE, CLOCK_IN_ACCENT_TEXT } from './clock/clockColors'
import { contrastRatio } from './lens/lensAudit'
import { hexToRgba, parseThemeTokens, type ThemeName } from './lens/lensTokens'
import { CARD, FAINT, INK, MUTED, NOTE_BAND, PAPER } from './portal/portalTheme'

/**
 * The four pairs What everyone sees measured under 3:1 on 2026-10-27, held at 4.5:1 since v2.5981:
 * the Clock In bar, the Bids mode chip in dark, the Calendar's dates in dark, and the portal's
 * small print. Each color as the theme draws it, read from src/index.css.
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

describe('the pairs What everyone sees found, in both themes', () => {
  const pairs: { label: string; fg: string; bg: string }[] = [
    { label: 'Clock In on the clock-in orange', fg: CLOCK_IN_ACCENT_TEXT, bg: CLOCK_IN_ACCENT_ORANGE },
    { label: 'the picked Bids mode chip (BidsModeToggle)', fg: 'var(--surface)', bg: 'var(--text-violet-700)' },
    { label: "the Calendar's dates on the day card", fg: 'var(--text-blue-700)', bg: 'var(--surface)' },
    { label: "the Calendar's dates on the hovered day", fg: 'var(--text-blue-700)', bg: 'var(--bg-blue-tint)' },
    { label: "the Calendar's other months' dates", fg: 'var(--text-muted)', bg: 'var(--surface)' },
  ]
  for (const p of pairs) {
    for (const theme of THEMES) {
      it(`${p.label}, ${theme}: 4.5:1 or better`, () => {
        expect(ratio(p.fg, p.bg, theme)).toBeGreaterThanOrEqual(4.5)
      })
    }
  }
})

describe("the portal's paper: every text tier on every ground", () => {
  const grounds = { CARD, PAPER, NOTE_BAND }
  for (const [tier, fg] of Object.entries({ INK, MUTED, FAINT })) {
    for (const [ground, bg] of Object.entries(grounds)) {
      it(`${tier} on ${ground}: 4.5:1 or better`, () => {
        expect(ratio(fg, bg, 'light')).toBeGreaterThanOrEqual(4.5)
      })
    }
  }

  it('FAINT stays a step lighter than MUTED', () => {
    expect(ratio(FAINT, CARD, 'light')).toBeLessThan(ratio(MUTED, CARD, 'light'))
  })
})
