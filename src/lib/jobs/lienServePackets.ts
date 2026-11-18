/**
 * Every filed lien that still owes its copies, as one batch (punch list #366, step 3): what prints, what is held and
 * why, the five-day clock on each, and the words on the press. The office files liens together, twelve on the day
 * this was asked, so twelve serve clocks start together and the copies go out as one stack.
 *
 * The rule is the desk's: do what is ready, never all or nothing. A filing with no recording number, or with no
 * address to mail to, stays out with its reason, and the rest print. The press takes its words from `batchWords`.
 *
 * The stack is in envelope order behind one mail sheet: the sheet stays in the office, lists every envelope in the
 * order it comes off the printer, and has a blank for each certified mail number. Pure; the caller prints and files.
 */
import { batchWords, type BatchWords } from '../batchWords'
import { demandDate } from '../jobsDocuments/demandLetter'
import { filingDocsPrintHtml, prependToFilingPrintHtml, type FilingDocExtras } from '../jobsDocuments/lienFilingDocuments'
import { lienServeHolds, lienServePapers, lienServeRecipients, lienServedCopySentTitle, type LienServeFacts, type LienServeHold, type LienServePaper, type LienServeRecipient } from '../jobsDocuments/lienServedCopy'
import { formatYmdMonthDay } from './billedExpectedPay'
import type { JobLienFilingRow } from './lienDeadlines'
import { LIEN_HELP_STYLES, STRIPE, foot } from './lienHelpSheet'
import { lienPropertyOwnerDisplayName, resolveLienProperty, type JobPropertyOwnerLike } from './lienProperty'
import { lienServeClock, type LienServeClock } from './lienServeClock'
import { lienServeFactsFromFiling } from './lienServeFacts'

export { lienServeClock, type LienServeClock } from './lienServeClock'

/** One filed affidavit that has not been served, and what the desk knows of its job. */
export type LienServeJob = { jobId: string; jobNumber: string; jobLabel: string; filing: JobLienFilingRow; isSub: boolean; to?: LienServeFacts['to'] }

function esc(s: string): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** The desk's own data, as much of it as this reads. */
export type LienServeDeskData = {
  filingsByJob: Readonly<Record<string, ReadonlyArray<JobLienFilingRow>>>
  jobsById: Readonly<Record<string, { hcp_number: string; job_name: string | null; gc_customer_id: string | null; customer_address_id: string | null } | undefined>>
  addressesById: Readonly<Record<string, Parameters<typeof resolveLienProperty>[0]>>
  ownerByJob: Readonly<Record<string, JobPropertyOwnerLike | undefined>>
  gcsById: Readonly<Record<string, { name: string; address: string } | undefined>>
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
      const job = data.jobsById[jobId]
      const address = job?.customer_address_id ? (data.addressesById[job.customer_address_id] ?? null) : null
      const owner = resolveLienProperty(address, data.ownerByJob[jobId] ?? null).owner
      const gc = job?.gc_customer_id ? data.gcsById[job.gc_customer_id] : undefined
      const jobNumber = (job?.hcp_number ?? '').trim()
      out.push({
        jobId,
        jobNumber,
        jobLabel: [jobNumber, (job?.job_name ?? '').trim()].filter(Boolean).join(' · ') || 'A job',
        filing,
        isSub: Boolean(job?.gc_customer_id),
        to: { owner: { name: lienPropertyOwnerDisplayName(owner), address: (owner.mailingAddress ?? '').trim() }, contractor: gc ? { name: gc.name, address: gc.address } : null },
      })
    }
  }
  return out
}

export type LienServeReady = { job: LienServeJob; facts: LienServeFacts; envelopes: LienServeRecipient[]; clock: LienServeClock }
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

/** The batch: what prints and what stays, the soonest day first. `phone` is the company's, for each letter's call line. */
export function lienServePlan(jobs: ReadonlyArray<LienServeJob>, ctx: { todayYmd: string; phone: string }): LienServePlan {
  const ready: LienServeReady[] = []
  const held: LienServeHeld[] = []
  for (const job of jobs) {
    if (job.filing.served_at) continue
    const facts = lienServeFactsFromFiling(job.filing, { isSub: job.isSub, letterYmd: ctx.todayYmd, phone: ctx.phone, to: job.to })
    const clock = lienServeClock(job.filing.serve_due, ctx.todayYmd)
    if (!facts) {
      // A filed affidavit with no fields kept: the app has nothing to copy.
      if (job.filing.kind === 'affidavit' && job.filing.filed_at && !job.filing.voided_at) held.push({ job, clock, holds: [{ key: 'no_paper', words: 'the app did not draw this affidavit, so it has no copy to print', act: 'Mail a photocopy of the filed affidavit.', door: 'photocopy' }] })
      continue
    }
    const holds = lienServeHolds(facts)
    if (holds.length > 0) held.push({ job, holds, clock })
    else ready.push({ job, facts, envelopes: lienServeRecipients(facts), clock })
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

/** One held filing as a line: "2340 · Ortega Residence: no recording number yet." */
export function lienServeHeldLine(h: LienServeHeld): string {
  return `${h.job.jobLabel}: ${h.holds.map((x) => x.words).join(', ')}.`
}

const TO_SHORT: Record<LienServeRecipient['recipient'], string> = { owner: 'Owner', original_contractor: 'Original contractor' }

export const LIEN_SERVE_SHEET_WORDS = {
  tag: 'Mail sheet · keep this page in the office',
  steps: [
    'Each envelope takes its letter and the copy behind it. They come off the printer in the order below.',
    'Mail each envelope by certified mail. Write its number in the last column.',
    'In the app, open the Lien desk. Press Enter mail numbers on Filed · copies to mail, or on the job’s own line. Type the day mailed and each number.',
  ],
  held: 'Not in this print',
} as const

/**
 * A column of the mail sheet that is no wider than its longest text (the owner’s ask of 2026-11-17, v2.7639): the
 * number, who the copy goes to and the mail-by day. The table lays itself out by its content, so the room these three
 * give up goes to the job, the envelope's name and address, and the blank for the certified mail number.
 */
const FIT = ' style="width:1%;white-space:nowrap"'

/** The mail sheet: every envelope in the stack's order with a blank for its certified mail number, then what was left out. */
export function lienServeMailSheetHtml(plan: Pick<LienServePlan, 'ready' | 'held' | 'envelopes'>, opts: { printedOn: string; letter: boolean }): string {
  let n = 0
  const rows = plan.ready
    .map((r) =>
      r.envelopes
        .map((e) => {
          n += 1
          return `<tr><td${FIT}>${n}</td><td><strong>${esc(r.job.jobLabel)}</strong></td><td${FIT}>${esc(TO_SHORT[e.recipient])}</td><td><strong>${esc(e.name)}</strong><br/>${esc(e.address)}</td><td${FIT}>${esc(r.clock.serveDue ? `${formatYmdMonthDay(r.clock.serveDue)}${r.clock.late ? ' · late' : ''}` : '')}</td><td></td></tr>`
        })
        .join(''),
    )
    .join('')
  const left = plan.held.map((h) => `<tr><td></td><td>${esc(h.job.jobLabel)}</td><td colspan="4" class="lien-help-flag">Not printed: ${esc(h.holds.map((x) => x.words).join(', '))}. <span style="font-weight:400">${esc([...new Set(h.holds.map((x) => x.act))].join(' '))}</span></td></tr>`).join('')
  const count = plan.envelopes
  return (
    `<section class="lien-help" data-lien-serve-sheet>` +
    STRIPE +
    `<div class="lien-help-band"><div><div class="lien-help-tag">${esc(LIEN_SERVE_SHEET_WORDS.tag)}</div><h2>${esc(count === 1 ? 'Copies of filed lien affidavits: 1 envelope' : `Copies of filed lien affidavits: ${count} envelopes`)}</h2></div><div class="lien-help-small" style="text-align:right">${esc(opts.printedOn ? `Printed ${opts.printedOn}` : '')}<br/>Texas Property Code § 53.055</div></div>` +
    `<div class="lien-help-box"><h3>From the printer to the mail</h3><ol>${LIEN_SERVE_SHEET_WORDS.steps.map((s) => `<li><span class="lien-help-tick"></span> ${esc(s)}</li>`).join('')}</ol></div>` +
    `<table class="lien-help-rows" style="table-layout:auto">` +
    `<tr><th${FIT}>#</th><th style="width:22%">Job</th><th${FIT}>Copy to</th><th>Name and address on the envelope</th><th${FIT}>Mail by</th><th style="width:22%">Certified mail number</th></tr>${rows}` +
    (left ? `<tr class="lien-help-group"><td colspan="6">${esc(LIEN_SERVE_SHEET_WORDS.held)}</td></tr>${left}` : '') +
    `</table>` +
    foot(`Mail sheet${opts.printedOn ? ` printed ${opts.printedOn}` : ''}`, opts.letter ? 'The first letter is the next page' : 'The first copy is the next page') +
    `</section>`
  )
}

/** One job's part of the stack, to file on the job: its papers alone, as they printed. */
export type LienServeJobPrint = { jobId: string; filingId: string; title: string; recipientName: string; html: string; papers: LienServePaper[] }

/**
 * The whole stack as one print document, and each job's own papers for its file. The mail sheet leads and is not
 * filed: it is a desk paper. Null when nothing is ready.
 */
export function lienServeBatchPrint(plan: LienServePlan, opts: { letter: boolean; letterhead?: FilingDocExtras['letterhead']; todayYmd: string }): { html: string; jobs: LienServeJobPrint[] } | null {
  const jobs: LienServeJobPrint[] = []
  for (const r of plan.ready) {
    const papers = lienServePapers(r.facts, { letter: opts.letter, letterhead: opts.letterhead })
    if (papers.length === 0) continue
    const title = lienServedCopySentTitle(r.job.jobNumber)
    jobs.push({ jobId: r.job.jobId, filingId: r.job.filing.id, title, recipientName: r.envelopes[0]?.name ?? '', html: filingDocsPrintHtml(papers, title), papers })
  }
  if (jobs.length === 0) return null
  const stack = filingDocsPrintHtml(jobs.flatMap((j) => j.papers), jobs.length === 1 ? (jobs[0]?.title ?? 'Copies of filed lien affidavits') : `Copies of ${jobs.length} filed lien affidavits`)
  return { html: prependToFilingPrintHtml(stack, lienServeMailSheetHtml(plan, { printedOn: demandDate(opts.todayYmd), letter: opts.letter }), LIEN_HELP_STYLES), jobs }
}
