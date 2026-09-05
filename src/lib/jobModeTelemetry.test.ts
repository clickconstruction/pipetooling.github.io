import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./navClickTelemetry', () => ({ recordNavClick: vi.fn() }))

import { recordNavClick } from './navClickTelemetry'
import { jobModeEnabledRecordedThisSession, recordJobModeEnabledOncePerSession } from './jobModeTelemetry'

describe('recordJobModeEnabledOncePerSession', () => {
  const store = new Map<string, string>()
  const fake = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  }
  let prev: unknown

  beforeEach(() => {
    store.clear()
    vi.mocked(recordNavClick).mockClear()
    prev = (globalThis as Record<string, unknown>).sessionStorage
    ;(globalThis as Record<string, unknown>).sessionStorage = fake
  })
  afterEach(() => {
    ;(globalThis as Record<string, unknown>).sessionStorage = prev
  })

  it('writes one job_mode_enabled row with the source as the target', () => {
    expect(jobModeEnabledRecordedThisSession('u1')).toBe(false)
    expect(recordJobModeEnabledOncePerSession('u1', 'helpers', 'default')).toBe(true)
    expect(recordNavClick).toHaveBeenCalledTimes(1)
    expect(recordNavClick).toHaveBeenCalledWith('u1', 'helpers', 'job_mode_enabled', '#default')
    expect(jobModeEnabledRecordedThisSession('u1')).toBe(true)
  })

  it('is once per user per session — a card tap followed by the Dashboard remount counts once', () => {
    expect(recordJobModeEnabledOncePerSession('u1', 'master_technician', 'card')).toBe(true)
    expect(recordJobModeEnabledOncePerSession('u1', 'master_technician', 'card')).toBe(false)
    expect(recordJobModeEnabledOncePerSession('u1', 'master_technician', 'gear')).toBe(false)
    expect(recordNavClick).toHaveBeenCalledTimes(1)
    expect(recordNavClick).toHaveBeenCalledWith('u1', 'master_technician', 'job_mode_enabled', '#card')
  })

  it('another user on the same device gets their own row', () => {
    recordJobModeEnabledOncePerSession('u1', 'helpers', 'default')
    expect(recordJobModeEnabledOncePerSession('u2', 'helpers', 'default')).toBe(true)
    expect(recordNavClick).toHaveBeenCalledTimes(2)
  })

  it('no user ⇒ nothing recorded', () => {
    expect(recordJobModeEnabledOncePerSession(null, 'helpers', 'default')).toBe(false)
    expect(recordNavClick).not.toHaveBeenCalled()
  })
})
