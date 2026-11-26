// @vitest-environment jsdom
/**
 * Form Studio's list and its Delete (punch list #389, v2.8620): a form a job requires or once required draws a dead
 * Delete with the reason beside it and opens no confirm; a free form's Delete confirms and deletes as before; a refusal
 * the database sends anyway, a job having required the form between the read and the press, is said in plain words.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import type { FormTemplateRow } from '../../../lib/forms/formTemplateRepo'
import { emptyFormSchema } from '../../../lib/forms/formSchema'

const repo = vi.hoisted(() => ({
  listFormTemplates: vi.fn<() => Promise<FormTemplateRow[]>>(),
  readFormHolds: vi.fn<(ids: readonly string[]) => Promise<Map<string, number>>>(),
  deleteFormTemplate: vi.fn<(row: FormTemplateRow) => Promise<void>>(),
}))
vi.mock('../../../lib/forms/formTemplateRepo', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../lib/forms/formTemplateRepo')>()
  return { ...real, listFormTemplates: repo.listFormTemplates, readFormHolds: repo.readFormHolds, deleteFormTemplate: repo.deleteFormTemplate }
})
vi.mock('../../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('./FormStudioEditor', () => ({ FormStudioEditor: () => <div data-editor /> }))

import { FormStudio } from './FormStudio'
import { renderWithProviders } from '../../../test/renderSmokeMocks'

function form(id: string, name: string): FormTemplateRow {
  return {
    id,
    name,
    revision_label: 'Rev. March 2024',
    pdf_storage_path: `${id}.pdf`,
    pdf_sha256: null,
    page_count: 1,
    schema: emptyFormSchema([]),
    status: 'published',
    doc_type: 'agreement',
    superseded_by_id: null,
    created_by: null,
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
    published_at: '2026-11-01T00:00:00Z',
  }
}

const held = form('f-held', 'Site secrecy form')
const free = form('f-free', 'Old W-9 layout')

describe('FormStudio · Delete', () => {
  beforeEach(() => {
    repo.listFormTemplates.mockReset().mockResolvedValue([held, free])
    repo.readFormHolds.mockReset().mockResolvedValue(new Map([['f-held', 2]]))
    repo.deleteFormTemplate.mockReset().mockResolvedValue(undefined)
  })
  afterEach(cleanup)

  async function draw() {
    const onSaved = vi.fn()
    const view = renderWithProviders(<FormStudio packets={[]} bookEntries={[]} onSaved={onSaved} />)
    await screen.findByText('Site secrecy form')
    return { onSaved, ...view }
  }

  it('a form two jobs hold draws a dead Delete with the reason beside it, and the press opens no confirm', async () => {
    const { container } = await draw()
    expect(repo.readFormHolds).toHaveBeenCalledWith(['f-held', 'f-free'])
    const deletes = screen.getAllByRole('button', { name: 'Delete' }) as HTMLButtonElement[]
    expect(deletes).toHaveLength(2)
    const heldPress = deletes[0]!
    expect(heldPress.disabled).toBe(true)
    expect(heldPress.title).toBe('2 jobs require this form or once required it. Their records keep it, so it stays.')
    expect(heldPress.style.cursor).toBe('not-allowed')
    expect(container.querySelector('[data-form-hold]')?.textContent).toBe('2 jobs require this form or once required it. Their records keep it, so it stays.')
    fireEvent.click(heldPress)
    expect(screen.queryByText('Delete "Site secrecy form"?')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete form' })).toBeNull()
    expect(repo.deleteFormTemplate).not.toHaveBeenCalled()
    // The free form's press is live, red, and carries no reason.
    const freePress = deletes[1]!
    expect(freePress.disabled).toBe(false)
    expect(freePress.title).toBe('')
    expect(container.querySelectorAll('[data-form-hold]')).toHaveLength(1)
  })

  it('a free form confirms and is deleted, as before', async () => {
    const { onSaved } = await draw()
    const freePress = screen.getAllByRole('button', { name: 'Delete' })[1]!
    fireEvent.click(freePress)
    await screen.findByText('Delete "Old W-9 layout"?')
    expect(screen.getByText('The uploaded PDF and its boxes are removed. This cannot be undone.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Delete form' }))
    await waitFor(() => expect(repo.deleteFormTemplate).toHaveBeenCalledWith(free))
    await waitFor(() => expect(screen.queryByText('Old W-9 layout')).toBeNull())
    expect(onSaved).toHaveBeenCalled()
    expect(screen.getByText('Site secrecy form')).toBeTruthy()
  })

  it('a refusal the database sends anyway is said in plain words, and the press goes dead', async () => {
    repo.deleteFormTemplate.mockRejectedValueOnce({
      code: '23503',
      message: 'update or delete on table "contract_form_templates" violates foreign key constraint "job_required_papers_form_template_id_fkey" on table "job_required_papers"',
    })
    repo.readFormHolds.mockResolvedValueOnce(new Map([['f-held', 2]])).mockResolvedValueOnce(new Map([['f-held', 2], ['f-free', 1]]))
    const { container } = await draw()
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[1]!)
    fireEvent.click(await screen.findByRole('button', { name: 'Delete form' }))
    await screen.findByText('The form stays. A job requires it or once required it, and that record keeps it.')
    expect(screen.queryByText(/violates foreign key constraint/)).toBeNull()
    await waitFor(() => expect((screen.getAllByRole('button', { name: 'Delete' })[1] as HTMLButtonElement).disabled).toBe(true))
    expect(container.querySelectorAll('[data-form-hold]')).toHaveLength(2)
    expect(screen.getByText('Old W-9 layout')).toBeTruthy()
  })

  it('when the holds cannot be read, every Delete stays live and the list still draws', async () => {
    repo.readFormHolds.mockRejectedValueOnce(new Error('refused'))
    const { container } = await draw()
    const deletes = screen.getAllByRole('button', { name: 'Delete' }) as HTMLButtonElement[]
    expect(deletes.every((b) => !b.disabled)).toBe(true)
    expect(container.querySelector('[data-form-hold]')).toBeNull()
  })
})
