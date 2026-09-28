// @vitest-environment jsdom
/**
 * Render smokes for PrepareFixtureCopyModal — the "Supply house list" sheet
 * behind Pricing → Share ▾. Pins: closed renders and reads nothing; open shows
 * the title and the count rows grouped under their Division 22 sections; the
 * preview is the exact paste and follows the ticks and the scope presets; the
 * doors (onClose, onSendByEmail, onRfqMinted) report, and the quote-link lane
 * and the email door are absent without their props; "Copy with quote link"
 * writes one bid_rfqs row — only once the link is in the user's hands (a
 * blocked clipboard writes nothing until they confirm); a ledger that cannot
 * load still copies the flat list; no usable rows leaves Copy disabled.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import { renderSettled, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { recordNavClick } from '../../lib/navClickTelemetry'
import { PrepareFixtureCopyModal } from './PrepareFixtureCopyModal'

type ModalProps = Parameters<typeof PrepareFixtureCopyModal>[0]
type ResultError = { message: string; code?: string }

const mocks = vi.hoisted(() => ({
  state: {
    /** Every table the component reads or writes, in call order. */
    tables: [] as string[],
    /** Rows handed to bid_rfqs.insert(). */
    inserted: [] as Record<string, unknown>[],
    /** When set, the rules read fails with this error. */
    rulesError: null as { message: string; code?: string } | null,
  },
  fetchHouses: vi.fn(() =>
    Promise.resolve([
      { id: 'h-ferg', name: 'Ferguson' },
      { id: 'h-nws', name: 'National Wholesale Supply' },
    ]),
  ),
}))
const state = mocks.state

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'wendi', email: 'wendi@x.test' }, profileName: 'Wendi', role: 'estimator' }),
}))

vi.mock('../../lib/supplyHousePickerRows', () => ({
  fetchSupplyHousePickerRows: mocks.fetchHouses,
}))

vi.mock('../../lib/navClickTelemetry', () => ({
  recordNavClick: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      mocks.state.tables.push(table)
      if (table === 'spec_section_match_rules') {
        return {
          select: () =>
            Promise.resolve(
              mocks.state.rulesError
                ? { data: null, error: mocks.state.rulesError, status: 403 }
                : {
                    data: [
                      { id: 'rule-wc', pattern: 'WC', match_kind: 'starts_with', section_code: '22 42 13', priority: 100 },
                      { id: 'rule-pvc', pattern: 'PVC', match_kind: 'contains', section_code: '22 13 16', priority: 100 },
                    ],
                    error: null,
                  },
            ),
        }
      }
      if (table === 'spec_sections') {
        return {
          select: () => ({
            order: () =>
              Promise.resolve({
                data: [
                  { code: '22 13 16', title: 'Sanitary Waste and Vent Piping' },
                  { code: '22 42 13', title: 'Commercial Water Closets' },
                ],
                error: null,
              }),
          }),
        }
      }
      if (table === 'supply_house_fixture_prices') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: [{ fixture_key: 'wc-1', quoted_at: '2026-09-01T12:00:00Z' }], error: null }),
          }),
        }
      }
      if (table === 'bid_rfqs') {
        return {
          insert: (row: Record<string, unknown>) => {
            mocks.state.inserted.push(row)
            return Promise.resolve({ data: null, error: null })
          },
        }
      }
      return { select: () => Promise.resolve({ data: [], error: null }) }
    },
  },
}))

const ROWS: ModalProps['rows'] = [
  { id: 'r1', fixture: 'WC-1', count: 4, unit: null },
  { id: 'r2', fixture: '2IN PVC', count: 120, unit: 'ft' },
  { id: 'r3', fixture: 'MYSTERY BOX', count: 2, unit: null },
  { id: 'r4', fixture: 'LABOR', count: 0, unit: null },
]

const GROUPED_PASTE = [
  'Bid: BP398',
  '',
  '22 13 16 · Sanitary Waste and Vent Piping',
  '2IN PVC — 120 ft',
  '',
  '22 42 13 · Commercial Water Closets',
  'WC-1 — 4',
  '',
  'No code yet',
  'MYSTERY BOX — 2',
  '',
  'Items: 3',
].join('\n')

const FLAT_PASTE = ['Bid: BP398', '', 'WC-1 — 4', '2IN PVC — 120 ft', 'MYSTERY BOX — 2', '', 'Items: 3'].join('\n')

const QUOTE_LINK = { bidId: 'bid-398', bidVersionId: 'ver-2' }

let writeText = vi.fn((_text: string) => Promise.resolve())

function stubClipboard(impl: (text: string) => Promise<void>) {
  writeText = vi.fn(impl)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
}

/** The Copy button only exists once the ledger load has settled. */
const copyButton = () => screen.findByRole('button', { name: /^Copy \d+ items?$/ })

/** Mounts the sheet open and waits for what the ledger load produces. */
async function mountLoaded(props: Partial<ModalProps> = {}, loaded: () => Promise<HTMLElement> = copyButton) {
  const onClose = vi.fn()
  const result = await renderSettled(<PrepareFixtureCopyModal open onClose={onClose} bidLabel="BP398" rows={ROWS} {...props} />, { loaded })
  return { ...result, onClose }
}

function previewText(): string {
  return screen.getByRole('dialog', { name: 'Supply house list' }).querySelector('pre')?.textContent ?? ''
}

/** The house picker's trigger carries no accessible name of its own, so it is found by its placeholder. */
const HOUSE_PICKER = 'pick the supply house…'

/** Picks a house in the quote-link strip and waits for the recency hint its price memory paints. */
async function pickHouse(name: string) {
  fireEvent.click(screen.getByText(HOUSE_PICKER))
  fireEvent.click(await screen.findByRole('option', { name }))
  await screen.findByText('1 of these 3 items')
}

beforeEach(() => {
  state.tables = []
  state.inserted = []
  state.rulesError = null
  mocks.fetchHouses.mockClear()
  vi.mocked(recordNavClick).mockClear()
  stubClipboard(() => Promise.resolve())
})

describe('PrepareFixtureCopyModal', () => {
  it('renders nothing and reads nothing while closed', async () => {
    renderWithProviders(<PrepareFixtureCopyModal open={false} onClose={() => {}} bidLabel="BP398" rows={ROWS} quoteLink={QUOTE_LINK} />)
    await settle()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByText('Supply house list')).toBeNull()
    expect(state.tables).toEqual([])
    expect(mocks.fetchHouses).not.toHaveBeenCalled()
  })

  it('open shows the title, the bid, and the counted rows grouped under their sections, with the preview as the exact paste', async () => {
    await mountLoaded()
    expect(screen.getByRole('heading', { name: 'Supply house list' })).toBeTruthy()
    expect(screen.getByText(/^BP398 · scope it to the vendor/)).toBeTruthy()
    expect(screen.getByText('22 13 16 · Sanitary Waste and Vent Piping')).toBeTruthy()
    expect(screen.getByText('22 42 13 · Commercial Water Closets')).toBeTruthy()
    expect(screen.getByText('No code yet')).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: /WC-1/ })).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: /2IN PVC\s*120 ft/ })).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: /MYSTERY BOX/ })).toBeTruthy()
    // A zero-count row is not a thing to price: it never reaches the list.
    expect(screen.queryByText('LABOR')).toBeNull()
    // The name no rule matched is offered for a pin.
    expect(screen.getByText(/1 name on this bid need a code/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'No code' })).toBeTruthy()
    expect(screen.getByText('3 of 3 items')).toBeTruthy()
    expect(previewText()).toBe(GROUPED_PASTE)
  })

  it('unticking a row and choosing a scope preset narrow the paste, and Copy puts exactly the preview on the clipboard', async () => {
    const { onClose } = await mountLoaded()
    fireEvent.click(screen.getByRole('checkbox', { name: /MYSTERY BOX/ }))
    expect(await screen.findByRole('button', { name: 'Copy 2 items' })).toBeTruthy()
    expect(previewText()).not.toMatch(/MYSTERY BOX/)
    expect(previewText()).toMatch(/Items: 2$/)

    fireEvent.click(screen.getByRole('button', { name: 'Fixtures & equipment' }))
    const copy = await screen.findByRole('button', { name: 'Copy 1 item' })
    const expected = ['Bid: BP398', '', '22 42 13 · Commercial Water Closets', 'WC-1 — 4', '', 'Items: 1'].join('\n')
    expect(previewText()).toBe(expected)

    fireEvent.click(copy)
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(writeText).toHaveBeenCalledTimes(1)
    expect(writeText).toHaveBeenCalledWith(expected)
    expect(await screen.findByText(/Copied 1 of 3 items/)).toBeTruthy()
    // A plain copy never creates a price request.
    expect(state.inserted).toEqual([])
  })

  it('Close, Cancel, Escape and a press on the backdrop each report onClose', async () => {
    const { onClose } = await mountLoaded()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(2)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(3)
    const backdrop = screen.getByRole('dialog', { name: 'Supply house list' }).parentElement
    expect(backdrop).not.toBeNull()
    if (backdrop) fireEvent.mouseDown(backdrop)
    expect(onClose).toHaveBeenCalledTimes(4)
    expect(writeText).not.toHaveBeenCalled()
  })

  it('has no quote-link lane without quoteLink, and no email door without onSendByEmail', async () => {
    const plain = await mountLoaded()
    expect(screen.queryByRole('button', { name: 'Copy with quote link' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Send by email…' })).toBeNull()
    expect(screen.queryByText(HOUSE_PICKER)).toBeNull()
    expect(screen.queryByLabelText(/needed by/)).toBeNull()
    expect(mocks.fetchHouses).not.toHaveBeenCalled()
    plain.unmount()

    // Send by email lives inside the quote-link strip: the callback alone does not show it.
    const emailOnly = await mountLoaded({ onSendByEmail: vi.fn() })
    expect(screen.queryByRole('button', { name: 'Send by email…' })).toBeNull()
    emailOnly.unmount()

    await mountLoaded({ quoteLink: QUOTE_LINK })
    expect(screen.getByRole('button', { name: 'Copy with quote link' })).toBeTruthy()
    expect(screen.getByText(HOUSE_PICKER)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Send by email…' })).toBeNull()
  })

  it('Send by email hands over the ticked rows and the preview text, and writes nothing', async () => {
    const onSendByEmail = vi.fn()
    const { onClose } = await mountLoaded({ quoteLink: QUOTE_LINK, onSendByEmail })
    fireEvent.click(screen.getByRole('checkbox', { name: /2IN PVC/ }))
    await screen.findByRole('button', { name: 'Copy 2 items' })
    fireEvent.click(screen.getByRole('button', { name: 'Send by email…' }))
    expect(onSendByEmail).toHaveBeenCalledTimes(1)
    expect(onSendByEmail).toHaveBeenCalledWith({
      lines: [
        { fixture: 'WC-1', count: 4, unit: null },
        { fixture: 'MYSTERY BOX', count: 2, unit: null },
      ],
      text: ['Bid: BP398', '', '22 42 13 · Commercial Water Closets', 'WC-1 — 4', '', 'No code yet', 'MYSTERY BOX — 2', '', 'Items: 2'].join('\n'),
    })
    expect(state.inserted).toEqual([])
    expect(writeText).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('Copy with quote link waits for a house, then copies the list with the link and writes one request row', async () => {
    const onRfqMinted = vi.fn()
    const { onClose } = await mountLoaded({ quoteLink: QUOTE_LINK, onRfqMinted })
    const mint = screen.getByRole<HTMLButtonElement>('button', { name: 'Copy with quote link' })
    expect(mint.disabled).toBe(true)

    await pickHouse('Ferguson')
    fireEvent.change(screen.getByLabelText(/needed by/), { target: { value: '2026-10-15' } })
    expect(mint.disabled).toBe(false)
    fireEvent.click(mint)

    await waitFor(() => expect(state.inserted).toHaveLength(1))
    const row = state.inserted[0] ?? {}
    const token = String(row.token)
    expect(token).toMatch(/^[0-9a-f]{32}$/)
    expect(row).toEqual({
      bid_id: 'bid-398',
      bid_version_id: 'ver-2',
      supply_house_id: 'h-ferg',
      sent_to: 'Ferguson',
      scope: {
        lines: [
          { fixture: 'WC-1', count: 4, unit: null },
          { fixture: '2IN PVC', count: 120, unit: 'ft' },
          { fixture: 'MYSTERY BOX', count: 2, unit: null },
        ],
      },
      needed_by: '2026-10-15',
      token,
      status: 'sent',
      created_by: 'wendi',
    })
    expect(writeText).toHaveBeenCalledTimes(1)
    expect(writeText).toHaveBeenCalledWith(`${GROUPED_PASTE}\n\nPrice it here: https://clicktooling.com/q/${token}`)
    await waitFor(() => expect(onRfqMinted).toHaveBeenCalledTimes(1))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(recordNavClick).toHaveBeenCalledWith('wendi', 'estimator', 'rfq_link_minted', 'lane:copy')
  })

  it('a second Copy with quote link after a reopen mints a fresh link for the house picked now', async () => {
    const onRfqMinted = vi.fn()
    const onClose = vi.fn()
    const ui = (open: boolean) => (
      <PrepareFixtureCopyModal open={open} onClose={onClose} bidLabel="BP398" rows={ROWS} quoteLink={QUOTE_LINK} onRfqMinted={onRfqMinted} />
    )
    const { rerender } = await renderSettled(ui(true), { loaded: copyButton })
    await pickHouse('Ferguson')
    fireEvent.click(screen.getByRole('button', { name: 'Copy with quote link' }))
    await waitFor(() => expect(state.inserted).toHaveLength(1))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))

    // The parent keeps the window mounted and toggles `open`, as PricingQuoteModals does.
    rerender(ui(false))
    rerender(ui(true))
    await copyButton()
    await settle()
    await pickHouse('National Wholesale Supply')
    fireEvent.click(screen.getByRole('button', { name: 'Copy with quote link' }))

    await waitFor(() => expect(state.inserted).toHaveLength(2))
    const [first, second] = state.inserted
    expect(second?.supply_house_id).toBe('h-nws')
    expect(second?.sent_to).toBe('National Wholesale Supply')
    expect(second?.token).not.toBe(first?.token)
    expect(writeText).toHaveBeenCalledTimes(2)
    expect(writeText).toHaveBeenLastCalledWith(expect.stringContaining(`https://clicktooling.com/q/${String(second?.token)}`))
    await waitFor(() => expect(onRfqMinted).toHaveBeenCalledTimes(2))
  })

  it('a blocked clipboard shows the link to copy by hand and writes nothing until the user confirms; Cancel leaves no request', async () => {
    stubClipboard(() => Promise.reject(new Error('Document is not focused.')))
    const onRfqMinted = vi.fn()
    const { onClose } = await mountLoaded({ quoteLink: QUOTE_LINK, onRfqMinted })
    await pickHouse('National Wholesale Supply')

    fireEvent.click(screen.getByRole('button', { name: 'Copy with quote link' }))
    const first = await screen.findByLabelText<HTMLInputElement>('Quote link')
    expect(first.value).toMatch(/^https:\/\/clicktooling\.com\/q\/[0-9a-f]{32}$/)
    expect(screen.getByText(/Nothing is saved until you confirm/)).toBeTruthy()
    expect(state.inserted).toEqual([])

    fireEvent.click(screen.getByRole('button', { name: /^Cancel — don.t create a request$/ }))
    await waitFor(() => expect(screen.queryByLabelText('Quote link')).toBeNull())
    expect(state.inserted).toEqual([])
    expect(onRfqMinted).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Copy with quote link' }))
    const second = await screen.findByLabelText<HTMLInputElement>('Quote link')
    const link = second.value
    fireEvent.click(screen.getByRole('button', { name: 'Link is ready — I copied it' }))
    await waitFor(() => expect(state.inserted).toHaveLength(1))
    const row = state.inserted[0] ?? {}
    expect(`https://clicktooling.com/q/${String(row.token)}`).toBe(link)
    expect(row.supply_house_id).toBe('h-nws')
    expect(row.sent_to).toBe('National Wholesale Supply')
    expect(row.needed_by).toBeNull()
    expect(row.status).toBe('sent')
    await waitFor(() => expect(onRfqMinted).toHaveBeenCalledTimes(1))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('a supply house list that cannot load says so instead of showing an empty picker', async () => {
    mocks.fetchHouses.mockImplementationOnce(() => Promise.reject(new Error('supply_houses read refused')))
    await mountLoaded({ quoteLink: QUOTE_LINK })
    expect(await screen.findByText('supply_houses read refused')).toBeTruthy()
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Copy with quote link' }).disabled).toBe(true)
  })

  it('a ledger that cannot load says so and still copies the flat list', async () => {
    state.rulesError = { message: 'permission denied for table spec_section_match_rules', code: '42501' } satisfies ResultError
    const { onClose } = await mountLoaded({}, () => screen.findByRole('button', { name: 'Copy the flat list anyway' }))
    expect(screen.getByText(/permission denied for table spec_section_match_rules/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Copy \d+ items?$/ })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Copy the flat list anyway' }))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(writeText).toHaveBeenCalledWith(FLAT_PASTE)

    // Retry reads the ledger again; once it answers, the grouped sheet takes over.
    state.rulesError = null
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await copyButton()).toBeTruthy()
    expect(previewText()).toBe(GROUPED_PASTE)
  })

  it('with no rows to price the preview is the bid line alone and Copy stays disabled', async () => {
    const onSendByEmail = vi.fn()
    await mountLoaded({ rows: [{ id: 'r4', fixture: 'LABOR', count: 0, unit: null }], quoteLink: QUOTE_LINK, onSendByEmail })
    expect(previewText()).toBe('Bid: BP398')
    expect(screen.getByText('0 of 0 items')).toBeTruthy()
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Copy 0 items' }).disabled).toBe(true)
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Send by email…' }).disabled).toBe(true)
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Copy with quote link' }).disabled).toBe(true)
    expect(screen.queryByText(/need a code/)).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
  })
})
