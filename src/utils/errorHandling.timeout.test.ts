import { describe, expect, it, vi } from 'vitest'
import { OperationTimeoutError, withOperationTimeout } from './errorHandling'

describe('withOperationTimeout', () => {
  it('passes through a resolution that beats the deadline', async () => {
    await expect(withOperationTimeout(Promise.resolve('ok'), 1000, 'save')).resolves.toBe('ok')
  })

  it('passes through a rejection that beats the deadline', async () => {
    await expect(
      withOperationTimeout(Promise.reject(new Error('boom')), 1000, 'save'),
    ).rejects.toThrow('boom')
  })

  it('rejects with OperationTimeoutError when the promise never settles', async () => {
    vi.useFakeTimers()
    try {
      const hang = new Promise<never>(() => {})
      const p = withOperationTimeout(hang, 15000, 'save schedule')
      const assertion = expect(p).rejects.toMatchObject({
        name: 'OperationTimeoutError',
        message: 'save schedule did not respond within 15s',
      })
      await vi.advanceTimersByTimeAsync(15000)
      await assertion
      expect((await p.catch((e) => e)) instanceof OperationTimeoutError).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not fire the timer after an early settle (no unhandled rejection)', async () => {
    vi.useFakeTimers()
    try {
      await expect(withOperationTimeout(Promise.resolve(1), 5000, 'save')).resolves.toBe(1)
      await vi.advanceTimersByTimeAsync(10000)
    } finally {
      vi.useRealTimers()
    }
  })
})
