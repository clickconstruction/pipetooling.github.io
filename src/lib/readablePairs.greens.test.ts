import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { contrastRatio } from './lens/lensAudit'
import { hexToRgba, parseThemeTokens, type ThemeName } from './lens/lensTokens'

/**
 * The greens the sweep of 2026-10-29 found too pale in dark mode (v2.6075): a stage's Next line, the
 * money desk's ✓ All clear and amounts, and the discount's words, all in green-700 on the surface.
 * Each color as the theme draws it, read from src/index.css. Its own file so the sweep's PRs queue
 * together without sharing a line; the pin moves into readablePairs.test.ts once every one is on main.
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

describe('green-700 on the surface, in both themes (v2.6075)', () => {
  for (const theme of THEMES) {
    it(`Next, ✓ All clear and the discount, ${theme}: 4.5:1 or better`, () => {
      expect(ratio('var(--text-green-700)', 'var(--surface)', theme)).toBeGreaterThanOrEqual(4.5)
    })
  }
})
