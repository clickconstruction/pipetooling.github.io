import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SAFETY_ORANGE, SAFETY_ORANGE_TEXT, TEXT_ON_SAFETY_ORANGE } from './bids/bidStyles'
import { CLOCK_IN_ACCENT_ORANGE, CLOCK_IN_ACCENT_TEXT } from './clock/clockColors'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from './deadPress'
import { GOOD_THROUGH_PASSED_CHIP_COLORS } from './estimates/estimateGoodThroughChip'
import { contrastRatio } from './lens/lensAudit'
import { hexToRgba, parseThemeTokens, type ThemeName } from './lens/lensTokens'
import { PORTAL_TRADE_COLORS } from './portal/portalPayload'
import { CARD, COPPER, FAINT, HAIR, INK, MUTED, NOTE_BAND, PAPER } from './portal/portalTheme'
import { TRADE_COLORS } from './tradeColors'
import { BID_SERVICE_TYPE_TAGS } from '../utils/unifiedJobBidSearch'

/**
 * The four pairs What everyone sees measured under 3:1 on 2026-10-27, held at 4.5:1 since v2.5981:
 * the Clock In bar, the Bids mode chip in dark, the Calendar's dates in dark, and the portal's
 * small print; the Pipeline's good-through-passed chip since v2.6037; and the pairs the sweep of
 * 2026-10-29 found, each since the version named on it. Each color as the theme draws it, read from
 * src/index.css.
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
    { label: "the Pipeline's good-through-passed chip", fg: GOOD_THROUGH_PASSED_CHIP_COLORS.fg, bg: GOOD_THROUGH_PASSED_CHIP_COLORS.bg },
    { label: 'a dead press: Print, Generate PO, Send feedback, Post note, the Job Mode bar (v2.6062)', fg: DEAD_PRESS_TEXT, bg: DEAD_PRESS_FILL },
    { label: 'the open Counts, Pricing or Cover Letter tab, an orange button and the pending count (v2.6063)', fg: TEXT_ON_SAFETY_ORANGE, bg: SAFETY_ORANGE },
    { label: 'a closed Counts, Pricing or Cover Letter tab on the page (v2.6063)', fg: SAFETY_ORANGE_TEXT, bg: 'var(--bg-page)' },
    { label: "a form's orange hint on the surface (v2.6063)", fg: SAFETY_ORANGE_TEXT, bg: 'var(--surface)' },
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

describe("the portal's trade colours and copper (v2.6067, punch list #199)", () => {
  const grounds = { CARD, PAPER, NOTE_BAND }
  for (const [tag, color] of Object.entries(TRADE_COLORS)) {
    for (const [ground, bg] of Object.entries(grounds)) {
      it(`${tag} as a word on ${ground}: 4.5:1 or better`, () => {
        expect(ratio(color, bg, 'light')).toBeGreaterThanOrEqual(4.5)
      })
    }
    it(`white on ${tag}, the app's pill: 4.5:1 or better`, () => {
      expect(ratio('#ffffff', color, 'light')).toBeGreaterThanOrEqual(4.5)
    })
  }

  for (const [ground, bg] of Object.entries(grounds)) {
    it(`COPPER as a word on ${ground}: 4.5:1 or better`, () => {
      expect(ratio(COPPER, bg, 'light')).toBeGreaterThanOrEqual(4.5)
    })
  }

  it('white on the copper, a button: 4.5:1 or better', () => {
    expect(ratio('#ffffff', COPPER, 'light')).toBeGreaterThanOrEqual(4.5)
  })

  it("a waiting press, muted words on the hairline: 3:1 or better (the lens's floor; a waiting control is exempt from 4.5:1)", () => {
    expect(ratio(MUTED, HAIR, 'light')).toBeGreaterThanOrEqual(3)
  })

  it('the portal and the app read one trade colour source', () => {
    expect(PORTAL_TRADE_COLORS).toEqual(TRADE_COLORS)
    expect(Object.values(BID_SERVICE_TYPE_TAGS).map((t) => [t.tag, t.color])).toEqual(Object.entries(TRADE_COLORS))
  })
})
