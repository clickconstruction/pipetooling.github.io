import { describe, expect, it } from 'vitest'
import { HUMAN_ROLE_LABELS, humanRoleLabel } from './roleLabels'
import { ROLES } from './userRoles'
import {
  HUMAN_ROLE_LABELS as EDGE_HUMAN_ROLE_LABELS,
  humanRoleLabel as edgeHumanRoleLabel,
} from '../../supabase/functions/_shared/roleLabels'

describe('humanRoleLabel', () => {
  it('labels every assignable role with a human word — no raw enum, no underscore', () => {
    for (const role of ROLES) {
      const label = humanRoleLabel(role)
      expect(label, role).toBeTruthy()
      expect(label, role).not.toContain('_')
      expect(label, role).not.toBe(role)
      expect(/^[A-Z]/.test(label), `${role} label capitalised`).toBe(true)
    }
  })

  it('uses the GLOSSARY / ACCESS_CONTROL heading vocabulary', () => {
    expect(humanRoleLabel('master_technician')).toBe('Master')
    expect(humanRoleLabel('helpers')).toBe('Helper')
    expect(humanRoleLabel('subcontractor')).toBe('Subcontractor')
  })

  it('has a label for exactly the roles the app can assign', () => {
    expect(Object.keys(HUMAN_ROLE_LABELS).sort()).toEqual([...ROLES].sort())
  })

  it('falls back to a spaced, capitalised slug for an unknown role and a dash for none', () => {
    expect(humanRoleLabel('shop_foreman')).toBe('Shop foreman')
    expect(humanRoleLabel('')).toBe('—')
    expect(humanRoleLabel(null)).toBe('—')
    expect(humanRoleLabel(undefined)).toBe('—')
  })
})

describe('edge-function twin (supabase/functions/_shared/roleLabels.ts)', () => {
  it('carries the identical map — the email says what the dialog says', () => {
    expect(EDGE_HUMAN_ROLE_LABELS).toEqual(HUMAN_ROLE_LABELS)
  })

  it('agrees with the client helper for every role and for the fallbacks', () => {
    for (const role of [...ROLES, 'shop_foreman', '', null, undefined]) {
      expect(edgeHumanRoleLabel(role), String(role)).toBe(humanRoleLabel(role))
    }
  })
})
