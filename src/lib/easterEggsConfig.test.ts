import { describe, expect, it } from 'vitest'
import {
  EASTER_EGG_CATCH_DEFAULTS,
  EASTER_EGG_KNOBS,
  EASTER_EGG_TUNING_DEFAULTS,
  clampKnob,
  defaultEasterEggConfig,
  fleeScaleAtMinute,
  eggActiveFor,
  parseEasterEggsSetting,
  rollEggAppearance,
  serializeEasterEggsSetting,
} from './easterEggsConfig'

const wendi = 'user-wendi'
const followupTabs = ['t:/bids:builder-review', 't:/bids:submission-followup']
const cfg = { key: 'floaty', enabled: true, targetUserIds: [wendi], surfaces: followupTabs, tuning: { ...EASTER_EGG_TUNING_DEFAULTS }, catch: { ...EASTER_EGG_CATCH_DEFAULTS } }

describe('parseEasterEggsSetting', () => {
  it('round-trips a valid config', () => {
    expect(parseEasterEggsSetting(serializeEasterEggsSetting([cfg]))).toEqual([cfg])
  })

  it('migrates the legacy followup surface to the two tab keys', () => {
    const text = JSON.stringify({ eggs: [{ ...cfg, surfaces: ['followup'] }] })
    expect(parseEasterEggsSetting(text)).toEqual([{ ...cfg, surfaces: followupTabs }])
  })

  it('fills the v2.3282 tuning + catch blocks with defaults when a pre-v2.3282 row lacks them', () => {
    const legacy = JSON.stringify({ eggs: [{ key: 'floaty', enabled: true, targetUserIds: [wendi], surfaces: followupTabs }] })
    expect(parseEasterEggsSetting(legacy)).toEqual([cfg])
    expect(defaultEasterEggConfig('floaty')).toEqual({ ...cfg, enabled: false, targetUserIds: [], surfaces: [] })
  })

  it('keeps tuned knobs, clamps out-of-range ones to the slider range, and defaults garbage', () => {
    const text = JSON.stringify({
      eggs: [{ ...cfg, tuning: { oddsOneIn: 3, playSec: 999, fleeScale: 'fast' }, catch: { enabled: false, shots: 0, power: 12, gravity: -5, aimPreviewSec: 0.3, ringScale: 1.2, holdSec: null } }],
    })
    const [egg] = parseEasterEggsSetting(text)
    expect(egg!.tuning).toEqual({ oddsOneIn: 3, playSec: 30, fleeScale: EASTER_EGG_TUNING_DEFAULTS.fleeScale, fleeRampPerDay: EASTER_EGG_TUNING_DEFAULTS.fleeRampPerDay })
    expect(egg!.catch).toEqual({ enabled: false, shots: 1, power: 12, gravity: 600, aimPreviewSec: 0.3, ringScale: 1.2, holdSec: EASTER_EGG_CATCH_DEFAULTS.holdSec })
  })

  it('drops unknown egg keys and unknown surfaces, survives garbage', () => {
    const text = JSON.stringify({ eggs: [{ key: 'ghost', enabled: true }, { ...cfg, surfaces: ['p:/dashboard', 'mars'] }] })
    expect(parseEasterEggsSetting(text)).toEqual([{ ...cfg, surfaces: ['p:/dashboard'] }])
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

  it('page surfaces match anywhere on the page', () => {
    const pageCfg = { ...cfg, surfaces: ['p:/customers'] }
    expect(eggActiveFor(pageCfg, wendi, '/customers', null)).toBe(true)
    expect(eggActiveFor(pageCfg, wendi, '/customers/abc-123', null)).toBe(true)
    expect(eggActiveFor(pageCfg, wendi, '/bids', 'builder-review')).toBe(false)
  })
})

describe('clampKnob', () => {
  it('snaps to the knob step inside its range', () => {
    expect(clampKnob('power', 9.26, 9)).toBe(9.5)
    expect(clampKnob('ringScale', 0.5, 1)).toBe(0.7)
    expect(clampKnob('oddsOneIn', 15.4, 15)).toBe(15)
    expect(clampKnob('gravity', Number.NaN, 1500)).toBe(1500)
  })

  it('every knob default sits on its own grid', () => {
    for (const k of EASTER_EGG_KNOBS) {
      const d = k.group === 'tuning' ? EASTER_EGG_TUNING_DEFAULTS[k.key as keyof typeof EASTER_EGG_TUNING_DEFAULTS] : EASTER_EGG_CATCH_DEFAULTS[k.key as Exclude<keyof typeof EASTER_EGG_CATCH_DEFAULTS, 'enabled'>]
      expect(clampKnob(k.key, d, -1)).toBe(d)
    }
  })
})

describe('fleeScaleAtMinute — he gets faster through the day', () => {
  const t = { fleeScale: 0.7, fleeRampPerDay: 0.3 }
  it('is the base speed until 6am, ramps linearly to 6pm, then holds', () => {
    expect(fleeScaleAtMinute(t, 0)).toBeCloseTo(0.7)
    expect(fleeScaleAtMinute(t, 6 * 60)).toBeCloseTo(0.7)
    expect(fleeScaleAtMinute(t, 12 * 60)).toBeCloseTo(0.85)
    expect(fleeScaleAtMinute(t, 18 * 60)).toBeCloseTo(1.0)
    expect(fleeScaleAtMinute(t, 23 * 60)).toBeCloseTo(1.0)
  })
  it('a zero ramp is steady all day; the ceiling holds however the sliders sit', () => {
    expect(fleeScaleAtMinute({ fleeScale: 0.7, fleeRampPerDay: 0 }, 17 * 60)).toBeCloseTo(0.7)
    expect(fleeScaleAtMinute({ fleeScale: 1, fleeRampPerDay: 1 }, 18 * 60)).toBeCloseTo(1.8)
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

  it('takes per-egg odds (v2.3282)', () => {
    expect(rollEggAppearance('2026-08-22', '2026-08-22', () => 0.5, 1 / 2)).toEqual({ appear: false, isDailyDebut: false })
    expect(rollEggAppearance('2026-08-22', '2026-08-22', () => 0.4, 1 / 2)).toEqual({ appear: true, isDailyDebut: false })
    expect(rollEggAppearance('2026-08-22', '2026-08-22', () => 0.99, 1)).toEqual({ appear: true, isDailyDebut: false })
  })

  it('never debuts on an empty today (clock unavailable)', () => {
    expect(rollEggAppearance(null, '', () => 0.99).isDailyDebut).toBe(false)
  })
})
