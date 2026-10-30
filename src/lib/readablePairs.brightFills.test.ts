import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { contrastRatio, over } from './lens/lensAudit'
import { hexToRgba, parseThemeTokens, type ThemeName } from './lens/lensTokens'

/**
 * The bright fills the sweep of 2026-10-29 found carrying white words (v2.6070): the follow-ups
 * count and a follow-up's job number on amber, the Checklist's ✓ You on green, the header's dispatch
 * press on sky, and the Bids lens bar's count pill on its wash. Each color as the theme draws it,
 * read from src/index.css. Its own file so the sweep's PRs queue together without sharing a line;
 * the pins move into readablePairs.test.ts once every one is on main.
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

describe('words on the bright fills, in both themes (v2.6070)', () => {
  const pairs: { label: string; fg: string; bg: string }[] = [
    { label: "the follow-ups count and a follow-up's job number on amber", fg: 'var(--text-on-bright-solid)', bg: '#f59e0b' },
    { label: "the Checklist's ✓ You on green", fg: 'var(--text-on-bright-solid)', bg: '#22c55e' },
    { label: "the header's dispatch press on sky", fg: 'var(--text-on-bright-solid)', bg: '#0ea5e9' },
  ]
  for (const p of pairs) {
    for (const theme of THEMES) {
      it(`${p.label}, ${theme}: 4.5:1 or better`, () => {
        expect(ratio(p.fg, p.bg, theme)).toBeGreaterThanOrEqual(4.5)
      })
    }
  }

  it("the Bids lens bar's count pill: white on a 25% black wash over the open lens's blue, 4.5:1 or better", () => {
    const ground = over({ r: 0, g: 0, b: 0, a: 0.25 }, hexToRgba('#3b82f6'))
    expect(contrastRatio(hexToRgba('#ffffff'), ground)).toBeGreaterThanOrEqual(4.5)
  })
})
