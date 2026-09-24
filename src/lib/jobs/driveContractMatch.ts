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
 *   none      — nothing matched, or the paper names another address
 *
 * A file whose own name or folder chain names a street that is not the job's
 * is nobody's find for that job, whatever else matched (live 2026-09-24: a
 * customer folder's "105 Dover" contract was offered to that customer's job at
 * 141 Encino; "9511 Arcade Ridge signed contract" to a job at 214 Beechwood).
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
/** Never a contract, whatever else the name says: samples, templates, riders, reports, lien paper, change orders. */
const NEVER_CONTRACT = /\b(sample|template|exhibit|rider|registration|insurance|inspection|report|geotech|geo|specs?|division|procurement|budget|schedule|lien|waiver|release|change order)\b/i
/** Not a contract unless the name also says contract / agreement. */
const NOT_CONTRACT = /\b(invoice|quote|plans?|drawings?|permit|w-?9|coi|receipt|photo|img_)\b/i

/** Does the file name read like a contract? An exclusion word wins unless the name also says contract / agreement ("signed change order" and "signed inspection report" are not). */
export function contractFileStrength(name: string): 'strong' | 'weak' | 'no' {
  const n = name.replace(/[_\-.]+/g, ' ')
  if (NEVER_CONTRACT.test(n)) return 'no'
  if (NOT_CONTRACT.test(n) && !/\b(sub-?contract|agreement|contract)\b/i.test(n)) return 'no'
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

/** Words that follow a number without naming a street: "2025 Contracts", "3 signed copies", "2 story addition". */
const NOT_STREET_WORDS = new Set(['projects', 'project', 'jobs', 'job', 'contracts', 'contract', 'agreement', 'agreements', 'subcontract', 'files', 'signed', 'proposal', 'proposals', 'bids', 'bid', 'estimate', 'estimates', 'est', 'invoice', 'invoices', 'plans', 'copy', 'copies', 'final', 'draft', 'rev', 'revised', 'story', 'page', 'pages', 'of', 'the', 'and', 'for', 'to', 'pdf', 'doc', 'docx'])

/**
 * Every street the file's own name or its folder chain names, by the piece that starts with a
 * house number: "_Heron Construction / 105 Dover" → 105 dover; "9511 Arcade Ridge signed contract
 * (dragged).pdf" → 9511 arcade; "CLICK PLUMBING - EST. #123 - 105 DOVER RD. - SIGNED.pdf" → 105 dover.
 * A year or a count before a plain word ("2025 Contracts", "2 story addition") is not a street.
 */
export function streetsNamed(file: Pick<DriveScanFile, 'name' | 'folderName'>): Array<{ key: string; text: string }> {
  const name = file.name.replace(/\.[a-z0-9]{2,5}$/i, '')
  const pieces = [...file.folderName.split(' / '), name].flatMap((seg) => seg.split(/\s+[-–—]\s+|_/))
  const out = new Map<string, string>()
  for (const raw of pieces) {
    const piece = raw.trim()
    const key = streetKey(piece)
    if (!key) continue
    const [num, word] = key.split(' ') as [string, string]
    if (num.replace(/[a-z]$/, '').length < 2 || word.length < 3 || /^\d+$/.test(word) || NOT_STREET_WORDS.has(word)) continue
    if (!out.has(key)) out.set(key, /^(\d+[a-z]?\s+(?:\d+\/\d+\s+)?[a-z0-9']+(?:\s+[a-z.']+)?)/i.exec(piece)?.[1]?.replace(/\.$/, '') ?? piece)
  }
  return [...out].map(([key, text]) => ({ key, text }))
}

/** The street the file names when it is not the job's — null when the file names no street, names the job's, or the job has no street to compare. */
export function namesAnotherStreet(file: Pick<DriveScanFile, 'name' | 'folderName'>, job: Pick<DriveMatchJob, 'jobAddress'>): string | null {
  const own = streetKey(job.jobAddress)
  if (!own) return null
  const named = streetsNamed(file)
  if (named.length === 0 || named.some((s) => s.key === own)) return null
  return named[0]!.text
}

export function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
}

const NAME_NOISE = new Set(['inc', 'llc', 'ltd', 'co', 'the', 'and', 'of', 'group', 'company', 'construction', 'contracting', 'contractors', 'homes', 'custom', 'general', 'services', 'solutions', 'rmc', 'dsi'])

/** The words that identify a party: "RMC- Dudley Mason" → {dudley, mason}; "_Knight Contracting" → {knight}. */
export function nameWords(s: string): Set<string> {
  return new Set(
    normalizeName(s)
      .split(' ')
      .filter((w) => w.length >= 3 && !NAME_NOISE.has(w)),
  )
}

/** Two party names agree when one's identifying words all appear in the other's ("_Mason Dudley" ↔ "RMC- Dudley Mason"). */
export function partyNamesAgree(a: string, b: string): boolean {
  const wa = nameWords(a)
  const wb = nameWords(b)
  if (wa.size === 0 || wb.size === 0) return false
  const subset = (x: Set<string>, y: Set<string>) => [...x].every((w) => y.has(w))
  return subset(wa, wb) || subset(wb, wa)
}

/** Folder name mentions the job: by street, by number (J523 / 523 as a token), by job name, by customer/GC name. */
export function folderMatchesJob(folderName: string, job: DriveMatchJob): { strength: 'street' | 'number' | 'name' | 'customer' | null; detail: string } {
  const f = normalizeName(folderName)
  // The job number first: two jobs can share a street, never a number. Only a
  // labelled number counts — "J105", "job 105", "#105" — a bare "105 Dover" is a street.
  if (job.jobNumber && new RegExp(`(^|[^a-z0-9])(j|job|hcp|#)\\s?${job.jobNumber}([^0-9]|$)`, 'i').test(f)) return { strength: 'number', detail: `folder names J${job.jobNumber}` }
  const street = streetKey(job.jobAddress)
  if (street && f.includes(street)) return { strength: 'street', detail: `folder names ${job.jobAddress.split(',')[0]?.trim() ?? street}` }
  const jn = normalizeName(job.jobName)
  if (jn.length >= 6 && f.includes(jn)) return { strength: 'name', detail: `folder names the job "${job.jobName}"` }
  // The customer folder is the top segment of the chain ("_Mason Dudley / 233 Palomino Trail / Contracts").
  const top = folderName.split(' / ')[0] ?? folderName
  for (const who of [job.customerName, job.gcName ?? '']) {
    if (!who.trim()) continue
    const c = normalizeName(who)
    if ((c.length >= 5 && f.includes(c)) || partyNamesAgree(top, who)) return { strength: 'customer', detail: `folder names ${who}` }
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
    const mentioned = jobs
      .map((job) => ({ job, m: folderMatchesJob(file.folderName, job) }))
      .filter((h) => h.m.strength != null)
    // The paper's own address wins over a customer or job-name match: a file that
    // names another street is not this job's, whichever folder it sits in.
    const judged = mentioned.map((h) => ({ ...h, other: namesAnotherStreet(file, h.job) }))
    const hits = judged.filter((h) => h.other == null)
    if (hits.length === 0) {
      const other = judged.find((h) => h.other)?.other
      const reason = other ? `names ${other}, not the job's address` : 'no job matches the folder'
      out.push({ file, jobId: null, confidence: 'none', reason, kind })
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
