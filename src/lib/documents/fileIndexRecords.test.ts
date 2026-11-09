import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { recordsPass } from '../../../supabase/functions/_shared/fileIndexRecords'
import { EMPTY_RECORDS_PASS, RECORDS_BATCH_MAX, SWEEP_RECORD_ROWS, type RecordDue, recordBytesWhere, recordFileMeta, recordReadingRowOf, recordRowOf, recordsPassWords, recordsWindow } from '../../../supabase/functions/_shared/fileIndexRecordsKernel'
import { DRIVE_SOURCE_COLUMNS, indexRowOf, newPassSpend, textKindOf } from '../../../supabase/functions/_shared/fileIndexKernel'
import { textFromBytes } from '../../../supabase/functions/_shared/fileText'

/**
 * The index's reach to a person's HR file and a matter (punch list #285, PR 1, v2.6714): a record's file becomes a row
 * keyed on its own id with its source, the row it stands for, the person or matter and the counsel-only mark; the pass
 * reads the staged copy from its bucket and a linked file from Drive, inside the budget, and the Drive-only steps leave
 * the new rows alone. Made-up names: Pat Doe, the Maple Court townhomes.
 */

const MIGRATION = readFileSync('supabase/migrations/20261108200000_file_index_reach.sql', 'utf8')
const SWEEP = readFileSync('supabase/functions/file-index-sweep/index.ts', 'utf8')
const PASSES = readFileSync('supabase/functions/_shared/fileIndex.ts', 'utf8')
const RECONCILE = readFileSync('supabase/functions/_shared/fileIndexReconcile.ts', 'utf8')
const FILER = readFileSync('supabase/functions/hr-evidence-drive/index.ts', 'utf8')
const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')

const NOW = new Date('2026-11-08T20:00:00.000Z')
const ATT = 'aaaaaaaa-1111-4222-8333-444444444444'
const DOC = 'bbbbbbbb-1111-4222-8333-444444444444'
const PERSON = '11111111-2222-4333-8444-555555555555'
const MATTER = '99999999-2222-4333-8444-555555555555'

const staged = (over: Partial<RecordDue> = {}): RecordDue => ({
  source: 'hr_attachment', source_id: ATT, person_id: PERSON, matter_id: null, counsel_only: true,
  name: 'Call with Pat 2026-10-03.md', mime: 'text/markdown', bytes: 1200, bucket: 'hr-files', storage_path: `${PERSON}/evidence/r1/${ATT}-call.md`, drive_file_id: null,
  record_kind: 'evidence', record_id: 'r1', record_title: 'Recording of the call', record_day: '2026-10-03',
  path: 'People › Pat Doe › 2026-10-03 · Recording of the call', modified_at: '2026-11-08T19:00:00+00:00', held: false, ...over,
})
const linked = (over: Partial<RecordDue> = {}): RecordDue => staged({ source_id: 'cccccccc-1111-4222-8333-444444444444', storage_path: null, drive_file_id: '1AbCdEfGhIjKlMnOpQrSt', bytes: null, mime: 'application/octet-stream', name: 'Transcript.gdoc', counsel_only: false, ...over })
const document = (over: Partial<RecordDue> = {}): RecordDue => ({
  source: 'matter_document', source_id: DOC, person_id: PERSON, matter_id: MATTER, counsel_only: false,
  name: 'claims matrix.eml', mime: 'message/rfc822', bytes: 900, bucket: 'legal-matter-documents', storage_path: `${MATTER}/${DOC}-claims.eml`, drive_file_id: null,
  record_kind: 'matter_document', record_id: DOC, record_title: 'Claims matrix', record_day: '2026-11-01',
  path: 'Matter › Pat Doe › Evidence', modified_at: '2026-11-07T19:00:00+00:00', held: false, ...over,
})

describe('the records kernel', () => {
  it('where the bytes are: the staged copy, the linked Drive file, or nowhere', () => {
    expect(recordBytesWhere(staged())).toBe('bucket')
    expect(recordBytesWhere(linked())).toBe('drive')
    expect(recordBytesWhere(linked({ drive_file_id: null }))).toBe('none')
  })

  it('the file as the reader sees it, and the row keyed on the record file’s own id with its reach and the read’s columns', () => {
    expect(recordFileMeta(staged())).toMatchObject({ id: ATT, name: 'Call with Pat 2026-10-03.md', mimeType: 'text/markdown', size: '1200', modifiedTime: '2026-11-08T19:00:00+00:00' })
    expect(textKindOf(recordFileMeta(staged()))).toBe('plain')
    expect(textKindOf(recordFileMeta(document()))).toBe('eml')
    const row = recordRowOf(staged(), { text: 'a line of the call', source: 'plain', pages: null }, NOW)
    expect(row).toMatchObject({
      drive_file_id: ATT, source: 'hr_attachment', source_id: ATT, person_id: PERSON, matter_id: null, counsel_only: true,
      jobs_ledger_id: null, bid_id: null, customer_id: null, folder_kind: 'other', path: 'People › Pat Doe › 2026-10-03 · Recording of the call',
      name: 'Call with Pat 2026-10-03.md', mime: 'text/markdown', bytes: 1200, modified_at: '2026-11-08T19:00:00+00:00',
      text: 'a line of the call', text_source: 'plain', text_why: null, indexed_at: NOW.toISOString(), checked_at: NOW.toISOString(), embedded_at: null,
    })
    expect(recordReadingRowOf(document(), NOW)).toMatchObject({ drive_file_id: DOC, source: 'matter_document', matter_id: MATTER, person_id: PERSON, text: null, text_why: 'reading' })
    // What Drive said of a linked file stands over the attachment's blanks.
    expect(recordRowOf(linked(), { why: 'kind' }, NOW, { mime: 'application/vnd.google-apps.document', bytes: null })).toMatchObject({ mime: 'application/vnd.google-apps.document', bytes: null, text_why: 'kind' })
    // Every Drive row says drive and nothing else, so the key check (source = drive) = (source_id is null) holds.
    expect(indexRowOf({ id: '1AbCdEfGhIjKlMnOpQrSt', name: 'x.pdf', mimeType: 'application/pdf' }, { home: null, via: null, names: [], path: '' }, { why: 'scan' }, NOW)).toMatchObject(DRIVE_SOURCE_COLUMNS)
  })

  it('the words of a pass, and the queue window', () => {
    expect(recordsPassWords(EMPTY_RECORDS_PASS)).toBe('')
    expect(recordsPassWords({ ...EMPTY_RECORDS_PASS, dropped: 2 })).toBe('Records: nothing waiting. Dropped 2 whose record is gone.')
    expect(recordsPassWords({ dropped: 0, due: 3, tried: 2, indexed: 2, held: [{ id: 'x', name: 'x', why: 'kind' }], remaining: 1 })).toBe('Records: Indexed 2 files, 1 with their words, 1 held, 1 to go.')
    expect(recordsWindow(SWEEP_RECORD_ROWS)).toBe(50)
    expect(recordsWindow(RECORDS_BATCH_MAX)).toBe(100)
    expect(recordsWindow(200)).toBe(500)
  })
})

describe('textFromBytes (the half past the download)', () => {
  it('a text file as its bytes, an email decoded, a picture a scan, a kind we do not read', async () => {
    const enc = new TextEncoder()
    expect(await textFromBytes(enc.encode('# Call\nPat said the rock was extra.'), { name: 'call.md', mimeType: 'text/markdown' })).toEqual({ text: '# Call\nPat said the rock was extra.', source: 'plain', pages: null })
    const eml = await textFromBytes(enc.encode('From: a@example.test\nSubject: Rock\n\nThe GC agreed.'), { name: 'mail.eml', mimeType: 'message/rfc822' })
    expect(eml).toEqual({ text: 'From: a@example.test\nSubject: Rock\n\nThe GC agreed.', source: 'plain', pages: null })
    expect(await textFromBytes(enc.encode('x'), { name: 'photo.jpg', mimeType: 'image/jpeg' })).toEqual({ why: 'scan' })
    expect(await textFromBytes(enc.encode('x'), { name: 'call.m4a', mimeType: 'audio/mp4' })).toEqual({ why: 'kind' })
  })
})

/** The service-role client as the pass sees it: every chain lands as one call; the storage download is scripted. */
interface Call {
  table: string
  op: 'select' | 'upsert' | 'rpc' | 'download'
  payload?: unknown
  filters: string[]
}
function fakeAdmin(script: { due?: RecordDue[]; dueError?: string; dropped?: number; download?: Record<string, string | { error: string }>; upsertError?: string }) {
  const calls: Call[] = []
  const from = (table: string) => {
    const call: Call = { table, op: 'select', filters: [] }
    const b: Record<string, unknown> = {}
    const chain = (f: (...a: unknown[]) => void) => (...args: unknown[]) => {
      f(...args)
      return b
    }
    Object.assign(b, {
      upsert: chain((p: unknown) => Object.assign(call, { op: 'upsert', payload: p })),
      eq: chain((c, v) => call.filters.push(`${String(c)}=eq.${String(v)}`)),
      then: (resolve: (v: unknown) => unknown) => {
        calls.push(call)
        return Promise.resolve({ data: null, error: call.op === 'upsert' && script.upsertError ? { message: script.upsertError } : null }).then(resolve)
      },
    })
    return b
  }
  const rpc = (name: string, args: unknown) => {
    const call: Call = { table: name, op: 'rpc', payload: args, filters: [] }
    return {
      then: (resolve: (v: unknown) => unknown) => {
        calls.push(call)
        if (name === 'file_index_records_drop_gone') return Promise.resolve({ data: script.dropped ?? 0, error: null }).then(resolve)
        if (script.dueError) return Promise.resolve({ data: null, error: { message: script.dueError } }).then(resolve)
        return Promise.resolve({ data: script.due ?? [], error: null }).then(resolve)
      },
    }
  }
  const storage = {
    from: (bucket: string) => ({
      download: async (path: string) => {
        calls.push({ table: `${bucket}:${path}`, op: 'download', filters: [] })
        const got = script.download?.[path]
        if (got == null) return { data: null, error: { message: 'Object not found' } }
        if (typeof got !== 'string') return { data: null, error: { message: got.error } }
        return { data: new Blob([got]), error: null }
      },
    }),
  }
  return { client: { from, rpc, storage } as unknown as Parameters<typeof recordsPass>[0], calls }
}

afterEach(() => vi.unstubAllGlobals())

describe('recordsPass', () => {
  it('drops the gone rows, reads the queue, stamps reading, reads the staged copy from its bucket and writes the row with its reach', async () => {
    const r = staged()
    const d = document()
    const { client, calls } = fakeAdmin({ due: [r, d], dropped: 1, download: { [r.storage_path!]: 'Pat said the rock was extra, on the call of October 3.', [d.storage_path!]: 'From: counsel@example.test\nSubject: Claims matrix\n\nClaim 4: the rock clause.' } })
    const out = await recordsPass(client, { n: 10, spend: newPassSpend() })
    expect(out).toEqual({ dropped: 1, due: 2, tried: 2, indexed: 2, held: [], remaining: 0 })
    expect(calls.map((c) => [c.table, c.op])).toEqual([
      ['file_index_records_drop_gone', 'rpc'],
      ['file_index_records_due', 'rpc'],
      ['file_index', 'upsert'],
      [`hr-files:${r.storage_path}`, 'download'],
      ['file_index', 'upsert'],
      ['file_index', 'upsert'],
      [`legal-matter-documents:${d.storage_path}`, 'download'],
      ['file_index', 'upsert'],
    ])
    expect(calls[1]!.payload).toEqual({ max_rows: 50, p_person_id: null, p_matter_id: null })
    expect(calls[2]!.payload).toMatchObject({ drive_file_id: ATT, source: 'hr_attachment', text_why: 'reading', counsel_only: true })
    expect(calls[4]!.payload).toMatchObject({ drive_file_id: ATT, source: 'hr_attachment', source_id: ATT, person_id: PERSON, counsel_only: true, text: 'Pat said the rock was extra, on the call of October 3.', text_source: 'plain', text_why: null })
    expect(calls[7]!.payload).toMatchObject({ drive_file_id: DOC, source: 'matter_document', matter_id: MATTER, text: 'From: counsel@example.test\nSubject: Claims matrix\n\nClaim 4: the rock clause.', text_source: 'plain' })
  })

  it('a scope passes to the queue and skips the drop when asked; a download that fails holds the row as error; the take stops at n with the rest remaining', async () => {
    const r = staged()
    const { client, calls } = fakeAdmin({ due: [r, staged({ source_id: DOC }), document()], download: {} })
    const out = await recordsPass(client, { n: 2, personId: PERSON, dropGone: false })
    expect(calls[0]).toMatchObject({ table: 'file_index_records_due', payload: { max_rows: 50, p_person_id: PERSON, p_matter_id: null } })
    expect(out).toMatchObject({ dropped: 0, due: 3, tried: 2, indexed: 2, remaining: 1 })
    expect(out.held).toEqual([{ id: ATT, name: r.name, why: 'error' }, { id: DOC, name: r.name, why: 'error' }])
    expect(calls.filter((c) => c.op === 'upsert').map((c) => (c.payload as { text_why: string | null }).text_why)).toEqual(['reading', 'error', 'reading', 'error'])
  })

  it('a linked file is read from Drive by the id its link names, its kind and size from Drive first; with no Drive it is held error', async () => {
    const l = linked()
    const fetchFn = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      if (url.includes('/export?')) return new Response('Pat: the rock was extra.\nOffice: noted.', { status: 200 })
      if (url.includes('/files/1AbCdEfGhIjKlMnOpQrSt?fields=')) return new Response(JSON.stringify({ id: '1AbCdEfGhIjKlMnOpQrSt', name: 'Transcript of the call', mimeType: 'application/vnd.google-apps.document', modifiedTime: '2026-10-03T15:00:00.000Z', trashed: false }), { status: 200 })
      throw new Error(`unexpected fetch ${url}`)
    })
    vi.stubGlobal('fetch', fetchFn)
    const withDrive = fakeAdmin({ due: [l] })
    const out = await recordsPass(withDrive.client, { n: 5, dropGone: false, google: async () => 'drive-token' })
    expect(out).toMatchObject({ tried: 1, indexed: 1, held: [], remaining: 0 })
    const row = withDrive.calls.filter((c) => c.op === 'upsert').pop()!.payload as Record<string, unknown>
    expect(row).toMatchObject({ drive_file_id: l.source_id, source: 'hr_attachment', mime: 'application/vnd.google-apps.document', name: 'Transcript.gdoc', text: 'Pat: the rock was extra.\nOffice: noted.', text_source: 'export' })
    expect(fetchFn).toHaveBeenCalledTimes(2)

    const noDrive = fakeAdmin({ due: [l] })
    const held = await recordsPass(noDrive.client, { n: 5, dropGone: false })
    expect(held.held).toEqual([{ id: l.source_id, name: l.name, why: 'error' }])
    // A link that names no file is a kind the index does not read, and is never asked for again.
    const folder = fakeAdmin({ due: [linked({ drive_file_id: null })] })
    expect((await recordsPass(folder.client, { n: 5, dropGone: false, google: async () => 'drive-token' })).held).toEqual([{ id: l.source_id, name: l.name, why: 'kind' }])
  })

  it('retry false takes the records with no row alone and leaves a held row to the sweep', async () => {
    const held = staged({ source_id: DOC, held: true })
    const r = staged()
    const { client, calls } = fakeAdmin({ due: [held, r], download: { [r.storage_path!]: 'words' } })
    const out = await recordsPass(client, { n: 5, dropGone: false, retry: false })
    expect(out).toMatchObject({ due: 1, tried: 1, indexed: 1, remaining: 0 })
    expect(calls.filter((c) => c.op === 'upsert').map((c) => (c.payload as { drive_file_id: string }).drive_file_id)).toEqual([ATT, ATT])
  })

  it('a queue the database refuses does nothing this run; a budget already spent takes nothing', async () => {
    const refused = fakeAdmin({ dueError: 'function file_index_records_due does not exist' })
    expect(await recordsPass(refused.client, { n: 5, dropGone: false })).toEqual({ ...EMPTY_RECORDS_PASS, held: [] })
    const spent = fakeAdmin({ due: [staged()] })
    const out = await recordsPass(spent.client, { n: 5, dropGone: false, spend: { ms: 5000, bytes: 0 } })
    expect(out).toMatchObject({ due: 1, tried: 0, remaining: 1 })
    expect(spent.calls.filter((c) => c.op === 'upsert')).toEqual([])
  })
})

describe('the migration, the sweep and the hooks carry the reach', () => {
  it('the migration adds the five columns, the key check, the dev-only and seat policies, the Drive filter on both searches and the embedding queue, and the two queue functions', () => {
    expect(MIGRATION).toMatch(/^SET lock_timeout = '3s';/)
    for (const col of ['source text NOT NULL DEFAULT \'drive\'', 'source_id uuid', 'person_id uuid REFERENCES public.people(id) ON DELETE CASCADE', 'matter_id uuid REFERENCES public.legal_matters(id) ON DELETE CASCADE', 'counsel_only boolean NOT NULL DEFAULT false']) expect(MIGRATION).toContain(`ADD COLUMN IF NOT EXISTS ${col}`)
    expect(MIGRATION).toContain("CHECK (source IN ('drive', 'hr_attachment', 'matter_document'))")
    expect(MIGRATION).toContain("CHECK ((source = 'drive') = (source_id IS NULL))")
    expect(MIGRATION).toContain("AND (source = 'drive' OR (SELECT public.is_dev()))")
    expect(MIGRATION).toContain('AS RESTRICTIVE FOR SELECT TO authenticated USING (NOT (counsel_only AND public.request_is_dev_seat()))')
    expect((MIGRATION.match(/WHERE f\.source = 'drive' AND numnode\(q\.query\) > 0/g) ?? []).length).toBe(2)
    expect(MIGRATION).toContain("JOIN public.file_index f ON f.drive_file_id = u.id AND f.source = 'drive'")
    expect(MIGRATION).toContain("WHERE f.source = 'drive' AND f.text IS NOT NULL AND (f.embedded_at IS NULL OR f.embedded_at < f.indexed_at)")
    expect(MIGRATION).toContain('CREATE OR REPLACE FUNCTION public.file_index_records_due(max_rows integer DEFAULT 40, p_person_id uuid DEFAULT NULL, p_matter_id uuid DEFAULT NULL, retry_after interval DEFAULT \'1 hour\')')
    expect(MIGRATION).toContain('CREATE OR REPLACE FUNCTION public.file_index_records_drop_gone()')
    expect(MIGRATION).toContain("WHERE f.drive_file_id IS NULL\n     OR (f.text_why IN ('slow', 'error', 'reading') AND f.checked_at < now() - retry_after)")
    expect(MIGRATION).toContain('GRANT EXECUTE ON FUNCTION public.file_index_records_due(integer, uuid, uuid, interval) TO service_role;')
    expect(MIGRATION).toContain("'by_reach'")
    expect(MIGRATION).toContain("'records_without_rows'")
    expect(MIGRATION).not.toContain('CREATE TABLE')
  })

  it('the Drive-only steps read Drive rows alone, the sweep runs the records step, and the filer and the seat index after a write', () => {
    expect(SWEEP).toContain(".select('drive_file_id, modified_at').eq('source', 'drive').order('checked_at'")
    expect(SWEEP).toContain('records = await recordsPass(admin, { n: recordsN, google: async () => google, spend: ctx.spend, startedMs: started })')
    expect(SWEEP).toContain('records,\n      stamp: next ?? stamp,')
    expect(PASSES).toContain(".eq('source', 'drive').eq('text_why', 'scan')")
    expect(PASSES).toContain(".eq('source', 'drive').in('text_why', [...RETAKE_WHYS])")
    expect(RECONCILE).toContain(".select('drive_file_id').eq('source', 'drive').order('drive_file_id')")
    expect(FILER).toContain("recordsPass(admin, { n: 20, personId: indexPerson, google, dropGone: false })")
    expect(SERVER).toContain('async function indexRecordsAfterWrite(')
    expect(SERVER).toContain("index: await indexRecordsAfterWrite({ matterId: String(built.target) })")
    expect(SERVER).toContain("await indexRecordsAfterWrite({ personId: String(built.target) })")
  })
})
