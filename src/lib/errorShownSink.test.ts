import { afterEach, describe, expect, it, vi } from 'vitest'

const recorded: Array<{ userId: unknown; role: unknown; control: string; target: string }> = []
vi.mock('./navClickTelemetry', () => ({
  recordNavClick: (userId: unknown, role: unknown, control: string, target: string) => {
    recorded.push({ userId, role, control, target })
  },
}))

import { makeErrorClassReporter, setErrorClassSink } from './errorClassTelemetry'
import { errorShownTarget, installErrorShownSink, parseErrorShownTarget } from './errorShownSink'

afterEach(() => {
  setErrorClassSink(null)
  recorded.length = 0
})

describe('error_shown (punch list #187 PR 2)', () => {
  it('writes the kind, the code and the operation into the target, dashes where unknown, the status when known', () => {
    expect(errorShownTarget({ kind: 'server', code: '42501', operation: 'update job', status: 403 })).toBe('/server?code=42501&op=update%20job&status=403')
    expect(errorShownTarget({ kind: 'network', code: '', operation: '' })).toBe('/network?code=-&op=-')
    expect(errorShownTarget({ kind: 'unknown', code: '', operation: 'fetchBids', status: 0 })).toBe('/unknown?code=-&op=fetchBids')
  })

  it('reads a target back, and refuses another shape', () => {
    expect(parseErrorShownTarget('/server?code=42501&op=update%20job&status=403')).toEqual({ kind: 'server', code: '42501', operation: 'update job', status: 403 })
    expect(parseErrorShownTarget('/network?code=-&op=-')).toEqual({ kind: 'network', code: '-', operation: '-', status: null })
    expect(parseErrorShownTarget('/jobs?tab=stages')).toBeNull()
  })

  it('once installed, the reporter writes one row per triple per page load as this person, and none after sign-out', () => {
    const log = vi.fn()
    const report = makeErrorClassReporter(log)
    installErrorShownSink('u-1', 'assistant')
    report({ kind: 'network', code: '', operation: 'save payment' })
    report({ kind: 'network', code: '', operation: 'save payment' })
    report({ kind: 'server', code: '23514', operation: 'save payment', status: 400 })
    expect(log).toHaveBeenCalledTimes(2)
    expect(recorded).toEqual([
      { userId: 'u-1', role: 'assistant', control: 'error_shown', target: '/network?code=-&op=save%20payment' },
      { userId: 'u-1', role: 'assistant', control: 'error_shown', target: '/server?code=23514&op=save%20payment&status=400' },
    ])
    installErrorShownSink(null, null)
    report({ kind: 'unknown', code: '', operation: 'x' })
    expect(recorded).toHaveLength(2)
  })

  it('a sink that throws never turns an error line into a second error', () => {
    const report = makeErrorClassReporter(() => {})
    setErrorClassSink(() => {
      throw new Error('boom')
    })
    expect(() => report({ kind: 'server', code: '1', operation: 'y' })).not.toThrow()
  })
})
