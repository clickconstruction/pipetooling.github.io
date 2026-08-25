import { describe, expect, it } from 'vitest'
import { canRoleSeeReadyToBillBanner, readyToBillBannerLabel } from './readyToBillBanner'

describe('canRoleSeeReadyToBillBanner', () => {
  it('is assistants only', () => {
    expect(canRoleSeeReadyToBillBanner('assistant')).toBe(true)
    for (const r of ['dev', 'master_technician', 'controller', 'subcontractor', 'helpers', 'estimator', 'primary', 'superintendent', null]) {
      expect(canRoleSeeReadyToBillBanner(r)).toBe(false)
    }
  })
})

describe('readyToBillBannerLabel', () => {
  it('counts with verb copy, singular flips, zero hides', () => {
    expect(readyToBillBannerLabel(3)).toBe('3 ready to bill — send them')
    expect(readyToBillBannerLabel(1)).toBe('1 ready to bill — send it')
    expect(readyToBillBannerLabel(0)).toBeNull()
    expect(readyToBillBannerLabel(null)).toBeNull()
  })
})
