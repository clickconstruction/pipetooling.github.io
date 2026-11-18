// @vitest-environment jsdom
/**
 * The Supply houses tab's own render test: the guard for its decomposition (docs/MATERIALS_TABS_ARCHITECTURE.md,
 * "SupplyHousesTab extraction order", step 6).
 *
 * Written against the tab before any of its windows or its state moved, and meant to pass unedited after each move.
 * It reads what the office reads and presses what the office presses: the book and its total, a house opened three
 * ways, the bill form opened, saved, edited and deleted, a bill marked paid in place, the aging cell window with its
 * doors, the move window's worked list, Create PO, and a role the gate turns away.
 *
 * The database is a small stateful stand-in: tables are arrays of rows, `eq` / `in` / `is` filter them, a write
 * changes them and is recorded. Every row here is made up.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'

type Row = Record<string, unknown>
type Write = { table: string; op: 'insert' | 'update' | 'delete' | 'upsert'; values?: unknown; filters: [string, string, unknown][] }

const fake = vi.hoisted(() => {
  type R = Record<string, unknown>
  const state = {
    db: {} as Record<string, R[]>,
    writes: [] as { table: string; op: 'insert' | 'update' | 'delete' | 'upsert'; values?: unknown; filters: [string, string, unknown][] }[],
    rpcs: [] as { name: string; args: unknown }[],
    invokes: [] as { name: string; body: unknown }[],
    role: 'dev' as string,
    seq: 0,
    /** A write to refuse, keyed `table:op`, with the words the database would say. */
    fail: {} as Record<string, string>,
  }
  const rowsOf = (name: string): R[] => state.db[name] ?? []
  function table(name: string) {
    const filters: [string, string, unknown][] = []
    let op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select'
    let values: unknown
    let single = false
    let range: [number, number] | null = null
    const match = (r: R): boolean =>
      filters.every(([kind, col, val]) => (kind === 'eq' ? r[col] === val : kind === 'in' ? (val as unknown[]).includes(r[col]) : kind === 'is' ? (r[col] ?? null) === val : true))
    const run = () => {
      const refused = state.fail[`${name}:${op}`]
      if (refused) return { data: null, error: { message: refused } }
      if (op === 'select') {
        let rows = rowsOf(name).filter(match).map((r) => ({ ...r }))
        if (range) rows = rows.slice(range[0], range[1] + 1)
        return { data: single ? (rows[0] ?? null) : rows, error: null, count: rows.length }
      }
      if (op === 'insert' || op === 'upsert') {
        const made = (Array.isArray(values) ? values : [values]).map((v) => ({ id: `${name}-new-${++state.seq}`, ...(v as R) }))
        state.db[name] = [...rowsOf(name), ...made]
        state.writes.push({ table: name, op, values, filters: [] })
        return { data: single ? { ...made[0] } : made.map((r) => ({ ...r })), error: null }
      }
      if (op === 'update') {
        const hit: R[] = []
        state.db[name] = rowsOf(name).map((r) => {
          if (!match(r)) return r
          const next = { ...r, ...(values as R) }
          hit.push(next)
          return next
        })
        state.writes.push({ table: name, op, values, filters: [...filters] })
        return { data: single ? (hit[0] ? { ...hit[0] } : null) : hit.map((r) => ({ ...r })), error: null }
      }
      state.db[name] = rowsOf(name).filter((r) => !match(r))
      state.writes.push({ table: name, op, filters: [...filters] })
      return { data: null, error: null }
    }
    const b: Record<string, unknown> = {}
    for (const m of ['neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'or', 'not', 'contains', 'filter', 'order', 'limit', 'abortSignal', 'select']) b[m] = () => b
    b.range = (from: number, to: number) => ((range = [from, to]), b)
    b.insert = (v: unknown) => ((op = 'insert'), (values = v), b)
    b.upsert = (v: unknown) => ((op = 'upsert'), (values = v), b)
    b.update = (v: unknown) => ((op = 'update'), (values = v), b)
    b.delete = () => ((op = 'delete'), b)
    b.eq = (c: string, v: unknown) => (filters.push(['eq', c, v]), b)
    b.in = (c: string, v: unknown) => (filters.push(['in', c, v]), b)
    b.is = (c: string, v: unknown) => (filters.push(['is', c, v]), b)
    b.single = () => ((single = true), b)
    b.maybeSingle = () => ((single = true), b)
    b.then = (f?: (v: unknown) => unknown, r?: (e: unknown) => unknown) => Promise.resolve(run()).then(f, r)
    b.catch = (r?: (e: unknown) => unknown) => Promise.resolve(run()).catch(r)
    b.finally = (fin?: () => void) => Promise.resolve(run()).finally(fin)
    return b
  }
  function rpc(name: string, args: unknown) {
    state.rpcs.push({ name, args })
    const a = (args ?? {}) as { p_job_ids?: string[]; search_text?: string }
    const data =
      name === 'get_jobs_ledger_by_ids'
        ? rowsOf('jobs_ledger').filter((j) => (a.p_job_ids ?? []).includes(j.id as string))
        : name === 'search_jobs_ledger'
          ? rowsOf('jobs_ledger').filter((j) => String(j.job_name).toLowerCase().includes((a.search_text ?? '').toLowerCase()))
          : []
    const b: Record<string, unknown> = {}
    for (const m of ['abortSignal', 'select', 'order', 'limit', 'eq', 'in', 'range']) b[m] = () => b
    b.then = (f?: (v: unknown) => unknown, r?: (e: unknown) => unknown) => Promise.resolve({ data, error: null }).then(f, r)
    return b
  }
  return { state, table, rpc }
})

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return {
    supabase: {
      ...makeSupabaseStub(),
      from: (name: string) => fake.table(name),
      rpc: (name: string, args: unknown) => fake.rpc(name, args),
      functions: { invoke: (name: string, opts: { body?: unknown }) => (fake.state.invokes.push({ name, body: opts?.body }), Promise.resolve({ data: { asked: [], sent_to: 'rep@example.test' }, error: null })) },
    },
  }
})

vi.mock('../hooks/useAuth', async () => {
  const { makeUseAuthValue } = await import('../test/renderSmokeMocks')
  const useAuth = () => makeUseAuthValue({ role: fake.state.role })
  return { useAuth, useOptionalAuth: useAuth, AuthProvider: ({ children }: { children: unknown }) => children }
})

import { SupplyHousesTab } from './SupplyHousesTab'
import { renderWithProviders, settle } from '../test/renderSmokeMocks'
import { todayYmdInAppTz, ymdAddDays } from '../utils/dateUtils'
import { agingCellTitle, nextMonthlyPaymentDueYmd } from '../lib/supplyHouseAging'

const TODAY = todayYmdInAppTz()
const inDays = (n: number): string => ymdAddDays(TODAY, n)

const house = (id: string, name: string, over: Row = {}): Row => ({ id, name, phone: null, address: null, notes: null, website_url: null, monthly_payment_day: 10, vendor_kind: 'supply_house', job_accounts: null, created_at: null, updated_at: null, ...over })
const bill = (id: string, supply_house_id: string, over: Row = {}): Row => ({
  id,
  supply_house_id,
  invoice_number: `S-${id}`,
  purchase_order_number: null,
  invoice_date: inDays(-10),
  due_date: inDays(20),
  amount: 100,
  amount_paid: 0,
  is_paid: false,
  paid_at: null,
  updated_at: null,
  link: null,
  payment_link: null,
  on_job_account: false,
  document_kind: 'invoice',
  credits_invoice_id: null,
  is_interest: false,
  late_invoice_id: null,
  bill_read: null,
  ...over,
})

/** Two houses. Ridge owes on three bills (one paid in part, one long past due, one on a job) and has one paid; Canal owes on one. */
function seed(): void {
  fake.state.db = {
    supply_houses: [house('h-ridge', 'Ridge Supply'), house('h-canal', 'Canal Pipe', { monthly_payment_day: null })],
    supply_house_invoices: [
      bill('part', 'h-ridge', { amount: 800, amount_paid: 300 }),
      bill('late', 'h-ridge', { amount: 250, due_date: inDays(-75) }),
      bill('job', 'h-ridge', { amount: 60 }),
      bill('done', 'h-ridge', { amount: 40, is_paid: true, paid_at: `${inDays(-3)}T18:00:00Z` }),
      bill('canal', 'h-canal', { amount: 500 }),
    ],
    supply_house_invoice_job_allocations: [{ invoice_id: 'job', job_id: 'j-elm', pct: 100 }],
    jobs_ledger: [{ id: 'j-elm', hcp_number: '1017', click_number: '', job_name: 'Elm Street', job_address: '1 Elm St' }, { id: 'j-oak', hcp_number: '988', click_number: '', job_name: 'Oak Court', job_address: '9 Oak Ct' }],
    // The payment that took $300 of S-part, with its line, as the house's payments read returns it.
    supply_house_payments: [{ id: 'pay-1', supply_house_id: 'h-ridge', paid_on: inDays(-2), amount: 300, method: 'ach', method_ref: '88213', receipt_link: null, source: 'typed', removed_at: null, supply_house_payment_lines: [{ id: 'line-1', payment_id: 'pay-1', invoice_id: 'part', amount: 300 }] }],
    purchase_orders: [],
    service_types: [{ id: 'st-1', billing_only: false, sequence_order: 1 }],
  }
  fake.state.writes = []
  fake.state.rpcs = []
  fake.state.invokes = []
  fake.state.role = 'dev'
  fake.state.seq = 0
  fake.state.fail = {}
  try {
    localStorage.clear()
  } catch {
    /* no storage in this run */
  }
  // jsdom has no scrollTo; the form's scroll lock puts the page back with it when a window closes.
  window.scrollTo = () => {}
}

const writesTo = (table: string, op?: Write['op']): Write[] => fake.state.writes.filter((w) => w.table === table && (!op || w.op === op))
const houseRow = (id: string): HTMLElement => document.querySelector<HTMLElement>(`[data-supply-house-row="${id}"]`)!

/** The tab once its book has read: the houses are in the summary table. */
async function renderTab(props: Parameters<typeof SupplyHousesTab>[0] = {}) {
  const view = renderWithProviders(<SupplyHousesTab {...props} />)
  await waitFor(() => expect(houseRow('h-ridge')).toBeTruthy())
  await settle()
  return view
}

/** Open a house from the summary table, and wait for its bills. */
async function openHouse(id: string, aBill: string): Promise<void> {
  fireEvent.click(houseRow(id))
  await screen.findByText(new RegExp(aBill))
  await settle()
}

const dialog = (name: RegExp): HTMLElement => screen.getByRole('dialog', { name })

beforeEach(() => seed())

describe('SupplyHousesTab — the book', () => {
  it('mounts bare, as Quickfill mounts it: loads its own houses and reads the role from the session', async () => {
    await renderTab()
    expect(screen.getByRole('heading', { name: 'Accounts payable' })).toBeTruthy()
    expect(screen.getByText(/2 vendors — houses, reps and websites/)).toBeTruthy()
    expect(houseRow('h-canal')).toBeTruthy()
  })

  it('counts a bill paid in part for what is left on it, in the house’s balance and in the total', async () => {
    await renderTab()
    // Ridge: 500 left of 800, plus 250, plus 60. Canal: 500.
    expect(within(houseRow('h-ridge')).getByText('$810.00')).toBeTruthy()
    expect(within(houseRow('h-canal')).getByText('$500.00')).toBeTruthy()
    expect(screen.getByText(/Supply Houses: \$1,310\.00/)).toBeTruthy()
  })

  it('lists the most owed house first, and says how many houses are 60 or more days past due', async () => {
    await renderTab()
    const rows = [...document.querySelectorAll('[data-supply-house-row]')].map((r) => r.getAttribute('data-supply-house-row'))
    expect(rows).toEqual(['h-ridge', 'h-canal'])
    expect(screen.getByText(/1 house 60\+ past due/)).toBeTruthy()
  })

  it('draws nothing for a role the gate turns away, and does not throw', async () => {
    fake.state.role = 'primary'
    const view = renderWithProviders(<SupplyHousesTab />)
    await settle()
    expect(view.container.textContent).toBe('')
  })

  it('takes the role and the houses from Materials when it passes them', async () => {
    fake.state.role = 'primary'
    await renderTab({ myRole: 'dev', supplyHouses: fake.state.db.supply_houses as never })
    expect(screen.getByRole('heading', { name: 'Accounts payable' })).toBeTruthy()
  })
})

const byId = <T extends HTMLElement = HTMLInputElement>(id: string): T => document.getElementById(id) as T
const type = (id: string, value: string): void => {
  fireEvent.change(byId(id), { target: { value } })
}
const press = (name: string | RegExp, within_: HTMLElement = document.body): void => {
  fireEvent.click(within(within_).getByRole('button', { name }))
}
const agingCell = (houseName: string, cell: Parameters<typeof agingCellTitle>[0]): HTMLElement => document.querySelector<HTMLElement>(`td[title="${houseName} — ${agingCellTitle(cell)}: see the invoices"]`)!

describe('SupplyHousesTab — a house and its bills', () => {
  it('opens a house from the summary and lists its unpaid bills, each for what is left on it', async () => {
    await renderTab()
    await openHouse('h-ridge', 'S-part')
    expect(screen.getByText(/S-late/)).toBeTruthy()
    expect(screen.getByText(/S-job/)).toBeTruthy()
    expect(screen.queryByText(/S-done/)).toBeNull()
    expect(screen.getByText(/\$300\.00 paid · \$500\.00 left of \$800\.00/)).toBeTruthy()
    expect(screen.getAllByText(/1017 · Elm Street/).length).toBeGreaterThan(0)
    expect(screen.getByText('pays on the 10th')).toBeTruthy()
  })

  it('Show paid invoices lists the paid bill too, and the choice is remembered on the device', async () => {
    await renderTab()
    await openHouse('h-ridge', 'S-part')
    fireEvent.click(screen.getByLabelText('Show paid invoices'))
    await screen.findByText(/S-done/)
    expect(localStorage.getItem('supplyHouses.accountsPayable.show-paid-invoices')).toBe('1')
  })

  it('closes the house when its row is pressed again', async () => {
    await renderTab()
    await openHouse('h-ridge', 'S-part')
    fireEvent.click(houseRow('h-ridge'))
    await waitFor(() => expect(screen.queryByText(/S-part/)).toBeNull())
  })

  it('opens the house a link names, once, and says it has', async () => {
    const handled = vi.fn()
    await renderTab({ autoOpenHouseId: 'h-canal', onAutoOpenHouseHandled: handled })
    await screen.findByText(/S-canal/)
    expect(handled).toHaveBeenCalledTimes(1)
  })

  it('marks a bill paid in place: one write, and the bill stays where it was with Mark unpaid', async () => {
    await renderTab()
    await openHouse('h-ridge', 'S-part')
    press('Mark paid: S-job')
    await screen.findByRole('button', { name: 'Mark unpaid: S-job' })
    expect(writesTo('supply_house_invoices', 'update')).toEqual([{ table: 'supply_house_invoices', op: 'update', values: { is_paid: true }, filters: [['eq', 'id', 'job']] }])
    // The balance reads the book again: 500 + 250 are left on Ridge.
    await waitFor(() => expect(within(houseRow('h-ridge')).getByText('$750.00')).toBeTruthy())
  })

  it('Record a payment opens the house’s payment window', async () => {
    await renderTab()
    await openHouse('h-ridge', 'S-part')
    press('Record a payment')
    expect(await screen.findByTestId('record-supply-payment')).toBeTruthy()
  })

  it('Create PO writes a draft for the house and hands its id to the PO door', async () => {
    const toPo = vi.fn()
    await renderTab({ onNavigateToPO: toPo, selectedServiceTypeId: 'st-1' })
    await openHouse('h-ridge', 'S-part')
    fireEvent.click(screen.getAllByRole('button', { name: 'Create PO' })[0]!)
    await waitFor(() => expect(toPo).toHaveBeenCalledTimes(1))
    const [insert] = writesTo('purchase_orders', 'insert')
    expect(insert?.values).toMatchObject({ status: 'draft', supply_house_id: 'h-ridge', service_type_id: 'st-1', notes: null })
    expect(toPo).toHaveBeenCalledWith('purchase_orders-new-1')
  })
})

describe('SupplyHousesTab — the bill form', () => {
  async function openAdd(): Promise<HTMLElement> {
    await renderTab()
    await openHouse('h-ridge', 'S-part')
    press('Add Invoice')
    return dialog(/^Add invoice$/)
  }

  it('Add invoice starts dated today and due on the house’s next pay day', async () => {
    await openAdd()
    expect(byId('invoice-number').value).toBe('')
    expect(byId('invoice-date').value).toBe(TODAY)
    expect(byId('invoice-due').value).toBe(nextMonthlyPaymentDueYmd(10, TODAY))
    expect(byId('invoice-amount').value).toBe('')
  })

  it('saves a typed bill: one insert on the open house, the form closes, the bill is listed and the balance moves', async () => {
    const form = await openAdd()
    type('invoice-number', 'S-new')
    type('invoice-amount', '123.45')
    press('Save invoice', form)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /^Add invoice$/ })).toBeNull())
    const [insert] = writesTo('supply_house_invoices', 'insert')
    expect(insert?.values).toMatchObject({ supply_house_id: 'h-ridge', invoice_number: 'S-new', amount: 123.45, invoice_date: TODAY, due_date: nextMonthlyPaymentDueYmd(10, TODAY), is_paid: false, document_kind: 'invoice' })
    expect(writesTo('supply_house_invoice_job_allocations')).toEqual([])
    await screen.findByText(/S-new/)
    await waitFor(() => expect(within(houseRow('h-ridge')).getByText('$933.45')).toBeTruthy())
  })

  it('a job picked in the form goes on the bill at 100%, and an open account at the house turns the flag on', async () => {
    fake.state.db.job_supply_house_accounts = [{ id: 'acc-1', job_id: 'j-oak', supply_house_id: 'h-ridge', status: 'open', account_ref: '', opened_via: null, rep_contact_id: null, requested_by: null, requested_at: null, requested_from_counter: false, opened_by: null, opened_at: null, note: '' }]
    const form = await openAdd()
    type('invoice-number', 'S-oak')
    type('invoice-amount', '10')
    type('invoice-job-search', 'Oak')
    fireEvent.click(await within(form).findByText(/Oak Court/, {}, { timeout: 2000 }))
    await waitFor(() => expect(fake.state.rpcs.some((r) => r.name === 'search_jobs_ledger')).toBe(true))
    await settle()
    press('Save invoice', form)
    await waitFor(() => expect(writesTo('supply_house_invoices', 'insert')).toHaveLength(1))
    expect(writesTo('supply_house_invoices', 'insert')[0]?.values).toMatchObject({ invoice_number: 'S-oak', on_job_account: true })
    await waitFor(() => expect(writesTo('supply_house_invoice_job_allocations', 'insert')).toHaveLength(1))
    expect(writesTo('supply_house_invoice_job_allocations', 'insert')[0]?.values).toEqual([{ invoice_id: 'supply_house_invoices-new-1', job_id: 'j-oak', pct: 100 }])
  })

  it('a save the database refuses says why at the top of the tab, and the form stays open', async () => {
    const form = await openAdd()
    fake.state.fail['supply_house_invoices:insert'] = 'the house said no'
    type('invoice-number', 'S-new')
    type('invoice-amount', '5')
    press('Save invoice', form)
    await screen.findByText(/the house said no/)
    expect(screen.getByRole('dialog', { name: /^Add invoice$/ })).toBeTruthy()
  })

  it('Edit opens the bill’s own fields, and Save changes writes one update to that row', async () => {
    await renderTab()
    await openHouse('h-ridge', 'S-part')
    press('Edit S-late')
    const form = dialog(/^Edit invoice$/)
    expect(byId('invoice-number').value).toBe('S-late')
    expect(byId('invoice-amount').value).toBe('250')
    expect(byId('invoice-due').value).toBe(inDays(-75))
    type('invoice-amount', '300')
    press('Save changes', form)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /^Edit invoice$/ })).toBeNull())
    const [update] = writesTo('supply_house_invoices', 'update')
    expect(update?.filters).toEqual([['eq', 'id', 'late']])
    expect(update?.values).toMatchObject({ invoice_number: 'S-late', amount: 300 })
    // An edited bill on no job clears its jobs.
    expect(writesTo('supply_house_invoice_job_allocations', 'delete')).toHaveLength(1)
    await waitFor(() => expect(within(houseRow('h-ridge')).getByText('$860.00')).toBeTruthy())
  })

  it('Delete asks first, then removes the row and closes the form', async () => {
    await renderTab()
    await openHouse('h-ridge', 'S-part')
    press('Edit S-late')
    press('Delete', dialog(/^Edit invoice$/))
    await screen.findByText('Delete this invoice?')
    const confirms = screen.getAllByRole('button', { name: 'Delete' })
    fireEvent.click(confirms[confirms.length - 1]!)
    await waitFor(() => expect(writesTo('supply_house_invoices', 'delete')).toEqual([{ table: 'supply_house_invoices', op: 'delete', filters: [['eq', 'id', 'late']] }]))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /^Edit invoice$/ })).toBeNull())
    await waitFor(() => expect(screen.queryByText(/S-late/)).toBeNull())
  })

  it('the × closes the form and writes nothing', async () => {
    const form = await openAdd()
    type('invoice-number', 'S-never')
    press('Close', form)
    expect(screen.queryByRole('dialog', { name: /^Add invoice$/ })).toBeNull()
    expect(fake.state.writes).toEqual([])
  })
})

describe('SupplyHousesTab — the aging windows', () => {
  it('a money cell opens the bills it sums, and the bill’s number opens its Edit window over the cell', async () => {
    await renderTab()
    fireEvent.click(agingCell('Ridge Supply', 'past60_90'))
    const cell = await screen.findByRole('dialog', { name: `Ridge Supply, ${agingCellTitle('past60_90')}` })
    expect(within(cell).getByText('S-late')).toBeTruthy()
    expect(within(cell).queryByText('S-part')).toBeNull()
    press('Edit invoice S-late', cell)
    await screen.findByRole('dialog', { name: /^Edit invoice$/ })
    expect(byId('invoice-number').value).toBe('S-late')
    // The cell's window stays under the form.
    expect(screen.getByRole('dialog', { name: `Ridge Supply, ${agingCellTitle('past60_90')}` })).toBeTruthy()
  })

  it('a current cell lists its bills under their job, and Record a payment › opens the house’s payment window', async () => {
    await renderTab()
    fireEvent.click(agingCell('Ridge Supply', 'current'))
    const cell = await screen.findByRole('dialog', { name: `Ridge Supply, ${agingCellTitle('current')}` })
    await within(cell).findByText(/Elm Street/)
    expect(within(cell).getByText('S-job')).toBeTruthy()
    expect(within(cell).getByText('S-part')).toBeTruthy()
    press('Record a payment ›', cell)
    expect(await screen.findByTestId('record-supply-payment')).toBeTruthy()
  })

  it('the move window’s strip counts the still-current charge on one job, and Work the list opens it', async () => {
    await renderTab()
    press(/Work the list/)
    const list = await screen.findByRole('dialog', { name: 'Still movable: current charges not on a job account' })
    await within(list).findByText('S-job')
    expect(within(list).queryByText('S-part')).toBeNull()
  })

  it('the Needs You door opens the worked list once the book and its jobs have read, and says it has', async () => {
    const handled = vi.fn()
    await renderTab({ openList: 'movable', onOpenListHandled: handled })
    const list = await screen.findByRole('dialog', { name: 'Still movable: current charges not on a job account' })
    await within(list).findByText('S-job')
    expect(handled).toHaveBeenCalledTimes(1)
  })

  it('a job whose account at the house is marked not needed leaves the move window', async () => {
    fake.state.db.job_supply_house_accounts = [{ id: 'acc-2', job_id: 'j-elm', supply_house_id: 'h-ridge', status: 'not_needed' }]
    await renderTab()
    await act(async () => {})
    expect(screen.queryByRole('button', { name: /Work the list/ })).toBeNull()
  })
})

describe('SupplyHousesTab — payments, the flag and the phone', () => {
  it('a paid bill a typed payment stands behind opens that payment, and writes nothing', async () => {
    // The payment that paid S-done whole.
    fake.state.db.supply_house_payments!.push({ id: 'pay-2', supply_house_id: 'h-ridge', paid_on: inDays(-3), amount: 40, method: 'check', method_ref: '1042', receipt_link: null, source: 'typed', removed_at: null, supply_house_payment_lines: [{ id: 'line-2', payment_id: 'pay-2', invoice_id: 'done', amount: 40 }] })
    await renderTab()
    await openHouse('h-ridge', 'S-part')
    fireEvent.click(screen.getByLabelText('Show paid invoices'))
    press(await screen.findByRole('button', { name: 'See the payment: S-done' }).then((b) => b.getAttribute('aria-label')!))
    expect(await screen.findByTestId('supply-payment-window')).toBeTruthy()
    expect(writesTo('supply_house_invoices')).toEqual([])
  })

  it('Mark it on, in an aging cell’s window, flags the bill with one write', async () => {
    // S-late is on one job, past its window, and the job's account at the house is open: its row offers Mark it on.
    fake.state.db.supply_house_invoice_job_allocations!.push({ invoice_id: 'late', job_id: 'j-elm', pct: 100 })
    fake.state.db.job_supply_house_accounts = [{ id: 'acc-3', job_id: 'j-elm', supply_house_id: 'h-ridge', status: 'open', account_ref: '', opened_via: null, rep_contact_id: null, requested_by: null, requested_at: null, requested_from_counter: false, opened_by: null, opened_at: null, note: '' }]
    await renderTab()
    fireEvent.click(agingCell('Ridge Supply', 'past60_90'))
    const cell = await screen.findByRole('dialog', { name: `Ridge Supply, ${agingCellTitle('past60_90')}` })
    fireEvent.click(await within(cell).findByRole('button', { name: 'Mark it on' }))
    await waitFor(() => expect(writesTo('supply_house_invoices', 'update')).toEqual([{ table: 'supply_house_invoices', op: 'update', values: { on_job_account: true }, filters: [['eq', 'id', 'late']] }]))
  })

  it('on a phone the houses are a list, and a house opens its own screen', async () => {
    const wide = window.matchMedia
    window.matchMedia = ((query: string) => ({ matches: query === '(max-width: 640px)', media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia
    try {
      renderWithProviders(<SupplyHousesTab />)
      const list = await waitFor(() => {
        const el = document.querySelector<HTMLElement>('[data-supply-house-phone-list]')
        if (!el) throw new Error('no phone list yet')
        return el
      })
      fireEvent.click(await within(list).findByText('Ridge Supply'))
      const phone = await waitFor(() => {
        const el = document.querySelector<HTMLElement>('[data-supply-house-phone]')
        if (!el) throw new Error('no phone screen yet')
        return el
      })
      await within(phone).findByText(/S-late/)
    } finally {
      window.matchMedia = wide
    }
  })
})
