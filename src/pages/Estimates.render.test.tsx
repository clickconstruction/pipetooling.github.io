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
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
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
}))

vi.mock('../lib/supabase', () => {
  const has = (steps: Step[], m: string) => steps.some((s) => s.method === m)
  const arg = (steps: Step[], m: string, i = 0) => steps.find((s) => s.method === m)?.args[i]
  const eqs = (steps: Step[]) => steps.filter((s) => s.method === 'eq').map((s) => [s.args[0], s.args[1]] as [string, unknown])
  const eqValue = (steps: Step[], col: string) => eqs(steps).find(([c]) => c === col)?.[1]

  function answer(table: string, steps: Step[]): { data: unknown; error: null } {
    const single = has(steps, 'single') || has(steps, 'maybeSingle')
    const list = (rows: Row[]) => ({ data: single ? (rows[0] ?? null) : rows, error: null })
    for (const m of ['insert', 'update', 'delete', 'upsert']) {
      if (has(steps, m)) {
        world.writes.push({ table, method: m, payload: arg(steps, m), filters: eqs(steps) })
        if (table === 'estimates' && m === 'update') {
          const id = eqValue(steps, 'id')
          world.estimates = world.estimates.map((e) => (e.id === id ? { ...e, ...(arg(steps, m) as Row) } : e))
        }
        return { data: null, error: null }
      }
    }
    switch (table) {
      case 'estimates': {
        const id = eqValue(steps, 'id')
        const number = eqValue(steps, 'estimate_number')
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
          if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(answer(table, steps))
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
      return { kind: 'reply', httpOk: true, json: { ok: true, emailed: true, sent_to: 'owner@customer.test', accept_url: 'https://app.example/estimate/accept?t=fresh-token' } }
    },
  }
})

import Estimates from './Estimates'
import { installDomShims, settle } from '../test/renderSmokeMocks'

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

function renderAt(route: string, rows: Row[]) {
  world.estimates = rows
  world.customers = [CUSTOMER]
  world.writes = []
  world.rpcs = []
  world.sends = []
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
              {children}
            </MemoryRouter>
          </ConfirmDialogProvider>
        </ToastProvider>
      ),
    },
  )
}

afterEach(() => {
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
