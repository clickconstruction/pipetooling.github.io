// @vitest-environment jsdom
/**
 * Render smokes for RfqDeskModal (the RFQ Desk, v2.2636) — what the file pins:
 * closed renders nothing and reads nothing; open reads the bid's non-draft
 * requests and paints one row per request with its house name and its progress
 * trail (emailed, copied link, quoted, recorded outside the app, bounced); the
 * empty state; the coverage strip; the pre-v2.3175 select fallback; the four
 * doors (onClose, onCompare, onNewRequest, onChanged); and the write paths with
 * the payload each one builds — Close link behind its confirm, Reopen link,
 * the nudge's preview-then-send, and a bounced row's fix-and-resend.
 * The trail, urgency and coverage arithmetic are the kernel's job
 * (`src/lib/rfq/rfqDesk.test.ts`).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'

import { renderSettled, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { recordNavClick } from '../../lib/navClickTelemetry'
import { RfqDeskModal } from './RfqDeskModal'

type Row = Record<string, unknown>
type SelectCall = { table: string; cols: string; filters: Array<{ op: string; col: string; value: unknown }> }

const db = vi.hoisted(() => ({
  rfqs: [] as Array<Record<string, unknown>>,
  quotes: [] as Array<Record<string, unknown>>,
  emailLog: [] as Array<Record<string, unknown>>,
  /** Set to make the wide (v2.3175) bid_rfqs select fail the way an unpushed migration does. */
  wideSelectError: null as { message: string } | null,
  selects: [] as Array<{ table: string; cols: string; filters: Array<{ op: string; col: string; value: unknown }> }>,
  updates: [] as Array<{ table: string; patch: Record<string, unknown>; col: string; id: string }>,
  invoked: [] as Array<{ fn: string; body: Record<string, unknown> }>,
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'wendi', email: 'wendi@x.test' }, profileName: 'Wendi', role: 'estimator' }),
}))

vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: vi.fn() }))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      select: (cols: string) => {
        const call: SelectCall = { table, cols, filters: [] }
        db.selects.push(call)
        const result = () => {
          if (table === 'bid_rfqs') {
            if (db.wideSelectError && cols.includes('sent_via')) return Promise.resolve({ data: null, error: db.wideSelectError })
            return Promise.resolve({ data: db.rfqs.map((r) => ({ ...r })), error: null })
          }
          if (table === 'bid_quotes') return Promise.resolve({ data: db.quotes, error: null })
          if (table === 'email_send_log') return Promise.resolve({ data: db.emailLog, error: null })
          return Promise.resolve({ data: [], error: null })
        }
        const builder = {
          eq: (col: string, value: unknown) => {
            call.filters.push({ op: 'eq', col, value })
            return builder
          },
          neq: (col: string, value: unknown) => {
            call.filters.push({ op: 'neq', col, value })
            return builder
          },
          in: (col: string, value: unknown) => {
            call.filters.push({ op: 'in', col, value })
            return result()
          },
          order: () => result(),
        }
        return builder
      },
      update: (patch: Record<string, unknown>) => ({
        eq: (col: string, id: string) => {
          db.updates.push({ table, patch, col, id })
          // The write lands, so the desk's reload reads the new status back.
          if (table === 'bid_rfqs') db.rfqs = db.rfqs.map((r) => (r.id === id ? { ...r, ...patch } : r))
          return Promise.resolve({ data: null, error: null })
        },
      }),
    }),
    functions: {
      invoke: (fn: string, opts: { body: Record<string, unknown> }) => {
        db.invoked.push({ fn, body: opts.body })
        if (opts.body.mode === 'preview') {
          return Promise.resolve({ data: { ok: true, previews: [{ subject: 'Reminder · BP359 · 2 items', text: 'Still hoping for your prices on BP359.' }] }, error: null })
        }
        return Promise.resolve({ data: { ok: true }, error: null })
      },
    },
  },
}))

/** A request sent long enough ago that the 24h nudge rest has passed on any day the suite runs. */
function rfq(over: Row = {}): Row {
  return {
    id: 'rfq-ferg',
    token: 'tok-ferg',
    status: 'sent',
    sent_to: 'Ferguson',
    sent_name: 'Dana',
    sent_email: 'dana@ferguson.test',
    sent_cc: ['counter@ferguson.test'],
    resend_email_id: 're-ferg',
    created_at: '2026-01-05T15:00:00Z',
    viewed_at: null,
    last_reminded_at: null,
    reminder_count: 0,
    needed_by: null,
    scope: { lines: [{ fixture: 'WC-1', count: 11 }, { fixture: 'LAV-2', count: 6 }] },
    sent_via: 'app',
    requested_on: null,
    request_url: null,
    quote_url: null,
    supply_house: { name: 'Ferguson Enterprises' },
    ...over,
  }
}

const MOORE = rfq({ id: 'rfq-moore', token: 'tok-moore', sent_to: 'Moore Supply', sent_name: null, sent_email: null, sent_cc: null, resend_email_id: null, viewed_at: '2026-01-06T15:00:00Z', scope: null, supply_house: null })
const HAJOCA = rfq({ id: 'rfq-hajoca', token: 'tok-hajoca', status: 'quoted', sent_to: 'Hajoca', sent_name: null, sent_email: 'bids@hajoca.test', sent_cc: [], resend_email_id: 're-hajoca', viewed_at: '2026-01-06T15:00:00Z', scope: null, supply_house: null })
const MORRISON = rfq({ id: 'rfq-morrison', token: null, sent_to: null, sent_name: null, sent_email: null, sent_cc: null, resend_email_id: null, scope: null, sent_via: 'outside', request_url: 'https://drive.example.test/request', supply_house: { name: 'Morrison Supply' } })

const rows = [
  { id: 'r1', fixture: 'WC-1', count: 11 },
  { id: 'r2', fixture: 'LAV-2', count: 8 },
]

function doors() {
  return { onClose: vi.fn(), onCompare: vi.fn(), onNewRequest: vi.fn(), onChanged: vi.fn() }
}

/** Mount the open desk and wait for something its load paints. */
async function openDesk(loaded: string | RegExp) {
  const d = doors()
  await renderSettled(<RfqDeskModal open {...d} bidId="b359" bidLabel="BP359 · Lakeline Clinic" rows={rows} />, {
    loaded: () => screen.findByText(loaded),
  })
  return d
}

/** The desk row that carries a house name: the name sits in the row's first column. */
function rowOf(houseName: string): HTMLElement {
  const row = screen.getByText(houseName).parentElement?.parentElement
  if (!row) throw new Error(`no desk row for ${houseName}`)
  return row
}

/** A line of the closed list: the house and its email, beside its Reopen door. */
function closedLineOf(label: string): HTMLElement {
  const line = screen.getByText(label).parentElement
  if (!line) throw new Error(`no closed line for ${label}`)
  return line
}

beforeEach(() => {
  db.rfqs = []
  db.quotes = []
  db.emailLog = []
  db.wideSelectError = null
  db.selects = []
  db.updates = []
  db.invoked = []
  vi.mocked(recordNavClick).mockClear()
})

describe('RfqDeskModal', () => {
  it('renders nothing and reads nothing while it is closed', async () => {
    db.rfqs = [rfq()]
    const d = doors()
    renderWithProviders(<RfqDeskModal open={false} {...d} bidId="b359" bidLabel="BP359" rows={rows} />)
    await settle()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByText('Ferguson')).toBeNull()
    expect(db.selects).toHaveLength(0)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(d.onClose).not.toHaveBeenCalled()
  })

  it('reads the bid’s requests and paints one row per request with its house name and its trail', async () => {
    db.rfqs = [rfq({ reminder_count: 1 }), MOORE, HAJOCA, MORRISON]
    db.emailLog = [{ resend_email_id: 're-ferg', last_event: 'delivered' }]
    await openDesk('Ferguson')

    expect(screen.getByRole('dialog', { name: 'Price requests' })).toBeTruthy()
    expect(screen.getByText(/BP359 · Lakeline Clinic/)).toBeTruthy()

    // The read: this bid's requests, drafts left out, and the delivery events for the emailed ones.
    const rfqRead = db.selects.find((s) => s.table === 'bid_rfqs')
    expect(rfqRead?.filters).toEqual([
      { op: 'eq', col: 'bid_id', value: 'b359' },
      { op: 'neq', col: 'status', value: 'draft' },
    ])
    const logRead = db.selects.find((s) => s.table === 'email_send_log')
    expect(logRead?.filters).toEqual([{ op: 'in', col: 'resend_email_id', value: ['re-ferg', 're-hajoca'] }])

    // Emailed and delivered, not yet viewed; the bid's LAV-2 count moved since it went out.
    const ferguson = rowOf('Ferguson')
    expect(ferguson.textContent).toContain('Sent→Delivered→Viewed→Quoted')
    expect(ferguson.textContent).toContain('Dana · dana@ferguson.test (+1 cc) · 2 items · nudged ×1')
    expect(ferguson.textContent).toContain('counts changed since sent (1 line)')
    expect(ferguson.textContent).toMatch(/unviewed for \d+ days/)
    expect(within(ferguson).getByRole('button', { name: 'Nudge' })).toBeTruthy()

    // A copied link has the shorter trail and nobody to nudge.
    const moore = rowOf('Moore Supply')
    expect(moore.textContent).toContain('Link out→Viewed→Quoted')
    expect(moore.textContent).toContain('no email — link was copied into a text')
    expect(within(moore).queryByRole('button', { name: 'Nudge' })).toBeNull()
    expect(within(moore).getByRole('button', { name: 'Copy link' })).toBeTruthy()

    // A quoted request trades its nudge for the Compare door.
    const hajoca = rowOf('Hajoca')
    expect(hajoca.textContent).toContain('Sent→Delivered→Viewed→Quoted')
    expect(within(hajoca).getByRole('button', { name: 'Compare' })).toBeTruthy()
    expect(within(hajoca).queryByRole('button', { name: 'Nudge' })).toBeNull()

    // Recorded outside the app: named by its supply house, links instead of a trail, no link doors.
    const morrison = rowOf('Morrison Supply')
    expect(morrison.textContent).toContain('sent outside the app')
    expect(morrison.textContent).toContain('Waiting on the vendor')
    expect(morrison.textContent).toContain('no quote link yet')
    expect(within(morrison).getByRole('link', { name: 'request' }).getAttribute('href')).toBe('https://drive.example.test/request')
    expect(within(morrison).queryByRole('button')).toBeNull()

    expect(screen.getAllByRole('button', { name: 'Close link' })).toHaveLength(3)
  })

  it('says so when the bid has no requests, and shows no coverage strip', async () => {
    await openDesk('No price requests on this bid yet — scope a list and send one.')
    expect(screen.queryByText(/priced by someone/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Close link' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Compare quotes' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '+ New request' })).toBeTruthy()
  })

  it('still paints the desk from the narrower read when the wide select is refused', async () => {
    db.wideSelectError = { message: 'column bid_rfqs.sent_via does not exist' }
    db.rfqs = [rfq({ sent_via: undefined, requested_on: undefined, request_url: undefined, quote_url: undefined, supply_house: undefined })]
    await openDesk('Ferguson')
    const rfqReads = db.selects.filter((s) => s.table === 'bid_rfqs')
    expect(rfqReads).toHaveLength(2)
    expect(rfqReads[0]?.cols).toContain('sent_via')
    expect(rfqReads[1]?.cols).not.toContain('sent_via')
    expect(rfqReads[1]?.filters).toEqual(rfqReads[0]?.filters)
    expect(rowOf('Ferguson').textContent).toContain('Sent→Delivered→Viewed→Quoted')
  })

  it('counts the items somebody has priced and lists the bare ones on request', async () => {
    db.rfqs = [rfq({ status: 'quoted' })]
    db.quotes = [
      {
        id: 'q-ferg',
        supply_house_id: 'h-ferg',
        rfq_id: 'rfq-ferg',
        received_at: '2026-01-07T15:00:00Z',
        valid_until: null,
        bid_quote_lines: [
          { fixture: 'WC-1', unit_price_each_cents: 45000, cant_supply: false, picked: false },
          { fixture: 'LAV-2', unit_price_each_cents: null, cant_supply: true, picked: false },
        ],
      },
    ]
    await openDesk('Ferguson')
    expect(screen.getByText('2 items').parentElement?.textContent).toBe('2 items · 1 priced by someone · 1 still bare')
    expect(screen.queryByText('LAV-2')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'See the 1 bare item' }))
    expect(screen.getByText('LAV-2')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Hide the 1 bare item' }))
    expect(screen.queryByText('LAV-2')).toBeNull()
  })

  it('reports each door: compare, new request, and every way of closing the desk', async () => {
    db.rfqs = [HAJOCA]
    const d = await openDesk('Hajoca')

    fireEvent.click(screen.getByRole('button', { name: 'Compare quotes' }))
    expect(d.onCompare).toHaveBeenCalledTimes(1)
    fireEvent.click(within(rowOf('Hajoca')).getByRole('button', { name: 'Compare' }))
    expect(d.onCompare).toHaveBeenCalledTimes(2)

    fireEvent.click(screen.getByRole('button', { name: '+ New request' }))
    expect(d.onNewRequest).toHaveBeenCalledTimes(1)

    // The × in the header and the Close button in the footer.
    const closers = screen.getAllByRole('button', { name: 'Close' })
    expect(closers).toHaveLength(2)
    for (const b of closers) fireEvent.click(b)
    expect(d.onClose).toHaveBeenCalledTimes(2)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(d.onClose).toHaveBeenCalledTimes(3)
    const backdrop = screen.getByRole('dialog', { name: 'Price requests' }).parentElement
    if (!backdrop) throw new Error('the desk has no backdrop')
    fireEvent.mouseDown(backdrop)
    expect(d.onClose).toHaveBeenCalledTimes(4)

    // Looking and leaving writes nothing.
    expect(d.onChanged).not.toHaveBeenCalled()
    expect(db.updates).toHaveLength(0)
    expect(db.invoked).toHaveLength(0)
  })

  it('asks before closing a link, writes nothing on Cancel, and on confirm marks the request closed', async () => {
    db.rfqs = [rfq()]
    const d = await openDesk('Ferguson')

    fireEvent.click(within(rowOf('Ferguson')).getByRole('button', { name: 'Close link' }))
    const ask = await screen.findByRole('alertdialog', { name: 'Close this quote link?' })
    expect(within(ask).getByText(/Ferguson won't be able to open it/)).toBeTruthy()
    expect(vi.mocked(recordNavClick)).toHaveBeenCalledWith('wendi', 'estimator', 'discard_guard_shown', 'rfq_close_link')
    fireEvent.click(within(ask).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await settle()
    expect(db.updates).toHaveLength(0)
    expect(d.onChanged).not.toHaveBeenCalled()

    fireEvent.click(within(rowOf('Ferguson')).getByRole('button', { name: 'Close link' }))
    const askAgain = await screen.findByRole('alertdialog', { name: 'Close this quote link?' })
    fireEvent.click(within(askAgain).getByRole('button', { name: 'Close link' }))
    await waitFor(() => expect(d.onChanged).toHaveBeenCalledTimes(1))
    expect(db.updates).toEqual([{ table: 'bid_rfqs', patch: { status: 'closed' }, col: 'id', id: 'rfq-ferg' }])

    // The reload moved it to the closed list, with its Reopen door.
    expect(await screen.findByText(/^1 closed request —/)).toBeTruthy()
    expect(within(closedLineOf('Ferguson · dana@ferguson.test')).getByRole('button', { name: 'Reopen link' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Close link' })).toBeNull()
  })

  it('reopens a closed request as quoted when a quote is on file and as sent when none is', async () => {
    db.rfqs = [rfq({ status: 'closed' }), { ...HAJOCA, status: 'closed' }]
    db.quotes = [{ id: 'q-hajoca', supply_house_id: 'h-hajoca', rfq_id: 'rfq-hajoca', received_at: '2026-01-07T15:00:00Z', valid_until: null, bid_quote_lines: [] }]
    const d = await openDesk(/^2 closed requests —/)

    fireEvent.click(within(closedLineOf('Hajoca · bids@hajoca.test')).getByRole('button', { name: 'Reopen link' }))
    await waitFor(() => expect(d.onChanged).toHaveBeenCalledTimes(1))
    expect(db.updates).toEqual([{ table: 'bid_rfqs', patch: { status: 'quoted' }, col: 'id', id: 'rfq-hajoca' }])
    expect(await screen.findByText(/^1 closed request —/)).toBeTruthy()
    expect(within(rowOf('Hajoca')).getByRole('button', { name: 'Compare' })).toBeTruthy()

    fireEvent.click(within(closedLineOf('Ferguson · dana@ferguson.test')).getByRole('button', { name: 'Reopen link' }))
    await waitFor(() => expect(d.onChanged).toHaveBeenCalledTimes(2))
    expect(db.updates[1]).toEqual({ table: 'bid_rfqs', patch: { status: 'sent' }, col: 'id', id: 'rfq-ferg' })
    await waitFor(() => expect(screen.queryByText(/closed request/)).toBeNull())
    expect(within(rowOf('Ferguson')).getByRole('button', { name: 'Close link' })).toBeTruthy()
  })

  it('previews a nudge before anything sends, then sends the reminder and reports the change', async () => {
    db.rfqs = [rfq(), rfq({ id: 'rfq-fresh', token: 'tok-fresh', sent_to: 'Winsupply', sent_email: 'desk@winsupply.test', resend_email_id: null, created_at: new Date().toISOString() })]
    const d = await openDesk('Ferguson')

    // A request that went out inside the last 24h rests.
    const resting = within(rowOf('Winsupply')).getByRole('button', { name: 'Nudge' }) as HTMLButtonElement
    expect(resting.disabled).toBe(true)
    expect(resting.title).toMatch(/nudged recently/)

    fireEvent.click(within(rowOf('Ferguson')).getByRole('button', { name: 'Nudge' }))
    expect(await screen.findByText('Reminder · BP359 · 2 items')).toBeTruthy()
    expect(screen.getByText('Still hoping for your prices on BP359.')).toBeTruthy()
    expect(db.invoked).toEqual([{ fn: 'send-rfq-email', body: { mode: 'preview', rfqId: 'rfq-ferg' } }])

    // Cancel folds the preview away and sends nothing.
    fireEvent.click(within(rowOf('Ferguson')).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText('Reminder · BP359 · 2 items')).toBeNull()
    expect(db.invoked).toHaveLength(1)

    fireEvent.click(within(rowOf('Ferguson')).getByRole('button', { name: 'Nudge' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Send this nudge' }))
    await waitFor(() => expect(d.onChanged).toHaveBeenCalledTimes(1))
    expect(db.invoked).toHaveLength(3)
    expect(db.invoked[2]).toEqual({ fn: 'send-rfq-email', body: { mode: 'remind', rfqId: 'rfq-ferg' } })
    expect(screen.queryByText('Reminder · BP359 · 2 items')).toBeNull()
    expect(db.updates).toHaveLength(0)
  })

  it('lets a bounced address be fixed in the row and resends to the corrected one', async () => {
    db.rfqs = [rfq()]
    db.emailLog = [{ resend_email_id: 're-ferg', last_event: 'bounced' }]
    const d = await openDesk('Ferguson')

    const row = rowOf('Ferguson')
    expect(row.textContent).toContain('Sent→Bounced')
    expect(row.textContent).toContain('bounced — fix it right here')
    expect(within(row).queryByRole('button', { name: 'Nudge' })).toBeNull()
    const fix = within(row).getByLabelText('Fix email for Ferguson') as HTMLInputElement
    expect(fix.value).toBe('dana@ferguson.test')

    fireEvent.change(fix, { target: { value: '  dana@fergusonsupply.test ' } })
    fireEvent.click(within(row).getByRole('button', { name: 'Resend' }))
    await waitFor(() => expect(d.onChanged).toHaveBeenCalledTimes(1))
    expect(db.invoked).toEqual([{ fn: 'send-rfq-email', body: { mode: 'resend', rfqId: 'rfq-ferg', email: 'dana@fergusonsupply.test' } }])
    expect(db.updates).toHaveLength(0)
  })
})
