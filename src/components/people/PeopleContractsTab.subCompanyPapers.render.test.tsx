// @vitest-environment jsdom
/**
 * Render smoke for a sub's company's own papers on People → Contracts (punch list #403, step 6, PR 2). The company's
 * row lists its papers once, with Send for signature and Enter from paper. A worker's own paper says who they sign for.
 * The send keeps the signer at the company, makes the company's copy, names the signer on it, and calls the company
 * branch of the send function from the office. Enter from paper marks the copy signed by who and on what day.
 *
 * PR 1's notes, for the rows this file shares: A sub with a company sits
 * under the company's row, which names its workers. A sub with no company and a teammate draw as before. The find
 * box finds a worker by the company's name. On a sub's opened row the office keeps *Their company*: **Same as their
 * name** makes the company in one press, a name we have links it, and emptying the box takes them off. Anyone outside
 * the office's four roles reads no link and sees no control. Every name here is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import PeopleContractsTab from './PeopleContractsTab'
import { makeUseAuthValue, renderWithProviders } from '../../test/renderSmokeMocks'

const seen = vi.hoisted(() => ({
  role: 'dev',
  tables: [] as string[],
  rpcs: [] as Array<{ fn: string; args: unknown }>,
  writes: [] as Array<{ table: string; how: string; payload: unknown }>,
  invokes: [] as Array<{ fn: string; body: unknown }>,
  /** What take_back_company_paper answers. */
  takeBack: { data: 'taken', error: null } as { data: unknown; error: unknown },
}))

vi.mock('../../hooks/useAuth', () => {
  const value = () => makeUseAuthValue({ role: seen.role })
  return { useAuth: value, useOptionalAuth: value, AuthProvider: ({ children }: { children: unknown }) => children }
})

const MECH = { id: 'c-mech', name: 'ZZ Sample Mechanical LLC' }
const PIPE = { id: 'c-pipe', name: 'Sample Pipe Co' }

const TABLE_ROWS: Record<string, unknown[]> = {
  contract_templates: [],
  contract_template_documents: [
    { id: 'e-agr', template_id: 't1', document_name: 'Subcontractor agreement', sequence_order: 1, book_body_html: '<p>Terms.</p>', book_body_format: 'html', tags: [], updated_at: '2026-11-01T00:00:00Z', book_version_date: null, audience: 'sub', form_template_id: null },
    { id: 'e-w9', template_id: 't1', document_name: 'W-9', sequence_order: 2, book_body_html: null, book_body_format: 'html', tags: [], updated_at: '2026-11-01T00:00:00Z', book_version_date: null, audience: 'sub', form_template_id: 'f-w9' },
  ],
  person_contract_assignments: [],
  person_contract_documents: [
    {
      id: 'd-agr', person_name: 'gc-company:c-mech', company_id: 'c-mech', document_name: 'Subcontractor agreement', status: 'signed', signed_at: '2026-11-14',
      sent_at: null, signer_last_viewed_at: null, lineage_version: 2, form_template_id: null, signer_name: 'Pat Sample', signer_title: 'Owner',
    },
    {
      id: 'd-lee', person_name: 'Lee Sample', company_id: null, document_name: 'Site secrecy agreement', status: 'sent', signed_at: null, sent_at: '2026-11-18T15:00:00Z',
      signer_last_viewed_at: null, lineage_version: 1, form_template_id: null, signer_name: null, signer_title: null, signing_for: 'ZZ Sample Mechanical LLC',
      url: null, signing_body_html: '<p>Keep it.</p>', signing_body_format: 'html', canonical_document_url: null, note: null, dashboard_prompt_after_clock_in: false,
      applied_contract_template_document_id: null, applied_version_date: null, contract_lineage_id: 'l1', supersedes_person_contract_document_id: null, office_completed_at: null,
    },
  ],
  gc_company_people: [],
  person_trade_companies: [
    { person_id: 'p-pat', company_id: MECH.id, title: 'Owner' },
    { person_id: 'p-lee', company_id: MECH.id, title: null },
  ],
  gc_companies: [MECH, PIPE],
}

vi.mock('../../lib/supabase', () => {
  function makeBuilder(rows: unknown[]): Record<string, unknown> {
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'upsert', 'delete', 'eq', 'neq', 'is', 'in', 'or', 'not', 'order', 'range', 'limit']) {
      builder[m] = () => builder
    }
    builder.maybeSingle = () => builder
    builder.single = builder.maybeSingle
    builder.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve({ data: rows, error: null, count: rows.length }).then(onFulfilled, onRejected)
    return builder
  }
  return {
    supabase: {
      from: (table: string) => {
        seen.tables.push(table)
        const builder = makeBuilder(TABLE_ROWS[table] ?? [])
        for (const how of ['insert', 'update']) {
          builder[how] = (payload: unknown) => {
            seen.writes.push({ table, how, payload })
            return builder
          }
        }
        return builder
      },
      rpc: (fn: string, args: unknown) => {
        seen.rpcs.push({ fn, args })
        if (fn === 'take_back_company_paper') return Promise.resolve(seen.takeBack)
        return Promise.resolve({ data: fn === 'gc_company_paper' ? 'd-w9' : null, error: null })
      },
      functions: {
        invoke: (fn: string, opts: { body: unknown }) => {
          seen.invokes.push({ fn, body: opts.body })
          return Promise.resolve({ data: { ok: true, companyId: 'c-mech', messageId: 'm1', emailSendLogId: null, to: ['Pat Sample'], already: false }, error: null })
        },
      },
      storage: { from: () => ({ createSignedUrl: () => Promise.resolve({ data: null, error: null }) }) },
    },
  }
})

const person = (id: string, name: string, kind: string) => ({ id, master_user_id: 'm1', kind, name, email: null, phone: null, notes: null })
const people = [
  person('p-amy', 'Amy Staff', 'assistant'),
  person('p-kim', 'Kim Sample', 'sub'),
  person('p-lee', 'Lee Sample', 'sub'),
  { ...person('p-pat', 'Pat Sample', 'sub'), email: 'pat@example.test' },
]

/** Opens the tab and waits for its first read of the papers, which it starts on a short timer and which redraws the table. */
async function open(canDelete = false) {
  const view = renderWithProviders(<PeopleContractsTab people={people} users={[]} canDeletePeopleContracts={canDelete} />)
  // contract_templates is read by the tab's own load alone, which starts on its timer and hides the table while it runs.
  await waitFor(() => expect(seen.tables).toContain('contract_templates'))
  await waitFor(() => {
    expect(screen.queryByText('Loading…')).toBeNull()
    expect(view.container.querySelector('[data-contracts-person-row="Amy Staff"]')).toBeTruthy()
  })
  return view
}

const realMatchMedia = window.matchMedia
const PAPERS_AT_START = [...TABLE_ROWS.person_contract_documents!]
/** A W-9 that is out with the company, sent from People. */
const W9_OUT = {
  id: 'd-w9-out', person_name: 'gc-company:c-mech', company_id: 'c-mech', document_name: 'W-9', status: 'sent', signed_at: null, sent_at: '2026-11-18T15:00:00Z',
  signer_last_viewed_at: null, lineage_version: 1, form_template_id: 'f-w9', signer_name: 'Pat Sample', signer_title: 'Owner',
}

beforeEach(() => {
  TABLE_ROWS.gc_company_people = []
  TABLE_ROWS.person_contract_documents = [...PAPERS_AT_START]
  seen.takeBack = { data: 'taken', error: null }
  window.matchMedia = realMatchMedia
  seen.role = 'dev'
  seen.tables = []
  seen.rpcs = []
  seen.writes = []
  seen.invokes = []
  window.localStorage.clear()
})
afterEach(cleanup)

describe('People → Contracts, a sub’s company’s own papers', () => {
  it('lists the company’s papers once under its row, with its two presses, and a worker’s paper says who they sign for', async () => {
    const { container } = await open()
    const head = await waitFor(() => {
      const row = container.querySelector(`[data-sub-company-row="${MECH.id}"]`) as HTMLElement | null
      expect(row?.querySelector('[data-sub-company-paper="d-agr"]')).toBeTruthy()
      return row!
    })
    const line = head.querySelector('[data-sub-company-paper="d-agr"]') as HTMLElement
    expect(line.textContent).toContain('Subcontractor agreement')
    expect(line.textContent).toContain('Version 2 · signed Nov 14 by Pat Sample, Owner')
    expect(within(line).getByText('Signed')).toBeTruthy()
    expect(within(head).getByRole('button', { name: 'Send for signature' })).toBeTruthy()
    expect(within(head).getByRole('button', { name: 'Enter from paper' })).toBeTruthy()
    expect(container.querySelector(`[data-sub-company-foot="${MECH.id}"]`)?.textContent).toBe('The same papers are on Documents → Agreements.')

    // The company's paper is no worker's: Lee's row lists only Lee's own, with the company it is signed for.
    fireEvent.click(container.querySelector('[data-contracts-person-row="Lee Sample"]')!)
    await screen.findByText('Site secrecy agreement')
    expect(screen.getByText('signing for ZZ Sample Mechanical LLC')).toBeTruthy()
    expect(screen.getAllByText('Subcontractor agreement')).toHaveLength(1)
  })

  it('Send for signature opens on the owner and a paper not signed yet, then sends it from the office', async () => {
    const { container } = await open()
    await waitFor(() => expect(container.querySelector('[data-sub-company-paper="d-agr"]')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Send for signature' }))
    const dialog = await screen.findByRole('dialog', { name: 'Send for signature' })
    expect((within(dialog).getByLabelText('Paper') as HTMLSelectElement).value).toBe('e-w9')
    // The signed agreement is listed and held, with its reason.
    const held = within(dialog).getByRole('option', { name: 'Subcontractor agreement, That paper is signed already.' }) as HTMLOptionElement
    expect(held.disabled).toBe(true)
    expect((within(dialog).getByLabelText('Who signs') as HTMLSelectElement).value).toBe('Pat Sample')
    expect((within(dialog).getByLabelText('Their email') as HTMLInputElement).value).toBe('pat@example.test')
    expect(dialog.textContent).toContain('The paper says Pat Sample, Owner, signing for ZZ Sample Mechanical LLC.')

    fireEvent.click(within(dialog).getByRole('button', { name: 'Send email' }))
    await waitFor(() => expect(seen.invokes).toHaveLength(1))
    expect(seen.writes).toContainEqual({
      table: 'gc_company_people',
      how: 'insert',
      payload: { company_id: MECH.id, name: 'Pat Sample', email: 'pat@example.test', role: 'Owner', gets: ['contracts'], added_by: 'office' },
    })
    expect(seen.rpcs).toContainEqual({ fn: 'gc_company_paper', args: { p_company_id: MECH.id, p_book_entry_id: 'e-w9' } })
    expect(seen.writes).toContainEqual({ table: 'person_contract_documents', how: 'update', payload: { signer_name: 'Pat Sample', signer_title: 'Owner', signer_email: 'pat@example.test' } })
    const sent = seen.invokes[0]!
    expect(sent.fn).toBe('send-contract-for-signature')
    const body = sent.body as { person_contract_document_id: string; trade_email: Record<string, unknown> }
    expect(body.person_contract_document_id).toBe('d-w9')
    expect(body.trade_email).toMatchObject({ companyId: MECH.id, from: 'office', lang: 'en', subject: 'Please sign: W-9', actionLabel: 'Read and sign' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Send for signature' })).toBeNull())
  })

  it('Enter from paper keeps the paper as signed by who and on what day, and sends nothing', async () => {
    const { container } = await open()
    await waitFor(() => expect(container.querySelector('[data-sub-company-paper="d-agr"]')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Enter from paper' }))
    const dialog = await screen.findByRole('dialog', { name: 'Enter from paper' })
    fireEvent.change(within(dialog).getByLabelText('Day they signed'), { target: { value: '2026-10-30' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enter as signed' }))
    await waitFor(() =>
      expect(seen.writes).toContainEqual({
        table: 'person_contract_documents',
        how: 'update',
        payload: { status: 'signed', signed_at: '2026-10-30', signer_name: 'Pat Sample', signer_title: 'Owner', note: 'Entered from paper.' },
      }),
    )
    expect(seen.invokes).toHaveLength(0)
  })

  it('the send window opens a signer’s address from the company’s own people when the roster has none, and keeps what the office types', async () => {
    // Lee has no roster address. The company keeps one for Lee from an earlier send, its capitals as they were typed.
    TABLE_ROWS.gc_company_people = [{ id: 'gp-lee', name: 'LEE Sample', email: 'lee@example.test', gets: ['contracts'] }]
    const { container } = await open()
    await waitFor(() => expect(container.querySelector('[data-sub-company-paper="d-agr"]')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Send for signature' }))
    const dialog = await screen.findByRole('dialog', { name: 'Send for signature' })
    const box = within(dialog).getByLabelText('Their email') as HTMLInputElement
    // The owner's address is the roster's, as before.
    expect(box.value).toBe('pat@example.test')
    fireEvent.change(within(dialog).getByLabelText('Who signs'), { target: { value: 'Lee Sample' } })
    await waitFor(() => expect(box.value).toBe('lee@example.test'))
    // An address the office types stays, an emptied box included.
    fireEvent.change(box, { target: { value: '' } })
    expect(box.value).toBe('')
    fireEvent.change(box, { target: { value: 'other@example.test' } })
    expect(box.value).toBe('other@example.test')
    // Picking the worker again reads their kept address again.
    fireEvent.change(within(dialog).getByLabelText('Who signs'), { target: { value: 'Pat Sample' } })
    fireEvent.change(within(dialog).getByLabelText('Who signs'), { target: { value: 'Lee Sample' } })
    expect(box.value).toBe('lee@example.test')
    expect(seen.writes).toHaveLength(0)
  })

  it('on a phone the company’s two presses stand a fingertip tall, and at a desk they keep their own height', async () => {
    const { container, unmount } = await open()
    await waitFor(() => expect(container.querySelector('[data-sub-company-paper="d-agr"]')).toBeTruthy())
    expect((screen.getByRole('button', { name: 'Send for signature' }) as HTMLElement).style.minHeight).toBe('36px')
    expect((screen.getByRole('button', { name: 'Enter from paper' }) as HTMLElement).style.minHeight).toBe('36px')
    unmount()

    window.matchMedia = ((query: string) => ({ matches: query === '(max-width: 640px)', media: query, addEventListener: () => undefined, removeEventListener: () => undefined })) as unknown as typeof window.matchMedia
    const phone = await open()
    await waitFor(() => expect(phone.container.querySelector('[data-sub-company-paper="d-agr"]')).toBeTruthy())
    expect((screen.getByRole('button', { name: 'Send for signature' }) as HTMLElement).style.minHeight).toBe('44px')
    expect((screen.getByRole('button', { name: 'Enter from paper' }) as HTMLElement).style.minHeight).toBe('44px')
  })

  it('the controller takes a company’s waiting paper back on its line: the confirm, then the function, then a fresh read', async () => {
    TABLE_ROWS.person_contract_documents = [...PAPERS_AT_START, W9_OUT]
    seen.role = 'controller'
    const { container } = await open()
    const line = await waitFor(() => {
      const found = container.querySelector('[data-sub-company-paper="d-w9-out"]') as HTMLElement | null
      expect(found).toBeTruthy()
      return found!
    })
    // The signed agreement is the record of what was agreed: no press on it.
    expect(container.querySelector('[data-sub-company-paper="d-agr"]')?.querySelector('button')).toBeNull()
    fireEvent.click(within(line).getByRole('button', { name: 'Take back' }))
    expect(
      await screen.findByText('This deletes the copy of W-9 that is with ZZ Sample Mechanical LLC. The signing link sent to Pat Sample stops working. Nobody is emailed. It cannot be undone.'),
    ).toBeTruthy()
    expect(seen.rpcs).toEqual([])
    const reads = seen.tables.filter((t) => t === 'person_trade_companies').length
    fireEvent.click(screen.getByRole('button', { name: 'Take back the paper' }))
    expect(await screen.findByText('W-9 was taken back from ZZ Sample Mechanical LLC. Its signing link no longer works.')).toBeTruthy()
    expect(seen.rpcs).toEqual([{ fn: 'take_back_company_paper', args: { p_document_id: 'd-w9-out' } }])
    // The company's rows are read again, so the line leaves the row.
    await waitFor(() => expect(seen.tables.filter((t) => t === 'person_trade_companies').length).toBeGreaterThan(reads))
    expect(seen.writes).toHaveLength(0)
  })

  it('a paper GC mode is waiting on stays, and the office reads why', async () => {
    TABLE_ROWS.person_contract_documents = [...PAPERS_AT_START, W9_OUT]
    seen.takeBack = { data: null, error: { code: 'P0001', message: 'W-9 stays with ZZ Sample Mechanical LLC, since GC mode asked for it by Nov 30. It is GC mode’s paper to chase.' } }
    const { container } = await open()
    await waitFor(() => expect(container.querySelector('[data-sub-company-paper="d-w9-out"]')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Take back' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Take back the paper' }))
    // The function's own words, behind what the press was doing.
    expect(await screen.findByText('Failed to take back the paper: W-9 stays with ZZ Sample Mechanical LLC, since GC mode asked for it by Nov 30. It is GC mode’s paper to chase.')).toBeTruthy()
    expect(container.querySelector('[data-sub-company-paper="d-w9-out"]')).toBeTruthy()
  })

  it('the leader and an assistant see no Take back on a company’s paper, though the leader deletes a paper here', async () => {
    TABLE_ROWS.person_contract_documents = [...PAPERS_AT_START, W9_OUT]
    for (const role of ['master_technician', 'assistant']) {
      seen.role = role
      const view = await open(true)
      await waitFor(() => expect(view.container.querySelector('[data-sub-company-paper="d-w9-out"]')).toBeTruthy())
      expect(screen.queryByRole('button', { name: 'Take back' })).toBeNull()
      view.unmount()
    }
  })

  it('a send to an address that is not one says so and writes nothing', async () => {
    const { container } = await open()
    await waitFor(() => expect(container.querySelector('[data-sub-company-paper="d-agr"]')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Send for signature' }))
    const dialog = await screen.findByRole('dialog', { name: 'Send for signature' })
    fireEvent.change(within(dialog).getByLabelText('Their email'), { target: { value: 'not an address' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send email' }))
    expect(within(dialog).getByRole('alert').textContent).toBe('Enter a valid email address.')
    expect(seen.writes).toHaveLength(0)
    expect(seen.invokes).toHaveLength(0)
  })
})
