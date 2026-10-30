import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { JOB_ACTIVITY_EVENT_RENDER } from './jobActivityEvent'
import { contrastRatio } from './lens/lensAudit'
import { hexToRgba, parseThemeTokens, type ThemeName } from './lens/lensTokens'

/**
 * A job's activity tags (v2.6078): every distinct tag colour the render map draws, on the surface, read
 * from the map itself so a new event kind is pinned the day it is added. Each color as the theme draws
 * it, read from src/index.css. Its own file so the sweep's PRs queue together without sharing a line;
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

describe("a job's activity tags on the surface, in both themes (v2.6078)", () => {
  const tagColors = [...new Set(Object.values(JOB_ACTIVITY_EVENT_RENDER).map((m) => m.tagColor))]
  for (const fg of tagColors) {
    for (const theme of THEMES) {
      it(`${fg} on the surface, ${theme}: 4.5:1 or better`, () => {
        expect(ratio(fg, 'var(--surface)', theme)).toBeGreaterThanOrEqual(4.5)
      })
    }
  }
})
