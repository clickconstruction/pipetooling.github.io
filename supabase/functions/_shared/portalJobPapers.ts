/**
 * What a GC reads about the papers a job requires (punch list #389, step 5): for each job on their page that requires
 * a paper built from settings, the job's settings in the list's own plain words, the level they come to, how many of
 * the people who can open the job have signed, and each sub business with its day. No worker is named, unless the
 * office set the job to show every signer by name. The office can also set it to show the count alone.
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
}

export interface GcJobPapers {
  jobId: string
  jobLabel: string
  papers: GcJobPaper[]
}

type Bag = Record<string, unknown>
const bag = (v: unknown): Bag | null => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Bag) : null)
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const count = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0)
const day = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null)

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

function paperFrom(x: unknown, keys: { name: string; revision: string; aligned: string; dayKey: 'signed_on' | 'signedOn' }): GcJobPaper | null {
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
  }
}

/**
 * The database's answer, for the jobs this page shows the customer as the GC on. A job the page does not list is
 * dropped, so the answer can never name a job that is not theirs. The jobs keep the page's own order.
 */
export function gcJobPapersFromSql(raw: unknown, gcJobs: ReadonlyArray<{ id: string; label: string }>): GcJobPapers[] {
  const byJob = new Map<string, GcJobPaper[]>()
  for (const x of list(raw)) {
    const j = bag(x)
    const jobId = text(j?.job_id)
    if (!j || !jobId) continue
    const papers = list(j.papers).flatMap((p) => {
      const paper = paperFrom(p, { name: 'paper_name', revision: 'settings_revision', aligned: 'aligned_with', dayKey: 'signed_on' })
      return paper ? [paper] : []
    })
    if (papers.length > 0) byJob.set(jobId, papers)
  }
  return gcJobs.flatMap((job) => {
    const papers = byJob.get(job.id)
    return papers ? [{ jobId: job.id, jobLabel: job.label, papers }] : []
  })
}

/** The page's own key, read back defensively: anything that does not read is left out. */
export function parseGcJobPapers(value: unknown): GcJobPapers[] {
  return list(value).flatMap((x) => {
    const j = bag(x)
    const jobId = text(j?.jobId)
    if (!j || !jobId) return []
    const papers = list(j.papers).flatMap((p) => {
      const paper = paperFrom(p, { name: 'name', revision: 'settingsRevision', aligned: 'alignedWith', dayKey: 'signedOn' })
      return paper ? [paper] : []
    })
    return papers.length > 0 ? [{ jobId, jobLabel: text(j.jobLabel), papers }] : []
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
