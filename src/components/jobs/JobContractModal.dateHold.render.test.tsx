// @vitest-environment jsdom
/**
 * The Contract window's draft autosave and a date typed one digit at a time: a browser reports
 * the year "2026" as 0002, 0020, 0202, 2026, and a pause mid-year must not write the half-typed
 * date. The dates ride inside the one `fields` object, so the whole draft waits and the status
 * line says so; the finished year saves it.
 *
 * The clicks that take the draft out of the window (send, copy the link, hand over on paper,
 * file as signed) write it as it reads and lock it, so they stop on the same half-typed date
 * and name the box.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { makeJob, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import JobContractModal from './JobContractModal'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, role: 'dev' }) }))
vi.mock('../../lib/physicalInvoiceIssuer', () => ({
  fetchPhysicalInvoiceIssuerFromAppSettings: () => Promise.resolve(),
  getPhysicalInvoiceIssuerForDocument: () => ({ companyName: 'Click', addressText: '', phone: '', email: '', tagline: '', licenseLine: '' }),
}))

const db = vi.hoisted(() => ({ row: {} as Record<string, unknown>, updates: [] as Array<Record<string, unknown>>, invokes: [] as string[] }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as { from: (t: string) => unknown; functions: { invoke: (name: string) => Promise<unknown> } }
  const realFrom = stub.from.bind(stub)
  stub.functions.invoke = (name: string) => {
    db.invokes.push(name)
    return Promise.resolve({ data: { ok: true, emailed: true, sign_url: 'https://app.example/sign?t=tok' }, error: null })
  }
  stub.from = (table: string) => {
    if (table !== 'job_contracts') return realFrom(table)
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'order', 'in', 'is', 'limit', 'insert']) builder[m] = () => builder
    builder.update = (payload: Record<string, unknown>) => {
      db.updates.push(payload)
      db.row = { ...db.row, ...payload }
      return builder
    }
    builder.maybeSingle = () => Promise.resolve({ data: db.row, error: null })
    builder.single = () => Promise.resolve({ data: db.row, error: null })
    builder.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: [db.row], error: null }).then(ok)
    return builder
  }
  return { supabase: stub }
})

const job = makeJob({ id: 'j1', hcp_number: '363', job_name: 'Michael Palmer', customer_name: 'Michael Palmer', customer_email: 'palmer@example.com', revenue: 31400 })
const draftRow = () => ({
  id: 'c1', job_id: 'j1', status: 'draft', revision: 1,
  fields: { scope_lines: ['Water heater'], amount_cents: 3_140_000, payment_terms_key: 'half_down', payment_terms_text: '', start_date: '2026-10-01', completion_date: null },
  body_html: 'terms', body_format: 'plain', template_name: 'Service agreement', template_document_id: null, recipient_name: 'Michael Palmer', recipient_email: 'palmer@example.com', recipient_phone: null, cc_emails: [],
  public_token: null, public_token_expires_at: null, sent_at: null, last_sent_at: null, send_count: 0, first_viewed_at: null, last_viewed_at: null, view_count: 0,
  reminders_enabled: true, reminder_count: 0, next_reminder_at: null, signed_at: null, signer_mode: null, voided_at: null, sent_channel: null, created_at: '2026-09-20T14:00:00Z', updated_at: '2026-09-20T15:00:00Z',
})

const HELD_LINE = /Not saved: a date is not finished\. Type the year in full, like \d{4}\./
const startBox = () => screen.getByLabelText('Start date') as HTMLInputElement
const savedStartDates = () => db.updates.map((u) => (u.fields as { start_date: string | null }).start_date)

/** Real timers for the window, fake ones for the 800 ms pause that follows this change. */
async function pauseAfter(change: () => void) {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  try {
    change()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(900)
    })
  } finally {
    vi.useRealTimers()
  }
  await settle()
}

async function openDraftOnItsDates() {
  renderWithProviders(<JobContractModal open onClose={() => undefined} job={job} />)
  await screen.findByText('Saved as you type.')
  await settle()
  fireEvent.click(screen.getByTestId('paper-dates'))
  expect(startBox().value).toBe('2026-10-01')
  db.updates = []
}

beforeEach(() => {
  db.row = draftRow()
  db.updates = []
  db.invokes = []
})
afterEach(cleanup)

describe('JobContractModal — a date caught half typed', () => {
  it('a pause mid-year writes nothing and the status line says the draft is waiting on the date', async () => {
    await openDraftOnItsDates()
    await pauseAfter(() => fireEvent.change(startBox(), { target: { value: '0002-10-01' } }))
    expect(db.updates).toEqual([])
    expect(screen.getByText(HELD_LINE)).toBeTruthy()
    expect(screen.queryByText('Saved as you type.')).toBeNull()
  })

  it('nothing else on the draft is written while the date is unfinished — the saved date is never written over', async () => {
    await openDraftOnItsDates()
    await pauseAfter(() => fireEvent.change(startBox(), { target: { value: '0020-10-01' } }))
    await pauseAfter(() => fireEvent.change(screen.getByLabelText('Estimated completion date'), { target: { value: '2026-11-15' } }))
    expect(db.updates).toEqual([])
    expect(screen.getByText(HELD_LINE)).toBeTruthy()
  })

  it('the finished year saves the draft, with everything that waited on it', async () => {
    await openDraftOnItsDates()
    await pauseAfter(() => fireEvent.change(startBox(), { target: { value: '0202-10-08' } }))
    await pauseAfter(() => fireEvent.change(screen.getByLabelText('Estimated completion date'), { target: { value: '2026-11-15' } }))
    expect(db.updates).toEqual([])
    await pauseAfter(() => fireEvent.change(startBox(), { target: { value: '2026-10-08' } }))
    expect(savedStartDates()).toEqual(['2026-10-08'])
    expect(db.updates[0]?.fields).toMatchObject({ start_date: '2026-10-08', completion_date: '2026-11-15', scope_lines: ['Water heater'] })
    expect(await screen.findByText('Saved as you type.')).toBeTruthy()
    expect(screen.queryByText(HELD_LINE)).toBeNull()
  })

  it('an emptied date is a cleared date: it saves as null', async () => {
    await openDraftOnItsDates()
    await pauseAfter(() => fireEvent.change(startBox(), { target: { value: '' } }))
    expect(savedStartDates()).toEqual([null])
  })
})

describe('JobContractModal — one edit, one save', () => {
  it('the save does not set off the next one: the window stays still after a single edit', async () => {
    await openDraftOnItsDates()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      fireEvent.change(screen.getByLabelText('Estimated completion date'), { target: { value: '2026-11-15' } })
      for (let i = 0; i < 6; i++) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(900)
        })
      }
    } finally {
      vi.useRealTimers()
    }
    await settle()
    expect(db.updates).toHaveLength(1)
  })
})

describe('JobContractModal — a half-typed date and the clicks that take the draft out', () => {
  const STOPS_OUT = /Finish the “Start” date before this goes out\. Type the year in full, like \d{4}\./
  const typeStart = (value: string) => pauseAfter(() => fireEvent.change(startBox(), { target: { value } }))

  it('Send the link sends nothing and saves nothing: the toast names the box', async () => {
    await openDraftOnItsDates()
    await typeStart('0026-10-01')
    fireEvent.click(screen.getByTestId('contract-way-go'))
    await settle()
    expect(screen.getByText(STOPS_OUT)).toBeTruthy()
    expect(db.invokes).toEqual([])
    expect(db.updates).toEqual([])
  })

  it('Copy the link mints no link over a half-typed completion date', async () => {
    await openDraftOnItsDates()
    await pauseAfter(() => fireEvent.change(screen.getByLabelText('Estimated completion date'), { target: { value: '0202-11-15' } }))
    fireEvent.click(screen.getByRole('button', { name: 'Copy the link' }))
    await settle()
    expect(screen.getByText(/Finish the “Estimated completion” date before this goes out\./)).toBeTruthy()
    expect(db.invokes).toEqual([])
    expect(db.updates).toEqual([])
  })

  it('On paper: neither the hand-over nor the emailed PDF goes while the date is unfinished', async () => {
    await openDraftOnItsDates()
    await typeStart('0002-10-01')
    fireEvent.click(screen.getByTestId('contract-way-paper'))
    expect(screen.getByTestId('contract-way-go').textContent).toBe('Download & mark handed over')
    fireEvent.click(screen.getByTestId('contract-way-go'))
    await settle()
    expect(screen.getByText(STOPS_OUT)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Email the PDF' }))
    fireEvent.click(screen.getByTestId('contract-way-go'))
    await settle()
    expect(db.invokes).toEqual([])
    expect(db.updates).toEqual([])
  })

  it('File their signed contract does not open the sheet: it would record the draft as signed', async () => {
    await openDraftOnItsDates()
    await typeStart('0026-10-01')
    fireEvent.click(screen.getByTestId('contract-exit-file'))
    await settle()
    expect(screen.getByText(/Finish the “Start” date before this is filed\. Type the year in full, like \d{4}\./)).toBeTruthy()
    expect(screen.queryByTestId('contract-file-sheet')).toBeNull()
    expect(db.updates).toEqual([])
  })

  it('with the year finished the same click saves the draft and sends it', async () => {
    await openDraftOnItsDates()
    await typeStart('0026-10-08')
    await typeStart('2026-10-08')
    db.updates = []
    fireEvent.click(screen.getByTestId('contract-way-go'))
    await waitFor(() => expect(db.invokes).toEqual(['send-job-contract']))
    expect(savedStartDates()).toEqual(['2026-10-08'])
    expect(screen.queryByText(STOPS_OUT)).toBeNull()
  })

  it('the filing sheet stops on its own Signed-on date with the year half typed, and records with it finished', async () => {
    await openDraftOnItsDates()
    fireEvent.click(screen.getByTestId('contract-exit-file'))
    const sheet = await screen.findByTestId('contract-file-sheet')
    fireEvent.change(within(sheet).getByLabelText('Google Doc link'), { target: { value: 'https://docs.google.com/document/d/1' } })
    const signedOn = within(sheet).getByLabelText('Date the contract was signed')
    fireEvent.change(signedOn, { target: { value: '0026-09-30' } })
    fireEvent.click(screen.getByTestId('contract-file-record'))
    await settle()
    expect(screen.getByText(/Finish the “Signed on” date before this is filed\. Type the year in full, like \d{4}\./)).toBeTruthy()
    expect(db.updates).toEqual([])
    fireEvent.change(signedOn, { target: { value: '2026-09-30' } })
    fireEvent.click(screen.getByTestId('contract-file-record'))
    await waitFor(() => expect(db.updates[0]).toMatchObject({ status: 'signed', paper_signed_on: '2026-09-30', signed_at: '2026-09-30T12:00:00Z' }))
  })
})
