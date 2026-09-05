import { describe, expect, it } from 'vitest'
import {
  isQuietRoleGateRole,
  isRoleRefusalError,
  roleGateLanding,
  roleGateRedirect,
  roleGateRefusalMessage,
  roleGateToastCopy,
  roleHomePath,
  type RoleGateSurface,
} from './roleGate'
import { DatabaseError } from '../utils/errorHandling'

const ALL_ROLES = ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'subcontractor', 'helpers', null] as const
const ALL_SURFACES: RoleGateSurface[] = ['crew-pnl', 'team-labor', 'jobs-tab', 'payroll', 'hours', 'pipeline-money', 'bids-office-tab']

describe('roleGateRedirect — role × surface → landing + sentence (v2.2882, C25)', () => {
  it('an assistant opening the owner\'s Crew P&L link lands on Reports and is told so (J8-F7)', () => {
    const d = roleGateRedirect({ from: '/jobs?tab=teams-summary', role: 'assistant', surface: 'crew-pnl' })
    expect(d.to).toBe('/jobs?tab=reports')
    expect(d.toTab).toBe('reports')
    expect(d.quiet).toBe(false)
    expect(d.toast).toBe("Crew P&L is for the owner — you're on Reports.")
  })

  it('an assistant deep link to Payroll lands on Users with a sentence, not a blank page (J7-5)', () => {
    const d = roleGateRedirect({ from: '/people?tab=pay_stubs', role: 'assistant', surface: 'payroll' })
    expect(d.to).toBe('/people?tab=users')
    expect(d.toast).toBe("Payroll is for the controller — you're on Users.")
  })

  it('a master without pay approval deep-linking to Hours lands on Users', () => {
    const d = roleGateRedirect({ from: '/people?tab=hours', role: 'master_technician', surface: 'hours' })
    expect(d.toTab).toBe('users')
    expect(d.toast).toBe("Hours is for the office — you're on Users.")
  })

  it('the Pipeline money-view link keeps a master on the board and names the controller (J5-6)', () => {
    const d = roleGateRedirect({ from: '/jobs?tab=stages&stagesMoney=1', role: 'master_technician', surface: 'pipeline-money' })
    expect(d.to).toBe('/jobs?tab=stages')
    expect(d.toast).toBe("Weekly money movement is for the controller — you're on the Pipeline board.")
  })

  it('a superintendent on an office Bids tab lands on the Bid board with the spec sentence (J10-F12)', () => {
    const d = roleGateRedirect({ from: '/bids?tab=pricing', role: 'superintendent', surface: 'bids-office-tab' })
    expect(d.to).toBe('/bids?tab=bid-board')
    expect(d.toast).toBe("This page is for the office — you're on the Bid board.")
  })

  it('primary / superintendent deep links to a Jobs tab not on their strip land on Reports', () => {
    for (const role of ['primary', 'superintendent']) {
      const d = roleGateRedirect({ from: '/jobs?tab=billing', role, surface: 'jobs-tab' })
      expect(d.to).toBe('/jobs?tab=reports')
      expect(d.toast).toBe("This page is for the office — you're on Reports.")
    }
  })

  it('Team Labor lands superintendents on Reports (no Pipeline board) and everyone else on the board', () => {
    expect(roleGateLanding('team-labor', 'superintendent').toTab).toBe('reports')
    expect(roleGateLanding('team-labor', 'assistant').toTab).toBe('stages')
    expect(roleGateRedirect({ from: '/jobs?tab=combined-labor', role: 'assistant', surface: 'team-labor' }).toast).toBe(
      "Team Labor is for the owner — you're on the Pipeline board.",
    )
  })

  it('every landing is a same-page tab and every sentence names the landing', () => {
    for (const surface of ALL_SURFACES) {
      for (const role of ALL_ROLES) {
        const d = roleGateRedirect({ from: '/x', role, surface })
        expect(d.to).toMatch(/^\/(jobs|people|bids)\?tab=[a-z_-]+$/)
        expect(d.to.endsWith(`tab=${d.toTab}`)).toBe(true)
        if (!d.quiet) {
          expect(d.toast).toBe(roleGateToastCopy(surface, d.landingLabel))
          expect(d.toast).toContain(`you're on ${d.landingLabel}.`)
        }
      }
    }
  })
})

describe('quiet roles — helpers and subs keep their silent bounces (J24-F8 keep)', () => {
  it('subcontractor and helpers are quiet; every other role is spoken to', () => {
    expect(isQuietRoleGateRole('subcontractor')).toBe(true)
    expect(isQuietRoleGateRole('helpers')).toBe(true)
    for (const role of ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', null]) {
      expect(isQuietRoleGateRole(role), `role ${role}`).toBe(false)
    }
  })

  it('a quiet role still gets a landing but no toast', () => {
    for (const role of ['subcontractor', 'helpers']) {
      for (const surface of ALL_SURFACES) {
        const d = roleGateRedirect({ from: '/x', role, surface })
        expect(d.quiet).toBe(true)
        expect(d.toast).toBeNull()
        expect(d.to.startsWith('/')).toBe(true)
      }
    }
  })
})

describe('roleHomePath — the impersonation landing (J5-11)', () => {
  it('estimators start on Bids, everyone else on the Dashboard — the same targets as Layout\'s route guard', () => {
    expect(roleHomePath('estimator')).toBe('/bids')
    for (const role of ['dev', 'master_technician', 'assistant', 'controller', 'primary', 'superintendent', 'subcontractor', 'helpers', null, undefined]) {
      expect(roleHomePath(role)).toBe('/dashboard')
    }
  })
})

describe('roleGateRefusalMessage — RPC refusals render the classified copy, never the raw string', () => {
  const rpcRefusal = () =>
    new DatabaseError('Failed to load weekly money movement: not allowed', 'P0001', undefined, {
      operationName: 'load weekly money movement',
      serverMessage: 'not allowed',
      status: 400,
    })

  it("the RPC's RAISE EXCEPTION 'not allowed' (P0001) reads as a role refusal", () => {
    expect(isRoleRefusalError(rpcRefusal())).toBe(true)
    expect(roleGateRefusalMessage(rpcRefusal())).toBe("You don't have access to this report.")
    expect(roleGateRefusalMessage(rpcRefusal(), 'payroll')).toBe("You don't have access to payroll.")
  })

  it('an RLS 42501 reads as a role refusal regardless of message', () => {
    const e = new DatabaseError('permission denied for table x', '42501', undefined, { operationName: 'load x', serverMessage: 'permission denied for table x', status: 403 })
    expect(roleGateRefusalMessage(e)).toBe("You don't have access to this report.")
    expect(roleGateRefusalMessage({ code: '42501', message: 'anything' })).toBe("You don't have access to this report.")
  })

  it('a P0001 that is not a refusal, a broken link, or a network failure fall through to null', () => {
    expect(roleGateRefusalMessage(new DatabaseError('x', 'P0001', undefined, { operationName: 'load x', serverMessage: 'week must be a Monday', status: 400 }))).toBeNull()
    expect(roleGateRefusalMessage(new DatabaseError('x', '22P02', undefined, { operationName: 'load x', serverMessage: 'invalid input syntax', status: 400 }))).toBeNull()
    expect(roleGateRefusalMessage(new TypeError('Load failed'))).toBeNull()
    expect(roleGateRefusalMessage(new DatabaseError('x', undefined, undefined, { kind: 'network' }))).toBeNull()
    expect(roleGateRefusalMessage('not allowed')).toBeNull()
    expect(roleGateRefusalMessage(null)).toBeNull()
  })
})
