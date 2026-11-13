/**
 * The dev seat's mail search (v2.6565, server 0.28.0): `search_mail` runs one Gmail search across the company's own
 * mailboxes under the delegation, as each login, with the read-only scope alone; `read_mail` reads one hit whole. The
 * kernel resolves the accounts against the Workspace's logins and refuses any other, caps the ask, shapes a hit from
 * a message's headers and the reply newest first, and words Google's refusals; the server declares both verbs over
 * the read-only scope and no write; the docs carry them. Made-up people only.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { EmailIn } from '../../../supabase/functions/_shared/gcKernels/lib/emailIn/gmailMessage'
import { GMAIL_READONLY_SCOPE, MAIL_READ_TEXT_MAX, MAIL_SEARCH_ACCOUNTS_CAP, MAIL_SEARCH_MAX_CAP, inBatches, mailDomain, mailHit, mailReadArgs, mailReadReply, mailRefusal, mailSearchArgs, mailSearchReply, type MailAccount } from '../../../supabase/functions/_shared/devMcpMailSearch'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const GMAIL = readFileSync('supabase/functions/_shared/gmail.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const EDGE = readFileSync('docs/EDGE_FUNCTIONS.md', 'utf8')
const SETUP = readFileSync('docs/DRIVE_INTAKE_SETUP.md', 'utf8')

const KNOWN: MailAccount[] = [
  { email: 'marcus@example-plumbing.test', name: 'Marcus Reed', archived: false },
  { email: 'dana@example-plumbing.test', name: 'Dana Okafor', archived: false },
  { email: 'old@example-plumbing.test', name: 'Old Login', archived: true },
]

describe('search_mail · the arguments', () => {
  it('reads the Workspace off the reader’s address', () => {
    expect(mailDomain('bids@example-plumbing.test')).toBe('example-plumbing.test')
    expect(mailDomain(' Bids@Example-Plumbing.TEST ')).toBe('example-plumbing.test')
    expect(mailDomain('')).toBeNull()
    expect(mailDomain(undefined)).toBeNull()
    expect(mailDomain('nobody')).toBeNull()
  })

  it('every current login when accounts is left out; the archived ones on asking', () => {
    const r = mailSearchArgs({ q: 'from:supplier@example.test' }, KNOWN)
    expect(r.ok && r.value.accounts.map((a) => a.email)).toEqual(['marcus@example-plumbing.test', 'dana@example-plumbing.test'])
    expect(r.ok && r.value.max).toBe(20)
    expect(r.ok && r.value.target).toBe('2 accounts')
    const all = mailSearchArgs({ q: 'x', include_archived: true }, KNOWN)
    expect(all.ok && all.value.accounts.length).toBe(3)
  })

  it('names a login by address, local part or name, once each, and refuses any other', () => {
    const r = mailSearchArgs({ q: 'invoice 4471', accounts: ['Marcus Reed', 'dana', 'MARCUS@example-plumbing.test'] }, KNOWN)
    expect(r.ok && r.value.accounts.map((a) => a.email)).toEqual(['marcus@example-plumbing.test', 'dana@example-plumbing.test'])
    const one = mailSearchArgs({ q: 'x', accounts: ['dana'] }, KNOWN)
    expect(one.ok && one.value.target).toBe('dana@example-plumbing.test')
    const other = mailSearchArgs({ q: 'x', accounts: ['someone@gmail.com'] }, KNOWN)
    expect(!other.ok && other.error).toContain('not a login of the Workspace')
    const bad = mailSearchArgs({ q: 'x', accounts: 'dana' }, KNOWN)
    expect(!bad.ok && bad.error).toContain('accounts is a list')
  })

  it('folds since and until into the query, caps max and the query, and needs q', () => {
    const r = mailSearchArgs({ q: 'subject:"Lot 12"', since: '2026-08-04', until: '2026-10-14', max: 500 }, KNOWN)
    expect(r.ok && r.value.q).toBe('subject:"Lot 12" after:2026/08/04 before:2026/10/14')
    expect(r.ok && r.value.max).toBe(MAIL_SEARCH_MAX_CAP)
    expect(mailSearchArgs({}, KNOWN)).toEqual({ ok: false, error: expect.stringContaining('search_mail needs q') })
    expect(mailSearchArgs({ q: 'x'.repeat(501) }, KNOWN)).toEqual({ ok: false, error: expect.stringContaining('at most 500') })
    expect(mailSearchArgs({ q: 'x', since: '8/4/2026' }, KNOWN)).toEqual({ ok: false, error: 'since is a day as YYYY-MM-DD.' })
    expect(mailSearchArgs({ q: 'x', max: 0 }, KNOWN)).toEqual({ ok: false, error: expect.stringContaining('1 to 100') })
    const many = Array.from({ length: MAIL_SEARCH_ACCOUNTS_CAP + 1 }, (_, i) => ({ email: `p${i}@example-plumbing.test`, name: null, archived: false }))
    expect(mailSearchArgs({ q: 'x' }, many)).toEqual({ ok: false, error: expect.stringContaining(`at most ${MAIL_SEARCH_ACCOUNTS_CAP}`) })
    expect(mailSearchArgs({ q: 'x' }, [])).toEqual({ ok: false, error: expect.stringContaining('No login of the Workspace') })
  })
})

describe('search_mail · the hits and the reply', () => {
  const message = (id: string, at: number, subject: string) => ({
    id,
    threadId: `t-${id}`,
    labelIds: ['INBOX'],
    internalDate: String(at),
    snippet: ' The bill for the rough-in … ',
    payload: { headers: [{ name: 'from', value: 'Supplier <ap@supplier.test>' }, { name: 'To', value: 'marcus@example-plumbing.test' }, { name: 'Subject', value: subject }, { name: 'Date', value: 'Mon, 3 Aug 2026 10:00:00 -0500' }] },
  })

  it('a hit carries the account, the ids, the headers and the snippet, never a body', () => {
    const hit = mailHit('marcus@example-plumbing.test', message('m1', Date.UTC(2026, 7, 3, 15), 'Invoice 4471'))
    expect(hit).toEqual({ account: 'marcus@example-plumbing.test', id: 'm1', thread_id: 't-m1', date: '2026-08-03T15:00:00.000Z', from: 'Supplier <ap@supplier.test>', to: 'marcus@example-plumbing.test', cc: '', subject: 'Invoice 4471', snippet: 'The bill for the rough-in …', labels: ['INBOX'] })
    expect(mailHit('x@example-plumbing.test', { id: 'm2' }).date).toBeNull()
  })

  it('the reply lists every hit newest first across the mailboxes, counts each, and names the refused', () => {
    const reply = mailSearchReply('invoice 4471', [
      { account: 'marcus@example-plumbing.test', hits: [mailHit('marcus@example-plumbing.test', message('a', Date.UTC(2026, 7, 3), 'older'))], more: true, estimate: 41 },
      { account: 'old@example-plumbing.test', refused: 'Google has no mailbox for old@example-plumbing.test (a login the Workspace no longer holds).' },
      { account: 'dana@example-plumbing.test', hits: [mailHit('dana@example-plumbing.test', message('b', Date.UTC(2026, 9, 1), 'newer'))], more: false, estimate: 1 },
    ])
    expect(reply.reading).toBe('2 hits across 2 mailboxes; 1 mailbox has more past max; 1 mailbox refused')
    expect(reply.hits.map((h) => h.subject)).toEqual(['newer', 'older'])
    expect(reply.accounts).toEqual([{ account: 'marcus@example-plumbing.test', hits: 1, more: true, estimate: 41 }, { account: 'dana@example-plumbing.test', hits: 1, more: false, estimate: 1 }])
    expect(reply.refused).toEqual([{ account: 'old@example-plumbing.test', why: expect.stringContaining('no mailbox') }])
    expect(mailSearchReply('x', []).reading).toBe('0 hits across 0 mailboxes')
  })

  it('Google’s refusals name the door', () => {
    expect(mailRefusal('dana@example-plumbing.test', 'Google token exchange failed: unauthorized_client')).toContain(`adds ${GMAIL_READONLY_SCOPE} to the service account's domain-wide delegation`)
    expect(mailRefusal('old@example-plumbing.test', 'invalid_grant: Invalid email or User ID')).toContain('no mailbox for old@example-plumbing.test')
    expect(mailRefusal('dana@example-plumbing.test', 'Gmail /messages failed (429): quota')).toBe('Google refused dana@example-plumbing.test: Gmail /messages failed (429): quota')
  })

  it('runs the batches in order, width at a time', async () => {
    const seen: number[] = []
    const out = await inBatches([1, 2, 3, 4, 5], 2, async (n) => {
      seen.push(n)
      return n * 2
    })
    expect(out).toEqual([2, 4, 6, 8, 10])
    expect(seen).toEqual([1, 2, 3, 4, 5])
  })
})

describe('read_mail', () => {
  it('takes a login of the Workspace and a Gmail id, and no other', () => {
    const r = mailReadArgs({ account: 'Dana@example-plumbing.test', id: '18f3a2b9c0d1e2f3' }, KNOWN)
    expect(r.ok && r.account.email).toBe('dana@example-plumbing.test')
    expect(mailReadArgs({ account: 'dana@example-plumbing.test' }, KNOWN)).toEqual({ ok: false, error: expect.stringContaining('read_mail needs account') })
    expect(mailReadArgs({ account: 'someone@gmail.com', id: '18f3a2b9c0d1e2f3' }, KNOWN)).toEqual({ ok: false, error: expect.stringContaining('not a login of the Workspace') })
    expect(mailReadArgs({ account: 'dana@example-plumbing.test', id: 'm1?format=raw' }, KNOWN)).toEqual({ ok: false, error: expect.stringContaining('not a Gmail message id') })
  })

  it('the reply carries the headers, the words capped, and the files by name alone', () => {
    const email: EmailIn = { gmailId: 'm1', threadId: 't1', labels: ['INBOX'], at: '2026-08-03T15:00:00.000Z', from: { name: 'Supplier', address: 'ap@supplier.test' }, to: [{ name: null, address: 'dana@example-plumbing.test' }], cc: [], subject: 'Invoice 4471', text: 'x'.repeat(MAIL_READ_TEXT_MAX + 5), links: [], files: [{ partId: '2', name: 'invoice.pdf', mime: 'application/pdf', size: 1200, attachmentId: 'a1', data: null, inline: false }], headers: {}, html: null }
    const reply = mailReadReply('dana@example-plumbing.test', email)
    expect(reply.from).toBe('Supplier <ap@supplier.test>')
    expect(reply.to).toEqual(['dana@example-plumbing.test'])
    expect(reply.text.length).toBe(MAIL_READ_TEXT_MAX)
    expect(reply.truncated).toBe(true)
    expect(reply.files).toEqual([{ name: 'invoice.pdf', mime: 'application/pdf', size: 1200 }])
    expect(Object.keys(reply)).not.toContain('attachmentId')
  })
})

describe('the server and the docs', () => {
  it('declares both verbs over the read-only scope, with the Workspace read off the reader’s address, and says so in its instructions', () => {
    expect(SERVER).toContain("const SERVER_VERSION = '0.82.0'")
    for (const verb of ['search_mail', 'read_mail']) {
      expect(SERVER).toContain(`name: '${verb}'`)
      expect(SERVER).toContain(`case '${verb}':`)
    }
    expect(SERVER).toContain('googleServiceToken(saJson, [GMAIL_READONLY_SCOPE], account)')
    expect(SERVER).toContain("mailDomain(Deno.env.get('GMAIL_IMPERSONATE_USER'))")
    expect(SERVER).toContain('search_mail runs one Gmail search across the company')
    expect(GMAIL_READONLY_SCOPE).toBe('https://www.googleapis.com/auth/gmail.readonly')
    // The read verbs touch only the reads of the Gmail helper: no label, modify, trash, delete or send.
    const block = SERVER.slice(SERVER.indexOf("case 'search_mail':"), SERVER.indexOf("case 'check_license':"))
    for (const write of ['gmailAddLabel', 'gmailRemoveLabel', 'gmailSend', '/modify', '/trash', '/delete']) expect(block).not.toContain(write)
    expect(GMAIL).toContain('export function gmailMessageHeaders(token: string, id: string, headers: readonly string[])')
    expect(GMAIL).toContain('format=metadata${asked}')
  })

  it('the docs carry the verbs and the admin step', () => {
    expect(README).toContain('`search_mail(q, accounts?, include_archived?, since?, until?, max?)` · `read_mail(account, id)`')
    expect(EDGE).toContain('v2.6565 (server 0.28.0)')
    expect(SETUP).toContain('https://www.googleapis.com/auth/gmail.readonly')
  })
})
