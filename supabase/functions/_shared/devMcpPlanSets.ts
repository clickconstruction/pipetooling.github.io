// A plan set, or a paper, on a plan part from the dev seat (v2.6317 / 0.14.0 — punch list #239's MCP leg). The owner
// asked whether everything the plan-sets train added is reachable through the MCP seats: the reads were, the writes
// were not. These four verbs are the writes the job window's Plans section makes (src/lib/plans/planSetsIo.ts:
// addSet, keepPaper, markPaperCame), under the seat's own grammar — plan_ is a dry run that reads the part and says
// the row as it would be written, apply_ re-runs that read and writes only when the plan_hash still matches.
//
// No RPC exists for these rows and none is owed: the app writes plan_sets and plan_parts as rows under RLS, so the
// seat does too, as the dev — the one place a write verb reaches a table and not a dev-gated RPC. RLS holds the same
// line it holds for the screen (plan_part_can_write: the office roles, on a part they can see), the papers' History
// line is the database's own trigger (migration 20261102010000), and the job's old plans link mirrors the current
// set by trigger (20261101210000). Pure: no env reads, no network; the reads and writes come in through two small
// interfaces so the tests run over a recording fake (src/lib/devMcp/devMcpPlanSets.test.ts).
//
// The kinds and sources here are the papers migration's CHECKs (20261102010000) and the Plans section's picker
// (src/lib/plans/planSets.ts PLAN_SET_KINDS, PLAN_SET_SOURCES), which the test holds them to; the paper kinds'
// labels follow the client's src/lib/papers/papers.ts (PAPER_KINDS, PAPER_FROMS).
//
// 0.92.0 (v2.7458): plan_plan_set / apply_plan_set also change the Drive link of a set already saved — set_id with a
// new link, and a memo when passed — on the row's own id, so the sets that replace or mark it up, the papers that go
// with it and the part's current set keep pointing at it. The job's old plans link follows by the trigger on
// plan_sets.link (plan_sets_mirror_on_change, migration 20261101210000) when the part builds from the set.

export const PLAN_PART_VERBS = ['plan_plan_set', 'apply_plan_set', 'plan_paper', 'apply_paper'] as const
export type PlanPartVerb = (typeof PLAN_PART_VERBS)[number]

export function isPlanPartVerb(name: string): name is PlanPartVerb {
  return (PLAN_PART_VERBS as readonly string[]).includes(name)
}

/** The drawing kinds a part can build from, in the picker's order, with the words the Plans section shows. */
export const DRAWING_KINDS: ReadonlyArray<{ kind: string; label: string; ours: boolean }> = [
  { kind: 'issued', label: 'Issued set', ours: false },
  { kind: 'addendum', label: 'Addendum', ours: false },
  { kind: 'bulletin', label: 'Bulletin', ours: false },
  { kind: 'revised', label: 'Revised set', ours: false },
  { kind: 'permit', label: 'Permit set', ours: false },
  { kind: 'construction', label: 'Construction set', ours: false },
  { kind: 'assembled', label: 'Assembled set', ours: true },
  { kind: 'as_built', label: 'As-built', ours: true },
]
/** The paper kinds — what goes with the drawings. */
export const PAPER_KINDS: ReadonlyArray<{ kind: string; label: string }> = [
  { kind: 'spec', label: 'Spec' },
  { kind: 'submittal', label: 'Submittal' },
  { kind: 'schedule', label: 'Schedule' },
  { kind: 'scope', label: 'Scope' },
  { kind: 'change_order', label: 'Change order' },
  { kind: 'meeting_notes', label: 'Meeting notes' },
  { kind: 'task_list', label: 'Task list' },
  { kind: 'report', label: 'Report' },
  { kind: 'sheet', label: 'Sheet' },
  { kind: 'other', label: 'Other' },
]
export const SET_SOURCES = ['gc', 'architect', 'ours'] as const
export const PAPER_SOURCES = ['gc', 'architect', 'engineer', 'supplier', 'ours'] as const
export const ASK_LANES = ['estimators', 'dispatch'] as const

const DRAWING_KIND_SET = new Set(DRAWING_KINDS.map((k) => k.kind))
const PAPER_KIND_SET = new Set(PAPER_KINDS.map((k) => k.kind))
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/
const LINK_RE = /^https?:\/\//i

export type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)

export type SetPayload = {
  action: 'add_set'
  part_id?: string
  job_id?: string
  name: string
  kind: string
  source: string
  dated?: string
  memo: string
  link: string
  replaces_set_id?: string
  marks_up_set_id?: string
  make_current?: boolean
}
/** The link of a set already saved, changed on its own row (0.92.0); memo replaces the set's memo when passed. */
export type SetLinkPayload = { action: 'change_link'; set_id: string; link: string; memo?: string }
export type PaperKeepPayload = {
  action: 'keep'
  part_id?: string
  job_id?: string
  name: string
  kind: string
  from: string
  came_on?: string
  memo: string
  link: string
  goes_with_set_id?: string
  replaces_paper_id?: string
  owed: boolean
  ask?: { lane: string; words: string }
}
export type PaperCamePayload = { action: 'came'; paper_id: string; link: string }
export type PlanPartPayload = SetPayload | SetLinkPayload | PaperKeepPayload | PaperCamePayload

export type PlanPartInput = { ok: true; p: PlanPartPayload; target: string } | { ok: false; error: string }

const SET_SHAPE = `needs set — { part_id (a plan_parts.id: read_rows on plan_parts by development_id or job_id) and/or job_id (a jobs_ledger.id — find_job; the job's own plan part is used, and an as-built needs it), name (what the office calls it, under 200 characters), kind (${DRAWING_KINDS.map((k) => k.kind).join(' | ')} — a paper is plan_paper), source (gc | architect | ours), dated? (YYYY-MM-DD, the date on the sheets), memo? (under 2000), link? (the Drive folder or file, https://…; leave it out while the files are on their way), replaces_set_id? (a set on the same part; the current set when make_current and left out), marks_up_set_id? (the set an as-built marks up; the current set when left out), make_current? (build from it: true when the part has no set yet, false otherwise when left out; never for an as-built) }. To change the Drive link of a set already saved: set — { set_id (a plan_sets.id: read_rows on plan_sets by part_id), link (the new one, https://…), memo? (replaces the set's memo when passed) } and nothing else.`
/** What a link change may not carry: the set keeps everything else it has. */
const ADD_ONLY_KEYS = ['part_id', 'job_id', 'name', 'kind', 'source', 'dated', 'replaces_set_id', 'marks_up_set_id', 'make_current'] as const
const PAPER_SHAPE = `needs paper — { action?: keep | came (keep when left out); keep: part_id (a plan_parts.id) and/or job_id (the job it is kept on; its plan part is used), kind (${PAPER_KINDS.map((k) => k.kind).join(' | ')}), name (under 200 characters), from (gc | architect | engineer | supplier | ours), came_on? (YYYY-MM-DD, the day it came; today when left out), memo? (under 2000), link? (https://…), goes_with_set_id? (the drawing set it travels with), replaces_paper_id? (the paper it replaces), owed? (true for a paper we are waiting on: no link, and the ask says who owes it), ask? { lane: estimators | dispatch, words (what it asks of us, one line under 500) } — required when owed; came: paper_id (an owed paper's plan_sets.id), link (where it landed, https://…) }.`

/** The verb's input as the payload the dry run and the write take. Refuses in words when it is not the shape the Plans section writes. */
export function planPartInput(verb: PlanPartVerb, input: Json): PlanPartInput {
  const isSet = verb === 'plan_plan_set' || verb === 'apply_plan_set'
  const shape = `${verb} ${isSet ? SET_SHAPE : PAPER_SHAPE}`
  const src = obj(isSet ? input.set : input.paper)
  if (!src) return { ok: false, error: shape }
  const str = (k: string) => (typeof src[k] === 'string' ? (src[k] as string).trim() : '')
  const id = (k: string): string | null | false => {
    const v = str(k)
    if (!v) return null
    return UUID_RE.test(v) ? v.toLowerCase() : false
  }
  if (isSet && str('set_id')) {
    const setId = id('set_id')
    if (!setId) return { ok: false, error: shape }
    const extra = ADD_ONLY_KEYS.filter((k) => src[k] !== undefined)
    if (extra.length) return { ok: false, error: `${verb}: set_id changes the link of a set already saved, and takes link and memo only — leave ${extra.join(', ')} out. The set keeps its name, its kind, its dates and its place on the part.` }
    const link = str('link')
    if (!link || !LINK_RE.test(link) || link.length > 2000) return { ok: false, error: `${verb}: a link change needs link — the set's new Drive folder or file, starting with https://.` }
    const p: SetLinkPayload = { action: 'change_link', set_id: setId, link }
    if (src.memo !== undefined) {
      if (typeof src.memo !== 'string' || src.memo.trim().length > 2000) return { ok: false, error: shape }
      p.memo = src.memo.trim()
    }
    return { ok: true, p, target: setId }
  }
  if (isSet) {
    const partId = id('part_id')
    const jobId = id('job_id')
    if (partId === false || jobId === false || (!partId && !jobId)) return { ok: false, error: shape }
    const name = str('name')
    const kind = str('kind').toLowerCase()
    const source = str('source').toLowerCase()
    if (!name || name.length > 200) return { ok: false, error: shape }
    if (PAPER_KIND_SET.has(kind)) return { ok: false, error: `${verb}: ${kind} is a paper, not a set of drawings — keep it with plan_paper.` }
    if (!DRAWING_KIND_SET.has(kind) || !(SET_SOURCES as readonly string[]).includes(source)) return { ok: false, error: shape }
    const p: SetPayload = { action: 'add_set', name, kind, source, memo: str('memo'), link: str('link') }
    if (partId) p.part_id = partId
    if (jobId) p.job_id = jobId
    if (p.memo.length > 2000) return { ok: false, error: shape }
    if (p.link && (!LINK_RE.test(p.link) || p.link.length > 2000)) return { ok: false, error: `${verb}: link starts with https:// (a Drive folder or file), or is left out while the files are on their way.` }
    const dated = str('dated')
    if (dated) {
      if (!YMD_RE.test(dated)) return { ok: false, error: shape }
      p.dated = dated
    }
    for (const k of ['replaces_set_id', 'marks_up_set_id'] as const) {
      const v = id(k)
      if (v === false) return { ok: false, error: shape }
      if (v) p[k] = v
    }
    if (src.make_current !== undefined) {
      if (typeof src.make_current !== 'boolean') return { ok: false, error: shape }
      p.make_current = src.make_current
    }
    if (kind === 'as_built') {
      if (!jobId) return { ok: false, error: `${verb}: an as-built is ours, on the job that made it — name job_id.` }
      if (source !== 'ours') return { ok: false, error: `${verb}: an as-built's source is ours.` }
      if (p.make_current === true) return { ok: false, error: `${verb}: a part builds from a set of drawings, never from an as-built — leave make_current out.` }
    }
    return { ok: true, p, target: partId ?? jobId ?? '' }
  }
  const action = str('action').toLowerCase() || 'keep'
  if (action === 'came') {
    const paperId = id('paper_id')
    const link = str('link')
    if (!paperId || !link || !LINK_RE.test(link) || link.length > 2000) return { ok: false, error: shape }
    return { ok: true, p: { action: 'came', paper_id: paperId, link }, target: paperId }
  }
  if (action !== 'keep') return { ok: false, error: shape }
  const partId = id('part_id')
  const jobId = id('job_id')
  if (partId === false || jobId === false || (!partId && !jobId)) return { ok: false, error: shape }
  const name = str('name')
  const kind = str('kind').toLowerCase()
  const from = str('from').toLowerCase()
  if (!name || name.length > 200) return { ok: false, error: shape }
  if (DRAWING_KIND_SET.has(kind)) return { ok: false, error: `${verb}: ${kind} is a set of drawings, not a paper — add it with plan_plan_set.` }
  if (!PAPER_KIND_SET.has(kind) || !(PAPER_SOURCES as readonly string[]).includes(from)) return { ok: false, error: shape }
  const owed = src.owed === true
  const p: PaperKeepPayload = { action: 'keep', name, kind, from, memo: str('memo'), link: owed ? '' : str('link'), owed }
  if (partId) p.part_id = partId
  if (jobId) p.job_id = jobId
  if (p.memo.length > 2000) return { ok: false, error: shape }
  if (p.link && (!LINK_RE.test(p.link) || p.link.length > 2000)) return { ok: false, error: `${verb}: link starts with https://, or is left out for now.` }
  const cameOn = str('came_on')
  if (cameOn) {
    if (!YMD_RE.test(cameOn)) return { ok: false, error: shape }
    p.came_on = cameOn
  }
  for (const k of ['goes_with_set_id', 'replaces_paper_id'] as const) {
    const v = id(k)
    if (v === false) return { ok: false, error: shape }
    if (v) p[k] = v
  }
  const ask = obj(src.ask)
  if (ask) {
    const lane = typeof ask.lane === 'string' ? ask.lane.trim().toLowerCase() : ''
    const words = typeof ask.words === 'string' ? ask.words.trim() : ''
    if (!(ASK_LANES as readonly string[]).includes(lane) || !words || words.length > 500) return { ok: false, error: shape }
    p.ask = { lane, words }
  }
  if (owed && !p.ask) return { ok: false, error: `${verb}: an owed paper carries its ask — { lane, words } says who owes it and what it is.` }
  return { ok: true, p, target: partId ?? jobId ?? '' }
}

// ── the world the dry run reads ──────────────────────────────────────────────────────────────────────────────────

export type PartRow = { id: string; development_id: string | null; job_id: string | null; name: string; current_set_id: string | null }
export type SetRow = { id: string; part_id: string; name: string; kind: string; source: string; link: string; owed: boolean; came_at: string; marks_up_set_id: string | null; replaces_set_id: string | null; job_id: string | null }
export type JobRow = { id: string; job_name: string | null; click_number: string | null; hcp_number: string | null; plan_part_id: string | null; development_id: string | null }
export type DevelopmentRow = { id: string; name: string | null }
/** A set whose link changes, with what the plan reads back beside the link: its memo, the date on the sheets, the file facts read behind the old link. */
export type SetLinkRow = SetRow & { memo: string; dated: string | null; file_name: string | null; checked_at: string | null; updated_at: string }
/** A job naming the part, with the plans link it carries today. */
export type FollowerRow = { id: string; job_name: string | null; click_number: string | null; hcp_number: string | null; job_plans_link: string | null }
/** The most jobs a link change names; a part with more says so. */
export const FOLLOWER_CAP = 200

/** The reads, as the dev: a table and a PostgREST query string; RLS applies, so a row the dev cannot see is a row that is not there. */
export type PartReads = { rows: (table: string, query: string) => Promise<Json[]> }

export type PlanPartWorld = {
  part: PartRow | null
  development: DevelopmentRow | null
  /** The job that owns the part (a job outside any development), or the job the payload names. */
  job: JobRow | null
  sets: SetRow[]
  /** For `came`: the paper itself. */
  paper: SetRow | null
  /** For `change_link` (0.92.0): the set itself, and the jobs naming its part when the part builds from it. */
  target?: SetLinkRow | null
  followers?: FollowerRow[]
}

const PART_COLS = 'id,development_id,job_id,name,current_set_id'
const SET_COLS = 'id,part_id,name,kind,source,link,owed,came_at,marks_up_set_id,replaces_set_id,job_id'
const JOB_COLS = 'id,job_name,click_number,hcp_number,plan_part_id,development_id'
const SET_LINK_COLS = `${SET_COLS},memo,dated,file_name,checked_at,updated_at`
const FOLLOWER_COLS = 'id,job_name,click_number,hcp_number,job_plans_link'

export async function readPlanPartWorld(reads: PartReads, p: PlanPartPayload): Promise<PlanPartWorld> {
  const one = async <T>(table: string, query: string): Promise<T | null> => ((await reads.rows(table, query))[0] as T | undefined) ?? null
  let paper: SetRow | null = null
  let partId: string | null = null
  let job: JobRow | null = null
  let target: SetLinkRow | null = null
  if (p.action === 'came') {
    paper = await one<SetRow>('plan_sets', `select=${SET_COLS}&id=eq.${p.paper_id}`)
    partId = paper?.part_id ?? null
  } else if (p.action === 'change_link') {
    target = await one<SetLinkRow>('plan_sets', `select=${SET_LINK_COLS}&id=eq.${p.set_id}`)
    partId = target?.part_id ?? null
  } else {
    if (p.job_id) job = await one<JobRow>('jobs_ledger', `select=${JOB_COLS}&id=eq.${p.job_id}`)
    partId = p.part_id ?? job?.plan_part_id ?? null
  }
  const part = partId ? await one<PartRow>('plan_parts', `select=${PART_COLS}&id=eq.${partId}`) : null
  if (part?.job_id && !job) job = await one<JobRow>('jobs_ledger', `select=${JOB_COLS}&id=eq.${part.job_id}`)
  const developmentId = part?.development_id ?? job?.development_id ?? null
  const development = developmentId ? await one<DevelopmentRow>('developments', `select=id,name&id=eq.${developmentId}`) : null
  const sets = part ? ((await reads.rows('plan_sets', `select=${SET_COLS}&part_id=eq.${part.id}&order=came_at.desc`)) as SetRow[]) : []
  if (p.action === 'change_link') {
    // The jobs whose old plans link the mirror moves: read only when the part builds from this set.
    const followers = part && target && part.current_set_id === target.id ? ((await reads.rows('jobs_ledger', `select=${FOLLOWER_COLS}&plan_part_id=eq.${part.id}&order=created_at&limit=${FOLLOWER_CAP}`)) as FollowerRow[]) : []
    return { part, development, job, sets, paper, target, followers }
  }
  return { part, development, job, sets, paper }
}

// ── words ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The job as a short label: its number, else its name (src/lib/plans/planSets.ts jobShortLabel). */
export function jobLabel(job: Pick<JobRow, 'click_number' | 'hcp_number' | 'job_name'>): string {
  const n = (job.click_number ?? '').trim() || (job.hcp_number ?? '').trim()
  if (n) return /^\d+$/.test(n) ? `JP${n}` : n
  return (job.job_name ?? '').trim() || 'this job'
}

export function drawingKindLabel(kind: string): string {
  return DRAWING_KINDS.find((k) => k.kind === kind)?.label ?? kind
}
export function paperKindLabel(kind: string): string {
  return PAPER_KINDS.find((k) => k.kind === kind)?.label ?? kind.replace(/_/g, ' ')
}
/** A set's source as its line reads it: *the GC*, *the architect*, *ours*. */
export function setSourceWords(source: string): string {
  return source === 'ours' ? 'ours' : source === 'architect' ? 'the architect' : 'the GC'
}
/** A paper's source as its line reads it (papers.ts PAPER_FROMS): the GC is *the owner*. */
export function paperFromWords(from: string): string {
  return from === 'ours' ? 'ours' : from === 'architect' ? 'the architect' : from === 'engineer' ? 'the engineer' : from === 'supplier' ? 'the supplier' : 'the owner'
}

function civil(ymd: string): Date {
  return new Date(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)))
}
/** *Oct 14, 2026* from a civil date. */
export function datedWords(ymd: string): string {
  return civil(ymd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
/** *Oct 14* from a civil date. */
export function dayWords(ymd: string): string {
  return civil(ymd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * The History line the database's trigger writes for a paper (plan_set_paper_words, migration 20261102010000) —
 * the same words, so the plan shows the line before the keep. A drawing writes none.
 */
export function paperHistoryLine(p: { kind: string; name: string; from: string; memo: string; owed: boolean }, goesWith: string | null, replaces: string | null): string {
  if (p.owed) return `Owed: ${p.name} from ${p.from === 'ours' ? 'us' : paperFromWords(p.from)}${p.memo ? ` · ${p.memo}` : ''}`
  return `Kept ${p.kind.replace(/_/g, ' ')} ${p.name}, ${paperFromWords(p.from)}${goesWith ? `, on ${goesWith}` : ''}${p.memo ? `: ${p.memo}` : ''}${replaces ? ` · replaces ${replaces}` : ''}`
}

/**
 * The History line a development part's switch writes, one per job on the part or one for the site when none
 * (plan_part_switch_words, migration 20261102063000, v2.6344): the same words, so the plan shows the line first.
 */
export function partSwitchLine(partName: string, set: { name: string; dated: string | null }, oldName: string | null): string {
  return `Plans · ${partName} now builds from ${set.name}${set.dated ? `, dated ${datedWords(set.dated)}` : ''}${oldName && oldName !== set.name ? ` · replaces ${oldName}` : ''}`
}

// ── the dry run ──────────────────────────────────────────────────────────────────────────────────────────────────

export type DryRun = { ok: true; reply: Json } | { ok: false; refused: string }

const named = (s: Pick<SetRow, 'id' | 'name' | 'kind'> | null | undefined): { id: string; name: string; kind: string } | null => (s ? { id: s.id, name: s.name, kind: s.kind } : null)

function partWords(world: PlanPartWorld): Json {
  const part = world.part!
  const current = world.sets.find((s) => s.id === part.current_set_id) ?? null
  return {
    id: part.id,
    name: part.name,
    on: part.development_id ? 'development' : 'job',
    development: world.development ? { id: world.development.id, name: world.development.name } : null,
    job: part.job_id && world.job && world.job.id === part.job_id ? { id: world.job.id, label: jobLabel(world.job) } : null,
    sets_on_part: world.sets.length,
    builds_from: named(current),
  }
}

/**
 * What the plan says and what the hash commits to: the part as it stands (its set count, what it builds from),
 * the row as it would be written, and for a paper the ask and the History line. Refuses in words before anything
 * is hashed when the part, the job or a named set is not there, or the pieces do not fit together.
 */
export function planPartDryRun(p: PlanPartPayload, world: PlanPartWorld, todayYmd: string): DryRun {
  if (p.action === 'came') {
    const paper = world.paper
    if (!paper) return { ok: false, refused: `No paper ${p.paper_id} is visible to you — read_rows on plan_sets (kind in the paper kinds) by part_id finds it.` }
    if (DRAWING_KIND_SET.has(paper.kind)) return { ok: false, refused: `${paper.name} is a ${drawingKindLabel(paper.kind).toLowerCase()}, not a paper: its link changes with plan_plan_set { set_id, link }.` }
    if (!paper.owed) return { ok: false, refused: `${paper.name} already came${paper.link ? ` (${paper.link})` : ''}. A new copy is a new paper: plan_paper with replaces_paper_id.` }
    if (!world.part) return { ok: false, refused: `The paper's part ${paper.part_id} is not visible to you.` }
    return {
      ok: true,
      reply: {
        action: 'came',
        part: partWords(world),
        paper: { id: paper.id, name: paper.name, kind: paper.kind, kind_words: paperKindLabel(paper.kind), from: paper.source, owed: true, link_before: paper.link, asked_on: paper.came_at },
        after: { owed: false, link: p.link, came_at: 'the moment of apply' },
        history: 'No new History line: the Owed line stays as it was kept; the paper now reads under its set with its link.',
      },
    }
  }
  if (p.action === 'change_link') {
    const set = world.target ?? null
    if (!set) return { ok: false, refused: `No set ${p.set_id} is visible to you — read_rows on plan_sets by part_id lists a part's sets.` }
    if (!DRAWING_KIND_SET.has(set.kind)) {
      return { ok: false, refused: `${set.name} is a ${paperKindLabel(set.kind).toLowerCase()}, a paper and not a set of drawings. Papers are plan_paper's ground: an owed one takes its link with action came, and a new copy is a new paper with replaces_paper_id.` }
    }
    if (!world.part) return { ok: false, refused: `The set's part ${set.part_id} is not visible to you.` }
    const before = (set.link ?? '').trim()
    if (before === p.link) return { ok: false, refused: `${set.name} already has that link (${before}). Nothing to change.` }
    const part = world.part
    const current = world.sets.find((s) => s.id === part.current_set_id) ?? null
    const isCurrent = part.current_set_id === set.id
    const followers = isCurrent ? (world.followers ?? []) : []
    const jobs = followers.map((j) => ({ id: j.id, label: jobLabel(j), before: (j.job_plans_link ?? '').trim(), after: p.link }))
    const memoAfter = p.memo ?? set.memo
    const hadFacts = !!(set.file_name || set.checked_at)
    return {
      ok: true,
      reply: {
        action: 'change_link',
        part: partWords(world),
        set: {
          id: set.id,
          name: set.name,
          kind: set.kind,
          kind_words: drawingKindLabel(set.kind),
          source: set.source,
          source_words: setSourceWords(set.source),
          dated: set.dated ?? null,
          came_at: set.came_at,
          // The row's last save: the hash commits to it, so a link changed back and forth is planned afresh each time.
          updated_at: set.updated_at,
          memo: set.memo,
          link: before,
          replaces: named(world.sets.find((s) => s.id === set.replaces_set_id)),
          marks_up: named(world.sets.find((s) => s.id === set.marks_up_set_id)),
          line: `${drawingKindLabel(set.kind)} · ${setSourceWords(set.source)}${set.dated ? ` · dated ${datedWords(set.dated)}` : ''}`,
        },
        link: {
          before,
          after: p.link,
          note: !before
            ? 'The set had no link yet; this is its first.'
            : planLinkKey(before) === planLinkKey(p.link)
              ? 'Both links read as the same Drive folder or file: only the tail differs.'
              : null,
        },
        memo: { before: set.memo, after: memoAfter, changed: memoAfter !== set.memo },
        file_facts: hadFacts ? 'The file facts read behind the old link (its file name, size, count and the day it was checked) are cleared: they described the old file.' : null,
        builds_from_this_set: isCurrent,
        row: 'The row keeps its id: every set that replaces or marks up this one, every paper that goes with it and the part\'s current set still point at it. Its name, kind, source and dates stay.',
        job_plans_link: isCurrent
          ? {
              follows: true,
              by: 'the database\'s trigger on plan_sets.link (plan_sets_mirror_on_change → plan_part_mirror_job_links)',
              jobs,
              more: followers.length >= FOLLOWER_CAP ? `Only the first ${FOLLOWER_CAP} jobs are named; the mirror moves every job naming the part.` : null,
              words: jobs.length
                ? `${part.name} builds from this set, so job_plans_link on ${jobs.length === 1 ? 'the 1 job' : `the ${jobs.length} jobs`} naming the part follows by the existing mirror the moment the link lands: each job's Open plans and the trade portal open the new link.`
                : `${part.name} builds from this set and no job names the part yet; a job that names it later takes the link then.`,
            }
          : {
              follows: false,
              jobs: [],
              more: null,
              words: `${part.name} builds from ${current ? current.name : 'no set yet'}, not from this one, so no job's plans link moves. The set reads with its new link where it sits on the job's Plans section and the site's Plans look.`,
            },
        history: 'A link change writes no History line.',
      },
    }
  }
  if (p.job_id && !world.job) return { ok: false, refused: `No job ${p.job_id} is visible to you — find_job resolves a number or a name.` }
  if (p.job_id && world.job && !world.job.plan_part_id && !p.part_id) {
    return { ok: false, refused: `${jobLabel(world.job)} has no plan part yet. The office names one on the job's Documents tab → Plans (Make this job's part, or pick one of the site's parts); then plan again${p.action === 'add_set' ? ', or name the part_id directly' : ''}.` }
  }
  if (!world.part) return { ok: false, refused: `No plan part ${p.part_id ?? world.job?.plan_part_id ?? ''} is visible to you — read_rows on plan_parts by development_id or job_id lists a site's parts.` }
  const part = world.part
  if (p.job_id && world.job && world.job.plan_part_id !== part.id) {
    return { ok: false, refused: `${jobLabel(world.job)} builds from part ${world.job.plan_part_id ?? '(none)'}, not ${part.name} (${part.id}). Name the job's own part, or leave job_id out.` }
  }
  const onPart = (id: string | undefined): SetRow | null | false => (id ? (world.sets.find((s) => s.id === id) ?? false) : null)
  const current = world.sets.find((s) => s.id === part.current_set_id) ?? null
  if (p.action === 'add_set') {
    const replaces = onPart(p.replaces_set_id)
    if (replaces === false) return { ok: false, refused: `replaces_set_id ${p.replaces_set_id} is not a set on ${part.name}.` }
    if (replaces && PAPER_KIND_SET.has(replaces.kind)) return { ok: false, refused: `${replaces.name} is a paper; a set of drawings replaces a set of drawings.` }
    const marksUp = onPart(p.marks_up_set_id)
    if (marksUp === false) return { ok: false, refused: `marks_up_set_id ${p.marks_up_set_id} is not a set on ${part.name}.` }
    if (marksUp && PAPER_KIND_SET.has(marksUp.kind)) return { ok: false, refused: `${marksUp.name} is a paper; an as-built marks up a set of drawings.` }
    const asBuilt = p.kind === 'as_built'
    const makeCurrent = asBuilt ? false : (p.make_current ?? !current)
    const replacesSet = replaces ?? (makeCurrent && current ? current : null)
    const marksUpSet = asBuilt ? (marksUp ?? current) : marksUp
    const job = asBuilt && world.job ? { id: world.job.id, label: jobLabel(world.job) } : null
    const when = p.dated ? `dated ${datedWords(p.dated)}` : `came ${dayWords(todayYmd)}`
    return {
      ok: true,
      reply: {
        action: 'add_set',
        part: partWords(world),
        set: {
          name: p.name,
          kind: p.kind,
          kind_words: drawingKindLabel(p.kind),
          source: p.source,
          source_words: setSourceWords(p.source),
          dated: p.dated ?? null,
          memo: p.memo,
          link: p.link,
          replaces: named(replacesSet),
          marks_up: named(marksUpSet),
          job,
          line: `${drawingKindLabel(p.kind)} · ${setSourceWords(p.source)} · ${when}`,
        },
        make_current: makeCurrent,
        after: makeCurrent
          ? { builds_from: p.name, replaced: current ? current.name : null, job_plans_link: p.link ? 'every job on the part mirrors this link' : 'unchanged until the set has a link' }
          : { builds_from: current ? current.name : null, note: asBuilt ? 'an as-built sits under Our as-builts; the part keeps building from its set' : current ? `the part keeps building from ${current.name}; pass make_current: true to switch` : 'the part builds from nothing yet' },
        history_line: makeCurrent && part.development_id ? partSwitchLine(part.name, { name: p.name, dated: p.dated ?? null }, current?.name ?? null) : null,
        history: makeCurrent && part.development_id
          ? `Making it current writes this line on ${world.development?.name ?? 'the site'}'s History by the database's trigger (v2.6344): one per job on the part, or one for the site when no job names it, as you, at the moment of apply.`
          : makeCurrent
            ? 'A part of a job outside any development has no site History to write on; the job\'s Plans section reads the switch.'
            : 'A set that does not become current writes no History line; it reads on the job\'s Plans section and the site\'s Plans look.',
      },
    }
  }
  // keep a paper
  const goesWith = onPart(p.goes_with_set_id)
  if (goesWith === false) return { ok: false, refused: `goes_with_set_id ${p.goes_with_set_id} is not a set on ${part.name}.` }
  if (goesWith && PAPER_KIND_SET.has(goesWith.kind)) return { ok: false, refused: `${goesWith.name} is a paper; a paper goes with a set of drawings.` }
  const replaces = onPart(p.replaces_paper_id)
  if (replaces === false) return { ok: false, refused: `replaces_paper_id ${p.replaces_paper_id} is not a paper on ${part.name}.` }
  if (replaces && DRAWING_KIND_SET.has(replaces.kind)) return { ok: false, refused: `${replaces.name} is a set of drawings; a paper replaces a paper.` }
  const cameOn = p.came_on ?? todayYmd
  const job = p.job_id && world.job ? { id: world.job.id, label: jobLabel(world.job) } : null
  const siteName = world.development?.name?.trim() || (world.job ? jobLabel(world.job) : part.name)
  const ask = p.ask
    ? {
        lane: p.ask.lane,
        words: p.ask.words,
        about: job ? job.label : `🏠 ${siteName}`,
        lands_in: p.ask.lane === 'dispatch' ? 'dispatch_requests' : 'estimator_requests',
        pushed_by: p.ask.lane === 'dispatch' ? 'notify-dispatch-request' : 'notify-estimator-request',
      }
    : null
  const developmentId = part.development_id ?? world.job?.development_id ?? null
  return {
    ok: true,
    reply: {
      action: 'keep',
      part: partWords(world),
      paper: {
        name: p.name,
        kind: p.kind,
        kind_words: paperKindLabel(p.kind),
        from: p.from,
        from_words: paperFromWords(p.from),
        came_on: cameOn,
        memo: p.memo,
        link: p.link,
        goes_with: named(goesWith),
        replaces: named(replaces),
        job,
        owed: p.owed,
        line: `${paperKindLabel(p.kind)} · ${paperFromWords(p.from)} · ${p.owed ? 'asked' : 'came'} ${dayWords(cameOn)}`,
      },
      ask,
      papers_on_part: world.sets.filter((s) => PAPER_KIND_SET.has(s.kind)).length,
      history_line: developmentId ? paperHistoryLine(p, goesWith?.name ?? null, replaces?.name ?? null) : null,
      history: developmentId
        ? `The database writes this line on ${world.development?.name ?? 'the site'}'s History the moment the row lands (its trigger), as you, dated ${dayWords(cameOn)}.`
        : 'A job outside any development has no site History to write on; the paper reads on the job\'s Plans section.',
    },
  }
}

// ── the write ────────────────────────────────────────────────────────────────────────────────────────────────────

/** The writes, as the dev: an insert that returns the row, an update by query, and an edge function invoked with the dev's session. */
export type PartWrites = {
  insert: (table: string, row: Json) => Promise<Json>
  update: (table: string, query: string, patch: Json) => Promise<void>
  invoke: (fn: string, body: Json) => Promise<{ ok: boolean; error: string | null }>
  /** A read after the write, as the dev (0.92.0): a link change reads the row and its jobs back, so the reply says what stands. */
  rows?: (table: string, query: string) => Promise<Json[]>
}

/**
 * The rows, exactly as planSetsIo writes them. `reply` is the dry run apply just re-ran and matched, so its
 * resolved pieces (the part, the set it replaces, the ask's about) are the plan's own.
 */
export async function planPartApply(writes: PartWrites, p: PlanPartPayload, reply: Json, who: { userId: string }, nowIso: string): Promise<Json> {
  const part = reply.part as { id: string; name: string; development: { id: string; name: string | null } | null }
  if (p.action === 'came') {
    const paper = reply.paper as { id: string; name: string }
    await writes.update('plan_sets', `id=eq.${paper.id}`, { owed: false, link: p.link, came_at: nowIso })
    return { ok: true, action: 'came', paper_id: paper.id, name: paper.name, link: p.link, part_id: part.id, next: `${paper.name} reads under its set on the job's Plans section with its link; the Owed chip is gone.` }
  }
  if (p.action === 'change_link') {
    const set = reply.set as { id: string; name: string; link: string }
    const follows = reply.job_plans_link as { follows: boolean; jobs: Array<{ id: string; label: string }> }
    const patch: Json = { link: p.link, file_name: null, file_size: null, file_count: null, checked_at: null, check_note: null }
    if (p.memo !== undefined) patch.memo = p.memo
    await writes.update('plan_sets', `id=eq.${set.id}`, patch)
    // Read back: an update RLS or training mode let through no row answers without an error, and the mirror is the database's.
    let jobsRead: Array<{ id: string; label: string; follows: boolean }> | null = null
    if (writes.rows) {
      const after = (await writes.rows('plan_sets', `select=id,link&id=eq.${set.id}`))[0]
      if (String(after?.link ?? '') !== p.link) throw new Error(`Nothing changed: ${set.name} did not take the link. The update reached no row — RLS or training mode held it. Its link still reads ${String(after?.link ?? set.link) || '(none)'}.`)
      if (follows.follows && follows.jobs.length) {
        const now = await writes.rows('jobs_ledger', `select=id,job_plans_link&plan_part_id=eq.${part.id}&order=created_at&limit=${FOLLOWER_CAP}`)
        const linkOf = new Map(now.map((r) => [String(r.id), String(r.job_plans_link ?? '')]))
        jobsRead = follows.jobs.map((j) => ({ id: j.id, label: j.label, follows: linkOf.get(j.id) === p.link }))
      }
    }
    const behind = jobsRead ? jobsRead.filter((j) => !j.follows) : []
    return {
      ok: true,
      action: 'change_link',
      set_id: set.id,
      part_id: part.id,
      part: part.name,
      name: set.name,
      link_before: set.link,
      link: p.link,
      memo_changed: (reply.memo as { changed: boolean }).changed,
      builds_from_this_set: follows.follows,
      jobs: jobsRead,
      next: !follows.follows
        ? `${set.name} carries the new link on ${part.name}; the part builds from another set, so no job's plans link moved.`
        : !follows.jobs.length
          ? `${set.name} carries the new link and ${part.name} builds from it; no job names the part yet.`
          : jobsRead === null
            ? `${set.name} carries the new link; the database's mirror moves job_plans_link on the ${follows.jobs.length} job${follows.jobs.length === 1 ? '' : 's'} naming ${part.name} — get_job reads one back.`
            : behind.length
              ? `${set.name} carries the new link, but ${behind.map((j) => j.label).join(', ')} still ${behind.length === 1 ? 'reads' : 'read'} another plans link: the mirror did not reach ${behind.length === 1 ? 'it' : 'them'}. get_job shows the row.`
              : `${set.name} carries the new link, and job_plans_link on ${jobsRead.length === 1 ? jobsRead[0]!.label : `all ${jobsRead.length} jobs naming ${part.name}`} reads it: Open plans and the trade portal open the new link.`,
    }
  }
  if (p.action === 'add_set') {
    const set = reply.set as { replaces: { id: string } | null; marks_up: { id: string } | null; job: { id: string } | null }
    const made = await writes.insert('plan_sets', {
      part_id: part.id,
      name: p.name,
      kind: p.kind,
      source: p.source,
      dated: p.dated ?? null,
      memo: p.memo,
      link: p.link,
      replaces_set_id: set.replaces?.id ?? null,
      marks_up_set_id: set.marks_up?.id ?? null,
      job_id: set.job?.id ?? null,
      created_by: who.userId,
    })
    const setId = String(made.id ?? '')
    if (reply.make_current === true && setId) {
      await writes.update('plan_parts', `id=eq.${part.id}`, { current_set_id: setId, current_set_by: who.userId, current_set_at: nowIso })
    }
    return {
      ok: true,
      action: 'add_set',
      set_id: setId,
      part_id: part.id,
      part: part.name,
      name: p.name,
      builds_from: reply.make_current === true ? p.name : ((reply.after as Json | undefined)?.builds_from ?? null),
      next: reply.make_current === true
        ? `${part.name} builds from ${p.name} now${p.link ? '; every job on the part reads the link (the job\'s Open plans, the portal)' : ', with no link yet — the job\'s old link stays until the set has one'}. The job's Plans section and the site's Plans look show it.`
        : `${p.name} is on ${part.name}${p.kind === 'as_built' ? ' under Our as-builts' : ' under Older sets'}; the part still builds from what it did.`,
    }
  }
  // keep a paper: the ask first (as the app does), then the row that names it, then the lane's push.
  const askPlan = reply.ask as { lane: string; words: string; about: string } | null
  const paper = reply.paper as { came_on: string; goes_with: { id: string } | null; replaces: { id: string } | null; job: { id: string; label: string } | null }
  let askId: string | null = null
  let pushed: boolean | null = null
  let pushError: string | null = null
  if (askPlan) {
    const table = askPlan.lane === 'dispatch' ? 'dispatch_requests' : 'estimator_requests'
    const made = await writes.insert(table, {
      from_user_id: who.userId,
      title: askPlan.words,
      links: [],
      development_id: paper.job ? null : (part.development?.id ?? null),
      job_ledger_id: paper.job?.id ?? null,
      bid_id: null,
      reference_summary: askPlan.about,
    })
    askId = String(made.id ?? '') || null
    if (!askId) throw new Error(`The question was not written to ${table}.`)
  }
  const made = await writes.insert('plan_sets', {
    part_id: part.id,
    name: p.name,
    kind: p.kind,
    source: p.from,
    dated: null,
    came_at: `${paper.came_on}T12:00:00`,
    memo: p.memo,
    link: p.owed ? '' : p.link,
    marks_up_set_id: paper.goes_with?.id ?? null,
    replaces_set_id: paper.replaces?.id ?? null,
    job_id: paper.job?.id ?? null,
    owed: p.owed,
    ask_lane: askId ? askPlan!.lane : null,
    ask_request_id: askId,
    created_by: who.userId,
  })
  if (askPlan && askId) {
    const fn = askPlan.lane === 'dispatch' ? 'notify-dispatch-request' : 'notify-estimator-request'
    const r = await writes.invoke(fn, askPlan.lane === 'dispatch' ? { dispatch_request_id: askId } : { estimator_request_id: askId })
    pushed = r.ok
    pushError = r.error
  }
  return {
    ok: true,
    action: 'keep',
    paper_id: String(made.id ?? ''),
    part_id: part.id,
    part: part.name,
    name: p.name,
    owed: p.owed,
    ask: askPlan ? { lane: askPlan.lane, request_id: askId, pushed, push_error: pushError } : null,
    history_line: reply.history_line ?? null,
    next: p.owed
      ? `Owed: ${p.name} waits on ${part.name} with its ask in ${askPlan?.lane === 'dispatch' ? "Dispatch's" : "the estimators'"} inbox; when it lands, plan_paper { action: came, paper_id, link }.`
      : `${p.name} reads under ${paper.goes_with ? 'its set' : 'the part'} on the job's Plans section${reply.history_line ? ' and the site\'s History has its line' : ''}${askPlan ? `; the question is in ${askPlan.lane === 'dispatch' ? "Dispatch's" : "the estimators'"} inbox${pushed === false ? ' (the push did not go: they see it on their next open)' : ''}` : ''}.`,
  }
}

// ── a filed plan set lands on the bid's job's part too (plan_file_plans / apply_file_plans, twin-mcp file_plans) ──

/**
 * Two links are the same set when they differ only by space, a trailing slash or Drive's ?usp= tail: the database's
 * plan_set_link_key (migration 20261102060000) and the client's samePlanLink. A part that already holds the filed
 * link (a re-filing into the same project folder, or the set a job took from its bid) keeps its row.
 */
export function planLinkKey(link: string | null | undefined): string {
  return (link ?? '').trim().replace(/[?&]usp=[^&#]*/g, '').replace(/\?$/, '').replace(/\/+$/, '')
}

export type FiledPlansJob = { id: string; job_name: string | null; click_number: string | null; hcp_number: string | null; plan_part_id: string | null }
export type FiledPlansPart = { id: string; name: string; current_set_id: string | null }
export type FiledPlansTarget = { part_id: string; part_name: string; jobs: string[]; make_current: boolean }

/**
 * Where a bid's filed set lands beside bid_plan_sets (which stays the bid's own: it pins what the bid was priced
 * on): one plan_sets row on each distinct plan part the bid's jobs build from, current when the part has no set yet.
 * No job with a part → nothing more than the bid's row.
 */
export function filedPlansTargets(jobs: ReadonlyArray<FiledPlansJob>, parts: ReadonlyArray<FiledPlansPart>): FiledPlansTarget[] {
  const byPart = new Map<string, FiledPlansTarget>()
  for (const job of jobs) {
    if (!job.plan_part_id) continue
    const part = parts.find((p) => p.id === job.plan_part_id)
    if (!part) continue
    const t = byPart.get(part.id) ?? { part_id: part.id, part_name: part.name, jobs: [], make_current: !part.current_set_id }
    t.jobs.push(jobLabel(job))
    byPart.set(part.id, t)
  }
  return [...byPart.values()]
}

/** The plan_sets row a filed set becomes on a part: an issued set from the GC, the file's facts as plan-fetch keeps them. */
export function filedPlansSetRow(t: FiledPlansTarget, filed: { name: string; link: string; memo: string; file_name: string | null; file_size: number | null; pages: number | null; createdBy: string | null }, nowIso: string): Json {
  return {
    part_id: t.part_id,
    name: filed.name,
    kind: 'issued',
    source: 'gc',
    dated: null,
    memo: filed.memo,
    link: filed.link,
    file_name: filed.file_name,
    file_size: filed.file_size,
    file_count: filed.file_name ? 1 : null,
    checked_at: filed.file_name ? nowIso : null,
    check_note: filed.pages ? `${filed.pages} pages` : null,
    created_by: filed.createdBy,
  }
}

/** The words the file_plans reply adds: where the set landed beside the bid. */
export function filedPlansWords(targets: ReadonlyArray<FiledPlansTarget>): string {
  if (targets.length === 0) return 'No job of this bid has a plan part yet, so the set is the bid\'s alone (bid_plan_sets); when the job is made and names its part, the office adds the set there, or plan_plan_set does.'
  return targets.map((t) => `${t.part_name} (${t.jobs.join(', ')})${t.make_current ? ' — builds from it now' : ' — under Older sets; the part keeps its current set'}`).join('; ')
}
