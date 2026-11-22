import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  PAPER_WORDS_BODY_MAX,
  PAPER_WORDS_LIVE_TITLES,
  PAPER_WORDS_SHOWN,
  PAPER_WORDS_VERBS,
  bookEntryRow,
  draftChanges,
  draftLeaves,
  isLiveTitle,
  isPaperWordsVerb,
  paperWordsAppliedWords,
  paperWordsArgsForLog,
  paperWordsDryRun,
  paperWordsInput,
  readPaperWordsWorld,
  walkedDraftProblems,
  type PaperWordsPayload,
  type PaperWordsWorld,
} from '../../../supabase/functions/_shared/devMcpPaperWords'
import type { Reader, Row, RowsQuery } from '../../../supabase/functions/_shared/devMcpComposites'
import { WRITE_VERBS, alreadyApplied, isWriteVerb, planHash, planVerbFor, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'
import { CATALOG_TABLES } from '../../../supabase/functions/dev-mcp/catalog'
import { parsePaperDef } from '../documentBuilder/definition'
import { SECRECY_PAPER_FIXTURE } from '../documentBuilder/secrecyPaper.fixture'
import { GC_MASTER_AGREEMENT_TITLE } from '../gc/papersIo'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const NOTES = readFileSync('docs/dev-mcp/SERVER_NOTES.md', 'utf8')
const BOOK = readFileSync('src/components/contracts/ContractBookModal.tsx', 'utf8')
const SHEETS_IO = readFileSync('src/lib/documentBuilder/sheetsIo.ts', 'utf8')

const HASH = 'a'.repeat(64)
const PACKET = 'cccccccc-1111-4111-8111-111111111111'

/** A made-up paper someone walks: two levels, one topic. Every word here is invented. */
const draft = (over: Record<string, unknown> = {}) => ({
  title: 'Made-up Paper',
  levels: [
    { id: 'low', name: 'Low', alignedWith: 'Aligned with a made-up place' },
    { id: 'high', name: 'High', alignedWith: 'Aligned with another made-up place' },
  ],
  topics: [{ key: 'gate', label: 'The gate', levels: { low: { says: 'Sign in at the gate.', breach: ['Not signing in.'], site: [] }, high: { says: 'Show a badge at the gate.', breach: ['Having no badge.'], site: ['A staffed gate.'] } } }],
  ...over,
})

const builderWorld = (over: Partial<Extract<PaperWordsWorld, { on: 'builder' }>['builder']> = {}): PaperWordsWorld => ({
  on: 'builder',
  builder: { key: 'sub-nda', kind: 'walked', draft: draft(), draftNo: 7, revision: 0, ...over },
})
const bookWorld = (entries: { name: string; audience: string | null }[] = [{ name: 'W-9', audience: 'sub' }]): PaperWordsWorld => ({ on: 'book', packet: { id: PACKET, name: 'Subs' }, entries, nextOrder: 6 })

const builderP = (d: Record<string, unknown> = draft({ title: 'Made-up Paper, second draft' })): PaperWordsPayload => {
  const built = paperWordsInput('plan_paper_words', { words: { into: 'builder', builder: 'sub-nda', draft: d } })
  if (!built.ok) throw new Error(built.error)
  return built.p
}
const bookP = (over: Record<string, unknown> = {}): Extract<PaperWordsPayload, { action: 'book_entry' }> => {
  const built = paperWordsInput('plan_paper_words', { words: { into: 'book', packet: 'Subs', title: 'A made-up agreement (draft)', audience: 'sub', format: 'markdown', body: '# A made-up agreement\n\n**THIS LINE STANDS OUT.**', ...over } })
  if (!built.ok) throw new Error(built.error)
  return built.p as Extract<PaperWordsPayload, { action: 'book_entry' }>
}

const fakeReader = (tables: Record<string, Row[]>): { reader: Reader; asked: { table: string; query: RowsQuery }[] } => {
  const asked: { table: string; query: RowsQuery }[] = []
  const reader: Reader = {
    rpc: async () => null,
    rows: async (table, query) => {
      asked.push({ table, query })
      return (tables[table] ?? []).filter((row) => (query.filters ?? []).every((f) => (f.op === 'ilike' ? String(row[f.column]).toLowerCase() === String(f.value).toLowerCase() : row[f.column] === f.value)))
    },
  }
  return { reader, asked }
}

describe('devMcpPaperWords — the verbs on the allowlist', () => {
  it('are two write verbs with no RPC, plan before apply, and the server and the docs name both', () => {
    expect(PAPER_WORDS_VERBS).toEqual(['plan_paper_words', 'apply_paper_words'])
    for (const verb of PAPER_WORDS_VERBS) {
      expect(isPaperWordsVerb(verb)).toBe(true)
      expect(isWriteVerb(verb)).toBe(true)
      expect(WRITE_VERBS[verb].rpc).toBeNull()
      expect(SERVER).toContain(`name: '${verb}'`)
      expect(SERVER).toContain(`case '${verb}':`)
      expect(README).toContain(verb)
    }
    expect(WRITE_VERBS.plan_paper_words.step).toBe('plan')
    expect(WRITE_VERBS.apply_paper_words.step).toBe('apply')
    expect(planVerbFor('apply_paper_words')).toBe('plan_paper_words')
    expect(isPaperWordsVerb('plan_paper')).toBe(false)
    expect(NOTES).toContain('0.125.0 (v2.8257;')
  })

  it('reads and writes tables the catalog lists', () => {
    for (const table of ['document_builders', 'contract_templates', 'contract_template_documents']) expect(Object.keys(CATALOG_TABLES)).toContain(table)
  })
})

describe('devMcpPaperWords — the input', () => {
  it('takes a builder draft or a Book entry, and nothing else', () => {
    expect(paperWordsInput('plan_paper_words', { words: { into: 'builder', builder: ' sub-nda ', draft: draft() } })).toMatchObject({ ok: true, target: 'sub-nda', planHash: null, p: { action: 'builder_draft', builder: 'sub-nda' } })
    expect(paperWordsInput('plan_paper_words', { words: { into: 'book', packet: 'Subs', title: ' A paper (draft) ', audience: 'sub', format: 'plain', body: ' The words.\r\nMore words. ' } })).toMatchObject({
      ok: true,
      target: 'A paper (draft)',
      p: { action: 'book_entry', packet: 'Subs', title: 'A paper (draft)', audience: 'sub', format: 'plain', body: 'The words.\nMore words.', version_date: null },
    })
    for (const bad of [{}, { words: null }, { words: { into: 'email' } }, { words: { into: 'builder', builder: 'Sub NDA', draft: {} } }, { words: { into: 'builder', builder: 'sub-nda', draft: [] } }, { words: { into: 'builder', builder: 'sub-nda' } }])
      expect(paperWordsInput('plan_paper_words', bad).ok).toBe(false)
  })

  it('holds a Book entry to markdown or plain words, a known audience, and words that fit', () => {
    const entry = (over: Record<string, unknown>) => paperWordsInput('plan_paper_words', { words: { into: 'book', packet: 'Subs', title: 'A paper (draft)', audience: 'sub', format: 'markdown', body: 'Words.', ...over } })
    expect(entry({}).ok).toBe(true)
    const html = entry({ format: 'html' })
    expect(html.ok).toBe(false)
    expect(html.ok ? '' : html.error).toContain("cannot run the app's HTML cleaner")
    expect(entry({ audience: 'everyone' }).ok).toBe(false)
    expect(entry({ body: '   ' }).ok).toBe(false)
    expect(entry({ body: 'x'.repeat(PAPER_WORDS_BODY_MAX + 1) }).ok).toBe(false)
    expect(entry({ packet: '' }).ok).toBe(false)
    expect(entry({ version_date: 'soon' }).ok).toBe(false)
    expect(entry({ version_date: '2026-11-21' })).toMatchObject({ ok: true, p: { version_date: '2026-11-21' } })
  })

  it('refuses the entry name that GC mode sends the moment it exists', () => {
    // The seat's list and the app's own constant are the same name: a rename there must be made here too.
    expect(PAPER_WORDS_LIVE_TITLES).toContain(GC_MASTER_AGREEMENT_TITLE)
    for (const title of [GC_MASTER_AGREEMENT_TITLE, ` ${GC_MASTER_AGREEMENT_TITLE.toUpperCase()} `]) {
      expect(isLiveTitle(title)).toBe(true)
      const r = paperWordsInput('plan_paper_words', { words: { into: 'book', packet: 'Subs', title, audience: 'sub', format: 'markdown', body: 'Words.' } })
      expect(r.ok).toBe(false)
      expect(r.ok ? '' : r.error).toContain('The seat does not make one.')
      expect(r.ok ? '' : r.error).toContain('(draft)')
    }
    expect(isLiveTitle(`${GC_MASTER_AGREEMENT_TITLE} (draft)`)).toBe(false)
  })

  it('needs the plan hash to apply, and writeRpcBody hands both steps on with no RPC', () => {
    expect(paperWordsInput('apply_paper_words', { words: { into: 'builder', builder: 'sub-nda', draft: draft() } }).ok).toBe(false)
    expect(paperWordsInput('apply_paper_words', { words: { into: 'builder', builder: 'sub-nda', draft: draft() }, plan_hash: HASH.toUpperCase() })).toMatchObject({ ok: true, planHash: HASH })
    const plan = writeRpcBody('plan_paper_words', { words: { into: 'builder', builder: 'sub-nda', draft: draft() } })
    expect(plan).toMatchObject({ ok: true, rpc: null, step: 'plan', dryRunBody: null, target: 'sub-nda' })
    const apply = writeRpcBody('apply_paper_words', { words: { into: 'builder', builder: 'sub-nda', draft: draft() }, plan_hash: HASH })
    expect(apply).toMatchObject({ ok: true, rpc: null, step: 'apply', planHash: HASH })
  })
})

describe('devMcpPaperWords — telling two drafts apart', () => {
  it('lists every leaf by its path', () => {
    expect([...draftLeaves({ a: 'x', b: [1, { c: true }], d: {}, e: [] })]).toEqual([
      ['a', 'x'],
      ['b[0]', '1'],
      ['b[1].c', 'true'],
      ['d', '{}'],
      ['e', '[]'],
    ])
  })

  it('counts what changed, what is new and what went, and shows the first lines', () => {
    const was = draft()
    const now = draft({ title: 'Made-up Paper, second draft', topics: [{ key: 'gate', label: 'The gate', levels: { low: { says: 'Sign in at the gate.', breach: ['Not signing in.', 'Signing in for someone else.'], site: [] }, high: { says: 'Show a badge at the gate.', breach: [], site: ['A staffed gate.'] } } }] })
    const c = draftChanges(was, now)
    expect([c.changed, c.added, c.removed]).toEqual([1, 2, 1])
    expect(c.first.map((x) => x.at)).toEqual(['title', 'topics[0].levels.high.breach', 'topics[0].levels.low.breach[1]', 'topics[0].levels.high.breach[0]'])
    expect(c.first[0]).toEqual({ at: 'title', was: 'Made-up Paper', now: 'Made-up Paper, second draft' })
    expect(draftChanges(was, was)).toMatchObject({ changed: 0, added: 0, removed: 0 })
  })

  it('shows no more than the first twelve lines, with the count whole', () => {
    const many = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`k${String(i).padStart(2, '0')}`, `v${i}`]))
    const c = draftChanges({}, many)
    expect(c.added).toBe(30)
    expect(c.first).toHaveLength(PAPER_WORDS_SHOWN)
  })
})

describe('devMcpPaperWords — a paper someone walks', () => {
  it('passes a draft the tab itself can draw: the made-up Sub NDA', () => {
    expect(parsePaperDef(SECRECY_PAPER_FIXTURE).ok).toBe(true)
    expect(walkedDraftProblems(SECRECY_PAPER_FIXTURE as unknown as Record<string, unknown>)).toEqual([])
    expect(walkedDraftProblems(draft())).toEqual([])
  })

  it('names what is missing', () => {
    expect(walkedDraftProblems({})).toEqual(['title is missing.', 'levels is missing: a list of { id, name, alignedWith }.', 'topics is missing: a list of { key, label, levels }.'])
    const noLine = draft({ topics: [{ key: 'gate', label: 'The gate', levels: { low: { says: 'Sign in.', breach: [], site: [] } } }] })
    expect(walkedDraftProblems(noLine)).toEqual(['topics[0] (gate) has no line for the level high.'])
  })
})

describe('devMcpPaperWords — the reads', () => {
  it('reads the builder by its key, with its draft number', async () => {
    const { reader, asked } = fakeReader({ document_builders: [{ key: 'sub-nda', kind: 'walked', draft: draft(), draft_no: 7, revision: 2 }] })
    const world = await readPaperWordsWorld(reader, builderP())
    expect(world).toMatchObject({ on: 'builder', builder: { key: 'sub-nda', kind: 'walked', draftNo: 7, revision: 2 } })
    expect(asked[0]?.table).toBe('document_builders')
  })

  it('says a builder with no row must be loaded in the tab first', async () => {
    const { reader } = fakeReader({ document_builders: [] })
    const world = await readPaperWordsWorld(reader, builderP())
    expect('refused' in world ? world.refused : '').toContain('Load the first draft')
  })

  it('finds the packet by name or id, and reads what it holds and the next place in it', async () => {
    const tables = {
      contract_templates: [{ id: PACKET, name: 'Subs' }, { id: 'dddddddd-1111-4111-8111-111111111111', name: 'Lien waivers' }],
      contract_template_documents: [{ template_id: PACKET, document_name: 'W-9', audience: 'sub', sequence_order: 3 }, { template_id: PACKET, document_name: 'General Conditions', audience: 'sub', sequence_order: 2 }],
    }
    for (const packet of ['subs', PACKET]) {
      const world = await readPaperWordsWorld(fakeReader(tables).reader, bookP({ packet }))
      expect(world).toMatchObject({ on: 'book', packet: { id: PACKET, name: 'Subs' }, nextOrder: 4 })
    }
    const none = await readPaperWordsWorld(fakeReader(tables).reader, bookP({ packet: 'Nowhere' }))
    expect('refused' in none ? none.refused : '').toContain('No packet "Nowhere"')
  })
})

describe('devMcpPaperWords — the plan', () => {
  it('shows where a builder draft differs and what it will not do, and never repeats the draft', () => {
    const dry = paperWordsDryRun(builderP(), builderWorld())
    expect(dry.ok).toBe(true)
    const reply = dry.ok ? dry.reply : {}
    expect(reply).toMatchObject({ action: 'builder_draft', builder: { key: 'sub-nda', draft_no: 7, published_revision: 0 }, changes: { changed: 1, added: 0, removed: 0 }, writes: { table: 'document_builders', where: { key: 'sub-nda', draft_no: 7 } } })
    expect(JSON.stringify(reply)).not.toContain('Show a badge at the gate.')
    expect((reply.not_done as string[]).join(' ')).toContain('Publish is a press in the app')
    expect((reply.not_done as string[]).join(' ')).toContain('It holds no clause wording')
  })

  it('says a published revision stays as it is', () => {
    const dry = paperWordsDryRun(builderP(), builderWorld({ revision: 3 }))
    expect(dry.ok && (dry.reply.not_done as string[])[0]).toContain('revision 3 stays published as it is')
  })

  it('refuses a draft the tab could not draw, and a draft that changes nothing', () => {
    const broken = paperWordsDryRun(builderP({ title: 'No levels' }), builderWorld())
    expect(broken.ok ? '' : broken.refused).toContain('The tab could not draw this draft of sub-nda')
    const same = paperWordsDryRun(builderP(draft()), builderWorld())
    expect(same.ok ? '' : same.refused).toContain('Nothing to write')
    // A page with blanks is not held to a walked paper's shape.
    expect(paperWordsDryRun(builderP({ fields: { co: 'Acme' } }), builderWorld({ kind: 'filled', draft: { fields: {} } })).ok).toBe(true)
  })

  it('counts a Book entry\'s words, lists what the packet holds, and warns that an entry is live at once', () => {
    const dry = paperWordsDryRun(bookP(), bookWorld())
    expect(dry.ok).toBe(true)
    const reply = dry.ok ? dry.reply : {}
    expect(reply).toMatchObject({ action: 'book_entry', packet: { id: PACKET, name: 'Subs' }, entry: { title: 'A made-up agreement (draft)', audience: 'sub', format: 'markdown', lines: 3 }, beside: ['W-9 (sub)'] })
    expect(JSON.stringify(reply)).not.toContain('THIS LINE STANDS OUT')
    expect((reply.heed as string[])[0]).toContain('has no draft state')
  })

  it('never changes an entry that exists', () => {
    const dry = paperWordsDryRun(bookP({ title: 'w-9' }), bookWorld())
    expect(dry.ok ? '' : dry.refused).toContain('The seat never changes an entry that exists')
  })

  it('commits to the words and to the row as the plan read it', async () => {
    const first = paperWordsDryRun(builderP(), builderWorld())
    const moved = paperWordsDryRun(builderP(), builderWorld({ draftNo: 8 }))
    const other = paperWordsDryRun(builderP(draft({ title: 'Another title' })), builderWorld())
    if (!first.ok || !moved.ok || !other.ok) throw new Error('a plan was refused')
    const h = await planHash('plan_paper_words', builderP(), first.reply)
    expect(await planHash('plan_paper_words', builderP(), first.reply)).toBe(h)
    expect(await planHash('plan_paper_words', builderP(), moved.reply)).not.toBe(h)
    expect(await planHash('plan_paper_words', builderP(draft({ title: 'Another title' })), other.reply)).not.toBe(h)
    // Two Book entries with the same counts and different words hash apart: the words are in the payload.
    const a = paperWordsDryRun(bookP({ body: 'One.' }), bookWorld())
    const b = paperWordsDryRun(bookP({ body: 'Two.' }), bookWorld())
    if (!a.ok || !b.ok) throw new Error('a plan was refused')
    expect(a.reply).toEqual(b.reply)
    expect(await planHash('plan_paper_words', bookP({ body: 'One.' }), a.reply)).not.toBe(await planHash('plan_paper_words', bookP({ body: 'Two.' }), b.reply))
  })
})

describe('devMcpPaperWords — the writes', () => {
  it('sends the Contract Book\'s own columns for a new entry', () => {
    const world = bookWorld() as Extract<PaperWordsWorld, { on: 'book' }>
    const row = bookEntryRow(bookP({ version_date: '2026-11-21' }), world)
    expect(row).toEqual({ template_id: PACKET, document_name: 'A made-up agreement (draft)', sequence_order: 6, book_body_html: '# A made-up agreement\n\n**THIS LINE STANDS OUT.**', book_body_format: 'markdown', tags: [], canonical_document_url: null, audience: 'sub', book_version_date: '2026-11-21' })
    // The Book's Add writes the same columns.
    for (const column of Object.keys(row)) expect(BOOK).toContain(`${column}:`)
  })

  it('saves a builder draft as the tab does: the draft, on the draft number it read', () => {
    expect(SHEETS_IO).toContain(".eq('draft_no'")
    expect(SERVER).toContain("'document_builders', `key=eq.${encodeURIComponent(world.builder.key)}&draft_no=eq.${world.builder.draftNo}&select=key,draft_no`, { draft: p.draft }")
    // The case never writes published, revision or a read mark.
    const at = SERVER.indexOf("case 'apply_paper_words': {")
    const body = SERVER.slice(at, SERVER.indexOf("case 'plan_plan_set':", at))
    for (const never of ['published', 'revision:', 'read_revision', "'DELETE'"]) expect(body).not.toContain(never)
  })

  it('says where the words landed and how to read them back', () => {
    expect(paperWordsAppliedWords(builderP(), builderWorld(), { id: null, draftNo: 8 })).toMatchObject({ builder: 'sub-nda', draft_no: 8 })
    expect(paperWordsAppliedWords(bookP(), bookWorld(), { id: 'eeee', draftNo: null })).toMatchObject({ entry_id: 'eeee', title: 'A made-up agreement (draft)' })
    expect(alreadyApplied('apply_paper_words', { at: '2026-11-21T20:00:00Z', target: 'sub-nda' })).toContain('Nothing written: this plan was already applied')
  })
})

describe('devMcpPaperWords — the log', () => {
  it('keeps where the words went and how many, never the words, and keeps the plan hash', () => {
    const builder = paperWordsArgsForLog('apply_paper_words', { words: { into: 'builder', builder: 'sub-nda', draft: draft() }, plan_hash: HASH.toUpperCase() })
    expect(JSON.stringify(builder)).not.toContain('Sign in at the gate.')
    expect(builder).toMatchObject({ words: { into: 'builder', builder: 'sub-nda' }, plan_hash: HASH })
    const book = paperWordsArgsForLog('plan_paper_words', { words: { into: 'book', packet: 'Subs', title: 'A paper (draft)', audience: 'sub', format: 'markdown', body: 'Secret words. '.repeat(2000) } })
    expect(JSON.stringify(book)).not.toContain('Secret words.')
    expect(JSON.stringify(book).length).toBeLessThan(400)
    expect(book).not.toHaveProperty('plan_hash')
    expect(SERVER).toContain('if (isPaperWordsVerb(name)) return paperWordsArgsForLog(name, args)')
  })
})
