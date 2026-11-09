/**
 * A file off a mail (server 0.29.0): `read_mail_file` hands one file on a search_mail hit back; `plan_mail_file` →
 * `apply_mail_file` files it where it belongs — a job's Drive folder through drive-link's put as the dev, a person's HR
 * file through the evidence verbs, a matter's Evidence tab through the document verbs — the bytes read on the server.
 * The kernel picks the file by name, shapes the inner verb's arguments and the job landing's commitment; the server
 * declares the verbs, keeps view_as off the writes and asks the log before a second apply. Made-up people only.
 * Server 0.51.0 (v2.6806): `read_mail_file` reads in pieces that fit the door's reply, with the argument that reads on.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { EmailFile } from '../../../supabase/functions/_shared/gcKernels/lib/emailIn/gmailMessage'
import type { MailAccount } from '../../../supabase/functions/_shared/devMcpMailSearch'
import { REPLY_MAX_CHARS, replyText } from '../../../supabase/functions/_shared/devMcpDoor'
import { MAIL_FILE_MAX_BYTES, MAIL_FILE_SLICE_MAX_BYTES, bytesToBase64, innerVerbFor, jobApplyReply, jobCommitment, jobPlanReply, mailFileAppliedWords, mailFileArgs, mailFileChangedWords, mailFileReadArgs, mailFileReadNextWords, mailFileReadReply, mailFileWhole, pickMailFile, type MailFileArgs, type MailFileBytes, type MailFileRaw } from '../../../supabase/functions/_shared/devMcpMailFile'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const EDGE = readFileSync('docs/EDGE_FUNCTIONS.md', 'utf8')
const SKILL = readFileSync('.claude/skills/mail-search/SKILL.md', 'utf8')

const KNOWN: MailAccount[] = [{ email: 'dana@example-plumbing.test', name: 'Dana Okafor', archived: false }]
const JOB = '11111111-1111-4111-8111-111111111111'
const PERSON = '22222222-2222-4222-8222-222222222222'
const MATTER = '33333333-3333-4333-8333-333333333333'
const base = { account: 'Dana@example-plumbing.test', id: '18f3a2b9c0d1e2f3', name: 'invoice 4471.pdf' }

const file = (over: Partial<EmailFile>): EmailFile => ({ partId: '2', name: 'invoice 4471.pdf', mime: 'application/pdf', size: 1200, attachmentId: 'a1', data: null, inline: false, ...over })
const bytes: MailFileBytes = { name: 'invoice 4471.pdf', mime: 'application/pdf', size_bytes: 1200, sha256: 'ab'.repeat(32), content_base64: 'JVBERi0=' }

describe('a file off a mail · the arguments', () => {
  it('read_mail_file takes a login, a Gmail id and the file’s name', () => {
    const r = mailFileReadArgs(base, KNOWN)
    expect(r.ok && [r.account.email, r.id, r.name]).toEqual(['dana@example-plumbing.test', '18f3a2b9c0d1e2f3', 'invoice 4471.pdf'])
    expect(r.ok && [r.offset, r.length]).toEqual([0, null])
    expect(mailFileReadArgs({ ...base, name: '' }, KNOWN)).toEqual({ ok: false, error: expect.stringContaining('read_mail_file needs account') })
    expect(mailFileReadArgs({ ...base, account: 'x@gmail.com' }, KNOWN)).toEqual({ ok: false, error: expect.stringContaining('not a login of the Workspace') })
    expect(mailFileReadArgs({ ...base, id: 'm?x' }, KNOWN)).toEqual({ ok: false, error: expect.stringContaining('not a Gmail message id') })
  })

  it('plan_mail_file takes the three places and refuses any other', () => {
    const job = mailFileArgs({ file: { ...base, to: { kind: 'job', jobs_ledger_id: JOB } } }, KNOWN)
    expect(job.ok && job.value.to).toEqual({ kind: 'job', job: { jobs_ledger_id: JOB }, where: 'top' })
    expect(job.ok && job.value.target).toBe(`job ${JOB}`)
    const sent = mailFileArgs({ file: { ...base, to: { kind: 'job', bid_id: JOB, where: 'sent' } } }, KNOWN)
    expect(sent.ok && sent.value.to).toEqual({ kind: 'job', job: { bid_id: JOB }, where: 'sent' })
    expect(mailFileArgs({ file: { ...base, to: { kind: 'job', jobs_ledger_id: JOB, where: 'attic' } } }, KNOWN)).toEqual({ ok: false, error: expect.stringContaining('to.where is one of top | plans | pictures | sent | photos') })
    expect(mailFileArgs({ file: { ...base, to: { kind: 'job', job: '912' } } }, KNOWN)).toEqual({ ok: false, error: expect.stringContaining('jobs_ledger_id') })
    const ev = mailFileArgs({ file: { ...base, to: { kind: 'person_evidence', person_id: PERSON, dated_on: '2026-08-03', title: 'The bill', memo: 'What it shows.', counsel_only: true } } }, KNOWN)
    expect(ev.ok && ev.value.to).toEqual({ kind: 'person_evidence', evidence: { person_id: PERSON, dated_on: '2026-08-03', title: 'The bill', memo: 'What it shows.', counsel_only: true } })
    expect(ev.ok && ev.value.target).toBe(`person ${PERSON}`)
    expect(mailFileArgs({ file: { ...base, to: { kind: 'person_evidence', title: 'x' } } }, KNOWN)).toEqual({ ok: false, error: expect.stringContaining('needs person_id') })
    const doc = mailFileArgs({ file: { ...base, to: { kind: 'matter_document', matter_id: MATTER, title: 'The bill', shows: 'The charge.' } } }, KNOWN)
    expect(doc.ok && doc.value.to).toEqual({ kind: 'matter_document', document: { matter_id: MATTER, title: 'The bill', shows: 'The charge.' } })
    expect(mailFileArgs({ file: { ...base, to: { kind: 'customer' } } }, KNOWN)).toEqual({ ok: false, error: expect.stringContaining('file.to.kind is job') })
    expect(mailFileArgs({}, KNOWN)).toEqual({ ok: false, error: expect.stringContaining('plan_mail_file needs file') })
    expect(mailFileArgs({ file: { ...base, account: 'x@gmail.com', to: { kind: 'job', jobs_ledger_id: JOB } } }, KNOWN)).toEqual({ ok: false, error: expect.stringContaining('not a login of the Workspace') })
  })
})

describe('a file off a mail · the file and the inner verbs', () => {
  it('picks the file by its name, exact then by its start, never a picture placed in the body', () => {
    const files = [file({}), file({ partId: '3', name: 'Lot 12 photo.jpg', mime: 'image/jpeg' }), file({ partId: '4', name: 'logo.png', inline: true })]
    expect(pickMailFile(files, 'INVOICE 4471.PDF')).toEqual({ ok: true, file: files[0] })
    expect(pickMailFile(files, 'lot 12')).toEqual({ ok: true, file: files[1] })
    expect(pickMailFile(files, 'logo.png')).toEqual({ ok: false, error: expect.stringContaining('No file named "logo.png"') })
    expect(pickMailFile(files, 'x.pdf')).toEqual({ ok: false, error: 'No file named "x.pdf" on that mail. Its files: "invoice 4471.pdf", "Lot 12 photo.jpg".' })
    expect(pickMailFile([file({ partId: '5' }), file({ partId: '6' })], 'invoice 4471.pdf')).toEqual({ ok: false, error: expect.stringContaining('2 files on that mail are named') })
    expect(pickMailFile([], 'x')).toEqual({ ok: false, error: expect.stringContaining('carries no file') })
  })

  it('base64 round-trips, in pieces', () => {
    const big = new Uint8Array(70_000).map((_, i) => i % 251)
    const back = Uint8Array.from(atob(bytesToBase64(big)), (c) => c.charCodeAt(0))
    expect(back).toEqual(big)
    expect(MAIL_FILE_MAX_BYTES).toBe(10 * 1024 * 1024)
    const raw: MailFileRaw = { name: 'invoice 4471.pdf', mime: 'application/pdf', sha256: 'ab'.repeat(32), bytes: Uint8Array.from(atob('JVBERi0='), (c) => c.charCodeAt(0)) }
    expect(mailFileWhole(raw)).toEqual({ ...bytes, size_bytes: 5 })
  })

  it('shapes the evidence and document verbs’ arguments with the file as their one file', () => {
    const ev = innerVerbFor('plan', { kind: 'person_evidence', evidence: { person_id: PERSON, dated_on: '2026-08-03', title: 'The bill', memo: 'm' } }, bytes, null)
    expect(ev).toEqual({ verb: 'plan_person_evidence', args: { evidence: { person_id: PERSON, dated_on: '2026-08-03', title: 'The bill', memo: 'm', files: [{ name: 'invoice 4471.pdf', content_base64: 'JVBERi0=', mime: 'application/pdf' }] } } })
    const evApply = innerVerbFor('apply', { kind: 'person_evidence', evidence: { person_id: PERSON } }, bytes, 'h1')
    expect(evApply.verb).toBe('apply_person_evidence')
    expect(evApply.args.plan_hash).toBe('h1')
    const doc = innerVerbFor('apply', { kind: 'matter_document', document: { matter_id: MATTER, title: 't', shows: 's' } }, bytes, 'h2')
    expect(doc).toEqual({ verb: 'apply_matter_document', args: { document: { matter_id: MATTER, title: 't', shows: 's', original_name: 'invoice 4471.pdf', content_base64: 'JVBERi0=', mime: 'application/pdf' }, plan_hash: 'h2' } })
  })

  it('a job landing commits to the job, the landing and the bytes, and says where it lands', () => {
    const args: MailFileArgs = { account: KNOWN[0]!, id: 'm1', name: 'invoice 4471.pdf', to: { kind: 'job', job: { jobs_ledger_id: JOB }, where: 'top' }, target: `job ${JOB}` }
    const c = jobCommitment(args, '912 Limitless Renovations', bytes)
    expect(c).toEqual({ job: { jobs_ledger_id: JOB }, job_label: '912 Limitless Renovations', where: 'top', file: { name: 'invoice 4471.pdf', mime: 'application/pdf', size_bytes: 1200, sha256: 'ab'.repeat(32) }, from: { account: 'dana@example-plumbing.test', id: 'm1' } })
    expect(JSON.stringify(c)).not.toContain('JVBERi0=')
    const plan = jobPlanReply(c, 'abcdef0123456789')
    expect(plan.plan_hash).toBe('abcdef0123456789')
    expect(plan.lands).toBe("invoice 4471.pdf (application/pdf, 1 KB) into the job's folder itself of 912 Limitless Renovations.")
    expect(String(plan.next)).toContain('apply_mail_file')
    expect(jobApplyReply(c, { driveFileId: 'd1', url: 'https://drive.google.com/file/d/d1/view' }).filed).toBe("invoice 4471.pdf is in the job's folder itself of 912 Limitless Renovations.")
    expect(mailFileChangedWords('invoice 4471.pdf')).toContain('nothing was written')
    expect(mailFileAppliedWords({ target: `job ${JOB}`, at: '2026-11-06T00:00:00Z' })).toContain('applied already at 2026-11-06T00:00:00Z')
  })
})

describe('a file off a mail · read in pieces', () => {
  const raw = (size: number, name = 'statement 0912.pdf'): MailFileRaw => ({ name, mime: 'application/pdf', sha256: 'cd'.repeat(32), bytes: new Uint8Array(size).map((_, i) => (i * 7 + 3) % 256) })
  const unbase64 = (b64: unknown) => Uint8Array.from(atob(String(b64)), (c) => c.charCodeAt(0))
  const read = (file: MailFileRaw, offset = 0, length: number | null = null) => {
    const r = mailFileReadReply('dana@example-plumbing.test', 'm1', file, { offset, length })
    if (!r.ok) throw new Error(r.error)
    return r.reply
  }

  it('takes offset and length as whole numbers, and refuses anything else in words', () => {
    const r = mailFileReadArgs({ ...base, offset: 54_000, length: '9000' }, KNOWN)
    expect(r.ok && [r.offset, r.length]).toEqual([54_000, 9000])
    for (const offset of [-1, 1.5, 'ten', true]) expect(mailFileReadArgs({ ...base, offset }, KNOWN)).toEqual({ ok: false, error: expect.stringContaining('offset is the byte to start at') })
    for (const length of [0, -5, 2.5, 'all']) expect(mailFileReadArgs({ ...base, length }, KNOWN)).toEqual({ ok: false, error: expect.stringContaining(`a reply carries at most ${MAIL_FILE_SLICE_MAX_BYTES}`) })
    expect(mailFileReadArgs({ ...base, offset: null, length: null }, KNOWN)).toMatchObject({ ok: true, offset: 0, length: null })
  })

  it('a file that fits comes whole in one reply, with nothing to read on', () => {
    const file = raw(MAIL_FILE_SLICE_MAX_BYTES)
    const reply = read(file)
    expect(reply).toMatchObject({ account: 'dana@example-plumbing.test', id: 'm1', name: 'statement 0912.pdf', mime: 'application/pdf', size_bytes: MAIL_FILE_SLICE_MAX_BYTES, sha256: 'cd'.repeat(32), offset: 0, length: MAIL_FILE_SLICE_MAX_BYTES, next_offset: null })
    expect(reply.read_next).toBeUndefined()
    expect(unbase64(reply.content_base64)).toEqual(file.bytes)
    expect(replyText(reply).length).toBeLessThanOrEqual(REPLY_MAX_CHARS)
  })

  it('a larger file says it is not whole, names the argument that reads on, and the door cuts none of it', () => {
    const file = raw(180_000)
    const first = read(file)
    expect(first).toMatchObject({ size_bytes: 180_000, offset: 0, length: 54_000, next_offset: 54_000 })
    expect(first.read_next).toBe(
      'This is bytes 0 to 53,999 of 180,000, not the whole file: a reply is cut at 80,000 characters, so a file comes in pieces of at most 54,000 bytes. Call read_mail_file again with the same account, id and name and offset: 54000, and on until next_offset is null (3 more calls at this length). Decode each piece and join the bytes in order; sha256 is of the whole file, so check the joined bytes against it.',
    )
    // The words stand before the bytes, and the reply is whole JSON as the door writes it.
    expect(Object.keys(first).indexOf('read_next')).toBeLessThan(Object.keys(first).indexOf('content_base64'))
    const text = replyText(first)
    expect(text.length).toBeLessThanOrEqual(REPLY_MAX_CHARS)
    expect(text).not.toContain('… cut at')
    expect(JSON.parse(text).content_base64).toBe(first.content_base64)
  })

  it('the pieces, read by next_offset, are the file: as bytes, and as base64 text at the default length', () => {
    const file = raw(180_000)
    const pieces: Record<string, unknown>[] = []
    for (let offset: number | null = 0; offset !== null; offset = pieces[pieces.length - 1]!.next_offset as number | null) pieces.push(read(file, offset))
    expect(pieces.map((p) => [p.offset, p.length, p.next_offset])).toEqual([[0, 54_000, 54_000], [54_000, 54_000, 108_000], [108_000, 54_000, 162_000], [162_000, 18_000, null]])
    const joined = new Uint8Array(pieces.flatMap((p) => [...unbase64(p.content_base64)]))
    expect(joined).toEqual(file.bytes)
    expect(pieces.map((p) => p.content_base64).join('')).toBe(bytesToBase64(file.bytes))
    for (const p of pieces) expect(p.sha256).toBe('cd'.repeat(32))
    expect(pieces[3]!.read_next).toBe('This is the last piece, bytes 162,000 to 179,999 of 180,000. Decode each piece and join the bytes in order; sha256 is of the whole file, so check the joined bytes against it.')
    for (const p of pieces) expect(replyText(p).length).toBeLessThanOrEqual(REPLY_MAX_CHARS)
  })

  it('length asks for smaller pieces and is never more than a reply carries', () => {
    const file = raw(100_000)
    expect(read(file, 10, 1000)).toMatchObject({ offset: 10, length: 1000, next_offset: 1010 })
    expect(unbase64(read(file, 10, 1000).content_base64)).toEqual(file.bytes.subarray(10, 1010))
    expect(read(file, 0, 5_000_000)).toMatchObject({ length: MAIL_FILE_SLICE_MAX_BYTES, next_offset: MAIL_FILE_SLICE_MAX_BYTES })
    expect(read(file, 99_000, 5000)).toMatchObject({ offset: 99_000, length: 1000, next_offset: null })
    expect(mailFileReadNextWords({ size: 100_000, offset: 0, length: 54_000, next: 54_000 })).toContain('(1 more call at this length)')
    expect(mailFileReadNextWords({ size: 1200, offset: 0, length: 1200, next: null })).toBeNull()
  })

  it('an offset past the end is refused with the file’s size', () => {
    expect(mailFileReadReply('dana@example-plumbing.test', 'm1', raw(1200), { offset: 1200, length: null })).toEqual({ ok: false, error: 'offset 1,200 is past the end of statement 0912.pdf, which is 1,200 bytes: offsets run from 0 to 1,199.' })
  })

  it('a piece is shortened until the reply fits, whatever the file is named', () => {
    const file = raw(180_000, `${'"quoted" '.repeat(1200)}.pdf`)
    const reply = read(file)
    expect(Number(reply.length)).toBeLessThan(MAIL_FILE_SLICE_MAX_BYTES)
    expect(Number(reply.length) % 3).toBe(0)
    expect(reply.next_offset).toBe(reply.length)
    const text = replyText(reply)
    expect(text.length).toBeLessThanOrEqual(REPLY_MAX_CHARS)
    expect(unbase64(JSON.parse(text).content_base64)).toEqual(file.bytes.subarray(0, Number(reply.length)))
  })
})

describe('the server and the docs', () => {
  it('declares the three verbs, files a job through drive-link as the dev, asks the log before a second apply, and keeps view_as off them', () => {
    expect(SERVER).toContain("const SERVER_VERSION = '0.51.0'")
    for (const verb of ['read_mail_file', 'plan_mail_file', 'apply_mail_file']) {
      expect(SERVER).toContain(`name: '${verb}'`)
      expect(SERVER).toContain(`case '${verb}':`)
    }
    expect(SERVER).toContain("invokeAsDev(await jwt(), 'drive-link', { action: 'put', job: parsed.value.to.job")
    expect(SERVER).toContain('const prior = await hooks.priorApply(name, quoted)')
    expect(SERVER).toContain("verb === 'plan_mail_file' || verb === 'apply_mail_file'")
    expect(SERVER).toContain('runVerb(who, jwt, inner.verb, inner.args, hooks)')
    expect(SERVER).toContain('read_mail_file hands one file off a hit back')
  })

  it('read_mail_file reads in pieces: the server slices before the door writes, and the words carry the cap', () => {
    expect(SERVER).toContain('const piece = mailFileReadReply(parsed.account.email, parsed.id, file, { offset: parsed.offset, length: parsed.length })')
    expect(SERVER).toContain('file = mailFileWhole(read)')
    expect(SERVER).toContain("offset: { type: 'number'")
    expect(SERVER).toContain("length: { type: 'number'")
    // The instructions and the docs name the cap in digits; they move with the constant.
    expect(MAIL_FILE_SLICE_MAX_BYTES).toBe(54_000)
    expect(MAIL_FILE_SLICE_MAX_BYTES % 3).toBe(0)
    expect(SERVER).toContain('a piece at a time past 54,000 bytes')
    expect(README).toContain('at most 54,000 bytes')
    expect(SKILL).toContain('54,000 bytes')
  })

  it('the docs carry the verbs', () => {
    expect(README).toContain('`read_mail_file(account, id, name, offset?, length?)` · `plan_mail_file(file)` · `apply_mail_file(file, plan_hash)`')
    expect(EDGE).toContain('Server 0.29.0 — a file off a mail')
  })
})
