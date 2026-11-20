import { describe, expect, it } from 'vitest'
import { canDeleteFromContractLibrary, canUseContractFormStudio } from './contractLibraryRoles'

describe('the Contract library’s role rules', () => {
  it('the owner and a dev delete from the library, and nobody else', () => {
    expect(['dev', 'master_technician', 'assistant', 'controller', 'estimator', null].map(canDeleteFromContractLibrary)).toEqual([true, true, false, false, false, false])
  })
  it('the controller and a dev see the Forms tab, and nobody else', () => {
    expect(['dev', 'master_technician', 'assistant', 'controller', 'estimator', undefined].map(canUseContractFormStudio)).toEqual([true, false, false, true, false, false])
  })
})
