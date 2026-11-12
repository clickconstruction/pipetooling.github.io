import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  ACTIVITY_NOTE_LATEST,
  ACTIVITY_NOTE_MAX,
  ACTIVITY_NOTE_VERBS,
  activityNoteAppliedWords,
  activityNoteDryRun,
  activityNoteInput,
  activityNoteLands,
  activityNotePlannedWrite,
  activityNoteRow,
  isActivityNoteVerb,
  noonInAppTz,
  readActivityNoteWorld,
  realDay,
  type ActivityNotePayload,
  type ActivityNoteWorld,
} from '../../../supabase/functions/_shared/devMcpActivityNote'
import type { Reader, Row, RowsQuery } from '../../../supabase/functions/_shared/devMcpComposites'
import { WRITE_VERBS, alreadyApplied, isWriteVerb, planHash, planReply, planVerbFor, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'
import { CATALOG_TABLES } from '../../../supabase/functions/dev-mcp/catalog'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const HOOK = readFileSync('src/hooks/useJobThreadNotes.ts', 'utf8')
const POPOVER = readFileSync('src/components/bids/BidGcNotesPopover.tsx', 'utf8')

const JOB = 'dddddddd-1111-4111-8111-111111111111'
const BID = 'aaaaaaaa-1111-4111-8111-111111111111'
const GC = 'aaaaaaaa-2222-4222-8222-222222222222'
const DEV = 'ffffffff-1111-4111-8111-111111111111'
const HASH = 'a'.repeat(64)
const TODAY = '2026-11-09'
const NOW = '2026-11-09T21:30:00.000Z'
const ME = { userId: DEV, name: 'Robert' }

const jobWorld = (latest: ActivityNoteWorld['latest'] = []): ActivityNoteWorld => ({
  on: 'job',
  job: { id: JOB, label: 'JP1113', name: 'ZZ Test Walk Project', status: 'working', customer: 'ZZ Test Customer' },
  gc: null,
  latest,
})
const bidWorld = (gc: { id: string; name: string | null } | null = null): ActivityNoteWorld => ({
  on: 'bid',
  bid: { id: BID, label: 'BP398', projectName: 'ZZ Test', outcome: null },
  gc,
  latest: [{ id: 'e1', at: '2026-09-29T16:00:00Z', by: 'Robert', text: 'email · ZZ test line' }],
})

const p = (over: Record<string, unknown> = {}, verb: 'plan_activity_note' | 'apply_activity_note' = 'plan_activity_note'): ActivityNotePayload => {
  const built = activityNoteInput(verb, { note: { job: 'JP1113', text: 'WC-1 carriers ordered today, PO 119.', ...over }, ...(verb === 'apply_activity_note' ? { plan_hash: HASH } : {}) })
  if (!built.ok) throw new Error(built.error)
  return built.p
}

describe('devMcpActivityNote — the verbs on the allowlist', () => {
  it('are two write verbs with no RPC, plan before apply, and the server and the README name both', () => {
    expect(ACTIVITY_NOTE_VERBS).toEqual(['plan_activity_note', 'apply_activity_note'])
    for (const v of ACTIVITY_NOTE_VERBS) {
      expect(isActivityNoteVerb(v)).toBe(true)
      expect(isWriteVerb(v)).toBe(true)
      expect(WRITE_VERBS[v].rpc).toBeNull()
      expect(SERVER).toContain(`case '${v}':`)
      expect(SERVER).toContain(`name: '${v}',`)
    }
    expect(planVerbFor('apply_activity_note')).toBe('plan_activity_note')
    expect(isActivityNoteVerb('plan_job')).toBe(false)
    expect(SERVER).toContain("const SERVER_VERSION = '0.77.0'")
    expect(SERVER).toContain('Writes are ninety-seven verbs and nothing else:')
    expect(SERVER).toContain('plan_activity_note → apply_activity_note')
    expect(README).toContain('`plan_activity_note(note)` · `apply_activity_note(note, plan_hash)`')
    expect(README).toContain('ninety-seven `plan_` / `apply_` / `revert_` verbs')
    expect(README).toContain('the two note verbs (v2.6822)')
  })
  it('writes the rows the app writes: the thread note the hook inserts and the entry the popover inserts, column for column', () => {
    expect(HOOK).toContain(".from('jobs_ledger_thread_notes')")
    expect(HOOK).toMatch(/job_id: jobId,\s+author_user_id: authUserId,\s+body: trimmed,/)
    expect(POPOVER).toContain("supabase.from('bids_submission_entries').insert({")
    for (const col of ['bid_id: bidId', 'gc_customer_id: gcId', 'notes,', 'contact_method: method', 'occurred_at: occurredAtIso', 'created_by: authUser?.id ?? null']) expect(POPOVER).toContain(col)
    const job = activityNoteRow(p(), jobWorld(), ME, NOW)
    expect(job).toEqual({ table: 'jobs_ledger_thread_notes', select: 'id,created_at', row: { job_id: JOB, author_user_id: DEV, body: 'WC-1 carriers ordered today, PO 119.' } })
    const bid = activityNoteRow(p({ job: undefined, bid: 'BP398', gc_customer_id: GC }), bidWorld({ id: GC, name: 'Dana Whitfield' }), ME, NOW)
    expect(bid).toEqual({ table: 'bids_submission_entries', select: 'id,occurred_at', row: { bid_id: BID, gc_customer_id: GC, notes: 'WC-1 carriers ordered today, PO 119.', contact_method: null, occurred_at: NOW, created_by: DEV } })
    // The bid's own note carries no GC; the GC comes from the world, never from the payload alone.
    expect(activityNoteRow(p({ job: undefined, bid: 'BP398' }), bidWorld(), ME, NOW).row).toMatchObject({ gc_customer_id: null })
  })
})

describe('activityNoteInput — the shape', () => {
  it('takes one of job or bid, trims the text, keeps a day and a GC, and apply needs the hash', () => {
    expect(activityNoteInput('plan_activity_note', { note: { job: ' JP1113 ', text: '  Ordered.  \r\nPO 119. ' } })).toMatchObject({ ok: true, target: 'JP1113', planHash: null, p: { action: 'note', on: 'job', ref: 'JP1113', text: 'Ordered.  \nPO 119.' } })
    expect(activityNoteInput('plan_activity_note', { note: { bid: BID, text: 'x', on: '2026-11-01', gc_customer_id: GC.toUpperCase() } })).toMatchObject({ ok: true, p: { on: 'bid', ref: BID, on_day: '2026-11-01', gc_customer_id: GC } })
    expect(activityNoteInput('apply_activity_note', { note: { job: 'JP1113', text: 'x' }, plan_hash: HASH.toUpperCase() })).toMatchObject({ ok: true, planHash: HASH })
    expect(activityNoteInput('apply_activity_note', { note: { job: 'JP1113', text: 'x' } })).toMatchObject({ ok: false, error: expect.stringContaining('plan_activity_note replied with') })
    const built = writeRpcBody('plan_activity_note', { note: { bid: 'BP398', text: 'Rev 2 shared.' } })
    expect(built).toMatchObject({ ok: true, rpc: null, step: 'plan', target: 'BP398', body: { p: { action: 'note', on: 'bid', ref: 'BP398', text: 'Rev 2 shared.' } } })
  })
  it('refuses both or neither, empty or long text, a day that is not one, and a GC on a job note', () => {
    const bad = (note: unknown) => activityNoteInput('plan_activity_note', { note })
    expect(bad({ text: 'x' })).toMatchObject({ ok: false, error: expect.stringContaining('one of job or bid') })
    expect(bad({ job: 'a', bid: 'b', text: 'x' })).toMatchObject({ ok: false, error: expect.stringContaining('not both') })
    expect(bad({ job: 'a', text: '   ' })).toMatchObject({ ok: false, error: expect.stringContaining('empty') })
    expect(bad({ job: 'a', text: 'x'.repeat(ACTIVITY_NOTE_MAX + 1) })).toMatchObject({ ok: false, error: expect.stringContaining(`the most is ${ACTIVITY_NOTE_MAX}`) })
    expect(bad({ job: 'a', text: 'x', on: '2026-02-30' })).toMatchObject({ ok: false, error: expect.stringContaining('is not one') })
    expect(bad({ job: 'a', text: 'x', on: '11/09/2026' })).toMatchObject({ ok: false })
    expect(bad({ job: 'a', text: 'x', gc_customer_id: GC })).toMatchObject({ ok: false, error: expect.stringContaining('no GC lane') })
    expect(bad({ bid: 'a', text: 'x', gc_customer_id: 'dana' })).toMatchObject({ ok: false, error: expect.stringContaining('customers.id') })
    expect(bad(null)).toMatchObject({ ok: false, error: expect.stringContaining('needs note') })
    expect(realDay('2026-11-09')).toBe(true)
    expect(realDay('2026-11-31')).toBe(false)
  })
})

describe('noonInAppTz — the stamp of a day', () => {
  it('reads as that day in the app’s calendar on both sides of the clock change, and null for today', () => {
    expect(noonInAppTz(undefined)).toBeNull()
    expect(noonInAppTz('2026-11-01')).toBe('2026-11-01T18:00:00.000Z') // CDT: 13:00
    expect(noonInAppTz('2026-11-09')).toBe('2026-11-09T18:00:00.000Z') // CST: 12:00
    expect(noonInAppTz('2026-07-04')).toBe('2026-07-04T18:00:00.000Z')
  })
})

describe('readActivityNoteWorld — the reads', () => {
  const fake = (tables: Record<string, Row[]>, log: Array<{ table: string; q: RowsQuery }> = []): Reader => ({
    rpc: async (name, args) => {
      if (name === 'search_jobs_ledger') return (args?.search_text as string).includes('1113') ? [{ id: JOB, job_name: 'ZZ Test Walk Project', click_number: '1113', hcp_number: '', service_type_id: 's1' }] : []
      if (name === 'search_bids_for_clock') return (args?.p_search_text as string).includes('398') ? [{ id: BID, bid_number: '398', project_name: 'ZZ Test', service_type_id: 's1' }] : []
      return []
    },
    rows: async (table, q) => {
      log.push({ table, q })
      return tables[table] ?? []
    },
  })
  const TABLES: Record<string, Row[]> = {
    service_types: [{ id: 's1', ledger_job_prefix: 'JP', ledger_bid_prefix: 'BP' }],
    jobs_ledger: [{ id: JOB, hcp_number: '', click_number: '1113', job_name: 'ZZ Test Walk Project', status: 'working', customer_name: 'ZZ Test Customer', service_type_id: 's1' }],
    jobs_ledger_thread_notes: [
      { id: 'n2', body: 'Second', created_at: '2026-11-08T10:00:00Z', author_user_id: DEV, author: { name: 'Robert' } },
      { id: 'n1', body: 'First', created_at: '2026-11-07T10:00:00Z', author_user_id: DEV, author: null },
    ],
    bids: [{ id: BID, bid_number: '398', project_name: 'ZZ Test', outcome: null, service_type_id: 's1' }],
    bids_submission_entries: [
      { id: 'e3', notes: null, occurred_at: '2026-10-02T10:00:00Z', contact_method: 'call', gc_customer_id: null, creator: null },
      { id: 'e2', notes: 'Walked the plans', occurred_at: '2026-10-01T10:00:00Z', contact_method: 'email', gc_customer_id: GC, creator: { name: 'Robert' } },
      { id: 'e1', notes: 'Bid note', occurred_at: '2026-09-29T10:00:00Z', contact_method: null, gc_customer_id: null, creator: { name: 'Dev' } },
    ],
    customers: [{ id: GC, name: 'Dana Whitfield' }],
  }
  it('finds the job by its number, labels it with the prefix and hands back its latest lines newest first', async () => {
    const log: Array<{ table: string; q: RowsQuery }> = []
    const world = await readActivityNoteWorld(fake(TABLES, log), p({ job: 'JP1113' }))
    expect(world).toMatchObject({ on: 'job', job: { id: JOB, label: 'JP1113', name: 'ZZ Test Walk Project', status: 'working', customer: 'ZZ Test Customer' }, gc: null })
    expect((world as ActivityNoteWorld).latest).toEqual([
      { id: 'n2', at: '2026-11-08T10:00:00Z', by: 'Robert', text: 'Second' },
      { id: 'n1', at: '2026-11-07T10:00:00Z', by: null, text: 'First' },
    ])
    expect(log.find((l) => l.table === 'jobs_ledger')!.q.select).toBe('id,hcp_number,click_number,job_name,status,customer_name,service_type_id')
    const notes = log.find((l) => l.table === 'jobs_ledger_thread_notes')!
    expect(notes.q).toMatchObject({ filters: [{ column: 'job_id', op: 'eq', value: JOB }], order: [{ column: 'created_at', ascending: false }], limit: ACTIVITY_NOTE_LATEST })
    expect(log.map((l) => l.table)).not.toContain('bids')
  })
  it('finds the bid, keeps only the entries with words, names the GC, and refuses a GC it cannot see', async () => {
    const log: Array<{ table: string; q: RowsQuery }> = []
    const world = await readActivityNoteWorld(fake(TABLES, log), p({ job: undefined, bid: 'BP398', gc_customer_id: GC }))
    expect(world).toMatchObject({ on: 'bid', bid: { id: BID, label: 'BP398', projectName: 'ZZ Test', outcome: null }, gc: { id: GC, name: 'Dana Whitfield' } })
    // The read names the bid's columns as the catalog has them: there is no bids.status (the first live walk hit 42703).
    const bidsRead = log.find((l) => l.table === 'bids')!
    expect(bidsRead.q.select).toBe('id,bid_number,project_name,outcome,service_type_id')
    expect((world as ActivityNoteWorld).latest.map((l) => l.id)).toEqual(['e2', 'e1'])
    expect((world as ActivityNoteWorld).latest[0]).toMatchObject({ text: 'email · Walked the plans', by: 'Robert' })
    const noGc = await readActivityNoteWorld(fake({ ...TABLES, customers: [] }), p({ job: undefined, bid: 'BP398', gc_customer_id: GC }))
    expect(noGc).toMatchObject({ refused: expect.stringContaining('find_customer') })
  })
  it('selects only columns the catalog has, on every table the two reads name (the first live walk asked for bids.status, 42703)', async () => {
    const log: Array<{ table: string; q: RowsQuery }> = []
    await readActivityNoteWorld(fake(TABLES, log), p({ job: 'JP1113' }))
    await readActivityNoteWorld(fake(TABLES, log), p({ job: undefined, bid: 'BP398', gc_customer_id: GC }))
    expect([...new Set(log.map((l) => l.table))].sort()).toEqual(['bids', 'bids_submission_entries', 'customers', 'jobs_ledger', 'jobs_ledger_thread_notes', 'service_types'])
    for (const { table, q } of log) {
      const columns = CATALOG_TABLES[table]?.columns ?? {}
      // A plain column name; an embed (`author:users!…(name)`) is a relationship the door checks on its own.
      const plain = (q.select ?? '').split(',').filter((c) => !c.includes('(') && !c.includes(':'))
      for (const c of plain) expect(columns, `${table}.${c}`).toHaveProperty(c)
    }
  })
  it('refuses in words what nothing finds or RLS hides', async () => {
    expect(await readActivityNoteWorld(fake(TABLES), p({ job: 'nothing here' }))).toMatchObject({ refused: 'No job matches "nothing here".' })
    expect(await readActivityNoteWorld(fake({ ...TABLES, jobs_ledger: [] }), p({ job: JOB }))).toMatchObject({ refused: expect.stringContaining('RLS hides it') })
    expect(await readActivityNoteWorld(fake({ ...TABLES, bids: [] }), p({ job: undefined, bid: BID }))).toMatchObject({ refused: expect.stringContaining('RLS hides it') })
  })
})

describe('activityNoteDryRun — the plan', () => {
  it('says where the line lands, shows the latest lines, the row and what it does not do; the hash moves with a new line', async () => {
    const world = jobWorld([{ id: 'n1', at: '2026-11-08T10:00:00Z', by: 'Robert', text: 'x'.repeat(200) }])
    const dry = activityNoteDryRun(p(), world, ME, TODAY)
    expect(dry.ok).toBe(true)
    if (!dry.ok) return
    expect(dry.reply).toMatchObject({
      action: 'note',
      on: 'job',
      job: { id: JOB, label: 'JP1113' },
      reads: 'WC-1 carriers ordered today, PO 119.',
      by: 'Robert',
      at: 'the time of the apply',
      lands: expect.stringContaining("JP1113's Job activity / notes"),
      writes: { table: 'jobs_ledger_thread_notes', row: { job_id: JOB, author_user_id: DEV, body: 'WC-1 carriers ordered today, PO 119.' } },
    })
    expect((dry.reply.latest as Array<{ text: string }>)[0]?.text).toHaveLength(161)
    expect(dry.reply.not_done).toEqual(expect.arrayContaining([expect.stringContaining('tells nobody')]))
    const h1 = await planHash('plan_activity_note', p(), dry.reply)
    const later = activityNoteDryRun(p(), jobWorld([{ id: 'n2', at: NOW, by: 'Taunya', text: 'Landed.' }, ...world.latest]), ME, TODAY)
    expect(later.ok).toBe(true)
    if (!later.ok) return
    expect(await planHash('plan_activity_note', p(), later.reply)).not.toBe(h1)
    const reply = planReply('plan_activity_note', dry.reply, h1)
    expect(reply.plan_hash).toBe(h1)
    expect(String(reply.next)).toContain('apply_activity_note')
  })
  it('stamps a past day at noon and refuses a day ahead of today', () => {
    const dated = activityNoteDryRun(p({ on: '2026-11-01' }), jobWorld(), ME, TODAY)
    expect(dated).toMatchObject({ ok: true, reply: { at: "2026-11-01 (noon, the app's calendar)", writes: { row: { created_at: '2026-11-01T18:00:00.000Z' } } } })
    const bidDated = activityNoteDryRun(p({ job: undefined, bid: 'BP398', on: '2026-11-01' }), bidWorld(), ME, TODAY)
    expect(bidDated).toMatchObject({ ok: true, reply: { writes: { table: 'bids_submission_entries', row: { occurred_at: '2026-11-01T18:00:00.000Z', contact_method: null } } } })
    expect(activityNoteDryRun(p({ on: '2026-11-10' }), jobWorld(), ME, TODAY)).toMatchObject({ ok: false, refused: expect.stringContaining('ahead of today') })
  })
  it('names the bid’s Notes, or the GC line, and the apply says what landed and the read that lists it', () => {
    expect(activityNoteLands(bidWorld())).toContain("BP398's Notes (the bid's own)")
    expect(activityNoteLands(bidWorld({ id: GC, name: 'Dana Whitfield' }))).toContain('notes for Dana Whitfield')
    expect(activityNoteAppliedWords(jobWorld(), { id: 'n9', at: NOW })).toMatchObject({ note_id: 'n9', on: 'job', label: 'JP1113', at: NOW, next: expect.stringContaining('jobs_ledger_thread_notes by job_id') })
    expect(activityNoteAppliedWords(bidWorld(), { id: 'e9', at: null })).toMatchObject({ note_id: 'e9', on: 'bid', label: 'BP398', next: expect.stringContaining('bids_submission_entries by bid_id') })
    expect(alreadyApplied('apply_activity_note', { target: JOB, at: NOW })).toContain('the line is on the thread')
  })
})

describe('the hash of an undated note — what the caller decided, never the moment of the dry run (v2.6948)', () => {
  // The dry run once took its own clock as a fifth argument and put it in the bid row's occurred_at. Hand it one
  // anyway: the plan and the apply's second dry run run seconds apart, and must hash the same.
  const dryAt = (payload: ActivityNotePayload, world: ActivityNoteWorld, clock: string) => {
    const dry = (activityNoteDryRun as unknown as (...args: unknown[]) => ReturnType<typeof activityNoteDryRun>)(payload, world, ME, TODAY, clock)
    if (!dry.ok) throw new Error(dry.refused)
    return dry.reply
  }
  const PLANNED = '2026-11-09T21:30:00.123Z'
  const APPLIED = '2026-11-09T21:30:07.456Z'
  const bidNote = () => p({ job: undefined, bid: 'BP398' })

  it('gives one hash for the same undated bid note planned at two different times', async () => {
    const first = await planHash('plan_activity_note', bidNote(), dryAt(bidNote(), bidWorld(), PLANNED))
    const second = await planHash('apply_activity_note', bidNote(), dryAt(bidNote(), bidWorld(), APPLIED))
    expect(second).toBe(first)
    // About one GC on the bid, the same.
    const gc = { id: GC, name: 'Dana Whitfield' }
    const forGc = () => p({ job: undefined, bid: 'BP398', gc_customer_id: GC })
    expect(await planHash('plan_activity_note', forGc(), dryAt(forGc(), bidWorld(gc), PLANNED))).toBe(await planHash('plan_activity_note', forGc(), dryAt(forGc(), bidWorld(gc), APPLIED)))
    // A job's undated note never carried a stamp; it holds too.
    expect(await planHash('plan_activity_note', p(), dryAt(p(), jobWorld(), PLANNED))).toBe(await planHash('plan_activity_note', p(), dryAt(p(), jobWorld(), APPLIED)))
    // And across midnight: today only refuses a day ahead, it is not in the plan.
    const before = activityNoteDryRun(bidNote(), bidWorld(), ME, '2026-11-09')
    const after = activityNoteDryRun(bidNote(), bidWorld(), ME, '2026-11-10')
    expect(before.ok && after.ok && JSON.stringify(before.reply) === JSON.stringify(after.reply)).toBe(true)
  })
  it('leaves the stamp out of the planned row and says which column the apply stamps', () => {
    const bid = dryAt(bidNote(), bidWorld(), PLANNED)
    expect(bid.at).toBe('the time of the apply')
    expect(bid.writes).toEqual({
      table: 'bids_submission_entries',
      row: { bid_id: BID, gc_customer_id: null, notes: 'WC-1 carriers ordered today, PO 119.', contact_method: null, created_by: DEV },
      stamped_at_apply: expect.stringContaining('occurred_at'),
    })
    const job = dryAt(p(), jobWorld(), PLANNED)
    expect(job.writes).toEqual({ table: 'jobs_ledger_thread_notes', row: { job_id: JOB, author_user_id: DEV, body: 'WC-1 carriers ordered today, PO 119.' }, stamped_at_apply: expect.stringContaining('created_at') })
    // No instant of any kind in what an undated plan hashes: the thread's own lines are the only times, and there are none here.
    expect(JSON.stringify(dryAt(bidNote(), { ...bidWorld(), latest: [] } as ActivityNoteWorld, PLANNED))).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:/)
    expect(JSON.stringify(job)).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:/)
  })
  it('keeps a dated note whole: noon of its day comes from the payload, so it is in the row and in the hash', async () => {
    const dated = (day: string) => p({ job: undefined, bid: 'BP398', on: day })
    expect(activityNotePlannedWrite(dated('2026-11-01'), bidWorld(), ME)).toEqual({ table: 'bids_submission_entries', row: { bid_id: BID, gc_customer_id: null, notes: 'WC-1 carriers ordered today, PO 119.', contact_method: null, occurred_at: '2026-11-01T18:00:00.000Z', created_by: DEV } })
    expect(activityNotePlannedWrite(p({ on: '2026-11-01' }), jobWorld(), ME)).toEqual({ table: 'jobs_ledger_thread_notes', row: { job_id: JOB, author_user_id: DEV, body: 'WC-1 carriers ordered today, PO 119.', created_at: '2026-11-01T18:00:00.000Z' } })
    const h1 = await planHash('plan_activity_note', dated('2026-11-01'), dryAt(dated('2026-11-01'), bidWorld(), PLANNED))
    expect(await planHash('plan_activity_note', dated('2026-11-01'), dryAt(dated('2026-11-01'), bidWorld(), APPLIED))).toBe(h1)
    expect(await planHash('plan_activity_note', dated('2026-11-02'), dryAt(dated('2026-11-02'), bidWorld(), PLANNED))).not.toBe(h1)
  })
  it('still moves with the words, the GC and a new line on the thread', async () => {
    const base = await planHash('plan_activity_note', bidNote(), dryAt(bidNote(), bidWorld(), PLANNED))
    const other = p({ job: undefined, bid: 'BP398', text: 'Other words.' })
    expect(await planHash('plan_activity_note', other, dryAt(other, bidWorld(), PLANNED))).not.toBe(base)
    const forGc = p({ job: undefined, bid: 'BP398', gc_customer_id: GC })
    expect(await planHash('plan_activity_note', forGc, dryAt(forGc, bidWorld({ id: GC, name: 'Dana Whitfield' }), PLANNED))).not.toBe(base)
    const grown: ActivityNoteWorld = { ...bidWorld(), latest: [{ id: 'e2', at: APPLIED, by: 'Taunya', text: 'Landed.' }, ...bidWorld().latest] } as ActivityNoteWorld
    expect(await planHash('plan_activity_note', bidNote(), dryAt(bidNote(), grown, PLANNED))).not.toBe(base)
  })
  it('stamps the undated row with the clock of the write, and the server hands the dry run no clock', () => {
    expect(activityNoteRow(bidNote(), bidWorld(), ME, PLANNED).row).toMatchObject({ occurred_at: PLANNED })
    expect(activityNoteRow(bidNote(), bidWorld(), ME, APPLIED).row).toMatchObject({ occurred_at: APPLIED })
    expect(SERVER).toContain('const dry = activityNoteDryRun(p, world, me, todayYmdInAppTz())')
    expect(SERVER).toContain('const write = activityNoteRow(p, world, me, new Date().toISOString())')
    // The write is built after the hash matched and the one-apply check, never before.
    const at = (needle: string) => SERVER.indexOf(needle, SERVER.indexOf("case 'apply_activity_note': {"))
    expect(at('if (fresh !== built.planHash)')).toBeLessThan(at('const write = activityNoteRow('))
    expect(at('hooks.priorApply(name, fresh)')).toBeLessThan(at('const write = activityNoteRow('))
  })
})
