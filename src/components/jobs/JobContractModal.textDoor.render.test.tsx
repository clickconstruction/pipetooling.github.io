// @vitest-environment jsdom
/**
 * The Contract window's doors through the company number (punch list #125 PR 5, v2.6700): **Text the link** on a sent
 * row and the rail's phone-only **Text the link** open the customer's box with the signing link filled instead of an
 * `sms:` on the person's phone; **Send the link by email and text** emails through send-job-contract and texts through
 * quo-send in the same press when the typed number is on the customer's contact, and opens the box with the chip when
 * it is not; the chip under Mobile adds the typed number to the contact; the signed rail's **Text link** opens the box
 * with the signed record's link. Sam and the Oak Street job are made up; nothing is a real row.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { Contact } from '../../lib/contacts/kernel'
import { installDomShims, makeJob, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import JobContractModal from './JobContractModal'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, role: 'dev' }), useOptionalAuth: () => ({ user: { id: 'u1' }, role: 'dev', profileName: 'Rosa' }) }))
vi.mock('../../lib/physicalInvoiceIssuer', () => ({
  fetchPhysicalInvoiceIssuerFromAppSettings: () => Promise.resolve(),
  getPhysicalInvoiceIssuerForDocument: () => ({ companyName: 'Click', addressText: '', phone: '', email: 'office@clickplumbing.com', tagline: '', licenseLine: '' }),
}))
vi.mock('../estimates/CustomerAcceptanceRecordBody', () => ({
  CustomerAcceptanceRecordBody: () => <div data-testid="acceptance-body-stub">acceptance record</div>,
}))
vi.mock('../gc/messages/reply/useTextsOn', () => ({ useTextsOn: () => true }))

const SAM: Contact = {
  id: 'c-sam',
  kind: 'customer',
  name: 'Sam Sample',
  goesBy: null,
  company: '',
  record: { table: 'customers', id: 'cust-sam' },
  channels: [
    { id: 'ch-home', kind: 'phone', value: '(512) 555-0100', optedOutAt: null },
    { id: 'ch-email', kind: 'email', value: 'sam@example.com', optedOutAt: null },
  ],
  jobIds: [],
  defaultJobId: null,
  customerId: 'cust-sam',
  gcCompanyId: null,
}
const contactState: { current: Contact } = { current: SAM }
const added: { contactId: string; value: string }[] = []
vi.mock('../../lib/messages/messagesIo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/messages/messagesIo')>()),
  loadCustomerContact: () => Promise.resolve(contactState.current),
  addContactPhone: (contactId: string, value: string) => {
    added.push({ contactId, value })
    return Promise.resolve({ id: 'ch-new', kind: 'phone' as const, value, optedOutAt: null })
  },
}))
const texted: Record<string, unknown>[] = []
vi.mock('../../lib/messages/replyIo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/messages/replyIo')>()),
  supabaseReplyIo: () => ({
    loadSender: () => Promise.resolve({ name: 'Rosa' }),
    addNote: () => Promise.resolve('m-note'),
    sendEmail: () => Promise.resolve('m-email'),
    sendText: (input: Record<string, unknown>) => {
      texted.push(input)
      return Promise.resolve('m-text')
    },
    logCall: () => Promise.resolve('m-call'),
  }),
}))

const rowState: { current: Record<string, unknown> | null } = { current: null }
const calls: { invoked: string[] } = { invoked: [] }
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as { from: (t: string) => unknown; functions: { invoke: (name: string) => Promise<unknown> }; storage?: unknown }
  const realFrom = stub.from.bind(stub)
  stub.from = (table: string) => {
    if (table !== 'job_contracts') return realFrom(table)
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'order', 'in', 'is', 'limit', 'insert', 'update']) builder[m] = () => builder
    builder.maybeSingle = () => Promise.resolve({ data: rowState.current, error: null })
    builder.single = () => Promise.resolve({ data: rowState.current, error: null })
    builder.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: rowState.current ? [rowState.current] : [], error: null }).then(ok)
    return builder
  }
  stub.functions.invoke = (name: string) => {
    calls.invoked.push(name)
    if (rowState.current) rowState.current = { ...rowState.current, sent_channel: 'link', send_count: 2 }
    return Promise.resolve({ data: { ok: true, emailed: true, sign_url: 'https://app.example/contract/sign?t=minted' }, error: null })
  }
  stub.storage = { from: () => ({ createSignedUrl: () => Promise.resolve({ data: { signedUrl: 'https://files.example/sig.png' } }) }) }
  return { supabase: stub }
})

installDomShims()
beforeEach(() => {
  calls.invoked = []
  texted.length = 0
  added.length = 0
  contactState.current = SAM
  rowState.current = null
})
afterEach(cleanup)

const job = makeJob({ id: 'j1', hcp_number: '1053', job_name: 'Oak Street', job_address: '12 Oak St', customer_name: 'Sam Sample', customer_email: 'sam@example.com', customer_phone: '(512) 555-0100', revenue: 2200, gc_customer_id: null, customer_id: 'cust-sam' })
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString()
const sentRow = (p: Record<string, unknown> = {}) => ({
  id: 'c1', job_id: 'j1', status: 'sent', revision: 1, fields: { scope_lines: ['Water heater'], amount_cents: 220_000, payment_terms_key: 'half_down', payment_terms_text: '' },
  body_html: 'terms', body_format: 'plain', template_name: 'Service agreement', template_document_id: null, recipient_name: 'Sam Sample', recipient_email: 'sam@example.com', recipient_phone: '(512) 555-0100', cc_emails: [],
  public_token: 'tok-sent', public_token_expires_at: inDays(60), sent_at: '2026-11-01T15:00:00Z', last_sent_at: '2026-11-01T15:00:00Z', send_count: 1, first_viewed_at: null, last_viewed_at: null, view_count: 0,
  reminders_enabled: true, reminder_count: 0, next_reminder_at: '2026-11-04T15:00:00Z', signed_at: null, signer_mode: null, voided_at: null, sent_channel: 'email', created_at: '2026-11-01T14:00:00Z', updated_at: '2026-11-01T15:00:00Z', ...p,
})
/** A saved draft, so the rail's press has a row to send (the stub's insert answers nothing). */
const draftRow = () => sentRow({ status: 'draft', public_token: null, public_token_expires_at: null, sent_at: null, last_sent_at: null, send_count: 0, next_reminder_at: null, sent_channel: null })
const signedRow = () => ({
  ...sentRow({ status: 'signed', revision: 2, signed_at: '2026-11-02T14:30:00Z', signer_mode: 'draw', signer_printed_name: 'Sam Sample', signer_consented_at: '2026-11-02T14:29:00Z', signer_ip: '203.0.113.9', signer_user_agent: 'Mozilla/5.0 (iPhone)', signer_signature_storage_path: 'sig/c1.png', signed_pdf_path: 'pdf/c1.pdf', paper_upload_path: null, signed_document_url: null, paper_signed_on: null, template_version_date: '2026-09-01', sent_channel: null, view_count: 2, first_viewed_at: '2026-11-01T16:00:00Z', last_viewed_at: '2026-11-01T16:00:00Z' }),
})
const SIGN_WORDS = (url: string) => `Here is your service agreement for 12 Oak St — review and sign here: ${url}`

const door = async () => {
  const el = await screen.findByTestId('contract-text-door')
  await waitFor(() => expect(el.querySelector('[data-reply-box]')).toBeTruthy())
  return el
}

describe('JobContractModal — the doors through the company number (#125 PR 5)', () => {
  it('Text the link on a sent row opens the customer’s box with the row’s link filled, and no sms: is opened', async () => {
    rowState.current = sentRow()
    const before = window.location.href
    renderWithProviders(<JobContractModal open onClose={() => undefined} job={job} />)
    await screen.findByTestId('contract-sent-rail')
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Text the link' }))
    const el = await door()
    expect(el.textContent).toContain('Text the signing link')
    const words = within(el).getByRole('textbox') as HTMLTextAreaElement
    await waitFor(() => expect(words.value).toBe(SIGN_WORDS(`${window.location.origin}/contract/sign?t=tok-sent`)))
    expect(within(el).getByRole('button', { name: 'Send text…' })).toBeTruthy()
    expect(window.location.href).toBe(before)
    expect(calls.invoked).toEqual([])
    expect(texted).toEqual([])
    fireEvent.click(within(el).getByRole('button', { name: 'Close the text' }))
    expect(screen.queryByTestId('contract-text-door')).toBeNull()
  })

  it('Send the link by email and text: the email goes through send-job-contract and the text through quo-send in the same press, to the typed number', async () => {
    rowState.current = draftRow()
    renderWithProviders(<JobContractModal open onClose={() => undefined} job={job} />)
    const rail = await screen.findByTestId('contract-rail')
    await settle()
    fireEvent.click(within(rail).getByLabelText('Text it too'))
    await waitFor(() => expect(within(rail).getByTestId('contract-way-go').textContent).toBe('Send the link by email and text'))
    expect(within(rail).getByTestId('contract-way-sentence').textContent).toContain('texts (512) 555-0100 the same link from the company number')
    // the typed number is on Sam's contact: no chip
    await settle()
    expect(within(rail).queryByTestId('contract-add-number-chip')).toBeNull()
    fireEvent.click(within(rail).getByTestId('contract-way-go'))
    await waitFor(() => expect(calls.invoked).toEqual(['send-job-contract']))
    await waitFor(() => expect(texted).toHaveLength(1))
    expect(texted[0]).toMatchObject({ contactId: 'c-sam', channelId: 'ch-home', jobKey: 'pipeline:j1', body: SIGN_WORDS('https://app.example/contract/sign?t=minted'), held: false })
    expect(screen.queryByTestId('contract-text-door')).toBeNull()
  })

  it('a typed number not on the contact shows the chip under Mobile; one tap adds it, and the press then texts it', async () => {
    rowState.current = draftRow()
    renderWithProviders(<JobContractModal open onClose={() => undefined} job={job} />)
    const rail = await screen.findByTestId('contract-rail')
    await settle()
    fireEvent.change(within(rail).getByLabelText("Signer's mobile"), { target: { value: '512-555-0123' } })
    fireEvent.click(within(rail).getByLabelText('Text it too'))
    const chip = await within(rail).findByTestId('contract-add-number-chip')
    expect(chip.textContent).toBe('Add 512-555-0123 to Sam’s contact')
    fireEvent.click(chip)
    await waitFor(() => expect(added).toEqual([{ contactId: 'c-sam', value: '512-555-0123' }]))
    await waitFor(() => expect(within(rail).queryByTestId('contract-add-number-chip')).toBeNull())
    fireEvent.click(within(rail).getByTestId('contract-way-go'))
    await waitFor(() => expect(texted).toHaveLength(1))
    expect(texted[0]).toMatchObject({ channelId: 'ch-new' })
  })

  it('a typed number not on the contact, chip untapped: the email goes and the box opens with the chip in it', async () => {
    rowState.current = draftRow()
    renderWithProviders(<JobContractModal open onClose={() => undefined} job={job} />)
    const rail = await screen.findByTestId('contract-rail')
    await settle()
    fireEvent.change(within(rail).getByLabelText("Signer's mobile"), { target: { value: '512-555-0123' } })
    fireEvent.click(within(rail).getByLabelText('Text it too'))
    await within(rail).findByTestId('contract-add-number-chip')
    fireEvent.click(within(rail).getByTestId('contract-way-go'))
    await waitFor(() => expect(calls.invoked).toEqual(['send-job-contract']))
    const el = await screen.findByTestId('contract-text-door')
    await waitFor(() => expect(el.textContent).toContain('512-555-0123 is not on Sam’s contact yet'))
    expect(texted).toEqual([])
  })

  it('a mobile alone: the rail’s Text the link opens the box with the link, and sends nothing in the press', async () => {
    rowState.current = draftRow()
    renderWithProviders(<JobContractModal open onClose={() => undefined} job={job} />)
    const rail = await screen.findByTestId('contract-rail')
    await settle()
    fireEvent.change(within(rail).getByLabelText("Signer's email"), { target: { value: '' } })
    await waitFor(() => expect(within(rail).getByTestId('contract-way-go').textContent).toBe('Text the link'))
    expect(within(rail).getByTestId('contract-way-sentence').textContent).toContain('Opens the customer’s box with the Review & sign link, to text (512) 555-0100 from the company number.')
    fireEvent.click(within(rail).getByTestId('contract-way-go'))
    // a draft has no link yet: the send mints one, and nothing is texted
    await waitFor(() => expect(calls.invoked).toEqual(['send-job-contract']))
    const el = await door()
    await waitFor(() => expect((within(el).getByRole('textbox') as HTMLTextAreaElement).value).toBe(SIGN_WORDS('https://app.example/contract/sign?t=minted')))
    expect(texted).toEqual([])
  })

  it('the signed rail’s Text link opens the box with the signed record’s link', async () => {
    rowState.current = signedRow()
    const before = window.location.href
    renderWithProviders(<JobContractModal open onClose={() => undefined} job={job} />)
    const rail = await screen.findByTestId('contract-signed-rail')
    fireEvent.click(within(rail).getByRole('button', { name: 'Text link' }))
    const el = await door()
    expect(el.textContent).toContain('Text the signed agreement')
    await waitFor(() => expect((within(el).getByRole('textbox') as HTMLTextAreaElement).value).toBe(`Here is your signed agreement for 12 Oak St: ${window.location.origin}/contract/sign?t=tok-sent`))
    expect(window.location.href).toBe(before)
    expect(texted).toEqual([])
  })
})
