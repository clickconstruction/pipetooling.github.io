import { describe, expect, it } from 'vitest'
import type { UserRole } from '../hooks/useAuth'
import { isControllerOrDev, isEstimatorOrDev, isOfficeRole, isOwnerOrDev } from './doorRoles'

const EVERY_ROLE: readonly UserRole[] = ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'subcontractor', 'helpers']

function admitted(pred: (r: UserRole | null | undefined) => boolean): UserRole[] {
  return EVERY_ROLE.filter((r) => pred(r))
}

describe('doorRoles — the audiences the dev gates opened to (punch list #188)', () => {
  it('role: owner is the owner or a dev', () => {
    expect(admitted(isOwnerOrDev)).toEqual(['dev', 'master_technician'])
  })
  it('role: controller is the controller or a dev', () => {
    expect(admitted(isControllerOrDev)).toEqual(['dev', 'controller'])
  })
  it('role: office is a dev, the owner and the assistant-like roles', () => {
    expect(admitted(isOfficeRole)).toEqual(['dev', 'master_technician', 'assistant', 'controller'])
  })
  it('role: estimator is an estimator or a dev', () => {
    expect(admitted(isEstimatorOrDev)).toEqual(['dev', 'estimator'])
  })
  it('no role at all opens nothing', () => {
    for (const pred of [isOwnerOrDev, isControllerOrDev, isOfficeRole, isEstimatorOrDev]) {
      expect(pred(null)).toBe(false)
      expect(pred(undefined)).toBe(false)
    }
  })
})
