import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * The lines above the header start at the top of the glass on a Home Screen iPhone. The first one
 * showing pays the top inset, through one class, `.appTopBanner` (index.css), and everything under
 * it pays none. Until v2.8053 none paid: the first line sat under the status bar and the header
 * under it still padded by the whole inset.
 */
const read = (fromSrc: string) => readFileSync(fileURLToPath(new URL(`../${fromSrc}`, import.meta.url)), 'utf8')

/** The declarations of one rule, by its exact selector. */
function ruleBody(css: string, selector: string): string {
  const at = css.indexOf(`\n${selector} {`)
  if (at < 0) return ''
  return css.slice(at, css.indexOf('}', at))
}

describe('the lines above the header', () => {
  const css = read('index.css')

  it('the first one showing pays the top inset on top of its own padding', () => {
    expect(ruleBody(css, '.appTopBanner')).toContain(
      'padding-top: calc(var(--app-top-banner-pad-y, 0.4rem) + env(safe-area-inset-top, 0px));',
    )
  })

  it('a line under another line pays its own padding alone', () => {
    expect(ruleBody(css, '.appTopBanner ~ .appTopBanner')).toContain('padding-top: var(--app-top-banner-pad-y, 0.4rem);')
  })

  it('the View-as strip under a line pays none', () => {
    expect(ruleBody(css, '.appTopBanner ~ .appViewAsStrip')).toContain('padding-top: 0;')
  })

  it('the header under a line is told there is none left to pay, as under the View-as strip', () => {
    expect(ruleBody(css, '.appTopBanner ~ .appNavChrome')).toContain('--app-nav-safe-top: 0px;')
    expect(ruleBody(css, '.appViewAsStrip + .appNavChrome')).toContain('--app-nav-safe-top: 0px;')
  })

  it('the header, the health strip and the search bar all read that one word', () => {
    expect(ruleBody(css, '.appNav')).toContain('var(--app-nav-safe-top, env(safe-area-inset-top, 0px))')
    expect(ruleBody(css, '.appHealthStrip')).toContain('var(--app-nav-safe-top, env(safe-area-inset-top, 0px))')
    expect(read('components/HeaderGlobalSearch.tsx')).toContain('var(--app-nav-safe-top, env(safe-area-inset-top, 0px))')
  })

  it('the class is the one the component draws in', () => {
    expect(read('components/layout/AppTopBanner.tsx')).toContain("APP_TOP_BANNER_CLASS = 'appTopBanner'")
  })

  it('Layout draws nothing above the header but these lines and the View-as strip', () => {
    const src = read('components/Layout.tsx')
    // The mode row (punch list #425) is the first line of all.
    const from = src.indexOf('<ModeRow')
    const to = src.indexOf('<div className="appNavChrome">')
    expect(from).toBeGreaterThan(-1)
    expect(to).toBeGreaterThan(from)
    const above = src.slice(from, to).replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    // Every element opened here is one of these. A bare <div> would pay no inset and leave the header paying it all.
    const opened = [...above.matchAll(/<([A-Za-z][A-Za-z0-9]*)/g)].map((m) => m[1])
    const mounts = opened.filter((name) => name !== 'strong')
    expect(mounts.length).toBeGreaterThan(3)
    for (const name of mounts) {
      expect(['ModeRow', 'AddTaskShortcutBanner', 'AppTopBanner', 'CustomerWaitingBanner', 'ViewAsExitStrip']).toContain(name)
    }
  })

  it.each([
    ['components/AddTaskShortcutBanner.tsx', 1],
    ['components/CustomerWaitingBanner.tsx', 2],
    // Task Mode's row alone. The Dashboard's row lies over the page from a line of no height that is no banner (punch list #433):
    // the header under it keeps paying the status bar, as on every page, so nothing moves when the row comes or goes.
    ['components/layout/ModeRow.tsx', 1],
  ])('%s draws its line through the component, with no padding of its own', (file, lines) => {
    // The opening tag ends at the first `>` that closes a line.
    const tags = read(file).match(/<AppTopBanner\b[\s\S]*?>\n/g) ?? []
    expect(tags.length).toBe(lines)
    for (const tag of tags) expect(tag).not.toMatch(/padding/)
  })
})
