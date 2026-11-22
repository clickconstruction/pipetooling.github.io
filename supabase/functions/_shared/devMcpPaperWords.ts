// A paper's words loaded into the app from the dev seat, as a draft (v2.8257 / 0.125.0). Taunya, 2026-11-21: the Sub NDA
// has over a hundred fields, and typing them by hand invites mistakes. One pair, two places the words can land:
//
//   a builder's draft   document_builders.draft, the row Documents → Document builder edits. The whole draft is
//                       replaced, guarded by the row's draft number as the tab's own save is. The published revision
//                       and its read mark are never touched: Publish stays a press in the app.
//   a new Book entry    one contract_template_documents row, as the Contract Book's Add writes it. Markdown or plain
//                       words only, since the seat cannot run the app's HTML cleaner. It never changes an entry that
//                       exists: saving one in the app also opens a new version for everyone who holds that paper.
//
// A Book entry has no draft state: it is live the moment it lands. So the seat refuses the one name that switches
// something on. GC mode sends the entry named exactly `Master Services Agreement` as a company's master agreement
// (src/lib/gc/papersIo.ts), and renaming an entry to that is a press in the Contract Book, by a person.
//
// No RPC: the app writes both rows under RLS, so the seat does too, as the dev. The dry run is this server's own read
// of the builder or the packet, hashed with the payload; apply reads again and writes only when the hash still
// matches. It tells nobody and sends nothing. Pure: no env reads, no network; the reads come in through the Reader, so
// the tests run over a fake (src/lib/devMcp/devMcpPaperWords.test.ts).

import type { Reader, Row } from './devMcpComposites.ts'
import type { RowFilter } from './devMcpDoor.ts'

export const PAPER_WORDS_VERBS = ['plan_paper_words', 'apply_paper_words'] as const
export type PaperWordsVerb = (typeof PAPER_WORDS_VERBS)[number]

export function isPaperWordsVerb(name: string): name is PaperWordsVerb {
  return (PAPER_WORDS_VERBS as readonly string[]).includes(name)
}

/** The most a draft may weigh as JSON, and the most a Book entry's words may run. */
export const PAPER_WORDS_DRAFT_MAX = 300_000
export const PAPER_WORDS_BODY_MAX = 400_000
const TITLE_MAX = 200
/** How many changed lines the plan shows. The count is always whole. */
export const PAPER_WORDS_SHOWN = 12

/** Names the seat never gives a Book entry: each switches something on the moment the entry exists. */
export const PAPER_WORDS_LIVE_TITLES = ['Master Services Agreement'] as const

const KEY_RE = /^[a-z][a-z0-9-]{0,39}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/
const AUDIENCES = ['staff', 'customer', 'sub'] as const
const FORMATS = ['markdown', 'plain'] as const

export type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)
const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v))
const by = (column: string, value: string): RowFilter[] => [{ column, op: 'eq', value }]

export type PaperWordsPayload =
  | { action: 'builder_draft'; builder: string; draft: Json }
  | { action: 'book_entry'; packet: string; title: string; audience: (typeof AUDIENCES)[number]; format: (typeof FORMATS)[number]; body: string; version_date: string | null }

export type PaperWordsInput = { ok: true; p: PaperWordsPayload; target: string; planHash: string | null } | { ok: false; error: string }

const SHAPE =
  'needs words — { into: "builder", builder (its key, such as sub-nda), draft (the whole draft, an object) } OR { into: "book", packet (the packet\'s name or id), title (the entry\'s name), audience (staff | customer | sub), format (markdown | plain), body (the words), version_date? (YYYY-MM-DD) }'

/** True for a name the seat will not give a Book entry. */
export function isLiveTitle(title: string): boolean {
  const t = title.trim().toLowerCase()
  return PAPER_WORDS_LIVE_TITLES.some((x) => x.toLowerCase() === t)
}

/** plan_paper_words / apply_paper_words' input, shaped. apply_ must quote a 64-hex plan_hash. */
export function paperWordsInput(verb: PaperWordsVerb, input: Json): PaperWordsInput {
  const shape = `${verb} ${SHAPE}`
  const src = obj(input.words)
  if (!src) return { ok: false, error: shape }
  const s = (k: string) => (typeof src[k] === 'string' ? (src[k] as string).trim() : '')
  const into = s('into')
  let p: PaperWordsPayload
  let target: string
  if (into === 'builder') {
    const builder = s('builder')
    if (!KEY_RE.test(builder)) return { ok: false, error: `${verb}: builder is a builder's key, such as sub-nda. ${SHAPE}` }
    const draft = obj(src.draft)
    if (!draft) return { ok: false, error: `${verb}: draft is the whole draft, as an object. ${SHAPE}` }
    const size = JSON.stringify(draft).length
    if (size > PAPER_WORDS_DRAFT_MAX) return { ok: false, error: `${verb}: the draft is ${size} characters as JSON; the most is ${PAPER_WORDS_DRAFT_MAX}.` }
    p = { action: 'builder_draft', builder, draft }
    target = builder
  } else if (into === 'book') {
    const packet = s('packet')
    if (!packet || packet.length > TITLE_MAX) return { ok: false, error: `${verb}: packet is the packet's name or id. ${SHAPE}` }
    const title = s('title')
    if (!title || title.length > TITLE_MAX) return { ok: false, error: `${verb}: title is the entry's name, under ${TITLE_MAX} characters. ${SHAPE}` }
    if (isLiveTitle(title))
      return {
        ok: false,
        error: `${verb}: an entry named exactly "${title}" is live the moment it exists. GC mode sends it to a company as its master agreement. The seat does not make one. Load the words under another name, such as "${title} (draft)". Rename it in the Contract Book when the words are approved.`,
      }
    const audience = s('audience') as (typeof AUDIENCES)[number]
    if (!AUDIENCES.includes(audience)) return { ok: false, error: `${verb}: audience is one of ${AUDIENCES.join(', ')}.` }
    const format = s('format') as (typeof FORMATS)[number]
    if (!FORMATS.includes(format)) return { ok: false, error: `${verb}: format is markdown or plain. The seat does not take html: it cannot run the app's HTML cleaner.` }
    const body = typeof src.body === 'string' ? src.body.replace(/\r\n/g, '\n').trim() : ''
    if (!body) return { ok: false, error: `${verb}: body is the entry's words; it is empty.` }
    if (body.length > PAPER_WORDS_BODY_MAX) return { ok: false, error: `${verb}: body is ${body.length} characters; the most is ${PAPER_WORDS_BODY_MAX}.` }
    const day = s('version_date')
    if (day && !YMD_RE.test(day)) return { ok: false, error: `${verb}: version_date is a day, YYYY-MM-DD.` }
    p = { action: 'book_entry', packet, title, audience, format, body, version_date: day || null }
    target = title
  } else {
    return { ok: false, error: `${verb}: into is builder or book. ${SHAPE}` }
  }
  let planHash: string | null = null
  if (verb === 'apply_paper_words') {
    const h = typeof input.plan_hash === 'string' ? input.plan_hash.trim().toLowerCase() : ''
    if (!/^[0-9a-f]{64}$/.test(h)) return { ok: false, error: `${verb} needs plan_hash — the 64-hex value plan_paper_words replied with.` }
    planHash = h
  }
  return { ok: true, p, target, planHash }
}

// ── what a draft holds, line by line ───────────────────────────────────────────────────────────────────────

/** Every leaf of a draft as path → what it holds, so two drafts can be told apart line by line. */
export function draftLeaves(value: unknown, path = ''): Map<string, string> {
  const out = new Map<string, string>()
  const walk = (v: unknown, at: string) => {
    if (Array.isArray(v)) {
      if (v.length === 0) out.set(at, '[]')
      v.forEach((x, i) => walk(x, `${at}[${i}]`))
    } else if (v && typeof v === 'object') {
      const keys = Object.keys(v as Json).sort()
      if (keys.length === 0) out.set(at, '{}')
      for (const k of keys) walk((v as Json)[k], at ? `${at}.${k}` : k)
    } else {
      out.set(at, typeof v === 'string' ? v : JSON.stringify(v ?? null))
    }
  }
  walk(value, path)
  return out
}

export type DraftChange = { at: string; was: string | null; now: string | null }
export type DraftChanges = { changed: number; added: number; removed: number; same: number; first: DraftChange[] }

const cut = (s: string | null): string | null => (s === null ? null : s.length > 140 ? `${s.slice(0, 140)}…` : s)

/** What loading `now` over `was` changes: the counts, and the first few lines in the draft's own order. */
export function draftChanges(was: unknown, now: unknown): DraftChanges {
  const a = draftLeaves(was)
  const b = draftLeaves(now)
  const out: DraftChanges = { changed: 0, added: 0, removed: 0, same: 0, first: [] }
  const show = (c: DraftChange) => {
    if (out.first.length < PAPER_WORDS_SHOWN) out.first.push({ at: c.at, was: cut(c.was), now: cut(c.now) })
  }
  for (const [at, value] of b) {
    if (!a.has(at)) {
      out.added += 1
      show({ at, was: null, now: value })
    } else if (a.get(at) !== value) {
      out.changed += 1
      show({ at, was: a.get(at) ?? null, now: value })
    } else out.same += 1
  }
  for (const [at, value] of a) {
    if (!b.has(at)) {
      out.removed += 1
      show({ at, was: value, now: null })
    }
  }
  return out
}

/**
 * What a paper someone walks must have for the tab to draw it: a title, its levels and its topics, each topic with a
 * line for every level. The tab's own check (`parsePaperDef`) is fuller and runs when the draft is opened; this stops
 * the seat loading something the tab would refuse outright.
 */
export function walkedDraftProblems(draft: Json): string[] {
  const problems: string[] = []
  if (typeof draft.title !== 'string' || !draft.title.trim()) problems.push('title is missing.')
  const levels = Array.isArray(draft.levels) ? draft.levels : null
  const ids: string[] = []
  if (!levels || levels.length === 0) problems.push('levels is missing: a list of { id, name, alignedWith }.')
  else
    levels.forEach((l, i) => {
      const o = obj(l)
      if (!o || typeof o.id !== 'string' || !o.id || typeof o.name !== 'string' || !o.name.trim()) problems.push(`levels[${i}] needs an id and a name.`)
      else ids.push(o.id)
    })
  const topics = Array.isArray(draft.topics) ? draft.topics : null
  if (!topics || topics.length === 0) problems.push('topics is missing: a list of { key, label, levels }.')
  else
    topics.forEach((t, i) => {
      const o = obj(t)
      if (!o || typeof o.key !== 'string' || !o.key || typeof o.label !== 'string' || !o.label.trim()) return void problems.push(`topics[${i}] needs a key and a label.`)
      const per = obj(o.levels)
      if (!per) return void problems.push(`topics[${i}] (${o.key}) needs levels.`)
      for (const id of ids) {
        const at = obj(per[id])
        if (!at || typeof at.says !== 'string' || !at.says.trim()) problems.push(`topics[${i}] (${o.key}) has no line for the level ${id}.`)
      }
    })
  return problems.slice(0, 12)
}

// ── the world the plan reads ────────────────────────────────────────────────────────────────────────────────

export type PaperWordsWorld =
  | { on: 'builder'; builder: { key: string; kind: string; draft: Json; draftNo: number; revision: number } }
  | { on: 'book'; packet: { id: string; name: string }; entries: { name: string; audience: string | null }[]; nextOrder: number }

/** The builder's row, or the packet and what it already holds, as the dev reads them. Answers `{ refused }` in words. */
export async function readPaperWordsWorld(reader: Reader, p: PaperWordsPayload): Promise<PaperWordsWorld | { refused: string }> {
  if (p.action === 'builder_draft') {
    const rows = await reader.rows('document_builders', { select: 'key,kind,draft,draft_no,revision', filters: by('key', p.builder), limit: 1 })
    const row = rows[0]
    if (!row) return { refused: `No builder ${p.builder} — it has no row yet, or RLS hides it from you. Open Documents → Document builder and press Load the first draft there. The seat changes a draft that exists.` }
    return { on: 'builder', builder: { key: str(row.key), kind: str(row.kind), draft: obj(row.draft) ?? {}, draftNo: Number(row.draft_no ?? 0), revision: Number(row.revision ?? 0) } }
  }
  const packets: Row[] = UUID_RE.test(p.packet)
    ? await reader.rows('contract_templates', { select: 'id,name', filters: by('id', p.packet.toLowerCase()), limit: 2 })
    : await reader.rows('contract_templates', { select: 'id,name', filters: [{ column: 'name', op: 'ilike', value: p.packet }], limit: 5 })
  if (packets.length === 0) return { refused: `No packet "${p.packet}" — read_rows on contract_templates lists them by name.` }
  if (packets.length > 1) return { refused: `"${p.packet}" finds ${packets.length} packets: ${packets.map((r) => `${str(r.name)} (${str(r.id)})`).join(', ')}. Name one by its id.` }
  const packet = { id: str(packets[0]?.id), name: str(packets[0]?.name) }
  const entries = await reader.rows('contract_template_documents', { select: 'document_name,audience,sequence_order', filters: by('template_id', packet.id), order: [{ column: 'sequence_order', ascending: true }], limit: 200 })
  const nextOrder = entries.reduce((m, r) => Math.max(m, Number(r.sequence_order ?? 0) + 1), 0)
  return { on: 'book', packet, entries: entries.map((r) => ({ name: str(r.document_name), audience: typeof r.audience === 'string' ? r.audience : null })), nextOrder }
}

// ── the dry run ────────────────────────────────────────────────────────────────────────────────────────────

export type DryRun = { ok: true; reply: Json } | { ok: false; refused: string }

/** The row a Book entry lands as: the Contract Book's own insert, column for column. */
export function bookEntryRow(p: Extract<PaperWordsPayload, { action: 'book_entry' }>, world: Extract<PaperWordsWorld, { on: 'book' }>): Json {
  return {
    template_id: world.packet.id,
    document_name: p.title,
    sequence_order: world.nextOrder,
    book_body_html: p.body,
    book_body_format: p.format,
    tags: [],
    canonical_document_url: null,
    audience: p.audience,
    book_version_date: p.version_date,
  }
}

/**
 * What the plan says and what the hash commits to. No clock comes in, so the same words planned twice read the same.
 * The reply never repeats the words themselves: it counts them and shows where they differ.
 */
export function paperWordsDryRun(p: PaperWordsPayload, world: PaperWordsWorld): DryRun {
  if (p.action === 'builder_draft' && world.on === 'builder') {
    const b = world.builder
    if (b.kind === 'walked') {
      const problems = walkedDraftProblems(p.draft)
      if (problems.length) return { ok: false, refused: `The tab could not draw this draft of ${b.key}: ${problems.join(' ')}` }
    }
    const changes = draftChanges(b.draft, p.draft)
    if (changes.changed + changes.added + changes.removed === 0) return { ok: false, refused: `Nothing to write: ${b.key}'s draft already reads these words.` }
    return {
      ok: true,
      reply: {
        action: 'builder_draft',
        builder: { key: b.key, kind: b.kind, published_revision: b.revision, draft_no: b.draftNo },
        changes,
        lands: `Documents → Document builder → ${b.key}, as its draft. Open it there to read the words on the page.`,
        writes: { table: 'document_builders', where: { key: b.key, draft_no: b.draftNo }, sets: 'draft, whole' },
        not_done: [
          b.revision > 0 ? `revision ${b.revision} stays published as it is: nobody outside sees these words until Publish in the app` : 'nothing is published: Publish is a press in the app',
          'the mark that an attorney or an agent read a revision is a press in the app',
          'no send, no link, no email',
          b.kind === 'walked' ? 'a paper someone walks holds each level\'s line, its breach lines and its site lines. It holds no clause wording: the agreement\'s own sections have no place in a builder' : 'a job\'s own sheet is filled from the job in the app',
        ],
      },
    }
  }
  if (p.action === 'book_entry' && world.on === 'book') {
    const taken = world.entries.find((e) => e.name.trim().toLowerCase() === p.title.toLowerCase())
    if (taken) return { ok: false, refused: `${world.packet.name} already has an entry named "${taken.name}". The seat never changes an entry that exists: saving one in the app opens a new version for everyone who holds that paper. Load these words under another name, or change that entry in the Contract Book.` }
    return {
      ok: true,
      reply: {
        action: 'book_entry',
        packet: world.packet,
        entry: { title: p.title, audience: p.audience, format: p.format, characters: p.body.length, lines: p.body.split('\n').length, version_date: p.version_date },
        beside: world.entries.map((e) => `${e.name}${e.audience ? ` (${e.audience})` : ''}`),
        lands: `People → Contracts → Contract library → Documents, in the packet ${world.packet.name}, as "${p.title}".`,
        writes: { table: 'contract_template_documents', row: { ...bookEntryRow(p, world), book_body_html: `(${p.body.length} characters)` } },
        heed: [
          'a Book entry has no draft state: it can be picked and sent from the app the moment it lands',
          `it joins the packet ${world.packet.name}: read "beside" for what that packet already holds, and who is handed that packet`,
        ],
        not_done: ['no entry that exists is changed', 'no send, no email, nobody is assigned this paper', 'renaming it, and deleting it, are presses in the Contract Book'],
      },
    }
  }
  return { ok: false, refused: 'The plan read the wrong place for these words.' }
}

/** The apply's reply: what landed, where it shows, and the read that shows it. */
export function paperWordsAppliedWords(p: PaperWordsPayload, world: PaperWordsWorld, landed: { id: string | null; draftNo: number | null }): Json {
  if (p.action === 'builder_draft' && world.on === 'builder')
    return {
      builder: world.builder.key,
      draft_no: landed.draftNo,
      lands: `Documents → Document builder → ${world.builder.key}, as its draft.`,
      next: `read_rows on document_builders (select key,draft,draft_no,revision; key = ${world.builder.key}) reads it back. Publish is a press in the app.`,
    }
  return {
    entry_id: landed.id,
    title: p.action === 'book_entry' ? p.title : null,
    lands: world.on === 'book' ? `People → Contracts → Contract library → Documents, in the packet ${world.packet.name}.` : null,
    next: 'read_rows on contract_template_documents by id reads it back. Renaming or deleting it is a press in the Contract Book.',
  }
}

/** The call as the log keeps it: where the words went and how many, never the words. */
export function paperWordsArgsForLog(name: string, args: Json): Json {
  const w = obj(args.words)
  const hash = name === 'apply_paper_words' ? { plan_hash: typeof args.plan_hash === 'string' ? args.plan_hash.trim().toLowerCase() : args.plan_hash } : {}
  if (!w) return { words: null, ...hash }
  if (w.into === 'builder') return { words: { into: 'builder', builder: w.builder ?? null, draft: obj(w.draft) ? `(${JSON.stringify(w.draft).length} characters, not logged)` : null }, ...hash }
  return { words: { into: w.into ?? null, packet: w.packet ?? null, title: w.title ?? null, audience: w.audience ?? null, format: w.format ?? null, body: typeof w.body === 'string' ? `(${w.body.length} characters, not logged)` : null }, ...hash }
}
