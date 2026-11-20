import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * A screen with no header over it starts under the status bar on a Home Screen iPhone. Its words pay
 * the top inset through one class, `.appBareScreen` (index.css), never a padding of their own: the
 * sign-in gate's "Loading…" sat behind the camera until v2.8039.
 */
const read = (fromSrc: string) => readFileSync(fileURLToPath(new URL(`../${fromSrc}`, import.meta.url)), 'utf8')

/** The declarations of one rule, by its exact selector. */
function ruleBody(css: string, selector: string): string {
  const at = css.indexOf(`\n${selector} {`)
  if (at < 0) return ''
  return css.slice(at, css.indexOf('}', at))
}

describe('a screen with no header over it', () => {
  const css = read('index.css')

  it('pays the top inset once, on top of its own room', () => {
    expect(ruleBody(css, '.appBareScreen')).toContain('padding-top: calc(2rem + var(--app-top-chrome, 0px));')
    expect(css).toContain('--app-top-chrome: env(safe-area-inset-top, 0px);')
  })

  it('pays nothing more under the header, where the nav has paid', () => {
    expect(ruleBody(css, '.appMain .appBareScreen')).toContain('padding-top: 2rem;')
  })

  it.each([
    ['App.tsx', 'data-auth-gate'],
    ['components/RouteChunkBoundary.tsx', 'Updating app…'],
    ['components/RouteChunkBoundary.tsx', 'This page could not load'],
    ['pages/TaskShortcut.tsx', 'Opening…'],
    ['pages/DevLogin.tsx', 'Signing in as'],
  ])('%s draws "%s" inside the class', (file, words) => {
    const src = read(file)
    // The last mention is the drawn one: a comment above it may name the words too.
    const at = src.lastIndexOf(words)
    expect(at).toBeGreaterThan(-1)
    // The nearest opening <div before the words is the screen itself.
    const opened = src.lastIndexOf('className="appBareScreen"', at)
    expect(opened).toBeGreaterThan(-1)
    expect(src.slice(opened, at)).not.toContain("padding: '2rem'")
    expect(at - opened).toBeLessThan(400)
  })

  it('a corner toast never sits above the inset', () => {
    expect(read('components/Toast.tsx')).toContain('var(--app-top-chrome, 0px)))`,')
  })
})
