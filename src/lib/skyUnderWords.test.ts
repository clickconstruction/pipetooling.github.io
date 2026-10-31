import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SKY_UNDER_WORDS, SKY_UNDER_WORDS_HOVER } from './skyUnderWords'

/**
 * One sky under words (punch list #194, v2.6196): the stylesheet's workflow presses wear the
 * kernel's fill and hover, the hex lives in three places, and no press fills itself with the bright
 * sky under words any more. `readablePairs.test.ts` holds white on the fill and the hover at 4.5:1.
 */
const SRC = resolve(__dirname, '..')

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = resolve(dir, entry.name)
    if (entry.isDirectory()) sourceFiles(p, out)
    else if (/\.(tsx?|css)$/.test(entry.name) && !entry.name.includes('.test.')) out.push(p)
  }
  return out
}
const files = sourceFiles(SRC).map((p) => ({ file: p.slice(SRC.length + 1), src: readFileSync(p, 'utf8') }))

describe('sky under words (v2.6196)', () => {
  it("the stylesheet's two workflow presses wear the kernel's fill and hover, so the two cannot drift", () => {
    const css = files.find((f) => f.file === 'index.css')!.src
    const rules = css.match(/\.wf-btn-info \{[^}]*\}/g) ?? []
    expect(rules.length).toBe(2)
    for (const r of rules) expect(r).toContain(`background: ${SKY_UNDER_WORDS};`)
    const hovers = css.match(/\.wf-btn-info:hover \{[^}]*\}/g) ?? []
    expect(hovers.length).toBe(2)
    for (const r of hovers) expect(r).toContain(`background: ${SKY_UNDER_WORDS_HOVER};`)
  })

  it('the deep sky lives in the kernel, the stylesheet and one chart palette; every press reads the kernel', () => {
    // index.css: the text token --text-sky-700 and the workflow presses, which CSS cannot import.
    // TagBreakdownCard: a chart palette, not words.
    const allowed = new Set(['lib/skyUnderWords.ts', 'index.css', 'components/bids/TagBreakdownCard.tsx'])
    const carriers = files.filter((f) => f.src.toLowerCase().includes(SKY_UNDER_WORDS)).map((f) => f.file)
    expect(carriers.filter((f) => !allowed.has(f))).toEqual([])
  })

  it('no press fills itself with the bright sky under words', () => {
    const fills = files.filter((f) => /background:\s*'?#0ea5e9/i.test(f.src)).map((f) => f.file)
    expect(fills).toEqual([])
  })
})
