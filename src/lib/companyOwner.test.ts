import { describe, expect, it } from 'vitest'
import { chooseCompanyOwnerUserId, COMPANY_OWNER_USER_ID_KEY, JOB_OWNER_OVERRIDE_DEFAULT_KEY } from './companyOwner'

const ME = 'user-me'
const OWNER = 'user-company'
const M1 = { id: 'm1', role: 'master_technician', archived_at: null }
const M2 = { id: 'm2', role: 'master_technician', archived_at: null }

describe('chooseCompanyOwnerUserId (one company, v2.2972)', () => {
  it('the settings row wins over everything', () => {
    const rows = [
      { key: COMPANY_OWNER_USER_ID_KEY, value_text: OWNER },
      { key: JOB_OWNER_OVERRIDE_DEFAULT_KEY, value_text: 'user-legacy' },
    ]
    expect(chooseCompanyOwnerUserId(rows, [M1, M2], ME)).toBe(OWNER)
  })

  it('falls back to the legacy org-wide default when the row is unset or blank', () => {
    const rows = [
      { key: COMPANY_OWNER_USER_ID_KEY, value_text: '  ' },
      { key: JOB_OWNER_OVERRIDE_DEFAULT_KEY, value_text: 'user-legacy' },
    ]
    expect(chooseCompanyOwnerUserId(rows, [M1, M2], ME)).toBe('user-legacy')
  })

  it('then the single live master', () => {
    expect(chooseCompanyOwnerUserId([], [M1, { ...M2, archived_at: '2026-01-01' }], ME)).toBe('m1')
  })

  it('then the signed-in user when there is no single master', () => {
    expect(chooseCompanyOwnerUserId([], [M1, M2], ME)).toBe(ME)
    expect(chooseCompanyOwnerUserId([], [], ME)).toBe(ME)
  })
})
