/**
 * Every filed lien that still owes its copies, as one batch (punch list #366, step 3): what prints, what is held and
 * why, the five-day clock on each, and the words on the press. The office files liens together, twelve on the day
 * this was asked, so twelve serve clocks start together and the copies go out as one stack.
 *
 * The rule is the desk's: do what is ready, never all or nothing. A filing with no recording number, no address to
 * mail to or no stamped copy the app can print stays out with its reason, and the rest print. The press takes its
 * words from `batchWords`.
 *
 * The plan is made in two steps since v2.7916, when the copy became the clerk's stamped scan. `lienServePlan` reads
 * the rows: what is ready as far as the record says. `lienServePlanRead` then takes what reading each saved copy
 * found (`LienCopyRead`): a copy still being read waits, one the app cannot print is held, one that looks like more
 * than one lien is held until a person says it is this lien alone.
 *
 * The stack is in envelope order behind one mail sheet: the sheet stays in the office, lists every envelope in the
 * order it comes off the printer, and has boxes for each certified mail number. Pure; `lienServePdf.ts` draws the
 * sheet and the stack and `lienServePrintIo.ts` prints and files.
 */
import { batchWords, type BatchWords } from '../batchWords'
import { lienServeHolds, lienServeLetterDrawable, lienServeRecipients, type LienServeFacts, type LienServeHold, type LienServeRecipient } from '../jobsDocuments/lienServedCopy'
import { formatYmdMonthDay } from './billedExpectedPay'
import type { JobLienFilingRow } from './lienDeadlines'
import { lienPropertyOwnerDisplayName, resolveLienProperty, type JobPropertyOwnerLike } from './lienProperty'
import { lienServeClock, type LienServeClock } from './lienServeClock'
import { lienServeFactsFromFiling } from './lienServeFacts'
import { lienCopyDoubt, lienCopyPagesWords, lienCopySeveralHold, lienCopySource, type LienCopyFile, type LienCopyRead } from './lienStampedCopy'

export { lienServeClock, type LienServeClock } from './lienServeClock'

/** One filed affidavit that has not been served, and what the desk knows of its job. */
export type LienServeJob = { jobId: string; jobNumber: string; jobLabel: string; filing: JobLienFilingRow; isSub: boolean; to?: LienServeFacts['to'] }

/** The desk's own data, as much of it as this reads. */
export type LienServeDeskData = {
  filingsByJob: Readonly<Record<string, ReadonlyArray<JobLienFilingRow>>>
  jobsById: Readonly<Record<string, { hcp_number: string; job_name: string | null; gc_customer_id: string | null; customer_address_id: string | null } | undefined>>
  addressesById: Readonly<Record<string, Parameters<typeof resolveLienProperty>[0]>>
  ownerByJob: Readonly<Record<string, JobPropertyOwnerLike | undefined>>
  gcsById: Readonly<Record<string, { name: string; address: string } | undefined>>
}

/** One filed affidavit as the copies window reads it: the job, and where its envelopes go today. */
function serveJobOf(data: LienServeDeskData, jobId: string, filing: JobLienFilingRow): LienServeJob {
  const job = data.jobsById[jobId]
  const address = job?.customer_address_id ? (data.addressesById[job.customer_address_id] ?? null) : null
  const owner = resolveLienProperty(address, data.ownerByJob[jobId] ?? null).owner
  const gc = job?.gc_customer_id ? data.gcsById[job.gc_customer_id] : undefined
  const jobNumber = (job?.hcp_number ?? '').trim()
  return {
    jobId,
    jobNumber,
    jobLabel: [jobNumber, (job?.job_name ?? '').trim()].filter(Boolean).join(' · ') || 'A job',
    filing,
    isSub: Boolean(job?.gc_customer_id),
    to: { owner: { name: lienPropertyOwnerDisplayName(owner), address: (owner.mailingAddress ?? '').trim() }, contractor: gc ? { name: gc.name, address: gc.address } : null },
  }
}

/**
 * Every filed, unserved, live affidavit on the desk with where its envelopes go today: the property record's owner
 * (the job's own override first, as every lien paper reads it) and the GC's customer record. No read of its own.
 */
export function lienServeJobsFromDesk(data: LienServeDeskData): LienServeJob[] {
  const out: LienServeJob[] = []
  for (const [jobId, filings] of Object.entries(data.filingsByJob)) {
    for (const filing of filings) {
      if (filing.kind !== 'affidavit' || !filing.filed_at || filing.served_at || filing.voided_at) continue
      out.push(serveJobOf(data, jobId, filing))
    }
  }
  return out
}

/**
 * Every filed affidavit whose mailing day is on record and that `still` says is worth showing (the copies window
 * hands `lienServeProofMissing`: a copy still lacks its number or its receipt). The *Mailed* tick saves itself since
 * v2.7846, so a lien ticked on the owner's number would otherwise be gone from the window before the contractor's
 * number went in. These stand under the liens that owe their copies and are not counted with them.
 */
export function lienServeMailedJobsFromDesk(data: LienServeDeskData, still: (job: LienServeJob) => boolean): LienServeJob[] {
  const out: LienServeJob[] = []
  for (const [jobId, filings] of Object.entries(data.filingsByJob)) {
    for (const filing of filings) {
      if (filing.kind !== 'affidavit' || !filing.filed_at || !filing.served_at || filing.voided_at) continue
      const job = serveJobOf(data, jobId, filing)
      if (still(job)) out.push(job)
    }
  }
  return out.sort((a, b) => String(b.filing.served_at ?? '').localeCompare(String(a.filing.served_at ?? '')) || a.jobLabel.localeCompare(b.jobLabel, undefined, { numeric: true }))
}

export type LienServeReady = {
  job: LienServeJob
  facts: LienServeFacts
  envelopes: LienServeRecipient[]
  clock: LienServeClock
  /** The filing keeps the words a cover letter states. False prints the stamped copy with no letter in front. */
  letter: boolean
  /** The saved copy: the stamped scan's file in Drive. */
  copy: { fileId: string; url: string }
}
export type LienServeHeld = { job: LienServeJob; holds: LienServeHold[]; clock: LienServeClock }

export type LienServePlan = {
  /** The filings whose copies print, the soonest mail-by day first. */
  ready: LienServeReady[]
  /** The filings left out, each with every reason. */
  held: LienServeHeld[]
  /** How many envelopes the ready filings make. */
  envelopes: number
  /** The soonest mail-by day among every filing, ready or held; '' with none. */
  earliestDue: string
  /** How many of them are past their day. */
  late: number
}

const byClock = (a: { clock: LienServeClock; job: LienServeJob }, b: { clock: LienServeClock; job: LienServeJob }) =>
  (a.clock.serveDue || '9999').localeCompare(b.clock.serveDue || '9999') || a.job.jobNumber.localeCompare(b.job.jobNumber, undefined, { numeric: true })

/** The batch as the rows read: what can print and what stays, the soonest day first. `phone` is the company's, for each letter's call line. */
export function lienServePlan(jobs: ReadonlyArray<LienServeJob>, ctx: { todayYmd: string; phone: string }): LienServePlan {
  const ready: LienServeReady[] = []
  const held: LienServeHeld[] = []
  for (const job of jobs) {
    if (job.filing.served_at) continue
    const facts = lienServeFactsFromFiling(job.filing, { isSub: job.isSub, letterYmd: ctx.todayYmd, phone: ctx.phone, to: job.to })
    const clock = lienServeClock(job.filing.serve_due, ctx.todayYmd)
    if (!facts) continue
    const copy = lienCopySource(job.filing.document_url)
    const holds = lienServeHolds(facts, copy.kind)
    if (holds.length > 0 || copy.kind !== 'drive') held.push({ job, holds, clock })
    else ready.push({ job, facts, envelopes: lienServeRecipients(facts), clock, letter: lienServeLetterDrawable(facts.fields), copy: { fileId: copy.fileId, url: copy.url } })
  }
  ready.sort(byClock)
  held.sort(byClock)
  const every = [...ready, ...held]
  return {
    ready,
    held,
    envelopes: ready.reduce((n, r) => n + r.envelopes.length, 0),
    earliestDue: every.map((e) => e.clock.serveDue).filter(Boolean).sort()[0] ?? '',
    late: every.filter((e) => e.clock.late).length,
  }
}

export type LienServePlanWords = BatchWords & {
  /** Over the press: how many filed liens owe their copies, and the soonest day. '' when none does. */
  lead: string
  /** Under the lead when a copy is late; '' otherwise. */
  late: string
}

/** The press and the lines around it. *Print 11 liens’ copies · 1 held ▸*, dead only when nothing is ready. */
export function lienServePlanWords(plan: Pick<LienServePlan, 'ready' | 'held' | 'earliestDue' | 'late' | 'envelopes'>, todayYmd: string): LienServePlanWords {
  const total = plan.ready.length + plan.held.length
  const words = batchWords({ verb: 'Print', ready: plan.ready.length, held: plan.held.length, noun: ['lien’s copies', 'liens’ copies'] })
  const clock = lienServeClock(plan.earliestDue, todayYmd)
  const soonest = clock.serveDue ? (clock.late ? ` The soonest was due ${formatYmdMonthDay(clock.serveDue)}.` : clock.daysLeft === 0 ? ' The soonest is due today.' : ` The soonest is due ${formatYmdMonthDay(clock.serveDue)}.`) : ''
  return {
    ...words,
    lead: total === 0 ? '' : total === 1 ? `1 filed lien owes its copies.${soonest}` : `${total} filed liens owe their copies.${soonest}`,
    late: plan.late === 0 ? '' : plan.late === 1 ? '1 is past its day. Mail it today.' : `${plan.late} are past their day. Mail them today.`,
  }
}

/** A filing ready to print with its saved copy read. */
export type LienServeRunReady = LienServeReady & { file: LienCopyFile }

/** The batch once the saved copies are read: what prints now, what is held, and how many copies are still being read. */
export type LienServeRun = Omit<LienServePlan, 'ready'> & { ready: LienServeRunReady[]; reading: number }

/**
 * The plan with what reading each saved copy found. A copy still being read is in neither list and counts in
 * `reading`. A copy the app cannot print is held with its reason. A copy that looks like more than one lien
 * (`lienCopyDoubt`) is held until its filing is in `anyway`, the reader's own word after looking.
 */
export function lienServePlanRead(plan: LienServePlan, reads: Readonly<Record<string, LienCopyRead | undefined>>, anyway: ReadonlySet<string> = new Set()): LienServeRun {
  const ready: LienServeRunReady[] = []
  const held: LienServeHeld[] = [...plan.held]
  let reading = 0
  for (const r of plan.ready) {
    const read = reads[r.job.filing.id]
    if (!read || read.state === 'reading') {
      reading += 1
      continue
    }
    if (read.state === 'held') {
      held.push({ job: r.job, holds: [read.hold], clock: r.clock })
      continue
    }
    const doubt = lienCopyDoubt(read.file)
    if (doubt && !anyway.has(r.job.filing.id)) held.push({ job: r.job, holds: [lienCopySeveralHold(doubt)], clock: r.clock })
    else ready.push({ ...r, file: read.file })
  }
  held.sort(byClock)
  return { ...plan, ready, held, reading, envelopes: ready.reduce((n, r) => n + r.envelopes.length, 0) }
}

/** The press while saved copies are still being read: dead, and it says how many. Otherwise the plan's own words. The lead counts every lien that owes its copies, read or not. */
export function lienServeRunWords(run: LienServeRun, todayYmd: string): LienServePlanWords {
  const words = lienServePlanWords(run, todayYmd)
  const total = run.ready.length + run.held.length + run.reading
  const lead = lienServePlanWords({ ...run, ready: new Array(run.ready.length + run.reading) as LienServeRunReady[] }, todayYmd).lead
  if (run.reading > 0) return { button: run.reading === 1 ? 'Reading 1 stamped copy…' : `Reading ${run.reading} stamped copies…`, foot: null, dead: true, lead: total === 0 ? '' : lead, late: words.late }
  return { ...words, lead }
}

/** One held filing as a line: "2340 · Ortega Residence: no recording number yet." */
export function lienServeHeldLine(h: LienServeHeld): string {
  return `${h.job.jobLabel}: ${h.holds.map((x) => x.words).join(', ')}.`
}

const TO_SHORT: Record<LienServeRecipient['recipient'], string> = { owner: 'Owner', original_contractor: 'Original contractor' }

export const LIEN_SERVE_SHEET_WORDS = {
  tag: 'Mail sheet · keep this page in the office',
  statute: 'Texas Property Code § 53.055',
  stepsHead: 'From the printer to the mail',
  /** The first step with the letters printed, and without. */
  stackWithLetter: 'Each envelope takes its letter and the clerk’s stamped copy behind it. They come off the printer in the order below.',
  stackNoLetter: 'Each envelope takes one clerk’s stamped copy. They come off the printer in the order below.',
  steps: [
    'Mail each envelope by certified mail. Write its number in the boxes under its line.',
    'In the app, open the Lien desk. Press Enter mail numbers on Filed · copies to mail, or on the job’s own line. Type the day mailed and each number.',
  ],
  /** The name and address come last and take the rest of the line, so a long name stays on one line. */
  columns: ['#', 'Job', 'Copy to', 'Pages', 'Mail by', 'Name and address on the envelope'],
  /** The label beside the boxes under each envelope's line. */
  numberLabel: 'Certified mail number',
  held: 'Not in this print',
} as const

/** A certified mail number as the post office's label prints it: five groups of four digits. The sheet draws a box for each group. */
export const LIEN_CERTIFIED_NUMBER_GROUPS = 5
export const LIEN_CERTIFIED_NUMBER_DIGITS = 4

const STATE_ZIP = /^[A-Za-z]{2}\.?\s+\d{5}(-\d{4})?$/
const ZIP = /^\d{5}(-\d{4})?$/
const CITY_STATE_ZIP = /^\S.*\s[A-Za-z]{2}\.?\s+\d{5}(-\d{4})?$/
const COUNTRY = /^(usa|u\.s\.a\.|us|united states|united states of america)$/i

/**
 * An address as an envelope carries it: the street on one line and the city, state and ZIP on the next. An address
 * typed on lines keeps its last line as the city line. One the kernel cannot split (no state and ZIP at its end) stays
 * whole on one line, so nothing is guessed onto the wrong line.
 */
export function lienEnvelopeAddressLines(address: string): string[] {
  const typed = (address ?? '').split(/\r?\n/).map((l) => l.trim().replace(/,$/, '').trim()).filter(Boolean)
  if (typed.length === 0) return []
  if (typed.length > 1) return [typed.slice(0, -1).join(', '), typed[typed.length - 1]!]
  const parts = typed[0]!.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length > 1 && COUNTRY.test(parts[parts.length - 1]!)) parts.pop()
  const n = parts.length
  const last = parts[n - 1] ?? ''
  // 12 Example St, Suite 4, Buda, TX 78610
  if (n >= 3 && STATE_ZIP.test(last)) return [parts.slice(0, n - 2).join(', '), `${parts[n - 2]}, ${last}`]
  // 12 Example St, Buda, TX, 78610
  if (n >= 4 && ZIP.test(last) && /^[A-Za-z]{2}\.?$/.test(parts[n - 2]!)) return [parts.slice(0, n - 3).join(', '), `${parts[n - 3]}, ${parts[n - 2]} ${last}`]
  // 12 Example St, Buda TX 78610
  if (n >= 2 && CITY_STATE_ZIP.test(last)) return [parts.slice(0, n - 1).join(', '), last]
  return [parts.join(', ')]
}

/** One envelope's line on the mail sheet. */
export type LienServeSheetRow = { n: number; job: string; to: string; name: string; address: string; /** The address as the envelope carries it (`lienEnvelopeAddressLines`). */ addressLines: string[]; pages: string; mailBy: string }

/** The mail sheet as the print draws it (`lienServePdf.ts`): its words, every envelope in the stack's order and what was left out. */
export type LienServeSheet = {
  tag: string
  title: string
  printed: string
  statute: string
  stepsHead: string
  steps: string[]
  columns: readonly string[]
  /** The label beside each envelope's boxes for its certified mail number. */
  numberLabel: string
  rows: LienServeSheetRow[]
  heldHead: string
  held: Array<{ job: string; words: string; act: string }>
  foot: [string, string]
}

/**
 * The mail sheet: every envelope in the stack's order with how many pages it takes and, on a line of its own under
 * it, the boxes for its certified mail number, then what was left out with its reason. The pages are the letter's one and the stamped copy's own, so
 * the office can split the stack without reading it. `notPrinted` adds a lien the run could not put in the stack
 * after all, with the reason.
 */
export function lienServeMailSheet(run: Pick<LienServeRun, 'ready' | 'held'>, opts: { printedOn: string; letter: boolean; notPrinted?: ReadonlyArray<{ job: LienServeJob; reason: string }> }): LienServeSheet {
  let n = 0
  const rows: LienServeSheetRow[] = run.ready.flatMap((r) => {
    const pages = r.file.pages + (opts.letter && r.letter ? 1 : 0)
    return r.envelopes.map((e) => {
      n += 1
      return { n, job: r.job.jobLabel, to: TO_SHORT[e.recipient], name: e.name, address: e.address, addressLines: lienEnvelopeAddressLines(e.address), pages: lienCopyPagesWords(pages).replace(/ pages?$/, ''), mailBy: r.clock.serveDue ? `${formatYmdMonthDay(r.clock.serveDue)}${r.clock.late ? ' · late' : ''}` : '' }
    })
  })
  const anyLetter = opts.letter && run.ready.some((r) => r.letter)
  const count = rows.length
  return {
    tag: LIEN_SERVE_SHEET_WORDS.tag,
    title: count === 1 ? 'Copies of filed lien affidavits: 1 envelope' : `Copies of filed lien affidavits: ${count} envelopes`,
    printed: opts.printedOn ? `Printed ${opts.printedOn}` : '',
    statute: LIEN_SERVE_SHEET_WORDS.statute,
    stepsHead: LIEN_SERVE_SHEET_WORDS.stepsHead,
    steps: [anyLetter ? LIEN_SERVE_SHEET_WORDS.stackWithLetter : LIEN_SERVE_SHEET_WORDS.stackNoLetter, ...LIEN_SERVE_SHEET_WORDS.steps],
    columns: LIEN_SERVE_SHEET_WORDS.columns,
    numberLabel: LIEN_SERVE_SHEET_WORDS.numberLabel,
    rows,
    heldHead: LIEN_SERVE_SHEET_WORDS.held,
    held: [
      ...run.held.map((h) => ({ job: h.job.jobLabel, words: `Not printed: ${h.holds.map((x) => x.words).join(', ')}.`, act: [...new Set(h.holds.map((x) => x.act))].join(' ') })),
      ...(opts.notPrinted ?? []).map((f) => ({ job: f.job.jobLabel, words: `Not printed: ${f.reason.trim().replace(/[.\s]+$/, '')}.`, act: 'Print this lien again from the Lien desk.' })),
    ],
    foot: [`Mail sheet${opts.printedOn ? ` printed ${opts.printedOn}` : ''}`, anyLetter ? 'The first letter is the next page' : 'The first copy is the next page'],
  }
}
