import { describe, expect, it } from 'vitest'
import { DEV_LOGIN_NOT_FOR_THEM, devLoginMayMint } from '../../supabase/functions/_shared/devLoginGate'

describe('whom dev-login signs in (v2.6639, v2.6652)', () => {
  it('opens a dev, a digital twin and the walk tester, and no one else', () => {
    expect(devLoginMayMint({ role: 'dev', is_digital_twin: false })).toBe(true)
    expect(devLoginMayMint({ role: 'estimator', is_digital_twin: true })).toBe(true)
    expect(devLoginMayMint({ role: 'assistant', is_digital_twin: false, is_walk_tester: true })).toBe(true)
    expect(devLoginMayMint({ role: 'assistant', is_digital_twin: false })).toBe(false)
    expect(devLoginMayMint({ role: 'assistant', is_digital_twin: false, is_walk_tester: false })).toBe(false)
    expect(devLoginMayMint({ role: 'assistant', is_digital_twin: null, is_walk_tester: null })).toBe(false)
    expect(devLoginMayMint({ role: 'master_technician', is_digital_twin: null })).toBe(false)
    expect(devLoginMayMint({ role: null, is_digital_twin: null })).toBe(false)
    expect(devLoginMayMint(null)).toBe(false)
    expect(devLoginMayMint(undefined)).toBe(false)
  })

  it('names the door that opens anyone else', () => {
    expect(DEV_LOGIN_NOT_FOR_THEM).toContain('the walk tester')
    expect(DEV_LOGIN_NOT_FOR_THEM).toContain('View as')
    expect(DEV_LOGIN_NOT_FOR_THEM).toContain('My email')
  })
})
