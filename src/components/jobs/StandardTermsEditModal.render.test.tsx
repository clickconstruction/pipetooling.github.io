// @vitest-environment jsdom
/** Signing it on paper PR 4 (v2.3642): the Edit standard terms window says how far it reaches and saves through the Book's RPC. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import StandardTermsEditModal from './StandardTermsEditModal'

const rpcSpy = vi.fn((_fn: string, _args: Record<string, unknown>) => Promise.resolve({ data: null, error: null }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as unknown as { rpc: unknown }
  stub.rpc = (fn: string, args: Record<string, unknown>) => rpcSpy(fn, args)
  return { supabase: stub }
})

afterEach(cleanup)

const doc = { id: 'd1', document_name: 'Service agreement', book_body_html: '1. Scope. …\n\n5. Warranty. One year.', book_body_format: 'plain', book_version_date: '2026-09-20' }

describe('StandardTermsEditModal', () => {
  it('names the document and its version, says what an edit reaches, and will not save an unchanged or blank document', async () => {
    renderWithProviders(<StandardTermsEditModal doc={doc} openJobs={105} onClose={() => undefined} onSaved={() => undefined} />)
    await settle()
    const reach = screen.getByTestId('standard-terms-reach').textContent ?? ''
    expect(reach).toContain('Service agreement · v. Sep 20')
    expect(reach).toContain('all 105 jobs still waiting in this sweep')
    expect(reach).toContain('already sent or signed keep the wording')
    expect(screen.getByTestId('standard-terms-hint').textContent).toBe('Nothing changed yet.')
    expect((screen.getByRole('button', { name: 'Save standard terms' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Standard terms'), { target: { value: '   ' } })
    expect(screen.getByTestId('standard-terms-hint').textContent).toMatch(/cannot be blank/)
  })

  it('saves through update_contract_book_entry with today as the version and hands the saved document back', async () => {
    rpcSpy.mockClear()
    const onSaved = vi.fn()
    renderWithProviders(<StandardTermsEditModal doc={doc} openJobs={24} onClose={() => undefined} onSaved={onSaved} />)
    await settle()
    fireEvent.change(screen.getByLabelText('Standard terms'), { target: { value: '1. Scope. …\n\n5. Warranty. Two years.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save standard terms' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    const [fn, args] = rpcSpy.mock.calls[0]!
    expect(fn).toBe('update_contract_book_entry')
    expect(args.p_contract_template_document_id).toBe('d1')
    expect(args.p_book_body_html).toContain('Two years')
    expect(args.p_book_body_format).toBe('plain')
    expect(String(args.p_book_version_date)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(onSaved.mock.calls[0]![0]).toMatchObject({ id: 'd1', book_body_html: expect.stringContaining('Two years') })
  })
})
