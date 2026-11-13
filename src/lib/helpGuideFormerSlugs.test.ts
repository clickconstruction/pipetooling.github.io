/**
 * A renamed guide's old address (v2.7050): every old slug names a guide that exists, none is a
 * guide's own file, and none points at another old slug.
 */
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { HELP_GUIDE_FORMER_SLUGS, currentHelpGuideSlug, formerHelpGuideSlugs } from './helpGuideFormerSlugs'

const slugs = new Set(
  readdirSync(join(process.cwd(), 'src', 'content', 'help'))
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace(/\.md$/, '')),
)

describe('helpGuideFormerSlugs', () => {
  it('the Farm Mode guide answers as the Task Mode guide', () => {
    expect(currentHelpGuideSlug('farm-mode')).toBe('task-mode')
    expect(formerHelpGuideSlugs('task-mode')).toEqual(['farm-mode'])
  })

  it('a slug that was never renamed is itself, and an Object key is not a guide', () => {
    expect(currentHelpGuideSlug('task-mode')).toBe('task-mode')
    expect(currentHelpGuideSlug('pin-mode')).toBe('pin-mode')
    expect(currentHelpGuideSlug('constructor')).toBe('constructor')
    expect(formerHelpGuideSlugs('pin-mode')).toEqual([])
  })

  it('every old slug names a guide that exists', () => {
    const dead = HELP_GUIDE_FORMER_SLUGS.filter(([, current]) => !slugs.has(current)).map(([former, current]) => `${former} → ${current}`)
    expect(dead, 'an old slug points at a guide with no file in src/content/help').toEqual([])
  })

  it('no old slug is a guide of its own, is written twice or points at another old slug', () => {
    const formers = HELP_GUIDE_FORMER_SLUGS.map(([former]) => former)
    expect(formers.filter((f) => slugs.has(f)), 'a guide file has this name: its own page would win in one place and lose in another').toEqual([])
    expect(new Set(formers).size).toBe(formers.length)
    expect(HELP_GUIDE_FORMER_SLUGS.filter(([, current]) => formers.includes(current))).toEqual([])
  })
})
