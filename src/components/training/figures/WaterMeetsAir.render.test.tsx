// @vitest-environment jsdom
/**
 * Where water meets air, lesson 18 of Intro to HVAC (punch list #419): the two small labels inside the tank sit on
 * its tints, a pale red over a pale blue, and must read at 4.5 to 1 there in light and in dark. The walk of
 * 2026-11-25 measured them at 3.96 to 1 in the muted grey. The colours are read from the theme's own tokens in
 * `src/index.css`, so a change to a token is measured here too.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { WaterMeetsAir } from './WaterMeetsAir'

afterEach(() => cleanup())

const CSS = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')

/** A token's two values, light first and dark second, as `src/index.css` declares them. */
function tokenValues(name: string): { light: string; dark: string } {
  const found = [...CSS.matchAll(new RegExp(`^\\s*${name}:\\s*(#[0-9a-fA-F]{6});`, 'gm'))].map((m) => m[1] ?? '')
  expect(found, `${name} is declared once for light and once for dark`).toHaveLength(2)
  return { light: found[0] ?? '', dark: found[1] ?? '' }
}

function luminance(hex: string): number {
  const channel = (at: number) => {
    const v = parseInt(hex.slice(at, at + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

/** `var(--name)` → `--name`. */
function tokenOf(fill: string | null): string {
  const m = /^var\((--[a-z0-9-]+)\)$/.exec(fill ?? '')
  expect(m, `a theme token, got ${fill}`).not.toBeNull()
  return m?.[1] ?? ''
}

describe('WaterMeetsAir', () => {
  it.each([
    ['the heat goes', 'red'],
    ['into the water', 'blue'],
  ] as const)('“%s” reads at 4.5 to 1 on the tank’s %s tint, in light and in dark', (words, tint) => {
    const { container } = render(<WaterMeetsAir titleId="t" />)
    const label = [...container.querySelectorAll('text')].find((t) => t.textContent?.trim() === words)
    expect(label).toBeDefined()
    // The tank: the blue body is the first filled rect, the red top is the path drawn over it.
    const body = container.querySelector('rect[fill^="var(--bg-blue"]')
    const top = container.querySelector('path[fill^="var(--bg-red"]')
    const under = tint === 'red' ? top : body
    const text = tokenValues(tokenOf(label?.getAttribute('fill') ?? null))
    const ground = tokenValues(tokenOf(under?.getAttribute('fill') ?? null))
    expect(contrast(text.light, ground.light)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(text.dark, ground.dark)).toBeGreaterThanOrEqual(4.5)
  })

  it('the muted grey it replaced fails the same measure, so the test would have caught it', () => {
    const muted = tokenValues('--text-muted')
    expect(contrast(muted.light, tokenValues('--bg-red-100').light)).toBeLessThan(4.5)
    expect(contrast(muted.light, tokenValues('--bg-blue-200').light)).toBeLessThan(4.5)
  })
})
