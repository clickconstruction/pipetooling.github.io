// @vitest-environment jsdom
/**
 * Bill Customer's physical send, pressed end to end. Until this file no test pressed **Email the invoice to …**, so the
 * map's cuts that move or edit `submitPhysicalInvoiceEmail` had nothing under them. No PDF is built here
 * (`physicalInvoicePdf` is stubbed) and the edge function `send-physical-invoice-email` is a stub that keeps what it
 * was sent. Each case reads one log of what the press did, in order: the PDF, the ensure RPC, the send, the promote,
 * the measurement row, `onSuccess`, `onClose`. The window itself is untouched.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { FunctionsHttpError } from '@supabase/functions-js'
import { makeInvoice, makeJob, renderWithProviders, SMOKE_AUTH_USER_ID } from '../../test/renderSmokeMocks'
import type { PhysicalInvoiceDocument } from '../../lib/physicalInvoiceDocument'
import SendRecordInvoiceModal from './SendRecordInvoiceModal'

const ENSURE_RPC = 'ensure_single_ready_to_bill_invoice_for_job'
const SEND_FN = 'send-physical-invoice-email'
const PDF_BASE64 = 'JVBERi1zbW9rZQ=='

const walk = vi.hoisted(() => ({
  log: [] as string[],
  invokes: [] as Array<{ name: string; body: Record<string, unknown>; headers?: Record<string, string> }>,
  docs: [] as unknown[],
  detail: null as unknown,
  contacts: [] as Array<Record<string, unknown>>,
  ensureAnswer: {} as Record<string, unknown>,
  sendAnswer: { data: null, error: null } as { data: unknown; error: unknown },
  promoteAnswer: { ok: true } as { ok: true } | { ok: false; error: string },
  pdfBase64: '',
}))

// $3,630 of work with a $1,000 partial already carved off: the plan bills the $2,630 left.
const rtbJob = makeJob({
  id: 'job-978',
  hcp_number: '978',
  job_name: 'Penmoor demo',
  status: 'ready_to_bill',
  revenue: 3630,
  payments_made: 0,
  customer_id: 'cust-1',
  customer_name: 'Kestrin Contracting',
  customer_email: 'ap@kestrin.test',
  invoices: [makeInvoice({ id: 'partial-1', job_id: 'job-978', amount: 1000, is_primary_rtb_bundle: false })],
})

// A job marked Paid in Full that still holds an old $2,630 draft nobody sent.
const oldDraft = makeInvoice({ id: 'inv-draft', job_id: 'job-978', amount: 2630, is_primary_rtb_bundle: true })
const paidJob = makeJob({
  id: 'job-978',
  hcp_number: '978',
  job_name: 'Penmoor demo',
  status: 'paid',
  revenue: 2630,
  payments_made: 0,
  customer_id: 'cust-1',
  customer_name: 'Kestrin Contracting',
  customer_email: 'ap@kestrin.test',
  invoices: [oldDraft],
})

const JOB = { id: 'job-978', master_user_id: SMOKE_AUTH_USER_ID, hcp_number: '978', click_number: null, job_name: 'Penmoor demo', customer_id: 'cust-1', customer_name: 'Kestrin Contracting', customer_email: 'ap@kestrin.test' }

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as Record<string, unknown>
  const baseFrom = stub.from as (table: string) => Record<string, unknown>
  stub.from = (table: string) => {
    const b = baseFrom(table)
    // The customer's contact people, offered as copies under Send to.
    if (table === 'customer_contact_persons') {
      b.then = (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve({ data: walk.contacts, error: null, count: walk.contacts.length }).then(ok, bad)
    }
    for (const m of ['insert', 'update', 'upsert', 'delete'] as const) {
      const orig = b[m] as () => unknown
      b[m] = () => {
        walk.log.push(`write ${table}.${m}`)
        return orig()
      }
    }
    return b
  }
  stub.rpc = (fn: string) => {
    walk.log.push(`rpc ${fn}`)
    return Promise.resolve(fn === ENSURE_RPC ? { data: walk.ensureAnswer, error: null } : { data: null, error: null })
  }
  stub.auth = { ...(stub.auth as object), getSession: () => Promise.resolve({ data: { session: { access_token: 'jwt' } }, error: null }) }
  stub.functions = {
    invoke: (name: string, opts?: { body?: Record<string, unknown>; headers?: Record<string, string> }) => {
      walk.log.push(`invoke ${name}`)
      walk.invokes.push({ name, body: opts?.body ?? {}, headers: opts?.headers })
      return Promise.resolve(name === 'send-physical-invoice-email' ? walk.sendAnswer : { data: null, error: null })
    },
  }
  return { supabase: stub }
})

vi.mock('../../lib/fetchJobWithDetailsById', () => ({
  fetchJobWithDetailsById: async () => walk.detail,
}))

vi.mock('../../lib/promoteJobToBilledIfFullyInvoiced', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  maybePromoteJobToBilledAfterCustomerInvoice: async (jobId: string) => {
    walk.log.push(`promote ${jobId}`)
    return walk.promoteAnswer
  },
}))

// The PDF's own drawing has its tests (`physicalInvoicePdf.test.ts`); here only the document it is handed is kept.
vi.mock('../../lib/physicalInvoicePdf', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  buildPhysicalInvoicePdfBlob: async (doc: unknown) => {
    walk.log.push('pdf')
    walk.docs.push(doc)
    return new Blob(['%PDF-smoke'])
  },
  physicalInvoicePdfToBase64: async () => walk.pdfBase64,
}))

// The owner-of-record line reads the database itself and has its own smoke.
vi.mock('./BillCustomerOwnerLine', () => ({ default: () => null }))

beforeAll(() => {
  window.matchMedia = ((query: string) => ({ matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia
})

// Local noon on 18 November 2026: the window opens with that day as its service date, whatever the machine's zone.
const NOON = new Date(2026, 10, 18, 12, 0, 0)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOON)
  walk.log = []
  walk.invokes = []
  walk.docs = []
  walk.detail = rtbJob
  walk.contacts = []
  walk.ensureAnswer = { ok: true, invoice_id: 'inv-primary', amount: 2630, created: true }
  walk.sendAnswer = { data: { success: true }, error: null }
  walk.promoteAnswer = { ok: true }
  walk.pdfBase64 = PDF_BASE64
})

afterEach(() => {
  vi.useRealTimers()
})

type Payload = { kind: 'job'; job: typeof JOB } | { kind: 'invoice'; job: typeof JOB; invoice: typeof oldDraft }

function renderWindow(payload: Payload) {
  const onSuccess = vi.fn(async () => {
    walk.log.push('onSuccess')
  })
  const onClose = vi.fn(() => {
    walk.log.push('onClose')
  })
  renderWithProviders(<SendRecordInvoiceModal payload={payload} onClose={onClose} onSuccess={onSuccess} jobUpdating={false} invoiceUpdating={false} />)
  return { onSuccess, onClose }
}

async function physicalPress(): Promise<HTMLButtonElement> {
  fireEvent.click(await screen.findByRole('button', { name: 'Physical invoice' }))
  return (await screen.findByRole('button', { name: 'Email the invoice to Kestrin' })) as HTMLButtonElement
}

/** A table write, the ensure RPC or an edge call. The lines under Send to read the database as they mount, and reads are not kept. */
const isWriteOrSend = (entry: string) => entry.startsWith('write ') || entry === `rpc ${ENSURE_RPC}` || entry.startsWith('invoke ')

/**
 * Bill Customer on the job, on the Physical invoice tab, with the press live. `opened` is every write and send the
 * opening made; the log is then cleared, so a case reads only what its press did.
 */
async function openJobOnPhysical() {
  const fns = renderWindow({ kind: 'job', job: JOB })
  await waitFor(() => {
    expect(screen.getByText(/RTB \$2,630\.00/)).toBeTruthy()
  })
  const press = await physicalPress()
  await waitFor(() => {
    expect(press.disabled).toBe(false)
  })
  const opened = walk.log.filter(isWriteOrSend)
  walk.log = []
  return { ...fns, press, opened }
}

function panelControl(panelId: string): HTMLButtonElement {
  return document.querySelector(`button[aria-controls="${panelId}"]`) as HTMLButtonElement
}

function memoBox(): HTMLTextAreaElement {
  return document.getElementById('bill-customer-physical-memo-section-panel')!.querySelector('textarea') as HTMLTextAreaElement
}

/** The one call to the send's edge function. */
function sendCall() {
  const sends = walk.invokes.filter((i) => i.name === SEND_FN)
  expect(sends).toHaveLength(1)
  return sends[0]!
}

describe('SendRecordInvoiceModal — the physical send, pressed', () => {
  it('kind:job: the PDF first, then the bill row once, then one send on that row, then the promote, and the window closes', async () => {
    const { onSuccess, onClose, press, opened } = await openJobOnPhysical()
    // Opening the window and the tab wrote nothing and sent nothing (decision 17).
    expect(opened).toEqual([])
    const memo = memoBox().value

    fireEvent.click(press)
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1)
    })
    expect(walk.log).toEqual(['pdf', `rpc ${ENSURE_RPC}`, `invoke ${SEND_FN}`, 'promote job-978', 'write ui_nav_clicks.insert', 'onSuccess', 'onClose'])
    expect(onSuccess).toHaveBeenCalledTimes(1)

    const { body, headers } = sendCall()
    expect(headers).toEqual({ Authorization: 'Bearer jwt' })
    // The whole body: no allow_rebill, no copies and no notice attachments on a plain send.
    expect(body).toEqual({
      jobs_ledger_invoice_id: 'inv-primary',
      job_id: 'job-978',
      amount_dollars: 2630,
      sent_to_customer_at: NOON.toISOString(),
      external_send_note: memo.trim() || null,
      customer_email: 'ap@kestrin.test',
      subject: 'Click Plumbing Invoice [#978]',
      pdf_base64: PDF_BASE64,
      pdf_filename: 'Invoice-978-2026-11-18.pdf',
      email_text: expect.stringContaining('$2,630.00'),
      email_html: expect.stringContaining('$2,630.00'),
    })

    // The PDF is the document the email's words come from.
    expect(walk.docs).toHaveLength(1)
    const doc = walk.docs[0] as PhysicalInvoiceDocument
    expect(doc.amountFormatted).toBe('$2,630.00')
    expect(doc.customerName).toBe('Kestrin Contracting')
    expect(doc.customerEmail).toBe('ap@kestrin.test')
  })

  it('a typed line item override and memo reach the PDF and the send; a ticked contact and a one-off address ride as copies', async () => {
    walk.contacts = [
      { id: 'cp-1', name: 'Dana Park', email: 'dana@kestrin.test', gets_bill_copies: false },
      { id: 'cp-2', name: 'Lee Ortiz', email: 'lee@kestrin.test', gets_bill_copies: false },
    ]
    const { onClose, press } = await openJobOnPhysical()

    fireEvent.click(panelControl('bill-customer-physical-line-on-bill-section-panel'))
    fireEvent.change(document.getElementById('bill-customer-physical-line-description')!, { target: { value: 'Water heater swap, labor and parts' } })
    fireEvent.click(panelControl('bill-customer-physical-memo-section-panel'))
    fireEvent.change(memoBox(), { target: { value: 'Thank you for the work at Penmoor.' } })
    fireEvent.click(await screen.findByRole('checkbox', { name: /Dana Park/ }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Additional one-off email recipient' }), { target: { value: 'office@penmoor.test' } })

    fireEvent.click(press)
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    const doc = walk.docs[0] as PhysicalInvoiceDocument
    expect(doc.lineDescription).toBe('Water heater swap, labor and parts')
    expect(doc.memo).toBe('Thank you for the work at Penmoor.')
    const { body } = sendCall()
    expect(body.external_send_note).toBe('Thank you for the work at Penmoor.')
    expect(body.additional_emails).toEqual(['dana@kestrin.test', 'office@penmoor.test'])
    expect(body.email_text).toContain('Water heater swap, labor and parts')
    expect('allow_rebill' in body).toBe(false)
  })

  it('kind:invoice on a job marked Paid in Full: dead until Bill this job again anyway, then one send on the draft’s own row with allow_rebill and no ensure', async () => {
    walk.detail = paidJob
    const { onClose } = renderWindow({ kind: 'invoice', job: JOB, invoice: oldDraft })
    const press = await physicalPress()
    await waitFor(() => {
      expect(screen.getByText('This job is already paid in full — nothing to bill.')).toBeTruthy()
    })
    expect(press.disabled).toBe(true)

    fireEvent.click(screen.getByRole('checkbox', { name: 'Bill this job again anyway' }))
    await waitFor(() => {
      expect(press.disabled).toBe(false)
    })
    // Opening on the draft and ticking wrote nothing and sent nothing.
    expect(walk.log.filter(isWriteOrSend)).toEqual([])
    walk.log = []
    fireEvent.click(press)
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    // kind:'invoice' bills the row it was opened on: no ensure RPC (quirk 21).
    expect(walk.log).toEqual(['pdf', `invoke ${SEND_FN}`, 'promote job-978', 'write ui_nav_clicks.insert', 'onSuccess', 'onClose'])
    const { body } = sendCall()
    expect(body.jobs_ledger_invoice_id).toBe('inv-draft')
    expect(body.amount_dollars).toBe(2630)
    expect(body.allow_rebill).toBe(true)
  })

  it.each([
    [
      'with its reason in a 400 body',
      () => ({
        data: null,
        error: new FunctionsHttpError(new Response(JSON.stringify({ error: 'That address is not on this job.' }), { status: 400, headers: { 'content-type': 'application/json' } })),
      }),
      'That address is not on this job.',
    ],
    ['with its reason in the answer', () => ({ data: { error: 'The mail server refused the message.' }, error: null }), 'The mail server refused the message.'],
  ])('the send refused %s: the reason shows, nothing is promoted, and the window stays open', async (_how, answer, reason) => {
    walk.sendAnswer = answer()
    const { onSuccess, onClose, press } = await openJobOnPhysical()

    fireEvent.click(press)
    await waitFor(() => {
      expect(screen.getByText(reason)).toBeTruthy()
    })
    expect(walk.log).toEqual(['pdf', `rpc ${ENSURE_RPC}`, `invoke ${SEND_FN}`])
    expect(onSuccess).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    // The press comes back for another try.
    await waitFor(() => {
      expect(press.disabled).toBe(false)
    })
  })

  it('the bill went but the promote failed: its reason shows and the window stays open, before the measurement row (quirk 18)', async () => {
    walk.promoteAnswer = { ok: false, error: 'Could not move the job to Billed: permission denied' }
    const { onSuccess, onClose, press } = await openJobOnPhysical()

    fireEvent.click(press)
    await waitFor(() => {
      expect(screen.getByText('Could not move the job to Billed: permission denied')).toBeTruthy()
    })
    expect(walk.log).toEqual(['pdf', `rpc ${ENSURE_RPC}`, `invoke ${SEND_FN}`, 'promote job-978'])
    expect(sendCall().body.jobs_ledger_invoice_id).toBe('inv-primary')
    expect(onSuccess).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it.each([
    ['the amount left changed', { ok: true, invoice_id: 'inv-primary', amount: 2500, created: false }, 'The amount left to bill changed to $2,500.00 since you opened this — review the bill, then send again.'],
    ['every dollar is already on a bill', { ok: true, fully_allocated: true }, 'Nothing left to bill for this job — every dollar is already on an invoice.'],
    ['the database said no', { error: 'This job has more than one draft bill.' }, 'This job has more than one draft bill.'],
  ])('the ensure refused because %s: the reason shows and nothing is sent', async (_why, answer, reason) => {
    walk.ensureAnswer = answer
    const { onSuccess, onClose, press } = await openJobOnPhysical()

    fireEvent.click(press)
    await waitFor(() => {
      expect(screen.getByText(reason)).toBeTruthy()
    })
    expect(walk.log).toEqual(['pdf', `rpc ${ENSURE_RPC}`])
    expect(walk.invokes.filter((i) => i.name === SEND_FN)).toEqual([])
    expect(onSuccess).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('a PDF over 5,500,000 characters of base64 is refused before anything is written or sent (quirk 14)', async () => {
    walk.pdfBase64 = 'A'.repeat(5_500_001)
    const { onClose, press } = await openJobOnPhysical()

    fireEvent.click(press)
    await waitFor(() => {
      expect(screen.getByText('Generated PDF is too large to email')).toBeTruthy()
    })
    expect(walk.log).toEqual(['pdf'])
    expect(onClose).not.toHaveBeenCalled()
  })
})
