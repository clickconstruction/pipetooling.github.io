import { describe, expect, it } from 'vitest'
import {
  dispatchModePoDefaultEnabled,
  dispatchModePoRoleAllowed,
  resolveDispatchModePoEnabled,
} from './dispatchModePoToggle'

describe('dispatchModePoToggle role defaults (v2.2903, J29-F7)', () => {
  it('the tab is offered to dev, master technicians and assistants only', () => {
    expect(dispatchModePoRoleAllowed('dev')).toBe(true)
    expect(dispatchModePoRoleAllowed('master_technician')).toBe(true)
    expect(dispatchModePoRoleAllowed('assistant')).toBe(true)
    expect(dispatchModePoRoleAllowed('estimator')).toBe(false)
    expect(dispatchModePoRoleAllowed('subcontractor')).toBe(false)
    expect(dispatchModePoRoleAllowed(null)).toBe(false)
  })

  it('defaults ON for the roles that mint counter codes (assistant-like, master technician), OFF for dev', () => {
    expect(dispatchModePoDefaultEnabled('assistant')).toBe(true)
    expect(dispatchModePoDefaultEnabled('controller')).toBe(true)
    expect(dispatchModePoDefaultEnabled('master_technician')).toBe(true)
    expect(dispatchModePoDefaultEnabled('dev')).toBe(false)
    expect(dispatchModePoDefaultEnabled(null)).toBe(false)
  })

  it('an explicit per-device choice always wins over the role default', () => {
    expect(resolveDispatchModePoEnabled(false, 'master_technician')).toBe(false)
    expect(resolveDispatchModePoEnabled(true, 'dev')).toBe(true)
    expect(resolveDispatchModePoEnabled(null, 'master_technician')).toBe(true)
    expect(resolveDispatchModePoEnabled(null, 'dev')).toBe(false)
  })
})
