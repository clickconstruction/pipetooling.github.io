// @vitest-environment jsdom
/**
 * Supply house bills in the header search (punch list #431, PR 7): the office's search lists the bills its words
 * find, after the jobs and bids, and a press opens the bill's own page. A role that cannot read bills asks for none,
 * and a bill search that fails leaves the rest of the box as it was. Every house, number and amount is made up.
 */
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { useLocation } from 'react-router-dom'
import type { BillSearchArgs, BillSearchHit } from '../lib/materials/bills/billSearch'

const auth = vi.hoisted(() => ({ overrides: {} as Record<string, unknown> }))
const bills = vi.hoisted(() => ({ asked: [] as unknown[], answer: (() => []) as (args: unknown) => unknown }))

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../hooks/useAuth', async () => {
  const { makeUseAuthValue } = await import('../test/renderSmokeMocks')
  return {
    useAuth: () => makeUseAuthValue(auth.overrides),
    useOptionalAuth: () => makeUseAuthValue(auth.overrides),
    AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  }
})
vi.mock('../lib/helpGuideRegistry', () => ({ HELP_GUIDES: [] }))
vi.mock('virtual:punch-list', () => ({ default: { validated: { date: '2026-10-26', version: 'v2.5900' }, openItems: 0, items: [] } }))
vi.mock('../utils/dateUtils', async (orig) => ({ ...(await orig<typeof import('../utils/dateUtils')>()), todayYmdInAppTz: () => '2026-11-23' }))
vi.mock('../lib/materials/bills/billSearchIo', () => ({
  supabaseBillSearchIo: {
    search: async (args: BillSearchArgs) => {
      bills.asked.push(args)
      return bills.answer(args)
    },
  },
}))

import { HeaderGlobalSearchNavLayer, HeaderGlobalSearchOpenButton, HeaderGlobalSearchProvider } from './HeaderGlobalSearch'
import { renderWithProviders, settle, SMOKE_AUTH_USER_ID } from '../test/renderSmokeMocks'

function hit(id: string, over: Partial<BillSearchHit> = {}): BillSearchHit {
  return {
    invoice_id: id,
    invoice_number: `BW 77${id}-01`,
    invoice_date: '2026-10-15',
    amount: 1085.58,
    supply_house_id: 'h1',
    supply_house_name: 'Brightwater Pipe & Valve',
    purchase_order_number: null,
    is_paid: false,
    has_pdf: true,
    jobs: [],
    on_paper: null,
    on_paper_code: null,
    ...over,
  }
}

function Where() {
  const loc = useLocation()
  return <div data-testid="where">{`${loc.pathname}${loc.search}`}</div>
}
function Box() {
  return (
    <HeaderGlobalSearchProvider enabled authUserId={SMOKE_AUTH_USER_ID} navOverlayBackground="var(--chrome-bg)" isMobile={false}>
      <div style={{ position: 'relative' }}>
        <HeaderGlobalSearchOpenButton placement="toolbar" isMobile={false} />
        <HeaderGlobalSearchNavLayer />
      </div>
      <Where />
    </HeaderGlobalSearchProvider>
  )
}
async function openAndType(words: string) {
  fireEvent.click(screen.getByRole('button', { name: /search jobs/i }))
  await settle()
  fireEvent.change(screen.getByRole('combobox', { name: 'Search query' }), { target: { value: words } })
  await settle()
}

beforeEach(() => {
  auth.overrides = { role: 'dev', estimatorProspectsAccess: false, teamProspectsAccess: false }
  bills.asked = []
  bills.answer = () => []
  localStorage.clear()
})

describe('HeaderGlobalSearch: supply house bills', () => {
  it('lists the bills the words find, and a press opens the bill’s own page', async () => {
    bills.answer = () => [hit('31', { on_paper: '2 in. ball valve, full port' }), hit('02', { invoice_date: '2025-12-18', amount: 40.48 })]
    renderWithProviders(<Box />)
    await openAndType('ball valve')
    await waitFor(() => expect(screen.getAllByTestId('header-bill-row')).toHaveLength(2))
    expect(bills.asked).toEqual([{ words: ['ball', 'valve'], year: null, month: null, day: null }])
    const [first, second] = screen.getAllByTestId('header-bill-row') as [HTMLElement, HTMLElement]
    expect(first.textContent).toContain('Bill')
    expect(first.textContent).toContain('BW 7731-01')
    expect(first.textContent).toContain('Brightwater Pipe & Valve')
    expect(first.textContent).toContain('$1,085.58')
    expect(first.textContent).toContain('Oct 15 · On the paper: 2 in. ball valve, full port')
    expect(second.textContent).toContain('Dec 18, 2025')
    expect(within(first).getByText('.58').tagName).toBe('SPAN')
    fireEvent.click(first)
    await settle()
    expect(screen.getByTestId('where').textContent).toBe('/files/bills/31')
  })

  it('lists five bills at most, however many the search finds', async () => {
    bills.answer = () => Array.from({ length: 12 }, (_, i) => hit(String(i).padStart(2, '0')))
    renderWithProviders(<Box />)
    await openAndType('brightwater')
    await waitFor(() => expect(screen.getAllByTestId('header-bill-row')).toHaveLength(5))
  })

  it('a role that cannot read bills asks for none', async () => {
    auth.overrides = { role: 'helpers', estimatorProspectsAccess: false, teamProspectsAccess: false }
    bills.answer = () => [hit('31')]
    renderWithProviders(<Box />)
    await openAndType('ball valve')
    await new Promise((r) => setTimeout(r, 450))
    await settle()
    expect(bills.asked).toEqual([])
    expect(screen.queryByTestId('header-bill-row')).toBeNull()
  })

  it('a bill search that fails leaves the box as it was', async () => {
    bills.answer = () => {
      throw new Error('permission denied for function search_supply_bills')
    }
    renderWithProviders(<Box />)
    await openAndType('gear')
    await new Promise((r) => setTimeout(r, 450))
    await settle()
    expect(bills.asked).toHaveLength(1)
    expect(screen.queryByTestId('header-bill-row')).toBeNull()
    // The box still stands and still takes words.
    expect(screen.getByRole('combobox', { name: 'Search query' })).toBeTruthy()
  })
})
