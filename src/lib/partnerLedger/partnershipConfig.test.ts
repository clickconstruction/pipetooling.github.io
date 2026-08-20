import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PARTNERSHIP_MODULES,
  buildConfigPatch,
  normalizeModules,
  validatePartnershipConfig,
  type PartnershipConfig,
} from './partnershipConfig'

const baseConfig = (): PartnershipConfig => ({
  status: 'active',
  started_on: '2026-06-01',
  field_rate: 50,
  estimating_rate: 35,
  farm_rate: 0,
  company_first_pct: 22,
  partner_remainder_pct: 50,
  utilities_allowance: 200,
  modules: { ...DEFAULT_PARTNERSHIP_MODULES },
})

describe('normalizeModules', () => {
  it('returns defaults for null/undefined/garbage', () => {
    expect(normalizeModules(null)).toEqual(DEFAULT_PARTNERSHIP_MODULES)
    expect(normalizeModules(undefined)).toEqual(DEFAULT_PARTNERSHIP_MODULES)
    expect(normalizeModules('nope')).toEqual(DEFAULT_PARTNERSHIP_MODULES)
    expect(normalizeModules([true])).toEqual(DEFAULT_PARTNERSHIP_MODULES)
  })

  it('keeps valid booleans and fills missing keys (additive evolution)', () => {
    const out = normalizeModules({ costing: false, cap: true })
    expect(out.costing).toBe(false)
    expect(out.cap).toBe(true)
    expect(out.profit_shares).toBe(true)
    expect(out.auto_notice).toBe(false)
  })

  it('drops non-boolean values back to defaults and ignores unknown keys', () => {
    const out = normalizeModules({ costing: 'yes', bogus: true })
    expect(out.costing).toBe(true)
    expect('bogus' in out).toBe(false)
  })

  it('auto_notice, cap, w2 default off', () => {
    const out = normalizeModules({})
    expect(out.auto_notice).toBe(false)
    expect(out.cap).toBe(false)
    expect(out.w2).toBe(false)
  })
})

describe('validatePartnershipConfig', () => {
  it('accepts the Bryan defaults', () => {
    expect(validatePartnershipConfig(baseConfig())).toEqual([])
  })

  it('rejects negative money and out-of-range percentages', () => {
    const cfg = baseConfig()
    cfg.field_rate = -1
    cfg.company_first_pct = 101
    const errors = validatePartnershipConfig(cfg)
    expect(errors.some((e) => e.includes('Field rate'))).toBe(true)
    expect(errors.some((e) => e.includes('Company first cut'))).toBe(true)
  })

  it('rejects NaN rates and unknown statuses', () => {
    const cfg = baseConfig()
    cfg.estimating_rate = Number.NaN
    cfg.status = 'zombie'
    const errors = validatePartnershipConfig(cfg)
    expect(errors.some((e) => e.includes('Estimating rate'))).toBe(true)
    expect(errors.some((e) => e.includes('Status'))).toBe(true)
  })
})

describe('buildConfigPatch', () => {
  it('returns empty patch when nothing changed', () => {
    expect(buildConfigPatch(baseConfig(), baseConfig())).toEqual({})
  })

  it('records scalar changes with from/to', () => {
    const before = baseConfig()
    const after = { ...baseConfig(), field_rate: 55, status: 'paused' }
    const patch = buildConfigPatch(before, after)
    expect(patch.field_rate).toEqual({ from: 50, to: 55 })
    expect(patch.status).toEqual({ from: 'active', to: 'paused' })
    expect(Object.keys(patch)).toHaveLength(2)
  })

  it('records module flips under a modules. prefix', () => {
    const before = baseConfig()
    const after = baseConfig()
    after.modules = { ...after.modules, costing: false, cap: true }
    const patch = buildConfigPatch(before, after)
    expect(patch['modules.costing']).toEqual({ from: true, to: false })
    expect(patch['modules.cap']).toEqual({ from: false, to: true })
    expect(Object.keys(patch)).toHaveLength(2)
  })
})
