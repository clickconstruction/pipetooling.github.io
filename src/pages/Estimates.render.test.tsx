// @vitest-environment jsdom
/**
 * Render smoke for the Estimates page — the safety net for the cuts that move regions out of
 * `EstimateDetail` (docs/ESTIMATES_TABS_ARCHITECTURE.md, the sent side first). It mounts the page
 * at `/estimates` and `/estimates/:id` against a stateful Supabase stand-in and reads what a
 * viewer sees: the Pipeline's lanes, a draft's editor, and a sent, an accepted and a declined
 * estimate's own controls. Then it presses the sent side's wired presses — Resend link, Mark
 * declined, Extend, Unlink job — and reads what each one called. Not a test of every region.
 */
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { ToastProvider } from '../contexts/ToastContext'
import { ConfirmDialogProvider } from '../contexts/ConfirmDialogContext'

type Row = Record<string, unknown>
type Step = { method: string; args: unknown[] }

const world = vi.hoisted(() => ({
  estimates: [] as Array<Record<string, unknown>>,
  customers: [] as Array<Record<string, unknown>>,
  writes: [] as Array<{ table: string; method: string; payload: unknown; filters: Array<[string, unknown]> }>,
  rpcs: [] as Array<{ name: string; args: unknown }>,
  sends: [] as Array<Record<string, unknown>>,
  /** How many times the detail page read its row. */
  rowReads: 0,
  /** What the database does to a draft's row after a write lands: another desk's edit, a value it settles. */
  afterUpdate: null as null | ((row: Record<string, unknown>) => Record<string, unknown>),
  /** The error a draft's write comes back with. */
  updateError: null as null | { message: string; code: string },
  /** The error the detail page's read of its row comes back with. */
  rowReadError: null as null | { message: string; code: string },
  /** While set, the detail page's read of its row waits on it: the time a save's read-back is in flight. */
  rowReadGate: null as null | Promise<void>,
}))

vi.mock('../lib/supabase', () => {
  const has = (steps: Step[], m: string) => steps.some((s) => s.method === m)
  const arg = (steps: Step[], m: string, i = 0) => steps.find((s) => s.method === m)?.args[i]
  const eqs = (steps: Step[]) => steps.filter((s) => s.method === 'eq').map((s) => [s.args[0], s.args[1]] as [string, unknown])
  const eqValue = (steps: Step[], col: string) => eqs(steps).find(([c]) => c === col)?.[1]

  const isWrite = (steps: Step[]) => ['insert', 'update', 'delete', 'upsert'].some((m) => has(steps, m))
  const isRowRead = (table: string, steps: Step[]) => table === 'estimates' && !isWrite(steps) && (eqValue(steps, 'id') !== undefined || eqValue(steps, 'estimate_number') !== undefined)

  function answer(table: string, steps: Step[]): { data: unknown; error: null | { message: string; code: string } } {
    const single = has(steps, 'single') || has(steps, 'maybeSingle')
    const list = (rows: Row[]) => ({ data: single ? (rows[0] ?? null) : rows, error: null })
    for (const m of ['insert', 'update', 'delete', 'upsert']) {
      if (has(steps, m)) {
        world.writes.push({ table, method: m, payload: arg(steps, m), filters: eqs(steps) })
        if (table === 'estimates' && m === 'update') {
          if (world.updateError) return { data: null, error: world.updateError }
          const id = eqValue(steps, 'id')
          const settle = world.afterUpdate ?? ((e: Row) => e)
          world.estimates = world.estimates.map((e) => (e.id === id ? settle({ ...e, ...(arg(steps, m) as Row) }) : e))
        }
        return { data: null, error: null }
      }
    }
    switch (table) {
      case 'estimates': {
        const id = eqValue(steps, 'id')
        const number = eqValue(steps, 'estimate_number')
        if (id !== undefined || number !== undefined) world.rowReads += 1
        if (isRowRead(table, steps) && world.rowReadError) return { data: null, error: world.rowReadError }
        if (id !== undefined) return list(world.estimates.filter((e) => e.id === id))
        if (number !== undefined) return list(world.estimates.filter((e) => e.estimate_number === number))
        return list(world.estimates)
      }
      case 'customers': {
        const id = eqValue(steps, 'id')
        return list(id === undefined ? world.customers : world.customers.filter((c) => c.id === id))
      }
      case 'users':
        return list(single ? [{ role: 'dev' }] : [])
      default:
        return list([])
    }
  }

  function chain(table: string) {
    const steps: Step[] = []
    const p: unknown = new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === 'then')
            return (resolve: (v: unknown) => void) => {
              const gate = isRowRead(table, steps) ? world.rowReadGate : null
              if (gate) void gate.then(() => resolve(answer(table, steps)))
              else resolve(answer(table, steps))
            }
          return (...a: unknown[]) => {
            steps.push({ method: String(prop), args: a })
            return p
          }
        },
      },
    )
    return p
  }

  return {
    supabase: {
      from: chain,
      rpc: (name: string, args: unknown) => {
        world.rpcs.push({ name, args })
        return chain(`rpc:${name}`)
      },
      functions: { invoke: async () => ({ data: null, error: null }) },
      auth: {
        getUser: async () => ({ data: { user: { id: 'smoke-auth-user-1' } }, error: null }),
        getSession: async () => ({ data: { session: null }, error: null }),
      },
      storage: { from: () => ({ createSignedUrl: async () => ({ data: null, error: null }) }) },
      channel: () => {
        const ch: Record<string, unknown> = {}
        ch.on = () => ch
        ch.subscribe = () => ch
        ch.unsubscribe = async () => 'ok'
        return ch
      },
      removeChannel: () => {},
    },
  }
})

vi.mock('../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../test/renderSmokeMocks')
  return useAuthModuleMock()
})

// The one call that emails a customer: the smoke records the request and answers a fresh link.
vi.mock('../lib/estimates/sendEstimateIo', async (orig) => {
  const real = await orig<typeof import('../lib/estimates/sendEstimateIo')>()
  return {
    ...real,
    postSendEstimate: async (request: Record<string, unknown>) => {
      world.sends.push(request)
      // A first send leaves the estimate sent, as the function does.
      if (request.mode === 'send') world.estimates = world.estimates.map((e) => (e.id === request.estimateId ? { ...e, status: 'sent', sent_at: new Date().toISOString(), customer_email: request.customerEmail } : e))
      return { kind: 'reply', httpOk: true, json: { ok: true, emailed: true, sent_to: 'owner@customer.test', accept_url: 'https://app.example/estimate/accept?t=fresh-token' } }
    },
  }
})

import Estimates from './Estimates'
import { installDomShims, settle } from '../test/renderSmokeMocks'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'

const CUSTOMER = { id: 'c1', name: 'ZZ Test Customer', address: '1 Main St', contact_info: { email: 'owner@customer.test', phone: '555-0100' }, date_met: null, master_user_id: 'm1', customer_type: null, archived_at: null }

/** A day `days` from today, as the database stores a date. */
function ymdFromToday(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function estimate(over: Row = {}): Row {
  return {
    id: 'e-1',
    estimate_number: 101,
    status: 'draft',
    doc_kind: 'estimate',
    title: 'ZZ Water heater swap',
    master_user_id: 'm1',
    created_by: 'smoke-auth-user-1',
    customer_id: 'c1',
    customer_email: null,
    customers: { name: CUSTOMER.name, address: CUSTOMER.address, contact_info: CUSTOMER.contact_info },
    jobs_ledger: null,
    line_items_snapshot: [{ line_item: 'ZZ Water heater', description: '', quantity: 1, unit_price_cents: 90_000, amount_cents: 90_000 }],
    options_snapshot: null,
    terms_snapshot: 'ZZ terms',
    total_cents: 90_000,
    valid_until: ymdFromToday(20),
    for_address: null,
    project_id: null,
    internal_notes: null,
    accept_notify_user_ids: [],
    accept_header_brand: null,
    change_order_fields: null,
    customer_attachment_url: null,
    customer_attachment_label: null,
    customer_attachment_sent: null,
    customer_experience_overrides: null,
    customer_experience_sent: null,
    acceptor_signature_storage_path: null,
    acceptor_name: null,
    acceptor_ip: null,
    accepted_at: null,
    sent_at: null,
    job_ledger_id: null,
    bid_id: null,
    bid_room_id: null,
    first_look_id: null,
    public_token_hash: null,
    created_at: '2026-11-01T15:00:00Z',
    updated_at: '2026-11-01T15:00:00Z',
    ...over,
  }
}

const sentRow = (over: Row = {}) => estimate({ id: 'e-2', estimate_number: 102, status: 'sent', title: 'ZZ Repipe', sent_at: new Date(Date.now() - 2 * 86_400_000).toISOString(), customer_email: 'owner@customer.test', ...over })
const acceptedRow = (over: Row = {}) =>
  estimate({ id: 'e-3', estimate_number: 103, status: 'customer_accepted', title: 'ZZ Slab leak', sent_at: '2026-11-02T15:00:00Z', accepted_at: '2026-11-03T15:00:00Z', acceptor_name: 'ZZ Signer', customer_email: 'owner@customer.test', ...over })

/** Where the router is, so a redirect can be read. */
function Where() {
  const location = useLocation()
  return <span data-testid="where">{location.pathname}</span>
}

function renderAt(route: string | { pathname: string; state: unknown }, rows: Row[]) {
  world.estimates = rows
  world.customers = [CUSTOMER]
  world.writes = []
  world.rpcs = []
  world.sends = []
  world.rowReads = 0
  world.afterUpdate = null
  world.updateError = null
  world.rowReadError = null
  world.rowReadGate = null
  installDomShims()
  return render(
    <Routes>
      <Route path="/estimates" element={<Estimates />} />
      <Route path="/estimates/:id" element={<Estimates />} />
      <Route path="/jobs" element={<p>jobs page</p>} />
    </Routes>,
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <ToastProvider>
          <ConfirmDialogProvider>
            <MemoryRouter initialEntries={[route]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <Where />
              {children}
            </MemoryRouter>
          </ConfirmDialogProvider>
        </ToastProvider>
      ),
    },
  )
}

afterEach(() => {
  vi.useRealTimers()
  cleanup()
  window.sessionStorage.clear()
})

describe('Estimates — the list', () => {
  it('draws the Pipeline’s lanes with each estimate in its own', async () => {
    renderAt('/estimates', [estimate(), sentRow(), acceptedRow()])
    expect(await screen.findByText('ZZ Water heater swap')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Estimates' })).toBeTruthy()
    for (const lane of ['Unsent', 'Sent', 'Accepted']) expect(screen.getByRole('heading', { name: lane })).toBeTruthy()
    expect(screen.getByText('ZZ Repipe')).toBeTruthy()
    expect(screen.getByText('ZZ Slab leak')).toBeTruthy()
    // No declined estimate, so no Declined lane.
    expect(screen.queryByRole('heading', { name: 'Declined' })).toBeNull()
  })

  it('shows the Ledger’s totals on its tab', async () => {
    renderAt('/estimates', [estimate(), sentRow()])
    await screen.findByText('ZZ Water heater swap')
    await settle()
    fireEvent.click(screen.getByRole('tab', { name: /Ledger/ }))
    expect(await screen.findByText('Outstanding sent')).toBeTruthy()
    expect(screen.getByText('Accepted this month')).toBeTruthy()
  })
})

describe('Estimates — a draft', () => {
  it('opens the editor: the rail, the customer, the lines and the draft’s presses', async () => {
    renderAt('/estimates/101', [estimate()])
    expect(await screen.findByRole('button', { name: 'Save draft' })).toBeTruthy()
    expect(screen.getAllByRole('navigation', { name: 'Draft steps' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Delete draft' })).toBeTruthy()
    expect(screen.getByDisplayValue('ZZ Water heater')).toBeTruthy()
    expect(screen.getByDisplayValue('ZZ terms')).toBeTruthy()
    expect(screen.getByText('Customer experience')).toBeTruthy()
    // The customer section and the line items, their own pieces since v2.7633.
    expect(screen.getByDisplayValue('ZZ Test Customer - 1 Main St')).toBeTruthy()
    expect(screen.getByText('555-0100', { exact: false })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add line' })).toBeTruthy()
    // The two fieldsets that are their own pieces (v2.7618): Supporting document and Delivery.
    expect(screen.getByRole('button', { name: 'Check link' })).toBeTruthy()
    expect(screen.getByText('Email when customer accepts')).toBeTruthy()
    expect(screen.getByText('Internal notes')).toBeTruthy()
    // Nothing of the sent side on a draft.
    expect(screen.queryByTestId('estimate-resend-link-panel')).toBeNull()
    expect(screen.queryByText('Acceptance notify recipients')).toBeNull()
  })

  it('asks before Delete draft, and deletes only a draft', async () => {
    renderAt('/estimates/101', [estimate()])
    const del = await screen.findByRole('button', { name: 'Delete draft' })
    await settle()
    fireEvent.click(del)
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Delete this draft?')).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(world.writes.some((w) => w.table === 'estimates' && w.method === 'delete')).toBe(true))
    const write = world.writes.find((w) => w.method === 'delete')!
    expect(write.filters).toEqual([
      ['id', 'e-1'],
      ['status', 'draft'],
    ])
  })
})

describe('Estimates — the draft’s engine', () => {
  const updates = () => world.writes.filter((w) => w.table === 'estimates' && w.method === 'update')

  it('saves by itself a moment after a change, without reloading the page', async () => {
    renderAt('/estimates/101', [estimate()])
    await screen.findByRole('button', { name: 'Save draft' })
    await settle()
    const readsBefore = world.rowReads
    vi.useFakeTimers()
    fireEvent.change(screen.getByDisplayValue('ZZ terms'), { target: { value: 'ZZ new terms' } })
    // Nothing yet: the save waits for the typing to stop.
    await act(() => vi.advanceTimersByTimeAsync(1000))
    expect(updates()).toHaveLength(0)
    await act(() => vi.advanceTimersByTimeAsync(700))
    vi.useRealTimers()
    await waitFor(() => expect(updates()).toHaveLength(1))
    expect((updates()[0]!.payload as { terms_snapshot: string }).terms_snapshot).toBe('ZZ new terms')
    expect(updates()[0]!.filters).toEqual([
      ['id', 'e-1'],
      ['status', 'draft'],
    ])
    // The autosave skips the reload, so what is typed is never clobbered.
    expect(world.rowReads).toBe(readsBefore)
    expect(screen.getByDisplayValue('ZZ new terms')).toBeTruthy()
  })

  it('Save draft writes the form and reads the row again', async () => {
    renderAt('/estimates/101', [estimate()])
    const save = await screen.findByRole('button', { name: 'Save draft' })
    await settle()
    const readsBefore = world.rowReads
    fireEvent.change(screen.getByDisplayValue('ZZ terms'), { target: { value: 'ZZ saved terms' } })
    fireEvent.click(save)
    await waitFor(() => expect(updates().length).toBeGreaterThan(0))
    const payload = updates()[0]!.payload as { terms_snapshot: string; total_cents: number; customer_id: string; customer_email: string }
    expect(payload.terms_snapshot).toBe('ZZ saved terms')
    expect(payload.total_cents).toBe(90_000)
    expect(payload.customer_id).toBe('c1')
    // The customer's own email, since nothing is typed under Send to.
    expect(payload.customer_email).toBe('owner@customer.test')
    await waitFor(() => expect(world.rowReads).toBeGreaterThan(readsBefore))
    // The reload shows what was saved.
    expect(await screen.findByDisplayValue('ZZ saved terms')).toBeTruthy()
  })

  it('deletes a draft this visit made and never touched, on the way out', async () => {
    const fresh = estimate({ title: '', customer_id: null, customers: null, line_items_snapshot: [], terms_snapshot: '', total_cents: 0 })
    const view = renderAt({ pathname: '/estimates/101', state: { freshEstimateDraft: true } }, [fresh])
    await screen.findByRole('button', { name: 'Save draft' })
    await settle()
    view.unmount()
    const deletes = world.writes.filter((w) => w.table === 'estimates' && w.method === 'delete')
    expect(deletes).toHaveLength(1)
    expect(deletes[0]!.filters).toEqual([
      ['id', 'e-1'],
      ['status', 'draft'],
    ])
  })

  it('keeps an empty draft that this visit did not make', async () => {
    const empty = estimate({ title: '', customer_id: null, customers: null, line_items_snapshot: [], terms_snapshot: '', total_cents: 0 })
    const view = renderAt('/estimates/101', [empty])
    await screen.findByRole('button', { name: 'Save draft' })
    await settle()
    view.unmount()
    expect(world.writes.filter((w) => w.method === 'delete')).toHaveLength(0)
  })

  it('keeps a fresh draft that has something in it', async () => {
    const view = renderAt({ pathname: '/estimates/101', state: { freshEstimateDraft: true } }, [estimate()])
    await screen.findByRole('button', { name: 'Save draft' })
    await settle()
    view.unmount()
    expect(world.writes.filter((w) => w.method === 'delete')).toHaveLength(0)
  })

  it('opens an estimate by its id and moves the address to its number', async () => {
    const id = '11111111-2222-4333-8444-555555555555'
    renderAt(`/estimates/${id}`, [estimate({ id })])
    expect(await screen.findByRole('button', { name: 'Save draft' })).toBeTruthy()
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/estimates/101'))
  })

  it('goes back to the list for a number no estimate has', async () => {
    renderAt('/estimates/999', [estimate()])
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/estimates'))
    expect(await screen.findByRole('heading', { name: 'Estimates' })).toBeTruthy()
  })

  it('sends a change order after one confirm: the draft is saved, then the one send call goes, then the page shows it sent', async () => {
    renderAt('/estimates/101', [estimate({ doc_kind: 'change_order', change_order_fields: { description_of_change: 'ZZ add a hose bibb' }, title: 'ZZ change order' })])
    const send = await screen.findByRole('button', { name: 'Send to customer' })
    await settle()
    // The change order's own fields, and its lines under Impact on cost.
    expect(screen.getByDisplayValue('ZZ add a hose bibb')).toBeTruthy()
    expect(screen.getByRole('heading', { name: /Impact on cost/ })).toBeTruthy()
    fireEvent.click(send)
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Send to owner@customer.test?')).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(world.sends).toHaveLength(1))
    expect(world.sends[0]).toMatchObject({ estimateId: 'e-1', mode: 'send', customerEmail: 'owner@customer.test' })
    // The save went before the send.
    expect(updates().length).toBeGreaterThan(0)
    // The page reads the row again and draws the sent side, with the link kept for this tab.
    expect(await screen.findByText('Acceptance notify recipients')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Save draft' })).toBeNull()
    expect(window.sessionStorage.getItem('estimate_accept_url:e-1')).toBe('https://app.example/estimate/accept?t=fresh-token')
  })
})

describe('Estimates — a save keeps the page up', () => {
  const updates = () => world.writes.filter((w) => w.table === 'estimates' && w.method === 'update')

  /** The draft, loaded and settled, with its Save draft button and its Terms box. */
  async function openDraft(rows: Row[] = [estimate()]) {
    renderAt('/estimates/101', rows)
    const save = await screen.findByRole('button', { name: 'Save draft' })
    await settle()
    return { save, terms: screen.getByDisplayValue('ZZ terms') as HTMLTextAreaElement }
  }

  /** Press Save draft and wait until the row was read back and the page has settled. */
  async function pressSave(save: HTMLElement) {
    const readsBefore = world.rowReads
    fireEvent.click(save)
    await waitFor(() => expect(world.rowReads).toBeGreaterThan(readsBefore))
    await waitFor(() => expect(save.textContent).toBe('Save draft'))
    await settle()
  }

  it('Save draft leaves the editor mounted: the same boxes, the open fold and the box in hand', async () => {
    const { save, terms } = await openDraft()
    const fold = screen.getByText('Customer experience').closest('details')!
    fold.open = true
    terms.focus()
    fireEvent.change(terms, { target: { value: 'ZZ saved terms' } })
    await pressSave(save)
    expect(await screen.findByText('Saved')).toBeTruthy()
    // The very same nodes: a blanked page would have drawn new ones.
    expect(save.isConnected).toBe(true)
    expect(screen.getByDisplayValue('ZZ saved terms')).toBe(terms)
    expect(fold.isConnected).toBe(true)
    expect(fold.open).toBe(true)
    expect(document.activeElement).toBe(terms)
  })

  it('shows what the row holds after the save: another desk’s note and the date a cleared box falls back to', async () => {
    const { save, terms } = await openDraft()
    world.afterUpdate = (row) => ({ ...row, internal_notes: 'ZZ note from another desk', updated_at: '2026-11-18T15:00:00Z' })
    const expires = document.querySelector<HTMLInputElement>('input[type="date"]')!
    fireEvent.change(expires, { target: { value: '' } })
    fireEvent.change(terms, { target: { value: 'ZZ saved terms' } })
    await pressSave(save)
    expect((updates()[0]!.payload as { valid_until: string | null }).valid_until).toBeNull()
    // A value the save never wrote arrives, and a cleared date opens as a row with none does: thirty days out.
    expect(screen.getByDisplayValue('ZZ note from another desk')).toBeTruthy()
    expect(expires.isConnected).toBe(true)
    expect(expires.value).toBe(ymdFromToday(30))
    expect(terms.value).toBe('ZZ saved terms')
  })

  it('writes nothing a second time after a save', async () => {
    const { save, terms } = await openDraft()
    const readsBefore = world.rowReads
    vi.useFakeTimers()
    fireEvent.change(terms, { target: { value: 'ZZ saved terms' } })
    fireEvent.click(save)
    // The write, the read-back and the page's own settling, each in its own turn, so the autosave's clock is running or not.
    for (let turn = 0; turn < 5; turn++) await act(() => vi.advanceTimersByTimeAsync(0))
    expect(world.rowReads).toBeGreaterThan(readsBefore)
    expect(save.textContent).toBe('Save draft')
    // Past the autosave's wait and then some: the save told it what the row holds.
    await act(() => vi.advanceTimersByTimeAsync(4000))
    vi.useRealTimers()
    await settle()
    expect(updates()).toHaveLength(1)
  })

  it('keeps what is typed while the save is in flight, and the autosave writes it next', async () => {
    const { save, terms } = await openDraft()
    let release!: () => void
    world.rowReadGate = new Promise<void>((resolve) => (release = resolve))
    fireEvent.change(terms, { target: { value: 'ZZ saved terms' } })
    fireEvent.click(save)
    await waitFor(() => expect(updates()).toHaveLength(1))
    // The write landed and the read-back is in flight: the box is still there to type in.
    fireEvent.change(terms, { target: { value: 'ZZ typed during the save' } })
    vi.useFakeTimers()
    world.rowReadGate = null
    release()
    await act(() => vi.advanceTimersByTimeAsync(0))
    // The older value did not come back over the typing.
    expect(terms.isConnected).toBe(true)
    expect(terms.value).toBe('ZZ typed during the save')
    expect(updates()).toHaveLength(1)
    await act(() => vi.advanceTimersByTimeAsync(1600))
    vi.useRealTimers()
    await waitFor(() => expect(updates()).toHaveLength(2))
    expect((updates()[1]!.payload as { terms_snapshot: string }).terms_snapshot).toBe('ZZ typed during the save')
    expect(terms.value).toBe('ZZ typed during the save')
  })

  it('saves a box typed back to what it held before the save: the row has the saved words, the screen the old ones', async () => {
    const { save, terms } = await openDraft()
    let release!: () => void
    world.rowReadGate = new Promise<void>((resolve) => (release = resolve))
    fireEvent.change(terms, { target: { value: 'ZZ saved terms' } })
    fireEvent.click(save)
    await waitFor(() => expect(updates()).toHaveLength(1))
    fireEvent.change(terms, { target: { value: 'ZZ terms' } })
    vi.useFakeTimers()
    world.rowReadGate = null
    release()
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(terms.value).toBe('ZZ terms')
    await act(() => vi.advanceTimersByTimeAsync(1600))
    vi.useRealTimers()
    // Against the form as it was before the save nothing changed. Against the row, something did.
    await waitFor(() => expect(updates()).toHaveLength(2))
    expect((updates()[1]!.payload as { terms_snapshot: string }).terms_snapshot).toBe('ZZ terms')
  })

  it('stays on the option being edited, where opening an estimate shows the starred one', async () => {
    const { save } = await openDraft()
    fireEvent.click(screen.getByRole('button', { name: '＋ Option' }))
    await screen.findByLabelText('Option name')
    await pressSave(save)
    expect(screen.getByTitle('Editing this option').textContent).toContain('Option 2')
    expect((screen.getByLabelText('Option name') as HTMLInputElement).value).toBe('Option 2')
  })

  it('keeps the text typed over a picked customer: the pick is cleared and saved, the box is not emptied', async () => {
    await openDraft()
    const box = screen.getByDisplayValue('ZZ Test Customer - 1 Main St') as HTMLInputElement
    const readsBefore = world.rowReads
    fireEvent.change(box, { target: { value: 'ZZ Test Customer - 1 Main St x' } })
    await waitFor(() => expect(updates()).toHaveLength(1))
    expect((updates()[0]!.payload as { customer_id: string | null }).customer_id).toBeNull()
    await waitFor(() => expect(world.rowReads).toBeGreaterThan(readsBefore))
    await settle()
    expect(box.isConnected).toBe(true)
    expect(box.value).toBe('ZZ Test Customer - 1 Main St x')
  })

  it('says why a save failed, and leaves the editor as typed without reading the row', async () => {
    const { save, terms } = await openDraft()
    world.updateError = { message: 'new row violates row-level security policy for table "estimates"', code: '42501' }
    const readsBefore = world.rowReads
    fireEvent.change(terms, { target: { value: 'ZZ unsaved terms' } })
    fireEvent.click(save)
    // The reason, in the words `formatErrorMessage` gives the same failure.
    const failure: unknown = await withSupabaseRetry(async () => ({ data: null, error: world.updateError }), 'save estimate').catch((e: unknown) => e)
    expect(await screen.findByText(formatErrorMessage(failure, 'Could not save'))).toBeTruthy()
    await waitFor(() => expect(save.textContent).toBe('Save draft'))
    expect(screen.queryByText('Saved')).toBeNull()
    expect(world.rowReads).toBe(readsBefore)
    expect(terms.isConnected).toBe(true)
    expect(terms.value).toBe('ZZ unsaved terms')
  })

  it('stays on the estimate when the save landed and the read-back failed, and says so', async () => {
    const { save, terms } = await openDraft()
    world.rowReadError = { message: 'permission denied for table estimates', code: '42501' }
    fireEvent.change(terms, { target: { value: 'ZZ saved terms' } })
    fireEvent.click(save)
    expect(await screen.findByText(/^Saved\. The page could not read the estimate back: /)).toBeTruthy()
    await waitFor(() => expect(save.textContent).toBe('Save draft'))
    expect(updates()).toHaveLength(1)
    expect(screen.getByTestId('where').textContent).toBe('/estimates/101')
    expect(terms.isConnected).toBe(true)
    expect(terms.value).toBe('ZZ saved terms')
  })
})

describe('Estimates — a draft’s options', () => {
  it('＋ Option turns the estimate into two options, and Save draft writes both with the starred one’s total', async () => {
    renderAt('/estimates/101', [estimate()])
    const save = await screen.findByRole('button', { name: 'Save draft' })
    await settle()
    expect(screen.queryByLabelText('Option name')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '＋ Option' }))
    // Two cards, the copy being edited.
    expect((await screen.findByLabelText('Option name') as HTMLInputElement).value).toBe('Option 2')
    expect(screen.getByTitle('Editing this option').textContent).toContain('Option 2')
    expect(screen.getByTitle('Edit this option').textContent).toContain('Option 1')
    fireEvent.click(save)
    await waitFor(() => expect(world.writes.some((w) => w.table === 'estimates' && w.method === 'update')).toBe(true))
    const payload = world.writes.find((w) => w.table === 'estimates' && w.method === 'update')!.payload as { options_snapshot: Array<{ name: string; recommended: boolean; line_items: unknown[] }>; total_cents: number }
    expect(payload.options_snapshot.map((o) => [o.name, o.recommended, o.line_items.length])).toEqual([
      ['Option 1', true, 1],
      ['Option 2', false, 1],
    ])
    expect(payload.total_cents).toBe(90_000)
  })
})

describe('Estimates — Customer experience', () => {
  it('previews the email, the acceptance page and the thank-you on a draft', async () => {
    renderAt('/estimates/101', [estimate()])
    await screen.findByRole('button', { name: 'Save draft' })
    await settle()
    // The email as the send builds it, to the customer's own address.
    expect(await screen.findByText('What the customer sees')).toBeTruthy()
    expect(screen.getByTitle('Estimate email preview')).toBeTruthy()
    expect(screen.getAllByText('owner@customer.test', { exact: false }).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Acceptance page' }))
    expect(await screen.findByRole('button', { name: 'Preview as customer' })).toBeTruthy()
    expect(screen.queryByText('What the customer sees')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Thank you' }))
    expect(await screen.findByLabelText('Thank you heading')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Preview as customer' })).toBeNull()
  })

  it('saves a changed line of customer copy with the draft', async () => {
    renderAt('/estimates/101', [estimate()])
    const save = await screen.findByRole('button', { name: 'Save draft' })
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Thank you' }))
    fireEvent.change(await screen.findByLabelText('Thank you heading'), { target: { value: 'ZZ thank you, neighbor' } })
    fireEvent.click(save)
    await waitFor(() => expect(world.writes.some((w) => w.table === 'estimates' && w.method === 'update')).toBe(true))
    const write = world.writes.find((w) => w.table === 'estimates' && w.method === 'update')!
    expect((write.payload as { customer_experience_overrides: unknown }).customer_experience_overrides).toEqual({ thank_you_title: 'ZZ thank you, neighbor' })
    expect(write.filters).toEqual([
      ['id', 'e-1'],
      ['status', 'draft'],
    ])
  })

  it('shows a sent estimate the copy as it went, with nothing to edit', async () => {
    renderAt('/estimates/102', [sentRow()])
    await screen.findByTestId('estimate-resend-link-panel')
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Thank you' }))
    expect(await screen.findByText(/customers see this after submitting acceptance/)).toBeTruthy()
    expect(screen.queryByLabelText('Thank you heading')).toBeNull()
  })
})

describe('Estimates — a sent estimate', () => {
  it('shows the sent side: who is told, the paper, the link’s presses', async () => {
    renderAt('/estimates/102', [sentRow()])
    expect(await screen.findByTestId('estimate-resend-link-panel')).toBeTruthy()
    expect(screen.getByText('Acceptance notify recipients')).toBeTruthy()
    expect(screen.getByTestId('estimate-good-through')).toBeTruthy()
    expect(screen.getByTestId('estimate-extend-good-through')).toBeTruthy()
    expect(screen.getByTestId('estimate-download-pdf')).toBeTruthy()
    expect(screen.getByTestId('estimate-record-decline-control')).toBeTruthy()
    expect(screen.getByText('ZZ Water heater')).toBeTruthy()
    // Nothing of the draft's editor on a sent estimate.
    expect(screen.queryByRole('button', { name: 'Save draft' })).toBeNull()
    expect(screen.queryByRole('navigation', { name: 'Draft steps' })).toBeNull()
  })

  it('Resend link asks the one send call for a resend and shows the fresh link once', async () => {
    renderAt('/estimates/102', [sentRow()])
    const resend = await screen.findByRole('button', { name: 'Resend the customer link by email' })
    await settle()
    fireEvent.click(resend)
    await waitFor(() => expect(world.sends).toEqual([{ estimateId: 'e-2', mode: 'resend' }]))
    expect(await screen.findByRole('button', { name: 'Copy the new customer link' })).toBeTruthy()
    expect(window.sessionStorage.getItem('estimate_accept_url:e-2')).toBe('https://app.example/estimate/accept?t=fresh-token')
  })

  it('Extend moves the date through its RPC', async () => {
    renderAt('/estimates/102', [sentRow()])
    const panel = await screen.findByTestId('estimate-extend-good-through')
    await settle()
    const day = ymdFromToday(45)
    fireEvent.change(panel.querySelector('input[type="date"]')!, { target: { value: day } })
    fireEvent.click(within(panel).getByTitle(/^Moves the good-through date/))
    await waitFor(() => expect(world.rpcs.some((r) => r.name === 'extend_estimate_good_through')).toBe(true))
    expect(world.rpcs.find((r) => r.name === 'extend_estimate_good_through')!.args).toEqual({ p_estimate_id: 'e-2', p_valid_until: day })
  })
})

describe('Estimates — a sent estimate, a no by phone', () => {
  it('Mark declined records the no through its RPC, with the note and how it was heard', async () => {
    renderAt('/estimates/102', [sentRow()])
    const control = await screen.findByTestId('estimate-record-decline-control')
    await settle()
    fireEvent.click(within(control).getByRole('button'))
    const form = await screen.findByTestId('estimate-record-decline-form')
    fireEvent.change(within(form).getByPlaceholderText(/Went with another bid/), { target: { value: 'ZZ went with another bid' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Mark this estimate declined' }))
    await waitFor(() => expect(world.rpcs.some((r) => r.name === 'record_estimate_decline')).toBe(true))
    expect(world.rpcs.find((r) => r.name === 'record_estimate_decline')!.args).toEqual({ p_estimate_id: 'e-2', p_note: 'ZZ went with another bid', p_channel: 'phone' })
  })

  it('says so when nobody was set to be told and no activity is on record', async () => {
    renderAt('/estimates/102', [sentRow()])
    expect(await screen.findByText('No staff email recipients were set for this quote.')).toBeTruthy()
    expect(await screen.findByText('No link views or acceptance events recorded yet.')).toBeTruthy()
  })
})

describe('Estimates — an accepted estimate', () => {
  it('shows the acceptance record and offers the job', async () => {
    renderAt('/estimates/103', [acceptedRow()])
    expect(await screen.findByRole('button', { name: 'Create job from estimate' })).toBeTruthy()
    expect(screen.getByText('Acceptance notify recipients')).toBeTruthy()
    expect(screen.getByTestId('estimate-download-pdf')).toBeTruthy()
    expect(screen.queryByTestId('estimate-resend-link-panel')).toBeNull()
  })

  it('Unlink job asks first, then clears the link on an accepted row only', async () => {
    renderAt('/estimates/103', [acceptedRow({ job_ledger_id: 'job-9', jobs_ledger: { hcp_number: 'ZZ-900' } })])
    const unlink = await screen.findByRole('button', { name: 'Remove job link from this estimate' })
    await settle()
    fireEvent.click(unlink)
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Unlink' }))
    await waitFor(() => expect(world.writes.some((w) => w.table === 'estimates' && w.method === 'update')).toBe(true))
    const write = world.writes.find((w) => w.method === 'update')!
    expect(write.payload).toEqual({ job_ledger_id: null })
    expect(write.filters).toEqual([
      ['id', 'e-3'],
      ['status', 'customer_accepted'],
    ])
    // The page reloads the row, and the job is offered again.
    expect(await screen.findByRole('button', { name: 'Create job from estimate' })).toBeTruthy()
  })
})

describe('Estimates — a declined estimate', () => {
  it('shows the paper and the download, and no way to resend', async () => {
    renderAt('/estimates/104', [estimate({ id: 'e-4', estimate_number: 104, status: 'declined', title: 'ZZ Declined job', sent_at: '2026-11-02T15:00:00Z', customer_email: 'owner@customer.test' })])
    expect(await screen.findByTestId('estimate-download-pdf')).toBeTruthy()
    expect(screen.getByText('ZZ Water heater')).toBeTruthy()
    expect(screen.queryByTestId('estimate-resend-link-panel')).toBeNull()
    expect(screen.queryByTestId('estimate-record-decline-control')).toBeNull()
  })
})
