import { describe, expect, it } from 'vitest'
import {
  breakdownJumpDomId,
  breakdownJumpMissMessage,
  countsRowDomId,
  laborRowDomId,
  normalizeFixtureKey,
  takeoffRowDomId,
} from './bidTabRowJump'

describe('normalizeFixtureKey', () => {
  it('trims and lowercases — the same key the breakdown uses to find the labor row', () => {
    expect(normalizeFixtureKey('  3IN 90 WASTE ')).toBe('3in 90 waste')
    expect(normalizeFixtureKey(null)).toBe('')
    expect(normalizeFixtureKey(undefined)).toBe('')
  })
})

describe('dom ids', () => {
  it('counts and takeoffs key by count row id', () => {
    expect(countsRowDomId('abc-123')).toBe('counts-row-abc-123')
    expect(takeoffRowDomId('abc-123')).toBe('takeoff-row-abc-123')
  })

  it('labor keys by encoded fixture name — names with spaces and quotes stay valid ids', () => {
    expect(laborRowDomId('3IN 90 WASTE')).toBe('labor-hours-row-3in%2090%20waste')
    expect(laborRowDomId('2" PEX')).toBe(`labor-hours-row-${encodeURIComponent('2" pex')}`)
  })

  it('two different names never collide (encoding is injective)', () => {
    expect(laborRowDomId('a b')).not.toBe(laborRowDomId('a  b'))
  })

  it('breakdownJumpDomId routes by tab', () => {
    expect(breakdownJumpDomId({ tab: 'counts', countRowId: 'x', fixture: 'F' })).toBe('counts-row-x')
    expect(breakdownJumpDomId({ tab: 'takeoffs', countRowId: 'x', fixture: 'F' })).toBe('takeoff-row-x')
    expect(breakdownJumpDomId({ tab: 'labor', countRowId: 'x', fixture: 'WCO' })).toBe('labor-hours-row-wco')
  })
})

describe('breakdownJumpMissMessage', () => {
  it('names the fixture per tab', () => {
    expect(breakdownJumpMissMessage('labor', 'WCO')).toBe('No labor row for “WCO” yet — add one below.')
    expect(breakdownJumpMissMessage('takeoffs', 'WCO')).toBe('No takeoff row for “WCO” on this version yet.')
    expect(breakdownJumpMissMessage('counts', 'WCO')).toBe('“WCO” isn’t on this version’s Counts.')
  })

  it('falls back when the fixture is blank', () => {
    expect(breakdownJumpMissMessage('labor', '  ')).toContain('this fixture')
  })
})
