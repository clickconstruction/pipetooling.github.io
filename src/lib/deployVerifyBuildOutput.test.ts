import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The deploy's "Verify build output" step (v2.7034). It used to look for `assets/index-` in the built
 * index.html. When a second build entry renamed the app's bundle to `main-<hash>.js` (v2.7007), the step
 * failed every deploy while the build itself was fine. The check now asks what it means: the page loads a
 * script the build made. These cases hold the line in the workflow to that, under either name.
 */
const workflow = readFileSync(resolve(__dirname, '../../.github/workflows/deploy.yml'), 'utf8')

function builtAssetPattern(): RegExp {
  const step = workflow.slice(workflow.indexOf('- name: Verify build output'))
  const m = /if ! grep -qE '([^']+)' dist\/index\.html; then\n\s+echo "::error::index\.html does not reference built assets correctly"/.exec(step)
  if (!m) throw new Error('the Verify build output step has no built-assets grep on dist/index.html')
  // The pattern is plain extended regex with nothing JavaScript reads differently.
  return new RegExp(m[1]!)
}

describe('deploy.yml — Verify build output', () => {
  const pattern = builtAssetPattern()

  it('passes the built page whatever the bundler names the app’s bundle', () => {
    expect(pattern.test('<script type="module" crossorigin src="/assets/main-Cq0DJ6eF.js"></script>')).toBe(true)
    expect(pattern.test('<script type="module" crossorigin src="/assets/index-B1x2y3Zz.js"></script>')).toBe(true)
  })

  it('fails a page that still points at the source, or loads no script of the build', () => {
    expect(pattern.test('<script type="module" src="/src/main.tsx"></script>')).toBe(false)
    expect(pattern.test('<link rel="stylesheet" crossorigin href="/assets/main-BIR2EbN5.css">')).toBe(false)
    expect(pattern.test('<link rel="icon" type="image/svg+xml" href="/favicon.svg" />')).toBe(false)
  })

  it('names no bundle: the step never greps for index- or main- in the built page', () => {
    const step = workflow.slice(workflow.indexOf('- name: Verify build output'), workflow.indexOf('- name: Merge previous deploy'))
    const greps = step.split('\n').filter((l) => /^\s*if !? ?grep /.test(l))
    expect(greps.length).toBeGreaterThanOrEqual(2)
    for (const line of greps) expect(line).not.toMatch(/assets\/(index|main)-/)
    // The source-file check stays: a page that still loads main.tsx was never built.
    expect(step).toContain('grep -q "main.tsx" dist/index.html')
  })
})
