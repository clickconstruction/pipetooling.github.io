import { describe, expect, it } from 'vitest'
import { showAiaG702G703 } from './aiaG702G703Eligibility'

describe('showAiaG702G703', () => {
  it('returns false for disallowed roles even when job is billed', () => {
    expect(
      showAiaG702G703('subcontractor', { status: 'billed' }, { status: 'billed' }),
    ).toBe(false)
  })

  it('returns false for allowed role when job is working and no invoice is passed', () => {
    expect(showAiaG702G703('dev', { status: 'working' })).toBe(false)
    expect(showAiaG702G703('dev', { status: 'working' }, undefined)).toBe(false)
  })

  it('returns true for allowed role when job is working but invoice is ready_to_bill', () => {
    expect(
      showAiaG702G703('primary', { status: 'working' }, { status: 'ready_to_bill' }),
    ).toBe(true)
  })

  it('returns true for allowed role when job is billed', () => {
    expect(showAiaG702G703('assistant', { status: 'billed' })).toBe(true)
    expect(
      showAiaG702G703('master_technician', { status: 'billed' }, { status: 'working' }),
    ).toBe(true)
  })
})
