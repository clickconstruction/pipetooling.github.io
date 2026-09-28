// @vitest-environment jsdom
/**
 * Render smokes for RfqComposeModal — the "Send price requests" window reached
 * from the Supply house list's "Send by email…". Pins: closed renders nothing
 * and reads nothing; open lists the quote-able houses for the bid's trade with
 * their contact counts and the scope handed in; a house with a request already
 * out on this bid says so; the plans link rides only while its box is ticked;
 * Preview stays disabled until a picked house resolves to an address; the
 * preview and send calls to the send-rfq-email edge function carry the payload
 * the window builds (bidId, bidVersionId, scope, one request per house), a
 * typed address is remembered as a contact, and onSent / onClose report; a
 * failed send shows its error and reports nothing.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import { renderSettled, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { RfqComposeModal } from './RfqComposeModal'

type ContactRow = { id: string; supply_house_id: string | null; name: string | null; email: string; label: string | null; is_default: boolean }
type InvokeResult = { data: unknown; error: { message: string } | null }
type InvokeCall = { name: string; body: Record<string, unknown> }

const state = vi.hoisted(() => ({
  houses: [] as Array<{ id: string; name: string }>,
  contacts: [] as unknown[],
  bid: null as unknown,
  links: [] as unknown[],
  houseLoads: 0,
  tablesRead: [] as string[],
  invoked: [] as unknown[],
  insertedContacts: [] as unknown[],
  previewResult: { data: null, error: null } as unknown,
  sendResult: { data: null, error: null } as unknown,
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'wendi', email: 'wendi@x.test' }, profileName: 'Wendi', role: 'estimator' }),
}))

vi.mock('../../lib/supplyHousePickerRows', () => ({
  fetchSupplyHousePickerRows: () => {
    state.houseLoads += 1
    return Promise.resolve(state.houses)
  },
}))

vi.mock('../../lib/supabase', () => {
  /** A chainable query that resolves `rows` when awaited and `single` after maybeSingle(). */
  function query(rows: unknown, single: unknown = null) {
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'not', 'is', 'order']) builder[m] = () => builder
    builder.maybeSingle = () => Promise.resolve({ data: single, error: null })
    builder.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve({ data: rows, error: null }).then(onFulfilled, onRejected)
    return builder
  }
  return {
    supabase: {
      from: (table: string) => {
        state.tablesRead.push(table)
        if (table === 'supply_house_contacts') {
          return {
            ...query(state.contacts),
            insert: (rows: unknown[]) => {
              state.insertedContacts.push(...rows)
              return Promise.resolve({ data: null, error: null })
            },
          }
        }
        if (table === 'bids') return query([], state.bid)
        if (table === 'supply_house_service_types') return query(state.links)
        return query([])
      },
      functions: {
        invoke: (name: string, opts: { body: Record<string, unknown> }) => {
          state.invoked.push({ name, body: opts.body })
          return Promise.resolve(opts.body.mode === 'send' ? state.sendResult : state.previewResult)
        },
      },
    },
  }
})

const FERGUSON: ContactRow[] = [
  { id: 'c-dana', supply_house_id: 'h-ferg', name: 'Dana Reyes', email: 'dana@ferguson.test', label: 'inside sales', is_default: true },
  { id: 'c-omar', supply_house_id: 'h-ferg', name: 'Omar Pike', email: 'omar@ferguson.test', label: null, is_default: false },
]

const scope = {
  lines: [
    { fixture: 'WC-1', count: 11, unit: null },
    { fixture: 'LAV-2', count: 6, unit: 'ea' },
  ],
  text: '11  WC-1\n 6  LAV-2',
}

const PLANS = 'https://drive.example.test/plans/bp359'

function previewOf(houseId: string, houseName: string, email: string): InvokeResult {
  return {
    data: { ok: true, previews: [{ supplyHouseId: houseId, houseName, email, cc: [], subject: 'Price request — BP359', html: '<p>Please price the attached list.</p>' }] },
    error: null,
  }
}

const invoked = () => state.invoked as InvokeCall[]

type Props = Parameters<typeof RfqComposeModal>[0]

function modal(overrides: Partial<Props> = {}) {
  return (
    <RfqComposeModal
      open
      onClose={() => {}}
      onSent={() => {}}
      bidId="b359"
      bidVersionId="v-2"
      bidLabel="BP359"
      scope={scope}
      openRfqHouseIds={new Set<string>()}
      {...overrides}
    />
  )
}

/** Mount open and wait for the LAST thing the load paints: the bid's trade caption. */
function openCompose(overrides: Partial<Props> = {}) {
  return renderSettled(modal(overrides), { loaded: () => screen.findByText(/Plumbing supply houses/) })
}

const previewButton = () => screen.getByRole('button', { name: /^Preview/ }) as HTMLButtonElement

describe('RfqComposeModal', () => {
  beforeEach(() => {
    state.houses = [
      { id: 'h-ferg', name: 'Ferguson' },
      { id: 'h-john', name: 'Johnstone Supply' },
      { id: 'h-moore', name: 'Moore Supply' },
    ]
    state.contacts = [...FERGUSON]
    state.bid = { service_type_id: 'st-plumb', service_types: { name: 'Plumbing' } }
    // Ferguson serves plumbing, Johnstone serves HVAC only, Moore is untagged (serves everyone).
    state.links = [
      { supply_house_id: 'h-ferg', service_type_id: 'st-plumb' },
      { supply_house_id: 'h-john', service_type_id: 'st-hvac' },
    ]
    state.houseLoads = 0
    state.tablesRead = []
    state.invoked = []
    state.insertedContacts = []
    state.previewResult = previewOf('h-ferg', 'Ferguson', 'dana@ferguson.test')
    state.sendResult = { data: { ok: true, results: [{ ok: true }] }, error: null }
  })

  it('renders nothing and reads nothing while it is closed', async () => {
    renderWithProviders(modal({ open: false }))
    await settle()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(state.houseLoads).toBe(0)
    expect(state.tablesRead).toEqual([])
  })

  it('lists the supply houses with their contact counts, the bid label, the item count and the scope text', async () => {
    await openCompose()
    const dialog = screen.getByRole('dialog', { name: 'Send price requests' })
    expect(dialog.textContent).toContain('BP359 · 2 items')
    expect(dialog.querySelector('pre')?.textContent).toBe(scope.text)
    expect(screen.getByRole('checkbox', { name: 'Send to Ferguson' })).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: 'Send to Moore Supply' })).toBeTruthy()
    expect(screen.getByText('2 contacts')).toBeTruthy()
    expect(screen.getByText('no contacts yet')).toBeTruthy()
    expect(state.houseLoads).toBe(1)
  })

  it('hides a house that serves another trade until "show all", and the find box narrows the list', async () => {
    await openCompose()
    expect(screen.getByText(/1 vendor hidden/)).toBeTruthy()
    expect(screen.queryByText('Johnstone Supply')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'show all' }))
    expect(screen.getByText('Johnstone Supply')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'only Plumbing' })).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText('find a supply house…'), { target: { value: 'moore' } })
    expect(screen.getByText('Moore Supply')).toBeTruthy()
    expect(screen.queryByText('Ferguson')).toBeNull()

    fireEvent.change(screen.getByPlaceholderText('find a supply house…'), { target: { value: 'zzz' } })
    expect(screen.getByText('No supply house matches that.')).toBeTruthy()
  })

  it('marks only the house that already has a request out on this bid', async () => {
    await openCompose({ openRfqHouseIds: new Set(['h-moore']) })
    const marks = screen.getAllByText(/already has an open request/)
    expect(marks).toHaveLength(1)
    expect(marks[0]?.parentElement?.textContent).toContain('Moore Supply')
  })

  it('offers the plans link only when the bid has one, and leaves it out of the request once unticked', async () => {
    const first = await openCompose()
    expect(screen.queryByRole('checkbox', { name: /job plans link/ })).toBeNull()
    first.unmount()

    await openCompose({ plansLink: PLANS })
    const include = screen.getByRole('checkbox', { name: /job plans link/ }) as HTMLInputElement
    expect(include.checked).toBe(true)
    fireEvent.click(include)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Send to Ferguson' }))
    fireEvent.click(previewButton())
    await waitFor(() => expect(invoked()).toHaveLength(1))
    expect(invoked()[0]?.body.plansLink).toBeNull()
    expect(await screen.findByRole('button', { name: 'Send 1 request' })).toBeTruthy()
  })

  it('keeps Preview disabled until a picked house has an address to send to', async () => {
    await openCompose()
    expect(previewButton().disabled).toBe(true)

    // A house with no contacts is not sendable until a valid address is typed.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Send to Moore Supply' }))
    expect(previewButton().disabled).toBe(true)
    fireEvent.change(screen.getByRole('textbox', { name: 'Email for Moore Supply' }), { target: { value: 'not-an-address' } })
    expect(previewButton().disabled).toBe(true)
    fireEvent.change(screen.getByRole('textbox', { name: 'Email for Moore Supply' }), { target: { value: 'rep@moore.test' } })
    expect(previewButton().disabled).toBe(false)
    expect(previewButton().textContent).toContain('Preview 1 email')

    // A house with a default contact is sendable the moment it is picked.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Send to Ferguson' }))
    expect(previewButton().textContent).toContain('Preview 2 emails')
    expect(screen.getByRole('button', { name: 'To · Dana Reyes (inside sales)' })).toBeTruthy()
    expect(state.invoked).toEqual([])
  })

  it('previews, then sends one request per picked house with the bid, the version and the scope, and reports onSent and onClose', async () => {
    const onSent = vi.fn()
    const onClose = vi.fn()
    state.sendResult = { data: { ok: true, results: [{ ok: true }, { ok: true }] }, error: null }
    await openCompose({ onSent, onClose, plansLink: PLANS })

    fireEvent.click(screen.getByRole('checkbox', { name: 'Send to Ferguson' }))
    fireEvent.click(screen.getByRole('button', { name: 'Omar Pike' })) // Off → CC
    fireEvent.click(screen.getByRole('checkbox', { name: 'Send to Moore Supply' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Email for Moore Supply' }), { target: { value: 'rep@moore.test' } })
    fireEvent.change(screen.getByLabelText('needed by'), { target: { value: '2026-10-09' } })
    fireEvent.change(screen.getByPlaceholderText(/note to vendors/), { target: { value: '  bid due Friday  ' } })

    fireEvent.click(previewButton())
    expect(await screen.findByText('Price request — BP359')).toBeTruthy()
    expect(screen.getByText('Please price the attached list.')).toBeTruthy()

    const requests = [
      { supplyHouseId: 'h-ferg', email: 'dana@ferguson.test', name: 'Dana Reyes', cc: ['omar@ferguson.test'] },
      { supplyHouseId: 'h-moore', email: 'rep@moore.test', name: null, cc: [] },
    ]
    expect(invoked()[0]).toEqual({
      name: 'send-rfq-email',
      body: { mode: 'preview', bidId: 'b359', neededBy: '2026-10-09', vendorNote: 'bid due Friday', plansLink: PLANS, scope, requests },
    })
    expect(onSent).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Send 2 requests' }))
    await waitFor(() => expect(onSent).toHaveBeenCalledTimes(1))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(invoked()).toHaveLength(2)
    expect(invoked()[1]).toEqual({
      name: 'send-rfq-email',
      body: { mode: 'send', bidId: 'b359', bidVersionId: 'v-2', neededBy: '2026-10-09', vendorNote: 'bid due Friday', plansLink: PLANS, scope, requests },
    })
    expect(await screen.findByText(/Sent 2 price requests/)).toBeTruthy()

    // The typed address is remembered as the house's first contact, stamped with who added it.
    expect(state.insertedContacts).toEqual([
      { supply_house_id: 'h-moore', name: 'rep', email: 'rep@moore.test', label: 'from a request', is_default: true, created_by: 'wendi' },
    ])
  })

  it('shows the error of a failed send, stays on the preview and reports nothing', async () => {
    const onSent = vi.fn()
    const onClose = vi.fn()
    state.sendResult = { data: { ok: false, results: [{ ok: false, error: 'The mail service refused dana@ferguson.test' }] }, error: null }
    await openCompose({ onSent, onClose })

    fireEvent.click(screen.getByRole('checkbox', { name: 'Send to Ferguson' }))
    fireEvent.click(previewButton())
    fireEvent.click(await screen.findByRole('button', { name: 'Send 1 request' }))

    expect(await screen.findByText('The mail service refused dana@ferguson.test')).toBeTruthy()
    await waitFor(() => expect((screen.getByRole('button', { name: 'Send 1 request' }) as HTMLButtonElement).disabled).toBe(false))
    expect(invoked().map((c) => c.body.mode)).toEqual(['preview', 'send'])
    expect(onSent).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(state.insertedContacts).toEqual([])
  })

  it('reports onClose from the Close button and from Escape', async () => {
    const onClose = vi.fn()
    await openCompose({ onClose })
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
