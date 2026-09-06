import { describe, expect, it } from 'vitest'
import { ROLES } from '../userRoles'
import {
  WORKFLOW_ASSIGNABLE_USER_ROLES,
  buildWorkflowUserRoster,
  notifyAssignedDefaultsOnAssign,
  NOTIFY_ASSIGNED_ALL_ON,
} from './stepAssignment'

describe('WORKFLOW_ASSIGNABLE_USER_ROLES (J31-N3)', () => {
  it('covers every role the app knows — a new role is assignable without touching Workflow', () => {
    expect([...WORKFLOW_ASSIGNABLE_USER_ROLES].sort()).toEqual([...ROLES].sort())
  })

  it('includes the office roles the old superintendent list left out', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'superintendent']) {
      expect(WORKFLOW_ASSIGNABLE_USER_ROLES).toContain(role)
    }
  })

  it('still includes the field roles the old list had', () => {
    for (const role of ['subcontractor', 'helpers', 'primary']) {
      expect(WORKFLOW_ASSIGNABLE_USER_ROLES).toContain(role)
    }
  })
})

describe('buildWorkflowUserRoster', () => {
  const rows = [
    { name: 'Alice Office', role: 'assistant', archived_at: null, is_digital_twin: false },
    { name: 'Will Owner', role: 'dev', archived_at: null, is_digital_twin: false },
    { name: 'Twin Estimator 1', role: 'estimator', archived_at: null, is_digital_twin: true },
    { name: 'Old Sub', role: 'subcontractor', archived_at: '2026-01-01T00:00:00Z', is_digital_twin: false },
    { name: '  ', role: 'helpers', archived_at: null, is_digital_twin: false },
    { name: null, role: 'helpers', archived_at: null, is_digital_twin: false },
  ]

  it('offers active accounts only in the picker, dev included (the owner takes steps)', () => {
    const { roster } = buildWorkflowUserRoster(rows)
    expect(roster.map((r) => r.name)).toEqual(['Alice Office', 'Will Owner'])
  })

  it('counts every named account as a user so an archived assignee is not a ghost', () => {
    const { userNamesLower } = buildWorkflowUserRoster(rows)
    expect(userNamesLower).toEqual(new Set(['alice office', 'will owner', 'twin estimator 1', 'old sub']))
  })

  it('handles an empty read', () => {
    const { roster, userNamesLower } = buildWorkflowUserRoster([])
    expect(roster).toEqual([])
    expect(userNamesLower.size).toBe(0)
  })
})

describe('notifyAssignedDefaultsOnAssign (J31-4 P2)', () => {
  it('turns every toggle on when an unassigned step gains a person', () => {
    expect(notifyAssignedDefaultsOnAssign(null, 'Alice')).toEqual(NOTIFY_ASSIGNED_ALL_ON)
    expect(notifyAssignedDefaultsOnAssign('', 'Alice')).toEqual(NOTIFY_ASSIGNED_ALL_ON)
    expect(notifyAssignedDefaultsOnAssign('   ', 'Alice')).toEqual(NOTIFY_ASSIGNED_ALL_ON)
    expect(notifyAssignedDefaultsOnAssign(undefined, 'Alice')).toEqual(NOTIFY_ASSIGNED_ALL_ON)
  })

  it('leaves the toggles alone on a reassignment', () => {
    expect(notifyAssignedDefaultsOnAssign('Alice', 'Bob')).toBeNull()
    expect(notifyAssignedDefaultsOnAssign('Alice', 'Alice')).toBeNull()
  })

  it('leaves the toggles alone when clearing or saving an unassigned step', () => {
    expect(notifyAssignedDefaultsOnAssign('Alice', null)).toBeNull()
    expect(notifyAssignedDefaultsOnAssign('Alice', '')).toBeNull()
    expect(notifyAssignedDefaultsOnAssign(null, null)).toBeNull()
    expect(notifyAssignedDefaultsOnAssign(null, '  ')).toBeNull()
  })

  it('the patch is exactly the three per-step assignee toggles', () => {
    expect(Object.keys(NOTIFY_ASSIGNED_ALL_ON).sort()).toEqual([
      'notify_assigned_when_complete',
      'notify_assigned_when_reopened',
      'notify_assigned_when_started',
    ])
    expect(Object.values(NOTIFY_ASSIGNED_ALL_ON).every((v) => v === true)).toBe(true)
  })
})
