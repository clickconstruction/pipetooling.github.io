/**
 * Changed since printed (punch list #362, step 7): what a lien paper said when it printed, kept with the copy the
 * print files, and the one rule that sets it beside what the paper would say today.
 *
 * Every lien print files a sent copy (`docs/SENT_COPIES.md`). From this version the filing also carries the paper's
 * fields as they printed, on the copy's `source_snapshot`, so no table changes. A read of a job's newest filed print
 * then answers two things the desk could not: an affidavit has a printed fact at all (nothing stamped one before),
 * and a paper whose statements moved after it left the printer can be named with both values.
 *
 * Two lists, on purpose. `lienNoticePrintFields` and `lienAffidavitPrintFields` keep every value the paper prints.
 * `LIEN_SWORN_FIELDS` names the ones a change in which counts. The first is wider than the second, so the list that
 * counts can grow later and still be read against the prints already filed.
 *
 * Pure: fields and rows in, a standing out. The read is `lienPrintsIo.ts`.
 */
import type { LienAffidavitFields } from '../jobsDocuments/lienAffidavitFieldsType'
import type { LienNoticeFields } from '../jobsDocuments/lienNoticeFieldsType'
import type { SentCopy } from '../sent/sentCopies'

export type LienPrintPaperKind = 'notice' | 'affidavit'

/** A paper's values as text, by the field's own name: what the snapshot keeps and the compare reads. */
export type LienPrintFields = Record<string, string>

/** One paper of a print: the jobs it speaks for (several on a notice combined at one property), and what it said. */
export type LienPrintSnapshotPaper = {
  kind: LienPrintPaperKind
  jobIds: string[]
  /** The desk items of a notice, in the jobs' order; empty for an affidavit, which has no desk item. */
  itemIds: string[]
  fields: LienPrintFields
}

/** The key the papers sit under on a sent copy's `source_snapshot`, beside whatever else a filing keeps there. */
export const LIEN_PRINT_SNAPSHOT_KEY = 'lienPrint'
export const LIEN_PRINT_SNAPSHOT_VERSION = 1

/** The sent-copy kinds that are a lien paper out of a printer, and which paper each one is. */
export const LIEN_PRINT_KINDS: Readonly<Record<string, LienPrintPaperKind>> = {
  lien_notice_packet: 'notice',
  lien_notice: 'notice',
  lien_notice_53_056: 'notice',
  lien_affidavit: 'affidavit',
}

const flag = (v: boolean | undefined): string => (v ? 'yes' : '')

/** Every value a § 53.056 notice prints, as text. */
export function lienNoticePrintFields(f: LienNoticeFields): LienPrintFields {
  return {
    noticeDate: f.noticeDate ?? '',
    projectDescription: f.projectDescription ?? '',
    claimantName: f.claimantName ?? '',
    claimantAddress: f.claimantAddress ?? '',
    laborMaterialsType: f.laborMaterialsType ?? '',
    originalContractorName: f.originalContractorName ?? '',
    contractedWithIfDifferent: f.contractedWithIfDifferent ?? '',
    claimAmount: f.claimAmount ?? '',
    claimSplit: f.claimSplit ?? '',
    retainageIncluded: f.retainageIncluded ?? '',
    contactPerson: f.contactPerson ?? '',
    homesteadStatement: flag(f.homesteadStatement),
  }
}

/** Every value a lien affidavit prints, as text. */
export function lienAffidavitPrintFields(f: LienAffidavitFields): LienPrintFields {
  return {
    form: f.form ?? '',
    county: f.county ?? '',
    signingCounty: f.signingCounty ?? '',
    claimantPersonName: f.claimantPersonName ?? '',
    claimantCompany: f.claimantCompany ?? '',
    claimantAddress: f.claimantAddress ?? '',
    claimantPhysicalAddress: f.claimantPhysicalAddress ?? '',
    legalDescription: f.legalDescription ?? '',
    propertyAddress: f.propertyAddress ?? '',
    ownerName: f.ownerName ?? '',
    ownerAddress: f.ownerAddress ?? '',
    originalContractorName: f.originalContractorName ?? '',
    originalContractorAddress: f.originalContractorAddress ?? '',
    contractedWithName: f.contractedWithName ?? '',
    contractedWithAddress: f.contractedWithAddress ?? '',
    isSub: flag(f.isSub),
    workDescription: f.workDescription ?? '',
    workStart: f.workStart ?? '',
    workEnd: f.workEnd ?? '',
    workMonthsWords: f.workMonthsWords ?? '',
    contractAmount: f.contractAmount ?? '',
    paidAmount: f.paidAmount ?? '',
    unpaidAmount: f.unpaidAmount ?? '',
    includeNoticesSworn: flag(f.includeNoticesSworn),
    noticesSentWords: f.noticesSentWords ?? '',
    homestead: flag(f.homestead),
  }
}

/** A notice as a print's paper. A notice combined at one property names every job and desk item it stands for. */
export function lienNoticePrintPaper(n: LienPrintNotice): LienPrintSnapshotPaper {
  const parts = n.parts && n.parts.length > 1 ? n.parts : [{ jobId: n.jobId, itemId: n.itemId }]
  return { kind: 'notice', jobIds: parts.map((p) => p.jobId), itemIds: parts.map((p) => p.itemId), fields: lienNoticePrintFields(n.fields) }
}

/** An affidavit as a print's paper. */
export function lienAffidavitPrintPaper(p: { jobId: string; fields: LienAffidavitFields }): LienPrintSnapshotPaper {
  return { kind: 'affidavit', jobIds: [p.jobId], itemIds: [], fields: lienAffidavitPrintFields(p.fields) }
}

/** A notice as a print reads it: plain, or combined at one property. */
export type LienPrintNotice = { jobId: string; itemId: string; fields: LienNoticeFields; parts?: ReadonlyArray<{ jobId: string; itemId: string }> | null }

/** What a filing keeps on `sourceSnapshot` for these papers. */
export function lienPrintSourceSnapshot(papers: ReadonlyArray<LienPrintSnapshotPaper>): Record<string, unknown> {
  return { [LIEN_PRINT_SNAPSHOT_KEY]: { v: LIEN_PRINT_SNAPSHOT_VERSION, papers: papers.map((p) => ({ kind: p.kind, jobIds: [...p.jobIds], itemIds: [...p.itemIds], fields: { ...p.fields } })) } }
}

/** What a print of these notices keeps with its filed copy: each paper as it printed, in the print's order. */
export function lienNoticesPrintSnapshot(ns: ReadonlyArray<LienPrintNotice>): Record<string, unknown> {
  return lienPrintSourceSnapshot(ns.map(lienNoticePrintPaper))
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.length > 0) : [])

/** The papers a sent copy's snapshot keeps, read defensively. Empty for a copy filed before the snapshot rode along. */
export function lienPrintSnapshotPapers(snapshot: Record<string, unknown> | null | undefined): LienPrintSnapshotPaper[] {
  const held = snapshot?.[LIEN_PRINT_SNAPSHOT_KEY]
  if (!held || typeof held !== 'object' || Array.isArray(held)) return []
  const raw = (held as Record<string, unknown>).papers
  if (!Array.isArray(raw)) return []
  const out: LienPrintSnapshotPaper[] = []
  for (const one of raw) {
    if (!one || typeof one !== 'object') continue
    const r = one as Record<string, unknown>
    const kind = r.kind === 'notice' || r.kind === 'affidavit' ? r.kind : null
    const jobIds = strings(r.jobIds)
    if (!kind || jobIds.length === 0 || !r.fields || typeof r.fields !== 'object' || Array.isArray(r.fields)) continue
    const fields: LienPrintFields = {}
    for (const [k, v] of Object.entries(r.fields as Record<string, unknown>)) if (typeof v === 'string') fields[k] = v
    out.push({ kind, jobIds, itemIds: strings(r.itemIds), fields })
  }
  return out
}

/** How a field is compared: money to the cent whatever its commas, a day or a flag as written, words with their spacing and case evened. */
export type LienSwornAs = 'money' | 'text' | 'exact'

export type LienSwornField = { key: string; label: string; as: LienSwornAs }

/**
 * The fields a change in which counts, in the order the paper prints them. This list is the answer to one call:
 * *which fields count as sworn on each paper*. Built to the pick: every statement the paper makes. Left out are the
 * day the notice is dated, its contact person, and the county an affidavit is signed in, which is the notary's.
 * The snapshot keeps those three too, so adding one here reads every print filed since this version.
 */
export const LIEN_SWORN_FIELDS: Readonly<Record<LienPrintPaperKind, ReadonlyArray<LienSwornField>>> = {
  notice: [
    { key: 'claimantName', label: 'the claimant', as: 'text' },
    { key: 'claimantAddress', label: 'the claimant’s address', as: 'text' },
    { key: 'projectDescription', label: 'the property', as: 'text' },
    { key: 'laborMaterialsType', label: 'the kind of work', as: 'text' },
    { key: 'originalContractorName', label: 'the original contractor', as: 'text' },
    { key: 'contractedWithIfDifferent', label: 'who the work was contracted with', as: 'text' },
    { key: 'claimAmount', label: 'the claim', as: 'money' },
    { key: 'retainageIncluded', label: 'the retainage inside the claim', as: 'money' },
    { key: 'claimSplit', label: 'the claim by month', as: 'text' },
    { key: 'homesteadStatement', label: 'the homestead statement', as: 'exact' },
  ],
  affidavit: [
    { key: 'form', label: 'the form', as: 'exact' },
    { key: 'county', label: 'the property’s county', as: 'text' },
    { key: 'claimantPersonName', label: 'who swears it', as: 'text' },
    { key: 'claimantCompany', label: 'the claimant', as: 'text' },
    { key: 'claimantAddress', label: 'the claimant’s address', as: 'text' },
    { key: 'claimantPhysicalAddress', label: 'the claimant’s physical address', as: 'text' },
    { key: 'ownerName', label: 'the owner', as: 'text' },
    { key: 'ownerAddress', label: 'the owner’s address', as: 'text' },
    { key: 'originalContractorName', label: 'the original contractor', as: 'text' },
    { key: 'originalContractorAddress', label: 'the original contractor’s address', as: 'text' },
    { key: 'contractedWithName', label: 'who the work was contracted with', as: 'text' },
    { key: 'contractedWithAddress', label: 'that party’s address', as: 'text' },
    { key: 'isSub', label: 'whether the job is under an original contractor', as: 'exact' },
    { key: 'legalDescription', label: 'the legal description', as: 'text' },
    { key: 'propertyAddress', label: 'the property’s address', as: 'text' },
    { key: 'workDescription', label: 'the work', as: 'text' },
    { key: 'workStart', label: 'the first day of work', as: 'exact' },
    { key: 'workEnd', label: 'the last day of work', as: 'exact' },
    { key: 'workMonthsWords', label: 'the months claimed', as: 'text' },
    { key: 'contractAmount', label: 'the contract amount', as: 'money' },
    { key: 'paidAmount', label: 'the amount paid', as: 'money' },
    { key: 'unpaidAmount', label: 'the amount unpaid', as: 'money' },
    { key: 'includeNoticesSworn', label: 'the paragraph on the notices', as: 'exact' },
    { key: 'noticesSentWords', label: 'the notices sent', as: 'text' },
    { key: 'homestead', label: 'the homestead notice', as: 'exact' },
  ],
}

/** A money value as a paper keeps it ("17585.00" or "$17,585.00") in cents; null when it is blank or not a number. */
function cents(raw: string): number | null {
  const bare = raw.replace(/[$,\s]/g, '')
  if (!bare) return null
  const n = Number(bare)
  return Number.isFinite(n) ? Math.round(n * 100) : null
}

/** One field's value as the compare sees it: two values that print the same statement give the same string. */
function seen(raw: string | undefined, as: LienSwornAs): string {
  const v = (raw ?? '').trim()
  if (as === 'exact') return v
  if (as === 'money') {
    const c = cents(v)
    // No figure and a figure of nothing print the same: the retainage line is left off either way.
    return c == null ? (v ? v.toLowerCase() : '0') : String(c)
  }
  return v.replace(/\s+/g, ' ').toLowerCase()
}

export type LienPrintChange = { key: string; label: string; printed: string; now: string }

/**
 * What differs between a paper as it printed and as it would print now, in the paper's order; empty when nothing a
 * change in which counts has moved. A field the print did not keep is not compared: nothing to set it beside.
 */
export function lienChangedSincePrint(kind: LienPrintPaperKind, printed: LienPrintFields, now: LienPrintFields): LienPrintChange[] {
  const out: LienPrintChange[] = []
  for (const f of LIEN_SWORN_FIELDS[kind]) {
    if (!(f.key in printed)) continue
    if (seen(printed[f.key], f.as) === seen(now[f.key], f.as)) continue
    out.push({ key: f.key, label: f.label, printed: (printed[f.key] ?? '').trim(), now: (now[f.key] ?? '').trim() })
  }
  return out
}

/** A short, steady number for a string (cyrb53), as text: the key below must fit a column and read the same on every machine. */
function shortHash(text: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 2654435761)
    h2 = Math.imul(h2 ^ c, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

/**
 * The key of one difference between a print and today (step 7, *It stands*): which fields moved, from what to what,
 * as the compare sees the values. An answer given for a difference is kept under this key, so a second change, which
 * is another difference, is another key and asks again. Two reads of the same difference give the same key however
 * the values are spaced or the money is written. '' with no change.
 */
export function lienPrintChangeKey(kind: LienPrintPaperKind, changes: ReadonlyArray<LienPrintChange>): string {
  if (changes.length === 0) return ''
  const asOf = new Map(LIEN_SWORN_FIELDS[kind].map((f) => [f.key, f.as]))
  const parts = changes.map((c) => `${c.key}\u0001${seen(c.printed, asOf.get(c.key) ?? 'text')}\u0001${seen(c.now, asOf.get(c.key) ?? 'text')}`).sort()
  return `${kind}:${changes.length}:${shortHash(parts.join('\u0002'))}`
}

const quoted = (v: string): string => (v ? `“${v}”` : 'nothing')

/** One change in words with both values: *the claim: printed “$18,400.00”, now “$6,150.00”*. */
export function lienPrintChangeWords(c: LienPrintChange): string {
  return `${c.label}: printed ${quoted(c.printed)}, now ${quoted(c.now)}`
}

/** What changed, in one line: the first change whole, and how many more. '' when nothing changed. */
export function lienChangedSincePrintWords(changes: ReadonlyArray<LienPrintChange>): string {
  const first = changes[0]
  if (!first) return ''
  const more = changes.length - 1
  const words = lienPrintChangeWords(first)
  const led = words.charAt(0).toUpperCase() + words.slice(1)
  return more > 0 ? `${led}, and ${more} more ${more === 1 ? 'change' : 'changes'}.` : `${led}.`
}

/** A job's newest filed print of one paper. */
export type LienPrintFact = {
  kind: LienPrintPaperKind
  /** The sent copy that holds it. */
  copyId: string
  /** When it printed, as the copy's row keeps it. */
  printedAt: string
  /** Who printed it; '' when the row names no one. */
  printedBy: string
  /** What the paper said, or null on a print filed before the fields rode along: printed, with nothing to compare. */
  fields: LienPrintFields | null
  /** The jobs the printed paper spoke for: more than one on a notice combined at one property. */
  jobIds: string[]
  itemIds: string[]
}

/** The key a job's print of a paper is found by. */
export const lienPrintKey = (kind: LienPrintPaperKind, jobId: string): string => `${kind}:${jobId}`

/**
 * Each job's newest filed print of each paper, from sent copies in any order. A copy that is not a lien print, or
 * that went another way than a printer, is passed over. A copy filed before the snapshot still counts as a print,
 * on every job its row names, with no fields.
 */
export function lienNewestPrints(copies: ReadonlyArray<SentCopy>): Map<string, LienPrintFact> {
  const out = new Map<string, LienPrintFact>()
  const newestFirst = [...copies].sort((a, b) => (a.sentAt < b.sentAt ? 1 : a.sentAt > b.sentAt ? -1 : 0))
  for (const copy of newestFirst) {
    const kind = LIEN_PRINT_KINDS[copy.kind]
    if (!kind || copy.how !== 'print') continue
    const papers = lienPrintSnapshotPapers(copy.sourceSnapshot).filter((p) => p.kind === kind)
    const base = { kind, copyId: copy.id, printedAt: copy.sentAt, printedBy: copy.sentByName }
    const told = new Set<string>()
    for (const p of papers) {
      for (const jobId of p.jobIds) {
        told.add(jobId)
        const key = lienPrintKey(kind, jobId)
        if (!out.has(key)) out.set(key, { ...base, fields: p.fields, jobIds: p.jobIds, itemIds: p.itemIds })
      }
    }
    for (const jobId of copy.jobIds ?? []) {
      if (told.has(jobId)) continue
      const key = lienPrintKey(kind, jobId)
      if (!out.has(key)) out.set(key, { ...base, fields: null, jobIds: [jobId], itemIds: [] })
    }
  }
  return out
}

/**
 * Where a paper stands against its newest print.
 * - `never`: no print is filed.
 * - `printed`: it printed, and it would say the same today.
 * - `changed`: it printed, and a statement has moved since.
 * - `unread`: it printed before the fields rode along, or as one paper for several jobs. Nothing to compare.
 */
export type LienPrintStanding =
  | { state: 'never' }
  | { state: 'printed'; fact: LienPrintFact }
  | { state: 'changed'; fact: LienPrintFact; changes: LienPrintChange[] }
  | { state: 'unread'; fact: LienPrintFact }

/** A paper's standing: its newest print beside what it would print now. */
export function lienPrintStanding(kind: LienPrintPaperKind, fact: LienPrintFact | null | undefined, now: LienPrintFields): LienPrintStanding {
  if (!fact) return { state: 'never' }
  // A notice combined at one property printed one claim for several jobs: one job's paper alone is not its match.
  if (!fact.fields || fact.jobIds.length > 1) return { state: 'unread', fact }
  const changes = lienChangedSincePrint(kind, fact.fields, now)
  return changes.length > 0 ? { state: 'changed', fact, changes } : { state: 'printed', fact }
}
