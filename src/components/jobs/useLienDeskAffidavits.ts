import { useMemo, useRef, useState } from 'react'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { useToastContext } from '../../contexts/ToastContext'
import type { LienDeskData } from '../../hooks/useLienDeskData'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import { workMonthShort } from '../../lib/jobs/forecastWorkMonths'
import { lienAffidavitBatchToldWords, lienAffidavitTellPapers } from '../../lib/jobs/lienAffidavitApprovalTell'
import {
  LIEN_HELP_EARLIER_FORM_REASON,
  type LienAffidavitPrintPaper,
  type LienAffidavitShown,
  lienAffidavitBatchHelpSheet,
  lienAffidavitBatchNoticeCopies,
  lienAffidavitBatchNoticeCopyCount,
  lienAffidavitBatchNoticeRecords,
  lienAffidavitClerkOrder,
  lienAffidavitPrintPlan,
  lienAffidavitPrintRun,
  lienAffidavitPrintWords,
  lienAffidavitSendOutcome,
  lienAffidavitSendPlan,
  lienAffidavitSendWords,
  lienAffidavitSheetPapers,
  lienAffidavitShownEntries,
} from '../../lib/jobs/lienAffidavitBatch'
import { lienAffidavitMonthsByHandCheck } from '../../lib/jobs/lienAffidavitMonthsByHand'
import { lienAffidavitNoticeCheck, lienNoticeCheckLines, lienNoticeCheckRowLine } from '../../lib/jobs/lienAffidavitNoticeCheck'
import { lienAffidavitWorkMonths } from '../../lib/jobs/lienAffidavitNotices'
import { lienAffidavitPrintBarStatus } from '../../lib/jobs/lienAffidavitPrintBar'
import { lienAffidavitRedrawOutcome, lienAffidavitRedrawPlan, lienAffidavitRedrawWords } from '../../lib/jobs/lienAffidavitRedraw'
import { lienStandInSourceOf } from '../../lib/jobs/lienBillMonths'
import { lienClerkFor } from '../../lib/jobs/lienCountyClerks'
import { lienDeskAffidavitFieldsFor } from '../../lib/jobs/lienStopPaperPages'
import { LIEN_AFFIDAVIT_PILES, type LienAffidavitPile } from '../../lib/jobs/lienDeskAffidavits'
import { lienFindMatch, type LienFindFacts } from '../../lib/jobs/lienDeskFind'
import { redrawLienAffidavitsShort, submitLienAffidavits, tellLeaderOfLienAffidavits } from '../../lib/jobs/lienDeskIo'
import { lienHelpBatchRecordCode, lienHelpGuideCode } from '../../lib/jobs/lienHelpGuideCode'
import { lienDeskJobLabel as jobLabel } from '../../lib/jobs/lienJobLabel'
import { lienMonthCheckedFor, lienMonthCheckedSheetRow, parseLienMonthCheck } from '../../lib/jobs/lienMonthCheck'
import { lienAffidavitSwornMonths } from '../../lib/jobs/lienNoticeDraft'
import { lienNoticeRecord } from '../../lib/jobs/lienNoticeRecord'
import { resolveLienProperty } from '../../lib/jobs/lienProperty'
import { demandDate } from '../../lib/jobsDocuments/demandLetter'
import { filingLetterheadFromIssuer } from '../../lib/jobsDocuments/lienFilingDocuments'
import { openHtmlPrintWindow } from '../../lib/jobsDocuments/printWindow'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import type { PhysicalInvoiceIssuer } from '../../lib/physicalInvoiceIssuer'
import { fileSentCopy } from '../../lib/sent/sentCopiesIo'
import { useLienAskPeople } from './lienAskPeopleChoice'
import { useLienHelpSheetChoice, useLienNoticeCopiesBatchChoice, useLienNoticeRecordChoice } from './lienHelpSheetChoice'
import { useLienSigningCounty } from './lienSigningCountyChoice'

/** What the Lien desk hands its Affidavits list: the desk's data, the find box, and the pick and pile the rest of the desk also sets. */
export type LienDeskAffidavitsInput = {
  data: LienDeskData | null
  todayYmd: string
  authUserId: string | null
  issuer: PhysicalInvoiceIssuer | null
  signerNameFor: (masterUserId: string | null) => string
  /** The desk re-reads after a write. */
  onChanged: () => void
  /** The find box: whether words are typed, the words, and what a row offers the find. */
  finding: boolean
  findWords: ReadonlyArray<string>
  findFactsFor: (jobId: string, gcId: string | null, shown: ReadonlyArray<string>) => LienFindFacts
  /** One column (a phone, or a host that stacks the desk): no row opens by itself. */
  oneColumn: boolean
  /** The pressed pile, the print bar's held-only press and the picked job stay the desk's: To do's rows and the title bar's chips set them too. */
  affPile: LienAffidavitPile | null
  setAffPile: (pile: LienAffidavitPile | null) => void
  affHeldOnlyPicked: boolean
  setAffHeldOnlyPicked: (on: boolean) => void
  affSelectedJobId: string | null
  /** The address named a job this list does not hold (v2.7744, `lienDeskAim.ts`): no row opens in its place. */
  openNone?: boolean
}

/** What `useLienDeskAffidavits` returns: the list's rows and its three batch boxes, read by `LienDeskAffidavitList` and by the desk. */
export type LienDeskAffidavitsView = ReturnType<typeof useLienDeskAffidavits>

/**
 * By paper → Lien affidavits, less its drawing (v2.7585; out of `LienDesk.tsx` as it stood): what the list shows and
 * which row is open, and the three batch presses over the list: redraw every ready paper on the short form (punch
 * list #305), send every drafted one for approval, and print every ready one for the notary with its help sheet
 * and notice records (v2.6918). Each rule is the kernel it was (`lienAffidavitBatch.ts`, `lienAffidavitRedraw.ts`,
 * `lienAffidavitPrintBar.ts`). No read of its own.
 */
export function useLienDeskAffidavits({ data, todayYmd, authUserId, issuer, signerNameFor, onChanged, finding, findWords, findFactsFor, oneColumn, affPile, setAffPile, affHeldOnlyPicked, setAffHeldOnlyPicked, affSelectedJobId, openNone = false }: LienDeskAffidavitsInput) {
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  // Redraw on the short form, for every ready paper at once (punch list #305): the press in flight, and the papers that did not take with their reasons.
  const [redrawBusy, setRedrawBusy] = useState(false)
  const [redrawFailed, setRedrawFailed] = useState<Array<{ jobId: string; reason: string }>>([])
  // Send every drafted affidavit for approval, then print every ready one (punch list #305, v2.6918).
  const [affSendBusy, setAffSendBusy] = useState(false)
  const [affSendFailed, setAffSendFailed] = useState<Array<{ jobId: string; reason: string }>>([])
  // The notary's print box over the Affidavits list opens folded on a phone (punch list #352, the leftovers).
  const [affPrintFolded, setAffPrintFolded] = useState(true)
  const affEntries = data?.affidavits.entries ?? []
  // Print every ready affidavit on the short form for the notary (v2.6918): what the press takes, and what it leaves with the reason.
  const affPrintPlanAll = lienAffidavitPrintPlan(affEntries)
  // The held papers alone (v2.7209): only while a gate holds one, so the list never narrows to nothing when the last one clears.
  const affHeldJobIds = new Set(affPrintPlanAll.gated.map((g) => g.entry.jobId))
  const affHeldOnly = affHeldOnlyPicked && affHeldJobIds.size > 0
  const affVisibleAll = LIEN_AFFIDAVIT_PILES.flatMap((p) => affEntries.filter((e) => e.pile === p.key && (affHeldOnly ? affHeldJobIds.has(e.jobId) : affPile == null || affPile === p.key)))
  const affVisible = affVisibleAll.filter((e) => !finding || lienFindMatch(findFactsFor(e.jobId, e.gcCustomerId, [workMonthShort(e.lastMonth), e.pile]), findWords).ok)
  const affSelected = openNone ? null : (affVisible.find((e) => e.jobId === affSelectedJobId) ?? (!oneColumn ? affVisible[0] : undefined) ?? null)
  // While a find is typed (punch list #353, part 1) both batch presses take only the rows the list shows, and say so; with nothing typed they take every paper as before.
  const affShownKey = finding ? affVisible.map((e) => e.jobId).join('\n') : null
  const affShown = useMemo((): LienAffidavitShown | null => (affShownKey == null ? null : { jobIds: new Set(affShownKey.split('\n').filter(Boolean)) }), [affShownKey])
  const affBatchEntries = lienAffidavitShownEntries(affEntries, affShown)
  const affPrintPlan = affShown ? lienAffidavitPrintPlan(affBatchEntries) : affPrintPlanAll
  const affCount = affEntries.filter((e) => e.pile !== 'filed').length
  // Redraw every ready affidavit on the short form (punch list #305): the ready earlier-form papers, the ones left in other piles, and the words.
  const redrawPlan = lienAffidavitRedrawPlan(affEntries)
  const redrawWords = lienAffidavitRedrawWords(redrawPlan)
  const redrawReady = async () => {
    if (redrawBusy || redrawPlan.ready.length === 0) return
    if (!(await confirmDialog({ title: redrawWords.title, message: redrawWords.message, confirmLabel: redrawWords.confirmLabel }))) return
    setRedrawBusy(true)
    try {
      // Each paper is its own write and the batch keeps going past one that fails; what failed stays listed with its reason.
      const result = await redrawLienAffidavitsShort(redrawPlan.ready.flatMap((e) => (e.item ? [{ jobId: e.jobId, item: e.item }] : [])), authUserId)
      const outcome = lienAffidavitRedrawOutcome(result.done.length, result.failed.length)
      setRedrawFailed(result.failed)
      showToast(outcome.line, outcome.tone)
      if (result.done.length > 0) onChanged()
    } finally {
      setRedrawBusy(false)
    }
  }
  // Send every drafted affidavit for approval (v2.6918): each goes where its GC's rule takes it, as the pane's own press sends it.
  const affSendContext = {
    policyFor: (gcId: string | null) => (gcId ? data?.gcsById[gcId]?.policy : undefined) ?? 'ask',
    promiseYmdFor: (jobId: string) => data?.promisesByJob[jobId]?.promisedYmd ?? null,
    gcHasPriorNotice: (gcId: string) => Boolean(data?.gcsWithPriorNotice.has(gcId)),
    gcHeldBefore: (gcId: string) => Boolean(data?.gcsHeldBefore.has(gcId)),
    todayYmd,
  }
  const affSendPlanAll = lienAffidavitSendPlan(affEntries, affSendContext)
  const affSendPlan = affShown ? lienAffidavitSendPlan(affBatchEntries, affSendContext) : affSendPlanAll
  const affSendWords = lienAffidavitSendWords(affSendPlan, affShown ? { hiddenReady: affSendPlanAll.ready.length - affSendPlan.ready.length } : null)
  const sendDraftedAffidavits = async () => {
    if (affSendBusy || affSendWords.dead) return
    if (!(await confirmDialog({ title: affSendWords.title, message: affSendWords.message, confirmLabel: affSendWords.confirmLabel }))) return
    setAffSendBusy(true)
    try {
      const sent = affSendPlan.ready.flatMap((r) => (r.entry.item ? [{ jobId: r.entry.jobId, itemId: r.entry.item.id, outcome: r.outcome, dueYmd: r.entry.deadline }] : []))
      const result = await submitLienAffidavits(sent)
      const outcome = lienAffidavitSendOutcome(result.done.length, result.failed.length)
      setAffSendFailed(result.failed)
      // The leader is told once of every paper that now waits for him (punch list #305, v2.7180): one call, so twelve papers are one message. Best effort, after the writes.
      const asked = lienAffidavitTellPapers(sent, result.done)
      const told = asked.length > 0 ? await tellLeaderOfLienAffidavits(asked) : null
      showToast([outcome.line, lienAffidavitBatchToldWords(told, asked.length)].filter(Boolean).join(' '), told && !told.ok && outcome.tone === 'success' ? 'warning' : outcome.tone)
      if (result.done.length > 0) onChanged()
    } finally {
      setAffSendBusy(false)
    }
  }
  // The print itself (v2.6918): one document, each paper on its own sheet, and each job keeps its own copy.
  const [affHelpSheet, setAffHelpSheet] = useLienHelpSheetChoice()
  // The notice records (punch list #322): what was mailed before each paper, in front of the stack with the help sheet.
  const [affNoticeRecord, setAffNoticeRecord] = useLienNoticeRecordChoice()
  // A copy of each notice behind the records: off until someone ticks it, since a batch has many notices behind it.
  const [affNoticeCopies, setAffNoticeCopies] = useLienNoticeCopiesBatchChoice()
  const affPrintWords = lienAffidavitPrintWords(affPrintPlan, affShown ? { hiddenReady: affPrintPlanAll.ready.length - affPrintPlan.ready.length } : null)
  // The bar's status line and its amber press (v2.7209).
  const affPrintStatus = lienAffidavitPrintBarStatus({ ready: affPrintPlan.ready.length, gated: affPrintPlan.gated.length })
  const affHeldStrip = useRef<HTMLDivElement>(null)
  const showHeldAffidavits = (on: boolean) => {
    setAffHeldOnlyPicked(on)
    // The held papers are in Ready to file: a pile picked in the header would hide them.
    if (on) setAffPile(null)
    // The rows sit under the bars: bring the narrowed list's first line into view once it is drawn.
    if (on) window.setTimeout(() => affHeldStrip.current?.scrollIntoView?.({ block: 'nearest' }), 0)
  }
  // The county these are signed in (punch list #314): Settings' county, typed over for this print when the notary is somewhere else.
  const affSigning = useLienSigningCounty(issuer)
  // Who a help sheet says to ask (change 9): the job's lien leader, or the dev.
  const askFor = useLienAskPeople()
  const affPrintIssuer = affSigning.issuer
  const affPrintPapers = useMemo((): LienAffidavitPrintPaper[] => {
    if (!data) return []
    // In clerk order (change 7): each county clerk's papers print together, and the help sheet's rows count them as they lie in the stack.
    // The shown rows alone while a find is typed (punch list #353): a paper the find hides is not printed and not listed as held, since nobody held it.
    return lienAffidavitClerkOrder(lienAffidavitPrintPlan(lienAffidavitShownEntries(data.affidavits.entries, affShown)).ready.flatMap((e): LienAffidavitPrintPaper[] => {
      const fields = lienDeskAffidavitFieldsFor({ data, jobId: e.jobId, issuer: affPrintIssuer, signerNameFor, todayYmd })
      const job = data.jobsById[e.jobId]
      if (!fields) return []
      // What the help sheet says the app checked: the property record's own marks, and the notice behind each sworn month.
      const address = job?.customer_address_id ? data.addressesById[job.customer_address_id] ?? null : null
      const filings = data.filingsByJob[e.jobId] ?? []
      // The months set by hand (v2.7270) stand in for the record's on the paper, the check and the sheet's row.
      const byHand = data.affidavitMonthsByJob[e.jobId] ?? null
      const swornFacts = { isSub: e.isSub, workDays: job ?? null, lastMonth: e.lastMonth, todayYmd, monthsByHand: byHand?.months ?? null }
      const swornMonths = lienAffidavitSwornMonths({ ...swornFacts, filings })
      const noticeCheck = lienAffidavitNoticeCheck({ isSub: e.isSub, propertyKind: e.propertyKind, months: swornMonths, filings, work: lienAffidavitWorkMonths(swornFacts) })
      const noticeLines = lienNoticeCheckLines(noticeCheck)
      // A month from a bill or the job's creation (v2.7224) is flagged on both sheets, never held: neither reads On record for it.
      const monthStandIn = lienStandInSourceOf(e.lastMonthFromCreation, e.lastMonthFromBill)
      // A stand-in month a person confirmed (v2.7280): the sheet's row reads ✓ and the record names the check where the flag was.
      const monthChecked = lienMonthCheckedFor({ source: monthStandIn, month: e.lastMonth, check: parseLienMonthCheck(job) })
      const monthCheck = monthChecked ? lienMonthCheckedSheetRow(monthChecked, formatYmdMonthDay) : null
      // The notice record (punch list #322): the same months and the same rows, read against the paper's own two sentences.
      const noticeRecord = lienNoticeRecord({ isSub: e.isSub, propertyKind: e.propertyKind, swornMonths, filings, paperMonthsWords: fields.workMonthsWords ?? '', paperNoticesWords: fields.noticesSentWords ?? '', workStart: fields.workStart, workEnd: fields.workEnd, monthStandIn, monthCheck })
      const checked = { propertyKind: e.propertyKind, homestead: resolveLienProperty(address, data.ownerByJob[e.jobId] ?? null).homestead, noticeLines, noticeRow: lienNoticeCheckRowLine(noticeCheck), monthStandIn, monthsByHand: byHand ? lienAffidavitMonthsByHandCheck(byHand, formatYmdMonthDay) : null, monthCheck }
      return [{ jobId: e.jobId, jobNumber: job ? effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '—' : '—', fields, label: jobLabel(job, e.jobId), fileBy: e.deadline ? demandDate(e.deadline) : '', checked, clerk: lienClerkFor(issuer?.countyClerksText, fields.county), ask: askFor(job?.master_user_id ?? null), noticeRecord }]
    }))
  }, [data, affShown, affPrintIssuer, issuer?.countyClerksText, askFor, signerNameFor, todayYmd])
  // Which of them take a second sheet (v2.6930): each paper as its own Lien window lays it out, read under the press.
  const affSheetPapers = useMemo(() => lienAffidavitSheetPapers(affPrintPapers), [affPrintPapers])
  const affNoticeCopyCount = useMemo(() => lienAffidavitBatchNoticeCopyCount(affPrintPapers), [affPrintPapers])
  const printReadyAffidavits = () => {
    if (!data || affPrintWords.dead) return
    // The help sheet prints first (punch list #314): the blanks, when to stop, and a row for each paper. It is in no job's filed copy.
    const helpSheet = affHelpSheet
      ? lienAffidavitBatchHelpSheet(
          affPrintPapers,
          [
            ...affPrintPlan.held.map((e) => ({ jobLabel: jobLabel(data.jobsById[e.jobId], e.jobId), reason: LIEN_HELP_EARLIER_FORM_REASON })),
            // A ready paper a gate has closed since it was approved is not printed; the sheet names it with the gate's own reason.
            ...affPrintPlan.gated.map((g) => ({ jobLabel: jobLabel(data.jobsById[g.entry.jobId], g.entry.jobId), reason: g.reason })),
          ],
          demandDate(todayYmd),
          { guideCode: lienHelpGuideCode(), recordCode: lienHelpBatchRecordCode(), recordFollows: affNoticeRecord },
        )
      : null
    // The notice records, then a copy of each notice when its box is ticked, print behind the help sheet and in front of the stack, never between two papers (punch list #322).
    const noticeCopies = affNoticeCopies ? lienAffidavitBatchNoticeCopies(affPrintPapers, filingLetterheadFromIssuer(issuer), todayYmd) : ''
    const run = lienAffidavitPrintRun(affPrintPapers, helpSheet, affNoticeRecord ? lienAffidavitBatchNoticeRecords(affPrintPapers, demandDate(todayYmd), Boolean(noticeCopies)) : null, noticeCopies)
    if (!openHtmlPrintWindow(run.html)) {
      showToast('Popup blocked — allow popups to print.', 'error')
      return
    }
    // A print counts as a send (docs/SENT_COPIES.md): each job keeps its own paper, as its Lien window's print files it.
    for (const copy of run.copies) void fileSentCopy({ ...copy.filing, how: 'print' }, { html: copy.html })
  }
  // Every pile with rows gets a stacked title, as the Notices list draws them (the owner's ask of 2026-11-15); the held-only list keeps the title's count to the rows it shows.
  const affPilesShown = LIEN_AFFIDAVIT_PILES.map((p) => ({ p: p.key, label: p.label, rows: affVisible.filter((e) => e.pile === p.key), total: affVisibleAll.filter((e) => e.pile === p.key).length })).filter((x) => (finding ? x.total > 0 : x.rows.length > 0))
  const toggleAffPrintFold = () => setAffPrintFolded((v) => !v)
  return {
    affPrintPlanAll,
    affHeldOnly,
    affVisible,
    affSelected,
    affShown,
    affPrintPlan,
    affCount,
    affPilesShown,
    redrawPlan,
    redrawWords,
    redrawReady,
    redrawBusy,
    redrawFailed,
    affSendPlanAll,
    affSendPlan,
    affSendWords,
    sendDraftedAffidavits,
    affSendBusy,
    affSendFailed,
    affHelpSheet,
    setAffHelpSheet,
    affNoticeRecord,
    setAffNoticeRecord,
    affNoticeCopies,
    setAffNoticeCopies,
    affPrintWords,
    affPrintStatus,
    affHeldStrip,
    showHeldAffidavits,
    affSigning,
    affSheetPapers,
    affNoticeCopyCount,
    printReadyAffidavits,
    affPrintFolded,
    toggleAffPrintFold,
  }
}
