// @vitest-environment jsdom
/**
 * People → Subs → Documents: a document's "expires" date saves a finished date only. The
 * browser hands over 0002-… while the year is typed; that writes nothing, and the finished
 * date writes once.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import PeopleSubsTab from './PeopleSubsTab'
import { renderWithProviders } from '../../test/renderSmokeMocks'

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

const writes: Array<{ table: string; patch: unknown }> = []
const TABLE_ROWS: Record<string, unknown[]> = {
  people: [{ id: 'p-jesse', name: 'Jesse Ramos', archived_at: null, account_user_id: null }],
  person_contract_documents: [{ id: 'd1', document_name: 'COI 2026', doc_type: 'coi', status: 'signed', expires_at: '2026-09-10', person_id: 'p-jesse', person_name: 'Jesse Ramos', applied_contract_template_document_id: null, applied_version_date: null }],
}

vi.mock('../../lib/supabase', () => {
  function makeBuilder(table: string): Record<string, unknown> {
    const rows = TABLE_ROWS[table] ?? []
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'insert', 'upsert', 'delete', 'eq', 'in', 'order', 'range', 'limit']) builder[m] = () => builder
    builder.update = (patch: unknown) => {
      writes.push({ table, patch })
      return builder
    }
    builder.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => Promise.resolve({ data: rows, error: null, count: rows.length }).then(onFulfilled, onRejected)
    return builder
  }
  return { supabase: { from: (table: string) => makeBuilder(table) } }
})

afterEach(cleanup)

const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)) })

describe('PeopleSubsTab · a document’s expires date', () => {
  it('a half-typed year writes nothing; a finished date writes once; a date left unfinished is dropped', async () => {
    renderWithProviders(<PeopleSubsTab />)
    fireEvent.click(await screen.findByRole('button', { name: /Documents \(1\)/ }))
    const box = screen.getByLabelText('COI 2026 expires') as HTMLInputElement
    expect(box.value).toBe('2026-09-10')
    writes.length = 0

    fireEvent.change(box, { target: { value: '0002-09-30' } })
    await settle()
    expect(writes).toHaveLength(0)
    fireEvent.change(box, { target: { value: '2026-09-30' } })
    await waitFor(() => expect(writes).toHaveLength(1))
    expect(writes[0]).toEqual({ table: 'person_contract_documents', patch: { expires_at: '2026-09-30' } })
    await settle()
    // The box stays open while its save runs.
    expect(box.disabled).toBe(false)

    writes.length = 0
    fireEvent.keyDown(box, { key: '2' })
    fireEvent.change(box, { target: { value: '0002-09-10' } })
    fireEvent.blur(box)
    await settle()
    expect(writes).toHaveLength(0)
    expect(box.value).toBe('2026-09-10')
    expect(screen.getByText(/That date was not finished, so it was not saved/)).toBeTruthy()
  })
})
