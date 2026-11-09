/**
 * A file off a mail (server 0.29.0): `read_mail_file` hands one file on a search_mail hit back; `plan_mail_file` →
 * `apply_mail_file` files it where it belongs — a job's Drive folder through drive-link's put as the dev, a person's HR
 * file through the evidence verbs, a matter's Evidence tab through the document verbs — the bytes read on the server.
 * The kernel picks the file by name, shapes the inner verb's arguments and the job landing's commitment; the server
 * declares the verbs, keeps view_as off the writes and asks the log before a second apply. Made-up people only.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { EmailFile } from '../../../supabase/functions/_shared/gcKernels/lib/emailIn/gmailMessage'
import type { MailAccount } from '../../../supabase/functions/_shared/devMcpMailSearch'
import { MAIL_FILE_MAX_BYTES, bytesToBase64, innerVerbFor, jobApplyReply, jobCommitment, jobPlanReply, mailFileAppliedWords, mailFileArgs, mailFileChangedWords, mailFileReadArgs, mailFileReadReply, pickMailFile, type MailFileArgs, type MailFileBytes } from '../../../supabase/functions/_shared/devMcpMailFile'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const EDGE = readFileSync('docs/EDGE_FUNCTIONS.md', 'utf8')

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
    expect(mailFileReadReply('dana@example-plumbing.test', 'm1', bytes)).toEqual({ account: 'dana@example-plumbing.test', id: 'm1', ...bytes })
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

describe('the server and the docs', () => {
  it('declares the three verbs, files a job through drive-link as the dev, asks the log before a second apply, and keeps view_as off them', () => {
    expect(SERVER).toContain("const SERVER_VERSION = '0.49.0'")
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

  it('the docs carry the verbs', () => {
    expect(README).toContain('`read_mail_file(account, id, name)` · `plan_mail_file(file)` · `apply_mail_file(file, plan_hash)`')
    expect(EDGE).toContain('Server 0.29.0 — a file off a mail')
  })
})
