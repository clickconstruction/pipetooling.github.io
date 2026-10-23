// @vitest-environment jsdom
/**
 * Settings → Jobs & billing → Collections law firms (punch list #144, PR 1, v2.5756): two active
 * firms as cards with their counties, the county map, a click that colors a free county for the
 * picked firm, and a click on the other firm's county that asks before it moves.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const FIRMS = [
  { id: 'firm-a', name: 'Snell Law Firm, PLLC', handling_name: 'A. Snell', email: 'a@snell.example', phone: '', contingency_pct: 33, filing_cost: 350, active: true, created_at: '2026-09-01T00:00:00Z' },
  { id: 'firm-b', name: 'Austin Collections Firm', handling_name: '', email: '', phone: '', contingency_pct: 30, filing_cost: 300, active: true, created_at: '2026-10-22T00:00:00Z' },
]
const COUNTIES = [
  { id: 'r1', firm_id: 'firm-a', county: 'Bexar', since: '2026-10-22T00:00:00Z', until: null, set_by: null },
  { id: 'r2', firm_id: 'firm-b', county: 'Travis', since: '2026-10-22T00:00:00Z', until: null, set_by: null },
]

vi.mock('../../lib/supabase', () => {
  function builder(rows: unknown[], single = false): Record<string, unknown> {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'insert', 'update', 'upsert', 'eq', 'is', 'order', 'limit']) b[m] = () => b
    b.single = () => builder(rows, true)
    b.maybeSingle = () => builder(rows, true)
    b.then = (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve({ data: single ? rows[0] ?? null : rows, error: null }).then(ok, bad)
    return b
  }
  return {
    supabase: {
      from: (table: string) => builder(table === 'legal_firms' ? FIRMS : table === 'legal_firm_counties' ? COUNTIES : []),
    },
  }
})
vi.mock('../../hooks/useAuth', async () => {
  const { makeUseAuthValue } = await import('../../test/renderSmokeMocks')
  return { useAuth: () => makeUseAuthValue({ role: 'dev' }) }
})
vi.mock('../../lib/legal/txCountyMapIo', () => ({
  loadTxCountyMap: async () => ({
    width: 300,
    height: 200,
    shapes: [
      { name: 'Bexar', fips: '48029', d: 'M0,0L100,0L100,100L0,100Z', cx: 50, cy: 50 },
      { name: 'Travis', fips: '48453', d: 'M100,0L200,0L200,100L100,100Z', cx: 150, cy: 50 },
      { name: 'Comal', fips: '48091', d: 'M200,0L300,0L300,100L200,100Z', cx: 250, cy: 50 },
    ],
  }),
}))

import LegalFirmSettingsBlock from './LegalFirmSettingsBlock'

describe('LegalFirmSettingsBlock', () => {
  it('draws both firms with their counties, colors a free county for the picked firm, and asks before moving a held one', async () => {
    const { container } = renderWithProviders(<LegalFirmSettingsBlock />)
    const cards = await screen.findAllByText(/count(y|ies)/)
    expect(cards.length).toBeGreaterThan(0)
    await waitFor(() => expect(container.querySelector('[data-legal-firm-card="firm-a"] [data-legal-firm-counties]')?.textContent).toBe('1 county · Bexar'))
    expect(container.querySelector('[data-legal-firm-card="firm-b"] [data-legal-firm-counties]')?.textContent).toBe('1 county · Travis')
    expect(container.querySelector('[data-legal-firm-card="firm-a"]')?.getAttribute('data-picked')).toBe('1')
    expect(screen.getByText('Nothing to save.')).toBeTruthy()

    const comal = await waitFor(() => {
      const el = container.querySelector('path[data-county="Comal"]')
      if (!el) throw new Error('no Comal yet')
      return el
    })
    fireEvent.click(comal)
    await waitFor(() => expect(container.querySelector('[data-legal-firm-card="firm-a"] [data-legal-firm-counties]')?.textContent).toBe('2 counties · Bexar, Comal'))
    expect(screen.getByText('1 county changed. Save to make it so.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Save counties' }) as HTMLButtonElement).disabled).toBe(false)

    fireEvent.click(container.querySelector('path[data-county="Travis"]')!)
    await screen.findByText('Travis is Austin Collections Firm’s. Move it to Snell Law Firm, PLLC? Matters already with Austin Collections Firm stay there.')
    expect(container.querySelector('path[data-county="Travis"]')?.getAttribute('data-firm')).toBe('firm-b')

    fireEvent.click(screen.getByRole('button', { name: 'Undo changes' }))
    await waitFor(() => expect(screen.getByText('Nothing to save.')).toBeTruthy())
  })
})
