import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildCourseRegistry } from '../training/courseContent'
import type { LensAsk } from './answer/lensEngine'
import { parseLensName, formatLensName } from './lensName'
import { LENS_ROLES } from './lensPeople'
import { DEFAULT_KNOBS, LENS_AUDIENCES, admittedFrames, askSummary, audienceScreens, lensFrames, lensReadsLessons, lensScreens, sweepWindow, type LensCourse } from './lensTab'

const TRAINING_DIR = join(__dirname, '../../content/training')

/** Every course on disk, keyed as courseRegistry's glob keys it, and built as the bundle builds it. */
function coursesOnDisk() {
  const raw: Record<string, string> = {}
  for (const slug of readdirSync(TRAINING_DIR).filter((f) => statSync(join(TRAINING_DIR, f)).isDirectory())) {
    for (const file of readdirSync(join(TRAINING_DIR, slug))) if (file.endsWith('.md')) raw[`../content/training/${slug}/${file}`] = readFileSync(join(TRAINING_DIR, slug, file), 'utf8')
  }
  return { raw, courses: buildCourseRegistry(raw) }
}

describe('What everyone sees · the screens a role can open', () => {
  it('reads the door index through the app\'s own gates, pages, windows and Settings cards only', () => {
    const dev = lensScreens('dev')
    const helper = lensScreens('helpers')
    expect(dev.length).toBeGreaterThan(helper.length)
    expect(dev.every((s) => s.kind === 'page' || s.kind === 'window' || s.kind === 'settings')).toBe(true)
    expect(helper.some((s) => s.id === 'page:/dashboard')).toBe(true)
    expect(helper.some((s) => s.to.startsWith('/bids'))).toBe(false)
  })
})

describe('What everyone sees · the training lessons', () => {
  const pipes: LensCourse[] = [
    {
      slug: 'pipes',
      title: 'Pipes',
      lessons: [
        { key: '01-in', order: 1, title: 'In', mustKnow: ['Water comes in under pressure.', '{{figure:two-systems|In under pressure, out by gravity.}}'], traps: [] },
        { key: '02-words', order: 2, title: 'Words', mustKnow: ['Only words here.'], traps: ['A trap in words.'] },
        { key: '03-out', order: 3, title: 'Out', mustKnow: [], traps: ['{{figure:p-trap-seal|The seal keeps the gas out.}}'] },
      ],
    },
  ]

  it('ends the dev\'s screens with each lesson that draws a figure, at its own door, and no other role\'s', () => {
    const dev = lensScreens('dev', { courses: pipes })
    expect(dev.slice(-2)).toEqual([
      { id: 'lesson:pipes/01-in', label: 'Pipes · Lesson 1 · In', where: 'Training', to: '/training/pipes?lesson=01-in', kind: 'lesson' },
      { id: 'lesson:pipes/03-out', label: 'Pipes · Lesson 3 · Out', where: 'Training', to: '/training/pipes?lesson=03-out', kind: 'lesson' },
    ])
    expect(dev.filter((s) => s.kind === 'lesson')).toHaveLength(2)
    expect(lensReadsLessons('dev')).toBe(true)
    for (const r of LENS_ROLES.filter((x) => x !== 'dev')) {
      expect(lensReadsLessons(r), r).toBe(false)
      expect(lensScreens(r, { courses: pipes }).some((s) => s.kind === 'lesson'), r).toBe(false)
    }
    // Before the courses load, the dev's list is the door index alone.
    expect(lensScreens('dev').some((s) => s.kind === 'lesson')).toBe(false)
  })

  it('draws them across Every screen as the dev, and a role that cannot read one draws its dashboard', () => {
    const sheet = lensFrames({ ...DEFAULT_KNOBS, as: 'dev', across: 'sheet', width: 'desk' }, { courses: pipes })
    expect(sheet.slice(-2).map((f) => [f.lead, f.to])).toEqual([
      ['Pipes · Lesson 1 · In', '/training/pipes?lesson=01-in'],
      ['Pipes · Lesson 3 · Out', '/training/pipes?lesson=03-out'],
    ])
    const roles = lensFrames({ ...DEFAULT_KNOBS, across: 'roles', where: 'lesson:pipes/01-in' }, { courses: pipes })
    expect(roles.find((f) => f.config!.as === 'dev')!.to).toBe('/training/pipes?lesson=01-in')
    expect(roles.find((f) => f.config!.as === 'helpers')!.fallback).toBe('This role cannot open it, so here is their dashboard.')
  })

  it('lists every lesson on disk that carries a figure line, once each', () => {
    const { raw, courses } = coursesOnDisk()
    const carrying = Object.entries(raw)
      .filter(([path, text]) => /\/\d\d-[^/]+\.md$/.test(path) && /^- \{\{figure:/m.test(text))
      .map(([path]) => path.replace(/^\.\.\/content(\/training\/[^/]+)\/([^/]+)\.md$/, '$1?lesson=$2'))
      .sort()
    const listed = lensScreens('dev', { courses }).filter((s) => s.kind === 'lesson').map((s) => s.to)
    expect([...listed].sort()).toEqual(carrying)
    expect(listed.length).toBeGreaterThan(80)
  })
})

describe('What everyone sees · the frames for the knobs', () => {
  it('draws six frames across widths and themes: phone, tablet and desk, light over dark', () => {
    const f = lensFrames(DEFAULT_KNOBS)
    expect(f.map((x) => `${x.width}:${x.config!.theme}`)).toEqual(['phone:light', 'tablet:light', 'desk:light', 'phone:dark', 'tablet:dark', 'desk:dark'])
    expect(new Set(f.map((x) => x.key)).size).toBe(6)
    expect(f.every((x) => x.to === '/dashboard' && x.config!.as === 'estimator' && x.config!.mood === 'full')).toBe(true)
    expect(parseLensName(formatLensName(f[3]!.config!))).toEqual({ as: 'estimator', mood: 'full', theme: 'dark' })
  })

  it('draws one screen as all nine roles, and says so where a role cannot open it', () => {
    const bids = lensScreens('estimator').find((s) => s.to.startsWith('/bids'))!
    const f = lensFrames({ ...DEFAULT_KNOBS, across: 'roles', where: bids.id })
    expect(f).toHaveLength(9)
    const helper = f.find((x) => x.config!.as === 'helpers')!
    expect(helper.to).toBe('/dashboard')
    expect(helper.fallback).toBe('This role cannot open it, so here is their dashboard.')
    expect(f.find((x) => x.config!.as === 'estimator')!.fallback).toBeUndefined()
  })

  it('draws one screen in all seven states', () => {
    const f = lensFrames({ ...DEFAULT_KNOBS, across: 'states', width: 'desk', theme: 'dark' })
    expect(f.map((x) => x.lead)).toEqual(['Full', 'Empty', 'Loading', 'Slow', 'Failing', 'Offline', 'Training mode'])
    expect(f.every((x) => x.width === 'desk' && x.config!.theme === 'dark')).toBe(true)
  })
})

describe('What everyone sees · what a frame\'s asks add up to', () => {
  it('counts who answered and lists each gap once', () => {
    const a = (by: LensAsk['by'], kind: LensAsk['kind'], name: string): LensAsk => ({ kind, name, method: 'GET', by, status: 200 })
    const s = askSummary([a('world', 'table', 'jobs_ledger'), a('rule', 'table', 'bids'), a('missing', 'rpc', 'get_crew_day_payload'), a('missing', 'rpc', 'get_crew_day_payload'), a('unread', 'table', 'x'), a('mood', 'table', 'y'), a('network', 'function', 'customer-portal')])
    expect(s).toMatchObject({ total: 7, world: 1, rule: 1, missing: 2, unread: 1, mood: 1, refused: 0, network: 1 })
    expect(s.gaps).toEqual(['RPC get_crew_day_payload', 'table x'])
  })
})

describe('What everyone sees · every screen, and the sweep', () => {
  it('draws every screen the role can open once each, under the held state, width and theme', () => {
    const f = lensFrames({ ...DEFAULT_KNOBS, across: 'sheet', width: 'desk', theme: 'dark', mood: 'empty' })
    const tos = new Set(lensScreens('estimator').map((s) => s.to))
    expect(f).toHaveLength(tos.size)
    expect(new Set(f.map((x) => x.to)).size).toBe(f.length)
    expect(f.every((x) => x.width === 'desk' && x.config!.theme === 'dark' && x.config!.mood === 'empty')).toBe(true)
  })

  it('sweeps the first frames not checked yet, so each check makes room for the next', () => {
    const keys = ['a', 'b', 'c', 'd', 'e']
    expect(sweepWindow(keys, new Set(), 2)).toEqual(['a', 'b'])
    expect(sweepWindow(keys, new Set(['a']), 2)).toEqual(['b', 'c'])
    expect(sweepWindow(keys, new Set(['a', 'c']), 2)).toEqual(['b', 'd'])
    expect(sweepWindow(keys, new Set(keys), 2)).toEqual([])
  })
})

describe('What everyone sees · frames load one after another', () => {
  it('lets in each loaded frame and the first one still to load, so one fetch of the app goes first', () => {
    const live = ['a', 'b', 'c', 'd']
    expect(admittedFrames(live, new Set())).toEqual(['a'])
    expect(admittedFrames(live, new Set(['a']))).toEqual(['a', 'b'])
    expect(admittedFrames(live, new Set(['a', 'b', 'c', 'd']))).toEqual(live)
  })

  it('keeps a frame that loaded earlier drawn when a new one joins ahead of it', () => {
    expect(admittedFrames(['x', 'a', 'b'], new Set(['a', 'b']))).toEqual(['x', 'a', 'b'])
    expect(admittedFrames(['a', 'x', 'b', 'y'], new Set(['a', 'b']))).toEqual(['a', 'x', 'b'])
    expect(admittedFrames([], new Set(['a']))).toEqual([])
  })
})

describe('What everyone sees · the customer\'s side', () => {
  it('lists What customers see\'s audiences, and each one\'s pages on this origin by their sample tokens', () => {
    expect(LENS_AUDIENCES.map((a) => a.id)).toEqual(['homeowner', 'gc', 'sub', 'house', 'firm'])
    const pages = audienceScreens('homeowner')
    expect(pages.length).toBeGreaterThan(3)
    expect(pages.every((p) => p.to.startsWith('/') && /[?&/]t?=?sample|sample/.test(p.to))).toBe(true)
    expect(pages.some((p) => p.to === '/rate?t=sample')).toBe(true)
  })

  it('draws a customer page unsealed, light only, at the three widths, or every page across Every screen', () => {
    const rate = audienceScreens('homeowner').find((p) => p.to === '/rate?t=sample')!
    const f = lensFrames({ ...DEFAULT_KNOBS, audience: 'homeowner', where: rate.id })
    expect(f.map((x) => x.width)).toEqual(['phone', 'tablet', 'desk'])
    expect(f.every((x) => x.config === null && x.to === '/rate?t=sample')).toBe(true)
    const sheet = lensFrames({ ...DEFAULT_KNOBS, audience: 'gc', across: 'sheet', width: 'desk' })
    expect(sheet).toHaveLength(audienceScreens('gc').length)
    expect(sheet.every((x) => x.config === null && x.width === 'desk')).toBe(true)
  })
})
