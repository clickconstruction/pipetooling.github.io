// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import UncollectibleListSettingsBlock from './UncollectibleListSettingsBlock'

const given = vi.hoisted(() => ({ rows: null as Array<Record<string, unknown>> | null }))

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as Record<string, unknown> & { from: (table: string) => unknown }
  const listOf = (data: unknown[]) => {
    const chain: Record<string, unknown> = {}
    for (const m of ['select', 'not', 'order']) chain[m] = () => chain
    chain.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve({ data, error: null }).then(onFulfilled, onRejected)
    return chain
  }
  return { supabase: { ...stub, from: (table: string) => (table === 'jobs_ledger' && given.rows ? listOf(given.rows) : stub.from(table)) } }
})

afterEach(() => {
  given.rows = null
})

describe('UncollectibleListSettingsBlock (punch list #94, v2.4795)', () => {
  it('folds closed, opens on its heading and reads the empty case', async () => {
    renderWithProviders(<UncollectibleListSettingsBlock />)
    const head = screen.getByRole('button', { name: /Uncollectible: the accountant's list/ })
    expect(head.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(head)
    await settle()
    expect(screen.getByText('Nothing has been marked Uncollectible.')).toBeTruthy()
  })

  it('prints each amount with one dollar sign: the total, the year and the row (v2.4874)', async () => {
    given.rows = [
      {
        id: 'j981',
        hcp_number: null,
        click_number: '981',
        job_name: 'Bryan Van',
        revenue: 7502,
        payments_made: 0,
        uncollectible_at: '2026-10-07T19:00:00Z',
        uncollectible_reason: 'He does not have the money and owes us for advances.',
        customer: { name: 'Bryan Herber' },
      },
    ]
    const { container } = renderWithProviders(<UncollectibleListSettingsBlock />)
    fireEvent.click(screen.getByRole('button', { name: /Uncollectible: the accountant's list/ }))
    await settle()
    expect(screen.getByText('He does not have the money and owes us for advances.')).toBeTruthy()
    const text = container.textContent ?? ''
    expect(text).toContain('$7,502 given up on, all years')
    expect(text).toContain('2026 · 1 bill · $7,502')
    expect(text).not.toContain('$$')
  })
})
