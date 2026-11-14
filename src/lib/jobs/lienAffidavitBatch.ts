import { batchOutcomeWords, batchWords, countedLabel, type BatchOutcome } from '../batchWords'
import { filingSheetWords, type FilingSheetBreak } from '../jobsDocuments/filingSheetBreak'
import { buildLienAffidavitBlocks, filingDocFooter, filingDocPrintHtml, filingDocsPrintHtml, lienAffidavitPrintOptions, prependToFilingPrintHtml, type LienAffidavitFields } from '../jobsDocuments/lienFilingDocuments'
import { demandMoney } from '../jobsDocuments/demandLetter'
import { LIEN_HELP_STYLES, lienHelpBatchSheetHtml, lienHelpPaperFromFields, type LienHelpClerk, type LienHelpExtras, type LienHelpLeftOut, type LienHelpPaper } from './lienHelpSheet'
import type { LienNoticeRecord } from './lienNoticeRecord'
import { LIEN_RECORD_STYLES, lienNoticeCopiesHtml, lienNoticeCopyNotices, lienNoticeRecordBatchHtml } from './lienNoticeRecordSheet'
import type { FilingDocExtras } from '../jobsDocuments/lienFilingDocuments'
import type { SentFiling } from '../sent/sentCopies'
import { lienAffidavitFormForItem } from './lienAffidavitForm'
import { submitOutcome, type LienNoticePolicy, type LienSubmitOutcome } from './lienDesk'
import { lienAffidavitFootBlockedSentence } from './lienDeskGates'
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

type PrintEntry = Pick<LienAffidavitEntry, 'jobId' | 'pile' | 'item'> & Partial<Pick<LienAffidavitEntry, 'ready' | 'gates'>>

export type LienAffidavitPrintPlan<E extends PrintEntry = PrintEntry> = {
  /** In Ready to file on the short form with every gate clear: the press prints these. */
  ready: E[]
  /** In Ready to file on the earlier form: redrawn first, or printed from its own Lien window. */
  held: E[]
  /**
   * In Ready to file on the short form with a gate closed since it was approved (punch list #314): a public owner, a
   * homestead, an address gone. Its Lien window draws no paper, so the batch does not print one either, and the help
   * sheet lists it with the reason. An entry that carries no gates is not judged.
   */
  gated: Array<{ entry: E; reason: string }>
}

/** Why a ready paper with a closed gate is left out: the hold line's own sentence, without its *Don't file yet.* */
export function lienAffidavitGatedReason(entry: Pick<PrintEntry, 'gates'>): string {
  const gate = (entry.gates ?? []).find((g) => !g.ok) ?? null
  return lienAffidavitFootBlockedSentence(gate).replace(/^Don't file yet\.\s*/, '')
}

export function lienAffidavitPrintPlan<E extends PrintEntry>(entries: ReadonlyArray<E>): LienAffidavitPrintPlan<E> {
  const readyPile = entries.filter((e) => e.pile === 'ready' && e.item != null)
  const short = readyPile.filter((e) => lienAffidavitFormForItem(e.item) === 'short')
  const closed = (e: E) => e.ready === false || (e.gates ?? []).some((g) => !g.ok)
  return {
    ready: short.filter((e) => !closed(e)),
    held: readyPile.filter((e) => lienAffidavitFormForItem(e.item) !== 'short'),
    gated: short.filter(closed).map((entry) => ({ entry, reason: lienAffidavitGatedReason(entry) })),
  }
}

export type LienAffidavitPrintWords = { lead: string; button: string; foot: string | null; dead: boolean }

export function lienAffidavitPrintWords(plan: Pick<LienAffidavitPrintPlan, 'ready' | 'held'> & Partial<Pick<LienAffidavitPrintPlan, 'gated'>>): LienAffidavitPrintWords {
  const ready = plan.ready.length
  const held = plan.held.length
  const gated = plan.gated?.length ?? 0
  const gatedWords = gated > 0 ? count(gated, '1 ready affidavit is held by a gate and is left out. Its row says why.', '# ready affidavits are held by a gate and are left out. Each row says why.') : ''
  const heldWords = held > 0 ? count(held, '1 ready affidavit is on the earlier form and is left out. Redraw it, or print it from its own Lien window.', '# ready affidavits are on the earlier form and are left out. Redraw them, or print each from its own Lien window.') : ''
  return {
    lead: count(ready, '1 affidavit on the short form is ready to file.', '# affidavits on the short form are ready to file.'),
    button: `${countedLabel('Print', ready)} for notarization`,
    foot: [heldWords, gatedWords].filter(Boolean).join(' ') || null,
    dead: batchWords({ verb: 'Print', ready, held: held + gated }).dead,
  }
}

/** One paper of the print: the job, its number as the ledger shows it, and the fields the desk filled. `label` and `fileBy` are the help sheet's (punch list #314): the job as the desk names it and its last day to file, in words. */
export type LienAffidavitPrintPaper = {
  jobId: string
  jobNumber: string
  fields: LienAffidavitFields
  label?: string
  fileBy?: string
  /** What the desk knows of the property and the notices, for the help sheet's checks (the best-we-can-do pass). */
  checked?: { propertyKind: string | null | undefined; homestead: boolean; noticeLines: ReadonlyArray<string>; /** The notice check in one sentence (`lienNoticeCheckRowLine`), the batch sheet's row. */ noticeRow?: string }
  /** The property's county clerk as Settings hold it, and who to ask about this job (changes 9 and 10). */
  clerk?: LienHelpClerk
  ask?: string
  /** The notice record behind this paper (punch list #322, `lienNoticeRecord`): null on a job contracted with the owner, absent when the caller did not read one. */
  noticeRecord?: LienNoticeRecord | null
}

/**
 * The batch in clerk order (punch list #314, change 7): the papers sorted by the county they are filed in, each
 * clerk's papers keeping the order the desk listed them. The print and its help sheet both read this, so a clerk's
 * papers come off the printer together and the sheet's rows count the papers as they lie in the stack.
 */
export function lienAffidavitClerkOrder<P extends { fields: Pick<LienAffidavitFields, 'county'> }>(papers: ReadonlyArray<P>): P[] {
  const key = (p: P) => p.fields.county.trim().toLowerCase()
  return papers.map((paper, i) => ({ paper, i })).sort((a, b) => key(a.paper).localeCompare(key(b.paper)) || a.i - b.i).map((x) => x.paper)
}

/** The batch's help sheet (punch list #314): a row for each paper from the paper's own fields, and the ones left out with their reason. */
export function lienAffidavitBatchHelpSheet(papers: ReadonlyArray<LienAffidavitPrintPaper>, leftOut: ReadonlyArray<LienHelpLeftOut>, printedOn: string, extras?: LienHelpExtras): string {
  const rows: LienHelpPaper[] = papers.map((p) => lienHelpPaperFromFields({ jobLabel: p.label?.trim() || `Job ${p.jobNumber}`, fileBy: p.fileBy ?? '', claimWords: demandMoney(p.fields.unpaidAmount), fields: p.fields, checked: p.checked, clerk: p.clerk, ask: p.ask }))
  return lienHelpBatchSheetHtml({ papers: rows, leftOut, printedOn, extras })
}

/**
 * The batch's notice records (punch list #322): a block for each paper, in the papers' own order, so a block's number
 * is its paper's row on the batch sheet. '' when no paper carries a record, so a caller that read none prints none.
 */
export function lienAffidavitBatchNoticeRecords(papers: ReadonlyArray<LienAffidavitPrintPaper>, printedOn: string, copiesFollow = false): string {
  if (!papers.some((p) => p.noticeRecord !== undefined)) return ''
  return lienNoticeRecordBatchHtml(
    papers.map((p) => ({
      head: {
        jobLabel: p.label?.trim() || `Job ${p.jobNumber}`,
        propertyAddress: p.fields.propertyAddress.trim(),
        ownerName: p.fields.ownerName.trim(),
        contractorName: p.fields.isSub === false ? '' : p.fields.originalContractorName.trim(),
        claim: demandMoney(p.fields.unpaidAmount),
      },
      record: p.noticeRecord ?? null,
    })),
    printedOn,
    copiesFollow,
  )
}

/**
 * A copy of each notice behind each paper of the batch (punch list #322), in the papers' own order and named by the
 * paper's row: *Paper 2 · Copy of notice 1*. They print in front of the stack, behind the notice records. '' when no
 * paper's notices keep their words.
 */
export function lienAffidavitBatchNoticeCopies(papers: ReadonlyArray<LienAffidavitPrintPaper>, letterhead?: FilingDocExtras['letterhead'], todayYmd?: string | null): string {
  const withCopies = papers.map((p, i) => ({ p, row: i + 1 })).filter((x) => lienNoticeCopyNotices(x.p.noticeRecord).length > 0)
  return withCopies
    .map(({ p, row }, i) =>
      lienNoticeCopiesHtml(p.noticeRecord, {
        jobLabel: p.label?.trim() || `Job ${p.jobNumber}`,
        refJob: `Job #${p.jobNumber}`,
        letterhead,
        todayYmd,
        paper: row,
        after: i === withCopies.length - 1 ? (papers.length === 1 ? 'The paper to sign is the next page' : 'The papers to sign are next') : `Paper ${withCopies[i + 1]?.row ?? row + 1}’s copies are next`,
      }),
    )
    .join('')
}

/** How many copies of notices a batch would add: the count the box beside the press says. */
export function lienAffidavitBatchNoticeCopyCount(papers: ReadonlyArray<LienAffidavitPrintPaper>): number {
  return papers.reduce((n, p) => n + lienNoticeCopyNotices(p.noticeRecord).length, 0)
}

/** Why a ready paper on the earlier form is not in the batch, on the help sheet. */
export const LIEN_HELP_EARLIER_FORM_REASON = 'It is on the earlier form. Redraw it, or print it from its own Lien window.'

/**
 * The print: one document with every paper on its own sheet, and for each job the copy to file on it. A print counts
 * as a send (`docs/SENT_COPIES.md`), and each job keeps its own paper alone, under the kind and title the Lien
 * window's **Print for notarization** files, so a job's sent copies read the same whichever press printed it.
 */
export function lienAffidavitPrintRun(papers: ReadonlyArray<LienAffidavitPrintPaper>, helpSheetHtml?: string | null, noticeRecordsHtml?: string | null, noticeCopiesHtml?: string | null): { html: string; copies: Array<{ filing: Omit<SentFiling, 'how'>; html: string }> } {
  const footer = filingDocFooter('affidavit')
  const drawn = papers.map((p) => ({ paper: p, blocks: buildLienAffidavitBlocks(p.fields), opts: lienAffidavitPrintOptions(p.fields) }))
  const sheets = filingDocsPrintHtml(drawn.map((d) => ({ blocks: d.blocks, footer, opts: d.opts })), count(papers.length, 'Lien affidavit', 'Lien affidavits · #'))
  return {
    // The help sheet prints first, then the notice records and the copies of the notices (punch list #322); none of them is in any job's filed copy (punch list #314).
    html: helpSheetHtml || noticeRecordsHtml || noticeCopiesHtml ? prependToFilingPrintHtml(sheets, `${helpSheetHtml ?? ''}${noticeRecordsHtml ?? ''}${noticeCopiesHtml ?? ''}`, LIEN_HELP_STYLES + LIEN_RECORD_STYLES) : sheets,
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
