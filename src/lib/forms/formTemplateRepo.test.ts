import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Form Studio's template repository: list / create / replace PDF / save /
 * delete, the private-bucket storage calls around them, and publish → Book
 * entry. Pins the storage paths and options, the row payloads, the schema
 * normalisation, the clean-up when an insert fails, and the one-entry-per-form
 * publish rule.
 */
type Step = { method: string; args: unknown[] }
const queries: Array<{ table: string; steps: Step[] }> = []
let route: (table: string, steps: Step[]) => { data: unknown; error: { message: string } | null } = () => ({ data: null, error: null })
const storage = {
  upload: vi.fn(async (_path: string, _blob: Blob, _opts: unknown): Promise<{ error: { message: string } | null }> => ({ error: null })),
  remove: vi.fn(async (_paths: string[]) => ({ error: null })),
  createSignedUrl: vi.fn(async (_path: string, _seconds: number): Promise<{ data: { signedUrl: string } | null; error: { message: string } | null }> => ({ data: { signedUrl: 'https://signed.test/x' }, error: null })),
  download: vi.fn(async (_path: string): Promise<{ data: { arrayBuffer: () => Promise<ArrayBuffer> } | null; error: { message: string } | null }> => ({ data: { arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer }, error: null })),
}
const bucketsUsed: string[] = []
vi.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => {
      const steps: Step[] = []
      queries.push({ table, steps })
      const p: unknown = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(route(table, steps))
            return (...a: unknown[]) => {
              steps.push({ method: String(prop), args: a })
              return p
            }
          },
        },
      )
      return p
    },
    storage: {
      from: (bucket: string) => {
        bucketsUsed.push(bucket)
        return storage
      },
    },
  },
}))
vi.mock('../../utils/errorHandling', () => ({
  withSupabaseRetry: async (op: () => Promise<{ data: unknown; error: { message: string } | null }>) => {
    const r = await op()
    if (r.error) throw new Error(r.error.message)
    return r.data
  },
}))

import { emptyFormSchema } from './formSchema'
import {
  createFormTemplate,
  deleteFormTemplate,
  downloadTemplatePdf,
  FORM_TEMPLATES_BUCKET,
  listFormTemplates,
  publishFormTemplate,
  replaceFormTemplatePdf,
  saveFormTemplate,
  sha256Hex,
  templatePdfSignedUrl,
  type FormTemplateRow,
} from './formTemplateRepo'

const argsOf = (steps: Step[], m: string) => steps.filter((s) => s.method === m).map((s) => s.args)
const q = (table: string) => queries.find((x) => x.table === table)!
const page = { width: 612, height: 792 }
const row = (over: Partial<FormTemplateRow> = {}): FormTemplateRow => ({
  id: 't1',
  name: 'W-9',
  revision_label: 'Rev A',
  pdf_storage_path: 't1/template.pdf',
  pdf_sha256: null,
  page_count: 1,
  schema: emptyFormSchema([page]),
  status: 'draft',
  doc_type: 'tax',
  superseded_by_id: null,
  created_by: 'u1',
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
  published_at: null,
  ...over,
})
const EMPTY_SHA = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

beforeEach(() => {
  queries.length = 0
  bucketsUsed.length = 0
  route = () => ({ data: null, error: null })
  for (const fn of Object.values(storage)) fn.mockClear()
  storage.upload.mockResolvedValue({ error: null })
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-07T18:00:00Z'))
})
afterEach(() => vi.useRealTimers())

describe('listFormTemplates', () => {
  it('reads newest-updated first and fills a missing or partial schema with the empty defaults', async () => {
    route = () => ({ data: [row({ schema: null as never }), row({ id: 't2', schema: { pages: [page], boxes: [{ id: 'b1' }] } as never })], error: null })
    const out = await listFormTemplates()
    expect(argsOf(q('contract_form_templates').steps, 'order')).toEqual([['updated_at', { ascending: false }]])
    expect(out[0]!.schema).toEqual(emptyFormSchema([]))
    expect(out[1]!.schema).toEqual({ ...emptyFormSchema([page]), pages: [page], boxes: [{ id: 'b1' }] })
    route = () => ({ data: null, error: null })
    expect(await listFormTemplates()).toEqual([])
  })
})

describe('sha256Hex', () => {
  it('hashes bytes to lowercase hex, from an ArrayBuffer or a Uint8Array alike', async () => {
    expect(await sha256Hex(new Uint8Array([]))).toBe(EMPTY_SHA)
    expect(await sha256Hex(new ArrayBuffer(0))).toBe(EMPTY_SHA)
    expect(await sha256Hex(new Uint8Array([1, 2, 3]))).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('createFormTemplate', () => {
  const input = { name: '  W-9 ', revisionLabel: ' Rev A ', docType: 'tax', pdf: new ArrayBuffer(0), schema: emptyFormSchema([page, page]), createdBy: 'u1' }
  it('uploads the PDF under a fresh id (no overwrite), inserts the draft row with its hash and page count, and returns it normalised', async () => {
    route = (_t, steps) => ({ data: { ...(argsOf(steps, 'insert')[0]![0] as object), created_at: 'x', updated_at: 'x', superseded_by_id: null, published_at: null }, error: null })
    const out = await createFormTemplate(input)
    expect(bucketsUsed[0]).toBe(FORM_TEMPLATES_BUCKET)
    const [path, blob, opts] = storage.upload.mock.calls[0]!
    expect(path).toMatch(/^[0-9a-f-]{36}\/template\.pdf$/)
    expect(blob.type).toBe('application/pdf')
    expect(opts).toEqual({ contentType: 'application/pdf', upsert: false })
    const inserted = argsOf(q('contract_form_templates').steps, 'insert')[0]![0] as Record<string, unknown>
    expect(inserted).toMatchObject({ name: 'W-9', revision_label: 'Rev A', doc_type: 'tax', pdf_storage_path: path, pdf_sha256: EMPTY_SHA, page_count: 2, status: 'draft', created_by: 'u1' })
    expect(inserted.id).toBe(path.split('/')[0])
    expect(out.name).toBe('W-9')
    expect(out.schema.pages).toEqual([page, page])
    expect(storage.remove).not.toHaveBeenCalled()
  })
  it('a failed upload stops before the insert; a failed insert removes the uploaded PDF', async () => {
    storage.upload.mockResolvedValueOnce({ error: { message: 'bucket full' } })
    await expect(createFormTemplate(input)).rejects.toThrow('Could not store the PDF: bucket full')
    expect(queries).toHaveLength(0)

    route = () => ({ data: null, error: null })
    await expect(createFormTemplate(input)).rejects.toThrow('Could not create the form template')
    expect(storage.remove).toHaveBeenCalledWith([storage.upload.mock.calls[1]![0]])
  })
  it('a schema with no pages still counts one page', async () => {
    route = (_t, steps) => ({ data: { ...(argsOf(steps, 'insert')[0]![0] as object) }, error: null })
    await createFormTemplate({ ...input, schema: emptyFormSchema([]) })
    expect((argsOf(q('contract_form_templates').steps, 'insert')[0]![0] as { page_count: number }).page_count).toBe(1)
  })
})

describe('replaceFormTemplatePdf / saveFormTemplate / deleteFormTemplate', () => {
  it('replace overwrites the PDF at the row’s path and saves the new hash and page count', async () => {
    route = (_t, steps) => ({ data: { ...row(), ...(argsOf(steps, 'update')[0]![0] as object) }, error: null })
    const out = await replaceFormTemplatePdf(row(), new ArrayBuffer(0), 0)
    expect(storage.upload.mock.calls[0]![0]).toBe('t1/template.pdf')
    expect(storage.upload.mock.calls[0]![2]).toEqual({ contentType: 'application/pdf', upsert: true })
    expect(argsOf(q('contract_form_templates').steps, 'update')).toEqual([[{ pdf_sha256: EMPTY_SHA, page_count: 1 }]])
    expect(argsOf(q('contract_form_templates').steps, 'eq')).toEqual([['id', 't1']])
    expect(out.pdf_sha256).toBe(EMPTY_SHA)
    storage.upload.mockResolvedValueOnce({ error: { message: 'denied' } })
    await expect(replaceFormTemplatePdf(row(), new ArrayBuffer(0), 1)).rejects.toThrow('Could not store the PDF: denied')
  })
  it('save patches by id and returns the row; nothing back means the save failed', async () => {
    route = () => ({ data: row({ name: 'W-9 (2026)' }), error: null })
    expect((await saveFormTemplate('t1', { name: 'W-9 (2026)' })).name).toBe('W-9 (2026)')
    expect(argsOf(q('contract_form_templates').steps, 'update')).toEqual([[{ name: 'W-9 (2026)' }]])
    route = () => ({ data: null, error: null })
    await expect(saveFormTemplate('t1', { status: 'retired' })).rejects.toThrow('Could not save the form template')
  })
  it('delete removes the row, then the PDF', async () => {
    await deleteFormTemplate(row())
    expect(q('contract_form_templates').steps.some((s) => s.method === 'delete')).toBe(true)
    expect(argsOf(q('contract_form_templates').steps, 'eq')).toEqual([['id', 't1']])
    expect(storage.remove).toHaveBeenCalledWith(['t1/template.pdf'])
  })
})

describe('storage reads', () => {
  it('signed URL for 10 minutes by default, or a given lifetime; download hands back the bytes; both name their failure', async () => {
    expect(await templatePdfSignedUrl('t1/template.pdf')).toBe('https://signed.test/x')
    expect(storage.createSignedUrl).toHaveBeenCalledWith('t1/template.pdf', 600)
    await templatePdfSignedUrl('t1/template.pdf', 30)
    expect(storage.createSignedUrl).toHaveBeenLastCalledWith('t1/template.pdf', 30)
    storage.createSignedUrl.mockResolvedValueOnce({ data: null, error: { message: 'no such object' } })
    await expect(templatePdfSignedUrl('gone')).rejects.toThrow('no such object')
    storage.createSignedUrl.mockResolvedValueOnce({ data: null, error: null })
    await expect(templatePdfSignedUrl('gone')).rejects.toThrow('Could not open the PDF')

    expect(new Uint8Array(await downloadTemplatePdf('t1/template.pdf'))).toEqual(new Uint8Array([1, 2, 3]))
    storage.download.mockResolvedValueOnce({ data: null, error: { message: 'denied' } })
    await expect(downloadTemplatePdf('x')).rejects.toThrow('denied')
    storage.download.mockResolvedValueOnce({ data: null, error: null })
    await expect(downloadTemplatePdf('x')).rejects.toThrow('Could not download the PDF')
  })
})

describe('publishFormTemplate', () => {
  const entries = [
    { id: 'd1', template_id: 'packet-A', document_name: 'Old', sequence_order: 4, form_template_id: null },
    { id: 'd2', template_id: 'packet-B', document_name: 'Other', sequence_order: 9, form_template_id: 'other-form' },
  ]
  it('marks the template published (stamping published_at once) and creates its Book entry at the end of the chosen packet', async () => {
    route = (table, steps) => (table === 'contract_form_templates' ? { data: { ...row(), ...(argsOf(steps, 'update')[0]![0] as object) }, error: null } : { data: { id: 'd-new' }, error: null })
    const out = await publishFormTemplate({ row: row(), packetTemplateId: 'packet-A', documentName: ' W-9 form ', audience: 'sub', versionDate: '2026-09-01', existingEntries: entries })
    expect(argsOf(q('contract_form_templates').steps, 'update')).toEqual([[{ status: 'published', published_at: '2026-09-07T18:00:00.000Z' }]])
    expect(argsOf(q('contract_template_documents').steps, 'insert')).toEqual([
      [{ template_id: 'packet-A', document_name: 'W-9 form', sequence_order: 5, book_body_html: null, book_body_format: 'plain', tags: ['form'], canonical_document_url: null, audience: 'sub', book_version_date: '2026-09-01', form_template_id: 't1' }],
    ])
    expect(out).toEqual({ template: expect.objectContaining({ status: 'published' }), bookEntryId: 'd-new' })

    queries.length = 0
    await publishFormTemplate({ row: row({ published_at: '2026-08-01T00:00:00Z' }), packetTemplateId: 'packet-C', documentName: 'x', audience: 'sub', versionDate: null, existingEntries: [] })
    expect(argsOf(q('contract_form_templates').steps, 'update')).toEqual([[{ status: 'published', published_at: '2026-08-01T00:00:00Z' }]]) // first publish date kept
    expect((argsOf(q('contract_template_documents').steps, 'insert')[0]![0] as { sequence_order: number }).sequence_order).toBe(0) // empty packet
  })
  it('a form that already has a Book entry keeps it: the entry is moved / renamed in place, sequence untouched', async () => {
    route = (table) => (table === 'contract_form_templates' ? { data: row(), error: null } : { data: null, error: null })
    const mine = { id: 'd-mine', template_id: 'packet-A', document_name: 'Old name', sequence_order: 2, form_template_id: 't1' }
    const out = await publishFormTemplate({ row: row(), packetTemplateId: 'packet-B', documentName: 'New name', audience: 'gc', versionDate: null, existingEntries: [...entries, mine] })
    expect(argsOf(q('contract_template_documents').steps, 'update')).toEqual([[{ template_id: 'packet-B', document_name: 'New name', audience: 'gc', book_version_date: null }]])
    expect(argsOf(q('contract_template_documents').steps, 'eq')).toEqual([['id', 'd-mine']])
    expect(out.bookEntryId).toBe('d-mine')
  })
  it('a Book insert that returns nothing fails loudly', async () => {
    route = (table) => (table === 'contract_form_templates' ? { data: row(), error: null } : { data: null, error: null })
    await expect(publishFormTemplate({ row: row(), packetTemplateId: 'packet-A', documentName: 'x', audience: 'sub', versionDate: null, existingEntries: [] })).rejects.toThrow('Could not create the Book entry')
  })
})
