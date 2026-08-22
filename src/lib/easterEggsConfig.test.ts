import { describe, expect, it } from 'vitest'
import { eggActiveFor, parseEasterEggsSetting, rollEggAppearance, serializeEasterEggsSetting } from './easterEggsConfig'

const wendi = 'user-wendi'
const cfg = { key: 'floaty', enabled: true, targetUserIds: [wendi], surfaces: ['followup'] }

describe('parseEasterEggsSetting', () => {
  it('round-trips a valid config', () => {
    expect(parseEasterEggsSetting(serializeEasterEggsSetting([cfg]))).toEqual([cfg])
  })

  it('drops unknown egg keys and unknown surfaces, survives garbage', () => {
    const text = JSON.stringify({ eggs: [{ key: 'ghost', enabled: true }, { ...cfg, surfaces: ['followup', 'mars'] }] })
    expect(parseEasterEggsSetting(text)).toEqual([{ ...cfg, surfaces: ['followup'] }])
    expect(parseEasterEggsSetting('not json')).toEqual([])
    expect(parseEasterEggsSetting(null)).toEqual([])
    expect(parseEasterEggsSetting('')).toEqual([])
  })
})

describe('eggActiveFor', () => {
  it('requires enabled + targeted user + matching surface', () => {
    expect(eggActiveFor(cfg, wendi, '/bids', 'builder-review')).toBe(true)
    expect(eggActiveFor(cfg, wendi, '/bids', 'submission-followup')).toBe(true)
    expect(eggActiveFor(cfg, wendi, '/bids', 'bid-board')).toBe(false)
    expect(eggActiveFor(cfg, wendi, '/jobs', 'builder-review')).toBe(false)
    expect(eggActiveFor(cfg, 'someone-else', '/bids', 'builder-review')).toBe(false)
    expect(eggActiveFor({ ...cfg, enabled: false }, wendi, '/bids', 'builder-review')).toBe(false)
    expect(eggActiveFor(cfg, null, '/bids', 'builder-review')).toBe(false)
  })
})

describe('rollEggAppearance', () => {
  it('guarantees the first open of a new company day', () => {
    expect(rollEggAppearance(null, '2026-08-22', () => 0.99)).toEqual({ appear: true, isDailyDebut: true })
    expect(rollEggAppearance('2026-08-21', '2026-08-22', () => 0.99)).toEqual({ appear: true, isDailyDebut: true })
  })

  it('rolls the 1-in-15 dice after the daily debut', () => {
    expect(rollEggAppearance('2026-08-22', '2026-08-22', () => 0.5)).toEqual({ appear: false, isDailyDebut: false })
    expect(rollEggAppearance('2026-08-22', '2026-08-22', () => 0.001)).toEqual({ appear: true, isDailyDebut: false })
  })

  it('never debuts on an empty today (clock unavailable)', () => {
    expect(rollEggAppearance(null, '', () => 0.99).isDailyDebut).toBe(false)
  })
})
