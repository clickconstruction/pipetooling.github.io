/**
 * Several stamped affidavits scanned at once (punch list #366). The office files liens in batches and the clerk's
 * stamped copies come back together. v2.7480 took one scan on one job's **Record filing…**; twelve filed liens were
 * twelve trips to twelve windows. The owner's steer of 2026-11-16: *aim towards one PDF per lien, but if they are all
 * for one person a user may scan a whole stack*.
 *
 * So one window takes many scans and always ends with one file a lien, on that lien's own job: a job's folder never
 * holds another job's affidavit. What the office hands in is a list of **pieces**. Here a piece is one picked file;
 * the stack's splitter (`lienScanStack.ts`) makes a piece of each run of pages, and the plan below is the same.
 *
 * A piece is matched to a lien by what its name says, the recording number first and the job's number second, and
 * otherwise by its place in the list. The office sees which rule matched and changes any of them: the match is a
 * guess, and the stamp on the page beside the number the office typed is the check.
 *
 * Do what is ready, never all or nothing: a piece with no lien, a second piece for the same lien, or a file the
 * job's folder cannot take stays out with its reason, and the rest are saved. Pure; `lienScanBatchIo.ts` writes.
 */
import { batchOutcomeWords, batchWords, type BatchOutcome, type BatchWords } from '../batchWords'
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'
import type { JobLienFilingRow } from './lienDeadlines'
import { lienScanProblem, type LienScanFileLike } from './lienScanFile'

/** A filed affidavit that can take a scan. */
export type LienScanTarget = {
  filingId: string
  jobId: string
  jobNumber: string
  /** *2291 · Cedar Hollow Lofts* */
  jobLabel: string
  /** The number the office typed on Record filing; '' when none yet. */
  recordingNumber: string
  /** The day filed, YYYY-MM-DD. */
  filedYmd: string
  county: string
  /** The filing already has a saved copy. The window lists these only when asked, and saving replaces the link. */
  hasScan: boolean
}

/** The desk's own data, as much of it as this reads. */
export type LienScanDeskData = {
  filingsByJob: Readonly<Record<string, ReadonlyArray<JobLienFilingRow>>>
  jobsById: Readonly<Record<string, { hcp_number: string | null; click_number?: string | null; job_name: string | null } | undefined>>
}

const byNumber = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true })

/**
 * Every filed, live affidavit on the desk, in the order a batch was printed for the clerk: by county, then by the
 * job's number. A stack scanned as it came back from the counter is in about that order. No read of its own.
 */
export function lienScanTargetsFromDesk(data: LienScanDeskData): LienScanTarget[] {
  const out: LienScanTarget[] = []
  for (const [jobId, filings] of Object.entries(data.filingsByJob)) {
    for (const f of filings) {
      if (f.kind !== 'affidavit' || !f.filed_at || f.voided_at) continue
      const job = data.jobsById[jobId]
      // The job's number as the rest of the desk reads it (v2.7943): the HCP number, else the Click number of a job made in the app.
      const jobNumber = effectiveJobLedgerNumber(job?.hcp_number, job?.click_number)
      out.push({
        filingId: f.id,
        jobId,
        jobNumber,
        jobLabel: [jobNumber, (job?.job_name ?? '').trim()].filter(Boolean).join(' · ') || 'A job',
        recordingNumber: (f.recording_number ?? '').trim(),
        filedYmd: (f.filed_at ?? '').trim().slice(0, 10),
        county: (f.county ?? '').trim(),
        hasScan: ((f as { document_url?: string | null }).document_url ?? '').trim() !== '',
      })
    }
  }
  return out.sort((a, b) => a.county.localeCompare(b.county) || byNumber(a.jobNumber, b.jobNumber) || a.filingId.localeCompare(b.filingId))
}

/** One thing the office handed in for one lien: a picked file, or a run of a stack's pages. */
export type LienScanPiece = LienScanFileLike & {
  /** Unique in the window. */
  key: string
}

/** How a piece came to its lien: its name carried the recording number or the job's number, it took the next free lien in order, a person picked it, or it is a lien's pages of a split stack (`lienScanStack.ts`), whose own page rows say how each page got there. */
export type LienScanMatchRule = 'recording_number' | 'job_number' | 'order' | 'hand' | 'stack'

export type LienScanMatch = { filingId: string; by: LienScanMatchRule } | null

const digits = (s: string) => s.replace(/\D+/g, '')

/** A recording number long enough to be told from a date or a page count. */
const MIN_NUMBER_DIGITS = 6

function nameHasRecordingNumber(name: string, recordingNumber: string): boolean {
  const want = digits(recordingNumber)
  return want.length >= MIN_NUMBER_DIGITS && digits(name).includes(want)
}

/** The job's number as a word of its own in the name: *2291* in *Job 2291 stamped.pdf*, never inside *12291* or a date's digits run together. */
function nameHasJobNumber(name: string, jobNumber: string): boolean {
  const n = jobNumber.trim()
  if (!n) return false
  const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^0-9A-Za-z])${escaped}([^0-9A-Za-z]|$)`, 'i').test(name.replace(/\.[a-z0-9]{1,5}$/i, ''))
}

/**
 * A first match for every piece. A name that carries one lien's recording number wins; then a name that carries one
 * lien's job number; a piece whose name says neither takes the next lien nobody has, in the list's order. A lien is
 * given to one piece only, and a name that fits two liens fits none. A piece left over has no lien.
 */
export function lienScanMatches(pieces: ReadonlyArray<Pick<LienScanPiece, 'key' | 'name'>>, targets: ReadonlyArray<LienScanTarget>): Record<string, LienScanMatch> {
  const out: Record<string, LienScanMatch> = {}
  const taken = new Set<string>()
  const only = (found: LienScanTarget[]): LienScanTarget | null => (found.length === 1 ? (found[0] ?? null) : null)
  const pass = (rule: 'recording_number' | 'job_number', fits: (name: string, t: LienScanTarget) => boolean) => {
    for (const p of pieces) {
      if (out[p.key]) continue
      const t = only(targets.filter((x) => !taken.has(x.filingId) && fits(p.name, x)))
      if (!t) continue
      out[p.key] = { filingId: t.filingId, by: rule }
      taken.add(t.filingId)
    }
  }
  pass('recording_number', (name, t) => nameHasRecordingNumber(name, t.recordingNumber))
  pass('job_number', (name, t) => nameHasJobNumber(name, t.jobNumber))
  const free = targets.filter((t) => !taken.has(t.filingId))
  for (const p of pieces) {
    if (out[p.key]) continue
    const t = free.shift()
    out[p.key] = t ? { filingId: t.filingId, by: 'order' } : null
  }
  return out
}

/** Under a piece: why it stands where it does. A guess says to check it. */
export const LIEN_SCAN_MATCH_WORDS: Record<LienScanMatchRule, string> = {
  recording_number: 'Its name has this lien’s recording number.',
  job_number: 'Its name has this job’s number.',
  order: 'Matched by its place in the list. Check it against the stamp.',
  hand: '',
  stack: '',
}

export type LienScanHoldKey = 'no_lien' | 'second_for_lien' | 'bad_file'

/** A piece that is saved, with where it goes. */
export type LienScanReady = { piece: LienScanPiece; target: LienScanTarget }
/** A piece that stays out, with its reason in a sentence. */
export type LienScanHeld = { piece: LienScanPiece; key: LienScanHoldKey; reason: string }

export type LienScanPlan = {
  ready: LienScanReady[]
  held: LienScanHeld[]
  /** Liens in the window that no piece is going to. They stay as they are. */
  without: LienScanTarget[]
}

/**
 * What one press saves and what it leaves, the pieces in the window's order. The first piece for a lien takes it; a
 * second for the same lien is held, since a filing keeps one saved copy.
 */
export function lienScanPlan(pieces: ReadonlyArray<LienScanPiece>, matches: Readonly<Record<string, LienScanMatch | undefined>>, targets: ReadonlyArray<LienScanTarget>): LienScanPlan {
  const byId = new Map(targets.map((t) => [t.filingId, t]))
  const ready: LienScanReady[] = []
  const held: LienScanHeld[] = []
  const taken = new Set<string>()
  for (const piece of pieces) {
    const problem = lienScanProblem(piece, 'affidavit')
    if (problem) {
      held.push({ piece, key: 'bad_file', reason: problem })
      continue
    }
    const target = byId.get(matches[piece.key]?.filingId ?? '')
    if (!target) {
      held.push({ piece, key: 'no_lien', reason: 'No lien is picked for it.' })
      continue
    }
    if (taken.has(target.filingId)) {
      held.push({ piece, key: 'second_for_lien', reason: `${target.jobLabel} already has a scan above. A lien keeps one.` })
      continue
    }
    taken.add(target.filingId)
    ready.push({ piece, target })
  }
  return { ready, held, without: targets.filter((t) => !taken.has(t.filingId)) }
}

/** The press: *Save 12 scans · 1 held ▸*, dead only when nothing is ready. */
export function lienScanPlanWords(plan: Pick<LienScanPlan, 'ready' | 'held'>): BatchWords {
  return batchWords({ verb: 'Save', ready: plan.ready.length, held: plan.held.length, noun: 'scan' })
}

/** After the press: what took and what did not. A scan that did not save stays in the window with its reason. */
export function lienScanOutcome(done: number, failed: number): BatchOutcome {
  return batchOutcomeWords({ verb: 'save', past: 'saved', done, failed, noun: 'scan' })
}

/** A lien as the picker names it: *2291 · Cedar Hollow Lofts · no. 2026-0041877*. The number is what the office reads off the stamp. */
export function lienScanTargetWords(t: Pick<LienScanTarget, 'jobLabel' | 'recordingNumber'>): string {
  return t.recordingNumber ? `${t.jobLabel} · no. ${t.recordingNumber}` : `${t.jobLabel} · no recording number yet`
}

/** Over the list: how many filed liens have no scan. */
export function lienScanLeadWords(targets: ReadonlyArray<Pick<LienScanTarget, 'hasScan'>>): string {
  const n = targets.filter((t) => !t.hasScan).length
  if (n === 0) return 'Every filed lien has its scan.'
  return n === 1 ? '1 filed lien has no scan yet.' : `${n} filed liens have no scan yet.`
}

export const LIEN_SCAN_BATCH_WORDS = {
  title: 'Add the stamped scans',
  /** The door, wherever it stands. */
  door: 'Add the stamped scans ›',
  pick: 'Choose the scans',
  more: 'Choose more',
  how: 'One PDF for each lien is best. Name a file with its recording number or its job number and it finds its lien.',
  check: 'Check each one against the clerk’s stamp before you save.',
  withScans: 'Also list liens that already have a scan',
  none: 'Pick a lien',
  open: 'Open',
  remove: 'Remove',
  where: 'Each scan goes to its own job’s Drive folder, under Sent by us, and becomes that filing’s saved copy.',
} as const

/** Under the single upload on a job's Record filing: the door to this window, on the Lien desk. */
export const LIEN_SCANS_DOOR_FROM_FILING = 'Scanned several liens at once? Add them on the Lien desk ›'
