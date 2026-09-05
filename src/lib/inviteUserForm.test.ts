import { describe, expect, it } from 'vitest'
import {
  inviteFormValid,
  roleChangeConfirmMessage,
  roleChosen,
  roleTakesServiceTypes,
  userCreatedTelemetryTarget,
} from './inviteUserForm'

describe('inviteFormValid', () => {
  it('is false while no role is chosen — the dialog opens with nothing selected', () => {
    expect(inviteFormValid({ email: 'sam@example.com', role: '' })).toBe(false)
  })

  it('is false without an email', () => {
    expect(inviteFormValid({ email: '', role: 'helpers' })).toBe(false)
    expect(inviteFormValid({ email: '   ', role: 'helpers' })).toBe(false)
  })

  it('Invite is valid with an email and a chosen role (no password needed)', () => {
    expect(inviteFormValid({ email: 'sam@example.com', role: 'helpers' })).toBe(true)
    expect(inviteFormValid({ email: 'sam@example.com', role: 'master_technician' })).toBe(true)
  })

  it('Manually add also requires the initial password', () => {
    expect(inviteFormValid({ email: 'sam@example.com', role: 'helpers', requirePassword: true })).toBe(false)
    expect(inviteFormValid({ email: 'sam@example.com', role: 'helpers', requirePassword: true, password: '' })).toBe(false)
    expect(inviteFormValid({ email: 'sam@example.com', role: 'helpers', requirePassword: true, password: 'hunter22' })).toBe(true)
  })

  it('roleChosen narrows the blank placeholder away', () => {
    expect(roleChosen('')).toBe(false)
    expect(roleChosen('assistant')).toBe(true)
  })
})

describe('roleTakesServiceTypes', () => {
  it('shows the service-type restriction only for the three field-scoped roles', () => {
    expect(roleTakesServiceTypes('estimator')).toBe(true)
    expect(roleTakesServiceTypes('subcontractor')).toBe(true)
    expect(roleTakesServiceTypes('helpers')).toBe(true)
    expect(roleTakesServiceTypes('master_technician')).toBe(false)
    expect(roleTakesServiceTypes('')).toBe(false)
  })
})

describe('userCreatedTelemetryTarget', () => {
  it('encodes role and the training choice', () => {
    expect(userCreatedTelemetryTarget('helpers', false)).toBe('#helpers')
    expect(userCreatedTelemetryTarget('helpers', true)).toBe('#helpers:training')
  })
})

describe('roleChangeConfirmMessage', () => {
  it('names the person and both roles in human words', () => {
    expect(roleChangeConfirmMessage('Sam Lee', 'helpers', 'master_technician')).toBe(
      "Change Sam Lee's role from Helper to Master? Their navigation and access change on next load.",
    )
  })
  it('omits the from-clause when the current role is unknown', () => {
    expect(roleChangeConfirmMessage('sam@example.com', null, 'assistant')).toBe(
      "Change sam@example.com's role to Assistant? Their navigation and access change on next load.",
    )
  })
})
