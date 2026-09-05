import { describe, expect, it, vi } from 'vitest'
import { errorClassKey, makeErrorClassReporter } from './errorClassTelemetry'

describe('makeErrorClassReporter', () => {
  it('logs one line per (kind, code, operation) per session', () => {
    const log = vi.fn()
    const report = makeErrorClassReporter(log)
    report({ kind: 'server', code: '22P02', operation: 'fetchScheduleJobContext', status: 400 })
    report({ kind: 'server', code: '22P02', operation: 'fetchScheduleJobContext', status: 400 })
    report({ kind: 'server', code: '42501', operation: 'fetchScheduleJobContext', status: 403 })
    report({ kind: 'network', code: '', operation: 'dispatch mode day blocks', status: 0 })
    report({ kind: 'network', code: '', operation: 'dispatch mode day blocks' })
    expect(log).toHaveBeenCalledTimes(3)
    expect(log.mock.calls[0]?.[0]).toBe('[error-class] server 22P02 fetchScheduleJobContext')
    expect(log.mock.calls[1]?.[0]).toBe('[error-class] server 42501 fetchScheduleJobContext')
    expect(log.mock.calls[2]?.[0]).toBe('[error-class] network - dispatch mode day blocks')
  })

  it('never throws out of the rendering path', () => {
    const report = makeErrorClassReporter(() => {
      throw new Error('sink down')
    })
    expect(() => report({ kind: 'unknown', code: '', operation: '' })).not.toThrow()
  })

  it('keys by the natural identity of the future error_shown event', () => {
    expect(errorClassKey({ kind: 'server', code: '22P02', operation: 'x' })).toBe('server|22P02|x')
  })
})
