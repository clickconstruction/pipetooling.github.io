import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { countedLabel } from '../batchWords'
import { formatYmdMonthDay } from './billedExpectedPay'
import { formatUsdNoCents } from './jobFormatting'
import { ownerKind } from './ownerConfirm'

/**
 * Is this public property? (v2.7436 the database, this file the rules; Taunya's ask of 2026-11-16 on job 883: *"this
 * job is a government job and we can't lien a government job, how should we amend the flow to handle this going
 * forward?"*, the second drawing she approved.)
 *
 * A mechanic's lien does not attach to public property. Until now *public* was a guess from the owner's names, made
 * again on every screen. The answer now lives on the property record (`customer_addresses.lien_public_answer`):
 *
 *  - **public**: a person said so. Every job at the address, now and later, is **off the lien path**. That is derived
 *    from the property here, never copied onto a job, so one change of the answer brings them all back.
 *  - **private**: a person said it is private. The name guess is overruled, and the holds it raised open.
 *  - **unanswered**: the desk keeps its guess. A property whose names read as a public body **asks**: its papers hold
 *    as before (v2.6954), and the Board says so in one line.
 *
 * Pure. The desk's read (`useLienDeskData`) takes off-path jobs out where its lists are built, so every reader drops
 * them without a rule of its own, and hands them on as the bin *Public jobs · bond claim*.
 */
export type LienPublicAnswer = 'public' | 'private'

/** The part of a property record these rules read. A row read before the migration carries no answer. */
export type LienPublicRecord = {
  owner_name?: string | null
  owner_company?: string | null
  lien_public_answer?: unknown
  lien_public_answered_at?: unknown
  lien_public_reason?: unknown
}

export function lienPublicAnswerOf(record: LienPublicRecord | null | undefined): LienPublicAnswer | null {
  const a = record?.lien_public_answer
  return a === 'public' || a === 'private' ? a : null
}

/** Whether any name the record gives for the owner reads as a public body: the guess, used only while nobody answered. */
export function lienOwnerNamesReadPublic(names: ReadonlyArray<string | null | undefined>): boolean {
  return names.some((n) => (n ?? '').trim() !== '' && ownerKind((n ?? '').trim()) === 'public')
}

/**
 * Whether the desk treats the property as public: the stored answer when there is one, else the guess from the
 * names. Every gate that held a paper on the guess reads this, so *No, it is private* opens them all at once.
 */
export function lienPropertyIsPublic(record: LienPublicRecord | null | undefined, names?: ReadonlyArray<string | null | undefined>): boolean {
  const answer = lienPublicAnswerOf(record)
  if (answer) return answer === 'public'
  return lienOwnerNamesReadPublic(names ?? [record?.owner_name, record?.owner_company])
}

/** Where a property stands on the question. */
export type LienPublicStanding = 'off_path' | 'asks' | 'private' | 'clear'

export function lienPublicStanding(record: LienPublicRecord | null | undefined): LienPublicStanding {
  const answer = lienPublicAnswerOf(record)
  if (answer === 'public') return 'off_path'
  if (answer === 'private') return 'private'
  // A record read before the answer's column exists cannot be answered yet (migration 20261116221500), so it does not
  // ask: no question, no mark and no line until the push. Its papers keep holding on the name guess, as before.
  if (!record || record.lien_public_answer === undefined) return 'clear'
  return lienOwnerNamesReadPublic([record.owner_name, record.owner_company]) ? 'asks' : 'clear'
}

type JobAtAddress = { id: string; customer_address_id?: string | null }

function jobIdsStanding(jobs: ReadonlyArray<JobAtAddress>, propertiesById: Readonly<Record<string, LienPublicRecord | undefined>>, standing: LienPublicStanding): Set<string> {
  const out = new Set<string>()
  for (const j of jobs) {
    const record = j.customer_address_id ? propertiesById[j.customer_address_id] : undefined
    if (record && lienPublicStanding(record) === standing) out.add(j.id)
  }
  return out
}

/** The jobs off the lien path: every job whose property record says *public*. A job with no linked record stays on it. */
export function lienJobIdsOffLienPath(jobs: ReadonlyArray<JobAtAddress>, propertiesById: Readonly<Record<string, LienPublicRecord | undefined>>): Set<string> {
  return jobIdsStanding(jobs, propertiesById, 'off_path')
}

/** The jobs whose property reads as public and has no answer yet: still on the lien path, and the Board says so. */
export function lienJobIdsAskingPublic(jobs: ReadonlyArray<JobAtAddress>, propertiesById: Readonly<Record<string, LienPublicRecord | undefined>>): Set<string> {
  return jobIdsStanding(jobs, propertiesById, 'asks')
}

// ---------- what already went out on a job ----------

/** A lien paper of the desk's, as far as these words need it. */
export type LienPublicPaper = { kind: string; status: string; months?: ReadonlyArray<string> | null; sent_at?: string | null; approved_at?: string | null; voided_at?: string | null }

const COUNT_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten']
const countWord = (n: number) => COUNT_WORDS[n] ?? String(n)
const dayOf = (iso: string | null | undefined) => (iso ? formatYmdMonthDay(calendarYmdInAppTzFromIso(iso)) : '')

/** What each kind of paper is called in these sentences. */
function paperName(kind: string): string {
  return kind === 'affidavit' ? 'An affidavit' : kind === 'retainage_53_057' ? 'A retainage notice' : 'A lien notice'
}

/**
 * What already went out on a job, in sentences, for the window's list, the bin's row and the note that goes to the
 * attorney: *A lien notice was mailed Oct 8. An affidavit was approved Nov 11 and not filed.* With nothing sent it
 * says so, and names the months that were missed.
 */
export function lienPublicWhatWentOut(papers: ReadonlyArray<LienPublicPaper>): string {
  const live = papers.filter((p) => !p.voided_at)
  const out: string[] = []
  const sent = live.filter((p) => p.status === 'sent' && p.sent_at).sort((a, b) => ((a.sent_at ?? '') < (b.sent_at ?? '') ? -1 : 1))
  for (const p of sent) out.push(`${paperName(p.kind)} was ${p.kind === 'affidavit' ? 'filed' : 'mailed'} ${dayOf(p.sent_at)}.`)
  for (const p of live.filter((x) => x.status === 'approved')) out.push(`${paperName(p.kind)} was approved${p.approved_at ? ` ${dayOf(p.approved_at)}` : ''} and not ${p.kind === 'affidavit' ? 'filed' : 'sent'}.`)
  const waiting = live.filter((p) => p.status === 'awaiting_approval' || p.status === 'held' || p.status === 'drafted')
  for (const p of waiting) out.push(`${paperName(p.kind)} was drafted and not sent.`)
  if (sent.length === 0) out.unshift('No lien paper has gone out.')
  const missed = new Set<string>()
  for (const p of live) if (p.status === 'missed') for (const m of p.months ?? []) missed.add(m)
  if (missed.size > 0) out.push(`${countWord(missed.size)} ${missed.size === 1 ? 'month was' : 'months were'} missed.`)
  return out.join(' ')
}

// ---------- the bin: Public jobs · bond claim ----------

export type LienPaymentBondAnswer = 'yes' | 'no' | 'unknown'

/** A job off the lien path, as the desk's read hands it on. */
export type LienPublicJob = {
  jobId: string
  addressId: string
  number: string
  name: string
  gcName: string
  /** What the job's sent bills still owe, by the desk's own rule. */
  unpaid: number
  bond: LienPaymentBondAnswer
  /** When the job went on the attorney's list (the Collections flag), or null when it is not on it. */
  attorneySince: string | null
  /** The job's status (`jobs_ledger.status`): the Collections flag takes a billed job only. Absent on a caller that did not read it. */
  status?: string | null
  papers: LienPublicPaper[]
}

/**
 * Why a job cannot go on the attorney's list yet, as the end of a sentence about it: the Collections flag takes a job
 * only once it is billed (`set_job_collections_flag`, whose rule this does not change). Null for a billed job, and
 * for a status this does not know, which the press then decides.
 */
export function lienPublicNotListedWhy(status: string | null | undefined): string | null {
  switch (status) {
    case 'waiting':
      return 'has not started'
    case 'working':
      return 'is still being worked'
    case 'ready_to_bill':
      return 'is not billed yet'
    case 'paid':
      return 'is paid'
    default:
      return null
  }
}

/** The window's line under a job the Collections flag will hold: *523 is still being worked, so it cannot go on the Collections list yet. It still leaves the lien path.* Null for a billed job. */
export function lienPublicListNote(number: string, status: string | null | undefined): string | null {
  const why = lienPublicNotListedWhy(status)
  if (!why) return null
  const cannot = status === 'paid' ? 'so it does not go on the Collections list' : 'so it cannot go on the Collections list yet'
  return `${number} ${why}, ${cannot}. It still leaves the lien path.`
}

export type LienPublicBinRow = {
  jobId: string
  addressId: string
  /** "523 · Mission Hills". */
  label: string
  unpaidWords: string
  /** "get the bond" while the bond is not known. */
  chip: string | null
  /** "TF Harper · bond not known yet · with the attorney since Nov 16". */
  line: string
}

export type LienPublicBin = {
  title: string
  count: number
  totalWords: string
  /** The box folded to one line (v2.7854, punch list #390): how many jobs and what they owe, *2 jobs · $32,241 unpaid*. */
  foldWords: string
  /** What the folded line must not hide (v2.7854): the rows whose bond nobody knows, *1 to get the bond*; null with none. */
  needs: string | null
  rows: LienPublicBinRow[]
  backLabel: string
}

export const LIEN_PUBLIC_BIN_TITLE = 'Public jobs · bond claim'

/** A folded box's line (v2.7854): how many jobs it holds and what they still owe. One rule for *Public jobs* and *Off the lien path*. */
export function lienBoxFoldWords(jobs: number, unpaid: number): string {
  return `${jobs} ${jobs === 1 ? 'job' : 'jobs'} · ${formatUsdNoCents(unpaid)} unpaid`
}

/** The folded *Public jobs* line's amber words: how many rows still wear *get the bond*. Null with none. */
export function lienPublicNeedsWords(unknownBonds: number): string | null {
  return unknownBonds > 0 ? `${unknownBonds} to get the bond` : null
}
export const LIEN_PUBLIC_BACK_LABEL = 'Put a job back on the lien path…'

/** The bond, as a row says it. */
function bondWords(bond: LienPaymentBondAnswer): string {
  return bond === 'yes' ? 'there is a payment bond' : bond === 'no' ? 'no payment bond' : 'bond not known yet'
}

/** The paper that went to the owner, shortest form, for the bin's row: "a lien notice went out Oct 8". */
function wentOutShort(papers: ReadonlyArray<LienPublicPaper>): string {
  const sent = papers.filter((p) => !p.voided_at && p.status === 'sent' && p.sent_at).sort((a, b) => ((a.sent_at ?? '') < (b.sent_at ?? '') ? 1 : -1))[0]
  return sent ? `${paperName(sent.kind).replace(/^A/, 'a')} went out ${dayOf(sent.sent_at)}` : ''
}

/**
 * Where a job stands with the attorney, for the bin's row. A job the Collections flag held never reads as if counsel
 * has it: *not on the attorney’s list, the job is still being worked*.
 */
function attorneyWords(j: Pick<LienPublicJob, 'attorneySince' | 'status'>): string {
  if (j.attorneySince) return `with the attorney since ${dayOf(j.attorneySince)}`
  const why = lienPublicNotListedWhy(j.status)
  return why ? `not on the attorney’s list, the job ${why}` : 'not on the attorney’s list yet'
}

/** The bin, the most money first; null with no job off the lien path. */
export function buildLienPublicBin(jobs: ReadonlyArray<LienPublicJob>): LienPublicBin | null {
  if (jobs.length === 0) return null
  const sorted = [...jobs].sort((a, b) => b.unpaid - a.unpaid || (a.number < b.number ? -1 : 1))
  return {
    title: LIEN_PUBLIC_BIN_TITLE,
    count: sorted.length,
    totalWords: `${formatUsdNoCents(sorted.reduce((s, j) => s + Math.round(j.unpaid), 0))} unpaid`,
    foldWords: lienBoxFoldWords(sorted.length, sorted.reduce((s, j) => s + Math.round(j.unpaid), 0)),
    needs: lienPublicNeedsWords(sorted.filter((j) => j.bond === 'unknown').length),
    rows: sorted.map((j) => ({
      jobId: j.jobId,
      addressId: j.addressId,
      label: j.name ? `${j.number} · ${j.name}` : j.number,
      unpaidWords: formatUsdNoCents(j.unpaid),
      chip: j.bond === 'unknown' ? 'get the bond' : null,
      line: [j.gcName, wentOutShort(j.papers) || bondWords(j.bond), wentOutShort(j.papers) && j.bond !== 'unknown' ? bondWords(j.bond) : '', attorneyWords(j)].filter(Boolean).join(' · '),
    })),
    backLabel: LIEN_PUBLIC_BACK_LABEL,
  }
}

// ---------- the Board's line, for the ones already in ----------

export type LienPublicBoardLine = { count: number; words: string; action: string; jobIds: string[]; addressIds: string[] }

/**
 * The amber line over the Board: the jobs whose property reads as public, has no answer, and that still have a lien
 * paper open. Null when there is none. `openPaperJobIds` is every job the Board draws a chip for.
 */
export function lienPublicBoardLine(input: { askingJobIds: ReadonlySet<string>; openPaperJobIds: ReadonlySet<string>; unpaidOf: (jobId: string) => number; addressIdOf: (jobId: string) => string | null | undefined }): LienPublicBoardLine | null {
  const jobIds = [...input.askingJobIds].filter((id) => input.openPaperJobIds.has(id))
  if (jobIds.length === 0) return null
  const sum = jobIds.reduce((s, id) => s + Math.round(input.unpaidOf(id)), 0)
  const addressIds = [...new Set(jobIds.map((id) => input.addressIdOf(id)).filter((v): v is string => Boolean(v)))]
  return {
    count: jobIds.length,
    words: `${jobIds.length} ${jobIds.length === 1 ? 'job sits' : 'jobs sit'} on public property and ${jobIds.length === 1 ? 'is' : 'are'} still on the lien path · ${formatUsdNoCents(sum)} unpaid`,
    action: jobIds.length === 1 ? 'Review it ›' : 'Review them ›',
    jobIds,
    addressIds,
  }
}

// ---------- the property record's question ----------

/**
 * Two answers, Taunya's call of 2026-11-16: nothing in the app can ask counsel about a property, so there is no third
 * press. Until someone answers, the papers hold, and the box says so.
 */
export const LIEN_PUBLIC_QUESTION = {
  lead: 'This owner reads as a public body.',
  ask: 'A mechanic’s lien does not attach to public property. Is this public property?',
  holds: 'The lien papers here hold until someone answers.',
  yes: 'Yes, public property…',
  no: 'No, it is private',
} as const

/** The line a property record shows once the question is answered. */
export function lienPublicAnsweredWords(answer: LienPublicAnswer, answeredAt: string | null | undefined): string {
  const when = answeredAt ? `, answered ${dayOf(answeredAt)}` : ''
  return answer === 'public' ? `Public property${when}. Every job here is off the lien path.` : `Not public property${when}. Its lien papers can go out.`
}

// ---------- putting a property back on the lien path ----------

export const LIEN_PUBLIC_BACK_TITLE = 'Put this property back on the lien path?'

/** What putting it back does, in the window's words. The attorney's list is left as it is. */
export const LIEN_PUBLIC_BACK_DOES: ReadonlyArray<string> = [
  'Every job at this address goes back on the Lien desk.',
  'The jobs stay on the attorney’s list and keep their bond answer.',
  'The reason is kept with the property.',
]

/** The put-back press: the act and its count; with no job listed, the property alone. */
export function lienPublicBackLabel(jobCount: number): string {
  return jobCount > 0 ? `${countedLabel('Put', jobCount, ['job back on the lien path', 'jobs back on the lien path'])} ▸` : 'Put this property back on the lien path ▸'
}

// ---------- the window: take this property off the lien path ----------

export type LienPublicWindowJob = {
  jobId: string
  number: string
  label: string
  unpaidWords: string
  unpaid: number
  wentOut: string
  /** The line under a job the Collections flag will hold, or null (`lienPublicListNote`). */
  listNote: string | null
  /** Ticked when the window opens: a job that still owes money. */
  ticked: boolean
}

export type LienPublicWindow = {
  title: string
  /** "2100 Independence Dr, New Braunfels · owner of record NEW BRAUNFELS CITY OF". */
  sub: string
  jobs: LienPublicWindowJob[]
  /** The reason, filled in and the person's to change. */
  reason: string
}

export const LIEN_PUBLIC_WINDOW_TITLE = 'Take this property off the lien path?'

/** The reason the window opens with. */
export function lienPublicDefaultReason(ownerName: string): string {
  const owner = ownerName.trim()
  return owner ? `Public property. The owner of record is ${owner}. A mechanic’s lien does not attach.` : 'Public property. A mechanic’s lien does not attach.'
}

/** A job at the property, as the window's read hands it in. */
export type LienPublicPropertyJob = { jobId: string; number: string; name: string; status: string | null; unpaid: number; papers: ReadonlyArray<LienPublicPaper> }

/**
 * Which jobs at the property the window lists: a job that still owes money or has a lien paper of the desk's on it.
 * A paid job with no paper was never on the lien path, so it is left out. It still follows the property's answer.
 */
export function lienPublicWindowListsJob(j: Pick<LienPublicPropertyJob, 'unpaid' | 'papers'>): boolean {
  return Math.round(j.unpaid) > 0 || j.papers.some((p) => !p.voided_at)
}

export function buildLienPublicWindow(input: { address: string; ownerName: string; jobs: ReadonlyArray<LienPublicPropertyJob> }): LienPublicWindow {
  const address = input.address.trim()
  const owner = input.ownerName.trim()
  return {
    title: LIEN_PUBLIC_WINDOW_TITLE,
    sub: [address, owner ? `owner of record ${owner}` : ''].filter(Boolean).join(' · '),
    jobs: input.jobs
      .filter(lienPublicWindowListsJob)
      .sort((a, b) => b.unpaid - a.unpaid || (a.number < b.number ? -1 : 1))
      .map((j) => ({
        jobId: j.jobId,
        number: j.number,
        label: j.name ? `${j.number} · ${j.name}` : j.number,
        unpaid: j.unpaid,
        unpaidWords: formatUsdNoCents(j.unpaid),
        wentOut: lienPublicWhatWentOut(j.papers),
        listNote: lienPublicListNote(j.number, j.status),
        ticked: Math.round(j.unpaid) > 0,
      })),
    reason: lienPublicDefaultReason(owner),
  }
}

/**
 * What the press does, as the window lists it. Every job listed leaves the lien path, ticked or not, since the answer
 * belongs to the property. A ticked job also goes on the attorney's list, unless the Collections flag will hold it.
 */
export function lienPublicPressDoes(jobs: ReadonlyArray<Pick<LienPublicWindowJob, 'jobId' | 'number' | 'listNote'>>, ticked: ReadonlySet<string>): string[] {
  const n = jobs.length
  const leave = n === 0 ? 'No job here is on the lien path.' : n === 1 ? 'The job leaves the lien bins. Nothing is filed and nothing is deleted.' : n === 2 ? 'Both jobs leave the lien bins. Nothing is filed and nothing is deleted.' : `All ${n} jobs leave the lien bins. Nothing is filed and nothing is deleted.`
  const going = jobs.filter((j) => ticked.has(j.jobId) && !j.listNote).map((j) => j.number)
  const goWords =
    going.length === 0
      ? 'No job goes on the attorney’s list.'
      : going.length === n && n === 2
        ? 'Both go on the attorney’s list for a bond claim, with what already went out.'
        : going.length === 1
          ? `${going[0]} goes on the attorney’s list for a bond claim, with what already went out.`
          : going.length <= 3
            ? `${going.slice(0, -1).join(', ')} and ${going[going.length - 1]} go on the attorney’s list for a bond claim, with what already went out.`
            : `${going.length} jobs go on the attorney’s list for a bond claim, with what already went out.`
  return [leave, 'Every job at this address, now and later, stays off the lien path.', goWords]
}

/** The window's press: the act and its count, *Take 2 jobs off the lien path ▸*; with no job listed, the property alone. */
export function lienPublicPressLabel(jobCount: number): string {
  return jobCount > 0 ? `${countedLabel('Take', jobCount, ['job off the lien path', 'jobs off the lien path'])} ▸` : 'Take this property off the lien path ▸'
}

/** The note that goes to the attorney with a job: the reason, then what already went out on it. */
export function lienPublicAttorneyNote(reason: string, wentOut: string): string {
  return [reason.trim(), wentOut.trim()].filter(Boolean).join(' ')
}

/** One job's line of the press's answer (`set_property_lien_public_answer`). */
export type LienPublicPressLine = { job_id: string | null; bond_set: boolean; on_attorney_list: boolean; already_on_list: boolean; held: string | null }

/** What the press did, for the toast: what went on the list, and each job it held with the reason. */
export function lienPublicPressOutcome(lines: ReadonlyArray<LienPublicPressLine>, labelOf: (jobId: string) => string): { done: number; held: Array<{ label: string; reason: string }> } {
  const held = lines.filter((l) => l.held).map((l) => ({ label: l.job_id ? labelOf(l.job_id) : 'A job', reason: l.held as string }))
  return { done: lines.filter((l) => !l.held && l.on_attorney_list).length, held }
}

/** "883", "883 and 523", "883, 523 and 600". */
function joinNumbers(numbers: ReadonlyArray<string>): string {
  if (numbers.length <= 1) return numbers[0] ?? ''
  return `${numbers.slice(0, -1).join(', ')} and ${numbers[numbers.length - 1]}`
}

export type LienPublicPressWords = {
  /** The toast. */
  line: string
  tone: 'success' | 'warning'
  /** The head over the jobs the press held, which stay in the window with the reason; null when none was held. */
  head: string | null
  held: Array<{ jobId: string | null; number: string; reason: string }>
}

/**
 * The words after the press (*Do what is ready*): the property is off the lien path whatever the attorney's list
 * did, the jobs that went on it, and each job the Collections flag held, with the function's own reason.
 */
export function lienPublicPressWords(lines: ReadonlyArray<LienPublicPressLine>, numberOf: (jobId: string) => string): LienPublicPressWords {
  const listed = lines.filter((l) => !l.held && l.on_attorney_list && l.job_id).map((l) => numberOf(l.job_id as string))
  const held = lines.filter((l) => l.held).map((l) => ({ jobId: l.job_id, number: l.job_id ? numberOf(l.job_id) : 'A job', reason: l.held as string }))
  const parts = ['The property is off the lien path.']
  if (listed.length) parts.push(`${joinNumbers(listed)} ${listed.length === 1 ? 'is' : 'are'} on the attorney’s list.`)
  if (held.length) parts.push(`${joinNumbers(held.map((h) => h.number))} did not go on it.`)
  return {
    line: parts.join(' '),
    tone: held.length ? 'warning' : 'success',
    head: held.length ? `${held.length === 1 ? 'This job' : `These ${held.length} jobs`} did not go on the attorney’s list. ${held.length === 1 ? 'It' : 'They'} left the lien path all the same.` : null,
    held,
  }
}
