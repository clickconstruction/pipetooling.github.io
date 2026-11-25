// @vitest-environment jsdom
/**
 * Render smoke for punch list #406: Settings' first read fails on the sign-in lock. The page drew one raw red line,
 * *AbortError: Lock was stolen by another request*, and no press. It now draws the plain words on the retry panel,
 * and Retry reads the person's row again. Every name is made up.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../test/renderSmokeMocks'

const db = vi.hoisted(() => ({ meReads: 0, meAnswers: [] as Array<{ data: unknown; error: unknown }> }))

vi.mock('../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'helpers', user: { id: 'u-zz', email: 'zz.test@example.com' }, profileName: 'ZZ Test Learner' })
})

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as Record<string, unknown>
  const baseFrom = stub.from as (...args: unknown[]) => unknown
  stub.from = (table: string, ...rest: unknown[]) => {
    const builder = baseFrom(table, ...rest) as Record<string, unknown>
    if (table !== 'users') return builder
    // The page's first read is the person's own row, read with `.single()`.
    return new Proxy(builder, {
      get(target, prop, receiver) {
        if (prop === 'single') {
          return () => {
            db.meReads += 1
            return Promise.resolve(db.meAnswers.shift() ?? { data: { role: 'helpers', name: 'ZZ Test Learner', email: 'zz.test@example.com', phone: null }, error: null })
          }
        }
        const value = Reflect.get(target, prop, receiver)
        // Keep the chain on the proxy, so `.select().eq().single()` reaches the answer above.
        return typeof value === 'function' && prop !== 'then' ? (...args: unknown[]) => {
          const next = (value as (...a: unknown[]) => unknown).apply(target, args)
          return next === target ? receiver : next
        } : value
      },
    })
  }
  return { supabase: stub }
})

import Settings from './Settings'

const LOCK = { data: null, error: { message: 'AbortError: Lock was stolen by another request', details: '', hint: '', code: '' } }

describe('Settings · the first read fails on the sign-in lock (render smoke)', () => {
  it('draws the plain words and a Retry, never the raw words, and Retry reads the row again', async () => {
    db.meReads = 0
    db.meAnswers = [LOCK]
    renderWithProviders(<Settings />)
    expect(await screen.findByText('The app was busy renewing your sign-in, so this did not load. Try again.')).toBeTruthy()
    expect(document.body.textContent).not.toContain('AbortError')
    expect(document.body.textContent).not.toContain('Lock was stolen')
    const before = db.meReads
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(db.meReads).toBeGreaterThan(before))
    await waitFor(() => expect(screen.queryByText('The app was busy renewing your sign-in, so this did not load. Try again.')).toBeNull())
  })
})
