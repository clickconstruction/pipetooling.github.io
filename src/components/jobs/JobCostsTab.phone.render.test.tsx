// @vitest-environment jsdom
/**
 * The Costs tab on a phone (punch list #355 G, v2.7285): at 375 px *Where the money went* is rows, not a table — a
 * bar under each source's share, a door's words on the rows that open something, a 44 px press on those — and the
 * dev's cost-move panel is a fold that draws nothing until pressed.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { installDomShims, renderWithProviders, useAuthModuleMock } from '../../test/renderSmokeMocks'
import { JobFormPartsCostSection } from './JobFormPartsCostSection'
import { JobWindowCostMovePanel } from './JobWindowCostMovePanel'

vi.mock('../../hooks/useAuth', async () => useAuthModuleMock({ role: 'dev', user: { id: '66666666-6666-4666-8666-666666666666', email: 'dev@example.com' } }))
vi.mock('../../hooks/useMercuryLedgerNicknames', () => ({
  useMercuryLedgerNicknames: () => ({ nicknameByDebitCard: {} }),
}))
vi.mock('../../lib/supabase', () => {
  function makeBuilder(): Record<string, unknown> {
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'neq', 'in', 'is', 'or', 'not', 'order', 'range', 'limit']) builder[m] = () => builder
    builder.maybeSingle = () => Promise.resolve({ data: null, error: null })
    builder.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => Promise.resolve({ data: [], error: null, count: 0, status: 200 }).then(onFulfilled, onRejected)
    return builder
  }
  return { supabase: { from: () => makeBuilder(), rpc: () => makeBuilder() } }
})

function phoneQueryMatches(query: string): boolean {
  const max = /\(max-width:\s*(\d+)px\)/.exec(query)
  const min = /\(min-width:\s*(\d+)px\)/.exec(query)
  if (!max && !min) return false
  return (!max || 375 <= Number(max[1])) && (!min || 375 >= Number(min[1]))
}

beforeAll(() => {
  installDomShims()
  window.matchMedia = ((query: string) => ({
    matches: phoneQueryMatches(query),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
})
afterEach(cleanup)

describe('Where the money went on a phone', () => {
  it('is rows with a share bar and a door, and a door row opens its accordion', () => {
    const toggle = vi.fn()
    renderWithProviders(
      <JobFormPartsCostSection
        editing={{ id: 'job-1' } as never}
        materialsAccordionOpen={null}
        toggleMaterialsAccordion={toggle}
        jobMaterialsSnapshotLoading={false}
        supplyInvoiceTotal={0}
        supplyInvoiceRpcFailed={false}
        supplyInvoiceLines={[]}
        mercuryCardTotal={100}
        mercuryFetchFailed={false}
        mercuryAllocLines={[]}
        tallyPartsTotal={300}
        tallyFetchFailed={false}
        tallyPartLines={[]}
        billedMaterialsTotalDisplay="0.00"
        materials={[]}
        addMaterialRow={() => {}}
        updateMaterialRow={() => {}}
        removeMaterialRow={() => {}}
        teamLabor={{ loading: false, error: false, row: null, showOpenLink: false }}
        subLabor={{ loading: false, error: false, data: { count: 0, total: 0 }, effectiveHcp: '', showOpenLink: false }}
      />,
    )
    const table = screen.getByTestId('job-money-table')
    expect(table.getAttribute('data-money-rows')).toBe('phone')
    expect(table.querySelector('table')).toBeNull()
    const tally = table.querySelector('[data-money-row="tally"]') as HTMLElement
    expect(tally.tagName).toBe('BUTTON')
    expect(tally.textContent).toContain('300.00')
    expect(tally.textContent).toContain('show below ›')
    expect(tally.querySelector('i')).not.toBeNull()
    expect(tally.style.minHeight).toBe('44px')
    fireEvent.click(tally)
    expect(toggle).toHaveBeenCalled()
    const total = table.querySelector('[data-money-row="total"]') as HTMLElement
    expect(total.tagName).toBe('DIV')
    expect(total.textContent).toContain('400.00')
  })
})

describe('the dev’s cost-move panel on a phone', () => {
  it('is a fold that draws the panel only when pressed', async () => {
    renderWithProviders(<JobWindowCostMovePanel job={{ id: '11111111-1111-4111-8111-111111111111', hcp_number: '583', click_number: '', job_name: 'Davenport', job_address: '1 Catch-all Rd', service_type_id: null } as never} />)
    const fold = document.querySelector('[data-cost-move-folded]')
    expect(fold).not.toBeNull()
    const press = screen.getByRole('button', { name: /Move cost rows…/ })
    expect(press.style.minHeight).toBe('44px')
    fireEvent.click(press)
    expect(document.querySelector('[data-cost-move-folded]')).toBeNull()
    expect(await screen.findByText(/Every cost row on this job/)).toBeTruthy()
  })
})
