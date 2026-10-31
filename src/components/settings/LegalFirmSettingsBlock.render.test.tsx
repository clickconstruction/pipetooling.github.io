// @vitest-environment jsdom
/**
 * Settings → Jobs & billing → Collections law firms (punch list #144, PR 1 v2.5756 and PR 1b
 * v2.5758): two active firms as cards with their counties, the county map, a click that colors a
 * free county for the picked firm, a click on the other firm's county that asks before it moves;
 * today's cases as dots, the contents card under the firms on the hovered county, a dot click that
 * holds its case and never colors, and the + button that tightens the view.
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
vi.mock('../../hooks/useLegalFirmMapCases', () => ({
  useLegalFirmMapCases: () => ({
    loading: false,
    cases: [
      { id: 'c:tle|live', key: 'c:tle', name: 'The Learning Experience', balance: 15781.82, jobLabels: '707 · 717', jobCount: 2, viaGc: false, stand: 'firm', note: 'with Austin Collections Firm since 10/06', lat: 30.3, lng: -97.98, county: 'Travis', countyFrom: 'point' },
      { id: 'c:rmc|live', key: 'c:rmc', name: 'RMC- Dudley Mason', balance: 1712.5, jobLabels: '790', jobCount: 1, viaGc: true, stand: 'eyes', note: 'needs a dev’s eyes', lat: 29.47, lng: -98.45, county: 'Bexar', countyFrom: 'point' },
    ],
  }),
}))
vi.mock('../../lib/legal/txCountyMapIo', () => ({
  loadTxCountyMap: async () => ({
    width: 300,
    height: 200,
    // A toy projection that still puts Central Texas inside the 300×200 box: x = (lon + 100) · 100, y = (31 − lat) · 100.
    project: (lon: number, lat: number) => [(lon + 100) * 100, (31 - lat) * 100],
    shapes: [
      { name: 'Bexar', fips: '48029', d: 'M0,0L100,0L100,100L0,100Z', cx: 50, cy: 50 },
      { name: 'Travis', fips: '48453', d: 'M100,0L200,0L200,100L100,100Z', cx: 150, cy: 50 },
      { name: 'Comal', fips: '48091', d: 'M200,0L300,0L300,100L200,100Z', cx: 250, cy: 50 },
    ],
  }),
}))

import LegalFirmSettingsBlock from './LegalFirmSettingsBlock'

describe('LegalFirmSettingsBlock', () => {
  it('draws both firms with their counties, colors a free county for the picked firm, and asks three ways on a held one (v2.6227)', async () => {
    const { container } = renderWithProviders(<LegalFirmSettingsBlock />)
    const cards = await screen.findAllByText(/count(y|ies)/)
    expect(cards.length).toBeGreaterThan(0)
    await waitFor(() => expect(container.querySelector('[data-legal-firm-card="firm-a"] [data-legal-firm-counties]')?.textContent).toBe('1 county · Bexar'))
    expect(container.querySelector('[data-legal-firm-card="firm-b"] [data-legal-firm-counties]')?.textContent).toBe('1 county · Travis')
    expect(container.querySelector('[data-legal-firm-card="firm-a"]')?.getAttribute('data-picked')).toBe('1')
    expect(screen.getByText('Nothing to save.')).toBeTruthy()
    expect(container.querySelector('[data-legal-county-card=""]')?.textContent).toContain('Hover a county to see the cases in it.')

    const comal = await waitFor(() => {
      const el = container.querySelector('path[data-county="Comal"]')
      if (!el) throw new Error('no Comal yet')
      return el
    })
    fireEvent.click(comal)
    await waitFor(() => expect(container.querySelector('[data-legal-firm-card="firm-a"] [data-legal-firm-counties]')?.textContent).toBe('2 counties · Bexar, Comal'))
    expect(screen.getByText('1 county changed. Save to make it so.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Save counties' }) as HTMLButtonElement).disabled).toBe(false)

    // v2.6227: a held county asks three ways; Share it keeps Austin first call and adds Snell.
    fireEvent.click(container.querySelector('path[data-county="Travis"]')!)
    await screen.findByText('Travis is Austin Collections Firm’s. How should Snell Law Firm, PLLC cover it? Matters already with Austin Collections Firm stay there.')
    expect(container.querySelector('path[data-county="Travis"]')?.getAttribute('data-firm')).toBe('firm-b')
    fireEvent.click(screen.getByRole('button', { name: /^Share it/ }))
    await waitFor(() => expect(container.querySelector('[data-legal-firm-card="firm-a"] [data-legal-firm-counties]')?.textContent).toBe('3 counties · Bexar, Comal, Travis (also)'))
    expect(container.querySelector('path[data-county="Travis"]')?.getAttribute('data-firm')).toBe('firm-b')
    expect(container.querySelector('path[data-county="Travis"]')?.getAttribute('data-shared')).toBe('1')
    expect(screen.getByText('2 counties changed. Save to make it so.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Undo changes' }))
    await waitFor(() => expect(screen.getByText('Nothing to save.')).toBeTruthy())

    // PR 1b: the dots, the contents card, the hold, the zoom.
    const dots = container.querySelectorAll('circle[data-case]')
    expect(dots).toHaveLength(2)
    expect(container.querySelector('circle[data-case="c:rmc|live"]')?.getAttribute('data-stand')).toBe('eyes')
    // the last county click above (Travis, the held one) put the card on Travis
    expect(container.querySelector('[data-legal-county-card="Travis"]')).toBeTruthy()
    fireEvent.pointerEnter(container.querySelector('path[data-county="Comal"]')!)
    await waitFor(() => expect(container.querySelector('[data-legal-county-card="Comal"]')?.textContent).toContain('No case in Comal County.'))
    fireEvent.pointerEnter(container.querySelector('path[data-county="Travis"]')!)
    await waitFor(() => expect(container.querySelector('[data-legal-county-card="Travis"]')?.textContent).toContain('1 case · $15,781.82 open'))
    expect(container.querySelector('[data-legal-county-card="Travis"]')?.textContent).toContain('Austin Collections Firm')
    expect(container.querySelector('[data-legal-county-case="c:tle|live"] a')?.getAttribute('href')).toBe('/jobs?tab=stages&legal=c%3Atle')
    // a dot click holds its case on the card, and colors nothing
    fireEvent.click(container.querySelector('circle[data-case="c:rmc|live"]')!)
    await waitFor(() => expect(container.querySelector('[data-legal-county-card="Bexar"] [data-legal-county-case="c:rmc|live"]')?.getAttribute('data-held')).toBe('1'))
    expect(screen.getByText('Nothing to save.')).toBeTruthy()
    fireEvent.pointerEnter(container.querySelector('path[data-county="Travis"]')!)
    expect(container.querySelector('[data-legal-county-card="Bexar"]')).toBeTruthy()
    // the view tightens by 1.4 on +
    const before = container.querySelector('svg[data-legal-county-view]')!.getAttribute('data-legal-county-view')!
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    await waitFor(() => expect(container.querySelector('svg[data-legal-county-view]')!.getAttribute('data-legal-county-view')).not.toBe(before))
    const [, , w0] = before.split(' ').map(Number)
    const [, , w1] = container.querySelector('svg[data-legal-county-view]')!.getAttribute('data-legal-county-view')!.split(' ').map(Number)
    expect(w1! / w0!).toBeCloseTo(1 / 1.4, 2)
    fireEvent.click(screen.getByRole('button', { name: 'All of Texas' }))
    await waitFor(() => expect(container.querySelector('svg[data-legal-county-view]')!.getAttribute('data-legal-county-view')).toBe('0 0 300 200'))
  })
})
