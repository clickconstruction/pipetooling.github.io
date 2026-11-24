// @vitest-environment jsdom
/**
 * Render smoke for the deep link `/people?tab=contracts&doc=<id>` on People → Contracts (v2.7924). A waiting line of
 * Documents → Agreements writes that address for a paper that is not signed, and the signing page's thank-you writes
 * it for a signed one. The choice is `contractsDocLanding`'s; this holds the wiring: the unsigned paper's row is in
 * view and marked with its Resend press and no error, and the signed paper still opens its signed record.
 *
 * Since v2.8436 a waiting line of a trade company's paper writes the address too: the paper is marked under its
 * company's row, and a company no one on the roster works at says its paper is kept in GC mode. Every name is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import PeopleContractsTab from './PeopleContractsTab'
import { renderWithProviders } from '../../test/renderSmokeMocks'

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

const SENT = '11111111-1111-4111-8111-111111111111'
const SIGNED = '22222222-2222-4222-8222-222222222222'
/** A trade company a sub works at, with a paper that waits; and one no one on the roster works at. */
const MECH = { id: 'c0000000-0000-4000-8000-000000000001', name: 'ZZ Sample Mechanical LLC' }
const GC_ONLY = { id: 'c0000000-0000-4000-8000-000000000002', name: 'Juniper Mechanical LLC' }
const CO_SENT = '77777777-7777-4777-8777-777777777777'
const CO_GC_ONLY = '99999999-9999-4999-8999-999999999999'

const paper = (over: Record<string, unknown>) => ({
  url: null,
  signing_body_html: '<p>Keep the job to yourself.</p>',
  signing_body_format: 'html',
  canonical_document_url: null,
  signed_at: null,
  sent_at: null,
  signer_last_viewed_at: null,
  note: null,
  dashboard_prompt_after_clock_in: false,
  applied_contract_template_document_id: null,
  applied_version_date: null,
  lineage_version: 1,
  supersedes_person_contract_document_id: null,
  form_template_id: null,
  office_completed_at: null,
  ...over,
})

const TABLE_ROWS: Record<string, unknown[]> = {
  contract_templates: [],
  contract_template_documents: [],
  person_contract_assignments: [],
  person_contract_documents: [
    paper({ id: SENT, person_name: 'Pat Lee', document_name: 'Job Secrecy Agreement', status: 'sent', sent_at: '2026-11-17T15:00:00Z', contract_lineage_id: 'l1' }),
    paper({ id: SIGNED, person_name: 'Pat Lee', document_name: 'W-9', status: 'signed', signed_at: '2026-11-01', contract_lineage_id: 'l2' }),
    paper({ id: '33333333-3333-4333-8333-333333333333', person_name: 'Sam Ortiz', document_name: 'W-9', status: 'signed', signed_at: '2026-10-01', contract_lineage_id: 'l3' }),
    paper({ id: CO_SENT, person_name: `gc-company:${MECH.id}`, company_id: MECH.id, document_name: 'Subcontractor agreement', status: 'sent', sent_at: '2026-11-18T15:00:00Z', contract_lineage_id: 'l4', signer_name: null, signer_title: null }),
    paper({ id: CO_GC_ONLY, person_name: `gc-company:${GC_ONLY.id}`, company_id: GC_ONLY.id, document_name: 'Trade agreement', status: 'sent', sent_at: '2026-11-19T15:00:00Z', contract_lineage_id: 'l5', signer_name: null, signer_title: null }),
  ],
  person_trade_companies: [{ person_id: 'p3', company_id: MECH.id, title: 'Owner' }],
  gc_companies: [MECH, GC_ONLY],
}

vi.mock('../../lib/supabase', () => {
  function makeBuilder(rows: unknown[], single: boolean): Record<string, unknown> {
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'neq', 'is', 'in', 'or', 'not', 'order', 'range', 'limit']) {
      builder[m] = () => builder
    }
    // The signed record window reads one paper by id; the smoke hands it the signed one.
    builder.maybeSingle = () => makeBuilder(rows.filter((r) => (r as { status?: string }).status === 'signed').slice(0, 1), true)
    builder.single = builder.maybeSingle
    builder.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve({ data: single ? (rows[0] ?? null) : rows, error: null, count: rows.length }).then(onFulfilled, onRejected)
    return builder
  }
  return {
    supabase: {
      from: (table: string) => makeBuilder(TABLE_ROWS[table] ?? [], false),
      rpc: () => makeBuilder([], false),
      functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
      storage: { from: () => ({ createSignedUrl: () => Promise.resolve({ data: null, error: null }) }) },
    },
  }
})

const people = [
  { id: 'p1', master_user_id: 'm1', kind: 'employee', name: 'Pat Lee', email: 'pat@example.com', phone: null, notes: null },
  { id: 'p2', master_user_id: 'm1', kind: 'employee', name: 'Sam Ortiz', email: null, phone: null, notes: null },
  { id: 'p3', master_user_id: 'm1', kind: 'sub', name: 'Lee Sample', email: null, phone: null, notes: null },
]

function openAt(search: string) {
  window.history.pushState({}, '', `/people${search}`)
  return renderWithProviders(<PeopleContractsTab people={people} users={[]} canDeletePeopleContracts={false} />)
}

beforeEach(() => {
  window.localStorage.clear()
  if (!(globalThis as { CSS?: { escape?: unknown } }).CSS?.escape) {
    ;(globalThis as unknown as { CSS: { escape: (s: string) => string } }).CSS = { escape: (s: string) => s }
  }
})
afterEach(() => {
  cleanup()
  window.history.pushState({}, '', '/')
})

describe('People → Contracts deep link', () => {
  it('lands a paper that is not signed on its own row, marked, with Resend and no error', async () => {
    const { container } = openAt(`?tab=contracts&doc=${SENT}`)

    // Pat's line is under Waiting, which the tab does not open on by itself: the link opens it and the paper's row.
    await screen.findByText('Job Secrecy Agreement')
    const row = container.querySelector(`[data-contract-doc-row="${SENT}"]`) as HTMLElement
    expect(row).toBeTruthy()
    expect(row.getAttribute('aria-current')).toBe('true')
    expect(within(row).getByRole('button', { name: 'Resend' })).toBeTruthy()

    // Only the linked paper is marked, and the signed record window stays shut.
    expect(container.querySelector(`[data-contract-doc-row="${SIGNED}"]`)?.getAttribute('aria-current')).toBeNull()
    expect(screen.queryByText(/not signed yet/)).toBeNull()
    expect(screen.queryByText(/not in signed status/)).toBeNull()
  })

  it('still opens the signed record for a signed paper, as the thank-you page links it', async () => {
    const { container } = openAt(`?tab=contracts&doc=${SIGNED}`)

    await screen.findByRole('dialog')
    expect(screen.queryByText(/not signed yet/)).toBeNull()
    expect(container.querySelector('[aria-current="true"]')).toBeNull()
  })

  it('opens nothing with no paper on the address', async () => {
    const { container } = openAt('?tab=contracts')

    await screen.findByText('Sam Ortiz')
    expect(container.querySelector('[aria-current="true"]')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('lands a trade company’s waiting paper under its company’s row, marked, and opens no signed record', async () => {
    const { container } = openAt(`?tab=contracts&doc=${CO_SENT}`)

    // The company's row is drawn over its worker once the companies are read, and the paper under it carries the mark.
    await waitFor(() => expect(container.querySelector(`[data-sub-company-paper="${CO_SENT}"]`)?.getAttribute('aria-current')).toBe('true'))
    const row = container.querySelector(`[data-sub-company-row="${MECH.id}"]`) as HTMLElement
    expect(within(row).getByText('ZZ Sample Mechanical LLC')).toBeTruthy()
    expect(within(row).getByText('Subcontractor agreement')).toBeTruthy()
    // The send is right there, and nothing else is marked.
    expect(within(row).getByRole('button', { name: 'Send for signature' })).toBeTruthy()
    expect(container.querySelectorAll('[aria-current="true"]')).toHaveLength(1)
    // The signed record window, which answers an unsigned paper with an error, stays shut.
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByText(/No one on the People list works there/)).toBeNull()
  })

  it('says a company no one on the roster works at keeps its paper in GC mode, and opens nothing', async () => {
    const { container } = openAt(`?tab=contracts&doc=${CO_GC_ONLY}`)

    expect(await screen.findByText('Trade agreement is with Juniper Mechanical LLC. No one on the People list works there, so the paper has no line on this tab. It is kept in GC mode.')).toBeTruthy()
    expect(container.querySelector('[aria-current="true"]')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
