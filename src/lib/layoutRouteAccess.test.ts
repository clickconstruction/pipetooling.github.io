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

describe('deep links into allowed roots (v2.2325: allowlists were exact-match and bounced subpaths)', () => {
  it('allows subpaths under an allowed root', () => {
    expect(isPathAllowedForRole('superintendent', '/estimates/123', false)).toBe(true)
    expect(isPathAllowedForRole('superintendent', '/workflows/abc', false)).toBe(true)
    expect(isPathAllowedForRole('primary', '/estimates/123', false)).toBe(true)
    // v2.2836: primaries lost /workflows — the steps SELECT policy has no primary branch, so the
    // page was always "No steps assigned to you"; Layout now redirects like it does for /projects.
    expect(isPathAllowedForRole('primary', '/workflows/abc', false)).toBe(false)
    expect(isPathAllowedForRole('primary', '/workflows', false)).toBe(false)
    expect(isPathAllowedForRole('subcontractor', '/checklist/', false)).toBe(true)
    expect(isPathAllowedForRole('helpers', '/my-statement/weekly', false)).toBe(true)
  })

  it('the "/" entry only matches itself — it must not allow everything', () => {
    expect(isPathAllowedForRole('subcontractor', '/', false)).toBe(true)
    expect(isPathAllowedForRole('subcontractor', '/banking', false)).toBe(false)
    expect(isPathAllowedForRole('subcontractor', '/estimates/123', false)).toBe(false)
  })

  it('a subpath does not unlock a different root by prefix accident', () => {
    // '/jobs' must not admit '/jobs-admin'-style siblings, only '/jobs/...'
    expect(isPathAllowedForRole('superintendent', '/jobsx', false)).toBe(false)
    expect(isPathAllowedForRole('primary', '/bidsx', false)).toBe(false)
  })
})

describe('superintendent (v2.2325: nav dead ends — dispatch-mode shell stays staff-only)', () => {
  it('keeps /dispatch-mode* blocked', () => {
    for (const p of ['/dispatch-mode', '/dispatch-mode/schedule', '/dispatch-mode/inbox', '/dispatch-mode/customers', '/dispatch-mode/po']) {
      expect(isPathAllowedForRole('superintendent', p, false), p).toBe(false)
    }
  })
  it('keeps /customers and /people blocked, allows the documented pages', () => {
    expect(isPathAllowedForRole('superintendent', '/customers', false)).toBe(false)
    expect(isPathAllowedForRole('superintendent', '/people', false)).toBe(false)
    for (const p of ['/jobs', '/bids', '/estimates', '/documents', '/schedule-dispatch', '/materials']) {
      expect(isPathAllowedForRole('superintendent', p, false), p).toBe(true)
    }
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
