import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { UserRole } from '../hooks/useAuth'
import {
  isJobModeEnabled,
  jobModeActiveSource,
  jobModeDefaultForRole,
  parseJobModeStoredValue,
  readJobModeEnabled,
  readJobModeStoredValue,
  writeJobModeEnabled,
} from './jobModeToggle'

const ALL_ROLES: UserRole[] = [
  'dev',
  'master_technician',
  'assistant',
  'subcontractor',
  'helpers',
  'estimator',
  'primary',
  'superintendent',
  'controller',
]
const SUB_LIKE: UserRole[] = ['subcontractor', 'helpers']
const OFFICE_DEFAULT_OFF: UserRole[] = ALL_ROLES.filter((r) => !SUB_LIKE.includes(r))

describe('jobModeDefaultForRole', () => {
  it('is ON only for the sub-like roles', () => {
    for (const r of SUB_LIKE) expect(jobModeDefaultForRole(r), r).toBe(true)
    for (const r of OFFICE_DEFAULT_OFF) expect(jobModeDefaultForRole(r), r).toBe(false)
    expect(jobModeDefaultForRole(null)).toBe(false)
    expect(jobModeDefaultForRole(undefined)).toBe(false)
    expect(jobModeDefaultForRole('made_up_role')).toBe(false)
  })
})

describe('isJobModeEnabled — role × stored matrix', () => {
  it('absent key ⇒ ON for helpers and subcontractors, OFF for every other role', () => {
    for (const r of SUB_LIKE) expect(isJobModeEnabled(r, null), `${r} absent`).toBe(true)
    for (const r of OFFICE_DEFAULT_OFF) expect(isJobModeEnabled(r, null), `${r} absent`).toBe(false)
  })

  it('absent key ⇒ OFF for no role / unknown role', () => {
    expect(isJobModeEnabled(null, null)).toBe(false)
    expect(isJobModeEnabled(undefined, null)).toBe(false)
    expect(isJobModeEnabled('made_up_role', null)).toBe(false)
  })

  it("explicit '0' wins over the sub-like default (the tech can turn it off)", () => {
    for (const r of SUB_LIKE) expect(isJobModeEnabled(r, '0'), r).toBe(false)
    for (const r of OFFICE_DEFAULT_OFF) expect(isJobModeEnabled(r, '0'), r).toBe(false)
  })

  it("explicit '1' (gear) or 'card' turns it on for every eligible role", () => {
    for (const r of ALL_ROLES) {
      expect(isJobModeEnabled(r, '1'), `${r} '1'`).toBe(true)
      expect(isJobModeEnabled(r, 'card'), `${r} card`).toBe(true)
    }
  })

  it('an ineligible role reads OFF even with a stale on-value on the device', () => {
    expect(isJobModeEnabled('made_up_role', '1')).toBe(false)
    expect(isJobModeEnabled(null, '1')).toBe(false)
  })

  it('garbage stored values fall back to the role default', () => {
    expect(isJobModeEnabled('helpers', 'yes')).toBe(true)
    expect(isJobModeEnabled('dev', 'yes')).toBe(false)
    expect(parseJobModeStoredValue('true')).toBeNull()
    expect(parseJobModeStoredValue(undefined)).toBeNull()
  })
})

describe('jobModeActiveSource', () => {
  it('maps the stored provenance to the telemetry source', () => {
    expect(jobModeActiveSource(null)).toBe('default')
    expect(jobModeActiveSource('0')).toBe('default')
    expect(jobModeActiveSource('1')).toBe('gear')
    expect(jobModeActiveSource('card')).toBe('card')
  })
})

describe('storage round-trips (fake localStorage)', () => {
  const store = new Map<string, string>()
  const fake = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  }
  let prev: unknown

  beforeEach(() => {
    store.clear()
    prev = (globalThis as Record<string, unknown>).localStorage
    ;(globalThis as Record<string, unknown>).localStorage = fake
  })
  afterEach(() => {
    ;(globalThis as Record<string, unknown>).localStorage = prev
  })

  it('a fresh helper reads ON, a fresh master reads OFF, no user reads OFF', () => {
    expect(readJobModeStoredValue('u1')).toBeNull()
    expect(readJobModeEnabled('u1', 'helpers')).toBe(true)
    expect(readJobModeEnabled('u1', 'master_technician')).toBe(false)
    expect(readJobModeEnabled(null, 'helpers')).toBe(false)
  })

  it("turning off stores '0' (not a removal) so the helper's choice survives the default", () => {
    writeJobModeEnabled('u1', false)
    expect(readJobModeStoredValue('u1')).toBe('0')
    expect(readJobModeEnabled('u1', 'helpers')).toBe(false)
  })

  it('turning on records the door it came through', () => {
    writeJobModeEnabled('u1', true)
    expect(readJobModeStoredValue('u1')).toBe('1')
    expect(jobModeActiveSource(readJobModeStoredValue('u1'))).toBe('gear')
    writeJobModeEnabled('u1', true, 'card')
    expect(readJobModeStoredValue('u1')).toBe('card')
    expect(readJobModeEnabled('u1', 'master_technician')).toBe(true)
  })

  it('keys are per user — a shared phone does not leak the toggle', () => {
    writeJobModeEnabled('u1', false)
    expect(readJobModeEnabled('u2', 'helpers')).toBe(true)
  })

  it('the mode row turns it on as the gear menu does, and a device that stored the old card value still reads on', () => {
    writeJobModeEnabled('u1', true, 'row')
    expect(readJobModeStoredValue('u1')).toBe('1')
    writeJobModeEnabled('u2', true, 'card')
    expect(readJobModeStoredValue('u2')).toBe('card')
    expect(readJobModeEnabled('u2', 'master_technician')).toBe(true)
  })
})
