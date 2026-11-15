import { describe, expect, it } from 'vitest'
import { buildHurdle, clearsHurdle, hurdleWords, parseHurdleSetting, serializeHurdleSetting, DEFAULT_HURDLE_SETTING, HURDLE_TARGET_WORDS, canSetHurdleTarget, hurdleTargetFromText } from './hurdle'

describe('hurdle', () => {
  it('break-even is overhead over paid field hours; the hurdle adds the target', () => {
    const h = buildHurdle({ overheadUsd: 60_000, paidFieldHours: 2_000, windowDays: 56, setting: { targetProfitPerHourUsd: 25 } })
    expect(h.breakEvenPerHourUsd).toBe(30)
    expect(h.hurdlePerHourUsd).toBe(55)
    expect(hurdleWords(h)).toBe('Break-even is $30/h: $60,000 of overhead over 2,000 paid field hours in 56 days. The hurdle adds the $25/h target.')
    expect(clearsHurdle(55, h)).toBe(true)
    expect(clearsHurdle(54.99, h)).toBe(false)
  })

  it('no paid hours: no break-even, no hurdle, and nothing clears or fails', () => {
    const h = buildHurdle({ overheadUsd: 60_000, paidFieldHours: 0, windowDays: 28, setting: DEFAULT_HURDLE_SETTING })
    expect(h.breakEvenPerHourUsd).toBeNull()
    expect(h.hurdlePerHourUsd).toBeNull()
    expect(clearsHurdle(100, h)).toBeNull()
    expect(hurdleWords(h)).toContain('No paid field hours in the last 28 days')
  })

  it('the setting round-trips and a bad value falls back to the default', () => {
    expect(parseHurdleSetting(serializeHurdleSetting({ targetProfitPerHourUsd: 40 }))).toEqual({ targetProfitPerHourUsd: 40 })
    expect(parseHurdleSetting('{"targetProfitPerHourUsd":-3}')).toEqual(DEFAULT_HURDLE_SETTING)
    expect(parseHurdleSetting('not json')).toEqual(DEFAULT_HURDLE_SETTING)
    expect(parseHurdleSetting(null)).toEqual(DEFAULT_HURDLE_SETTING)
  })

  it('the owner and a dev set the target, and a typed target is dollars from 0 to 1,000 (PR 3)', () => {
    expect(['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'subcontractor', null].filter((r) => canSetHurdleTarget(r))).toEqual(['dev', 'master_technician'])
    expect(hurdleTargetFromText('30')).toEqual({ setting: { targetProfitPerHourUsd: 30 } })
    expect(hurdleTargetFromText('27.456')).toEqual({ setting: { targetProfitPerHourUsd: 27.46 } })
    expect(hurdleTargetFromText('0')).toEqual({ setting: { targetProfitPerHourUsd: 0 } })
    for (const bad of ['', ' ', '-1', '1001', 'abc']) expect('problem' in hurdleTargetFromText(bad)).toBe(true)
    expect(HURDLE_TARGET_WORDS.saved({ targetProfitPerHourUsd: 30 })).toBe('The score’s target is $30/h.')
  })
})
