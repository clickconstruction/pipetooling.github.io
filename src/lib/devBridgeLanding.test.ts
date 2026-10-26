import { describe, expect, it } from 'vitest'
import { BRIDGE_PATH, DASHBOARD_PATH, indexLandingPath, isRootPath, resolveDevLanding, shouldLandOnBridge } from './devBridgeLanding'

describe('shouldLandOnBridge — a dev at the bare root, nobody else, nowhere else', () => {
  it('fires for a dev at /', () => {
    expect(shouldLandOnBridge({ role: 'dev', pathname: '/' })).toBe(true)
    expect(resolveDevLanding({ role: 'dev', pathname: '/' })).toBe('/bridge')
  })

  it('leaves a dev on the Dashboard they pressed, and on any deep link', () => {
    expect(shouldLandOnBridge({ role: 'dev', pathname: '/dashboard' })).toBe(false)
    expect(shouldLandOnBridge({ role: 'dev', pathname: '/jobs' })).toBe(false)
    expect(shouldLandOnBridge({ role: 'dev', pathname: '/bridge' })).toBe(false)
    expect(resolveDevLanding({ role: 'dev', pathname: '/jobs?tab=stages' })).toBeNull()
  })

  it('never fires for another role, or before the role is read', () => {
    for (const role of ['assistant', 'master_technician', 'estimator', 'primary', 'superintendent', 'helpers', 'subcontractor', 'controller', null, undefined]) {
      expect(shouldLandOnBridge({ role, pathname: '/' })).toBe(false)
      expect(resolveDevLanding({ role, pathname: '/' })).toBeNull()
    }
  })
})

describe('indexLandingPath — what / and a sign-in render', () => {
  it('sends a dev to the Bridge and everyone else to the Dashboard', () => {
    expect(indexLandingPath('dev')).toBe(BRIDGE_PATH)
    for (const role of ['assistant', 'master_technician', 'estimator', 'primary', 'superintendent', 'helpers', 'subcontractor', 'controller']) expect(indexLandingPath(role)).toBe(DASHBOARD_PATH)
  })

  it('a role not yet read lands on the Dashboard, as before', () => {
    expect(indexLandingPath(null)).toBe('/dashboard')
    expect(indexLandingPath(undefined)).toBe('/dashboard')
  })
})

describe('isRootPath', () => {
  it('only the bare root counts', () => {
    expect(isRootPath('/')).toBe(true)
    expect(isRootPath('/dashboard')).toBe(false)
    expect(isRootPath('')).toBe(false)
  })
})
