// @vitest-environment jsdom
/**
 * Render smoke for the shared "Add document" form (Subs row expander + Person
 * Desk → Paperwork): nothing is written on open; Save with a COI and no expiry
 * is refused with the kernel's reason; a valid COI inserts once, typed, with
 * the expiry, then fires onSaved and the `sub_document_added` telemetry row.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { SubDocumentAddForm } from './SubDocumentAddForm'
import { renderWithProviders } from '../../test/renderSmokeMocks'

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant' })
})

const inserts: Array<{ table: string; row: Record<string, unknown> }> = []
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      insert: (row: Record<string, unknown>) => {
        inserts.push({ table, row })
        return Promise.resolve({ data: null, error: null })
      },
    }),
  },
}))

describe('SubDocumentAddForm', () => {
  it('writes nothing on open, refuses a COI without an expiry, then files a typed COI once', async () => {
    const onSaved = vi.fn()
    renderWithProviders(<SubDocumentAddForm personId="p-1" personName="Jesse Ramos" onSaved={onSaved} onCancel={() => {}} />)
    expect(inserts).toHaveLength(0)

    fireEvent.change(screen.getByLabelText('Document type'), { target: { value: 'coi' } })
    expect((screen.getByLabelText('Document name') as HTMLInputElement).value).toBe('COI (filed)')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect((await screen.findByRole('alert')).textContent).toBe('A COI needs its expiration date.')
    expect(inserts).toHaveLength(0)

    fireEvent.change(screen.getByLabelText('Expiration date'), { target: { value: '2027-03-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))

    const docInserts = inserts.filter((i) => i.table === 'person_contract_documents')
    expect(docInserts).toHaveLength(1)
    expect(docInserts[0]!.row).toMatchObject({ person_id: 'p-1', person_name: 'Jesse Ramos', doc_type: 'coi', expires_at: '2027-03-01', status: 'signed', document_name: 'COI (filed)', lineage_version: 1 })
    await waitFor(() => expect(inserts.find((i) => i.table === 'ui_nav_clicks')?.row).toMatchObject({ control: 'sub_document_added', target: '#coi', role: 'assistant' }))
  })
})
