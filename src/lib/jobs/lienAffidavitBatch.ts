import { batchOutcomeWords, batchWords, countedLabel, type BatchOutcome } from '../batchWords'
import { filingSheetWords, type FilingSheetBreak } from '../jobsDocuments/filingSheetBreak'
import { buildLienAffidavitBlocks, filingDocFooter, filingDocPrintHtml, filingDocsPrintHtml, lienAffidavitPrintOptions, type LienAffidavitFields } from '../jobsDocuments/lienFilingDocuments'
import type { SentFiling } from '../sent/sentCopies'
import { lienAffidavitFormForItem } from './lienAffidavitForm'
import { submitOutcome, type LienNoticePolicy, type LienSubmitOutcome } from './lienDesk'
import type { LienAffidavitEntry } from './lienDeskAffidavits'

/**
 * Two presses on the Affidavits list (punch list #305, v2.6918), for re-issuing a month's affidavits on the short
 * form: send every drafted one for approval, then print every ready one for the notary. Pure: which papers each
 * press moves, which it leaves with the reason, the words around it, and the print document.
 *
 * After **Redraw N on the short form…** every redrawn paper sits in To draft and wants the same two things the
 * pane offers one paper at a time: **Send for approval ▸**, then the Lien window's **Print for notarization**. Each
 * press acts on what is ready (`CLAUDE.md` → *Do what is ready*) and makes the same call the pane makes.
 */

/** What decides a paper's way on submit, read off the desk's data. */
export type LienAffidavitSendContext = {
  /** The GC's standing rule; `ask` on a job contracted with the owner. */
  policyFor: (gcCustomerId: string | null) => LienNoticePolicy
  promiseYmdFor: (jobId: string) => string | null
  gcHasPriorNotice: (gcCustomerId: string) => boolean
  gcHeldBefore: (gcCustomerId: string) => boolean
  todayYmd: string
}

type SendEntry = Pick<LienAffidavitEntry, 'jobId' | 'pile' | 'item' | 'deadline' | 'gcCustomerId'>

/** Where one paper goes when it is sent for approval: the pane's own call (`LienDeskAffidavitPane` → **Send for approval ▸**). */
export function lienAffidavitSubmitOutcome(entry: Pick<SendEntry, 'jobId' | 'deadline' | 'gcCustomerId'>, ctx: LienAffidavitSendContext): LienSubmitOutcome {
  const gc = entry.gcCustomerId
  return submitOutcome(
    { policy: ctx.policyFor(gc), earliestDeadline: entry.deadline },
    { promiseYmd: ctx.promiseYmdFor(entry.jobId), gcHasPriorNotice: Boolean(gc && ctx.gcHasPriorNotice(gc)), gcHeldBefore: Boolean(gc && ctx.gcHeldBefore(gc)) },
    ctx.todayYmd,
  )
}

export type LienAffidavitSendPlan<E extends SendEntry = SendEntry> = {
  /** In To draft with a draft a person made: the press sends these, each to where its rule takes it. */
  ready: Array<{ entry: E; outcome: LienSubmitOutcome }>
  /** In To draft and never drafted: nobody has read the paper, so it is drafted from its own pane. */
  held: E[]
}

export function lienAffidavitSendPlan<E extends SendEntry>(entries: ReadonlyArray<E>, ctx: LienAffidavitSendContext): LienAffidavitSendPlan<E> {
  const toDraft = entries.filter((e) => e.pile === 'to_draft')
  return {
    ready: toDraft.filter((e) => e.item != null && e.item.status === 'drafted').map((entry) => ({ entry, outcome: lienAffidavitSubmitOutcome(entry, ctx) })),
    held: toDraft.filter((e) => e.item == null),
  }
}

const count = (n: number, one: string, many: string) => (n === 1 ? one : many.replace('#', String(n)))

export type LienAffidavitSendWords = { lead: string; button: string; title: string; message: string; confirmLabel: string; foot: string | null; dead: boolean }

export function lienAffidavitSendWords(plan: Pick<LienAffidavitSendPlan, 'ready' | 'held'>): LienAffidavitSendWords {
  const ready = plan.ready.length
  const held = plan.held.length
  const by = (status: LienSubmitOutcome['status']) => plan.ready.filter((r) => r.outcome.status === status).length
  const approved = by('approved')
  const asked = by('awaiting_approval')
  const parked = by('held')
  const counted = `${countedLabel('Send', ready)} for approval`
  const ways = [
    approved > 0 ? count(approved, '1 is approved at once by its GC’s standing rule and moves to Ready to file.', '# are approved at once by a GC’s standing rule and move to Ready to file.') : '',
    asked > 0 ? count(asked, '1 goes to the leader for approval.', '# go to the leader for approval.') : '',
    parked > 0 ? count(parked, '1 is held by its GC’s standing rule.', '# are held by a GC’s standing rule.') : '',
  ].filter(Boolean)
  return {
    lead: count(ready, '1 drafted affidavit is ready to send.', '# drafted affidavits are ready to send.'),
    button: `${counted}…`,
    title: count(ready, 'Send 1 affidavit for approval?', 'Send # affidavits for approval?'),
    message: ways.join(' '),
    confirmLabel: counted,
    foot: held > 0 ? count(held, '1 in To draft has no draft yet. Draft it from its own paper.', '# in To draft have no draft yet. Draft each from its own paper.') : null,
    dead: batchWords({ verb: 'Send', ready, held }).dead,
  }
}

/** After the send: what took and what did not; a paper that did not take stays in To draft, with its reason. */
export function lienAffidavitSendOutcome(done: number, failed: number): BatchOutcome {
  return batchOutcomeWords({ verb: 'send', past: 'Sent', done, failed, noun: 'affidavit' })
}

type PrintEntry = Pick<LienAffidavitEntry, 'jobId' | 'pile' | 'item'>

export type LienAffidavitPrintPlan<E extends PrintEntry = PrintEntry> = {
  /** In Ready to file on the short form: the press prints these. */
  ready: E[]
  /** In Ready to file on the earlier form: redrawn first, or printed from its own Lien window. */
  held: E[]
}

export function lienAffidavitPrintPlan<E extends PrintEntry>(entries: ReadonlyArray<E>): LienAffidavitPrintPlan<E> {
  const readyPile = entries.filter((e) => e.pile === 'ready' && e.item != null)
  return { ready: readyPile.filter((e) => lienAffidavitFormForItem(e.item) === 'short'), held: readyPile.filter((e) => lienAffidavitFormForItem(e.item) !== 'short') }
}

export type LienAffidavitPrintWords = { lead: string; button: string; foot: string | null; dead: boolean }

export function lienAffidavitPrintWords(plan: Pick<LienAffidavitPrintPlan, 'ready' | 'held'>): LienAffidavitPrintWords {
  const ready = plan.ready.length
  const held = plan.held.length
  return {
    lead: count(ready, '1 affidavit on the short form is ready to file.', '# affidavits on the short form are ready to file.'),
    button: `${countedLabel('Print', ready)} for notarization`,
    foot: held > 0 ? count(held, '1 ready affidavit is on the earlier form and is left out. Redraw it, or print it from its own Lien window.', '# ready affidavits are on the earlier form and are left out. Redraw them, or print each from its own Lien window.') : null,
    dead: batchWords({ verb: 'Print', ready, held }).dead,
  }
}

/** One paper of the print: the job, its number as the ledger shows it, and the fields the desk filled. */
export type LienAffidavitPrintPaper = { jobId: string; jobNumber: string; fields: LienAffidavitFields }

/**
 * The print: one document with every paper on its own sheet, and for each job the copy to file on it. A print counts
 * as a send (`docs/SENT_COPIES.md`), and each job keeps its own paper alone, under the kind and title the Lien
 * window's **Print for notarization** files, so a job's sent copies read the same whichever press printed it.
 */
export function lienAffidavitPrintRun(papers: ReadonlyArray<LienAffidavitPrintPaper>): { html: string; copies: Array<{ filing: Omit<SentFiling, 'how'>; html: string }> } {
  const footer = filingDocFooter('affidavit')
  const drawn = papers.map((p) => ({ paper: p, blocks: buildLienAffidavitBlocks(p.fields), opts: lienAffidavitPrintOptions(p.fields) }))
  return {
    html: filingDocsPrintHtml(drawn.map((d) => ({ blocks: d.blocks, footer, opts: d.opts })), count(papers.length, 'Lien affidavit', 'Lien affidavits · #')),
    copies: drawn.map((d) => {
      const title = `Lien Affidavit — Job ${d.paper.jobNumber}`
      return { filing: { kind: 'lien_affidavit', title, jobIds: [d.paper.jobId] }, html: filingDocPrintHtml(d.blocks, title, footer, d.opts) }
    }),
  }
}

/**
 * Which papers of the print take a second sheet (v2.6930). The Lien window says it under **Print for notarization**
 * (`FilingSheetNote`, v2.6896); the batch printed with no word, so a notary could be handed a paper whose signature
 * sits on a sheet of its own. Each paper is laid out alone, as its own window lays it out, and read by the same
 * `filingSheetBreak`. The press never waits on this and never leaves a paper out: it prints what is ready and the bar
 * names what to check (`CLAUDE.md` → *Do what is ready*).
 */

/** One paper of the print as the hidden frame lays it out: the Lien window's own print document, with `sheet` set. */
export type LienAffidavitSheetPaper = { jobId: string; sheetHtml: string }

export function lienAffidavitSheetPapers(papers: ReadonlyArray<LienAffidavitPrintPaper>): LienAffidavitSheetPaper[] {
  const footer = filingDocFooter('affidavit')
  return papers.map((p) => ({ jobId: p.jobId, sheetHtml: filingDocPrintHtml(buildLienAffidavitBlocks(p.fields), `Lien Affidavit — Job ${p.jobNumber}`, footer, { ...lienAffidavitPrintOptions(p.fields), sheet: true }) }))
}

/** What has been read so far, by job: the document that was laid out, and how it broke (null when the frame had no layout). */
export type LienAffidavitSheetReads = Readonly<Record<string, { sheetHtml: string; sheet: FilingSheetBreak | null }>>

/** A read counts only for the document it was read from: a paper whose words changed is read again. */
const sheetReadOf = (p: LienAffidavitSheetPaper, reads: LienAffidavitSheetReads) => (reads[p.jobId]?.sheetHtml === p.sheetHtml ? reads[p.jobId]! : null)

/** The paper the frame lays out next, one at a time; null when every paper of the print has been read. */
export function lienAffidavitSheetNext(papers: ReadonlyArray<LienAffidavitSheetPaper>, reads: LienAffidavitSheetReads): LienAffidavitSheetPaper | null {
  return papers.find((p) => !sheetReadOf(p, reads)) ?? null
}

export type LienAffidavitSheetFlags = { lead: string; rows: Array<{ jobId: string; words: string }> }

/** The papers that take a second sheet, each with the Lien window's own line; null while none is known to. */
export function lienAffidavitSheetFlags(papers: ReadonlyArray<LienAffidavitSheetPaper>, reads: LienAffidavitSheetReads): LienAffidavitSheetFlags | null {
  const rows = papers.flatMap((p) => {
    const words = filingSheetWords(sheetReadOf(p, reads)?.sheet)
    return words ? [{ jobId: p.jobId, words }] : []
  })
  if (rows.length === 0) return null
  return {
    lead: count(
      rows.length,
      '1 paper in this print takes a second sheet. Keep its sheets together for the notary, or print it alone from its own Lien window.',
      '# papers in this print take a second sheet. Keep each one’s sheets together for the notary, or print each alone from its own Lien window.',
    ),
    rows,
  }
}
