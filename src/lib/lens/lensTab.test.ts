import { describe, expect, it } from 'vitest'
import type { LensAsk } from './answer/lensEngine'
import { parseLensName, formatLensName } from './lensName'
import { DEFAULT_KNOBS, LENS_AUDIENCES, admittedFrames, askSummary, audienceScreens, lensFrames, lensScreens, sweepWindow } from './lensTab'

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
