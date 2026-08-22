import { describe, expect, it } from 'vitest'
import { eggActiveFor, parseEasterEggsSetting, serializeEasterEggsSetting } from './easterEggsConfig'

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
