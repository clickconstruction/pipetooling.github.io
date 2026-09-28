// @vitest-environment jsdom
/**
 * Settings → Contracts & terms: the cards show the wording as it stands (the Settings text, the
 * Book document, the built-in), the doors do what the viewer's role allows, and two ticked cards
 * read side by side.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { SMOKE_AUTH_USER_ID, installDomShims, renderSettled, settle } from '../../test/renderSmokeMocks'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { SettingsContractsTab } from './SettingsContractsTab'

const tables: Record<string, unknown[]> = {}
/** What `.insert(...).select().single()` hands back, per table. */
const inserted: Record<string, unknown> = {}
const writes: Array<{ table: string; op: 'insert' | 'delete'; row?: unknown }> = []

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as unknown as { from: (table: string) => unknown }
  const plain = stub.from
  stub.from = (table: string) => {
    const builder = plain(table) as Record<string, unknown>
    const rows = () => Promise.resolve({ data: tables[table] ?? [], error: null, count: 0 })
    builder.then = (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => rows().then(ok, bad)
    builder.insert = (row: unknown) => {
      writes.push({ table, op: 'insert', row })
      return builder
    }
    builder.delete = () => {
      writes.push({ table, op: 'delete' })
      return builder
    }
    builder.single = () => Promise.resolve({ data: inserted[table] ?? null, error: null })
    return builder
  }
  return { supabase: stub }
})

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

installDomShims()
afterEach(() => {
  cleanup()
  for (const k of Object.keys(tables)) delete tables[k]
  for (const k of Object.keys(inserted)) delete inserted[k]
  writes.length = 0
})

const BOOK_DOC = { id: 'doc-1', document_name: 'Service agreement', book_body_html: '1. Scope. The office wording.', book_body_format: 'plain', book_version_date: '2026-09-20', updated_at: '2026-09-20T12:00:00Z' }

function mount(role: 'dev' | 'master_technician' | 'assistant' = 'dev') {
  const onOpenEditor = vi.fn()
  const onOpenStep = vi.fn()
  const view = renderSettled(<SettingsContractsTab role={role} onOpenEditor={onOpenEditor} onOpenStep={onOpenStep} />, { loaded: () => screen.getByTestId('contracts-counts') })
  return { view, onOpenEditor, onOpenStep }
}

describe('SettingsContractsTab', () => {
  it('shows the built-in wording and says so when nothing is set', async () => {
    await mount().view
    expect(screen.getByRole('heading', { name: 'Contracts customers accept or sign' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Notices customers receive' })).toBeTruthy()
    const bid = within(screen.getByTestId('contract-card-bid-terms'))
    expect(bid.getByText('Built-in wording')).toBeTruthy()
    expect(bid.getByText(/All work to be completed in a workmanlike manner/)).toBeTruthy()
    const terms = within(screen.getByTestId('contract-card-estimate-terms'))
    expect(terms.getByText('Nothing set')).toBeTruthy()
    expect(terms.getByText(/the customer sees nothing here/)).toBeTruthy()
    const job = within(screen.getByTestId('contract-card-job-standard-terms'))
    expect(job.getByText(/Built-in service agreement terms/)).toBeTruthy()
    expect(job.getByText(/Add a customer document/)).toBeTruthy()
    expect(screen.getByTestId('contracts-counts').textContent).toMatch(/\d+ texts · .*0 dated|\d+ texts · .*1 dated/)
  })

  it('shows the office wording, dated, when Settings and the Book hold it', async () => {
    tables.app_settings = [{ key: 'bid_cover_letter_terms_default_v1', value_text: 'Net 30 from the invoice.' }, { key: 'estimate_public_terms_body', value_text: '1. Payment. Due on receipt.' }]
    tables.contract_template_documents = [BOOK_DOC]
    await mount().view
    const bid = within(screen.getByTestId('contract-card-bid-terms'))
    expect(bid.getByText('Your wording')).toBeTruthy()
    expect(bid.getByText('Net 30 from the invoice.')).toBeTruthy()
    const job = within(screen.getByTestId('contract-card-job-standard-terms:doc-1'))
    expect(job.getByText('1. Scope. The office wording.')).toBeTruthy()
    expect(job.getByText('Sep 20')).toBeTruthy()
    expect(job.getByRole('button', { name: 'Edit the wording' })).toBeTruthy()
  })

  it('a dev opens the editor; the office is told who edits it', async () => {
    const dev = mount('dev')
    await dev.view
    fireEvent.click(within(screen.getByTestId('contract-card-bid-terms')).getByRole('button', { name: /Open where it is edited/ }))
    expect(dev.onOpenEditor).toHaveBeenCalledWith('settings-catalogs', 'settings-bid-cover-letter-defaults')
    cleanup()
    await mount('assistant').view
    const bid = within(screen.getByTestId('contract-card-bid-terms'))
    expect(bid.queryByRole('button', { name: /Open where it is edited/ })).toBeNull()
    expect(bid.getByText(/A dev edits this/)).toBeTruthy()
  })

  it('the office edits a Book document on its card', async () => {
    tables.contract_template_documents = [BOOK_DOC]
    await mount('assistant').view
    fireEvent.click(within(screen.getByTestId('contract-card-job-standard-terms:doc-1')).getByRole('button', { name: 'Edit the wording' }))
    const reach = (await screen.findByTestId('standard-terms-reach')).textContent ?? ''
    expect(reach).toContain('every agreement sent from now on.')
    expect(reach).toContain("open that job’s Contract window")
  })

  it('opens the step a customer meets it on', async () => {
    const { view, onOpenStep } = mount()
    await view
    fireEvent.click(within(screen.getByTestId('contract-card-estimate-terms')).getByRole('button', { name: 'Terms page →' }))
    expect(onOpenStep).toHaveBeenCalledWith({ journeyId: 'homeowner', stepId: 'estimate-terms' })
  })

  it('sets a card against what last went out, and gives that copy a column', async () => {
    tables.contract_template_documents = [BOOK_DOC]
    tables.job_contracts = [
      { id: 'c1', status: 'sent', body_html: '1. Scope. The wording before.', body_format: 'plain', template_document_id: 'doc-1', template_version_date: '2026-09-01', last_sent_at: '2026-09-10T15:00:00Z', sent_at: '2026-09-10T15:00:00Z', signed_at: null, voided_at: null },
      { id: 'c2', status: 'draft', body_html: '1. Scope. The wording before.', body_format: 'plain', template_document_id: 'doc-1', template_version_date: '2026-09-01', last_sent_at: null, sent_at: null, signed_at: null, voided_at: null },
    ]
    tables.bid_proposal_room_revisions = [{ payload: { v: 1, terms: '', exclusions: 'No concrete.' }, published_at: '2026-09-26T18:00:00Z', rev_number: 3 }]
    await mount().view
    const job = await screen.findByTestId('contract-last-sent-job-standard-terms:doc-1')
    expect(job.textContent).toContain('The last agreement sent, Sep 10, 2026, carries older wording (the wording of Sep 1).')
    expect(job.textContent).toContain('1 unsent draft still carries older wording')
    expect(screen.getByTestId('contract-last-sent-bid-terms').textContent).toBe('The last proposal published, Sep 26, 2026 (rev 3), went out with no Terms at all.')
    expect(screen.getByTestId('contracts-differing').textContent).toMatch(/^\d+ cards? where what went out is not what the card says$/)
    // A card that keeps no copy says nothing about a last send.
    expect(screen.queryByTestId('contract-last-sent-estimate-terms')).toBeNull()
    const card = within(screen.getByTestId('contract-card-job-standard-terms:doc-1'))
    fireEvent.click(card.getByRole('button', { name: 'Compare' }))
    fireEvent.click(card.getByRole('button', { name: 'Compare what went out' }))
    const panel = within(screen.getByTestId('contracts-compare'))
    expect(panel.getByText('1. Scope. The office wording.')).toBeTruthy()
    expect(panel.getByText('1. Scope. The wording before.')).toBeTruthy()
    expect(panel.getByText(/What went out · Sent Sep 10/)).toBeTruthy()
  })

  it('dates a text from its history, reads what it said before, and answers for a day', async () => {
    tables.app_settings = [{ key: 'bid_cover_letter_terms_default_v1', value_text: 'Net 45.' }]
    tables.users = [{ id: 'u-taunya', name: 'Taunya' }]
    tables.contract_text_versions = [
      { id: 'v2', source_kind: 'app_setting', source_key: 'bid_cover_letter_terms_default_v1', name: null, body: 'Net 45.', body_format: 'plain', version_date: null, change_kind: 'changed', changed_at: '2026-09-28T18:00:00Z', changed_by: 'u-taunya' },
      { id: 'v1', source_kind: 'app_setting', source_key: 'bid_cover_letter_terms_default_v1', name: null, body: 'Net 30.', body_format: 'plain', version_date: null, change_kind: 'baseline', changed_at: '2026-09-01T18:00:00Z', changed_by: null },
    ]
    await mount().view
    const changed = await screen.findByText('Changed Sep 28, 2026 by Taunya.')
    expect(changed.getAttribute('data-testid')).toBe('contract-last-changed-bid-terms')
    // Wording with no history keeps its own line.
    expect(screen.getByTestId('contract-last-changed-esign-consent').textContent).toBe('version 2')
    const card = within(screen.getByTestId('contract-card-bid-terms'))
    fireEvent.click(card.getByRole('button', { name: 'History (2)' }))
    const panel = within(screen.getByTestId('contract-history-bid-terms'))
    expect(panel.getByText(/On record since Sep 1, 2026\. Changes before that were not kept\./)).toBeTruthy()
    fireEvent.click(panel.getAllByRole('button', { name: 'Read' })[1]!)
    expect(panel.getByText('Net 30.')).toBeTruthy()
    fireEvent.change(panel.getByLabelText('What did it say on'), { target: { value: '2026-09-15' } })
    expect(screen.getByTestId('contract-in-force-bid-terms').textContent).toContain('On Sep 15, 2026 it read as recorded Sep 1, 2026.')
    fireEvent.click(within(screen.getByTestId('contract-in-force-bid-terms')).getByRole('button', { name: 'Compare it' }))
    expect(within(screen.getByTestId('contracts-compare')).getByText(/^Before · On record since Sep 1, 2026/)).toBeTruthy()
    // No card without a history offers one.
    expect(within(screen.getByTestId('contract-card-esign-consent')).queryByRole('button', { name: /^History/ })).toBeNull()
  })

  it('marks a card reviewed with a note, and takes it back', async () => {
    const today = todayYmdInAppTz()
    inserted.contract_text_reviews = { id: 'r-new', entry_id: 'esign-consent', reviewed_on: today, note: 'Read with counsel.', reviewed_by: SMOKE_AUTH_USER_ID, created_at: '2026-09-28T18:00:00Z' }
    tables.contract_text_reviews = [{ id: 'r-old', entry_id: 'bid-terms', reviewed_on: '2025-01-10', note: null, reviewed_by: 'u-gone', created_at: '2025-01-10T18:00:00Z' }]
    await mount().view
    const before = await screen.findByTestId('contract-review-esign-consent')
    expect(before.textContent).toBe('Never reviewed.')
    expect(screen.getByTestId('contract-review-bid-terms').textContent).toContain('Reviewed Jan 10, 2025. Due since Jan 10, 2026.')
    expect(screen.getByTestId('contracts-reviews').textContent).toMatch(/^1 due for review · \d+ never reviewed$/)
    const card = within(screen.getByTestId('contract-card-esign-consent'))
    fireEvent.click(card.getByRole('button', { name: 'Mark reviewed' }))
    fireEvent.change(within(screen.getByTestId('contract-review-form-esign-consent')).getByLabelText('Review note'), { target: { value: '  Read with counsel.  ' } })
    fireEvent.click(card.getByRole('button', { name: 'Save the review' }))
    await waitFor(() => expect(screen.getByTestId('contract-review-esign-consent').textContent).toContain('Reviewed '))
    expect(screen.getByTestId('contract-review-esign-consent').textContent).toContain('Read with counsel.')
    expect(writes).toContainEqual({ table: 'contract_text_reviews', op: 'insert', row: { entry_id: 'esign-consent', reviewed_on: today, reviewed_by: SMOKE_AUTH_USER_ID, note: 'Read with counsel.' } })
    // Marked today by the person looking: it can be taken back. Someone else's review cannot.
    expect(within(screen.getByTestId('contract-card-bid-terms')).queryByRole('button', { name: 'Take it back' })).toBeNull()
    await settle()
    fireEvent.click(card.getByRole('button', { name: 'Take it back' }))
    await waitFor(() => expect(screen.getByTestId('contract-review-esign-consent').textContent).toBe('Never reviewed.'))
    expect(writes.some((w) => w.table === 'contract_text_reviews' && w.op === 'delete')).toBe(true)
  })

  it('reads two ticked cards side by side, and a card with no wording cannot be ticked', async () => {
    await mount().view
    expect(screen.queryByTestId('contracts-compare')).toBeNull()
    fireEvent.click(within(screen.getByTestId('contract-card-bid-terms')).getByRole('button', { name: 'Compare' }))
    fireEvent.click(within(screen.getByTestId('contract-card-job-standard-terms')).getByRole('button', { name: 'Compare' }))
    const panel = within(screen.getByTestId('contracts-compare'))
    expect(panel.getByText(/^2 texts\./)).toBeTruthy()
    expect(panel.getByText(/All work to be completed in a workmanlike manner/)).toBeTruthy()
    expect(panel.getByText(/1\. Scope\. Contractor agrees to perform the work/)).toBeTruthy()
    expect(within(screen.getByTestId('contract-card-estimate-terms-box')).queryByRole('button', { name: 'Compare' })).toBeNull()
    // The bar keeps the columns in reach from the cards below them.
    const bar = within(screen.getByTestId('contracts-compare-bar'))
    expect(bar.getByText('Comparing 2')).toBeTruthy()
    fireEvent.click(bar.getByRole('button', { name: /Read side by side/ }))
    fireEvent.click(panel.getByRole('button', { name: 'Clear' }))
    expect(screen.queryByTestId('contracts-compare')).toBeNull()
    expect(screen.queryByTestId('contracts-compare-bar')).toBeNull()
  })
})
