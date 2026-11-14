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

describe('SubPaymentsLedger · by sub (PR 3)', () => {
  const bySub = () => fireEvent.click(screen.getByRole('button', { name: 'By sub' }))
  const subKeys = () => [...document.querySelectorAll('[data-ledger-sub]')].map((e) => e.getAttribute('data-ledger-sub'))

  it('a line says how it was sent, with its check number', async () => {
    narrow.on = false
    const withCheck = makeLaborJob({ id: 'chk', assigned_to_name: 'Harlow Drywall', job_number: 'S-2200', address: '3 Juniper Way' })
    withCheck.payments = [{ id: 'p-how', amount: 10, memo: 'draw', created_at: '2025-11-03T17:00:00Z', payment_date: '2025-11-03', method: 'check', method_ref: '1042' }]
    renderWithProviders(<SubPaymentsLedger {...props({ laborJobs: [withCheck, rough] })} />)
    await settle()
    showAll()
    expect(document.querySelector('[data-ledger-how="p-how"]')!.textContent).toBe('Check 1042')
    expect(document.querySelector('[data-ledger-how="p-check"]')!.textContent).toBe('—')
  })

  it('By sub is one row per person with what was paid and what we owe today', async () => {
    narrow.on = false
    renderWithProviders(<SubPaymentsLedger {...props()} />)
    await settle()
    showAll()
    bySub()
    expect(lineIds()).toEqual([])
    expect(subKeys()).toHaveLength(2)
    const rows = [...document.querySelectorAll('[data-ledger-sub]')].map((e) => e.textContent ?? '')
    expect(rows[0]).toContain('Brightline Electric')
    expect(rows[0]).toContain('1 payment')
    expect(rows[1]).toContain('Calloway Tile')
    expect(rows[1]).toContain('2 payments')
    expect(rows[1]).toContain('settled')
    expect(document.querySelector('[data-ledger-tile="owed"]')!.textContent).toContain('We owe today')
    expect(document.querySelector('[data-ledger-people-foot]')!.textContent).toContain('2 people · 3 payments')
  })

  it('a name opens that person’s statement, oldest first, ending on what we owe, and Everyone goes back', async () => {
    narrow.on = false
    const onSubChange = vi.fn()
    renderWithProviders(<SubPaymentsLedger {...props({ initialBy: 'sub', onSubChange })} />)
    await settle()
    showAll()
    fireEvent.click(screen.getByRole('button', { name: 'Calloway Tile' }))
    const statement = document.querySelector('[data-ledger-statement]')!
    const ids = [...statement.querySelectorAll('[data-statement-line]')].map((e) => e.getAttribute('data-statement-line'))
    expect(ids).toEqual(['sheet:tile', 'p-oct', 'p-nov'])
    expect(statement.querySelector('[data-statement-foot]')!.textContent).toContain('We owe today')
    expect(statement.querySelector('[data-statement-foot]')!.textContent).toContain('settled')
    // No roster figure was handed in, so the foot says what we owe and checks nothing.
    expect(statement.querySelector('[data-statement-check]')!.getAttribute('data-statement-check')).toBe('unknown')
    expect(onSubChange).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('searchbox')).toBeNull()
    expect(screen.getByRole('button', { name: 'Print the statement' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '‹ Everyone' }))
    expect(document.querySelector('[data-ledger-statement]')).toBeNull()
    expect(subKeys()).toHaveLength(2)
  })

  it('the address can open one person’s statement, and the roster’s Balance due is checked at its foot', async () => {
    narrow.on = false
    const assignees = new Map([['rough', [{ personId: 'p-bright', personName: 'Brightline Electric' }]]])
    const owed = subLaborJobBalance(rough).balance
    renderWithProviders(<SubPaymentsLedger {...props({ by: 'sub', sub: 'p-bright', laborJobAssigneesByJobId: assignees, balanceDueByPersonId: new Map([['p-bright', owed]]) })} />)
    await settle()
    showAll()
    const statement = document.querySelector('[data-ledger-statement="id:p-bright"]')!
    expect(statement.querySelector('[data-statement-check]')!.getAttribute('data-statement-check')).toBe('agrees')
    expect(statement.querySelector('[data-statement-check]')!.textContent).toContain('Agrees with People → Subs')
    cleanup()
    renderWithProviders(<SubPaymentsLedger {...props({ by: 'sub', sub: 'p-bright', laborJobAssigneesByJobId: assignees, balanceDueByPersonId: new Map([['p-bright', owed + 50]]) })} />)
    await settle()
    expect(document.querySelector('[data-statement-check]')!.getAttribute('data-statement-check')).toBe('differs')
  })

  it('a statement line opens its sheet, and on a phone both views are cards', async () => {
    narrow.on = true
    const onOpenSheet = vi.fn()
    renderWithProviders(<SubPaymentsLedger {...props({ initialBy: 'sub', onOpenSheet })} />)
    await settle()
    showAll()
    expect(document.querySelector('[data-ledger-people-phone]')).toBeTruthy()
    fireEvent.click(document.querySelector('[data-ledger-sub]') as HTMLElement)
    const line = document.querySelector('[data-statement-line="p-check"]') as HTMLElement
    expect(line.tagName).toBe('BUTTON')
    fireEvent.click(line)
    expect(onOpenSheet).toHaveBeenCalledWith(rough)
    narrow.on = false
  })
})
