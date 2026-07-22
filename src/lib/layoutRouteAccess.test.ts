import { describe, expect, it } from 'vitest'
import { isPathAllowedForRole } from './layoutRouteAccess'
import { ROLES } from './userRoles'

describe('isPathAllowedForRole', () => {
  // /help lives in duplicated allow-lists (Layout.tsx + layoutRouteAccess.ts);
  // this guards against forgetting a role when either copy changes.
  it('allows /help for every role', () => {
    for (const role of ROLES) {
      expect(isPathAllowedForRole(role, '/help', false), `role ${role}`).toBe(true)
      expect(isPathAllowedForRole(role, '/help', true), `role ${role} (prospects)`).toBe(true)
    }
  })

  it('allows /settings and /dashboard for every role', () => {
    for (const role of ROLES) {
      expect(isPathAllowedForRole(role, '/settings', false), `role ${role}`).toBe(true)
      expect(isPathAllowedForRole(role, '/dashboard', false), `role ${role}`).toBe(true)
    }
  })

  it('still restricts role-specific paths', () => {
    expect(isPathAllowedForRole('subcontractor', '/banking', false)).toBe(false)
    expect(isPathAllowedForRole('primary', '/schedule-dispatch', false)).toBe(false)
    expect(isPathAllowedForRole('superintendent', '/banking', false)).toBe(false)
    expect(isPathAllowedForRole('dev', '/banking', false)).toBe(true)
  })

  it('returns false for a null role', () => {
    expect(isPathAllowedForRole(null, '/help', false)).toBe(false)
  })
})

describe('job-mode tab paths (v2.911 fix: allowlists bounced field roles)', () => {
  const jobModePaths = ['/job-mode/schedule', '/job-mode/inbox', '/job-mode/customers']
  it('allowed for every Job-Mode-eligible restricted role', () => {
    for (const role of ['subcontractor', 'helpers', 'primary', 'superintendent', 'estimator'] as const) {
      for (const p of jobModePaths) {
        expect(isPathAllowedForRole(role, p, false), `${role} ${p}`).toBe(true)
      }
    }
  })
})
