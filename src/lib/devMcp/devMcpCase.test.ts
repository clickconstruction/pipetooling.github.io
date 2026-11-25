/**
 * The dev seat reads the rows the system numbers and writes a case (punch list #315, upgrade 2, PR 3; server 0.118.0):
 * plan_case → apply_case over dev_case_write, exhibit_no on get_person_file, get_case_brief and search_case, the
 * brief's open_items and log, and the number plan_person_evidence's reply names. Made-up people and words.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  BRIEF_CASE_CLOSED,
  BRIEF_CASE_DETAIL_CHARS,
  CASE_BLOCKS_OPEN,
  CASE_CHANGES_MAX,
  CASE_ITEM_SELECT,
  CASE_LOG_SELECT,
  CASE_OWNER_MAX,
  briefCaseLog,
  briefOpenItems,
  caseArgsForLog,
  caseInput,
  exhibitAppliedWords,
  exhibitBits,
  exhibitNoOf,
  exhibitPlanWords,
  isCaseVerb,
  type CaseItemRead,
  type CaseLogRead,
} from '../../../supabase/functions/_shared/devMcpCase'
import { getCaseBrief } from '../../../supabase/functions/_shared/devMcpCaseBrief'
import { searchCase } from '../../../supabase/functions/_shared/devMcpCaseSearch'
import type { Reader, Row } from '../../../supabase/functions/_shared/devMcpComposites'
import { getPersonFile, type PersonFileWholeReply } from '../../../supabase/functions/_shared/devMcpPersonFile'
import { WRITE_VERBS, alreadyApplied, applyVerbFor, isWriteVerb, planHash, planReply, planVerbFor, stateGuarded, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'
import { catalogReader } from './catalogReader'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const EDGE = readFileSync('docs/EDGE_FUNCTIONS.md', 'utf8')
const HR = readFileSync('docs/HR_FILES.md', 'utf8')
const MIGRATION = readFileSync('supabase/migrations/20261113080000_person_file_numbers.sql', 'utf8')

const PERSON = '11111111-2222-4333-8444-555555555555'
const DEVUSER = '33333333-2222-4333-8444-555555555555'
const R_NEW = 'bbbbbbb1-2222-4333-8444-555555555555'
const R_OLD = 'bbbbbbb2-2222-4333-8444-555555555555'
const E1 = 'aaaaaaa1-2222-4333-8444-555555555555'
const DOC = 'ddddddd1-2222-4333-8444-555555555555'
const FILE = 'fffffff1-2222-4333-8444-555555555555'
const HASH = 'a'.repeat(64)
const dev = { role: 'dev', todayYmd: '2026-11-19' }

const item = (no: number, over: Partial<CaseItemRead> = {}): CaseItemRead & { id: string; person_id: string } => ({
  id: `item-${no}`,
  person_id: PERSON,
  item_no: no,
  title: `Item title ${no}`,
  detail: '',
  owner_label: '',
  state: 'open',
  opened_at: `2026-11-0${Math.min(no, 9)}T15:00:00Z`,
  closed_at: null,
  closed_why: null,
  author_label: 'Dev One',
  session_label: null,
  ...over,
})
const line = (id: string, at: string, words: string, over: Partial<CaseLogRead> = {}): CaseLogRead & { id: string; person_id: string } => ({ id, person_id: PERSON, logged_at: at, line: words, item_no: null, author_label: 'Dev One', session_label: null, ...over })

/** A plain reader over tables: the filters the reads use, an order on one column, and a refusal for a table it does not hold. */
function tableReader(tables: Record<string, Row[]>, rpc: Record<string, unknown> = {}): Reader & { asked: string[] } {
  const asked: string[] = []
  return {
    asked,
    rpc: async (name) => {
      asked.push(`rpc:${name}`)
      if (!(name in rpc)) throw new Error(`rpc ${name} is not in the fixture`)
      return rpc[name]
    },
    rows: async (table, q) => {
      asked.push(`rows:${table}`)
      if (!(table in tables)) throw new Error(`relation "${table}" does not exist`)
      let out = [...tables[table]!]
      for (const f of q.filters ?? []) {
        if (f.op === 'eq') out = out.filter((r) => r[f.column] === f.value)
        else if (f.op === 'in') out = out.filter((r) => (f.value as unknown[]).includes(r[f.column]))
        else if (f.op === 'is') out = out.filter((r) => r[f.column] === f.value)
        else if (f.op === 'gt') out = out.filter((r) => String(r[f.column]) > String(f.value))
      }
      const by = q.order?.[0]
      if (by) out.sort((a, b) => (String(a[by.column]) < String(b[by.column]) ? -1 : String(a[by.column]) > String(b[by.column]) ? 1 : 0) * (by.ascending === false ? -1 : 1))
      return out.slice(0, q.limit ?? 50)
    },
  }
}

describe('plan_case → apply_case: the input becomes dev_case_write\'s payload', () => {
  const full = {
    case: {
      person_id: PERSON.toUpperCase(),
      session: '  the Tuesday session  ',
      items: [
        { add: { title: '  Ask for the gate log  ', detail: 'The week of March 30.', owner: ' Dev One ' } },
        { add: { title: 'Carried over', item_no: 12 } },
        { item_no: 3, set: { owner: '', detail: '' } },
        { item_no: 4, close: { why: ' The log came in. ' } },
        { item_no: 5, close: { why: 'No longer needed.', state: 'dropped' } },
        { item_no: 6, reopen: true },
      ],
      log: ['  Read the file whole.  ', { line: 'Asked the yard.', item_no: 3 }, { line: 'No item on this one.' }],
    },
  }

  it('trims what the door trims, defaults a close to done, and names the person as the target', () => {
    const built = caseInput('plan_case', full)
    if (!built.ok) throw new Error(built.error)
    expect(built).toMatchObject({ target: PERSON, changes: 6, lines: 3 })
    expect(built.p).toEqual({
      person_id: PERSON,
      session: 'the Tuesday session',
      items: [
        { add: { title: 'Ask for the gate log', detail: 'The week of March 30.', owner: 'Dev One' } },
        { add: { title: 'Carried over', item_no: 12 } },
        // An empty owner is nobody now and an empty detail clears it: both are values, not missing keys.
        { item_no: 3, set: { owner: '', detail: '' } },
        { item_no: 4, close: { why: 'The log came in.', state: 'done' } },
        { item_no: 5, close: { why: 'No longer needed.', state: 'dropped' } },
        { item_no: 6, reopen: true },
      ],
      log: ['Read the file whole.', { line: 'Asked the yard.', item_no: 3 }, 'No item on this one.'],
    })
    // A log line alone is a call; so is one change alone.
    expect(caseInput('plan_case', { case: { person_id: PERSON, log: ['One line.'] } })).toMatchObject({ ok: true, p: { person_id: PERSON, log: ['One line.'] }, changes: 0, lines: 1 })
    expect(caseInput('plan_case', { case: { person_id: PERSON, items: [{ item_no: 2, reopen: true }] } })).toMatchObject({ ok: true, changes: 1, lines: 0 })
  })

  it('refuses in words what the door would refuse, and what it would cut short without saying', () => {
    const bad = (c: unknown, words: string) => {
      const r = caseInput('plan_case', { case: c })
      expect(r.ok, words).toBe(false)
      if (!r.ok) expect(r.error, words).toContain(words)
    }
    expect(caseInput('plan_case', {})).toMatchObject({ ok: false })
    bad({ person_id: 'Pat Doe', log: ['x'] }, 'plan_case needs case')
    // Found on the live walk of 0.118.0: find_person answers a login's users.id, and the door wants the roster row's id. The shape says so.
    expect(caseInput('plan_case', {})).toMatchObject({ ok: false, error: expect.stringContaining("find_person answers a login's users.id, which this door refuses") })
    bad({ person_id: PERSON }, 'nothing to write')
    bad({ person_id: PERSON, items: 'one' }, 'items and log are lists')
    bad({ person_id: PERSON, items: Array.from({ length: CASE_CHANGES_MAX + 1 }, (_, i) => ({ item_no: i + 1, reopen: true })) }, 'at most 50 item changes')
    bad({ person_id: PERSON, items: [{ add: { title: '  ' } }] }, 'items[0].add needs a title')
    bad({ person_id: PERSON, items: [{ add: { title: 'x'.repeat(201) } }] }, 'items[0].add needs a title')
    // A number for a new item goes inside add, so a change is never read as a change to another item.
    bad({ person_id: PERSON, items: [{ item_no: 7, add: { title: 'A new one' } }] }, "a new item's number goes inside add")
    bad({ person_id: PERSON, items: [{ item_no: 7, set: { owner: 'A' }, close: { why: 'Done.' } }] }, 'names set and close of add, set, close, reopen')
    bad({ person_id: PERSON, items: [{ item_no: 7 }] }, 'names none of add, set, close, reopen')
    bad({ person_id: PERSON, items: [{ item_no: 7, set: {} }] }, 'set names a title, a detail or an owner')
    bad({ person_id: PERSON, items: [{ item_no: 7, close: { why: '' } }] }, 'close needs why')
    bad({ person_id: PERSON, items: [{ item_no: 7, close: { why: 'Done.', state: 'open' } }] }, 'close.state is done or dropped')
    bad({ person_id: PERSON, items: [{ item_no: 7, reopen: false }] }, 'reopen is true')
    for (const no of [0, 1.5, '7', 1000000]) bad({ person_id: PERSON, items: [{ item_no: no, reopen: true }] }, 'names its item by item_no')
    // The door keeps the first 120 characters of an owner and of a session. The seat says so instead.
    bad({ person_id: PERSON, items: [{ add: { title: 'A', owner: 'x'.repeat(CASE_OWNER_MAX + 1) } }] }, 'add.owner is a name, under 120')
    bad({ person_id: PERSON, session: 'x'.repeat(121), log: ['x'] }, 'session is a name, under 120')
    bad({ person_id: PERSON, items: [{ add: { title: 'A', item_no: 9 } }, { add: { title: 'B', item_no: 9 } }] }, 'two new items are given the number 9')
    bad({ person_id: PERSON, log: ['   '] }, 'log[0] is 1 to 1000 characters')
    bad({ person_id: PERSON, log: [{ line: 'x'.repeat(1001) }] }, 'log[0].line is 1 to 1000 characters')
    bad({ person_id: PERSON, log: [{ line: 'A line.', item_no: -1 }] }, 'log[0].item_no is a whole number from 1')
    bad({ person_id: PERSON, log: [7] }, 'log[0] is words, or { line, item_no? }')
  })

  it('the pair is in the grammar: one RPC, a dry run at plan, the dry run again before the write, a hash at apply', () => {
    expect(isCaseVerb('plan_case') && isCaseVerb('apply_case') && !isCaseVerb('plan_hr_entry')).toBe(true)
    expect(isWriteVerb('plan_case') && isWriteVerb('apply_case')).toBe(true)
    expect(WRITE_VERBS.plan_case).toEqual({ rpc: 'dev_case_write', step: 'plan' })
    expect(WRITE_VERBS.apply_case).toEqual({ rpc: 'dev_case_write', step: 'apply' })
    expect(planVerbFor('apply_case')).toBe('plan_case')
    expect(applyVerbFor('plan_case')).toBe('apply_case')
    const ask = { case: { person_id: PERSON, items: [{ add: { title: 'Ask for the gate log' } }] } }
    const p = { person_id: PERSON, items: [{ add: { title: 'Ask for the gate log' } }] }
    expect(writeRpcBody('plan_case', ask)).toEqual({ ok: true, rpc: 'dev_case_write', step: 'plan', body: { p, p_dry_run: true }, dryRunBody: { p, p_dry_run: true }, target: PERSON, planHash: null })
    expect(writeRpcBody('apply_case', { ...ask, plan_hash: HASH.toUpperCase() })).toEqual({ ok: true, rpc: 'dev_case_write', step: 'apply', body: { p, p_dry_run: false }, dryRunBody: { p, p_dry_run: true }, target: PERSON, planHash: HASH })
    expect(writeRpcBody('apply_case', ask)).toMatchObject({ ok: false, error: expect.stringContaining('apply_case needs plan_hash') })
    expect(writeRpcBody('plan_case', { case: { person_id: PERSON } })).toMatchObject({ ok: false, error: expect.stringContaining('nothing to write') })
    expect(String(planReply('plan_case', {}, HASH).next)).toContain('apply_case')
    // The log's one-apply rule stands for the pair, and the sentence it answers with points at the brief.
    expect(stateGuarded('apply_case')).toBe(false)
    expect(alreadyApplied('apply_case', { target: PERSON, at: '2026-11-19T20:00:00Z' })).toContain("get_case_brief's open_items and log show them")
  })

  it('the hash holds no clock: the same call against the same case hashes alike, and a line anyone added since moves it', async () => {
    const p = { person_id: PERSON, items: [{ add: { title: 'Ask for the gate log' } }] }
    const reply = { dry_run: true, person: { id: PERSON, name: 'Pat Doe' }, author_label: 'Dev One', session: null, items: [{ op: 'add', item_no: 4, before: null, after: { title: 'Ask for the gate log', owner: '', state: 'open', detail_chars: 0 } }], log: [{ line: 'Item 4 opened: Ask for the gate log', item_no: 4, from: 'the change' }], standing: { open: 3, done: 1, dropped: 0 }, log_lines: 9 }
    const planned = await planHash('plan_case', p, reply)
    // apply's dry run answers the same reply; whether the flag reads true or false is not part of the plan.
    expect(await planHash('apply_case', p, { ...reply, dry_run: false })).toBe(planned)
    expect(await planHash('apply_case', p, { ...reply, log_lines: 10 })).not.toBe(planned)
    // Another session opened an item first, so this one would take the next number: a different plan.
    expect(await planHash('apply_case', p, { ...reply, items: [{ ...reply.items[0]!, item_no: 5 }] })).not.toBe(planned)
    expect(await planHash('apply_case', { ...p, session: 'another' }, reply)).not.toBe(planned)
    // The door's reply carries no stamp and no id the run made: the migration says so, and builds it without one.
    expect(MIGRATION).toContain('The reply carries no clock and no id the run made, so a plan and')
    expect(MIGRATION).toContain("'log_lines', (SELECT count(*) FROM public.person_case_log l WHERE l.person_id = v_person));")
  })

  it('the call log keeps a change by its kind and number, never its words, and keeps the hash under the log\'s cut', () => {
    const words = 'The words of an item stay on the case.'
    const args = { case: { person_id: PERSON, session: 'the Tuesday session', items: [{ add: { title: words, detail: words.repeat(90), item_no: 12 } }, { item_no: 3, set: { title: words } }, { item_no: 4, close: { why: words } }, { item_no: 6, reopen: true }], log: [words, { line: words, item_no: 3 }] }, plan_hash: ` ${HASH.toUpperCase()} ` }
    expect(caseArgsForLog('apply_case', args)).toEqual({
      case: { person_id: PERSON, session: 'the Tuesday session', items: [{ op: 'add', item_no: 12 }, { op: 'set', item_no: 3 }, { op: 'close', item_no: 4 }, { op: 'reopen', item_no: 6 }], log_lines: 2 },
      plan_hash: HASH,
    })
    expect(JSON.stringify(caseArgsForLog('apply_case', args))).not.toContain('words of an item')
    expect(caseArgsForLog('plan_case', args)).not.toHaveProperty('plan_hash')
    // Fifty changes, each with a detail at the door's limit, still log well under 4,000 characters.
    const big = { case: { person_id: PERSON, items: Array.from({ length: 50 }, (_, i) => ({ item_no: i + 1, set: { detail: 'x'.repeat(4000) } })), log: Array.from({ length: 50 }, () => 'y'.repeat(1000)) }, plan_hash: HASH }
    const logged = JSON.stringify(caseArgsForLog('apply_case', big))
    expect(logged.length).toBeLessThan(4000)
    expect(logged).toContain(HASH)
    expect(caseArgsForLog('plan_case', {})).toEqual({ case: null })
  })
})

describe('the brief\'s two blocks (devMcpCase.ts over the tab\'s kernel)', () => {
  const items: CaseItemRead[] = [
    item(3, { detail: 'd'.repeat(BRIEF_CASE_DETAIL_CHARS + 50), owner_label: ' Dev Two ', session_label: 'the Tuesday session' }),
    item(1),
    item(2, { state: 'done', closed_at: '2026-11-10T12:00:00Z', closed_why: 'The log came in.' }),
    item(4, { state: 'dropped', closed_at: '2026-11-12T12:00:00Z', closed_why: 'No longer needed.' }),
  ]

  it('open items by number with who has them and a short detail; the closed ones, the one closed last first', () => {
    const out = briefOpenItems(items)
    expect(out.counts).toEqual({ open: 2, done: 1, dropped: 1 })
    expect(out.standing).toBe('2 open, 1 done, 1 dropped')
    expect(out.items.map((i) => i.item_no)).toEqual([1, 3])
    expect(out.items[0]).toEqual({ item_no: 1, title: 'Item title 1', with: null, opened_at: '2026-11-01T15:00:00Z', by: 'Dev One' })
    expect(out.items[1]).toMatchObject({ item_no: 3, with: 'Dev Two', detail_more: 50, session: 'the Tuesday session' })
    expect(out.items[1]!.detail).toHaveLength(BRIEF_CASE_DETAIL_CHARS + 1)
    expect(out.closed_newest).toEqual([
      { item_no: 4, title: 'Item title 4', state: 'dropped', closed_at: '2026-11-12T12:00:00Z', why: 'No longer needed.' },
      { item_no: 2, title: 'Item title 2', state: 'done', closed_at: '2026-11-10T12:00:00Z', why: 'The log came in.' },
    ])
    // The blocks carry rows alone: the manifest's part says how to cite one and which pair writes them.
    expect(out).not.toHaveProperty('note')
    expect(CASE_BLOCKS_OPEN).toContain('plan_case → apply_case changes them')
    expect(briefOpenItems([])).toEqual({ counts: { open: 0, done: 0, dropped: 0 }, standing: 'No items yet', items: [], closed_newest: [] })
  })

  it('a long brief turns the dials: the detail out with its size kept, then the first open items by number', () => {
    const noDetail = briefOpenItems(items, { detailChars: 0, openMax: null })
    expect(noDetail.items[1]).not.toHaveProperty('detail')
    expect(noDetail.items[1]).toMatchObject({ item_no: 3, detail_more: BRIEF_CASE_DETAIL_CHARS + 50 })
    const first = briefOpenItems(items, { detailChars: 0, openMax: 1 })
    expect(first.items.map((i) => i.item_no)).toEqual([1])
    expect(first.counts.open).toBe(2)
    const many = Array.from({ length: BRIEF_CASE_CLOSED + 3 }, (_, i) => item(i + 1, { state: 'done', closed_at: `2026-11-${String(i + 1).padStart(2, '0')}T12:00:00Z`, closed_why: 'Done.' }))
    expect(briefOpenItems(many).closed_newest).toHaveLength(BRIEF_CASE_CLOSED)
  })

  it('the log newest first, lines of one write in the order they were written, the count the whole log', () => {
    const lines: CaseLogRead[] = [
      line('l3', '2026-11-12T12:00:00Z', 'Item 4 dropped: No longer needed.', { item_no: 4 }),
      line('l4', '2026-11-12T12:00:00Z', 'Told the owner.', { session_label: 'the Tuesday session' }),
      line('l1', '2026-11-01T15:00:00Z', 'Item 1 opened: Item title 1', { item_no: 1 }),
    ]
    const out = briefCaseLog(lines, 14)
    expect(out.count).toBe(14)
    expect(out.newest).toEqual([
      { at: '2026-11-12T12:00:00Z', line: 'Item 4 dropped: No longer needed.', item_no: 4, by: 'Dev One' },
      { at: '2026-11-12T12:00:00Z', line: 'Told the owner.', by: 'Dev One', session: 'the Tuesday session' },
      { at: '2026-11-01T15:00:00Z', line: 'Item 1 opened: Item title 1', item_no: 1, by: 'Dev One' },
    ])
    expect(briefCaseLog(lines, 14, 1).newest).toHaveLength(1)
    expect(briefCaseLog([], null)).toEqual({ count: null, newest: [] })
  })
})

describe('an exhibit number in words', () => {
  it('reads a number off a row, and says the number a record would take and the one it took', () => {
    expect([exhibitNoOf({ exhibit_no: 41 }), exhibitNoOf({ exhibit_no: null }), exhibitNoOf({}), exhibitNoOf(null), exhibitNoOf({ exhibit_no: '41' }), exhibitNoOf({ exhibit_no: 0 })]).toEqual([41, null, null, null, null, null])
    // The key rides only on a record the file has numbered.
    expect([exhibitBits({ exhibit_no: 41 }), exhibitBits({ exhibit_no: null }), exhibitBits(undefined)]).toEqual([{ exhibit_no: 41 }, {}, {}])
    expect(exhibitPlanWords(41)).toMatchObject({ would_take: 41, label: 'Ev #41' })
    expect(String(exhibitPlanWords(41).note)).toContain('Leave the number out of the title')
    expect(exhibitPlanWords(null)).toMatchObject({ would_take: null })
    expect(exhibitAppliedWords(41)).toEqual({ exhibit_no: 41, exhibit: 'Ev #41' })
    expect(exhibitAppliedWords(null)).toMatchObject({ exhibit_no: null })
  })
})

const PEOPLE: Row[] = [{ id: PERSON, name: 'Pat Doe', kind: 'helper', start_date: '2025-02-01', end_date: null, archived_at: null, account_user_id: null }]
const record = (id: string, day: string, title: string, exhibitNo: number | null): Row => ({ id, person_id: PERSON, entry_id: null, dated_on: day, title, memo: 'A photo of the page.', created_by: DEVUSER, author_label: null, created_at: `${day}T09:00:00Z`, drive_folder_id: null, drive_folder_url: null, filed_at: null, fail_why: null, counsel_only: false, exhibit_no: exhibitNo })
/** One record the file numbered, and one from before it did: its title wears the number as typed. */
const EVIDENCE: Row[] = [record(R_NEW, '2026-11-14', 'Gate log, the week of March 30', 42), record(R_OLD, '2026-04-01', 'Ev #7 Yard camera still', null)]
const ENTRIES: Row[] = [{ id: E1, person_id: PERSON, entry_date: '2026-03-30', content: 'The truck came back at 4:10.', source: 'incident', created_by: DEVUSER, created_at: '2026-03-30T12:00:00Z', author_label: null }]
const CASE_ITEMS: Row[] = [item(1, { detail: 'Ask the yard for the page.' }), item(2, { state: 'done', closed_at: '2026-11-10T12:00:00Z', closed_why: 'The log came in.' })]
const CASE_LOG: Row[] = [line('l1', '2026-11-01T15:00:00Z', 'Item 1 opened: Item title 1', { item_no: 1 }), line('l2', '2026-11-10T12:00:00Z', 'Item 2 done: The log came in.', { item_no: 2 })]

describe('get_person_file carries the number (0.118.0)', () => {
  const data = () => ({ people: PEOPLE, person_file_entries: ENTRIES, person_file_evidence: EVIDENCE })

  it('every read is one the door accepts; a record and its Timeline line carry exhibit_no, and a record with no number carries no key', async () => {
    const reader = catalogReader({ rows: data() })
    const out = (await getPersonFile(reader, { person: PERSON }, dev)) as PersonFileWholeReply
    expect('refused' in out).toBe(false)
    expect(out.evidence.map((r) => [r.id, r.exhibit_no])).toEqual([[R_NEW, 42], [R_OLD, undefined]])
    expect(out.evidence[1]).not.toHaveProperty('exhibit_no')
    const lines = out.months.flatMap((m) => m.lines)
    const newLine = lines.find((l) => l.ref.table === 'person_file_evidence' && l.ref.id === R_NEW)
    const oldLine = lines.find((l) => l.ref.table === 'person_file_evidence' && l.ref.id === R_OLD)
    expect(newLine?.exhibit_no).toBe(42)
    expect(oldLine && 'exhibit_no' in oldLine).toBe(false)
    // An entry's line gains nothing.
    expect(lines.find((l) => l.ref.table === 'person_file_entries') ?? {}).not.toHaveProperty('exhibit_no')
    expect(out.evidence_note).toContain('cite the record as Ev #N')
  })

  it('brief keeps the key on the short line and on the short record; another role reads no record', async () => {
    const out = await getPersonFile(catalogReader({ rows: data() }), { person: PERSON, brief: true }, dev)
    if ('refused' in out) throw new Error(out.refused)
    const short = out.months.flatMap((m) => m.lines).find((l) => 'row' in l && l.row === `person_file_evidence:${R_NEW}`)
    expect(short).toMatchObject({ exhibit_no: 42 })
    expect(out.evidence[0]).toMatchObject({ id: R_NEW, exhibit_no: 42 })
    const office = await getPersonFile(catalogReader({ rows: data() }), { person: PERSON }, { role: 'assistant', todayYmd: '2026-11-19' })
    if ('refused' in office) throw new Error(office.refused)
    expect(office.evidence).toEqual([])
    expect(office.evidence_note).toBe('dev only')
  })
})

describe('get_case_brief carries the numbers, the open items and the log (0.118.0)', () => {
  const tables = (): Record<string, Row[]> => ({
    people: PEOPLE,
    person_file_entries: ENTRIES,
    person_file_evidence: EVIDENCE,
    person_file_index: [],
    person_document_index: [],
    legal_matters: [],
    legal_theme_marks: [],
    legal_themes: [],
    person_file_amendments: [],
    person_case_items: CASE_ITEMS,
    person_case_log: CASE_LOG,
    person_engagements: [],
  })

  it('the selects are ones the door accepts', async () => {
    const reader = catalogReader({ rows: {} })
    await expect(reader.rows('person_case_items', { select: CASE_ITEM_SELECT, filters: [{ column: 'person_id', op: 'eq', value: PERSON }] })).resolves.toEqual([])
    await expect(reader.rows('person_case_log', { select: CASE_LOG_SELECT, filters: [{ column: 'person_id', op: 'eq', value: PERSON }], order: [{ column: 'logged_at', ascending: false }], limit: 10 })).resolves.toEqual([])
    await expect(reader.rows('person_file_evidence', { select: 'id,exhibit_no', filters: [{ column: 'id', op: 'eq', value: R_NEW }], limit: 1 })).resolves.toEqual([])
    await expect(reader.rpc('person_file_next_exhibit_no', { p_person_id: PERSON })).resolves.toEqual([])
  })

  it('an evidence record carries its number; open_items and log read the case; the manifest counts them and names the door', async () => {
    const out = await getCaseBrief(tableReader(tables()), { person: PERSON }, dev)
    if ('refused' in out) throw new Error(out.refused)
    expect(out.evidence.map((r) => [r.id, r.exhibit_no])).toEqual([[R_NEW, 42], [R_OLD, undefined]])
    // The manifest says how many records the file has numbered, so a record with no key reads as not numbered yet.
    expect(out.manifest.parts.find((p) => p.part === 'evidence')).toMatchObject({ count: 2, numbered: 1 })
    expect(out.open_items).toMatchObject({ counts: { open: 1, done: 1, dropped: 0 }, standing: '1 open, 1 done' })
    expect(out.open_items?.items).toEqual([{ item_no: 1, title: 'Item title 1', with: null, opened_at: '2026-11-01T15:00:00Z', detail: 'Ask the yard for the page.', by: 'Dev One' }])
    expect(out.open_items?.closed_newest.map((i) => i.item_no)).toEqual([2])
    expect(out.log?.count).toBe(2)
    expect(out.log?.newest.map((l) => l.line)).toEqual(['Item 2 done: The log came in.', 'Item 1 opened: Item title 1'])
    const part = out.manifest.parts.find((p) => p.part === 'case_items')
    expect(part).toMatchObject({ count: 2, open_items: 1, log_lines: 2 })
    expect(String(part?.open)).toContain('plan_case → apply_case changes them')
    expect(String(out.manifest.parts.find((p) => p.part === 'evidence')?.open)).toContain('cite it as Ev #N')
    expect(out.held).toEqual([])
  })

  it('a case that cannot be read is held by name, its blocks are null and the rest still draws; another role reads neither', async () => {
    const without = tables()
    delete without.person_case_items
    delete without.person_case_log
    const out = await getCaseBrief(tableReader(without), { person: PERSON }, dev)
    if ('refused' in out) throw new Error(out.refused)
    // Both are named, in whichever order the two reads came back.
    expect(out.held).toHaveLength(2)
    expect(out.held).toEqual(expect.arrayContaining([
      { source: 'case items', reason: 'relation "person_case_items" does not exist' },
      { source: 'case log', reason: 'relation "person_case_log" does not exist' },
    ]))
    expect(out.open_items).toBeNull()
    expect(out.log).toBeNull()
    expect(out.evidence).toHaveLength(2)
    expect(out.manifest.parts.find((p) => p.part === 'case_items')).toMatchObject({ count: null, held: 'relation "person_case_items" does not exist' })
    const office = await getCaseBrief(tableReader(tables()), { person: PERSON }, { role: 'assistant', todayYmd: '2026-11-19' })
    if ('refused' in office) throw new Error(office.refused)
    expect(office.open_items).toBeNull()
    expect(office.log).toBeNull()
    expect(office.held).toEqual(expect.arrayContaining([{ source: 'case items', reason: 'dev only' }, { source: 'case log', reason: 'dev only' }]))
  })

  it('a brief too long for the door leaves an item\'s detail out before it shortens a list another verb reads', async () => {
    const many = Array.from({ length: 900 }, (_, i) => record(`r-${String(i).padStart(4, '0')}`, '2026-05-01', `A record with a title long enough to fill the reply, number ${i} of the made-up nine hundred`, i + 1))
    const out = await getCaseBrief(tableReader({ ...tables(), person_file_evidence: many }), { person: PERSON }, dev)
    if ('refused' in out) throw new Error(out.refused)
    expect(JSON.stringify(out).length).toBeLessThan(80000)
    const blocks = (out.shortened?.blocks ?? []).map((b) => b.block)
    expect(blocks).toEqual(expect.arrayContaining(['open_items.detail', 'evidence']))
    expect(blocks.indexOf('open_items.detail')).toBeLessThan(blocks.indexOf('evidence'))
    expect(out.open_items?.items[0]).not.toHaveProperty('detail')
    expect(out.open_items?.items[0]).toMatchObject({ item_no: 1, detail_more: 'Ask the yard for the page.'.length })
    // The manifest still counts every record.
    expect(out.manifest.parts.find((p) => p.part === 'evidence')).toMatchObject({ count: 900 })
  })
})

describe('search_case names the number of each record a hit names (0.118.0)', () => {
  const hits = [
    { source: 'evidence', id: R_NEW, title: 'Gate log, the week of March 30', section_n: null, section: null, day: '2026-11-14', counsel_only: false, rank: 0.4, snippet: 'The «gate» log.' },
    { source: 'evidence', id: R_OLD, title: 'Ev #7 Yard camera still', section_n: null, section: null, day: '2026-04-01', counsel_only: false, rank: 0.3, snippet: 'The «gate» at 5:10.' },
    { source: 'file', id: FILE, title: 'gate-log.pdf', section_n: null, section: null, day: '2026-11-14', counsel_only: false, rank: 0.2, snippet: 'the «gate»', record_kind: 'evidence', record_id: R_NEW, record_title: 'Gate log, the week of March 30' },
    { source: 'document', id: DOC, title: 'Transcript of the call', section_n: 2, section: 'The gate', day: null, counsel_only: false, rank: 0.2, snippet: 'at the «gate»' },
    { source: 'entry', id: E1, title: null, section_n: null, section: null, day: '2026-03-30', counsel_only: false, rank: 0.1, snippet: 'the «gate»' },
  ]
  const rpcReply = { q: 'gate', query: "'gate'", in: null, person_id: PERSON, matter_id: null, count: hits.length, shown: hits.length, hits }
  const tables = (): Record<string, Row[]> => ({ people: PEOPLE, person_file_evidence: EVIDENCE, person_file_amendments: [], person_document_index: [{ id: DOC, person_id: PERSON, evidence_id: R_NEW }] })

  it('an evidence hit, a file hit and a transcript each carry the record\'s number; an entry hit gains nothing', async () => {
    const out = await searchCase(tableReader(tables(), { dev_case_search: rpcReply }), { person: PERSON, q: 'gate' }, { role: 'dev' })
    if ('refused' in out) throw new Error(out.refused)
    const by = (id: string) => out.hits.find((h) => h.id === id) as Record<string, unknown>
    expect(by(R_NEW)).toMatchObject({ exhibit_no: 42 })
    // A record from before the file numbered them gains no key.
    expect(by(R_OLD)).not.toHaveProperty('exhibit_no')
    expect(by(FILE)).toMatchObject({ record_exhibit_no: 42 })
    expect(by(FILE)).not.toHaveProperty('exhibit_no')
    expect(by(DOC)).toMatchObject({ evidence_id: R_NEW, evidence_exhibit_no: 42 })
    expect(by(E1)).not.toHaveProperty('exhibit_no')
    expect(out.note).toContain('record_exhibit_no')
  })

  it('a refused read of the numbers leaves the hits as the search answered', async () => {
    const refusing = tableReader(tables(), { dev_case_search: rpcReply })
    const base = refusing.rows
    refusing.rows = async (table, q) => {
      if (table === 'person_file_evidence' && String(q.select).includes('exhibit_no')) throw new Error('permission denied for table person_file_evidence')
      return base(table, q)
    }
    const out = await searchCase(refusing, { person: PERSON, q: 'gate' }, { role: 'dev' })
    if ('refused' in out) throw new Error(out.refused)
    for (const h of out.hits) {
      expect(h, h.id).not.toHaveProperty('exhibit_no')
      expect(h, h.id).not.toHaveProperty('record_exhibit_no')
      expect(h, h.id).not.toHaveProperty('evidence_exhibit_no')
    }
    expect(out.hits).toHaveLength(hits.length)
  })
})

describe('the seat, its docs and the migration carry the pair and the reads', () => {
  it('the server wires both verbs to the one door and names the number on an evidence plan and apply', () => {
    for (const v of ['plan_case', 'apply_case']) {
      expect(SERVER).toContain(`case '${v}':`)
      expect(SERVER).toContain(`name: '${v}',`)
    }
    expect(SERVER).toContain("const SERVER_VERSION = '0.135.0'")
    expect(SERVER).toContain('plan_case → apply_case (a person\'s case: its open items, each numbered by the file')
    expect(SERVER).toContain("exhibit: exhibitPlanWords(await nextExhibitNo(session, String(built.target)))")
    expect(SERVER).toContain("readerAs(jwt).rpc('person_file_next_exhibit_no', { p_person_id: personId })")
    expect(SERVER).toContain('if (isCaseVerb(name)) return caseArgsForLog(name, args)')
    // The number is read over GET, as every read is: the pair adds no POST of its own to the seat.
    expect(SERVER).not.toContain("restPost(session, 'rpc/person_file_next_exhibit_no'")
    expect(MIGRATION).toContain('CREATE OR REPLACE FUNCTION public.dev_case_write(p jsonb, p_dry_run boolean DEFAULT true)')
    expect(MIGRATION).toContain('GRANT EXECUTE ON FUNCTION public.dev_case_write(jsonb, boolean) TO authenticated;')
    expect(MIGRATION).toContain('CREATE OR REPLACE FUNCTION public.person_file_next_exhibit_no(p_person_id uuid)')
  })

  it('the README, the function reference and the HR reference say what the seat reads and writes', () => {
    expect(README).toContain('`plan_case(case)` · `apply_case(case, plan_hash)`')
    expect(README).toContain("one hundred and forty-nine since v2.7976's case pair")
    expect(README).toContain('a case\'s items and log v2.7976 / 0.118.0')
    expect(README).toContain('`open_items`')
    expect(EDGE).toContain('**v2.7976 (server 0.118.0)')
    expect(HR).toContain('`plan_case` → `apply_case`')
  })
})
