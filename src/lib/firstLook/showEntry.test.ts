/**
 * Punch list #319 PR 4: a First look's page is an entry of its own. Four files have to agree for a customer's link to
 * reach it, and none of them is code a unit test runs: `index.html`'s first script, `show.html`, the build's second
 * input, and the service worker's denylist. This reads them as text and holds them together.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FIRST_LOOK_CODE_RE } from './look'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('a First look’s page as an entry of its own (punch list #319 PR 4)', () => {
  const index = read('index.html')

  it('index.html sends a look’s address to show.html before anything else in the head loads', () => {
    const redirect = index.indexOf("window.location.replace('/show.html#' + m[1])")
    expect(redirect).toBeGreaterThan(0)
    expect(redirect).toBeLessThan(index.indexOf('<link '))
    expect(redirect).toBeLessThan(index.indexOf('type="module"'))
  })

  it('the script’s pattern takes a ten-letter code and nothing else', () => {
    const source = /var m = \/(.+?)\/\.exec\(window\.location\.pathname\)/.exec(index)?.[1]
    expect(source).toBeTruthy()
    const re = new RegExp(source!)
    expect(re.exec('/show/k7m2p9xq4d')?.[1]).toBe('k7m2p9xq4d')
    expect(re.exec('/show/k7m2p9xq4d/')?.[1]).toBe('k7m2p9xq4d')
    for (const path of ['/show/', '/show/short', '/show/k7m2p9xq4dzz', '/show/K7M2P9XQ4D', '/shows/k7m2p9xq4d', '/dashboard', '/show/k7m2p9xq4d/more']) expect(re.test(path)).toBe(false)
    // Every code the mint can make is one the script sends on.
    expect(FIRST_LOOK_CODE_RE.test('k7m2p9xq4d')).toBe(true)
  })

  it('show.html loads the page’s own entry and nothing of the app', () => {
    const show = read('show.html')
    expect(show).toContain('<script type="module" src="/src/showEntry.tsx"></script>')
    expect(show).toContain('noindex')
    expect(show).not.toContain('/src/main.tsx')
    const entry = read('src/showEntry.tsx')
    expect(entry).toContain("import ShowUs from './pages/ShowUs'")
    expect(entry).not.toMatch(/react-router|supabase|App'/)
    // The page itself reads no router, so the entry stays small.
    expect(read('src/pages/ShowUs.tsx')).not.toMatch(/from 'react-router-dom'/)
  })

  it('the build makes it, and the service worker leaves it to the network', () => {
    expect(read('vite.config.ts')).toMatch(/input: \{ main: resolve\(__dirname, 'index\.html'\), show: resolve\(__dirname, 'show\.html'\) \}/)
    expect(read('src/sw.ts')).toContain('/^\\/show\\.html$/')
  })
})
