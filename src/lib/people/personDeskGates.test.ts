import { describe, expect, it } from 'vitest'
import { canArchiveAccount, canEditAccount, canOpenPersonDesk, canSetTrainingMode, type PersonDeskViewer } from './personDeskGates'

function viewer(p: Partial<PersonDeskViewer>): PersonDeskViewer {
  return { role: 'assistant', isDev: false, canAccessPay: false, canAccessHours: true, canAccessVehicles: true, canAccessLicenses: true, canAccessContracts: true, readOnly: false, ...p }
}

describe('personDeskGates (v2.2713 widenings)', () => {
  it('opens for the office set only', () => {
    expect(canOpenPersonDesk('controller')).toBe(true)
    expect(canOpenPersonDesk('master_technician')).toBe(true)
    expect(canOpenPersonDesk('helpers')).toBe(false)
    expect(canOpenPersonDesk(null)).toBe(false)
  })

  it('archive / restore and training mode: dev, controller, pay-approved master — never a plain assistant or an unapproved master', () => {
    expect(canArchiveAccount(viewer({ role: 'dev', isDev: true }))).toBe(true)
    expect(canArchiveAccount(viewer({ role: 'controller', canAccessPay: true }))).toBe(true)
    expect(canArchiveAccount(viewer({ role: 'master_technician', canAccessPay: true }))).toBe(true)
    expect(canArchiveAccount(viewer({ role: 'master_technician', canAccessPay: false }))).toBe(false)
    expect(canArchiveAccount(viewer({ role: 'assistant' }))).toBe(false)
    expect(canSetTrainingMode(viewer({ role: 'controller', canAccessPay: true }))).toBe(true)
    expect(canSetTrainingMode(viewer({ role: 'assistant' }))).toBe(false)
  })

  it('a viewer in training mode edits nothing, and role changes stay dev-only', () => {
    expect(canArchiveAccount(viewer({ role: 'dev', isDev: true, readOnly: true }))).toBe(false)
    expect(canSetTrainingMode(viewer({ role: 'controller', readOnly: true }))).toBe(false)
    expect(canEditAccount(viewer({ role: 'controller', canAccessPay: true }))).toBe(false)
    expect(canEditAccount(viewer({ role: 'dev', isDev: true }))).toBe(true)
  })
})
