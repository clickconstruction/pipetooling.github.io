import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseLedger } from '../../scripts/lib/mailBackfillRun'

/**
 * The mail backfill's run (punch list #332), rehearsed whole against a made-up seat: `plan`, `apply` and `undo` had
 * never run when the contact step was built, and the pilot is their first time against the real one. Every person,
 * address and job here is invented, and nothing leaves the test: `fetch` is the fake below.
 */
interface World {
  /** Someone has opened the customer's thread: their own contact exists and holds the address on their record. */
  pressed: boolean
  /** The seat says a filing made an unnamed sender. */
  unknown: boolean
  applied: string[]
  untagged: string[]
  verbs: Set<string>
}

const MAILS = [
  { account: 'rosa@clickplumbing.example', id: 'm1', thread_id: 't1', date: '2026-07-02T15:00:00Z', from: 'Dana Reyes <dana@reyes.example>', to: 'rosa@clickplumbing.example', subject: 'Leak under the sink', snippet: 'Can someone come by', labels: ['INBOX'], files: [{ name: 'sink.jpg', mime: 'image/jpeg', size: 90000 }] },
  { account: 'rosa@clickplumbing.example', id: 'm2', thread_id: 't1', date: '2026-07-02T16:00:00Z', from: 'Rosa Vega <rosa@clickplumbing.example>', to: 'Dana Reyes <dana@reyes.example>', subject: 'Re: Leak under the sink', snippet: 'Thursday works', labels: ['SENT'], files: [] },
  // A stranger who names the street: the rule holds it, so the run never plans it.
  { account: 'rosa@clickplumbing.example', id: 'm3', thread_id: 't2', date: '2026-07-05T15:00:00Z', from: 'Kai Brandt <kai@brandt.example>', to: 'rosa@clickplumbing.example', subject: 'Tile at 4 Elm Ct', snippet: 'About 4 Elm Ct', labels: ['INBOX'], files: [] },
  // A person at the customer, on the record and on no contact: sure by the rule, held by the contact step.
  { account: 'dale@clickplumbing.example', id: 'm4', thread_id: 't3', date: '2026-07-08T15:00:00Z', from: 'Pat Reyes <pat@reyes.example>', to: 'dale@clickplumbing.example', subject: 'Walk-through', snippet: 'See you at 4 Elm Ct on Friday', labels: ['INBOX'], files: [] },
]

type Filter = { column: string; op: string; value: unknown }
type Row = Record<string, unknown>

function tablesOf(world: World): Record<string, Row[]> {
  const rosa = { id: 'c-rosa', kind: 'team', name: 'Rosa Vega', customer_id: null, customer_contact_person_id: null }
  const rosaMail = { id: 'ch2', kind: 'email', key: 'rosa@clickplumbing.example', contact_id: 'c-rosa' }
  return {
    jobs_ledger: [{ id: 'j1', hcp_number: null, click_number: null, job_name: 'Reyes remodel', job_address: '4 Elm Ct, Austin, TX', customer_id: 'cu-dana', gc_customer_id: null, service_type_id: null, created_at: '2026-06-01T00:00:00Z', status: 'working' }],
    customers: [{ id: 'cu-dana', name: 'Dana Reyes', contact_info: { email: 'dana@reyes.example' }, billing_email: null }],
    customer_contact_persons: [{ id: 'p-pat', customer_id: 'cu-dana', name: 'Pat Reyes', email: 'pat@reyes.example' }],
    users: [
      { id: 'u-rosa', email: 'rosa@clickplumbing.example', archived_at: null, my_mail_on: true, role: 'assistant', is_walk_tester: false },
      { id: 'u-dale', email: 'dale@clickplumbing.example', archived_at: null, my_mail_on: true, role: 'estimator', is_walk_tester: false },
    ],
    app_settings: [{ id: 'a1', key: 'messages_boxes_v1', value_text: JSON.stringify({ team: { address: '' }, bids: { address: 'bids@clickplumbing.example' } }) }],
    contacts: world.pressed ? [{ id: 'c-dana', kind: 'customer', name: null, customer_id: 'cu-dana', customer_contact_person_id: null }, rosa] : [rosa],
    contact_channels: world.pressed ? [{ id: 'ch1', kind: 'email', key: 'dana@reyes.example', contact_id: 'c-dana' }, rosaMail] : [rosaMail],
  }
}

const matches = (row: Row, f: Filter): boolean =>
  f.op === 'eq' ? String(row[f.column]) === String(f.value) : f.op === 'in' ? (f.value as unknown[]).map(String).includes(String(row[f.column])) : f.op === 'gt' ? String(row[f.column]) > String(f.value) : true

/** One verb of the made-up seat, in the shapes the real one answers (`devMcpMailTag.ts`, `devMcpMailSearch.ts`). */
function answer(world: World, verb: string, args: Record<string, unknown>): unknown {
  world.verbs.add(verb)
  const thread = (a: { account: string; thread_id: string }) => MAILS.filter((m) => m.account === a.account && m.thread_id === a.thread_id)
  if (verb === 'read_rows') {
    const rows = (tablesOf(world)[String(args.table)] ?? []).filter((r) => ((args.filters as Filter[]) ?? []).every((f) => matches(r, f)))
    return { data: rows.sort((a, b) => String(a.id).localeCompare(String(b.id))).slice(0, Number(args.limit ?? 200)) }
  }
  if (verb === 'search_mail') {
    const boxes = (args.accounts as string[] | undefined) ?? ['rosa@clickplumbing.example', 'dale@clickplumbing.example']
    const q = String(args.q)
    const hit = (m: (typeof MAILS)[number]) =>
      q.startsWith('"') ? `${m.subject} ${m.snippet}`.toLowerCase().includes(q.replace(/"/g, '').toLowerCase()) : q.includes('from:') && (q.match(/[a-z.]+@[a-z.]+/g) ?? []).some((a) => `${m.from} ${m.to}`.includes(a))
    return { hits: MAILS.filter((m) => boxes.includes(m.account) && hit(m)).map(({ files: _files, ...m }) => ({ ...m, cc: '' })), accounts: boxes.map((account) => ({ account, more: false })), refused: [] }
  }
  if (verb === 'plan_mail_tag') {
    const tag = args.tag as { account: string; thread_id: string; for_record?: boolean }
    if (tag.for_record !== true) throw new Error('a backfill plans for the record')
    const ms = thread(tag)
    return {
      plan_hash: `hash-${tag.thread_id}`,
      counts: { lines: ms.length, tied: 0, files: ms.reduce((n, m) => n + m.files.length, 0), skipped: 0, filed: ms.length },
      reading: '',
      moving_from: null,
      mails: ms.map((m) => ({ gmailId: m.id, kind: 'write', at: m.date, from: m.from, subject: m.subject, files: m.files.length, lands: 'record' })),
    }
  }
  if (verb === 'read_mail') {
    const m = MAILS.find((x) => x.account === args.account && x.id === args.id)!
    return { account: m.account, id: m.id, thread_id: m.thread_id, date: m.date, from: m.from, to: [m.to], cc: [], subject: m.subject, labels: m.labels, text: '', truncated: false, files: m.files }
  }
  if (verb === 'apply_mail_tag') {
    const tag = args.tag as { account: string; thread_id: string; for_record?: boolean }
    world.applied.push(`${tag.account} ${tag.thread_id} ${String(args.plan_hash)} for_record=${String(tag.for_record)}`)
    return { tagged: `${thread(tag).length} lines written`, lines: thread(tag).length, tied: 0, files: 0, contact_id: 'c-dana', unknown_sender: world.unknown ? { contactId: 'c-x', address: 'x@x.example', name: 'x' } : null }
  }
  if (verb === 'plan_mail_untag') return { plan_hash: `un-${(args.untag as { thread_id: string }).thread_id}` }
  if (verb === 'apply_mail_untag') {
    const untag = args.untag as { account: string; thread_id: string }
    world.untagged.push(`${untag.account} ${untag.thread_id}`)
    return { untagged: true }
  }
  throw new Error(`the rehearsal has no verb ${verb}`)
}

const FRIDAY_NOON = '2026-11-13T18:00:00Z'
const SUNDAY_NOON = '2026-11-15T18:00:00Z'

/** One command of the run, against the world, at a moment. Its printed lines, and what stopped it. */
async function backfill(world: World, dir: string, now: string, ...args: string[]): Promise<{ out: string; err: string }> {
  vi.resetModules()
  vi.useFakeTimers({ toFake: ['setTimeout', 'Date'], now: new Date(now) })
  vi.stubEnv('PT_DEV_MCP_TOKEN', 'made-up')
  vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
    const body = JSON.parse(init.body) as { params: { name: string; arguments: Record<string, unknown> } }
    let result: unknown
    try {
      result = { content: [{ text: JSON.stringify(answer(world, body.params.name, body.params.arguments)) }] }
    } catch (e) {
      result = { isError: true, content: [{ text: String((e as Error).message) }] }
    }
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result }), { status: 200 })
  })
  const out: string[] = []
  const err: string[] = []
  vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => void out.push(a.join(' ')))
  vi.spyOn(console, 'warn').mockImplementation((...a: unknown[]) => void out.push(a.join(' ')))
  vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => void err.push(a.join(' ')))
  vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    throw new Error(`exit ${code}`)
  }) as never)
  const argv = process.argv
  process.argv = ['node', 'mail-backfill', ...args, '--dir', dir]
  try {
    const { run } = (await import('../../scripts/mail-backfill')) as { run: Promise<void> }
    let settled = false
    const done = run.then(
      () => void (settled = true),
      () => void (settled = true),
    )
    // The run pauses between calls: the clock is walked on until it ends.
    for (let i = 0; i < 400 && !settled; i++) await vi.advanceTimersByTimeAsync(2000)
    await done
    expect(settled).toBe(true)
  } finally {
    process.argv = argv
    vi.useRealTimers()
  }
  return { out: out.join('\n'), err: err.join('\n') }
}

const kinds = (dir: string) => parseLedger(readFileSync(join(dir, 'ledger.jsonl'), 'utf8')).map((e) => `${e.kind}:${e.threadId}${e.kind === 'held' ? `:${e.words}` : ''}${e.unnamed ? ':unnamed' : ''}`)

function fresh(): { world: World; dir: string } {
  const dir = mkdtempSync(join(tmpdir(), 'mail-backfill-rehearsal-'))
  writeFileSync(join(dir, 'never-tag.txt'), '# made up\n@lawfirm.example\n')
  return { world: { pressed: false, unknown: false, applied: [], untagged: [], verbs: new Set() }, dir }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('the mail backfill, rehearsed against a made-up seat (punch list #332)', () => {
  it('holds every conversation whose sender has no named contact, plans nothing, and says the press', async () => {
    const { world, dir } = fresh()
    const plan = await backfill(world, dir, FRIDAY_NOON, 'plan', '--job', 'j1')
    expect(plan.err).toBe('')
    expect(plan.out).toContain('2 sure conversations of 3 found')
    expect(plan.out).toContain('planned, every sender named: 0 · held for a contact: 2 {"customerNoContact":1,"onRecordNoContact":1} · refused: 0')
    expect(plan.out).toContain('one press names 1 of the held')
    expect(kinds(dir)).toEqual(['held:t1:customerNoContact', 'held:t3:onRecordNoContact'])
    // The sheet, for someone who knows the job: the job, the dates, the mailbox, why, who, the files.
    const sheet = readFileSync(join(dir, 'sheets', 'plan-Reyes-remodel-2026-11-13.csv'), 'utf8').split('\n')
    expect(sheet[0]).toBe('job,first mail,newest mail,mailbox,why it is sure,contact step,filed under,not named,what to press,mails,lines to write,lines to tie,files,file names,moves off,subject,thread,refused')
    expect(sheet[1]).toContain('"Reyes remodel · 4 Elm Ct, Austin, TX",2026-07-02,2026-07-02,rosa@clickplumbing.example,')
    expect(sheet[1]).toContain(',held,,"dana@reyes.example: The sender is the customer, and the customer has no contact yet.",Open the customer’s thread')
    expect(sheet[1]).toContain(',2,2,0,1,sink.jpg,,Re: Leak under the sink,t1,')
    // Nothing planned, so a filing has nothing to file, and nothing was written anywhere.
    const apply = await backfill(world, dir, SUNDAY_NOON, 'apply', '--job', 'j1', '--approved')
    expect(apply.out).toContain('filing 0 planned conversations')
    expect(world.applied).toEqual([])
  })

  it('plans the customer’s conversation once their thread is opened, files it for the record outside office hours, and takes it back', async () => {
    const { world, dir } = fresh()
    world.pressed = true
    const plan = await backfill(world, dir, FRIDAY_NOON, 'plan', '--job', 'j1')
    expect(plan.out).toContain('planned, every sender named: 1 · held for a contact: 1 {"onRecordNoContact":1} · refused: 0')
    expect(plan.out).toContain('of the planned: lines to write: 2 · to tie: 0 · files: 1')
    expect(readFileSync(join(dir, 'sheets', 'plan-Reyes-remodel-2026-11-13.csv'), 'utf8')).toContain(',ready,Dana Reyes (the job’s customer),,,2,2,0,1,sink.jpg,')

    // Friday at noon, Central: no filing, and the seat is never asked.
    const refused = await backfill(world, dir, FRIDAY_NOON, 'apply', '--job', 'j1', '--approved')
    expect(refused.err).toContain('It runs outside office hours')
    expect(world.applied).toEqual([])
    // Without --approved, at any hour.
    expect((await backfill(world, dir, SUNDAY_NOON, 'apply', '--job', 'j1')).err).toContain('given --approved')
    expect(world.applied).toEqual([])

    const apply = await backfill(world, dir, SUNDAY_NOON, 'apply', '--job', 'j1', '--approved')
    expect(apply.err).toBe('')
    expect(apply.out).toContain('filed: 1 of 1')
    // Only the planned conversation, with the plan's own hash, for the record. The held one is never sent.
    expect(world.applied).toEqual(['rosa@clickplumbing.example t1 hash-t1 for_record=true'])
    // A second run files nothing twice.
    expect((await backfill(world, dir, SUNDAY_NOON, 'apply', '--job', 'j1', '--approved')).out).toContain('filing 0 planned conversations')
    expect(world.applied).toHaveLength(1)

    const undo = await backfill(world, dir, FRIDAY_NOON, 'undo', '--job', 'j1')
    expect(undo.out).toContain('taken back: 1 of 1')
    expect(world.untagged).toEqual(['rosa@clickplumbing.example t1'])
    expect(kinds(dir)).toEqual(['plan:t1', 'held:t3:onRecordNoContact', 'applied:t1', 'untagged:t1'])
    // The run reads and files through the seven verbs and no other.
    expect([...world.verbs].sort()).toEqual(['apply_mail_tag', 'apply_mail_untag', 'plan_mail_tag', 'plan_mail_untag', 'read_mail', 'read_rows', 'search_mail'])
  })

  it('stops at a filing that made an unnamed sender after all, and marks it in the ledger', async () => {
    const { world, dir } = fresh()
    world.pressed = true
    world.unknown = true
    await backfill(world, dir, FRIDAY_NOON, 'plan', '--job', 'j1')
    const apply = await backfill(world, dir, SUNDAY_NOON, 'apply', '--job', 'j1', '--approved')
    expect(apply.err).toContain('stopped: this filing made an unnamed sender')
    expect(kinds(dir)).toEqual(['plan:t1', 'held:t3:onRecordNoContact', 'applied:t1:unnamed'])
  })

  it('does not plan or file while the never-tag list is empty, and counts with a note', async () => {
    const { world, dir } = fresh()
    world.pressed = true
    writeFileSync(join(dir, 'never-tag.txt'), '# nothing named yet\n')
    for (const args of [['plan', '--job', 'j1'], ['apply', '--job', 'j1', '--approved']]) {
      expect((await backfill(world, dir, SUNDAY_NOON, ...args)).err).toContain('is empty. The run does not start without one.')
    }
    expect(world.applied).toEqual([])
    const count = await backfill(world, dir, FRIDAY_NOON, 'count')
    expect(count.err).toBe('')
    expect(count.out).toContain('the never-tag list is empty')
    expect(count.out).toContain('sure: 2 · held for a person: 1 · left out: 0')
    expect(count.out).toContain('the contact step, over the sure ones: every sender named, ready to plan: 1 · held for a contact: 1 {"onRecordNoContact":1}')
    expect(readFileSync(join(dir, 'sheets', 'count-jobs-2026-11-13.csv'), 'utf8')).toBe(
      'job,sure conversations,senders named,held for a contact,mails,mailboxes,by rule,open jobs of its customer\nReyes remodel,2,1,1,3,2,onlyJob 1 · street 1,1\n',
    )
    // A count writes nothing to the app.
    expect([...world.verbs].sort()).toEqual(['read_rows', 'search_mail'])
  })
})
