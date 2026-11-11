import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  BID_OUTCOMES,
  BID_READ_COLUMNS,
  BID_UPDATE_COLUMNS,
  BID_UPDATE_VERBS,
  BOARD_SECTION_WORDS,
  RIDE_COLUMNS,
  SENT_STAMP_COLUMNS,
  UNTRACKED_COLUMNS,
  bidLabel,
  bidUpdateAppliedWords,
  bidUpdateDryRun,
  bidUpdateInput,
  bidUpdateLanded,
  holdsValue,
  isBidUpdateVerb,
  outcomeNoteRow,
  readBidUpdateWorld,
  type BidChange,
  type BidReads,
  type BidRow,
  type BidUpdatePayload,
  type BidUpdateWorld,
} from '../../../supabase/functions/_shared/devMcpBidUpdate'
import { WRITE_VERBS, alreadyApplied, isWriteVerb, planHash, planReply, planVerbFor, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'
import { CATALOG_TABLES } from '../../../supabase/functions/dev-mcp/catalog'
import { BID_DATE_SENT_ATTESTATION_NULLS } from '../bids/bidDateSentAttestation'
import { BID_LOSS_CATEGORIES } from '../bidLossCategories'
import { buildOutcomeChangeBidNoteBody } from '../outcomeChangeBidNote'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const BOARD = readFileSync('src/components/bids/BidsBidBoardTab.tsx', 'utf8')
const PAYLOAD = readFileSync('src/lib/bids/bidFormPayload.ts', 'utf8')
const HISTORY_COLUMNS = readFileSync('supabase/migrations/20261007060000_bids_cover_letter_texts.sql', 'utf8')
const BASELINE_OUTCOMES = readFileSync('supabase/migrations/20250101000000_baseline.sql', 'utf8').match(/CONSTRAINT "bids_outcome_check" CHECK \(\("outcome" = ANY \(ARRAY\[([^\]]+)\]/)?.[1] ?? ''

// A made-up bid and made-up rows: no real name, number or amount.
const BID = 'eeeeeeee-1111-4111-8111-111111111111'
const GC = 'aaaaaaaa-1111-4111-8111-111111111111'
const GC_NEW = 'aaaaaaaa-2222-4222-8222-222222222222'
const SERVICE = 'bbbbbbbb-1111-4111-8111-111111111111'
const DEV = 'ffffffff-1111-4111-8111-111111111111'
const ESTIMATOR = 'ffffffff-2222-4222-8222-222222222222'
const TODAY = '2026-11-11'
const ME = { userId: DEV, name: 'Dev One', email: 'dev.one@example.com' }

const bid = (over: Record<string, unknown> = {}): BidRow => ({
  id: BID,
  bid_number: '9001',
  updated_at: '2026-11-11T15:00:00+00:00',
  working_board_archived_at: null,
  project_name: 'ZZ TEST seat bid',
  address: null,
  customer_id: GC,
  gc_builder_id: null,
  project_id: null,
  development_id: null,
  service_type_id: SERVICE,
  estimator_id: DEV,
  account_manager_id: null,
  bid_due_date: null,
  bid_due_time: null,
  estimated_job_start_date: null,
  design_drawing_plan_date: null,
  bid_value: null,
  agreed_value: null,
  profit: null,
  bid_date_sent: null,
  submitted_to: null,
  outcome: null,
  outcome_at: null,
  loss_category: null,
  loss_reason: null,
  accepted_alternate_tags: [],
  declined_alternate_tags: [],
  gc_contact_name: null,
  gc_contact_phone: null,
  gc_contact_email: null,
  drive_link: null,
  plans_link: null,
  count_tooling_plans_link: null,
  bid_submission_link: null,
  itb_links: [],
  distance_from_office: null,
  robot_opt_out: false,
  notes: null,
  ...Object.fromEntries(SENT_STAMP_COLUMNS.map((c) => [c, null])),
  ...over,
})

const world = (over: Partial<BidUpdateWorld> = {}): BidUpdateWorld => ({ me: ME, bid: bid(), hasVersions: false, jobs: [], named: {}, ...over })

const p = (set: Record<string, unknown>): BidUpdatePayload => {
  const built = bidUpdateInput('plan_bid_update', { update: { bid_id: BID, set } }, TODAY)
  if (!built.ok) throw new Error(built.error)
  return built.p
}
const plan = (set: Record<string, unknown>, w: Partial<BidUpdateWorld> = {}) => {
  const dry = bidUpdateDryRun(p(set), world(w))
  if (!dry.ok) throw new Error(dry.refused)
  return dry.reply as { changes: BidChange[]; patch: Record<string, unknown>; note_line: string | null; after_write: string[]; warnings: string[]; not_done: string[]; bid: Record<string, unknown> }
}
const refusal = (set: Record<string, unknown>, w: Partial<BidUpdateWorld> = {}): string => {
  const dry = bidUpdateDryRun(p(set), world(w))
  if (dry.ok) throw new Error('expected a refusal')
  return dry.refused
}

describe('devMcpBidUpdate — the verbs on the allowlist', () => {
  it('are one write pair with no RPC, plan before apply, and the server and the README name both', () => {
    expect(BID_UPDATE_VERBS).toEqual(['plan_bid_update', 'apply_bid_update'])
    for (const v of BID_UPDATE_VERBS) {
      expect(isBidUpdateVerb(v)).toBe(true)
      expect(isWriteVerb(v)).toBe(true)
      expect(WRITE_VERBS[v].rpc).toBeNull()
      expect(SERVER).toContain(`case '${v}':`)
      expect(SERVER).toContain(`name: '${v}',`)
    }
    expect(planVerbFor('apply_bid_update')).toBe('plan_bid_update')
    expect(isBidUpdateVerb('plan_bid')).toBe(false)
    expect(README).toContain('`plan_bid_update(update)` · `apply_bid_update(update, plan_hash)`')
    expect(README).toContain("eighty-three since v2.6945's bid update")
    expect(SERVER).toContain('plan_bid_update → apply_bid_update (a bid changed as Edit Bid and the Bid Board change it')
  })
})

describe('devMcpBidUpdate — held to the app’s own', () => {
  it('names only columns the bids table has', () => {
    const columnsOf = (table: string): string[] => Object.keys(CATALOG_TABLES[table]?.columns ?? {})
    const columns = columnsOf('bids')
    for (const c of BID_READ_COLUMNS) expect(columns, c).toContain(c)
    expect(columnsOf('bid_versions')).toEqual(expect.arrayContaining(['id', 'bid_id']))
    expect(columnsOf('jobs_ledger')).toEqual(expect.arrayContaining(['id', 'click_number', 'hcp_number', 'job_name', 'status', 'bid_id', 'created_at']))
    expect(columnsOf('bids_submission_entries')).toEqual(expect.arrayContaining(Object.keys(outcomeNoteRow(BID, 'x', { userId: DEV }, 'now'))))
  })
  it('covers every column the Edit Bid form saves, but the bid number, last contact and the alternates', () => {
    const saved = [...PAYLOAD.slice(PAYLOAD.indexOf('export function buildBidSavePayload')).matchAll(/^\s{4}(?:\.\.\.\(editing.*?\{ )?([a-z_]+)(?::|,$)/gm)].map((m) => m[1] ?? '')
    expect(saved.length).toBeGreaterThan(30)
    const outside = saved.filter((c) => !(BID_UPDATE_COLUMNS as readonly string[]).includes(c))
    expect(outside.sort()).toEqual(['accepted_alternate_tags', 'bid_number', 'declined_alternate_tags', 'gc_builder_id', 'last_contact'])
    // The three that ride are written by the verb with their driver; the form has no field for the decided day.
    expect(BID_UPDATE_COLUMNS.filter((c) => !saved.includes(c))).toEqual(['outcome_at'])
    for (const c of ['gc_builder_id', 'accepted_alternate_tags', 'declined_alternate_tags']) expect(RIDE_COLUMNS).toContain(c)
  })
  it('holds the outcomes, the checklist stamps, the Board’s headings and the History columns to their sources', () => {
    expect(BID_OUTCOMES.map((o) => `'${o}'::"text"`).join(', ')).toBe(BASELINE_OUTCOMES)
    expect([...SENT_STAMP_COLUMNS].sort()).toEqual(Object.keys(BID_DATE_SENT_ATTESTATION_NULLS).sort())
    const labels = Object.fromEntries([...BOARD.matchAll(/\{ key: '(\w+)' as const, label: ([^,]+), jumpLabel/g)].map((m) => [m[1], m[2]]))
    const unsent = BOARD.match(/const BID_BOARD_UNSENT_SECTION_LABEL = '([^']+)'/)?.[1]
    expect(BOARD_SECTION_WORDS.unsent).toBe(unsent)
    for (const key of ['pending', 'won', 'startedOrComplete', 'lost'] as const) expect(`'${BOARD_SECTION_WORDS[key]}'`).toBe(labels[key])
    const recorded = new Set([...(HISTORY_COLUMNS.slice(HISTORY_COLUMNS.indexOf('FUNCTION public.bid_changes_bid_columns()')).split('$$')[1] ?? '').matchAll(/'([a-z_]+)'/g)].map((m) => m[1] ?? ''))
    expect(recorded.size).toBeGreaterThan(40)
    for (const c of [...BID_UPDATE_COLUMNS, ...RIDE_COLUMNS]) expect(UNTRACKED_COLUMNS.has(c), c).toBe(!recorded.has(c))
  })
})

describe('bidUpdateInput — the shape', () => {
  it('lowers the ids, rounds the money, trims the words and carries only what was given', () => {
    const built = writeRpcBody('plan_bid_update', { update: { bid_id: BID.toUpperCase(), set: { bid_value: 12500.456, submitted_to: '  ZZ Builder  ', customer_id: GC_NEW.toUpperCase(), outcome: 'WON', robot_opt_out: true } } })
    expect(built).toMatchObject({ ok: true, rpc: null, step: 'plan', target: BID, body: { p: { action: 'update', bid_id: BID, set: { bid_value: 12500.46, submitted_to: 'ZZ Builder', customer_id: GC_NEW, outcome: 'won', robot_opt_out: true } } } })
    expect(p({ bid_value: '1200.50' }).set.bid_value).toBe(1200.5)
    expect(p({ profit: -300 }).set.profit).toBe(-300)
    expect(p({ outcome: null }).set.outcome).toBeNull()
    expect(p({ outcome: 'open' }).set.outcome).toBeNull()
    expect(p({ notes: '  ' }).set.notes).toBeNull()
    expect(p({ itb_links: [' https://example.com/itb ', ''] }).set.itb_links).toEqual(['https://example.com/itb'])
    expect(p({ itb_links: null }).set.itb_links).toEqual([])
  })
  it('refuses a missing bid, an unknown column, a bad value and a day ahead of today — each in words', () => {
    const bad = (set: unknown, has: string) => expect(bidUpdateInput('plan_bid_update', { update: { bid_id: BID, set } }, TODAY)).toMatchObject({ ok: false, error: expect.stringContaining(has) })
    expect(bidUpdateInput('plan_bid_update', {}, TODAY)).toMatchObject({ ok: false, error: expect.stringContaining('plan_bid_update needs update') })
    expect(bidUpdateInput('plan_bid_update', { update: { bid_id: 'b9001', set: { notes: 'x' } } }, TODAY)).toMatchObject({ ok: false })
    bad({}, 'nothing to change')
    bad({ bid_number: '12' }, 'The bid number is the database’s to give'.replace('’', "'"))
    bad({ last_contact: '2026-11-01' }, 'Last contact follows the contact log')
    bad({ accepted_alternate_tags: ['ALT 1'] }, 'Won section')
    bad({ status: 'won' }, 'status is not a column')
    bad({ project_name: '' }, 'cannot be cleared')
    bad({ service_type_id: null }, 'cannot be cleared')
    bad({ bid_value: -1 }, 'bid_value is dollars')
    bad({ bid_value: 'a lot' }, 'bid_value is dollars')
    bad({ outcome: 'pending' }, 'outcome is won, lost, started_or_complete')
    bad({ loss_category: 'too_dear' }, 'loss_category is one of')
    bad({ customer_id: 'ZZ Builder' }, 'customers.id')
    bad({ bid_date_sent: '11/01/2026' }, 'YYYY-MM-DD')
    bad({ bid_date_sent: '2026-02-30' }, 'YYYY-MM-DD')
    bad({ bid_date_sent: '2026-11-12' }, 'ahead of today')
    bad({ outcome_at: '2026-12-01' }, 'ahead of today')
    bad({ bid_due_time: '2pm' }, 'HH:MM')
    bad({ plans_link: 'drive/folders/x' }, 'https://')
    bad({ gc_contact_email: 'nobody' }, 'email')
    bad({ distance_from_office: 'far' }, 'miles')
    bad({ robot_opt_out: 'yes' }, 'true or false')
    bad({ project_name: 'x'.repeat(121) }, 'under 120')
    // A due date may be ahead: it is the day the bid is owed.
    expect(p({ bid_due_date: '2027-01-15' }).set.bid_due_date).toBe('2027-01-15')
  })
  it('needs the plan hash on apply', () => {
    expect(writeRpcBody('apply_bid_update', { update: { bid_id: BID, set: { notes: 'x' } } })).toMatchObject({ ok: false, error: expect.stringContaining('plan_hash') })
    expect(writeRpcBody('apply_bid_update', { update: { bid_id: BID, set: { notes: 'x' } }, plan_hash: 'a'.repeat(64) })).toMatchObject({ ok: true, step: 'apply', planHash: 'a'.repeat(64) })
  })
})

describe('readBidUpdateWorld — the reads the door sees', () => {
  it('reads the bid, whether it has versions, the jobs that point at it and each row a new id names', async () => {
    const asked: string[] = []
    const reads: BidReads = {
      rows: (table, query) => {
        asked.push(`${table}?${query}`)
        if (table === 'bids') return Promise.resolve([bid()])
        if (table === 'bid_versions') return Promise.resolve([{ id: 'v1' }])
        if (table === 'customers') return Promise.resolve([{ id: GC_NEW, name: 'ZZ Builder Two' }])
        if (table === 'users') return Promise.resolve([])
        return Promise.resolve([])
      },
    }
    const w = await readBidUpdateWorld(reads, p({ customer_id: GC_NEW, estimator_id: ESTIMATOR, development_id: null, notes: 'x' }), ME)
    expect(asked).toEqual(expect.arrayContaining([
      `bids?select=${BID_READ_COLUMNS.join(',')}&id=eq.${BID}`,
      `bid_versions?select=id&bid_id=eq.${BID}&limit=1`,
      `jobs_ledger?select=id,click_number,hcp_number,job_name,status&bid_id=eq.${BID}&order=created_at.asc&limit=5`,
      `customers?select=id,name&id=eq.${GC_NEW}`,
      `users?select=id,name&id=eq.${ESTIMATOR}`,
    ]))
    expect(asked).toHaveLength(5)
    expect(w).toMatchObject({ hasVersions: true, jobs: [], named: { customer_id: { id: GC_NEW, name: 'ZZ Builder Two' }, estimator_id: null } })
  })
})

describe('bidUpdateDryRun — a proposal sent months ago, entered now', () => {
  const SET = { bid_value: 48250, bid_date_sent: '2026-06-02', submitted_to: 'ZZ Builder, by email', outcome: 'won', outcome_at: '2026-07-15' }
  it('shows each column before → after, the decided day at noon in the app’s calendar, and the line the form leaves', () => {
    const r = plan(SET)
    expect(r.changes).toEqual([
      { column: 'bid_value', before: null, after: 48250 },
      { column: 'bid_date_sent', before: null, after: '2026-06-02' },
      { column: 'submitted_to', before: null, after: 'ZZ Builder, by email' },
      { column: 'outcome', before: null, after: 'won' },
      { column: 'outcome_at', before: null, after: '2026-07-15' },
    ])
    expect(r.patch).toEqual({ bid_value: 48250, bid_date_sent: '2026-06-02', submitted_to: 'ZZ Builder, by email', outcome: 'won', outcome_at: '2026-07-15T18:00:00.000Z' })
    expect(r.note_line).toBe(buildOutcomeChangeBidNoteBody({ previousOutcome: null, nextOutcome: 'won', actorDisplayName: 'Dev One' }))
    expect(r.note_line).toBe('Win/Loss changed from Not set to Won. Changed by Dev One.')
    expect(r.bid).toMatchObject({ id: BID, label: 'b9001 ZZ TEST seat bid', board_section: 'Unsent / Working Bids', has_versions: false })
  })
  it('says what the database does after: the Board section, the decided day, the labor mint, the shadow score, History, and that a win opens no job', () => {
    const words = plan(SET).after_write.join('\n')
    expect(words).toContain('The Bid Board moves it from Unsent / Working Bids to Won.')
    expect(words).toContain('The decided day (outcome_at) is 2026-07-15, as you gave it')
    expect(words).toContain('A win opens no job and tells nobody')
    expect(words).toContain('bids_mint_labor_on_send')
    expect(words).toContain('never overwrites a row a person touched')
    expect(words).toContain('with no checklist')
    expect(words).toContain('bids_score_shadow_on_send')
    expect(words).toContain("The bid's History records bid_value, bid_date_sent, submitted_to, outcome, outcome_at under your name")
    expect(plan(SET).not_done.join('\n')).toContain('the sent checklist')
    // With no day given, the database stamps now — and the plan says to give one for an old decision.
    expect(plan({ outcome: 'won' }).after_write.join('\n')).toContain('The database stamps the decided day (outcome_at) as now')
    expect(plan({ outcome: 'won' }).patch).toEqual({ outcome: 'won' })
  })
  it('names a job that already points at the bid, and warns when an outcome would stand against it', () => {
    const jobs = [{ id: 'j1', click_number: '9100', hcp_number: null, job_name: 'ZZ TEST job', status: 'working' }]
    expect(plan({ outcome: 'won' }, { jobs }).after_write.join('\n')).toContain('JP9100 already points at this bid')
    expect(plan({ outcome: 'lost', loss_category: 'price' }, { jobs }).warnings.join('\n')).toContain('JP9100 points at this bid')
  })
  it('commits the hash to the payload, the before values and updated_at', async () => {
    const payload = p(SET)
    const a = bidUpdateDryRun(payload, world())
    const b = bidUpdateDryRun(payload, world())
    const moved = bidUpdateDryRun(payload, world({ bid: bid({ updated_at: '2026-11-11T16:00:00+00:00' }) }))
    const other = bidUpdateDryRun(payload, world({ bid: bid({ bid_value: 100 }) }))
    if (!a.ok || !b.ok || !moved.ok || !other.ok) throw new Error('expected plans')
    const hash = await planHash('plan_bid_update', payload, a.reply)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(await planHash('apply_bid_update', payload, b.reply)).toBe(hash)
    expect(await planHash('plan_bid_update', payload, moved.reply)).not.toBe(hash)
    expect(await planHash('plan_bid_update', payload, other.reply)).not.toBe(hash)
    expect(await planHash('plan_bid_update', p({ ...SET, bid_value: 48251 }), a.reply)).not.toBe(hash)
    expect(planReply('plan_bid_update', a.reply, hash)).toMatchObject({ plan_hash: hash, next: expect.stringContaining('apply_bid_update') })
  })
})

describe('bidUpdateDryRun — no-ops and what rides', () => {
  it('drops a column that already holds its value and refuses a plan that changes nothing', () => {
    const held = { bid: bid({ bid_value: 48250, bid_due_date: '2026-06-01', bid_due_time: '14:00:00', outcome: 'won', outcome_at: '2026-07-15T18:00:00+00:00', notes: 'as sent' }) }
    expect(plan({ bid_value: '48250.00', notes: 'changed' }, held).changes.map((c) => c.column)).toEqual(['notes'])
    expect(refusal({ bid_value: 48250, bid_due_time: '14:00', outcome: 'won', outcome_at: '2026-07-15', notes: 'as sent', address: null }, held)).toContain('already reads that way')
    expect(holdsValue('bid_due_time', '14:00:00', '14:00')).toBe(true)
    expect(holdsValue('outcome_at', '2026-07-16T03:00:00+00:00', '2026-07-15')).toBe(true) // 22:00 on the 15th in the app's calendar
    expect(holdsValue('itb_links', ['a'], ['a'])).toBe(true)
    expect(holdsValue('robot_opt_out', null, false)).toBe(true)
  })
  it('a bid that stops being lost drops its reason, and one that stops being won drops the alternates', () => {
    const lost = { bid: bid({ outcome: 'lost', outcome_at: '2026-07-01T18:00:00+00:00', bid_date_sent: '2026-06-02', loss_category: 'price', loss_reason: 'too high' }) }
    const r = plan({ outcome: 'won' }, lost)
    expect(r.changes).toEqual([
      { column: 'outcome', before: 'lost', after: 'won' },
      { column: 'loss_category', before: 'price', after: null, rides_with: 'outcome', why: 'only a lost bid carries why it was lost' },
      { column: 'loss_reason', before: 'too high', after: null, rides_with: 'outcome', why: 'only a lost bid carries why it was lost' },
    ])
    expect(r.after_write.join('\n')).toContain('The decided day stays 2026-07-01')
    const won = { bid: bid({ outcome: 'won', outcome_at: '2026-07-01T18:00:00+00:00', accepted_alternate_tags: ['ALT 1'], declined_alternate_tags: ['ALT 2'] }) }
    const open = plan({ outcome: null }, won)
    expect(open.patch).toEqual({ outcome: null, accepted_alternate_tags: [], declined_alternate_tags: [] })
    expect(open.after_write.join('\n')).toContain('The database clears the decided day')
    expect(open.note_line).toBe('Win/Loss changed from Won to Not set. Changed by Dev One.')
    // Won → Started or Complete keeps the alternates.
    expect(plan({ outcome: 'started_or_complete' }, won).patch).toEqual({ outcome: 'started_or_complete' })
  })
  it('a lost bid carries its reason on the line, and one with no category is warned', () => {
    const sent = { bid: bid({ bid_date_sent: '2026-06-02' }) }
    const r = plan({ outcome: 'lost', loss_category: 'other_sub', loss_reason: 'went with their usual sub' }, sent)
    expect(r.note_line).toBe('Win/Loss changed from Not set to Lost. Changed by Dev One.\nLoss reason: went with their usual sub')
    expect(r.warnings).toEqual([])
    expect(plan({ outcome: 'lost' }, sent).warnings.join('\n')).toContain(`Set loss_category: ${BID_LOSS_CATEGORIES.map((c) => c.key).join(' | ')}`)
    // The Board's reason chips on a bid already lost: the two columns alone, no line.
    const chips = plan({ loss_category: 'price' }, { bid: bid({ outcome: 'lost', outcome_at: '2026-07-01T18:00:00+00:00' }) })
    expect(chips.patch).toEqual({ loss_category: 'price' })
    expect(chips.note_line).toBeNull()
  })
  it('the GC change clears the old builder link, a cleared due date drops its time, a cleared sent date drops the checklist', () => {
    expect(plan({ customer_id: GC_NEW }, { bid: bid({ gc_builder_id: 'old-builder' }), named: { customer_id: { id: GC_NEW, name: 'ZZ Builder Two' } } }).changes).toEqual([
      { column: 'customer_id', before: GC, after: GC_NEW, named: 'ZZ Builder Two' },
      { column: 'gc_builder_id', before: 'old-builder', after: null, rides_with: 'customer_id', why: expect.any(String) },
    ])
    expect(plan({ bid_due_date: null }, { bid: bid({ bid_due_date: '2026-06-01', bid_due_time: '14:00:00' }) }).patch).toEqual({ bid_due_date: null, bid_due_time: null })
    const stamps = Object.fromEntries(SENT_STAMP_COLUMNS.map((c) => [c, c.endsWith('_by') ? ESTIMATOR : '2026-06-02T15:00:00+00:00']))
    const cleared = plan({ bid_date_sent: null }, { bid: bid({ bid_date_sent: '2026-06-02', ...stamps }) })
    expect(cleared.patch).toEqual({ bid_date_sent: null, ...Object.fromEntries(SENT_STAMP_COLUMNS.map((c) => [c, null])) })
    expect(cleared.after_write.join('\n')).toContain('from Not yet won or lost to Unsent / Working Bids')
    // A changed date leaves the stamps where the person put them, and says they were given for the old date.
    const moved = plan({ bid_date_sent: '2026-06-05' }, { bid: bid({ bid_date_sent: '2026-06-02', ...stamps }) })
    expect(moved.patch).toEqual({ bid_date_sent: '2026-06-05' })
    expect(moved.warnings.join('\n')).toContain('confirmed the sent checklist for 2026-06-02')
    expect(moved.after_write.join('\n')).not.toContain('bids_mint_labor_on_send')
  })
})

describe('bidUpdateDryRun — what it refuses', () => {
  it('a bid or a named row not visible', () => {
    expect(refusal({ notes: 'x' }, { bid: null })).toContain('No bid')
    expect(refusal({ estimator_id: ESTIMATOR }, { named: { estimator_id: null } })).toContain('estimator_id: no users row')
  })
  it('the bid’s own Sent and Won / Lost on a bid with versions, as the form locks them', () => {
    expect(refusal({ outcome: 'won' }, { hasVersions: true })).toContain('set per GC')
    expect(refusal({ outcome: 'lost', loss_category: 'price' }, { hasVersions: true })).toContain('set per GC')
    expect(refusal({ bid_date_sent: '2026-06-02' }, { hasVersions: true })).toContain('recorded per GC')
    // Open and Started or Complete stay hand-set, and every other column still changes.
    expect(plan({ outcome: 'started_or_complete', bid_value: 500 }, { hasVersions: true, bid: bid({ outcome: 'won', outcome_at: '2026-07-01T18:00:00+00:00' }) }).patch).toEqual({ outcome: 'started_or_complete', bid_value: 500 })
  })
  it('a loss reason on a bid that is not lost, a decided day with no decision, a time with no due date, a decision before the send', () => {
    expect(refusal({ outcome: 'won', loss_reason: 'x' })).toContain('the reason a bid was lost')
    expect(refusal({ loss_category: 'price' })).toContain('the reason a bid was lost')
    expect(refusal({ outcome_at: '2026-07-15' })).toContain('would have no outcome')
    expect(refusal({ outcome_at: null }, { bid: bid({ outcome: 'won', outcome_at: '2026-07-01T18:00:00+00:00' }) })).toContain('keeps its day')
    expect(refusal({ bid_due_time: '14:00' })).toContain('needs a due date')
    expect(refusal({ outcome: 'won', outcome_at: '2026-05-01', bid_date_sent: '2026-06-02' })).toContain('before it was sent')
  })
  it('a decided day alone moves the day of a bid already decided', () => {
    const r = plan({ outcome_at: '2026-07-15' }, { bid: bid({ outcome: 'won', outcome_at: '2026-11-11T16:00:00+00:00', bid_date_sent: '2026-06-02' }) })
    expect(r.changes).toEqual([{ column: 'outcome_at', before: '2026-11-11', after: '2026-07-15' }])
    expect(r.patch).toEqual({ outcome_at: '2026-07-15T18:00:00.000Z' })
    expect(r.note_line).toBeNull()
    expect(r.after_write.join('\n')).toContain('The decided day (outcome_at) becomes 2026-07-15')
  })
})

describe('the apply’s words', () => {
  const planned: BidChange[] = [
    { column: 'bid_value', before: null, after: 48250 },
    { column: 'outcome', before: null, after: 'won' },
    { column: 'outcome_at', before: null, after: '2026-07-15' },
  ]
  it('says what landed off the row read back, and what did not', () => {
    const row = { id: BID, bid_number: '9001', project_name: 'ZZ TEST seat bid', bid_value: 48250, outcome: 'won', outcome_at: '2026-07-15T18:00:00+00:00', bid_date_sent: '2026-06-02' }
    expect(bidUpdateLanded(planned, row)).toEqual({ changes: planned, held: null })
    expect(bidUpdateLanded(planned, null)).toMatchObject({ changes: [], held: expect.stringContaining('RLS') })
    expect(bidUpdateLanded(planned, { ...row, outcome: null, outcome_at: null })).toMatchObject({ changes: [planned[0]], held: expect.stringContaining('outcome, outcome_at') })
    const words = bidUpdateAppliedWords({ id: BID }, { changes: planned, held: null }, { asked: true, saved: true }, row)
    expect(words).toMatchObject({ bid_id: BID, label: 'b9001 ZZ TEST seat bid', board_section: 'Won', note_line: "on the bid's notes", next: expect.stringContaining('under Won on the Bid Board') })
    expect(bidUpdateAppliedWords({ id: BID }, { changes: planned, held: null }, { asked: true, saved: false, why: '403' }, row).note_line).toContain('not saved: 403')
    expect(bidUpdateAppliedWords({ id: BID, bid_number: '9001' }, { changes: [], held: 'no row' }, { asked: false, saved: false }, null).next).toContain('did not change')
  })
  it('writes the outcome line as Edit Bid inserts it, with no contact method', () => {
    expect(outcomeNoteRow(BID, 'Win/Loss changed from Not set to Won. Changed by Dev One.', { userId: DEV }, '2026-11-11T17:00:00.000Z')).toEqual({ bid_id: BID, notes: 'Win/Loss changed from Not set to Won. Changed by Dev One.', contact_method: null, occurred_at: '2026-11-11T17:00:00.000Z', created_by: DEV })
    expect(SERVER).toContain("restRows(session, 'POST', 'bids_submission_entries', 'select=id', outcomeNoteRow(")
    expect(bidLabel({ bid_number: null, project_name: null })).toBe('this bid')
  })
  it('answers a second apply of the same plan in words', () => {
    expect(alreadyApplied('apply_bid_update', { target: BID, at: '2026-11-11T17:00:00Z' })).toContain('already applied on this bid at 2026-11-11T17:00:00Z')
  })
})
