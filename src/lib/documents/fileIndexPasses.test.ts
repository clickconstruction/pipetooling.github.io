import { afterEach, describe, expect, it, vi } from 'vitest'
import { EMBED_STALE_NOTE, embedPass, embedRow, indexOneFile, ocrPass, ocrPending, retakePass, type IndexContext } from '../../../supabase/functions/_shared/fileIndex'
import { EMBED_DIM, embedEndpoint } from '../../../supabase/functions/_shared/embeddingsKernel'
import { OCR_MIMES, ocrQueueFilter } from '../../../supabase/functions/_shared/ocrKernel'
import { RETRY_HOLD_MS, newPassSpend, type DriveFileMeta } from '../../../supabase/functions/_shared/fileIndexKernel'

/**
 * The file index's passes against a recording database and a scripted Drive, Document AI and Gemini (the 2026-11-04
 * review's four defects, v2.6491): a chunk write fenced on the row's index stamp and a queue that reads the catch-up
 * rule; a text emptied to whitespace keeping no chunks; a scan queued for OCR by its name as the plan would send it;
 * a known scan OCR'd on one download with no parse, and a row held slow taken again. Made-up names: job 1187 Maple
 * Court townhomes.
 */

/** One call on the fake client: the table (or the RPC), the verb, what it wrote, and the filters in PostgREST's spelling. */
interface Call {
  table: string
  op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' | 'rpc'
  payload?: unknown
  filters: string[]
  returning?: string
}

/** The service-role client as the pass types it (the functions' own supabase-js import, so the stand-in is the same type). */
type Admin = IndexContext['admin']

/** A recording stand-in for the service-role client: every builder chain lands as one `Call`, answered by the script. */
function fakeAdmin(answer: (call: Call) => { data?: unknown; error?: { message: string } | null } | undefined) {
  const calls: Call[] = []
  const settle = (call: Call) => {
    calls.push(call)
    const a = answer(call) ?? {}
    return { data: a.data ?? null, error: a.error ?? null }
  }
  const from = (table: string) => {
    const call: Call = { table, op: 'select', filters: [] }
    const b: Record<string, unknown> = {}
    const chain = (f: (...args: never[]) => void) => (...args: unknown[]) => {
      ;(f as (...a: unknown[]) => void)(...args)
      return b
    }
    Object.assign(b, {
      select: chain((cols: string) => {
        if (call.op === 'select') call.payload = cols
        else call.returning = cols
      }),
      insert: chain((p: unknown) => Object.assign(call, { op: 'insert', payload: p })),
      update: chain((p: unknown) => Object.assign(call, { op: 'update', payload: p })),
      upsert: chain((p: unknown) => Object.assign(call, { op: 'upsert', payload: p })),
      delete: chain(() => Object.assign(call, { op: 'delete' })),
      eq: chain((c: string, v: unknown) => call.filters.push(`${c}=eq.${String(v)}`)),
      lt: chain((c: string, v: unknown) => call.filters.push(`${c}=lt.${String(v)}`)),
      lte: chain((c: string, v: unknown) => call.filters.push(`${c}=lte.${String(v)}`)),
      is: chain((c: string, v: unknown) => call.filters.push(`${c}=is.${String(v)}`)),
      not: chain((c: string, op: string, v: unknown) => call.filters.push(`${c}=not.${op}.${String(v)}`)),
      in: chain((c: string, v: unknown[]) => call.filters.push(`${c}=in.(${v.join(',')})`)),
      or: chain((s: string) => call.filters.push(`or=(${s})`)),
      order: chain(() => {}),
      limit: chain(() => {}),
      maybeSingle: chain(() => {}),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(settle(call)).then(resolve, reject),
    })
    return b
  }
  const rpc = (name: string, args: unknown) => {
    const call: Call = { table: name, op: 'rpc', payload: args, filters: [] }
    return { then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(settle(call)).then(resolve, reject) }
  }
  return { client: { from, rpc } as unknown as Admin, calls }
}

const GOOGLE = 'drive-token'
const ROOT = 'root'
const T1 = '2026-11-04T14:00:00.000Z'

function context(admin: Admin, opts: { ocr?: boolean; embed?: boolean } = {}): IndexContext {
  return {
    admin,
    google: GOOGLE,
    rootId: ROOT,
    driveId: 'drive',
    homes: new Map(),
    metaOf: async () => ({ name: '', parent: null }),
    spend: newPassSpend(),
    ocr: opts.ocr ? { processor: 'projects/1/locations/us/processors/p', url: 'https://us-documentai.googleapis.com/v1/projects/1/locations/us/processors/p:process', token: async () => 'cloud-token' } : null,
    embed: opts.embed ? { url: embedEndpoint(), key: 'gemini-key' } : null,
  }
}

const scan = (over: Partial<DriveFileMeta> = {}): DriveFileMeta => ({ id: 'scan1', name: 'Permit 2026-0412.pdf', mimeType: 'application/octet-stream', size: '419840', modifiedTime: '2026-10-14T15:00:00.000Z', parents: [], webViewLink: null, trashed: false, ...over })

/** A scripted fetch: Drive's meta and media, Document AI, Gemini. Every media download is counted. */
function fakeFetch(script: { meta?: DriveFileMeta | null; media?: string; ocrText?: string; vectors?: number }) {
  const hits = { meta: 0, media: 0, ocr: 0, embed: 0 }
  const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    if (url.includes('alt=media')) {
      hits.media += 1
      return new Response(script.media ?? '%PDF-1.4 scan', { status: 200 })
    }
    if (url.startsWith('https://www.googleapis.com/drive/v3/files/')) {
      hits.meta += 1
      return script.meta === null ? new Response('not found', { status: 404 }) : new Response(JSON.stringify(script.meta ?? scan()), { status: 200 })
    }
    if (url.includes('documentai.googleapis.com')) {
      hits.ocr += 1
      return new Response(JSON.stringify({ document: { text: script.ocrText ?? 'PERMIT 2026-0412 City of Boerne', pages: [{ pageNumber: 1 }] } }), { status: 200 })
    }
    if (url.includes('generativelanguage.googleapis.com')) {
      hits.embed += 1
      const n = (JSON.parse(String(init?.body)) as { requests: unknown[] }).requests.length
      return new Response(JSON.stringify({ embeddings: Array.from({ length: n }, () => ({ values: Array.from({ length: EMBED_DIM }, () => 0.01) })) }), { status: 200 })
    }
    throw new Error(`unexpected fetch ${url}`)
  })
  vi.stubGlobal('fetch', fetch)
  return hits
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('embedRow fences every stamp on the row’s index stamp (defect 1)', () => {
  it('stamps embedded_at only while indexed_at is the one whose text it read; gone on, its chunks go and the row is left due', async () => {
    fakeFetch({})
    // The stamp finds no row: a press indexed the file again while Gemini answered.
    const { client, calls } = fakeAdmin((c) => (c.op === 'update' && c.table === 'file_index' && c.filters.includes(`indexed_at=eq.${T1}`) ? { data: [] } : undefined))
    const ctx = context(client, { embed: true })
    const r = await embedRow(ctx, 'f1', 'The GC agreed to the extra rock on the north run.', T1)
    expect(r).toEqual({ ok: false, error: EMBED_STALE_NOTE })
    const stamp = calls.find((c) => c.op === 'update' && c.table === 'file_index' && 'embedded_at' in (c.payload as object) && (c.payload as { embedded_at: unknown }).embedded_at !== null)!
    expect(stamp.filters).toEqual(['drive_file_id=eq.f1', `indexed_at=eq.${T1}`])
    expect(stamp.returning).toBe('drive_file_id')
    const put = calls.find((c) => c.op === 'insert' && c.table === 'file_index_chunks')!
    const own = (put.payload as { embedded_at: string }[])[0]!.embedded_at
    // The chunks this call put in go by its own stamp, so a newer pass's chunks stay; the row is left due.
    const after = calls.slice(calls.indexOf(stamp) + 1)
    expect(after.map((c) => [c.table, c.op, c.filters])).toEqual([
      ['file_index_chunks', 'delete', ['drive_file_id=eq.f1', `embedded_at=eq.${own}`]],
      ['file_index', 'update', ['drive_file_id=eq.f1']],
    ])
    expect(after[1]!.payload).toEqual({ embedded_at: null })
  })

  it('a stamp that lands keeps the chunks, and a refusal’s stamp carries the fence too', async () => {
    fakeFetch({})
    const { client, calls } = fakeAdmin((c) => (c.op === 'update' && c.table === 'file_index' ? { data: [{ drive_file_id: 'f1' }] } : undefined))
    const ctx = context(client, { embed: true })
    expect(await embedRow(ctx, 'f1', 'The GC agreed to the extra rock.', T1)).toEqual({ ok: true, chunks: 1 })
    expect(calls.filter((c) => c.op === 'delete').map((c) => c.filters)).toEqual([['drive_file_id=eq.f1']])
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { status: 'RESOURCE_EXHAUSTED', message: 'quota' } }), { status: 429 })))
    const refused = await embedRow(ctx, 'f1', 'The GC agreed to the extra rock.', T1)
    expect(refused.ok).toBe(false)
    const tried = calls[calls.length - 1]!
    expect(tried.filters).toEqual(['drive_file_id=eq.f1', `indexed_at=eq.${T1}`])
    expect(tried.payload).toMatchObject({ embed_note: expect.stringContaining('RESOURCE_EXHAUSTED') })
  })

  it('embedPass reads its queue through file_index_embed_due, the rule the partial index holds, and hands each row’s stamp on', async () => {
    fakeFetch({})
    const { client, calls } = fakeAdmin((c) => {
      if (c.op === 'rpc') return { data: [{ drive_file_id: 'f1', name: 'Letter.pdf', text: 'The GC agreed.', indexed_at: T1, embedded_at: '2026-11-03T00:00:00Z', embed_tried_at: null }] }
      if (c.op === 'update' && c.table === 'file_index') return { data: [{ drive_file_id: 'f1' }] }
      return undefined
    })
    const out = await embedPass(context(client, { embed: true }), 10)
    expect(out).toMatchObject({ tried: 1, embedded: 1, chunks: 1 })
    expect(calls[0]).toMatchObject({ op: 'rpc', table: 'file_index_embed_due', payload: { max_rows: 30 } })
    expect(calls.find((c) => c.op === 'update')!.filters).toContain(`indexed_at=eq.${T1}`)
    // A queue the database refuses (the function not pushed yet) embeds nothing and never throws.
    const refused = fakeAdmin((c) => (c.op === 'rpc' ? { error: { message: 'Could not find the function' } } : undefined))
    expect(await embedPass(context(refused.client, { embed: true }), 10)).toEqual({ tried: 0, embedded: 0, chunks: 0, refused: [] })
  })
})

describe('a text with no words keeps no chunks (defect 2)', () => {
  it('embedRow’s zero-chunk branch deletes the old chunks before it stamps', async () => {
    fakeFetch({})
    const { client, calls } = fakeAdmin((c) => (c.op === 'update' && c.table === 'file_index' ? { data: [{ drive_file_id: 'f1' }] } : undefined))
    expect(await embedRow(context(client, { embed: true }), 'f1', '  \n\t ', T1)).toEqual({ ok: true, chunks: 0 })
    expect(calls.map((c) => [c.table, c.op])).toEqual([
      ['file_index_chunks', 'delete'],
      ['file_index', 'update'],
    ])
    expect(calls[1]!.payload).toMatchObject({ embedded_at: expect.any(String), embed_note: null })
  })

  it('a re-index that empties a text file to whitespace drops its chunks whether or not meaning is set up', async () => {
    const hits = fakeFetch({ media: '   \n  ' })
    const { client, calls } = fakeAdmin(() => undefined)
    const r = await indexOneFile(context(client), scan({ id: 'notes', name: 'notes.txt', mimeType: 'text/plain', size: '6' }))
    expect(r).toMatchObject({ ok: true, held: null })
    expect(hits.media).toBe(1)
    const row = calls.filter((c) => c.op === 'upsert').pop()!.payload as { text: string | null }
    expect(row.text).toBe('   \n  ')
    expect(calls[calls.length - 1]).toMatchObject({ table: 'file_index_chunks', op: 'delete', filters: ['drive_file_id=eq.notes'] })
  })
})

describe('the OCR queue finds a scan by its name as the plan would (defect 3)', () => {
  it('ocrPending asks for a mime Document AI reads or a name ending in an extension it reads, never the mime alone', async () => {
    fakeFetch({})
    const { client, calls } = fakeAdmin(() => ({ data: [] }))
    await ocrPending(context(client, { ocr: true }), 5, new Date('2026-11-04T15:00:00Z'))
    const q = calls[0]!
    expect(q.payload).toBe('drive_file_id, name, modified_at, indexed_at')
    expect(q.filters).toContain(`or=(${ocrQueueFilter()})`)
    expect(q.filters.some((f) => f.startsWith('mime=in.'))).toBe(false)
    expect(ocrQueueFilter()).toContain(`mime.in.(${OCR_MIMES.join(',')})`)
    expect(ocrQueueFilter()).toContain('name.ilike.*.pdf')
    expect(ocrQueueFilter()).toContain('name.ilike.*.jpeg')
    expect(q.filters).toContain('text_why=eq.scan')
    expect(q.filters).toContain('or=(ocr_tried_at.is.null,ocr_tried_at.lt.2026-11-03T15:00:00.000Z)')
  })
})

describe('a known scan costs one download, and a row held slow is taken again (defect 4)', () => {
  it('ocrPass sends a scan whose file is as its row says straight to the processor: no reading stamp, no parse, one download, the row patched with the text', async () => {
    const hits = fakeFetch({ meta: scan() })
    const { client, calls } = fakeAdmin((c) => {
      if (c.op === 'select' && c.table === 'file_index') return { data: [{ drive_file_id: 'scan1', name: 'Permit 2026-0412.pdf', modified_at: '2026-10-14T15:00:00+00:00', indexed_at: T1 }] }
      if (c.op === 'update' && c.table === 'file_index') return { data: [{ drive_file_id: 'scan1' }] }
      return undefined
    })
    const ctx = context(client, { ocr: true })
    const out = await ocrPass(ctx, 5)
    expect(out).toEqual({ tried: 1, read: 1, refused: [], gone: 0 })
    expect(hits).toEqual({ meta: 1, media: 1, ocr: 1, embed: 0 })
    expect(calls.some((c) => c.op === 'upsert')).toBe(false)
    const patch = calls.find((c) => c.op === 'update' && c.table === 'file_index')!
    expect(patch.filters).toEqual(['drive_file_id=eq.scan1', `indexed_at=eq.${T1}`])
    expect(patch.payload).toMatchObject({ text: 'PERMIT 2026-0412 City of Boerne', text_source: 'ocr', text_why: null, pages: 1, ocr_pages: 1, ocr_note: null, embedded_at: null, indexed_at: expect.any(String) })
    expect((patch.payload as Record<string, unknown>).name).toBeUndefined()
    // Meaning is not set up and the text has words: the chunks are left for the key's return, nothing else is written.
    expect(calls.filter((c) => c.table === 'file_index_chunks')).toEqual([])
  })

  it('a refusal stamps the try and its reason alone; a row a press indexed again meanwhile is left to that pass', async () => {
    fakeFetch({ meta: scan() })
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      if (url.includes('alt=media')) return new Response('%PDF-1.4', { status: 200 })
      if (url.includes('documentai')) return new Response(JSON.stringify({ error: { status: 'INVALID_ARGUMENT', message: 'Unsupported input file format.' } }), { status: 400 })
      return new Response(JSON.stringify(scan()), { status: 200 })
    }))
    const { client, calls } = fakeAdmin((c) => {
      if (c.op === 'select') return { data: [{ drive_file_id: 'scan1', name: 'Permit 2026-0412.pdf', modified_at: '2026-10-14T15:00:00Z', indexed_at: T1 }] }
      if (c.op === 'update') return { data: [{ drive_file_id: 'scan1' }] }
      return undefined
    })
    const out = await ocrPass(context(client, { ocr: true }), 5)
    expect(out).toMatchObject({ tried: 1, read: 0, refused: [{ id: 'scan1', why: 'scan' }] })
    const patch = calls.find((c) => c.op === 'update')!.payload as Record<string, unknown>
    expect(Object.keys(patch).sort()).toEqual(['checked_at', 'ocr_note', 'ocr_tried_at'])
    expect(patch.ocr_note).toContain('INVALID_ARGUMENT')
    // The stamp finds no row: the press that indexed the file again owns it, so nothing is counted here.
    const gone = fakeAdmin((c) => {
      if (c.op === 'select') return { data: [{ drive_file_id: 'scan1', name: 'Permit 2026-0412.pdf', modified_at: '2026-10-14T15:00:00Z', indexed_at: T1 }] }
      if (c.op === 'update') return { data: [] }
      return undefined
    })
    expect(await ocrPass(context(gone.client, { ocr: true }), 5)).toEqual({ tried: 1, read: 0, refused: [], gone: 0 })
  })

  it('a scan whose file changed since its row is read whole, as any changed file is', async () => {
    const hits = fakeFetch({ meta: scan({ modifiedTime: '2026-11-01T09:00:00.000Z' }), media: 'not a pdf' })
    const { client, calls } = fakeAdmin((c) => {
      if (c.op === 'select' && c.payload === 'drive_file_id, name, modified_at, indexed_at') return { data: [{ drive_file_id: 'scan1', name: 'Permit 2026-0412.pdf', modified_at: '2026-10-14T15:00:00Z', indexed_at: T1 }] }
      return undefined
    })
    await ocrPass(context(client, { ocr: true }), 5)
    expect(hits.meta).toBe(1)
    // The whole index: the reading stamp first, then the read (the parse of a made-up PDF fails here, so the row is held error).
    expect(calls.filter((c) => c.op === 'upsert').length).toBe(2)
  })

  it('retakePass takes rows held slow or reading an hour or more ago, oldest first, through the one pass with retry', async () => {
    const now = Date.now()
    const hits = fakeFetch({ meta: scan({ id: 'held', name: 'Scope.txt', mimeType: 'text/plain', size: '40' }), media: 'Rock clause: the GC pays for rock over 2 ft.' })
    const { client, calls } = fakeAdmin((c) => {
      if (c.op === 'select' && c.payload === 'drive_file_id') return { data: [{ drive_file_id: 'held' }] }
      if (c.op === 'select' && c.table === 'file_index') return { data: [{ drive_file_id: 'held', modified_at: '2026-10-14T15:00:00Z', text_why: 'slow', text_source: null, checked_at: new Date(now - 2 * RETRY_HOLD_MS).toISOString(), ocr_tried_at: null }] }
      return undefined
    })
    const out = await retakePass(context(client), 5)
    expect(out).toEqual({ tried: 1, read: 1, held: [] })
    const q = calls[0]!
    // Drive rows alone (#285): a record's held row is the records queue's to take again.
    expect(q.filters[0]).toBe('source=eq.drive')
    expect(q.filters[1]).toBe('text_why=in.(slow,reading)')
    expect(q.filters[2]!.startsWith('checked_at=lt.')).toBe(true)
    expect(Date.parse(q.filters[2]!.slice('checked_at=lt.'.length))).toBeLessThanOrEqual(now - RETRY_HOLD_MS + 1000)
    expect(hits).toEqual({ meta: 1, media: 1, ocr: 0, embed: 0 })
    const row = calls.filter((c) => c.op === 'upsert').pop()!.payload as { text: string; text_why: string | null }
    expect(row).toMatchObject({ text: 'Rock clause: the GC pays for rock over 2 ft.', text_why: null })
    // A file Drive no longer answers for is checked now, so it leaves the head until the recheck drops its row.
    fakeFetch({ meta: null })
    const gone = fakeAdmin((c) => (c.op === 'select' && c.payload === 'drive_file_id' ? { data: [{ drive_file_id: 'lost' }] } : undefined))
    expect(await retakePass(context(gone.client), 5)).toEqual({ tried: 0, read: 0, held: [] })
    expect(gone.calls[1]).toMatchObject({ table: 'file_index', op: 'update', payload: { checked_at: expect.any(String) }, filters: ['drive_file_id=eq.lost'] })
  })
})
