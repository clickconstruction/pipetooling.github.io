import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { appRoutePathsFromSource, directoryProblems, docPathsFromMarkdown, helpSlugsFromMarkdown, pathMatchesRoute } from './appDirectoryCheck'

const root = resolve(__dirname, '../../..')
const twinsDir = resolve(root, 'docs/twins')

describe('appDirectoryCheck — the parsers', () => {
  it('reads nested and absolute route paths, skipping the catch-all', () => {
    const src = `<Routes><Route path="/sign-in" element={x} /><Route path="/" element={<Layout />}><Route path="customers/:id" element={y} /><Route path="*" element={z} /></Route></Routes>`
    expect(appRoutePathsFromSource(src)).toEqual(['/sign-in', '/', '/customers/:id'])
  })
  it('reads the paths and slugs a brief names, base path only, placeholders skipped', () => {
    const md = 'Go to `/bids?tab=pricing` or `/customers/:id` — never `/<role>/x`. Guides open at `/help?g=<slug>`; e.g. help?g=bill-a-customer-and-get-paid and `/help?g=read-the-pipeline-money-view`.'
    expect(docPathsFromMarkdown(md)).toEqual(['/bids', '/customers/:id', '/help'])
    expect(helpSlugsFromMarkdown(md)).toEqual(['bill-a-customer-and-get-paid', 'read-the-pipeline-money-view'])
  })
  it('matches params by segment', () => {
    expect(pathMatchesRoute('/customers/abc', '/customers/:id')).toBe(true)
    expect(pathMatchesRoute('/customers/:id', '/customers/:id')).toBe(true)
    expect(pathMatchesRoute('/customers', '/customers/:id')).toBe(false)
    expect(pathMatchesRoute('/bids', '/bid')).toBe(false)
  })
  it('names each drift', () => {
    const problems = directoryProblems({
      docs: [{ file: 'x.md', markdown: '`/nowhere` and help?g=no-such-guide and `/bids`' }],
      routes: ['/bids'],
      helpSlugs: new Set(['bill-a-customer-and-get-paid']),
    })
    expect(problems).toEqual(['x.md: `/nowhere` is not a route in src/App.tsx', 'x.md: help?g=no-such-guide has no guide in src/content/help/'])
  })
})

describe('docs/twins agrees with the app (Phase 4 upkeep)', () => {
  const routes = appRoutePathsFromSource(readFileSync(resolve(root, 'src/App.tsx'), 'utf8'))
  const helpSlugs = new Set(readdirSync(resolve(root, 'src/content/help')).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, '')))
  const docs = readdirSync(twinsDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => ({ file: `docs/twins/${f}`, markdown: readFileSync(resolve(twinsDir, f), 'utf8') }))

  it('reads the real route table, the guides and the briefs', () => {
    expect(routes).toContain('/customers/:id')
    expect(routes).toContain('/bids')
    expect(helpSlugs.size).toBeGreaterThan(50)
    expect(docs.some((d) => d.file.endsWith('APP_DIRECTORY.md'))).toBe(true)
  })
  it('every path and help slug the briefs name exists — a PR that adds or renames a page updates docs/twins/APP_DIRECTORY.md', () => {
    expect(directoryProblems({ docs, routes, helpSlugs })).toEqual([])
  })
})
