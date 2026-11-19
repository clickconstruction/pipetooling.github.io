// @vitest-environment jsdom
/**
 * Render smoke for the deep link `/people?tab=contracts&doc=<id>` on People → Contracts (v2.7924). A waiting line of
 * Documents → Agreements writes that address for a paper that is not signed, and the signing page's thank-you writes
 * it for a signed one. The choice is `contractsDocLanding`'s; this holds the wiring: the unsigned paper's row is in
 * view and marked with its Resend press and no error, and the signed paper still opens its signed record.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen, within } from '@testing-library/react'
import PeopleContractsTab from './PeopleContractsTab'
import { renderWithProviders } from '../../test/renderSmokeMocks'

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

const SENT = '11111111-1111-4111-8111-111111111111'
const SIGNED = '22222222-2222-4222-8222-222222222222'

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
  ],
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
})
