/**
 * The Drive pass (Contract sweep, last PR): match contract-looking files in
 * the jobs Shared Drive to the jobs without a contract. Pure — the edge
 * function `drive-contract-scan` lists the files, this decides which job each
 * one belongs to and how sure we are. Confidence is stated, never hidden:
 *
 *   confident — the folder names the job's street (number + street) or its
 *               job number, and the file name has a contract word
 *   check     — only the customer name or the job name matched, or the file
 *               name is a weaker word (proposal, terms, T&C)
 *   none      — nothing matched
 */

export type DriveScanFile = {
  id: string
  name: string
  mimeType: string
  modifiedTime: string | null
  webViewLink: string | null
  size: number | null
  /** The job folder the file sits in (directly, or one level down). */
  folderId: string
  folderName: string
}

export type DriveMatchJob = {
  id: string
  jobNumber: string
  jobName: string
  jobAddress: string
  customerName: string
  gcName: string | null
}

export type DriveMatchConfidence = 'confident' | 'check' | 'none'

export type DriveContractMatch = {
  file: DriveScanFile
  jobId: string | null
  confidence: DriveMatchConfidence
  /** One line the reviewer reads: "folder names 2100 Independence Dr · signed subcontract". */
  reason: string
  /** GC subcontract vs our agreement, from the file name. */
  kind: 'subcontract' | 'agreement' | 'other'
}

const STRONG_WORDS = /\b(contract|agreement|subcontract|sub-contract|signed|executed|countersigned)\b/i
const WEAK_WORDS = /\b(proposal|terms|t&c|scope|work order)\b/i
const NOT_CONTRACT = /\b(invoice|estimate|quote|plans?|drawings?|permit|w-?9|coi|insurance|lien|waiver|release|receipt|photo|img_|change order)\b/i

/** Does the file name read like a contract? Strong words beat exclusions only when both appear ("signed change order" is not). */
export function contractFileStrength(name: string): 'strong' | 'weak' | 'no' {
  const n = name.replace(/[_\-.]+/g, ' ')
  if (NOT_CONTRACT.test(n) && !/\b(sub-?contract|agreement)\b/i.test(n)) return 'no'
  if (STRONG_WORDS.test(n)) return 'strong'
  if (WEAK_WORDS.test(n)) return 'weak'
  return 'no'
}

export function contractFileKind(name: string): DriveContractMatch['kind'] {
  const n = name.replace(/[_\-.]+/g, ' ')
  if (/\bsub-?contract/i.test(n)) return 'subcontract'
  if (/\b(agreement|contract)\b/i.test(n)) return 'agreement'
  return 'other'
}

/** "2100 Independence Dr, New Braunfels, TX 78130" → "2100 independence" (number + first street word). */
export function streetKey(address: string): string | null {
  const first = address.split(',')[0]?.trim() ?? ''
  const m = /^(\d+[a-z]?)\s+(?:\d+\/\d+\s+)?([a-z0-9']+)/i.exec(first.replace(/\s+/g, ' '))
  if (!m) return null
  return `${m[1]!.toLowerCase()} ${m[2]!.toLowerCase()}`
}

export function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Folder name mentions the job: by street, by number (J523 / 523 as a token), by job name, by customer/GC name. */
export function folderMatchesJob(folderName: string, job: DriveMatchJob): { strength: 'street' | 'number' | 'name' | 'customer' | null; detail: string } {
  const f = normalizeName(folderName)
  // The job number first: two jobs can share a street, never a number.
  if (job.jobNumber && new RegExp(`(^|[^0-9])j?${job.jobNumber}([^0-9]|$)`, 'i').test(f)) return { strength: 'number', detail: `folder names J${job.jobNumber}` }
  const street = streetKey(job.jobAddress)
  if (street && f.includes(street)) return { strength: 'street', detail: `folder names ${job.jobAddress.split(',')[0]?.trim() ?? street}` }
  const jn = normalizeName(job.jobName)
  if (jn.length >= 6 && f.includes(jn)) return { strength: 'name', detail: `folder names the job "${job.jobName}"` }
  for (const who of [job.customerName, job.gcName ?? '']) {
    const c = normalizeName(who)
    if (c.length >= 5 && f.includes(c)) return { strength: 'customer', detail: `folder names ${who}` }
  }
  return { strength: null, detail: '' }
}

/**
 * Match every scanned file to at most one job. When two jobs both match a
 * folder (two jobs at one address), the file goes to the job whose number
 * the folder names, else stays a "check".
 */
export function matchDriveContracts(files: ReadonlyArray<DriveScanFile>, jobs: ReadonlyArray<DriveMatchJob>): DriveContractMatch[] {
  const out: DriveContractMatch[] = []
  for (const file of files) {
    const strength = contractFileStrength(file.name)
    const kind = contractFileKind(file.name)
    if (strength === 'no') {
      out.push({ file, jobId: null, confidence: 'none', reason: 'does not read as a contract', kind })
      continue
    }
    const hits = jobs
      .map((job) => ({ job, m: folderMatchesJob(file.folderName, job) }))
      .filter((h) => h.m.strength != null)
    if (hits.length === 0) {
      out.push({ file, jobId: null, confidence: 'none', reason: 'no job matches the folder', kind })
      continue
    }
    const rank: Record<NonNullable<ReturnType<typeof folderMatchesJob>['strength']>, number> = { number: 0, street: 1, name: 2, customer: 3 }
    hits.sort((a, b) => rank[a.m.strength!] - rank[b.m.strength!])
    const best = hits[0]!
    const tied = hits.filter((h) => h.m.strength === best.m.strength).length > 1
    const word = strength === 'strong' ? (kind === 'subcontract' ? 'signed subcontract' : 'contract') : `weaker word in the file name`
    const strongFolder = best.m.strength === 'street' || best.m.strength === 'number'
    const confidence: DriveMatchConfidence = strongFolder && strength === 'strong' && !tied ? 'confident' : 'check'
    const why = tied ? `${best.m.detail} — but ${hits.length} jobs match this folder` : best.m.detail
    out.push({ file, jobId: best.job.id, confidence, reason: `${why} · ${word}`, kind })
  }
  return out
}

/** "2026-09-02T15:04:05.000Z" → "2026-09-02" for Signed on; null when missing. */
export function signedOnFromModified(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

export function summarizeDriveMatches(matches: ReadonlyArray<DriveContractMatch>): { confident: number; check: number; none: number; jobsCovered: number } {
  const covered = new Set<string>()
  let confident = 0
  let check = 0
  let none = 0
  for (const m of matches) {
    if (m.confidence === 'confident') {
      confident++
      if (m.jobId) covered.add(m.jobId)
    } else if (m.confidence === 'check') check++
    else none++
  }
  return { confident, check, none, jobsCovered: covered.size }
}
