/**
 * A conversation tagged onto a job from the dev seat (server 0.30.0): `plan_mail_tag` → `apply_mail_tag` run gmail-mine's
 * own tag as the login whose box it is, through that function's seat door (`as`, `plan`), so the lines land as the My
 * email press lands them, each at its mail's own time. The kernel resolves the arguments, hashes what the tag would do,
 * and words the plan; the parser takes `as` and `plan` from the seat alone; the preview reads a plan back; gmail-mine's
 * door takes a dev's key with the seat header and no one else; the server declares the verbs. Made-up people only.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { EmailIn } from '../emailIn/gmailMessage'
import type { MyMailTagPlanOk } from '../myMail/contract'
import { parseMyMailRequest, tagPlanPreview } from '../myMail/mineFunction'
import type { MyMailTagPlan } from '../myMail/tagPlan'
import type { MailAccount } from '../../../supabase/functions/_shared/devMcpMailSearch'
import { mailTagAppliedWords, mailTagArgs, mailTagChangedWords, mailTagJobOf, tagApplyReply, tagCommitment, tagPlanReply, tagReading } from '../../../supabase/functions/_shared/devMcpMailTag'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const MINE = readFileSync('supabase/functions/gmail-mine/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const EDGE = readFileSync('docs/EDGE_FUNCTIONS.md', 'utf8')
const SKILL = readFileSync('.claude/skills/mail-search/SKILL.md', 'utf8')

const KNOWN: MailAccount[] = [{ email: 'dana@example-plumbing.test', name: 'Dana Okafor', archived: false }, { email: 'old@example-plumbing.test', name: 'Old', archived: true }]
const JOB = '11111111-1111-4111-8111-111111111111'
const THREAD = '18f3a2b9c0d1e2f3'

const email = (over: Partial<EmailIn>): EmailIn => ({ gmailId: 'm1', threadId: THREAD, labels: ['INBOX'], at: '2026-08-03T15:00:00.000Z', from: { name: 'Supplier', address: 'ap@supplier.test' }, to: [], cc: [], subject: 'Invoice 4471', text: '', links: [], files: [], headers: {}, html: null, ...over })
const chip = { kind: 'pipeline' as const, id: JOB, key: `pipeline:${JOB}`, num: '912', name: 'Limitless Renovations' }
const plan: MyMailTagPlan = {
  threadId: THREAD,
  jobKey: `pipeline:${JOB}`,
  job: chip,
  jobColumns: { bid_id: null, project_id: null, jobs_ledger_id: JOB },
  mailbox: 'mine',
  mailUserId: 'u-dana',
  steps: [
    { kind: 'write', gmailId: 'm1', threadId: THREAD, rfcMessageId: '<a@x>', direction: 'in', party: { name: 'Supplier', address: 'ap@supplier.test' }, whoUserId: null, whoText: 'Supplier', subject: 'Invoice 4471', body: 'The bill.', at: '2026-08-03T15:00:00.000Z', files: [{ partId: '2', attachmentId: 'a1', name: 'invoice.pdf', mime: 'application/pdf', size: 1200, keep: 'copy' }], links: [], emlName: 'm1.eml' },
    { kind: 'tie', gmailId: 'm2', rfcMessageId: '<b@x>', messageId: 'line-2', onJob: null, tie: true },
    { kind: 'skip', gmailId: 'm3', why: 'draft' },
  ],
  threadRow: { user_id: 'u-dana', gmail_thread_id: THREAD, bid_id: null, project_id: null, jobs_ledger_id: JOB, tagged_by: 'u-dana' },
  label: 'Tagged in ClickTooling',
  counts: { lines: 1, tied: 1, files: 1, skipped: 1 },
}
const emails = [email({}), email({ gmailId: 'm2', at: '2026-08-04T15:00:00.000Z', subject: 'Re: Invoice 4471', from: { name: null, address: 'dana@example-plumbing.test' } }), email({ gmailId: 'm3', at: null, labels: ['DRAFT'] })]

describe('the parser and the preview', () => {
  it('takes as and plan on a tag, and refuses them malformed', () => {
    expect(parseMyMailRequest({ action: 'tag', threadId: THREAD, job: { kind: 'pipeline', id: JOB }, as: 'Dana@Example-Plumbing.test', plan: true })).toEqual({ action: 'tag', threadId: THREAD, job: { kind: 'pipeline', id: JOB }, plan: true, as: 'dana@example-plumbing.test' })
    expect(parseMyMailRequest({ action: 'tag', threadId: THREAD, job: { kind: 'pipeline', id: JOB } })).toEqual({ action: 'tag', threadId: THREAD, job: { kind: 'pipeline', id: JOB } })
    expect(parseMyMailRequest({ action: 'tag', threadId: THREAD, job: { kind: 'pipeline', id: JOB }, plan: 'yes' })).toBeNull()
    expect(parseMyMailRequest({ action: 'tag', threadId: THREAD, job: { kind: 'pipeline', id: JOB }, as: 'nobody' })).toBeNull()
  })

  it('reads a plan back mail by mail, with what the tag would do and why', () => {
    const preview = tagPlanPreview(plan, emails, 'dana@example-plumbing.test', `bid:${JOB}`)
    expect(preview.ok && preview.plan).toBe(true)
    expect(preview.counts).toEqual({ lines: 1, tied: 1, files: 1, skipped: 1 })
    expect(preview.movingFrom).toBe(`bid:${JOB}`)
    expect(preview.mails).toEqual([
      { gmailId: 'm1', kind: 'write', at: '2026-08-03T15:00:00.000Z', from: 'Supplier <ap@supplier.test>', subject: 'Invoice 4471', files: 1 },
      { gmailId: 'm2', kind: 'tie', at: '2026-08-04T15:00:00.000Z', from: 'dana@example-plumbing.test', subject: 'Re: Invoice 4471', tie: true, why: 'a line on the person is tied to this job' },
      { gmailId: 'm3', kind: 'skip', at: null, from: 'Supplier <ap@supplier.test>', subject: 'Invoice 4471', why: 'a draft' },
    ])
  })
})

describe('plan_mail_tag · the kernel', () => {
  const preview: MyMailTagPlanOk = tagPlanPreview(plan, emails, 'dana@example-plumbing.test', null)

  it('takes a current login, a thread id and a job in the seat’s words', () => {
    const r = mailTagArgs({ tag: { account: 'Dana@example-plumbing.test', thread_id: THREAD, job: { jobs_ledger_id: JOB } } }, KNOWN)
    expect(r.ok && r.value).toEqual({ account: KNOWN[0], threadId: THREAD, job: { kind: 'pipeline', id: JOB }, target: `pipeline ${JOB}` })
    expect(mailTagJobOf({ bid_id: JOB })).toEqual({ kind: 'bid', id: JOB })
    expect(mailTagJobOf({ project_id: JOB })).toEqual({ kind: 'project', id: JOB })
    expect(mailTagJobOf({ job: '912' })).toBeNull()
    expect(mailTagArgs({}, KNOWN)).toEqual({ ok: false, error: expect.stringContaining('plan_mail_tag needs tag') })
    expect(mailTagArgs({ tag: { account: 'x@gmail.com', thread_id: THREAD, job: { jobs_ledger_id: JOB } } }, KNOWN)).toEqual({ ok: false, error: expect.stringContaining('not a login of the Workspace') })
    expect(mailTagArgs({ tag: { account: 'old@example-plumbing.test', thread_id: THREAD, job: { jobs_ledger_id: JOB } } }, KNOWN)).toEqual({ ok: false, error: expect.stringContaining('archived login') })
    expect(mailTagArgs({ tag: { account: 'dana@example-plumbing.test', thread_id: 'x?', job: { jobs_ledger_id: JOB } } }, KNOWN)).toEqual({ ok: false, error: expect.stringContaining('not a Gmail thread id') })
    expect(mailTagArgs({ tag: { account: 'dana@example-plumbing.test', thread_id: THREAD, job: { number: '912' } } }, KNOWN)).toEqual({ ok: false, error: expect.stringContaining('tag.job needs one of') })
  })

  it('commits to the account, the conversation, the job and what each mail becomes, and words the plan', () => {
    const args = { account: KNOWN[0]!, threadId: THREAD, job: { kind: 'pipeline' as const, id: JOB }, target: `pipeline ${JOB}` }
    const c = tagCommitment(args, preview)
    expect(c).toEqual({ account: 'dana@example-plumbing.test', thread_id: THREAD, job: { kind: 'pipeline', id: JOB }, counts: { lines: 1, tied: 1, files: 1, skipped: 1 }, mails: [{ gmailId: 'm1', kind: 'write' }, { gmailId: 'm2', kind: 'tie', tie: true }, { gmailId: 'm3', kind: 'skip' }], moving_from: null })
    expect(JSON.stringify(c)).not.toContain('Supplier')
    expect(tagReading(preview)).toBe('3 mails in the conversation: 1 line written, 1 line tied, 1 file kept, 1 mail skipped.')
    expect(tagReading({ ...preview, counts: { lines: 0, tied: 0, files: 0, skipped: 3 }, movingFrom: 'bid:x' })).toContain('moves off bid:x. Nothing would land')
    const reply = tagPlanReply(c, preview, 'abcdef0123456789')
    expect(reply.plan_hash).toBe('abcdef0123456789')
    expect(reply.lands).toBe("2 lines on 912 Limitless Renovations's Activity and notes, each at its mail's own time, as dana@example-plumbing.test.")
    expect(String(reply.next)).toContain('apply_mail_tag')
    const done = tagApplyReply(c, preview, { ok: true, jobKey: `pipeline:${JOB}`, lines: 1, tied: 1, files: 1, contactId: 'c1', unknownSender: null })
    expect(done.tagged).toBe('1 line written and 1 line tied onto 912 Limitless Renovations, 1 file kept; later mail in the conversation follows by itself.')
    expect(mailTagChangedWords()).toContain('nothing was tagged')
    expect(mailTagAppliedWords({ target: null, at: '2026-11-06T00:00:00Z' })).toContain('applied already at 2026-11-06T00:00:00Z')
  })
})

describe('the doors and the docs', () => {
  it('gmail-mine opens the tag to a dev’s key with the seat header, as a current login, and answers the plan before anything is written', () => {
    expect(MINE).toContain("if (req.headers.get('X-Dev-Seat') !== 'dev-mcp' || who.role !== 'dev') return refuse(")
    expect(MINE).toContain("if (!them || isFixtureAccount(them) || them.is_walk_tester === true || them.archived_at) return refuse(")
    expect(MINE).toContain('if (ask.plan === true) {')
    expect(MINE).toContain('return json(tagPlanPreview(plan, emails, me.email,')
    expect(MINE).toContain("if (ask.action === 'tag' && ask.plan === true) return refuse(")
    expect(MINE).toContain("const USER_COLUMNS = 'id, name, email, role, archived_at,")
    // The seat's branch comes before the person's gates: the office team, the switch, the sign-in address, the imitation record.
    expect(MINE.indexOf("typeof ask.as === 'string'")).toBeLessThan(MINE.indexOf("caller.rpc('gc_office_team')"))
  })

  it('the seat declares both verbs, plans through gmail-mine as the dev, asks the log before a second apply, and keeps view_as off them', () => {
    expect(SERVER).toContain("const SERVER_VERSION = '0.42.0'")
    for (const verb of ['plan_mail_tag', 'apply_mail_tag']) {
      expect(SERVER).toContain(`name: '${verb}'`)
      expect(SERVER).toContain(`case '${verb}':`)
    }
    expect(SERVER).toContain("invokeAsDev(session, 'gmail-mine', { ...ask, plan: true })")
    expect(SERVER).toContain("invokeAsDev(session, 'gmail-mine', ask)")
    expect(SERVER).toContain("verb === 'plan_mail_tag' || verb === 'apply_mail_tag'")
    expect(SERVER).toContain('plan_mail_tag → apply_mail_tag tags a whole conversation')
  })

  it('the docs and the skill carry the verbs', () => {
    expect(README).toContain('`plan_mail_tag(tag)` · `apply_mail_tag(tag, plan_hash)`')
    expect(EDGE).toContain('Server 0.30.0 — a conversation onto a job')
    expect(EDGE).toContain('dev seat’s door (server 0.30.0)')
    expect(SKILL).toContain('plan_mail_tag')
  })
})
