/**
 * What a GC reads about the papers a job requires (punch list #389, step 5): for each job on their page that requires
 * a paper built from settings, the job's settings in the list's own plain words, the level they come to, how many of
 * the people who can open the job have signed, and each sub business with its day. No worker is named, unless the
 * office set the job to show every signer by name. The office can also set it to show the count alone.
 *
 * Since step 6 a GC may propose a stricter setting. The page gets what its sliders are drawn from, `propose`: the
 * list's names and plain words, the levels, the notice and the job's own picks. A settings list holds no clause, and
 * the lines the office reads beside a choice are left out here. It also gets the last proposal with its state.
 *
 * Since step 7 a job can require the GC's own form, which the office marks on the job. Such a form sits in a list of
 * its own, `ownForms`, beside `papers`: its name, the count and each sub business with its day. It has no settings, so
 * nothing of a level, a sample or a proposal. A page or a function of an older build reads `papers` and leaves the
 * rest, so it never draws a form as a paper built from settings.
 *
 * The database answers it whole (`job_papers_gc_page`, the service key only). This file shapes that answer for the
 * page, reads it back on the page, and asks for it. It imports nothing, so the app and its tests read the same file
 * (`src/lib/portal/gcJobPapers.ts`).
 */

/** One setting as the paper's list says it: its name, the choice picked, the choice's plain words, and whether the choice leaves the topic out. */
export interface GcPaperSaid {
  label: string
  choice: string
  says: string
  out: boolean
}

/** A sub business on the job: how many of its people can open the job, how many signed, and the day the last signed once all have. */
export interface GcPaperBusiness {
  name: string
  people: number
  signed: number
  signedOn: string | null
}

/**
 * What the office set a GC to see of who has signed: the count alone, the count and each sub business with its day
 * (how every paper starts), or those and every signer by name.
 */
export type GcPaperView = 'count' | 'businesses' | 'names'
export const GC_PAPER_VIEWS: readonly GcPaperView[] = ['count', 'businesses', 'names']

/** Anything that is not one of the three reads as the way every paper starts. */
export function gcPaperViewOf(v: unknown): GcPaperView {
  const word = typeof v === 'string' ? v.trim().toLowerCase() : ''
  return word === 'count' || word === 'names' ? word : 'businesses'
}

/** One person who has signed, under 'names': their name, the trade company of a sub, and the day. */
export interface GcPaperSigner {
  name: string
  business: string | null
  signedOn: string | null
}

/** Where a GC's proposal stands. Overtaken: a newer one, a change of the paper's settings, or the paper came off. */
export type GcProposalState = 'waiting' | 'taken' | 'declined' | 'overtaken'
export const GC_PROPOSAL_STATES: readonly GcProposalState[] = ['waiting', 'taken', 'declined', 'overtaken']

/** The last proposal the GC made on this paper: what it asked for, who typed their name, and the office's answer. */
export interface GcPaperProposal {
  state: GcProposalState
  byName: string
  /** Instants, as the database wrote them. The page words each as the company's day. */
  proposedAt: string | null
  decidedAt: string | null
  /** The office's reason for a decline. */
  why: string | null
  picks: Record<string, string>
}

/** What the GC's sliders are drawn from: the settings list as their page gets it, and the job's picks and basis. */
export interface GcPaperPropose {
  def: Record<string, unknown>
  picks: Record<string, string>
  basis: string | null
}

/** What a GC's page sends to propose: the paper, a choice for every topic, a typed name and the notice's tick. */
export interface GcProposalAsk {
  requiredPaperId: string
  picks: Record<string, string>
  name: string
  noticeRead: boolean
}

export const GC_PROPOSAL_NAME_MAX = 120

export interface GcJobPaper {
  id: string
  name: string
  /** The row's number in its chain: 1, then one up for every change made after a signature. */
  settingsRevision: number
  /** The level the job's picks come to, or null for a mix of its own. */
  level: { label: string; alignedWith: string } | null
  said: GcPaperSaid[]
  /** How many of the people who can open the job have signed this paper, and how many can open it. */
  signed: number
  total: number
  /** What the office set this GC to see. The two lists below already follow it. */
  view: GcPaperView
  /** Empty under 'count'. */
  businesses: GcPaperBusiness[]
  /** Filled only under 'names'. */
  signers: GcPaperSigner[]
  /** What a proposal is drawn from, or null when the list did not come with the paper. */
  propose: GcPaperPropose | null
  /** The last proposal on this paper, or null when there is none. */
  proposal: GcPaperProposal | null
}

/**
 * The GC's own form, required on the job as the office marked it: its name, how many of the people who can open the
 * job have signed it, and each sub business with its day. No worker is named.
 */
export interface GcOwnForm {
  id: string
  name: string
  signed: number
  total: number
  businesses: GcPaperBusiness[]
}

export interface GcJobPapers {
  jobId: string
  jobLabel: string
  /** The papers built from settings. Empty on a job that requires only the GC's own form. */
  papers: GcJobPaper[]
  /** The forms the office marked as the GC's own. Empty on most jobs. */
  ownForms: GcOwnForm[]
}

type Bag = Record<string, unknown>
const bag = (v: unknown): Bag | null => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Bag) : null)
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const count = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0)
const day = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null)

const instant = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) ? v : null)
const KEY = /^[a-z][a-z0-9_]{0,39}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** One choice a setting, by key: only keys and choices that are keys, and at most forty of them. */
function picksFrom(v: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  const b = bag(v)
  if (!b) return out
  for (const [k, x] of Object.entries(b).slice(0, 40)) if (KEY.test(k) && typeof x === 'string' && KEY.test(x)) out[k] = x
  return out
}

const linesFrom = (v: unknown): string[] => list(v).flatMap((x) => (text(x) ? [text(x)] : []))

/**
 * A settings list as a GC's page gets it: each topic with its choices from loosest to strictest, as a name and the
 * plain words the summary says, the levels with their picks, and the notice. What the office reads beside a choice
 * (what puts a person in breach, what the site must have), the blanks, the site note and the Spanish are left out.
 * Null when it is no list at all. Reading the page's own copy back gives the same list.
 */
export function gcProposeDef(raw: unknown): Record<string, unknown> | null {
  const d = bag(raw)
  if (!d) return null
  const settings = list(d.settings).flatMap((x) => {
    const s = bag(x)
    const key = text(s?.key)
    if (!s || !key) return []
    const choices = list(s.choices).flatMap((y) => {
      const c = bag(y)
      const ckey = text(c?.key)
      return c && ckey ? [{ key: ckey, label: text(c.label), says: text(c.says), ...(c.out === true ? { out: true } : {}) }] : []
    })
    return [{ key, label: text(s.label), choices }]
  })
  if (settings.length === 0) return null
  const levels = list(d.levels).flatMap((x) => {
    const l = bag(x)
    const key = text(l?.key)
    return l && key ? [{ key, label: text(l.label), alignedWith: text(l.alignedWith), picks: picksFrom(l.picks) }] : []
  })
  const notice = bag(d.notice)
  const noticeLines = linesFrom(notice?.lines)
  return { settings, levels, ...(notice && noticeLines.length > 0 ? { notice: { title: text(notice.title), tick: text(notice.tick), lines: noticeLines } } : {}) }
}

function proposeFrom(def: unknown, picks: unknown, basis: unknown): GcPaperPropose | null {
  const trimmed = gcProposeDef(def)
  return trimmed ? { def: trimmed, picks: picksFrom(picks), basis: text(basis) || null } : null
}

function proposalFrom(v: unknown, sql: boolean): GcPaperProposal | null {
  const x = bag(v)
  const state = GC_PROPOSAL_STATES.find((s) => s === text(x?.state))
  if (!x || !state) return null
  return {
    state,
    byName: text(sql ? x.by_name : x.byName),
    proposedAt: instant(sql ? x.proposed_at : x.proposedAt),
    decidedAt: instant(sql ? x.decided_at : x.decidedAt),
    why: text(x.why) || null,
    picks: picksFrom(sql ? x.settings : x.picks),
  }
}

/**
 * What a GC's page sent to propose, read defensively, or null when it is not a proposal at all. The database decides
 * every rule after this: whose job it is, that no topic loosens and one tightens, the name and the notice's tick.
 */
export function gcProposalAsk(body: unknown): GcProposalAsk | null {
  const b = bag(body)
  const requiredPaperId = text(b?.requiredPaperId)
  if (!b || !UUID.test(requiredPaperId) || !bag(b.picks)) return null
  return { requiredPaperId, picks: picksFrom(b.picks), name: text(b.name).slice(0, GC_PROPOSAL_NAME_MAX), noticeRead: b.noticeRead === true }
}

function saidFrom(v: unknown): GcPaperSaid[] {
  return list(v).flatMap((x) => {
    const s = bag(x)
    const label = text(s?.label)
    return s && label ? [{ label, choice: text(s.choice), says: text(s.says), out: s.out === true }] : []
  })
}

/** A business with nobody on it is dropped, and nobody is counted as signed past the people it has. */
function businessesFrom(v: unknown, dayKey: 'signed_on' | 'signedOn'): GcPaperBusiness[] {
  return list(v).flatMap((x) => {
    const b = bag(x)
    const name = text(b?.name)
    const people = count(b?.people)
    if (!b || !name || people === 0) return []
    const signed = Math.min(count(b.signed), people)
    return [{ name, people, signed, signedOn: signed === people ? day(b[dayKey]) : null }]
  })
}

function signersFrom(v: unknown, dayKey: 'signed_on' | 'signedOn'): GcPaperSigner[] {
  return list(v).flatMap((x) => {
    const g = bag(x)
    const name = text(g?.name)
    return g && name ? [{ name, business: text(g.business) || null, signedOn: day(g[dayKey]) }] : []
  })
}

function paperFrom(x: unknown, keys: { name: string; revision: string; aligned: string; dayKey: 'signed_on' | 'signedOn'; sql: boolean }): GcJobPaper | null {
  const p = bag(x)
  const id = text(p?.id)
  const name = text(p?.[keys.name])
  if (!p || !id || !name) return null
  const level = bag(p.level)
  const levelLabel = text(level?.label)
  const total = count(p.total)
  // The setting is honoured here as well as in the database: a list the view hides is never handed on.
  const view = gcPaperViewOf(p.view)
  return {
    id,
    name,
    settingsRevision: Math.max(1, count(p[keys.revision])),
    level: level && levelLabel ? { label: levelLabel, alignedWith: text(level[keys.aligned]) } : null,
    said: saidFrom(p.said),
    signed: Math.min(count(p.signed), total),
    total,
    view,
    businesses: view === 'count' ? [] : businessesFrom(p.businesses, keys.dayKey),
    signers: view === 'names' ? signersFrom(p.signers, keys.dayKey) : [],
    // From the database the list, the picks and the basis sit on the paper. On the page they sit under `propose`.
    propose: keys.sql ? proposeFrom(p.def, p.picks, p.basis) : proposeFrom(bag(p.propose)?.def, bag(p.propose)?.picks, bag(p.propose)?.basis),
    proposal: proposalFrom(p.proposal, keys.sql),
  }
}

function ownFormFrom(x: unknown, keys: { name: string; dayKey: 'signed_on' | 'signedOn' }): GcOwnForm | null {
  const f = bag(x)
  const id = text(f?.id)
  const name = text(f?.[keys.name])
  if (!f || !id || !name) return null
  const total = count(f.total)
  return { id, name, signed: Math.min(count(f.signed), total), total, businesses: businessesFrom(f.businesses, keys.dayKey) }
}

/**
 * The database's answer, for the jobs this page shows the customer as the GC on. A job the page does not list is
 * dropped, so the answer can never name a job that is not theirs. The jobs keep the page's own order. A job is kept
 * when it has a paper or one of the GC's own forms.
 */
export function gcJobPapersFromSql(raw: unknown, gcJobs: ReadonlyArray<{ id: string; label: string }>): GcJobPapers[] {
  const byJob = new Map<string, { papers: GcJobPaper[]; ownForms: GcOwnForm[] }>()
  for (const x of list(raw)) {
    const j = bag(x)
    const jobId = text(j?.job_id)
    if (!j || !jobId) continue
    const papers = list(j.papers).flatMap((p) => {
      const paper = paperFrom(p, { name: 'paper_name', revision: 'settings_revision', aligned: 'aligned_with', dayKey: 'signed_on', sql: true })
      return paper ? [paper] : []
    })
    const ownForms = list(j.own_forms).flatMap((f) => {
      const form = ownFormFrom(f, { name: 'paper_name', dayKey: 'signed_on' })
      return form ? [form] : []
    })
    if (papers.length > 0 || ownForms.length > 0) byJob.set(jobId, { papers, ownForms })
  }
  return gcJobs.flatMap((job) => {
    const found = byJob.get(job.id)
    return found ? [{ jobId: job.id, jobLabel: job.label, papers: found.papers, ownForms: found.ownForms }] : []
  })
}

/** The page's own key, read back defensively: anything that does not read is left out. */
export function parseGcJobPapers(value: unknown): GcJobPapers[] {
  return list(value).flatMap((x) => {
    const j = bag(x)
    const jobId = text(j?.jobId)
    if (!j || !jobId) return []
    const papers = list(j.papers).flatMap((p) => {
      const paper = paperFrom(p, { name: 'name', revision: 'settingsRevision', aligned: 'alignedWith', dayKey: 'signedOn', sql: false })
      return paper ? [paper] : []
    })
    const ownForms = list(j.ownForms).flatMap((f) => {
      const form = ownFormFrom(f, { name: 'name', dayKey: 'signedOn' })
      return form ? [form] : []
    })
    return papers.length > 0 || ownForms.length > 0 ? [{ jobId, jobLabel: text(j.jobLabel), papers, ownForms }] : []
  })
}

type Admin = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }> }

/** `gcJobs` are the jobs on this page that the customer is the GC on, with the label the page gives each. */
export async function gcJobPapers(admin: Admin, gcJobs: ReadonlyArray<{ id: string; label: string }>): Promise<GcJobPapers[]> {
  if (gcJobs.length === 0) return []
  const { data, error } = await admin.rpc('job_papers_gc_page', { p_job_ids: gcJobs.map((j) => j.id) })
  if (error) throw new Error(`the job's papers: ${error.message}`)
  return gcJobPapersFromSql(data, gcJobs)
}

/** The same, and an empty list when the read fails: a page that cannot read a job's papers still draws everything else. */
export async function gcJobPapersOrNone(admin: Admin, gcJobs: ReadonlyArray<{ id: string; label: string }>): Promise<GcJobPapers[]> {
  try {
    return await gcJobPapers(admin, gcJobs)
  } catch (e) {
    console.error('customer-portal job papers', e instanceof Error ? e.message : String(e))
    return []
  }
}
