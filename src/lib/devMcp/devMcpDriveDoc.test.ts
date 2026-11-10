/**
 * A named document from a Drive file (v2.6712, punch list #286): `plan_person_doc` / `apply_person_doc` take
 * `drive_file_id` (or `drive_url`) in place of the text, and the server reads the file's bytes itself — a .md, a .txt or a
 * Google Doc exported as plain text, under the document limit — so a long document never rides through the agent. The
 * kernel names the source, checks the kind, decodes the bytes, states the facts the plan names and rewrites the call's
 * arguments for the grammar; the server reads Drive, puts the text through `dev_person_doc_write` with the file's id
 * and sha256, and refuses an apply whose bytes moved. Made-up people and files only.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DRIVE_DOC_MAX_BYTES, DRIVE_DOC_MAX_CHARS, driveDocArgs, driveDocChangedWords, driveDocFacts, driveDocKind, driveDocPlanExtra, driveDocReadRefusal, driveDocSource, driveDocText, firstHeading, googleDocIdFromUrl, notTextWords, readDriveDoc, serviceAccountEmail, titleFromFileName, tooBigWords, type DriveDocFacts, type DriveDocMeta } from '../../../supabase/functions/_shared/devMcpDriveDoc'
import { planHash, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const EDGE = readFileSync('docs/EDGE_FUNCTIONS.md', 'utf8')
const HR = readFileSync('docs/HR_FILES.md', 'utf8')
const MIGRATION = readFileSync('supabase/migrations/20261108190000_person_document_source.sql', 'utf8')

const PERSON = 'a1b2c3d4-0000-4000-8000-000000000091'
const DOC = 'd1d2c3d4-0000-4000-8000-000000000012'
const FILE = '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcd'
const SHA = 'ab'.repeat(32)
const meta = (over: Partial<DriveDocMeta> = {}): DriveDocMeta => ({ id: FILE, name: 'Company history.md', mimeType: 'text/markdown', size: '2048', modifiedTime: '2026-11-08T15:00:00.000Z', webViewLink: `https://drive.google.com/file/d/${FILE}/view`, trashed: false, ...over })
const facts = (over: Partial<DriveDocFacts> = {}): DriveDocFacts => ({ drive_file_id: FILE, name: 'Company history.md', mime: 'text/markdown', size_bytes: 2048, sha256: SHA, chars: 1990, lines: 40, first_heading: 'Company history', modified_time: '2026-11-08T15:00:00.000Z', url: `https://drive.google.com/file/d/${FILE}/view`, ...over })

describe('the source a doc names', () => {
  it('reads drive_file_id, a Drive file link or a Google Doc link; null when the doc names none', () => {
    expect(driveDocSource({ person_id: PERSON, title: 'History', drive_file_id: ` ${FILE} ` })).toEqual({ ok: true, fileId: FILE })
    expect(driveDocSource({ person_id: PERSON, title: 'History', drive_url: `https://drive.google.com/file/d/${FILE}/view?usp=drive_link` })).toEqual({ ok: true, fileId: FILE })
    expect(driveDocSource({ person_id: PERSON, title: 'History', drive_url: `https://docs.google.com/document/d/${FILE}/edit` })).toEqual({ ok: true, fileId: FILE })
    expect(driveDocSource({ person_id: PERSON, title: 'History', drive_file_id: FILE, drive_url: `https://drive.google.com/file/d/${FILE}/view` })).toEqual({ ok: true, fileId: FILE })
    expect(driveDocSource({ person_id: PERSON, title: 'History', markdown: 'x' })).toBeNull()
    expect(driveDocSource(null)).toBeNull()
    expect(googleDocIdFromUrl(`https://docs.google.com/document/u/0/d/${FILE}/edit#heading=h.1`)).toBe(FILE)
    expect(googleDocIdFromUrl('https://docs.google.com/spreadsheets/d/abc/edit')).toBeNull()
  })

  it('refuses a link with no id, a bad id, two files, text beside the file, and the summary or narrative', () => {
    expect(driveDocSource({ drive_url: 'https://example.com/x' })).toMatchObject({ ok: false, error: expect.stringContaining('does not carry a Drive file id') })
    expect(driveDocSource({ drive_file_id: 'short' })).toMatchObject({ ok: false, error: expect.stringContaining('not a Drive file id') })
    expect(driveDocSource({ drive_file_id: FILE, drive_url: 'https://drive.google.com/file/d/0ZyXwVuTsRqPoNmLkJiHgFeDcBa9876543210zyxw/view' })).toMatchObject({ ok: false, error: expect.stringContaining('two files') })
    expect(driveDocSource({ drive_file_id: FILE, markdown: '# x' })).toMatchObject({ ok: false, error: expect.stringContaining('without markdown or ops') })
    expect(driveDocSource({ drive_file_id: FILE, ops: [{ op: 'append', markdown: 'x' }] })).toMatchObject({ ok: false })
    expect(driveDocSource({ drive_file_id: FILE, kind: 'summary' })).toMatchObject({ ok: false, error: expect.stringContaining('not the summary') })
  })
})

describe('what the file is to the door', () => {
  it('a .md or .txt by mime or by name reads as its bytes; a Google Doc exports; the rest is refused with the door that takes it', () => {
    expect(driveDocKind(meta())).toEqual({ kind: 'plain' })
    expect(driveDocKind(meta({ name: 'notes.txt', mimeType: 'text/plain' }))).toEqual({ kind: 'plain' })
    expect(driveDocKind(meta({ name: 'notes.TXT', mimeType: 'application/octet-stream' }))).toEqual({ kind: 'plain' })
    expect(driveDocKind(meta({ name: 'Knowledge base', mimeType: 'application/vnd.google-apps.document' }))).toEqual({ kind: 'export' })
    expect(driveDocKind(meta({ name: 'call.pdf', mimeType: 'application/pdf' }))).toMatchObject({ kind: 'refused', error: expect.stringContaining('is a PDF') })
    expect(driveDocKind(meta({ name: 'call.pdf', mimeType: 'application/pdf' }))).toMatchObject({ error: expect.stringContaining('punch list #285') })
    expect(driveDocKind(meta({ name: 'photo.jpg', mimeType: 'image/jpeg' }))).toMatchObject({ kind: 'refused', error: expect.stringContaining('is an image') })
    expect(driveDocKind(meta({ name: 'Hours', mimeType: 'application/vnd.google-apps.spreadsheet' }))).toMatchObject({ kind: 'refused', error: expect.stringContaining('a Google spreadsheet') })
    expect(driveDocKind(meta({ name: 'page.html', mimeType: 'text/html' }))).toMatchObject({ kind: 'refused' })
    expect(driveDocKind(meta({ name: 'People', mimeType: 'application/vnd.google-apps.folder' }))).toMatchObject({ kind: 'refused', error: expect.stringContaining('is a folder') })
    expect(driveDocKind(meta({ trashed: true }))).toMatchObject({ kind: 'refused', error: expect.stringContaining("Drive's trash") })
    expect(notTextWords({ name: 'x.bin', mimeType: 'application/octet-stream' })).toContain('plan_person_evidence')
  })

  it('the bytes become text: UTF-8 only, the BOM off, CRLF folded, words present, under the limit', () => {
    expect(driveDocText(new TextEncoder().encode('﻿# A\r\n\r\nLine.\r\n'), 'a.md')).toEqual({ ok: true, text: '# A\n\nLine.\n' })
    expect(driveDocText(new Uint8Array([0xff, 0xfe, 0x00, 0x41]), 'a.txt')).toMatchObject({ ok: false, error: expect.stringContaining('not UTF-8 text') })
    expect(driveDocText(new TextEncoder().encode('  \n\n'), 'a.txt')).toMatchObject({ ok: false, error: expect.stringContaining('has no words') })
    expect(driveDocText(new TextEncoder().encode('x'.repeat(DRIVE_DOC_MAX_CHARS + 1)), 'a.txt')).toMatchObject({ ok: false, error: expect.stringContaining('at most 1,000,000') })
    expect(DRIVE_DOC_MAX_BYTES).toBe(4 * 1024 * 1024)
    expect(tooBigWords('big.txt', 5 * 1024 * 1024)).toContain('5.0 MB')
  })

  it('the first heading, the facts and the title from the file name', () => {
    expect(firstHeading('intro\n\n## The start ##\n# Not first')).toBe('The start')
    expect(firstHeading('no heading here')).toBeNull()
    expect(driveDocFacts(meta(), { mime: 'text/markdown', bytes: 2048, sha256: SHA }, '# Company history\n\nFounded.')).toEqual(facts({ chars: 27, lines: 3 }))
    expect(driveDocFacts(meta({ webViewLink: null }), { mime: 'text/plain', bytes: 10, sha256: SHA }, 'x').url).toBe(`https://drive.google.com/file/d/${FILE}/view`)
    expect(titleFromFileName('Company history.md')).toBe('Company history')
    expect(titleFromFileName('notes.TXT')).toBe('notes')
    expect(titleFromFileName('Knowledge base')).toBe('Knowledge base')
    expect(titleFromFileName(`${'t'.repeat(200)}.md`)).toHaveLength(160)
  })
})

describe('the arguments the grammar takes', () => {
  it('drops the Drive keys, puts the text in as markdown with the source, and titles a new document from the file when no target is named', () => {
    const text = '# Company history\n\nFounded.'
    const out = driveDocArgs({ doc: { person_id: PERSON, drive_file_id: FILE, counsel_only: true } }, facts(), text)
    expect(out).toEqual({ doc: { person_id: PERSON, counsel_only: true, title: 'Company history', markdown: text, source_drive_file_id: FILE, source_sha256: SHA } })
    expect(driveDocArgs({ doc: { person_id: PERSON, doc_id: DOC, drive_url: 'https://drive.google.com/file/d/x/view' } }, facts(), text).doc).toEqual({ person_id: PERSON, doc_id: DOC, markdown: text, source_drive_file_id: FILE, source_sha256: SHA })
    expect(driveDocArgs({ doc: { person_id: PERSON, title: 'My title', drive_file_id: FILE }, plan_hash: 'h' }, facts(), text)).toMatchObject({ plan_hash: 'h', doc: { title: 'My title' } })
  })

  it('the grammar POSTs the source with the text on a named document, and refuses it half, on the fixed two, with ops, or with a bad sha', () => {
    const text = '# Company history\n\nFounded.'
    const built = writeRpcBody('plan_person_doc', driveDocArgs({ doc: { person_id: PERSON, drive_file_id: FILE } }, facts(), text))
    expect(built).toMatchObject({ ok: true, target: PERSON, body: { p: { person_id: PERSON, title: 'Company history', markdown: text, source_drive_file_id: FILE, source_sha256: SHA }, p_dry_run: true } })
    expect(writeRpcBody('apply_person_doc', { ...driveDocArgs({ doc: { person_id: PERSON, doc_id: DOC, drive_file_id: FILE } }, facts(), text), plan_hash: 'c'.repeat(64) })).toMatchObject({ ok: true, target: DOC, body: { p: { doc_id: DOC, source_drive_file_id: FILE, source_sha256: SHA }, p_dry_run: false } })
    expect(writeRpcBody('plan_person_doc', { doc: { person_id: PERSON, title: 'T', markdown: 'x', source_drive_file_id: FILE } })).toMatchObject({ ok: false, error: expect.stringContaining('come together') })
    expect(writeRpcBody('plan_person_doc', { doc: { person_id: PERSON, kind: 'summary', markdown: 'x', source_drive_file_id: FILE, source_sha256: SHA } })).toMatchObject({ ok: false, error: expect.stringContaining("a named document's") })
    expect(writeRpcBody('plan_person_doc', { doc: { person_id: PERSON, doc_id: DOC, ops: [{ op: 'append', markdown: 'x' }], source_drive_file_id: FILE, source_sha256: SHA } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_person_doc', { doc: { person_id: PERSON, title: 'T', markdown: 'x', source_drive_file_id: FILE, source_sha256: 'nope' } })).toMatchObject({ ok: false })
    expect(writeRpcBody('plan_person_doc', { doc: { person_id: PERSON, title: 'T', markdown: 'x' } })).toMatchObject({ ok: true, body: { p: { person_id: PERSON, title: 'T', markdown: 'x' } } })
  })

  it('the plan hash commits to the text, so the same file read as other bytes hashes another way', async () => {
    const reply = { dry_run: true, person: { id: PERSON }, before: { exists: false, updated_at: null }, after: { chars: 27 } }
    const a = writeRpcBody('plan_person_doc', driveDocArgs({ doc: { person_id: PERSON, title: 'T', drive_file_id: FILE } }, facts(), '# A\n\nOne.'))
    const b = writeRpcBody('plan_person_doc', driveDocArgs({ doc: { person_id: PERSON, title: 'T', drive_file_id: FILE } }, facts({ sha256: 'cd'.repeat(32) }), '# A\n\nTwo.'))
    if (!a.ok || !b.ok) throw new Error('built')
    expect(await planHash('plan_person_doc', a.body.p, reply)).not.toBe(await planHash('plan_person_doc', b.body.p, reply))
    expect(await planHash('plan_person_doc', a.body.p, reply)).toBe(await planHash('apply_person_doc', a.body.p, reply))
  })
})

describe('the words', () => {
  it('the plan names the file, its size, its sha and its first heading; the mismatch names the bytes read now; Drive refusals name the fix', () => {
    const extra = driveDocPlanExtra(facts())
    expect(extra.source).toEqual(facts())
    expect(extra.reads).toContain('Company history.md (text/markdown, 2 KB, 1,990 characters, first heading "Company history", sha256 abababababab…)')
    expect(driveDocPlanExtra(facts({ first_heading: null })).reads).toContain('no heading')
    const changed = driveDocChangedWords(facts(), 'Nothing written: the plan you quoted (x…) is not what this dry run gives now (y…).')
    expect(changed).toContain('Nothing written')
    expect(changed).toContain(`sha256 ${SHA} (modified 2026-11-08T15:00:00.000Z)`)
    expect(changed).toContain('the file changed in Drive since')
    expect(driveDocReadRefusal(404, FILE, 'intake@example.iam.gserviceaccount.com', '')).toContain('share the file (or its folder) with it as a viewer')
    expect(driveDocReadRefusal(404, FILE, 'intake@example.iam.gserviceaccount.com', '')).toContain('intake@example.iam.gserviceaccount.com')
    expect(driveDocReadRefusal(403, FILE, null, 'The user does not have sufficient permissions')).toContain('the client_email in GOOGLE_SERVICE_ACCOUNT_JSON')
    expect(driveDocReadRefusal(500, FILE, null, '')).toContain('Try again in a minute')
    expect(serviceAccountEmail('{"client_email":"intake@example.iam.gserviceaccount.com"}')).toBe('intake@example.iam.gserviceaccount.com')
    expect(serviceAccountEmail('not json')).toBeNull()
  })
})

describe('the read through Drive, with a stand-in for fetch', () => {
  const calls: string[] = []
  const stand = (answers: Record<string, () => Response>): typeof fetch => (async (input: string | URL | Request) => {
    const url = String(input)
    calls.push(url)
    const key = Object.keys(answers).find((k) => url.includes(k))
    const answer = key === undefined ? undefined : answers[key]
    if (!answer) throw new Error(`no answer for ${url}`)
    return answer()
  }) as typeof fetch
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

  it('reads the metadata, then the bytes with alt=media for a text file, and states the facts', async () => {
    calls.length = 0
    const text = '# Company history\n\nFounded in 1998.\n'
    const read = await readDriveDoc('tok', FILE, null, stand({ 'alt=media': () => new Response(text), 'fields=': () => json(meta()) }))
    expect(read.ok).toBe(true)
    if (!read.ok) return
    expect(read.text).toBe(text)
    expect(read.facts).toMatchObject({ drive_file_id: FILE, name: 'Company history.md', mime: 'text/markdown', size_bytes: text.length, chars: text.length, lines: 4, first_heading: 'Company history' })
    expect(read.facts.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(calls[0]).toContain(`/files/${FILE}?fields=id,name,mimeType,size,modifiedTime,webViewLink,trashed&supportsAllDrives=true`)
    expect(calls[1]).toContain(`/files/${FILE}?alt=media&supportsAllDrives=true`)
  })

  it('exports a Google Doc as plain text, and says so when Drive will not export it', async () => {
    const doc = meta({ name: 'Knowledge base', mimeType: 'application/vnd.google-apps.document', size: null })
    const read = await readDriveDoc('tok', FILE, null, stand({ '/export?mimeType=text/plain': () => new Response('Knowledge base\n\nHow we bid.'), 'fields=': () => json(doc) }))
    expect(read).toMatchObject({ ok: true, facts: { mime: 'text/plain', first_heading: null, chars: 27 } })
    const big = await readDriveDoc('tok', FILE, null, stand({ '/export?': () => json({ error: { message: 'This file is too large to be exported.', errors: [{ reason: 'exportSizeLimitExceeded' }] } }, 403), 'fields=': () => json(doc) }))
    expect(big).toMatchObject({ ok: false, error: expect.stringContaining('too big for Drive to export') })
  })

  it('refuses a file the account cannot see, a kind with no text, a file over the cap and bytes that are not text', async () => {
    expect(await readDriveDoc('tok', FILE, 'intake@example.iam.gserviceaccount.com', stand({ 'fields=': () => json({ error: { message: 'File not found' } }, 404) }))).toMatchObject({ ok: false, error: expect.stringContaining('Drive has no file') })
    expect(await readDriveDoc('tok', FILE, null, stand({ 'fields=': () => json(meta({ name: 'call.pdf', mimeType: 'application/pdf' })) }))).toMatchObject({ ok: false, error: expect.stringContaining('is a PDF') })
    expect(await readDriveDoc('tok', FILE, null, stand({ 'fields=': () => json(meta({ size: String(DRIVE_DOC_MAX_BYTES + 1) })) }))).toMatchObject({ ok: false, error: expect.stringContaining('at most 4 MB') })
    expect(await readDriveDoc('tok', FILE, null, stand({ 'alt=media': () => new Response(new Uint8Array([0xff, 0xfe, 0x41])), 'fields=': () => json(meta({ name: 'odd.txt', mimeType: 'text/plain', size: '3' })) }))).toMatchObject({ ok: false, error: expect.stringContaining('not UTF-8 text') })
    expect(await readDriveDoc('tok', FILE, null, stand({ 'alt=media': () => new Response('x', { status: 403 }), 'fields=': () => json(meta()) }))).toMatchObject({ ok: false, error: expect.stringContaining('Drive refused the read') })
  })
})

describe('the migration, the server and the docs', () => {
  it('the migration adds the two columns, puts them on the index view, and the function carries them on a named document with the text', () => {
    expect(MIGRATION).toMatch(/^SET lock_timeout = '3s';/)
    expect(MIGRATION).toContain('ALTER TABLE public.person_documents ADD COLUMN IF NOT EXISTS source_drive_file_id text;')
    expect(MIGRATION).toContain('ALTER TABLE public.person_documents ADD COLUMN IF NOT EXISTS source_sha256 text;')
    expect(MIGRATION).toContain('CREATE OR REPLACE VIEW public.person_document_index\nWITH (security_invoker = true) AS')
    // CREATE OR REPLACE VIEW can drop no column: the headings column 20261107060000 added stays, the two new ones after it.
    expect(MIGRATION).toContain('public.hr_doc_heading_index(d.content) AS headings,\n         d.source_drive_file_id, d.source_sha256\n    FROM public.person_documents d;')
    expect(MIGRATION).toContain('CREATE OR REPLACE FUNCTION public.dev_person_doc_write(p jsonb, p_dry_run boolean DEFAULT true)')
    expect(MIGRATION).toContain("IF (v_source_id IS NULL) <> (v_source_sha IS NULL) THEN")
    expect(MIGRATION).toContain("a Drive source is for a named document; the % is written from the entries")
    expect(MIGRATION).toContain("a Drive source comes with markdown, the file''s whole text")
    expect(MIGRATION).toContain("IF v_source_sha !~ '^[0-9a-f]{64}$' THEN")
    // Kept through a flag-only change, cleared by a text change that names no file.
    expect(MIGRATION).toContain("WHEN v_named AND v_exists AND NOT v_has_text AND v_doc.source_drive_file_id IS NOT NULL THEN")
    expect(MIGRATION).toContain("             source_drive_file_id = v_source->>'drive_file_id',\n             source_sha256 = v_source->>'sha256',")
    expect(MIGRATION).toContain("INSERT INTO public.person_documents (person_id, title, content, counsel_only, source_drive_file_id, source_sha256, author_label, created_by, updated_by, created_at, updated_at)")
    expect(MIGRATION).toContain("'source', v_source,")
    expect(MIGRATION).toContain("'document', jsonb_build_object('id', v_doc.id, 'title', v_title, 'source', v_source),")
    // Everything 20261107040000 held, still held.
    expect(MIGRATION).toContain('IF auth.uid() IS NULL OR NOT public.is_dev() THEN')
    expect(MIGRATION).toContain('IF abs(extract(epoch FROM (v_updated_at - v_expect))) > 0.001 THEN')
    expect(MIGRATION).toContain('REVOKE EXECUTE ON FUNCTION public.dev_person_doc_write(jsonb, boolean) FROM PUBLIC, anon;')
    expect(MIGRATION).not.toContain('CREATE TABLE')
  })

  it('the server reads the file as the dev before the grammar, names the source on the plan and the apply, says what changed, and is 0.48.0', () => {
    expect(SERVER).toContain("const SERVER_VERSION = '0.58.0'")
    expect(SERVER).toContain("import { driveDocArgs, driveDocChangedWords, driveDocPlanExtra, driveDocSource, readDriveDoc, serviceAccountEmail, type DriveDocFacts } from '../_shared/devMcpDriveDoc.ts'")
    expect(SERVER).toContain("if (name === 'plan_person_doc' || name === 'apply_person_doc') {\n        const doc = args.doc")
    expect(SERVER).toContain("token = await googleAccessToken(saJson, Deno.env.get('DRIVE_IMPERSONATE_USER') || undefined)")
    expect(SERVER).toContain('const read = await readDriveDoc(token, source.fileId, serviceAccountEmail(saJson), fetch)')
    expect(SERVER).toContain('driveDoc ? driveDoc.args : args)')
    expect(SERVER).toContain('return ok(driveDoc ? { ...planned, ...driveDocPlanExtra(driveDoc.facts) } : planned, { target: built.target })')
    expect(SERVER).toContain('return refused(driveDoc ? driveDocChangedWords(driveDoc.facts, mismatch) : mismatch, { target: built.target })')
    expect(SERVER).toContain("reply = { ...(reply as Record<string, unknown>), source: driveDoc.facts }")
    expect(SERVER).toContain('send drive_file_id (or drive_url) in place of the text')
    expect(SERVER).toContain('or copied from a .md, .txt or Google Doc in Drive by drive_file_id with the bytes read on the server')
  })

  it('the docs carry the door', () => {
    expect(README).toContain('`drive_file_id` (or `drive_url`)')
    expect(README).toContain('source_drive_file_id')
    expect(EDGE).toContain('v2.6712 (server 0.41.0) — a named document from a Drive file')
    expect(EDGE).toContain('20261108190000')
    expect(HR).toContain('`drive_file_id`')
  })
})
