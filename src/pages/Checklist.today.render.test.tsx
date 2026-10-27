// @vitest-environment jsdom
/**
 * Checklist → Today, the day's read (v2.5962): a lost signal reads the offline sentence with Retry in the
 * Today section, never "No checklist items due today.", and Retry reads the day again. An action's refusal
 * keeps the page's own line below; that path is unchanged.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../test/renderSmokeMocks'
import { OFFLINE_ERROR_MESSAGE } from '../lib/networkErrorMessage'

const H = vi.hoisted(() => ({ dayError: null as unknown, reads: 0 }))

vi.mock('../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'helpers' })
})
vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  const stub = makeSupabaseStub()
  /** `checklist_instances` answers the failure while it is set; every other table reads empty. */
  const instances = (): Record<string, unknown> => {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'is', 'lt', 'gt', 'order', 'limit', 'in']) b[m] = () => b
    b.then = (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => {
      H.reads++
      return Promise.resolve(H.dayError ? { data: null, error: H.dayError } : { data: [], error: null }).then(ok, bad)
    }
    return b
  }
  return {
    supabase: {
      ...stub,
      from: (table: string) =>
        table === 'users'
          ? { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { role: 'helpers' }, error: null }) }) }) }
          : table === 'checklist_instances'
            ? instances()
            : stub.from(),
    },
  }
})
vi.mock('../lib/navClickTelemetry', () => ({ recordNavClick: () => {} }))

const { default: Checklist } = await import('./Checklist')

describe('Checklist → Today', () => {
  it('a lost signal reads the offline sentence with Retry, never "No checklist items due today."; Retry reads the day again', async () => {
    H.dayError = { message: 'TypeError: Failed to fetch', details: '', hint: '', code: '' }
    H.reads = 0
    renderWithProviders(<Checklist />)
    await screen.findByText(OFFLINE_ERROR_MESSAGE)
    expect(screen.queryByText('No checklist items due today.')).toBeNull()
    H.dayError = null
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByText('No checklist items due today.')
    expect(screen.queryByText(OFFLINE_ERROR_MESSAGE)).toBeNull()
  })
})
