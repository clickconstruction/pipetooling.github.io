import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { usualExcludes } from './plans'
import { GC_NEW_HERE_STEPS, gcNewHereTarget } from './tour'

/** The page, its windows and the card head's kernel (v2.5544: the head's doors and their anchors are named in `cardHead.ts`), as source: every anchor and every label a stop names must be in it. */
const ROOT = join(__dirname, '..', '..')
const SOURCE = [
  readFileSync(join(ROOT, 'pages', 'GcProjects.tsx'), 'utf8'),
  readFileSync(join(ROOT, 'lib', 'gc', 'cardHead.ts'), 'utf8'),
  ...readdirSync(join(ROOT, 'components', 'gc'))
    .filter((f) => f.endsWith('.tsx') && !f.includes('.test.'))
    .map((f) => readFileSync(join(ROOT, 'components', 'gc', f), 'utf8')),
].join('\n')

describe('New here? on the GC projects page', () => {
  it('walks ten stops, each anchor once', () => {
    expect(GC_NEW_HERE_STEPS).toHaveLength(10)
    const anchors = GC_NEW_HERE_STEPS.map((s) => s.anchor)
    expect(new Set(anchors).size).toBe(anchors.length)
  })

  it('keeps the plain-words rules in every body, every missing line and every example, and titles short', () => {
    for (const s of GC_NEW_HERE_STEPS) {
      expect(plainWordsFailures(s.body), s.anchor).toEqual([])
      if (s.missingBody) expect(plainWordsFailures(s.missingBody), s.anchor).toEqual([])
      if (s.example?.after) expect(plainWordsFailures(s.example.after), s.anchor).toEqual([])
      expect(s.title.split(/\s+/).length, s.title).toBeLessThanOrEqual(8)
    }
  })

  it('v2.5553 · the Gaps stop shows a gap line in the words the page prints, from a leave-out the kernel knows', () => {
    const gaps = GC_NEW_HERE_STEPS.find((s) => s.anchor === 'gc-gaps')
    expect(gaps?.example?.tone).toBe('red')
    const line = gaps!.example!.parts.map((p) => p.words).join(' ')
    expect(line).toBe('Plumbing leaves out Gas piping for HVAC.')
    // The page writes a gap as `${trade} leaves out ${label} for ${by}`; the example's connectors are those words.
    expect(SOURCE).toContain('leaves out ${g.label} for ${g.by}')
    expect(usualExcludes('Plumbing')).toContainEqual(expect.objectContaining({ label: 'Gas piping', by: 'HVAC' }))
    // Three parts are labelled, in the line's order: who leaves it out, the work, who it is left to.
    expect(gaps!.example!.parts.filter((p) => p.means).map((p) => p.means)).toEqual(['leaves it out', 'the work', 'it is left to'])
    // The missing line no longer explains red words a second time: the example does.
    expect(gaps!.missingBody).toBe('This project has none.')
  })

  it('finds every anchor on the page, so moving a button keeps its name', () => {
    // As written: `data-tour="…"`, `dataTour="…"`, the page's first-card helper `tour('…')`, or a head door's `tour: '…'`.
    const forms = (anchor: string) => [`data-tour="${anchor}"`, `dataTour="${anchor}"`, `tour('${anchor}')`, `tour: '${anchor}'`]
    for (const { anchor } of GC_NEW_HERE_STEPS) {
      expect(forms(anchor).some((f) => SOURCE.includes(f)), anchor).toBe(true)
    }
  })

  it('names controls the page still carries, word for word', () => {
    const labels = [
      'New project',
      'Create the project',
      'The plans',
      'A new set of plans came in',
      'Questions about the plans',
      'Make the Drive folder',
      'Check again',
      'Open the scope book',
      'Save as a set',
      'New here?',
      'Trades',
    ]
    for (const label of labels) expect(SOURCE.includes(label), label).toBe(true)
    // The four step names New project's window carries, which stop 2 lists.
    for (const step of ["title: 'The project'", "title: 'The plans'", "title: 'The trades'", "title: 'Each scope'"]) {
      expect(SOURCE.includes(step), step).toBe(true)
    }
  })

  it('records an open and how far the walk got, counting stops from 1', () => {
    expect(gcNewHereTarget({ kind: 'opened', by: 'first-visit', of: 10 })).toBe('opened?by=first-visit&of=10')
    expect(gcNewHereTarget({ kind: 'opened', by: 'button', of: 10 })).toBe('opened?by=button&of=10')
    expect(gcNewHereTarget({ kind: 'closed', furthest: 3, of: 10 })).toBe('closed?stop=4&of=10')
    expect(gcNewHereTarget({ kind: 'closed', furthest: 9, of: 10 })).toBe('closed?stop=10&of=10')
    expect(gcNewHereTarget({ kind: 'closed', furthest: 42, of: 10 })).toBe('closed?stop=10&of=10')
    expect(gcNewHereTarget({ kind: 'closed', furthest: -1, of: 10 })).toBe('closed?stop=1&of=10')
  })
})
