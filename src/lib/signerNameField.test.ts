import { describe, expect, it } from 'vitest'
import { resolveSignerName } from './signerNameField'

describe('resolveSignerName', () => {
  it('takes the box over the state when they differ (AutoFill wrote without an event)', () => {
    expect(resolveSignerName('', 'Kimberly Coe')).toEqual({ name: 'Kimberly Coe', drifted: true })
  })
  it('trims, and reports no drift when the box and the state agree', () => {
    expect(resolveSignerName('  Dana Ruiz ', '  Dana Ruiz ')).toEqual({ name: 'Dana Ruiz', drifted: false })
  })
  it('falls back to the state when there is no box (unmounted ref)', () => {
    expect(resolveSignerName('Behar', null)).toEqual({ name: 'Behar', drifted: false })
    expect(resolveSignerName('Behar', undefined)).toEqual({ name: 'Behar', drifted: false })
  })
  it('an empty box over a stale state is empty — the state was wiped on purpose', () => {
    expect(resolveSignerName('Old Name', '')).toEqual({ name: '', drifted: true })
  })
})
