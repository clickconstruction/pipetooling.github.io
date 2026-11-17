/**
 * Papers before a job opens: the rules and the words. The office names the papers a job requires, everyone signs each
 * one, the office too, and the job opens to a person when they owe nothing. This file is pure: it reads what the
 * database functions of `20261117220000_job_required_papers.sql` hand back (`job_papers_roster`, `job_papers_mine`)
 * and says what a screen draws. The reads and writes are in `jobPapersIo.ts`.
 */
import { countedLabel, pluralNoun } from '../batchWords'
import { listQuickAddBookDocuments, type QuickSendBookRow } from '../contractsQuickSend'

/** `none` until the person has a copy of the paper; then the copy's own status. */
export type JobPaperStatus = 'none' | 'unsent' | 'sent' | 'signed'

export interface JobRequiredPaper {
  id: string
  paperName: string
  isForm: boolean
  bookDocumentId: string | null
}

export interface JobPaperCell {
  requiredPaperId: string
  documentId: string | null
  status: JobPaperStatus
  /** The day it was signed, `YYYY-MM-DD`. */
  signedAt: string | null
}

export type JobPaperWay = 'office' | 'crew' | 'sub'

export interface JobPaperPerson {
  key: string
  personId: string | null
  userId: string | null
  name: string
  role: string
  ways: JobPaperWay[]
  hasLogin: boolean
  /** False when no roster person is tied to the login: they cannot sign until the office links them on People. */
  linked: boolean
  papers: JobPaperCell[]
}

export interface JobPapersRoster {
  jobNumber: string
  papers: JobRequiredPaper[]
  people: JobPaperPerson[]
}

export interface MyJobPaper {
  id: string
  paperName: string
  isForm: boolean
  documentId: string | null
  status: JobPaperStatus
  signedAt: string | null
}

export interface MyJobPapers {
  jobNumber: string
  linked: boolean
  papers: MyJobPaper[]
}

/**
 * How much of the lock is live. The train lands in steps, and a screen never claims a lock that is not there:
 * `none` (the office can require papers and collect signatures, nothing is held shut), `prompt` (the prompt at the
 * job is the only lock), `database` (the database refuses the job's rows to the crew and subs as well).
 */
export type JobPapersLockStage = 'none' | 'prompt' | 'database'
export const JOB_PAPERS_LOCK_STAGE: JobPapersLockStage = 'none'

/** Told to the job's head when the papers a job requires change, so its chip counts again. The detail is the job's id. */
export const JOB_PAPERS_CHANGED_EVENT = 'job-papers-changed'

const PAPER_NOUN: [string, string] = ['paper', 'papers']
const PERSON_NOUN: [string, string] = ['person', 'people']
const STATUSES: readonly JobPaperStatus[] = ['none', 'unsent', 'sent', 'signed']
const WAYS: readonly JobPaperWay[] = ['office', 'crew', 'sub']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const text = (v: unknown): string => (typeof v === 'string' ? v : '')
const textOrNull = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null)
const record = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const statusOf = (v: unknown): JobPaperStatus => (STATUSES.includes(v as JobPaperStatus) ? (v as JobPaperStatus) : 'none')

/** `job_papers_roster(job)` as the screen reads it. Anything missing reads as empty, never as signed. */
export function parseJobPapersRoster(raw: unknown): JobPapersRoster {
  const r = record(raw)
  return {
    jobNumber: text(r.job_number),
    papers: list(r.papers)
      .map((p) => record(p))
      .filter((p) => text(p.id))
      .map((p) => ({ id: text(p.id), paperName: text(p.paper_name), isForm: p.is_form === true, bookDocumentId: textOrNull(p.book_document_id) })),
    people: list(r.people)
      .map((p) => record(p))
      .filter((p) => text(p.key))
      .map((p) => ({
        key: text(p.key),
        personId: textOrNull(p.person_id),
        userId: textOrNull(p.user_id),
        name: text(p.name) || 'No name',
        role: text(p.role),
        ways: list(p.ways).filter((w): w is JobPaperWay => WAYS.includes(w as JobPaperWay)),
        hasLogin: p.has_login === true,
        linked: p.linked === true,
        papers: list(p.papers)
          .map((c) => record(c))
          .filter((c) => text(c.required_paper_id))
          .map((c) => ({ requiredPaperId: text(c.required_paper_id), documentId: textOrNull(c.document_id), status: statusOf(c.status), signedAt: textOrNull(c.signed_at) })),
      })),
  }
}

/** `job_papers_mine(job)` as the prompt reads it. */
export function parseMyJobPapers(raw: unknown): MyJobPapers {
  const r = record(raw)
  return {
    jobNumber: text(r.job_number),
    linked: r.linked === true,
    papers: list(r.papers)
      .map((p) => record(p))
      .filter((p) => text(p.id))
      .map((p) => ({ id: text(p.id), paperName: text(p.paper_name), isForm: p.is_form === true, documentId: textOrNull(p.document_id), status: statusOf(p.status), signedAt: textOrNull(p.signed_at) })),
  }
}

/** A person's state on one required paper. A paper with no cell is owed. */
export function cellFor(person: JobPaperPerson, requiredPaperId: string): JobPaperCell {
  return person.papers.find((c) => c.requiredPaperId === requiredPaperId) ?? { requiredPaperId, documentId: null, status: 'none', signedAt: null }
}

/** The required papers this person has not signed, in the job's order. */
export function owedPapers(person: JobPaperPerson, papers: readonly JobRequiredPaper[]): JobRequiredPaper[] {
  return papers.filter((p) => cellFor(person, p.id).status !== 'signed')
}

/** `2026-11-14` → `Nov 14`. A day is a day: no clock and no zone come into it. */
export function shortDay(ymd: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd ?? '')
  if (!m) return ''
  const month = MONTHS[Number(m[2]) - 1]
  return month ? `${month} ${Number(m[3])}` : ''
}

/** What a roster cell says: the day it was signed, or that it is not signed yet. */
export function cellWords(cell: JobPaperCell): { signed: boolean; label: string; day: string } {
  if (cell.status === 'signed') return { signed: true, label: 'signed ✓', day: shortDay(cell.signedAt) }
  return { signed: false, label: 'not yet', day: '' }
}

/** The small word under a person's name: how they come to the job. */
export function personRoleLabel(person: Pick<JobPaperPerson, 'ways' | 'role' | 'hasLogin'>): string {
  if (person.ways.includes('office')) return 'Office'
  if (person.ways.includes('sub') || person.role === 'subcontractor' || person.role === 'sub') return person.hasLogin ? 'Sub' : 'Sub, no login'
  if (person.role === 'superintendent') return 'Superintendent'
  if (person.role === 'estimator') return 'Estimator'
  if (person.role === 'primary') return 'Primary'
  if (person.role === 'dev' || person.role === 'master_technician' || person.role === 'assistant' || person.role === 'controller') return 'Office'
  return 'Crew'
}

/** The section's head line once papers are saved: how many can open the job and how many still owe a paper. */
export function rosterSummary(roster: JobPapersRoster): { total: number; open: number; owing: number; words: string } {
  const total = roster.people.length
  const owing = roster.people.filter((p) => owedPapers(p, roster.papers).length > 0).length
  const open = total - owing
  const words = owing === 0 ? `All ${total} have signed.` : `${open} of ${total} have signed. ${owing} still ${owing === 1 ? 'owes' : 'owe'} a paper.`
  return { total, open, owing, words }
}

/** The save button: it names the count of papers it will require. Dead with nothing picked. */
export function requireButton(picked: number): { label: string; dead: boolean } {
  return { label: countedLabel('Require', picked, PAPER_NOUN), dead: picked <= 0 }
}

/** Under the save button: how many people the save reaches, the person saving included. */
export function requireFoot(people: number, stage: JobPapersLockStage = JOB_PAPERS_LOCK_STAGE): string {
  const who = `${people} ${pluralNoun(PERSON_NOUN, people)} can open this job today.`
  if (people <= 0) return 'Nobody is on this job yet. Each person signs before the job opens to them.'
  if (stage === 'none') return `${who} Each one is asked to sign, the office and you included.`
  return `${who} Each one is locked out of it until they sign, the office and you included.`
}

/** The truth about the lock while the train is still landing. Null once the database holds it. */
export function lockStageNote(stage: JobPapersLockStage = JOB_PAPERS_LOCK_STAGE): string | null {
  if (stage === 'none') return 'The job does not lock yet. The prompt and the lock arrive with the next updates. Signatures collected now will count.'
  if (stage === 'prompt') return 'The prompt at the job is the only lock for now. The lock in the database arrives with the next update.'
  return null
}

/** The section's empty state: the sentence, the press, and the words after the press. */
export const NO_PAPERS_WORDS = {
  main: 'Nothing has to be signed before this job opens.',
  tail: 'and each person signs it before the job opens to them.',
  next: 'Add a paper',
} as const

/** The toast after a save. */
export function requiredToast(added: number): string {
  return added > 0 ? `${countedLabel('Required', added, PAPER_NOUN)}.` : 'This job already requires those papers.'
}

/** The roster's door for a person who still owes: one link per paper they owe. */
export function copyLinksLabel(owed: number): string {
  return owed === 1 ? 'Copy the signing link' : countedLabel('Copy', owed, ['signing link', 'signing links'])
}

/** What goes on the clipboard: each paper's name with its own link, one to a line. */
export function signingLinksText(links: readonly { paperName: string; url: string }[]): string {
  if (links.length === 1) return links[0]!.url
  return links.map((l) => `${l.paperName}: ${l.url}`).join('\n')
}

/** Why a person's row has no signing link to copy, or null when it has one. */
export function noLinkReason(person: Pick<JobPaperPerson, 'linked' | 'hasLogin'>): string | null {
  if (person.linked) return null
  return person.hasLogin ? 'No file is linked to this login. Link it on People, then they can sign.' : 'Not on the roster yet. Add them on People, then they can sign.'
}

/** The chip on the job: how many papers it requires. Null when it requires none. */
export function jobPapersChip(count: number): { label: string; title: string } | null {
  if (count <= 0) return null
  return { label: `${count} ${pluralNoun(PAPER_NOUN, count)} to sign`, title: 'Everyone signs these before the job opens to them. The list is on the Documents tab.' }
}

/** A Contract Book entry the picker can offer. */
export type BookPaperRow = QuickSendBookRow & { audience?: string | null; flow_kind?: string | null }

export interface PickablePaper {
  bookDocumentId: string
  paperName: string
  isForm: boolean
  /** A paper with no body, no form and no link cannot be required: the database refuses it. */
  hasWords: boolean
  /** The small words after the name. */
  from: string
}

/**
 * What Add a paper offers: one entry per named paper in the Contract Book (its newest copy), without the customer's
 * contracts, the flows' own papers and the papers this job already requires.
 */
export function pickablePapers(book: readonly BookPaperRow[], live: readonly JobRequiredPaper[], pending: readonly string[] = []): PickablePaper[] {
  const taken = new Set<string>([...live.map((p) => p.bookDocumentId ?? ''), ...pending])
  const takenNames = new Set(live.map((p) => p.paperName.trim().toLowerCase()))
  const offered = book.filter((d) => d.audience !== 'customer' && !d.flow_kind)
  return listQuickAddBookDocuments(offered)
    .filter(({ row, documentName }) => !taken.has(row.id) && !takenNames.has(documentName.trim().toLowerCase()))
    .map(({ row, documentName }) => {
      const isForm = Boolean(row.form_template_id)
      const hasWords = isForm || Boolean(row.book_body_html?.trim()) || Boolean(row.canonical_document_url?.trim())
      return {
        bookDocumentId: row.id,
        paperName: documentName,
        isForm,
        hasWords,
        from: !hasWords ? 'No words yet. Write it in the Contract Book first.' : isForm ? 'A form from the Contract Book' : 'From the Contract Book',
      }
    })
}

/** The roster row that is the person signed in, if they are on it. */
export function myRosterRow(roster: JobPapersRoster, userId: string | null | undefined): JobPaperPerson | null {
  if (!userId) return null
  return roster.people.find((p) => p.userId === userId) ?? null
}

/** The line asking whoever saved to sign their own, or null when they owe nothing or are not on the roster. */
export function signYourOwnWords(roster: JobPapersRoster, userId: string | null | undefined): { line: string; next: JobRequiredPaper | null; blocked: string | null } | null {
  const me = myRosterRow(roster, userId)
  if (!me) return null
  const owed = owedPapers(me, roster.papers)
  if (owed.length === 0) return null
  const line = `You have not signed ${owed.length === 1 ? 'this paper' : `these ${owed.length} papers`} yourself.`
  const blocked = noLinkReason(me)
  return { line, next: blocked ? null : owed[0]!, blocked: blocked ? 'No file is linked to your login. Link it on People, then you can sign.' : null }
}
