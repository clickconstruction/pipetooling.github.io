/**
 * A conversation taken back off its job from the dev seat (server 0.79.0): `plan_mail_untag` → `apply_mail_untag` run
 * gmail-mine's own untag as the login whose box it is, through that function's seat door (`as`, `plan`), for a tag the
 * seat made and no other. The kernel resolves the arguments, hashes everything the untag would touch, and words the
 * plan and what is left behind; gmail-mine's door holds the gate; the server declares the verbs and the docs name them.
 * Made-up people only.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { MyMailUntagOk, MyMailUntagPlanOk } from '../myMail/contract'
import type { MailAccount } from '../../../supabase/functions/_shared/devMcpMailSearch'
import {
  mailUntagAppliedWords,
  mailUntagArgs,
  mailUntagChangedWords,
  untagApplyReply,
  untagCommitment,
  untagHeldCounts,
  untagLeftWords,
  untagPlanReply,
  untagReading,
} from '../../../supabase/functions/_shared/devMcpMailUntag'
import { isWriteVerb } from '../../../supabase/functions/_shared/devMcpWrites'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const MINE = readFileSync('supabase/functions/gmail-mine/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const EDGE = readFileSync('docs/EDGE_FUNCTIONS.md', 'utf8')
const ACCESS = readFileSync('docs/ACCESS_CONTROL.md', 'utf8')
const SKILL = readFileSync('.claude/skills/mail-search/SKILL.md', 'utf8')

const KNOWN: MailAccount[] = [{ email: 'dana@example-plumbing.test', name: 'Dana Okafor', archived: false }, { email: 'old@example-plumbing.test', name: 'Old', archived: true }]
const JOB = '11111111-1111-4111-8111-111111111111'
const THREAD = '18f3a2b9c0d1e2f3'

const preview = (over: Partial<MyMailUntagPlanOk> = {}): MyMailUntagPlanOk => ({
  ok: true,
  plan: true,
  threadId: THREAD,
  account: 'dana@example-plumbing.test',
  jobKey: `pipeline:${JOB}`,
  taggedAt: '2026-11-09T21:05:00.000Z',
  remove: ['line-1', 'line-2'],
  held: [],
  untie: ['box-1'],
  files: 3,
  keptForMatter: 0,
  greyLine: true,
  sweep: { ties: ['tie-1', 'tie-2'], tiesLeft: 0, contacts: ['contact-1'], contactsLeftEmpty: 0 },
  ...over,
})
const args = (over: Record<string, unknown> = {}) => mailUntagArgs({ untag: { account: ' Dana@Example-Plumbing.test ', thread_id: THREAD, ...over } }, KNOWN)

describe('the seat’s untag: its arguments', () => {
  it('takes a box of the Workspace and a conversation, an archived login’s included', () => {
    expect(args()).toEqual({ ok: true, value: { account: KNOWN[0], threadId: THREAD, target: `thread ${THREAD}` } })
    expect(args({ account: 'old@example-plumbing.test' })).toMatchObject({ ok: true, value: { account: KNOWN[1] } })
  })

  it('refuses a missing untag, an address off the Workspace, a thread id that is none, and a job or a person named', () => {
    expect(mailUntagArgs({}, KNOWN)).toMatchObject({ ok: false })
    expect(args({ account: '' })).toMatchObject({ ok: false })
    expect(args({ thread_id: '' })).toMatchObject({ ok: false })
    const off = args({ account: 'someone@elsewhere.test' })
    expect(off.ok === false && off.error).toContain('not a login of the Workspace')
    const bad = args({ thread_id: 'no spaces allowed' })
    expect(bad.ok === false && bad.error).toContain('not a Gmail thread id')
    const named = args({ job: { jobs_ledger_id: JOB } })
    expect(named.ok === false && named.error).toContain('a conversation alone')
    expect(args({ person: { person_id: JOB } })).toMatchObject({ ok: false })
  })
})

describe('the seat’s untag: what the plan commits to and says', () => {
  const parsed = args()
  if (!parsed.ok) throw new Error('the arguments did not parse')

  it('commits to the box, the conversation, the job and everything the untag would touch', () => {
    const c = untagCommitment(parsed.value, preview())
    expect(c).toEqual({
      account: 'dana@example-plumbing.test',
      thread_id: THREAD,
      job_key: `pipeline:${JOB}`,
      remove: ['line-1', 'line-2'],
      held: [],
      untie: ['box-1'],
      files: 3,
      kept_for_matter: 0,
      grey_line: true,
      ties: ['tie-1', 'tie-2'],
      ties_left: 0,
      contacts: ['contact-1'],
      contacts_left_empty: 0,
    })
    // A line that landed since, a line the office kept something on, or a tie made since: each is another commitment.
    const base = JSON.stringify(c)
    for (const other of [preview({ remove: ['line-1', 'line-2', 'line-3'] }), preview({ remove: ['line-1'], held: [{ id: 'line-2', why: 'promise' }] }), preview({ sweep: { ties: ['tie-1'], tiesLeft: 1, contacts: ['contact-1'], contactsLeftEmpty: 0 } }), preview({ jobKey: `bid:${JOB}` })]) {
      expect(JSON.stringify(untagCommitment(parsed.value, other))).not.toBe(base)
    }
  })

  it('reads the plan back as counts, with what is cleared and that nothing is left', () => {
    const c = untagCommitment(parsed.value, preview())
    expect(untagReading(c)).toBe(
      "2 lines go with 3 files and each line's raw copy; 1 line of the boxes comes off the job and stays in Messages; no line is held; no legal matter holds a copy; the grey line and the tag go; nothing changes in Gmail.",
    )
    expect(untagLeftWords(c)).toBe(
      "Cleared with the lines: 2 people come off the job's people, 1 contact the tag made goes with its address. Left: nothing that names who was written to. Never touched: a line the boxes wrote stays in its person's thread, each thread's state (open or done, who has it) stays as it is, a notification already sent is not recalled, and the job's activity held nothing of the tag but these lines.",
    )
    const reply = untagPlanReply(c, 'a'.repeat(64))
    expect(reply).toMatchObject({ plan_hash: 'a'.repeat(64), reading: untagReading(c), left: untagLeftWords(c), held_why: { promise: 0, highlight: 0, owed: 0 }, remove: ['line-1', 'line-2'], ties: ['tie-1', 'tie-2'] })
    expect(String(reply.next)).toContain('There is no undo')
    expect(String(reply.next)).toContain("stays in dana@example-plumbing.test's Gmail")
    expect(String(reply.after)).toContain('HR file')
  })

  it('names what is held and why, what a matter keeps, and everything left behind', () => {
    const c = untagCommitment(
      parsed.value,
      preview({
        remove: ['line-1'],
        held: [
          { id: 'line-2', why: 'promise' },
          { id: 'line-3', why: 'owed' },
          { id: 'line-4', why: 'owed' },
        ],
        untie: [],
        files: 1,
        keptForMatter: 2,
        greyLine: false,
        sweep: { ties: [], tiesLeft: 1, contacts: [], contactsLeftEmpty: 2 },
      }),
    )
    expect(untagHeldCounts(c)).toEqual({ promise: 1, highlight: 0, owed: 2 })
    expect(untagReading(c)).toBe(
      "1 line goes with 1 file and each line's raw copy; 0 lines of the boxes come off the job and stay in Messages; 3 lines stay on the job (1 for a promise written down on it, 2 for what we owe was done by it); a legal matter keeps its own copy of 2 documents made from them; the tag goes; nothing changes in Gmail.",
    )
    const left = untagLeftWords(c)
    expect(left).toContain('3 held lines stay readable on the job with their files')
    expect(left).toContain("1 person stays on the job's people with no line there")
    expect(left).toContain('2 contacts stay in Messages with no line')
    expect(left).not.toContain('nothing that names who was written to')
  })

  it('says what the apply did, from the function’s own answer', () => {
    const c = untagCommitment(parsed.value, preview())
    const done: MyMailUntagOk = { ok: true, removed: 2, keptForMatter: false, held: 0, untied: 1, swept: { ties: 2, tiesLeft: 0, contacts: 1, contactsLeftEmpty: 0 } }
    expect(untagApplyReply(c, done)).toEqual({
      untagged: "2 lines removed with their files and raw copies, 1 line of the boxes untied, 0 lines held; 2 people off the job's people and 1 contact the tag made removed; the grey line and the tag are gone. Nothing changed in Gmail.",
      removed: 2,
      held: 0,
      untied: 1,
      kept_for_matter: false,
      ties_removed: 2,
      ties_left: 0,
      contacts_removed: 1,
      contacts_left_empty: 0,
      account: 'dana@example-plumbing.test',
      thread_id: THREAD,
      job_key: `pipeline:${JOB}`,
    })
    // A function a deploy behind answers without the seat's counts: they read as none, never as undefined.
    expect(untagApplyReply(c, { ok: true, removed: 1, keptForMatter: true })).toMatchObject({ removed: 1, held: 0, untied: 0, kept_for_matter: true, ties_removed: 0, contacts_removed: 0 })
    expect(mailUntagChangedWords()).toContain('Plan again')
    expect(mailUntagAppliedWords({ target: `thread ${THREAD}`, at: '2026-11-12T20:00:00.000Z' })).toContain('applied already at 2026-11-12T20:00:00.000Z')
  })
})

describe('the seat’s untag: the server, the function and the docs', () => {
  it('is declared as two tools, handled with the mail verbs, refused through view_as, and outside the RPC write grammar', () => {
    for (const verb of ['plan_mail_untag', 'apply_mail_untag']) {
      expect(SERVER).toContain(`name: '${verb}'`)
      expect(SERVER).toContain(`case '${verb}':`)
      expect(SERVER).toContain(`verb === '${verb}'`)
      expect(isWriteVerb(verb)).toBe(false)
    }
    expect(SERVER).toContain("const SERVER_VERSION = '0.80.0'")
    const start = SERVER.indexOf("if (name === 'plan_mail_untag' || name === 'apply_mail_untag') {")
    const block = SERVER.slice(start, SERVER.indexOf("if (name === 'plan_mail_tag' || name === 'apply_mail_tag') {"))
    // A dev's own key, the plan first through gmail-mine's door, the hash over the commitment, one apply per plan.
    expect(block).toContain("if (who.role !== 'dev') return refused(")
    expect(block).toContain("invokeAsDev(session, 'gmail-mine', { ...ask, plan: true })")
    expect(block).toContain('sha256Hex(JSON.stringify(commitment))')
    expect(block).toContain('if (hash !== quoted) return refused(mailUntagChangedWords()')
    expect(block).toContain('hooks.priorApply(name, quoted)')
    expect(block.indexOf('hooks.priorApply(name, quoted)')).toBeLessThan(block.indexOf("invokeAsDev(session, 'gmail-mine', ask)"))
  })

  it('keeps the gate in gmail-mine: only a tag the seat made, asked of the seat’s own call log, and a plan that marks nothing', () => {
    expect(MINE).toContain("if ((ask.action === 'tag' || ask.action === 'untag') && typeof ask.as === 'string') {")
    expect(MINE).toContain("admin.from('dev_mcp_calls').select('user_id, created_at, args').eq('verb', 'apply_mail_tag').eq('status', 'ok').contains('args', { tag: { thread_id: ask.threadId } })")
    expect(MINE).toContain('const may = seatMayUntag(tagRow, seatTagsOf(calls, me.email, ask.threadId))')
    expect(MINE).toContain('if (tagRow && !planOnly) {')
    expect(MINE).toContain("if (ask.action === 'untag' && ask.plan === true) return refuse(myMailRefusal('badRequest', 'The plan of an untag is the dev seat’s alone.')")
    // The gate comes before the mark, and the mark before anything is taken off.
    expect(MINE.indexOf('const may = seatMayUntag(')).toBeLessThan(MINE.indexOf('if (tagRow && !planOnly) {'))
  })

  it('is named in the seat’s README, the edge functions doc, the access doc and the mail skill', () => {
    for (const doc of [README, EDGE, ACCESS, SKILL]) {
      expect(doc).toContain('plan_mail_untag')
      expect(doc).toContain('apply_mail_untag')
    }
    expect(ACCESS).not.toContain('never untags')
    expect(EDGE).not.toContain('The seat reads mail with its own verbs and never untags.')
  })
})
