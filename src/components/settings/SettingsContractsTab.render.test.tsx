// @vitest-environment jsdom
/**
 * Settings → Contracts & terms: the cards show the wording as it stands (the Settings text, the
 * Book document, the built-in), the doors do what the viewer's role allows, and two ticked cards
 * read side by side.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { installDomShims, renderSettled } from '../../test/renderSmokeMocks'
import { SettingsContractsTab } from './SettingsContractsTab'

const tables: Record<string, unknown[]> = {}

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as unknown as { from: (table: string) => unknown }
  const plain = stub.from
  stub.from = (table: string) => {
    const builder = plain(table) as Record<string, unknown>
    const rows = () => Promise.resolve({ data: tables[table] ?? [], error: null, count: 0 })
    builder.then = (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => rows().then(ok, bad)
    return builder
  }
  return { supabase: stub }
})

installDomShims()
afterEach(() => {
  cleanup()
  for (const k of Object.keys(tables)) delete tables[k]
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

  it('reads two ticked cards side by side, and a card with no wording cannot be ticked', async () => {
    await mount().view
    expect(screen.queryByTestId('contracts-compare')).toBeNull()
    fireEvent.click(within(screen.getByTestId('contract-card-bid-terms')).getByRole('button', { name: 'Compare' }))
    fireEvent.click(within(screen.getByTestId('contract-card-job-standard-terms')).getByRole('button', { name: 'Compare' }))
    const panel = within(screen.getByTestId('contracts-compare'))
    expect(panel.getByText(/2 texts, each as it stands today/)).toBeTruthy()
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
