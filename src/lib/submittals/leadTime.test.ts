import { describe, expect, it } from 'vitest'

import { availabilityFor, describeLeadTime, LEAD_TIME_PRESETS, parseLeadTime, pickAnnotationPatch } from './leadTime'

describe('describeLeadTime', () => {
  it('reads stock, whole weeks, short day counts, and rounds long odd counts to weeks', () => {
    expect(describeLeadTime(0)).toBe('in stock')
    expect(describeLeadTime(7)).toBe('1 wk')
    expect(describeLeadTime(28)).toBe('4 wk')
    expect(describeLeadTime(10)).toBe('10 days')
    expect(describeLeadTime(1)).toBe('1 day')
    expect(describeLeadTime(45)).toBe('6 wk')
    expect(describeLeadTime(null)).toBeNull()
    expect(describeLeadTime(-3)).toBeNull()
  })
})

describe('parseLeadTime', () => {
  it('takes weeks by default, days when said, stock as zero, and refuses nonsense', () => {
    expect(parseLeadTime('2')).toBe(14)
    expect(parseLeadTime('2w')).toBe(14)
    expect(parseLeadTime('2 wk')).toBe(14)
    expect(parseLeadTime('4+ weeks')).toBe(28)
    expect(parseLeadTime('10d')).toBe(10)
    expect(parseLeadTime('10 days')).toBe(10)
    expect(parseLeadTime('45')).toBe(45)
    expect(parseLeadTime('stock')).toBe(0)
    expect(parseLeadTime('In Stock')).toBe(0)
    expect(parseLeadTime('0')).toBe(0)
    expect(parseLeadTime('')).toBeNull()
    expect(parseLeadTime('soon')).toBeNull()
    expect(parseLeadTime('999 weeks')).toBeNull()
  })

  it('round-trips every preset', () => {
    for (const p of LEAD_TIME_PRESETS) expect(parseLeadTime(`${p.days} days`)).toBe(p.days)
  })
})

describe('availabilityFor', () => {
  it('derives from the lead time, with a discontinued reason winning', () => {
    expect(availabilityFor(0, null)).toBe('in_stock')
    expect(availabilityFor(14, null)).toBe('lead_time')
    expect(availabilityFor(null, null)).toBe('unknown')
    expect(availabilityFor(14, 'discontinued')).toBe('discontinued')
    expect(availabilityFor(null, 'lead_time')).toBe('unknown')
  })
})

describe('pickAnnotationPatch', () => {
  it('writes the five columns, trimming the note and dropping an unknown availability', () => {
    expect(pickAnnotationPatch({ reasonKind: 'lead_time', reasonNote: '  spec model is 8 weeks out  ', leadTimeDays: 14, statusOverride: null })).toEqual({
      alternate_reason_kind: 'lead_time',
      alternate_reason_note: 'spec model is 8 weeks out',
      lead_time_days: 14,
      availability: 'lead_time',
      product_status_override: null,
    })
    expect(pickAnnotationPatch({ reasonKind: null, reasonNote: '', leadTimeDays: null, statusOverride: 'equal' })).toEqual({
      alternate_reason_kind: null,
      alternate_reason_note: null,
      lead_time_days: null,
      availability: null,
      product_status_override: 'equal',
    })
  })

  it('caps and rounds the days and never writes a negative one', () => {
    expect(pickAnnotationPatch({ reasonKind: null, reasonNote: null, leadTimeDays: 9000, statusOverride: null }).lead_time_days).toBe(730)
    expect(pickAnnotationPatch({ reasonKind: null, reasonNote: null, leadTimeDays: 2.6, statusOverride: null }).lead_time_days).toBe(3)
    expect(pickAnnotationPatch({ reasonKind: null, reasonNote: null, leadTimeDays: -1, statusOverride: null }).lead_time_days).toBeNull()
  })
})
