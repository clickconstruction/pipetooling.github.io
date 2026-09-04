/**
 * Form Studio — reads and writes for `contract_form_templates` and the Book
 * entry a published form becomes (Contract Forms PR 2). Dev-only by RLS; the
 * casts through `never` are the same pattern the sub-portal globe uses for
 * tables newer than the generated types.
 */

import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { bookEntryForForm } from './formStudioState'
import { emptyFormSchema, type FormSchema } from './formSchema'

export const FORM_TEMPLATES_BUCKET = 'contract-form-templates'

export type FormTemplateStatus = 'draft' | 'published' | 'retired'

export type FormTemplateRow = {
  id: string
  name: string
  revision_label: string
  pdf_storage_path: string
  pdf_sha256: string | null
  page_count: number
  schema: FormSchema
  status: FormTemplateStatus
  doc_type: string
  superseded_by_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  published_at: string | null
}

const COLUMNS = 'id, name, revision_label, pdf_storage_path, pdf_sha256, page_count, schema, status, doc_type, superseded_by_id, created_by, created_at, updated_at, published_at'

function normalise(row: Record<string, unknown>): FormTemplateRow {
  const schema = (row.schema as FormSchema | null) ?? emptyFormSchema([])
  return { ...(row as unknown as FormTemplateRow), schema: { ...emptyFormSchema(schema.pages ?? []), ...schema } }
}

export async function listFormTemplates(): Promise<FormTemplateRow[]> {
  const res = await withSupabaseRetry(
    async () => supabase.from('contract_form_templates' as never).select(COLUMNS).order('updated_at', { ascending: false }),
    'list form templates',
  )
  return ((res ?? []) as unknown as Record<string, unknown>[]).map(normalise)
}

export async function sha256Hex(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Upload the PDF to the private templates bucket and insert the row. */
export async function createFormTemplate(input: { name: string; revisionLabel: string; docType: string; pdf: ArrayBuffer; schema: FormSchema; createdBy: string | null }): Promise<FormTemplateRow> {
  const id = globalThis.crypto.randomUUID()
  const path = `${id}/template.pdf`
  const up = await supabase.storage.from(FORM_TEMPLATES_BUCKET).upload(path, new Blob([input.pdf], { type: 'application/pdf' }), { contentType: 'application/pdf', upsert: false })
  if (up.error) throw new Error(`Could not store the PDF: ${up.error.message}`)
  const sha = await sha256Hex(input.pdf)
  const inserted = await withSupabaseRetry<Record<string, unknown> | null>(
    async () =>
      supabase
        .from('contract_form_templates' as never)
        .insert({
          id,
          name: input.name.trim(),
          revision_label: input.revisionLabel.trim(),
          doc_type: input.docType,
          pdf_storage_path: path,
          pdf_sha256: sha,
          page_count: Math.max(1, input.schema.pages.length),
          schema: input.schema,
          status: 'draft',
          created_by: input.createdBy,
        } as never)
        .select(COLUMNS)
        .single(),
    'create form template',
  )
  if (!inserted) {
    await supabase.storage.from(FORM_TEMPLATES_BUCKET).remove([path])
    throw new Error('Could not create the form template')
  }
  return normalise(inserted)
}

/** Replace the PDF of an existing template (a new revision of the same form). */
export async function replaceFormTemplatePdf(row: FormTemplateRow, pdf: ArrayBuffer, pageCount: number): Promise<FormTemplateRow> {
  const up = await supabase.storage.from(FORM_TEMPLATES_BUCKET).upload(row.pdf_storage_path, new Blob([pdf], { type: 'application/pdf' }), { contentType: 'application/pdf', upsert: true })
  if (up.error) throw new Error(`Could not store the PDF: ${up.error.message}`)
  return saveFormTemplate(row.id, { pdf_sha256: await sha256Hex(pdf), page_count: Math.max(1, pageCount) })
}

export async function saveFormTemplate(id: string, patch: Partial<Pick<FormTemplateRow, 'name' | 'revision_label' | 'doc_type' | 'schema' | 'status' | 'published_at' | 'pdf_sha256' | 'page_count' | 'superseded_by_id'>>): Promise<FormTemplateRow> {
  const updated = await withSupabaseRetry<Record<string, unknown> | null>(
    async () => supabase.from('contract_form_templates' as never).update(patch as never).eq('id', id).select(COLUMNS).single(),
    'save form template',
  )
  if (!updated) throw new Error('Could not save the form template')
  return normalise(updated)
}

export async function deleteFormTemplate(row: FormTemplateRow): Promise<void> {
  await withSupabaseRetry(async () => supabase.from('contract_form_templates' as never).delete().eq('id', row.id), 'delete form template')
  await supabase.storage.from(FORM_TEMPLATES_BUCKET).remove([row.pdf_storage_path])
}

/** A short-lived URL for the studio to render the template PDF (dev-only storage policy). */
export async function templatePdfSignedUrl(path: string, seconds = 600): Promise<string> {
  const { data, error } = await supabase.storage.from(FORM_TEMPLATES_BUCKET).createSignedUrl(path, seconds)
  if (error || !data?.signedUrl) throw new Error(error?.message ?? 'Could not open the PDF')
  return data.signedUrl
}

export async function downloadTemplatePdf(path: string): Promise<ArrayBuffer> {
  const { data, error } = await supabase.storage.from(FORM_TEMPLATES_BUCKET).download(path)
  if (error || !data) throw new Error(error?.message ?? 'Could not download the PDF')
  return await data.arrayBuffer()
}

export type BookEntryLite = { id: string; template_id: string; document_name: string; sequence_order: number; form_template_id?: string | null }

/**
 * Publish: mark the template published and create (or move / rename) its Book
 * entry in the chosen packet. One Book entry per form template.
 */
export async function publishFormTemplate(input: {
  row: FormTemplateRow
  packetTemplateId: string
  documentName: string
  audience: string
  versionDate: string | null
  existingEntries: BookEntryLite[]
}): Promise<{ template: FormTemplateRow; bookEntryId: string }> {
  const template = await saveFormTemplate(input.row.id, { status: 'published', published_at: input.row.published_at ?? new Date().toISOString() })
  const mine = input.existingEntries.find((d) => d.form_template_id === input.row.id)
  const inPacket = input.existingEntries.filter((d) => d.template_id === input.packetTemplateId)
  const seq = inPacket.reduce((m, d) => Math.max(m, d.sequence_order), -1) + 1
  const payload = bookEntryForForm({ formTemplateId: input.row.id, packetTemplateId: input.packetTemplateId, documentName: input.documentName, audience: input.audience, sequenceOrder: mine ? mine.sequence_order : seq, versionDate: input.versionDate })
  if (mine) {
    const { template_id, document_name, audience, book_version_date } = payload
    await withSupabaseRetry(async () => supabase.from('contract_template_documents').update({ template_id, document_name, audience, book_version_date } as never).eq('id', mine.id), 'update form book entry')
    return { template, bookEntryId: mine.id }
  }
  const inserted = await withSupabaseRetry<{ id: string } | null>(
    async () => supabase.from('contract_template_documents').insert(payload as never).select('id').single(),
    'create form book entry',
  )
  if (!inserted) throw new Error('Could not create the Book entry')
  return { template, bookEntryId: inserted.id }
}
