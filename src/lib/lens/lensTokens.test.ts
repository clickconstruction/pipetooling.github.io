// @vitest-environment jsdom
import shippedTokens from 'virtual:lens-tokens'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { applyDraftStyle, draftCss, draftPatch, hexOf, parseThemeTokens, tokenGroup, type ThemeTokens } from './lensTokens'

const tokens: ThemeTokens = shippedTokens

const CSS = `
/* a comment with { braces } */
:root,
[data-theme='light'] {
  color-scheme: light;
  --surface: #ffffff;
  --text-muted: #6b7280;
  --shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}
:root[data-theme='dark'] {
  --surface: #1f2937;
}
[data-theme='light']:not(:root) { color: var(--text-base); }
.card { --surface: #000000; }
`

describe('the theme draft · the shipped tokens', () => {
  it('reads the light and dark blocks only, in order, comments and other rules aside', () => {
    expect(parseThemeTokens(CSS)).toEqual({
      light: [
        { name: '--surface', value: '#ffffff' },
        { name: '--text-muted', value: '#6b7280' },
        { name: '--shadow', value: '0 1px 2px rgba(0, 0, 0, 0.06)' },
      ],
      dark: [{ name: '--surface', value: '#1f2937' }],
    })
  })

  it('is read from src/index.css when the tab is built, every token of both themes', () => {
    const fresh = parseThemeTokens(readFileSync(join(process.cwd(), 'src/index.css'), 'utf8'))
    expect(tokens).toEqual(fresh)
    expect(tokens.light.length).toBeGreaterThan(100)
    expect(tokens.dark.length).toBeGreaterThan(100)
    expect(tokens.light.find((t) => t.name === '--surface')?.value).toBe('#ffffff')
    expect(tokens.dark.find((t) => t.name === '--surface')?.value).toBe('#1f2937')
  })
})

describe('the theme draft · what it writes', () => {
  it('gives a frame its changed tokens over the shipped ones, each theme on its own selector', () => {
    expect(draftCss({ light: { '--surface': '#fbf7ee' }, dark: {} })).toBe("[data-theme='light'] { --surface: #fbf7ee !important; }")
    expect(draftCss({ light: {}, dark: { '--text-muted': '#a1a1aa' } })).toBe(":root[data-theme='dark'] { --text-muted: #a1a1aa !important; }")
    expect(draftCss({ light: {}, dark: {} })).toBe('')
  })

  it('writes the patch for index.css with the value each token replaces', () => {
    const t = parseThemeTokens(CSS)
    expect(draftPatch({ light: { '--surface': '#fbf7ee' }, dark: {} }, t)).toBe(
      "/* src/index.css: a theme draft from What everyone sees */\n:root,\n[data-theme='light'] {\n  --surface: #fbf7ee; /* was #ffffff */\n}\n",
    )
    expect(draftPatch({ light: {}, dark: {} }, t)).toBe('')
  })

  it('groups tokens by their names and reads hex values as a color input does', () => {
    expect(tokenGroup('--bg-page')).toBe('Page and surfaces')
    expect(tokenGroup('--text-link')).toBe('Text')
    expect(tokenGroup('--bg-amber-tint')).toBe('Tints')
    expect(tokenGroup('--chrome-bg')).toBe('Top bar and menus')
    expect(hexOf('#ABC')).toBe('#aabbcc')
    expect(hexOf('#1f2937')).toBe('#1f2937')
    expect(hexOf('rgba(0,0,0,.5)')).toBeNull()
  })
})

describe('the theme draft · in a frame', () => {
  it('puts the draft in as one style sheet, replaces it, and takes it out when the draft is off', () => {
    const doc = document.implementation.createHTMLDocument('frame')
    applyDraftStyle(doc, "[data-theme='light'] { --surface: #fbf7ee !important; }")
    applyDraftStyle(doc, "[data-theme='light'] { --surface: #eeeeee !important; }")
    const sheets = doc.querySelectorAll('style[data-lens-draft]')
    expect(sheets).toHaveLength(1)
    expect(sheets[0]?.textContent).toContain('#eeeeee')
    applyDraftStyle(doc, '')
    expect(doc.querySelectorAll('style[data-lens-draft]')).toHaveLength(0)
    expect(() => applyDraftStyle(null, 'x')).not.toThrow()
  })
})
