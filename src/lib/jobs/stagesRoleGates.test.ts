import { describe, expect, it } from 'vitest'
import {
  canCreateHazmatFee,
  canEditJobPctComplete,
  canManageCollections,
  canManageJobPeople,
  canOpenJobScheduleModal,
  canRecordArPayments,
  canSeeBilledExpectedPay,
  canSeeStagesMoneyCharts,
  canSeeStagesPowerToggles,
  canUseStagesOfficeTools,
  isStagesOfficeRole,
  isStagesOwnerRole,
} from './stagesRoleGates'

/** Every role the app knows (hooks/useAuth `UserRole`) plus the signed-out shapes. */
const ALL_ROLES = [
  'dev',
  'master_technician',
  'assistant',
  'controller',
  'subcontractor',
  'helpers',
  'estimator',
  'primary',
  'superintendent',
  null,
  undefined,
  '',
] as const

const OFFICE = ['dev', 'master_technician', 'assistant', 'controller']

/** Pins the exact set of roles a single-role gate admits, across every role. */
function admits(gate: (role: string | null | undefined) => boolean, expected: readonly string[]) {
  const got = ALL_ROLES.filter((r) => gate(r))
  expect(got).toEqual(expected)
}

describe('stagesRoleGates — the matrix', () => {
  it('the office pool is dev, master, assistant, controller', () => {
    admits(isStagesOfficeRole, OFFICE)
  })
  it('the owner pair is dev and master', () => {
    admits(isStagesOwnerRole, ['dev', 'master_technician'])
  })
  it('money charts are dev-level visibility: dev and controller only', () => {
    admits(canSeeStagesMoneyCharts, ['dev', 'controller'])
  })
  it('the Job Schedule modal opens for the office and superintendents', () => {
    admits(canOpenJobScheduleModal, [...OFFICE, 'superintendent'])
  })
  it('% complete mirrors jobs_ledger UPDATE RLS: office + primary', () => {
    admits(canEditJobPctComplete, [...OFFICE, 'primary'])
  })
  it('managing job people mirrors jobs_ledger_team_members RLS: no controller, no primary', () => {
    admits(canManageJobPeople, ['dev', 'master_technician', 'assistant'])
  })
  it('hazmat fees and Collections moves are the office pool', () => {
    admits(canCreateHazmatFee, OFFICE)
    admits(canManageCollections, OFFICE)
  })
  it('Accounts Receivable and the expected-pay chips admit primary as well (map quirk 6)', () => {
    admits(canRecordArPayments, [...OFFICE, 'primary'])
    admits(canSeeBilledExpectedPay, [...OFFICE, 'primary'])
  })
})

describe('the two-role gates', () => {
  it('office tools qualify on either role', () => {
    expect(canUseStagesOfficeTools('estimator', 'controller')).toBe(true)
    expect(canUseStagesOfficeTools('assistant', null)).toBe(true)
    expect(canUseStagesOfficeTools(null, 'master_technician')).toBe(true)
    expect(canUseStagesOfficeTools('estimator', 'primary')).toBe(false)
    expect(canUseStagesOfficeTools(null, undefined)).toBe(false)
  })
  it('the Ham / Edit toggles (and their rails) judge the first known role only — a known non-office auth role is not rescued by myRole', () => {
    expect(canSeeStagesPowerToggles('dev', null)).toBe(true)
    expect(canSeeStagesPowerToggles(null, 'controller')).toBe(true)
    expect(canSeeStagesPowerToggles('', 'assistant')).toBe(true)
    expect(canSeeStagesPowerToggles('estimator', 'assistant')).toBe(false)
    expect(canSeeStagesPowerToggles('master_technician', null)).toBe(false)
    expect(canSeeStagesPowerToggles(null, null)).toBe(false)
  })
})
