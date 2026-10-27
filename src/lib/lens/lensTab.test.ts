import { describe, expect, it } from 'vitest'
import type { LensAsk } from './answer/lensEngine'
import { parseLensName, formatLensName } from './lensName'
import { DEFAULT_KNOBS, askSummary, lensFrames, lensScreens, sweepWindow } from './lensTab'

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

describe('What everyone sees · the frames for the knobs', () => {
  it('draws six frames across widths and themes: phone, tablet and desk, light over dark', () => {
    const f = lensFrames(DEFAULT_KNOBS)
    expect(f.map((x) => `${x.width}:${x.config.theme}`)).toEqual(['phone:light', 'tablet:light', 'desk:light', 'phone:dark', 'tablet:dark', 'desk:dark'])
    expect(new Set(f.map((x) => x.key)).size).toBe(6)
    expect(f.every((x) => x.to === '/dashboard' && x.config.as === 'estimator' && x.config.mood === 'full')).toBe(true)
    expect(parseLensName(formatLensName(f[3]!.config))).toEqual({ as: 'estimator', mood: 'full', theme: 'dark' })
  })

  it('draws one screen as all nine roles, and says so where a role cannot open it', () => {
    const bids = lensScreens('estimator').find((s) => s.to.startsWith('/bids'))!
    const f = lensFrames({ ...DEFAULT_KNOBS, across: 'roles', where: bids.id })
    expect(f).toHaveLength(9)
    const helper = f.find((x) => x.config.as === 'helpers')!
    expect(helper.to).toBe('/dashboard')
    expect(helper.fallback).toBe('This role cannot open it, so here is their dashboard.')
    expect(f.find((x) => x.config.as === 'estimator')!.fallback).toBeUndefined()
  })

  it('draws one screen in all seven states', () => {
    const f = lensFrames({ ...DEFAULT_KNOBS, across: 'states', width: 'desk', theme: 'dark' })
    expect(f.map((x) => x.lead)).toEqual(['Full', 'Empty', 'Loading', 'Slow', 'Failing', 'Offline', 'Training mode'])
    expect(f.every((x) => x.width === 'desk' && x.config.theme === 'dark')).toBe(true)
  })
})

describe('What everyone sees · what a frame\'s asks add up to', () => {
  it('counts who answered and lists each gap once', () => {
    const a = (by: LensAsk['by'], kind: LensAsk['kind'], name: string): LensAsk => ({ kind, name, method: 'GET', by, status: 200 })
    const s = askSummary([a('world', 'table', 'jobs_ledger'), a('rule', 'table', 'bids'), a('missing', 'rpc', 'get_crew_day_payload'), a('missing', 'rpc', 'get_crew_day_payload'), a('unread', 'table', 'x'), a('mood', 'table', 'y')])
    expect(s).toMatchObject({ total: 6, world: 1, rule: 1, missing: 2, unread: 1, mood: 1, refused: 0 })
    expect(s.gaps).toEqual(['RPC get_crew_day_payload', 'table x'])
  })
})

describe('What everyone sees · every screen, and the sweep', () => {
  it('draws every screen the role can open once each, under the held state, width and theme', () => {
    const f = lensFrames({ ...DEFAULT_KNOBS, across: 'sheet', width: 'desk', theme: 'dark', mood: 'empty' })
    const tos = new Set(lensScreens('estimator').map((s) => s.to))
    expect(f).toHaveLength(tos.size)
    expect(new Set(f.map((x) => x.to)).size).toBe(f.length)
    expect(f.every((x) => x.width === 'desk' && x.config.theme === 'dark' && x.config.mood === 'empty')).toBe(true)
  })

  it('sweeps the first frames not checked yet, so each check makes room for the next', () => {
    const keys = ['a', 'b', 'c', 'd', 'e']
    expect(sweepWindow(keys, new Set(), 2)).toEqual(['a', 'b'])
    expect(sweepWindow(keys, new Set(['a']), 2)).toEqual(['b', 'c'])
    expect(sweepWindow(keys, new Set(['a', 'c']), 2)).toEqual(['b', 'd'])
    expect(sweepWindow(keys, new Set(keys), 2)).toEqual([])
  })
})
