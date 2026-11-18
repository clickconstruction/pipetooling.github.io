/**
 * `keepLegalMatterDocumentAsText`: the stored file is read, its words go into `documents` as a fresh text file's do,
 * the Evidence row is pointed at them, and a second write that does not land archives the words it just made.
 * A made-up paper against a fake client; nothing here reaches a database.
 */
import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { keepLegalMatterDocumentAsText } from './legalMatterDocumentsIo'

type Result = { data: unknown; error: { message: string; code?: string } | null }
type Call = { what: string; [k: string]: unknown }

function fakeDb(answers: { download?: Result; insert?: Result; set?: Result }) {
  const calls: Call[] = []
  const db = {
    storage: {
      from: (bucket: string) => ({
        download: async (path: string) => {
          calls.push({ what: 'download', bucket, path })
          return answers.download ?? { data: new Blob(['Dear Pat,\n\nThank you for the work.\n']), error: null }
        },
      }),
    },
    from: (name: string) => {
      if (name === 'documents') {
        return {
          insert: (values: unknown) => ({ select: () => ({ single: async () => { calls.push({ what: 'documents.insert', values }); return answers.insert ?? { data: { id: 't-new' }, error: null } } }) }),
          update: (values: Record<string, unknown>) => ({ eq: async (_col: string, id: string) => { calls.push({ what: 'documents.archive', id, archived: typeof values.archived_at === 'string' }); return { data: null, error: null } } }),
        }
      }
      return {
        update: (values: unknown) => ({ eq: (_col: string, id: string) => ({ is: (col: string, value: unknown) => ({ select: async () => { calls.push({ what: 'row.update', name, values, id, onlyWhen: [col, value] }); return answers.set ?? { data: [{ id }], error: null } } }) }) }),
      }
    },
  }
  return { db: db as unknown as SupabaseClient<Database>, calls }
}

const row = (over: Partial<Parameters<typeof keepLegalMatterDocumentAsText>[1]> = {}) => ({ id: 'd-1', matter_id: 'm-1', title: ' Thank you letter ', storage_path: 'm-1/d-1-letter.txt', mime: 'text/plain', text_document_id: null, counsel_only: false, ...over })

describe('keepLegalMatterDocumentAsText', () => {
  it('reads the stored file, keeps its words as a fresh text file’s are kept, and points the row at them', async () => {
    const { db, calls } = fakeDb({})
    await expect(keepLegalMatterDocumentAsText(db, row())).resolves.toBe('t-new')
    expect(calls).toEqual([
      { what: 'download', bucket: 'legal-matter-documents', path: 'm-1/d-1-letter.txt' },
      { what: 'documents.insert', values: { matter_id: 'm-1', title: 'Thank you letter', content: 'Dear Pat,\n\nThank you for the work.\n', counsel_only: false } },
      { what: 'row.update', name: 'legal_matter_documents', values: { text_document_id: 't-new' }, id: 'd-1', onlyWhen: ['text_document_id', null] },
    ])
  })

  it('a counsel-only paper’s words are counsel-only too', async () => {
    const { db, calls } = fakeDb({})
    await keepLegalMatterDocumentAsText(db, row({ counsel_only: true }))
    expect(calls[1]).toMatchObject({ what: 'documents.insert', values: { counsel_only: true } })
  })

  it('a row that is not a text file, or already has its words, is refused before anything is read', async () => {
    const pdf = fakeDb({})
    await expect(keepLegalMatterDocumentAsText(pdf.db, row({ mime: 'application/pdf' }))).rejects.toThrow('Only a .md or .txt file has words to keep as text.')
    const kept = fakeDb({})
    await expect(keepLegalMatterDocumentAsText(kept.db, row({ text_document_id: 't-old' }))).rejects.toThrow('The paper’s words are already kept as text.')
    expect(pdf.calls).toEqual([])
    expect(kept.calls).toEqual([])
  })

  it('a stored file that cannot be read, or has no words, writes nothing', async () => {
    const gone = fakeDb({ download: { data: null, error: { message: 'Object not found' } } })
    await expect(keepLegalMatterDocumentAsText(gone.db, row())).rejects.toThrow('Could not read the stored file: Object not found')
    expect(gone.calls.map((c) => c.what)).toEqual(['download'])
    const empty = fakeDb({ download: { data: new Blob(['  \n']), error: null } })
    await expect(keepLegalMatterDocumentAsText(empty.db, row())).rejects.toThrow('The stored file has no words to keep.')
    expect(empty.calls.map((c) => c.what)).toEqual(['download'])
  })

  it('words the database refuses leave the row alone', async () => {
    const { db, calls } = fakeDb({ insert: { data: null, error: { message: 'new row violates row-level security policy' } } })
    await expect(keepLegalMatterDocumentAsText(db, row())).rejects.toThrow('Could not keep the text: new row violates row-level security policy')
    expect(calls.map((c) => c.what)).toEqual(['download', 'documents.insert'])
  })

  it('a row write that fails archives the words it just made, and says why', async () => {
    const { db, calls } = fakeDb({ set: { data: null, error: { message: 'permission denied for table legal_matter_documents', code: '42501' } } })
    await expect(keepLegalMatterDocumentAsText(db, row())).rejects.toThrow(/permission denied for table legal_matter_documents/)
    expect(calls[calls.length - 1]).toEqual({ what: 'documents.archive', id: 't-new', archived: true })
  })

  it('a row that got its words meanwhile keeps them: the second copy is archived', async () => {
    const { db, calls } = fakeDb({ set: { data: [], error: null } })
    await expect(keepLegalMatterDocumentAsText(db, row())).rejects.toThrow('The paper’s words are already kept as text.')
    expect(calls[calls.length - 1]).toEqual({ what: 'documents.archive', id: 't-new', archived: true })
  })
})
