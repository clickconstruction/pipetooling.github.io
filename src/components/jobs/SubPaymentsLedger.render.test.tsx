// @vitest-environment jsdom
/**
 * Render smokes for Jobs → Subs → Ledger (punch list #347, PR 2): the lines under their months at a desk, the
 * cards on a phone, the period, the search, the Paid to picker, the door to a sheet and the empty ledger's words.
 * The days sit in the past and the tests open on All, so the clock never moves a line out of view.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { installDomShims, makeLaborJob, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { SubPaymentsLedger } from './SubPaymentsLedger'
import { subLaborJobBalance } from '../../lib/subLaborOutstanding'

const narrow = { on: false }
vi.mock('../../hooks/useIsNarrowScreen', () => ({ useIsNarrowScreen: () => narrow.on }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

beforeAll(installDomShims)
afterEach(cleanup)

const tile = makeLaborJob({ id: 'tile', assigned_to_name: 'Calloway Tile', job_number: 'S-2104', address: '418 Larkspur Bend' })
const agreed = subLaborJobBalance(tile).totalCost
tile.payments = [
  { id: 'p-nov', amount: agreed - 40, memo: 'Zelle · final on tile', created_at: '2025-11-12T17:00:00Z', payment_date: '2025-11-12' },
  { id: 'p-oct', amount: 40, memo: 'deposit', created_at: '2025-10-28T17:00:00Z', payment_date: null },
]
const rough = makeLaborJob({ id: 'rough', assigned_to_name: 'Brightline Electric', job_number: 'S-2117', address: '90 Alder St' })
rough.payments = [
  { id: 'p-check', amount: 25, memo: 'Check 1187', created_at: '2025-11-10T17:00:00Z', payment_date: '2025-11-10' },
  { id: 'p-back', amount: -5, memo: 'Broken vanity top', created_at: '2025-11-06T18:00:00Z', payment_date: null },
]

function props(over: Record<string, unknown> = {}) {
  return {
    error: null,
    laborJobs: [tile, rough],
    laborJobsLoading: false,
    laborJobNamesByJobId: {},
    laborJobAssigneesByJobId: new Map(),
    onOpenSheet: vi.fn(),
    onOpenPay: vi.fn(),
    ...over,
  } as unknown as Parameters<typeof SubPaymentsLedger>[0]
}
const lineIds = () => [...document.querySelectorAll('[data-ledger-line]')].map((e) => e.getAttribute('data-ledger-line'))
const showAll = () => fireEvent.click(screen.getByRole('button', { name: 'All' }))

describe('SubPaymentsLedger · at a desk', () => {
  it('lists every payment and back-charge newest first, under its month with the month total', async () => {
    narrow.on = false
    renderWithProviders(<SubPaymentsLedger {...props()} />)
    await settle()
    showAll()
    expect(lineIds()).toEqual(['p-nov', 'p-check', 'p-back', 'p-oct'])
    const months = [...document.querySelectorAll('[data-ledger-month]')]
    expect(months.map((m) => m.getAttribute('data-ledger-month'))).toEqual(['2025-11', '2025-10'])
    expect(months[0]!.textContent).toContain('November 2025')
    expect(months[0]!.textContent).toContain('2 payments · 1 back-charge')
    expect(months[1]!.textContent).toContain('1 payment')
    // The last payment settles the sheet, the one before it left the rest owing.
    expect(document.querySelector('[data-ledger-line="p-nov"]')!.textContent).toContain('paid in full')
    expect(document.querySelector('[data-ledger-line="p-back"]')!.textContent).toContain('Back-charge')
    expect(document.querySelector('[data-ledger-line="p-back"]')!.textContent).toContain('Broken vanity top')
    // A payment saved with no Date sent says so.
    expect(document.querySelector('[data-ledger-line="p-oct"]')!.textContent).toContain('no date sent')
    expect(document.querySelector('[data-ledger-tile="paid"]')!.textContent).toContain('3 payments to 2 people')
    expect(document.querySelector('[data-ledger-tile="backcharged"]')!.textContent).toContain('1 back-charge')
    expect(document.querySelector('[data-ledger-tile="undated"]')!.textContent).toContain('1')
    expect(document.querySelector('[data-ledger-foot]')!.textContent).toContain('All · 3 payments to 2 people, less 1 back-charge')
  })

  it('a search, the Paid to picker and a period each narrow the list', async () => {
    narrow.on = false
    renderWithProviders(<SubPaymentsLedger {...props()} />)
    await settle()
    showAll()
    fireEvent.change(screen.getByLabelText('Search the ledger'), { target: { value: 'check 1187' } })
    expect(lineIds()).toEqual(['p-check'])
    fireEvent.change(screen.getByLabelText('Search the ledger'), { target: { value: '' } })
    const picker = screen.getByLabelText('Paid to') as HTMLSelectElement
    expect([...picker.options].map((o) => o.textContent)).toEqual(['Paid to: everyone', 'Brightline Electric', 'Calloway Tile'])
    fireEvent.change(picker, { target: { value: picker.options[2]!.value } })
    expect(lineIds()).toEqual(['p-nov', 'p-oct'])
    fireEvent.change(picker, { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2025-11-01' } })
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2025-11-10' } })
    expect(lineIds()).toEqual(['p-check', 'p-back'])
  })

  it("a line's job opens its sheet", async () => {
    narrow.on = false
    const p = props()
    renderWithProviders(<SubPaymentsLedger {...p} />)
    await settle()
    showAll()
    fireEvent.click(document.querySelector('[data-ledger-line="p-check"] button[title="Open the sheet"]') as HTMLElement)
    expect(p.onOpenSheet).toHaveBeenCalledWith(expect.objectContaining({ id: 'rough' }))
  })

  it('an empty period names the way out, a search that finds nothing offers to clear, and no payment at all points at Pay', async () => {
    narrow.on = false
    const p = props()
    const view = renderWithProviders(<SubPaymentsLedger {...p} />)
    await settle()
    // Every line is in 2025, so the opening period, this month, is empty.
    expect(document.querySelector('[data-empty-state]')!.textContent).toContain('Nothing was paid in this period.')
    fireEvent.click(screen.getByRole('button', { name: 'Show all dates' }))
    expect(lineIds()).toHaveLength(4)
    fireEvent.change(screen.getByLabelText('Search the ledger'), { target: { value: 'nobody' } })
    expect(document.querySelector('[data-empty-state]')!.textContent).toContain('Nothing here matches “nobody”.')
    fireEvent.click(screen.getByRole('button', { name: 'Clear the search' }))
    expect(lineIds()).toHaveLength(4)
    view.unmount()
    renderWithProviders(<SubPaymentsLedger {...props({ laborJobs: [makeLaborJob({ id: 'bare' })], onOpenPay: p.onOpenPay })} />)
    await settle()
    expect(document.querySelector('[data-empty-state]')!.textContent).toContain('Nothing has been paid on a sub sheet yet.')
    fireEvent.click(screen.getByRole('button', { name: 'Pay' }))
    expect(p.onOpenPay).toHaveBeenCalled()
  })
})

describe('SubPaymentsLedger · on a phone', () => {
  it('draws cards, not the table, and a card opens its sheet', async () => {
    narrow.on = true
    const p = props()
    renderWithProviders(<SubPaymentsLedger {...p} />)
    await settle()
    showAll()
    expect(document.querySelector('table')).toBeNull()
    expect(document.querySelector('[data-ledger-phone]')).not.toBeNull()
    expect(lineIds()).toEqual(['p-nov', 'p-check', 'p-back', 'p-oct'])
    const card = document.querySelector('[data-ledger-line="p-nov"]') as HTMLElement
    expect(card.textContent).toContain('Calloway Tile')
    expect(card.textContent).toContain('Zelle · final on tile')
    fireEvent.click(card)
    expect(p.onOpenSheet).toHaveBeenCalledWith(expect.objectContaining({ id: 'tile' }))
  })
})
