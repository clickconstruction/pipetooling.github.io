import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { UserRole } from '../hooks/useAuth'
import {
  isJobModeEnabled,
  isJobModePhoneHomeRole,
  JOB_MODE_PHONE_HOME_ROLES,
  jobModeActiveSource,
  jobModeDefaultForRole,
  parseJobModeStoredValue,
  readJobModeCardDismissed,
  readJobModeEnabled,
  readJobModeStoredValue,
  showJobModeFirstRunCard,
  writeJobModeCardDismissed,
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

describe('showJobModeFirstRunCard', () => {
  it('shows only for master_technician and superintendent with nothing stored and not dismissed', () => {
    expect(showJobModeFirstRunCard('master_technician', null, false)).toBe(true)
    expect(showJobModeFirstRunCard('superintendent', null, false)).toBe(true)
  })

  it('never shows for sub-like roles (already on) or office roles', () => {
    for (const r of ['subcontractor', 'helpers', 'dev', 'assistant', 'controller', 'estimator', 'primary'] as UserRole[]) {
      expect(showJobModeFirstRunCard(r, null, false), r).toBe(false)
    }
    expect(showJobModeFirstRunCard(null, null, false)).toBe(false)
  })

  it('hides once the user has decided either way, or dismissed it', () => {
    expect(showJobModeFirstRunCard('master_technician', '1', false)).toBe(false)
    expect(showJobModeFirstRunCard('master_technician', 'card', false)).toBe(false)
    expect(showJobModeFirstRunCard('master_technician', '0', false)).toBe(false)
    expect(showJobModeFirstRunCard('master_technician', null, true)).toBe(false)
  })
})

/**
 * Job Mode as the phone's home (the new phone layout): a master technician and a superintendent with nothing
 * stored start in Job Mode on a phone, as a helper does. Every role, the switch off and on, every stored value.
 */
describe('the new phone layout: Job Mode is the phone’s home for the people who lead a job', () => {
  const PHONE_HOME: UserRole[] = ['master_technician', 'superintendent']
  const STORED = [null, '1', 'card', '0'] as const
  const OFF = { newPhoneLayout: false }
  const ON = { newPhoneLayout: true }

  it('names the two roles in one list', () => {
    expect([...JOB_MODE_PHONE_HOME_ROLES]).toEqual(PHONE_HOME)
    for (const r of ALL_ROLES) expect(isJobModePhoneHomeRole(r), r).toBe(PHONE_HOME.includes(r))
    expect(isJobModePhoneHomeRole(null)).toBe(false)
    expect(isJobModePhoneHomeRole('made_up_role')).toBe(false)
  })

  it('switch off: every role and every stored value answers as before the switch', () => {
    for (const r of ALL_ROLES) {
      expect(jobModeDefaultForRole(r, OFF), r).toBe(jobModeDefaultForRole(r))
      for (const stored of STORED) expect(isJobModeEnabled(r, stored, OFF), `${r} ${stored}`).toBe(isJobModeEnabled(r, stored))
    }
    // Spelled out, so the line above cannot hide a change to both sides.
    for (const r of ALL_ROLES) expect(isJobModeEnabled(r, null, OFF), r).toBe(SUB_LIKE.includes(r))
  })

  it('switch on, nothing stored: ON for the sub-like roles, a master technician and a superintendent, OFF for the rest', () => {
    const on: Record<string, boolean> = {}
    for (const r of ALL_ROLES) on[r] = isJobModeEnabled(r, null, ON)
    expect(on).toEqual({
      dev: false,
      master_technician: true,
      assistant: false,
      subcontractor: true,
      helpers: true,
      estimator: false,
      primary: false,
      superintendent: true,
      controller: false,
    })
    for (const r of ALL_ROLES) expect(jobModeDefaultForRole(r, ON), r).toBe(on[r])
  })

  it('switch on: a stored choice still wins for every role, off as well as on', () => {
    for (const r of ALL_ROLES) {
      expect(isJobModeEnabled(r, '0', ON), `${r} 0`).toBe(false)
      expect(isJobModeEnabled(r, '1', ON), `${r} 1`).toBe(true)
      expect(isJobModeEnabled(r, 'card', ON), `${r} card`).toBe(true)
    }
  })

  it('switch on: the whole table, role by stored value, differs from the switch off in two cells only', () => {
    const changed: string[] = []
    for (const r of ALL_ROLES) for (const stored of STORED) if (isJobModeEnabled(r, stored, ON) !== isJobModeEnabled(r, stored, OFF)) changed.push(`${r}:${stored}`)
    expect(changed).toEqual(['master_technician:null', 'superintendent:null'])
  })

  it('switch on: a role that cannot hold Job Mode, no role and a garbage value answer as before', () => {
    expect(isJobModeEnabled(null, null, ON)).toBe(false)
    expect(isJobModeEnabled(undefined, null, ON)).toBe(false)
    expect(isJobModeEnabled('made_up_role', null, ON)).toBe(false)
    expect(isJobModeEnabled('made_up_role', '1', ON)).toBe(false)
    expect(isJobModeEnabled('master_technician', 'yes', ON)).toBe(true)
    expect(isJobModeEnabled('dev', 'yes', ON)).toBe(false)
  })

  it('the first-run card is not drawn where Job Mode is already on', () => {
    for (const r of PHONE_HOME) {
      // Switch off: the card as before.
      expect(showJobModeFirstRunCard(r, null, false, OFF), r).toBe(true)
      // Switch on, nothing stored: Job Mode is on, so there is nothing to offer.
      expect(showJobModeFirstRunCard(r, null, false, ON), r).toBe(false)
      // A decision either way, or a dismissal, hides it with the switch off or on.
      for (const opts of [OFF, ON]) {
        expect(showJobModeFirstRunCard(r, '0', false, opts), r).toBe(false)
        expect(showJobModeFirstRunCard(r, '1', false, opts), r).toBe(false)
        expect(showJobModeFirstRunCard(r, 'card', false, opts), r).toBe(false)
        expect(showJobModeFirstRunCard(r, null, true, opts), r).toBe(false)
      }
    }
    // The roles that never had the card still never have it.
    for (const r of ALL_ROLES.filter((x) => !PHONE_HOME.includes(x))) {
      for (const opts of [OFF, ON]) expect(showJobModeFirstRunCard(r, null, false, opts), r).toBe(false)
    }
  })

  it('wherever the card would be drawn, Job Mode is off: the two never answer yes together', () => {
    for (const r of ALL_ROLES) for (const stored of STORED) for (const opts of [OFF, ON]) {
      if (showJobModeFirstRunCard(r, stored, false, opts)) expect(isJobModeEnabled(r, stored, opts), `${r} ${stored}`).toBe(false)
    }
  })

  it('an ON that nobody chose still reports as the default', () => {
    expect(jobModeActiveSource(null)).toBe('default')
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

  it('under the new phone layout a fresh master reads ON, and his stored off still reads OFF', () => {
    expect(readJobModeEnabled('u1', 'master_technician', { newPhoneLayout: true })).toBe(true)
    expect(readJobModeEnabled('u1', 'superintendent', { newPhoneLayout: true })).toBe(true)
    expect(readJobModeEnabled('u1', 'dev', { newPhoneLayout: true })).toBe(false)
    expect(readJobModeEnabled(null, 'master_technician', { newPhoneLayout: true })).toBe(false)
    writeJobModeEnabled('u1', false)
    expect(readJobModeEnabled('u1', 'master_technician', { newPhoneLayout: true })).toBe(false)
    expect(readJobModeEnabled('u1', 'superintendent', { newPhoneLayout: true })).toBe(false)
  })

  it('card dismissal is per user and sticky', () => {
    expect(readJobModeCardDismissed('u1')).toBe(false)
    writeJobModeCardDismissed('u1')
    expect(readJobModeCardDismissed('u1')).toBe(true)
    expect(readJobModeCardDismissed('u2')).toBe(false)
  })
})
