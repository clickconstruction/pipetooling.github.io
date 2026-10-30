import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { contrastRatio } from './lens/lensAudit'
import { hexToRgba, parseThemeTokens, type ThemeName } from './lens/lensTokens'
import { OVERHEAD_METHOD_INKS } from './overheadMethodInks'

/**
 * People → Overhead's three method inks (v2.6082): each on the page, where the method cards sit, and on
 * the surface, where the lens window's heading and rate sit. Each color as the theme draws it, read from
 * src/index.css. Its own file so the sweep's PRs queue together without sharing a line; the pins move
 * into readablePairs.test.ts once every one is on main.
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

describe("People → Overhead's method inks, in both themes (v2.6082)", () => {
  for (const [method, ink] of Object.entries(OVERHEAD_METHOD_INKS)) {
    for (const [where, ground] of [
      ['the page', 'var(--bg-page)'],
      ["the lens window's heading", 'var(--surface)'],
    ] as const) {
      for (const theme of THEMES) {
        it(`method ${method} on ${where}, ${theme}: 4.5:1 or better`, () => {
          expect(ratio(ink, ground, theme)).toBeGreaterThanOrEqual(4.5)
        })
      }
    }
  }
})
