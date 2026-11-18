import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchJobWithDetailsById } from '../../lib/fetchJobWithDetailsById'
import { noticeInvoiceDocs, noticeInvoicePrintSections, unpaidBilledInvoices, type NoticeInvoiceDoc } from '../../lib/jobs/noticeInvoiceEnclosure'
import { fetchStripeInvoiceFacts } from '../../lib/stripeInvoiceFacts'
import type { BillingStripeModePref } from '../../lib/billingStripeModePref'
import type { PhysicalInvoiceIssuer } from '../../lib/physicalInvoiceIssuer'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { openHtmlPrintWindow, openHtmlWindowWhenReady } from '../../lib/jobsDocuments/printWindow'
import { printAndFile } from '../../lib/sent/sentCopiesIo'
import { lienRunGuideCode } from '../../lib/jobs/lienHelpGuideCode'
import { describeNoticeMonths } from '../../lib/jobs/lienNoticeDraft'
import { runEnvelopeHold, runMailing, type RunMailing } from '../../lib/jobs/lienRunPaper'
import { runLabelCsv, runLabelFilename, runLabelRows, runLabelSavedWords } from '../../lib/jobs/lienRunLabels'
import { RUN_SEND_METHODS, recipientViaDocsmit, noticesFullyPrinted, runCopyHtml, runCopyKey, runCopyPages, runCourtesyResultWords, runEnvelopeFacesHtml, runEnvelopeHtml, runNoticePrintRefusal, runNoticeProblems, runOpening, runPacketHtml, runPagesHtml, runPayPageBlocks, trackingShape, type RunNotice, type RunPayPages, type RunRecipient, type RunSendMethod } from '../../lib/jobs/lienDeskRun'
import { demandDate } from '../../lib/jobsDocuments/demandLetter'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { payPageRows, type PayPageAssets, type PayPageRow } from '../../lib/jobs/lienNoticePayPage'
import { buildPayPageAssets } from '../../lib/jobs/lienNoticePayPageAssets'
import { filingDocHtml, type FilingDocBlock } from '../../lib/jobsDocuments/lienFilingDocuments'
import { envelopeCourtesy, runCopies, runEnvelopes, type RunEnvelope } from '../../lib/jobs/runEnvelopes'
import { buildRunNoticePdf, recordLienDeskRun } from '../../lib/jobs/lienDeskRunIo'
import { runCourtesyEmails, runCourtesyPreviewHtml, type RunCourtesyAttachment } from '../../lib/jobs/lienRunCourtesyPreview'
import { COMPANY_EMAIL_FROM_LABEL } from '../../lib/customerEmailFrom'
import { combineNoticesByProperty, combineSummary, type CombinedRunNotice } from '../../lib/jobs/lienNoticeCombine'
import { useToastContext } from '../../contexts/ToastContext'
import { runMarkedPrintedWords, runNoticesTakenBack, runPrintedItemIds, runSignedCount, runSittingWithout, runTakeBackConfirm, runTakeBackOneConfirm, runTakenBackOneWords, runTakenBackWords, runTypedTrackingCount } from '../../lib/jobs/lienRunTakeBack'
import { RUN_CLOSE_PAID_CAUTION, runClosePaidConfirm, runClosedPaidWords, runNoticesClosed, runPaidNotices } from '../../lib/jobs/lienRunClosePaid'
import { batchOutcomeWords } from '../../lib/batchWords'
import LienRunPreviewOverlay, { type LienRunPreviewEntry } from './LienRunPreviewOverlay'
import { lienSignCodeStatus, signLienDeskItem, signLienDeskItemWithCode } from '../../lib/jobs/lienDeskSignIo'
import { lienCodeRefusalWords, lienCodeSignerFrom, lienCodeStatusStale, lienFirstName, type LienCodeStatusRead } from '../../lib/jobs/lienCodeSigner'
import { lienNoticeSignatureAfterSigning } from '../../lib/jobs/lienNoticeSignature'
import { LienNoticeSignLine, type LienNoticeSignLineHandle } from './LienNoticeSignLine'
import LienPenSignaturePane, { type PenPaneRecorded } from './LienPenSignaturePane'
import LienRunJourney from './LienRunJourney'
import LienRunEnvelopeGlyph from './LienRunEnvelopeGlyph'
import { runEnvelopeChip, runEnvelopeStage, type RunEnvelopeStageState } from '../../lib/jobs/runEnvelopeStage'
import { lienRunBatchPlans, lienRunChecklistRows, lienRunSheetHtml, LIEN_RUN_SHEET_CSS, type LienRunRow, type LienRunTickPrinted } from '../../lib/jobs/lienRunChecklist'
import LienRunChecklist from './LienRunChecklist'
import LienRunScanPress from './LienRunScanPress'
import { lienRunMailCode } from '../../lib/jobs/lienHelpGuideCode'
import { useIsMobile } from '../../hooks/useIsMobile'
import { lienRunMailByWords, lienRunParts, lienRunSubLine, type LienRunPartKey } from '../../lib/jobs/lienRunParts'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import DocsmitReviewModal from './DocsmitReviewModal'
import { EmptyState } from '../EmptyState'
import { LIEN_RUN_EMPTY } from '../../lib/jobs/lienDeskEmptyWords'
import { useDocsmitSettings } from '../../hooks/useDocsmitSettings'
import { docsmitCandidates, docsmitPriceWords, docsmitRunDoor, docsmitSendByStrip, docsmitSendOutcome } from '../../lib/mail/runDocsmit'
import { docsmitHeldWords, docsmitRecipientPatches, prepareDocsmitRun, sendDocsmitRun, type DocsmitPrepareOutcome } from '../../lib/mail/runDocsmitIo'
import { noticeDeadlineForMonth } from '../../lib/jobs/lienDeadlines'
import { runEscapeAction, runHoldSinceOpen, runHoldWords } from '../../lib/jobs/lienRunEscape'
import { useModalStackEntry } from '../../hooks/useModalStackEntry'
import { formatErrorMessage } from '../../utils/errorHandling'
import { LIEN_MAILED_COPY_WORDS, lienMailedCopyAddedWords, lienMailedCopyProblem, lienMailedCopyPutBackWords, lienMailedCopyTakenOffWords, type LienMailedCopy } from '../../lib/jobs/lienMailedCopies'
import { addLienMailedCopy, removeLienMailedCopy, restoreLienMailedCopy } from '../../lib/jobs/lienMailedCopiesIo'
import { driveFileIdOfUrl, fileTakenOffWords, TAKE_OFF_FILE_WORDS, type FileTakenOff } from '../../lib/jobs/jobFolderTrash'
import { takeFileToTrash, untrashJobFolderFile } from '../../lib/jobs/jobFolderTrashIo'
import { addFileCanRetry } from '../../lib/jobs/addFileFailure'
import { LIEN_RUN_ACT, lienRunWhatWords, lienRunWindowTitle } from '../../lib/jobs/lienRunWords'
import { lienRunEnvelopePropertyLine, type LienRunProperty } from '../../lib/jobs/lienRunEnvelopeProperty'

/** Which of the window's three stacks a notice's envelopes sit in, by its part (`lienRunParts`): what prints now, what printed, what is stopped. */
const stackOf = (part: LienRunPartKey | undefined): 'ready' | 'printed' | 'rest' => (part === 'ready' ? 'ready' : part === 'owe' || part === 'record' ? 'printed' : 'rest')

/**
 * Send the run: every approved notice on the desk as one packet (the cover
 * sheet listing the envelopes, then what goes in each — the owner's copy
 * behind its cover page, the original contractor's copy alone) and one form
 * for the tracking numbers, one per envelope. Notices to one name at one
 * address share an envelope (v2.3720): two jobs at one property, and every
 * copy for the one original contractor. Record the run writes each notice to
 * its job with every month it named and marks the desk items sent.
 *
 * Since v2.7477 (punch list #362, the owner's go on `to-dos/lien-to-do-one-run/run-window.html`) the window has one
 * count, in notices, from `lienRunParts`: the journey's three steps, the count line under it, the rows' groups and
 * the foot's one press all read it. The press does what its count says: *Print N notices* prints the ready notices,
 * each whole, and *Record N mailings* takes the ones ready to record. So a notice that is stopped (held, or waiting
 * on the signature) no longer keeps a ready notice's copy out of the packet by sharing its envelope: the envelopes
 * are stacked by part, and a stopped notice's copy goes in the next packet's envelope. Everything rarely pressed is
 * under More.
 */
export default function LienDeskRunModal({
  notices: initial,
  issuer,
  todayYmd,
  userId,
  onClose,
  onRecorded,
  onPrinted,
  onTakeBack,
  onClosePaid,
  openOnTakeBack = false,
  undo,
  stripeMode = 'live',
  viewer = null,
  focusMailItemId = null,
  addMailedCopy = addLienMailedCopy,
  removeMailedCopy = removeLienMailedCopy,
  restoreMailedCopy = restoreLienMailedCopy,
  trashFile = takeFileToTrash,
  untrashFile = untrashJobFolderFile,
  properties = null,
  onOpenProperty,
}: {
  notices: RunNotice[]
  issuer: PhysicalInvoiceIssuer | null
  todayYmd: string
  userId: string | null
  onClose: () => void
  /** After a record, a signature or a mailing through Docsmit (v2.5532) — the desk re-reads. */
  onRecorded: () => void
  /** The packet printed (v2.4119), or the copies went through Docsmit (v2.5532): the desk stamps these items printed so they sit in "In the mail · tracking owed" until recorded. */
  onPrinted?: (itemIds: string[]) => Promise<void> | void
  /**
   * Take back what printed (punch list #101): nothing was mailed, so these items go back to Ready
   * to send with their approvals. The host writes it and re-reads; it returns how many it took back.
   */
  onTakeBack?: (itemIds: string[]) => Promise<number>
  /**
   * Close paid notices (v2.7353): the job owes $0 now, so these items leave the run and the desk with
   * nothing mailed. The host writes it and re-reads; it returns which closed and which did not, with the reason.
   */
  onClosePaid?: (itemIds: string[]) => Promise<{ closed: string[]; failed: Array<{ itemId: string; why: string }> }>
  /** Open on the take-back confirm: To do's run row pressed *Take back…* (punch list #101 PR 2). */
  openOnTakeBack?: boolean
  /**
   * The run was started a moment ago by one click (Put a GC on notice's Approve all, v2.4541):
   * a strip under the title offers to undo that click. The opener owns what undo does.
   */
  undo?: { words: string; busy: boolean; onUndo: () => void }
  /** Which Stripe the enclosed bills' numbers are read from (v2.4852): a dev's test-mode pick, live for everyone else. */
  stripeMode?: BillingStripeModePref
  /** Who is at this screen (v2.5086): Leader here, sign ▸ on a held row attributes the leader's drawing to him and names this sign-in as the screen. Null hides the door. */
  viewer?: { userId: string | null; name: string } | null
  /** A sheet's code was scanned (v2.7328, `?run=<itemId>&mail=1`): the checklist scrolls to this notice's Mailed box and puts the cursor in it. */
  focusMailItemId?: string | null
  /** The upload behind *Add what was mailed*; a test hands its own. */
  addMailedCopy?: typeof addLienMailedCopy
  /** Take a file off a notice's list (v2.7525); a test hands its own. */
  removeMailedCopy?: typeof removeLienMailedCopy
  /** Put it back (v2.7699): the taken-off file listed on its notice again; a test hands its own. */
  restoreMailedCopy?: typeof restoreLienMailedCopy
  /** The taken-off file into Drive's trash, and back out of it; a test hands its own. */
  trashFile?: typeof takeFileToTrash
  untrashFile?: typeof untrashJobFolderFile
  /**
   * Every property the host's desk holds a job at (v2.7559, `lienRunProperties`): an envelope says where the other jobs
   * at its properties stand. Absent on a host with no desk in hand: the envelope then says nothing about them.
   */
  properties?: ReadonlyMap<string, LienRunProperty> | null
  /** Open one property whole, over the run. Absent = the line is drawn with no press. */
  onOpenProperty?: (addressId: string) => void
}) {
  const { showToast } = useToastContext()
  const [notices, setNotices] = useState<RunNotice[]>(initial)
  // What the run opened with (v2.5530): Esc holds the run open over anything typed since; the desk rebuilds `initial` on every render.
  const openedWith = useRef(initial).current
  const openedYmd = useRef(todayYmd).current
  const isTopmostModal = useModalStackEntry(true)
  const [busy, setBusy] = useState(false)
  // Leader here, sign ▸ (v2.5086): the held envelope whose sign sheet is open, and the line he draws on.
  const [signOpen, setSignOpen] = useState<string | null>(null)
  const signRef = useRef<LienNoticeSignLineHandle>(null)
  // His code on this screen (v2.6733, punch list #150): the leader's code status, read when the sign sheet opens on his envelope and he is not
  // the one signed in here; the last refused code sits under the field; a lock or a missing code reads the status again.
  const [codeStatus, setCodeStatus] = useState<{ userId: string; status: LienCodeStatusRead } | null>(null)
  const [codeTick, setCodeTick] = useState(0)
  const [codeProblem, setCodeProblem] = useState<string | null>(null)
  // He signed the paper ▸ (the pen train, PR 2): the held envelope whose pen pane is open — or, since v2.7328, the checklist row's
  // (`item:<itemId>`) or the batch pane's (`batch`) under Mark N signed ▸.
  const [penOpen, setPenOpen] = useState<string | null>(null)
  const isMobile = useIsMobile()
  // The envelope cards and their copies (v2.7328): under the rows, folded since v2.7477 on a computer as on a phone. The rows are the run.
  const [cardsOpen, setCardsOpen] = useState(false)
  // More ▾ (Run-4): the foot's secondary doors, folded.
  const [moreOpen, setMoreOpen] = useState(false)
  // Mail through Docsmit (the Docsmit train, PR 5b): the switches, what prepare made of the certified envelopes, the review, the send's outcome.
  const docsmit = useDocsmitSettings()
  const [dsm, setDsm] = useState<{ stage: 'idle' | 'preparing' | 'review' | 'sending'; outcome: DocsmitPrepareOutcome | null; sent: string | null }>({ stage: 'idle', outcome: null, sent: null })
  // Printed in this sitting (v2.7328): when and by whom, for the checklist's Printed tick — the print press, a reprint, or the tick by hand.
  const [printedNowAt, setPrintedNowAt] = useState<ReadonlyMap<string, LienRunTickPrinted>>(() => new Map())
  // The saved copy (v2.3763): where the office keeps the packet as printed — one link and a line for the whole run; every notice's record carries it.
  const [docUrl, setDocUrl] = useState('')
  const [docNote, setDocNote] = useState('')
  // The mailing (v2.4119): when the packet printed — in this sitting, or before it when every notice
  // handed in is already printed (v2.4823: the run then opens on recording, not on printing again) — and the day the envelopes went out.
  const opening = useMemo(() => runOpening(initial), [initial])
  // Taken back in this sitting (punch list #101): the window goes back to printing, whatever the opening said.
  const [takenBack, setTakenBack] = useState<{ count: number; printedAt: string | null; signed: number; job?: string } | null>(null)
  // Un-print one notice (v2.7481): the row whose Printed tick was pressed, while its confirm is up; and the rows just
  // marked printed by hand, whose undo is one press away. `stamping` is the desk's printed stamps still on their way,
  // so a take-back pressed a moment after a mark waits for the stamp it undoes.
  const [takeBackOne, setTakeBackOne] = useState<string | null>(null)
  const [markedByHand, setMarkedByHand] = useState<string[] | null>(null)
  const stamping = useRef<Promise<unknown>>(Promise.resolve())
  const [takeBackOpen, setTakeBackOpen] = useState(openOnTakeBack)
  // Close paid notices (v2.7353): the items the confirm is asking about, then what the close did.
  const [closePaidIds, setClosePaidIds] = useState<string[] | null>(null)
  const [closedPaid, setClosedPaid] = useState<{ count: number; head: string | null; failed: Array<{ label: string; why: string }> } | null>(null)
  const recording = opening.step === 'record' && takenBack == null
  const [printedAt, setPrintedAt] = useState<string | null>(opening.printedAt)
  // The items whose every copy printed in this sitting: with the ones printed before it, what a take-back clears.
  const [printedNow, setPrintedNow] = useState<string[]>([])
  const [mailedOn, setMailedOn] = useState(todayYmd)
  // One notice per property (#35 PR 3): off until the office ticks it — the form's claim changes when jobs combine.
  const [combine, setCombine] = useState(false)
  const combinable = useMemo(() => combineSummary(combineNoticesByProperty(notices, { combine: true })), [notices])
  const shown: CombinedRunNotice[] = useMemo(() => combineNoticesByProperty(notices, { combine }), [notices, combine])
  const partsOf = (n: CombinedRunNotice) => (n.parts && n.parts.length > 1 ? n.parts : null)
  // The property record each job points at (v2.7559), read off the notices as handed in: a combined notice's jobs each keep their own.
  const propertyOfJob = useMemo(() => new Map(notices.map((n) => [n.jobId, n.propertyId ?? null])), [notices])
  // The unpaid invoices behind each notice (v2.3437, § 53.056(a-3)) — loaded once per job.
  const [invoiceDocsByJob, setInvoiceDocsByJob] = useState<Record<string, NoticeInvoiceDoc[]>>({})
  const [payByJob, setPayByJob] = useState<Record<string, { rows: PayPageRow[]; assets: PayPageAssets }>>({})
  // The bills and pay codes read once (v2.5073): until then a courtesy PDF would go without them, so its preview waits.
  const [enclosuresRead, setEnclosuresRead] = useState(false)
  useEffect(() => {
    let cancelled = false
    const jobIds = Array.from(new Set(initial.map((n) => n.jobId)))
    void (async () => {
      const next: Record<string, NoticeInvoiceDoc[]> = {}
      await Promise.all(
        jobIds.map(async (id) => {
          try {
            const job = await fetchJobWithDetailsById(id)
            if (!job) return
            // Stripe's own number and due day on each enclosed bill (v2.4852); without an answer the app's document prints.
            const facts = await fetchStripeInvoiceFacts(unpaidBilledInvoices(job).filter((i) => (i.stripe_invoice_id ?? '').trim()).map((i) => i.id), stripeMode)
            next[id] = noticeInvoiceDocs(job, facts)
          } catch {
            // the notice goes without its invoice; the statute only permits the enclosure
          }
        }),
      )
      if (!cancelled) setInvoiceDocsByJob(next)
      // The pay page's codes (v2.3758): one per Stripe bill, built once the bills are known.
      const pay: Record<string, { rows: PayPageRow[]; assets: PayPageAssets }> = {}
      await Promise.all(
        Object.entries(next).map(async ([id, docs]) => {
          const rows = payPageRows(docs)
          pay[id] = { rows, assets: rows.some((r) => r.payable) ? await buildPayPageAssets(rows).catch(() => ({})) : {} }
        }),
      )
      if (!cancelled) {
        setPayByJob(pay)
        setEnclosuresRead(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [initial, stripeMode])
  // The enclosures by the notice that prints them: a combined notice carries every part's invoices and bills under the lead job's id.
  const invoiceDocsShown = useMemo(() => {
    const out: Record<string, NoticeInvoiceDoc[]> = { ...invoiceDocsByJob }
    for (const n of shown) {
      const parts = partsOf(n)
      if (parts) out[n.jobId] = parts.flatMap((p) => invoiceDocsByJob[p.jobId] ?? [])
    }
    return out
  }, [shown, invoiceDocsByJob])
  const invoiceSectionsByJob = useMemo(() => Object.fromEntries(Object.entries(invoiceDocsShown).map(([id, docs]) => [id, noticeInvoicePrintSections(docs)])), [invoiceDocsShown])
  const invoicesEnclosed = shown.reduce((s, n) => s + (invoiceDocsShown[n.jobId]?.length ?? 0), 0)
  // The pay page per job and copy (v2.3758): blocks for the emailed PDF, HTML for the printed packet.
  const payBlocksByJob = useMemo(() => {
    const out: Record<string, Partial<Record<'owner' | 'original_contractor', FilingDocBlock[]>>> = {}
    const phone = (issuer?.phone ?? '').trim()
    for (const n of shown) {
      const parts = partsOf(n)
      const p = parts
        ? { rows: parts.flatMap((x) => payByJob[x.jobId]?.rows ?? []), assets: Object.assign({}, ...parts.map((x) => payByJob[x.jobId]?.assets ?? {})) as PayPageAssets }
        : payByJob[n.jobId]
      if (!p || p.rows.length === 0) continue
      for (const r of n.recipients) {
        const blocks = runPayPageBlocks(n, r, p.rows, p.assets, phone)
        if (blocks.length) (out[n.jobId] ??= {})[r.key] = blocks
      }
    }
    return out
  }, [shown, payByJob, issuer])
  const payPagesByJob = useMemo<RunPayPages>(
    () => Object.fromEntries(Object.entries(payBlocksByJob).map(([id, byCopy]) => [id, Object.fromEntries(Object.entries(byCopy).map(([k, blocks]) => [k, filingDocHtml(blocks!)]))])),
    [payBlocksByJob],
  )
  const payCodes = shown.reduce((s, n) => s + ((partsOf(n) ?? [{ jobId: n.jobId }]).reduce((t, x) => t + (payByJob[x.jobId]?.rows.filter((r) => r.payable).length ?? 0), 0)), 0)
  const problemsOf = useMemo(() => new Map(shown.map((n) => [n.itemId, runNoticeProblems(n)])), [shown])
  // The checklist (v2.7328): one row per notice with its three ticks, and what each batch press takes and holds.
  const rows = useMemo(() => lienRunChecklistRows({ notices, printedNow: printedNowAt }), [notices, printedNowAt])
  const plans = useMemo(() => lienRunBatchPlans(rows), [rows])
  const leaderName = useMemo(() => notices.find((n) => n.leader?.name)?.leader?.name ?? null, [notices])
  // The one count (v2.7477): every notice in one part. Jobs combined onto one form go at the pace of the most stopped.
  const together = useMemo(() => shown.flatMap((n) => (n.parts && n.parts.length > 1 ? [n.parts.map((p) => p.itemId)] : [])), [shown])
  const partOfItem = useMemo(() => lienRunParts(rows, [], { together }).partOf, [rows, together])
  // The run on paper (v2.4971, v2.7477): the envelopes in three stacks, so the window lists them as the paper does. What
  // prints now comes first, numbered as the packet numbers them; then what printed; then what is stopped, each held
  // with its reason and never printed by the packet. A stopped notice shares no envelope with a ready one: its copy
  // goes out in the next packet's envelope, with a number of its own.
  const mailing = useMemo<RunMailing>(() => {
    const stack = (which: 'ready' | 'printed' | 'rest') => runEnvelopes(shown.filter((n) => stackOf(partOfItem.get(n.itemId)) === which)).map((env) => ({ ...env, key: `${which}:${env.key}` }))
    const going = runMailing([...stack('ready'), ...stack('printed')])
    const heldOf = new Map(rows.map((r) => [r.itemId, r.held]))
    const stopped = stack('rest').map((env) => {
      const notice = env.contents.map((c) => heldOf.get(c.notice.itemId)).find(Boolean)
      return { env, why: runEnvelopeHold(env) ?? (notice ? `With its notice: ${notice}` : 'Its notice is not ready to print.') }
    })
    const held = [...going.held, ...stopped].map((h, i) => ({ env: { ...h.env, n: going.mailed.length + i + 1 }, why: h.why }))
    return { mailed: going.mailed, held, all: [...going.mailed, ...held.map((h) => h.env)] }
  }, [shown, partOfItem, rows])
  const envelopes = mailing.all
  const heldWhy = useMemo(() => new Map(mailing.held.map((h) => [h.env.key, h.why])), [mailing])
  const shared = envelopes.length < runCopies(shown)
  // Who the waiting notices wait on: their leader when they share one, else *the leader*.
  const waitLeader = useMemo(() => {
    const names = new Set(rows.filter((r) => partOfItem.get(r.itemId) === 'wait').map((r) => (r.leader?.name ?? '').trim()))
    return names.size === 1 ? [...names][0] || null : names.size === 0 ? leaderName : null
  }, [rows, partOfItem, leaderName])
  const parts = useMemo(() => lienRunParts(rows, envelopes, { leaderName: waitLeader, together }), [rows, envelopes, waitLeader, together])
  // What the run holds (v2.7489): the paper and the stage, said in the head, so nobody counts a property's affidavits or its sent notices against it.
  const what = useMemo(() => lienRunWhatWords({ monthly: notices.filter((n) => n.kind !== 'retainage_53_057').length, retainage: notices.filter((n) => n.kind === 'retainage_53_057').length }), [notices])
  // The window's second line: the copies and the envelopes, named once, and the first of the notices' last days to mail.
  const subLine = useMemo(() => {
    const line = lienRunSubLine({ copies: runCopies(shown), envelopes: envelopes.length, mailByWords: lienRunMailByWords(notices.map((n) => n.mailBy)) })
    return line && combine && shown.length !== notices.length ? `${line} · combined: ${notices.length} jobs print on ${shown.length} ${shown.length === 1 ? 'form' : 'forms'}` : line
  }, [shown, envelopes, notices, combine])
  // Read a copy before it prints (v2.4621): one entry per copy in packet order, its pages the ones the packet stacks.
  const previewEntries = useMemo<LienRunPreviewEntry[]>(
    () =>
      envelopes.flatMap((env) =>
        env.contents.map(({ notice: n, recipient: r }) => ({
          key: `${n.itemId}-${r.key}`,
          title: `${n.label} · ${r.label.toLowerCase()}`,
          envelopeLine: `Envelope ${env.n} · ${r.label} ${env.name}${env.address ? ` · ${env.address}` : ''}`,
          pages: runCopyPages(n, r, invoiceSectionsByJob, payPagesByJob),
        })),
      ),
    [envelopes, invoiceSectionsByJob, payPagesByJob],
  )
  const [preview, setPreview] = useState<number | null>(null)
  // What the packet is (v2.4621): behind a ? beside the title, so the envelopes come first.
  const [explainerOpen, setExplainerOpen] = useState(false)

  // One method and one tracking number per envelope — every recipient inside it takes the patch, so the record writes the same send on each notice.
  const setEnvelope = (env: RunEnvelope, patch: Partial<Pick<RunRecipient, 'method' | 'tracking' | 'via' | 'pieceId' | 'pieceStatus' | 'pieceProblem'>>) => {
    // Keyed by item and recipient, not by index: a combined notice stands for several items, and every one takes the patch.
    const inside = new Set(env.contents.flatMap((c) => (partsOf(c.notice as CombinedRunNotice) ?? [{ itemId: c.notice.itemId }]).map((p) => `${p.itemId}:${c.recipient.key}`)))
    setNotices((prev) => prev.map((n) => ({ ...n, recipients: n.recipients.map((r) => (inside.has(`${n.itemId}:${r.key}`) ? { ...r, ...patch } : r)) })))
  }
  // The courtesy PDF (punch list #87 B): the tick reaches every original contractor's copy inside, never an owner's.
  const setCourtesy = (env: RunEnvelope, on: boolean) => {
    const inside = new Set(env.contents.filter((c) => c.recipient.key === 'original_contractor').flatMap((c) => (partsOf(c.notice as CombinedRunNotice) ?? [{ itemId: c.notice.itemId }]).map((p) => p.itemId)))
    setNotices((prev) => prev.map((n) => (inside.has(n.itemId) ? { ...n, recipients: n.recipients.map((r) => (r.key === 'original_contractor' ? { ...r, courtesy: on } : r)) } : n)))
  }
  // Preview the courtesy email (v2.5073, the owner's ask): the emails this envelope's tick sends, in a new tab, as the
  // original contractor gets them — the send's words and body, and the PDF the record attaches (`buildRunNoticePdf`).
  const previewCourtesy = (env: RunEnvelope) => {
    const emails = runCourtesyEmails(env)
    if (emails.length === 0) return
    const ticked = envelopeCourtesy(env)?.on ?? false
    void openHtmlWindowWhenReady(async () => {
      const attachments = await Promise.all(
        emails.map(async (e): Promise<RunCourtesyAttachment> => {
          try {
            const blob = await buildRunNoticePdf(e.notice, e.recipient.key, invoiceDocsShown[e.notice.jobId] ?? [], payBlocksByJob[e.notice.jobId]?.[e.recipient.key] ?? [])
            const url = URL.createObjectURL(blob)
            // The tab shows the PDF from this window's object URL, so it is let go only after half an hour.
            window.setTimeout(() => URL.revokeObjectURL(url), 30 * 60_000)
            return { url, bytes: blob.size }
          } catch (err) {
            return { error: err instanceof Error && err.message ? err.message : 'the PDF did not build' }
          }
        }),
      )
      return runCourtesyPreviewHtml(emails, { from: COMPANY_EMAIL_FROM_LABEL, ticked, attachments })
    }).then((opened) => {
      if (!opened) showToast('Popup blocked — allow popups to preview the email.', 'error')
    })
  }

  // One item at a time (v2.4853, the owner's ask): a copy or an envelope prints and is filed on its own. A notice is
  // stamped printed only once every copy of it has printed this sitting, so a half-printed notice never reads as in the mail.
  const [printedCopies, setPrintedCopies] = useState<ReadonlySet<string>>(() => new Set())
  const partsIds = (n: CombinedRunNotice) => partsOf(n) ?? [{ itemId: n.itemId, jobId: n.jobId }]
  // Each envelope's stage, for its card: printed when it sits in the printed stack, or every copy inside printed in this sitting.
  const stageByKey = useMemo(() => {
    const out = new Map<string, RunEnvelopeStageState>()
    for (const env of envelopes) out.set(env.key, runEnvelopeStage(env, { printed: env.key.startsWith('printed:') || env.contents.every((c) => partsIds(c.notice as CombinedRunNotice).every((p) => printedCopies.has(runCopyKey(p.itemId, c.recipient.key)))) }))
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envelopes, printedCopies])
  // Mail through Docsmit (PR 5b): the door shows once a dev saved the connection and while not paused, before anything printed;
  // an envelope already mailed through Docsmit leaves the paper paths and its card says so.
  const envelopeViaDocsmit = (env: RunEnvelope) => env.contents.some((c) => recipientViaDocsmit(c.recipient))
  // What goes on paper: the envelopes that go out less the ones Docsmit carries, and the notices with a copy among them.
  // The packet prints the ready ones and the Docsmit door offers the same (v2.5535, v2.7477), so an envelope the run
  // holds back reaches neither, and one that already printed is never offered to Docsmit again.
  const paperMailed = useMemo(() => mailing.mailed.filter((e) => !envelopeViaDocsmit(e)), [mailing])
  const readyPaper = useMemo(() => paperMailed.filter((e) => e.key.startsWith('ready:')), [paperMailed])
  const printedPaper = useMemo(() => paperMailed.filter((e) => e.key.startsWith('printed:')), [paperMailed])
  const paperShown = useMemo(() => shown.map((n) => ({ ...n, recipients: n.recipients.filter((r) => !recipientViaDocsmit(r)) })).filter((n) => n.recipients.length > 0), [shown])
  const docsmitDoor = useMemo(() => {
    const cands = docsmitCandidates(readyPaper)
    // The certified envelopes the run holds back are never candidates; they only name the door's reason.
    const held = docsmitCandidates(mailing.held.map((h) => h.env).filter((e) => !envelopeViaDocsmit(e))).length
    return { cands, door: docsmitRunDoor(docsmit.settings, cands, { held }) }
  }, [readyPaper, mailing, docsmit.settings])
  // Under More while something can still go that way: hidden once the run is on the mail numbers with nothing left to print.
  const showDocsmit = docsmit.loaded && docsmit.setUp && docsmitDoor.door.show && (parts.counts.ready > 0 || parts.counts.owe + parts.counts.record === 0)
  // The send-by strip: the tightest window in the run (the earliest month's deadline on the residential clock), less the buffer, at Docsmit's cutoff.
  const windowLastYmd = useMemo(() => notices.flatMap((n) => n.months.map((m) => noticeDeadlineForMonth(`${m}-01`, ''))).filter(Boolean).sort()[0] ?? null, [notices])
  const sendBy = useMemo(() => {
    const now = new Date()
    return docsmitSendByStrip(windowLastYmd, docsmit.settings, { ymd: todayYmd, local: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}` })
  }, [windowLastYmd, docsmit.settings, todayYmd])
  const docsmitPrice = dsm.outcome ? docsmitPriceWords(dsm.outcome.prepared, dsm.outcome.balance, docsmit.settings.creditWarn) : null
  const openDocsmit = async () => {
    if (busy || dsm.stage !== 'idle') return
    setBusy(true)
    setDsm({ stage: 'preparing', outcome: null, sent: null })
    try {
      const outcome = await prepareDocsmitRun(readyPaper, {
        receipt: docsmit.settings.returnReceipt,
        invoiceDocsByJob: invoiceDocsShown,
        payBlocksByJob,
        payRowsByJob: Object.fromEntries(Object.entries(payByJob).map(([id, v]) => [id, v.rows])),
      })
      setDsm({ stage: 'review', outcome, sent: null })
      // The door sits under More (v2.7477): with the review up, More folds, so Esc after the review answers for the run.
      setMoreOpen(false)
      if (outcome.held.length) showToast(docsmitHeldWords(outcome.held), 'warning')
    } finally {
      setBusy(false)
    }
  }
  const closeDocsmit = () => {
    for (const p of dsm.outcome?.prepared ?? []) {
      try { URL.revokeObjectURL(p.pdfUrl) } catch { /* a stand-in url */ }
    }
    setDsm({ stage: 'idle', outcome: null, sent: null })
  }
  const mailDocsmit = async () => {
    const outcome = dsm.outcome
    if (!outcome || outcome.prepared.length === 0 || busy) return
    setBusy(true)
    setDsm((d) => ({ ...d, stage: 'sending' }))
    try {
      const answer = await sendDocsmitRun(outcome.prepared.map((p) => p.pieceId))
      const result = docsmitSendOutcome(answer, outcome.prepared)
      const patches = docsmitRecipientPatches(outcome.prepared, answer)
      for (const env of envelopes) {
        const patch = patches.get(env.key)
        if (patch) setEnvelope(env, patch)
      }
      // A review closed while it mailed (its own Esc, ×, Close or backdrop) stays closed: back to idle, so the door
      // works again (v2.5530). The toast below still says what went.
      setDsm((d) => (d.outcome == null ? { stage: 'idle', outcome: null, sent: null } : { ...d, stage: 'review', sent: result.words }))
      showToast(result.words, answer.ok ? 'success' : 'warning')
      // Kept the moment it goes (v2.5532), not at Record the run: a notice with every copy out is stamped printed as a print
      // stamps it, and the desk re-reads, so the pieces (which name their desk items) are on every later run. It re-reads
      // too when the answer cannot say what went (it never came back), and the next run asks the pieces.
      const mailedCopies = envelopes.filter((e) => result.mailedKeys.includes(e.key)).flatMap((env) => env.contents.flatMap((c) => partsIds(c.notice as CombinedRunNotice).map((p) => runCopyKey(p.itemId, c.recipient.key))))
      const before = new Set(noticesFullyPrinted(notices, printedCopies).map((n) => n.itemId))
      const outNow = noticesFullyPrinted(notices, new Set([...printedCopies, ...mailedCopies]))
      const out = outNow.map((n) => n.itemId).filter((id) => !before.has(id))
      if (out.length) {
        // The checklist's Printed tick (v2.7328) reads the stamp the moment it is written.
        const at = new Date().toISOString()
        setPrintedNowAt((prev) => {
          const m = new Map(prev)
          for (const id of out) m.set(id, { at, by: viewer?.name?.trim() || null })
          return m
        })
        void Promise.resolve(onPrinted?.(out)).catch(() => undefined)
      }
      if (result.mailedKeys.length > 0 || (!answer.ok && !answer.stopped_at)) onRecorded()
      // Every envelope that was to print is through Docsmit, or every notice is out: the run is past its print.
      const paperLeft = readyPaper.filter((e) => !result.mailedKeys.includes(e.key))
      if (result.mailedKeys.length > 0 && (paperLeft.length === 0 || outNow.length === notices.length)) setPrintedAt((v) => v ?? new Date().toISOString())
    } finally {
      setBusy(false)
    }
  }
  // The notices in an envelope the leader has not signed (v2.5086), by the run's own list so a combined notice's parts are found.
  const unsignedIn = (env: RunEnvelope): RunNotice[] => {
    const seen = new Set<string>()
    const out: RunNotice[] = []
    for (const c of env.contents) {
      for (const p of partsIds(c.notice as CombinedRunNotice)) {
        if (seen.has(p.itemId)) continue
        seen.add(p.itemId)
        const n = notices.find((x) => x.itemId === p.itemId)
        if (n && n.signature === null) out.push(n)
      }
    }
    return out
  }
  // The leader whose sign sheet is open, and whether this is someone else's screen (then his code is offered beside the pad).
  const signEnv = signOpen ? envelopes.find((e) => e.key === signOpen) ?? null : null
  const signLeader = signEnv ? unsignedIn(signEnv)[0]?.leader ?? null : null
  const codeLeaderId = signLeader?.userId && viewer?.userId && signLeader.userId !== viewer.userId ? signLeader.userId : null
  useEffect(() => {
    setCodeProblem(null)
    if (!codeLeaderId) {
      setCodeStatus(null)
      return
    }
    let live = true
    setCodeStatus({ userId: codeLeaderId, status: 'loading' })
    lienSignCodeStatus(codeLeaderId)
      .then((s) => {
        if (live) setCodeStatus({ userId: codeLeaderId, status: s ?? 'not_live' })
      })
      .catch(() => {
        if (live) setCodeStatus({ userId: codeLeaderId, status: 'not_live' })
      })
    return () => {
      live = false
    }
  }, [codeLeaderId, codeTick])
  const codeSigner = codeLeaderId && signLeader ? lienCodeSignerFrom(signLeader.name, codeStatus?.userId === codeLeaderId ? codeStatus.status : 'loading') : null
  // Leader here, sign ▸: he draws on this screen, or types his code (v2.6733); each unsigned notice in the envelope gets the mark, attributed to him, the row naming this sign-in's screen.
  const signHere = async (env: RunEnvelope) => {
    if (busy || !viewer) return
    const targets = unsignedIn(env)
    const leader = targets[0]?.leader ?? null
    if (!leader) return
    const h = signRef.current
    const byCode = h?.mode === 'code'
    const code = byCode ? h.code() : ''
    const png = byCode ? '' : (h?.toDataURL() ?? '')
    if (byCode ? code.length < 4 : !png) {
      showToast(byCode ? `Type ${lienFirstName(leader.name)}’s signing code first.` : 'Sign on the line first.', 'error')
      return
    }
    setBusy(true)
    try {
      const signed: RunNotice[] = []
      for (const n of targets) {
        if (byCode) {
          // His code, checked in the database, the record naming this sign-in's screen; a refused code stops at the first notice and says why under the field.
          const r = await signLienDeskItemWithCode({ itemId: n.itemId, fields: n.rowFields ?? null, signerUserId: leader.userId ?? '', code, approve: false })
          if (!r.ok) {
            const words = lienCodeRefusalWords(r)
            setCodeProblem(words)
            if (lienCodeStatusStale(r.reason)) setCodeTick((t) => t + 1)
            showToast(words, 'error')
            break
          }
          setCodeProblem(null)
          signed.push({ ...n, signature: lienNoticeSignatureAfterSigning({ mode: 'code', printedName: leader.name, pngDataUrl: null, signedAtIso: r.signedAtIso, jobNumber: n.jobNumber, itemId: n.itemId, onDeviceName: viewer.name }) })
          continue
        }
        const r = await signLienDeskItem({ itemId: n.itemId, fields: n.rowFields ?? null, signer: { userId: leader.userId, printedName: leader.name }, payload: { mode: 'draw', signaturePngBase64: png }, onDevice: { userId: viewer.userId, name: viewer.name }, approve: false })
        if (!r.ok) {
          showToast(r.message, 'error')
          break
        }
        signed.push({ ...n, signature: lienNoticeSignatureAfterSigning({ mode: 'draw', printedName: leader.name, pngDataUrl: png, signedAtIso: r.signedAtIso, jobNumber: n.jobNumber, itemId: n.itemId, onDeviceName: viewer.name }) })
      }
      if (signed.length) {
        setNotices((prev) => prev.map((n) => signed.find((x) => x.itemId === n.itemId) ?? n))
        setSignOpen(null)
        showToast(signed.length === 1 ? 'Signed. The notice can print now.' : `Signed. ${signed.length} notices can print now.`)
        onRecorded()
      }
    } finally {
      setBusy(false)
    }
  }
  // He signed the paper ▸ (the pen train, PR 2): the office wrote down his pen signature on each ticked notice; dress those rows from what was written and re-read.
  const penRecorded = (env: RunEnvelope, recorded: PenPaneRecorded[], words: string) => {
    const leader = unsignedIn(env)[0]?.leader ?? null
    if (!leader) return
    const byId = new Map(recorded.map((r) => [r.itemId, r]))
    setNotices((prev) =>
      prev.map((n) => {
        const r = byId.get(n.itemId)
        return r ? { ...n, signature: lienNoticeSignatureAfterSigning({ mode: 'pen', printedName: leader.name, pngDataUrl: null, signedAtIso: r.signedAtIso, jobNumber: n.jobNumber, itemId: n.itemId, onDeviceName: null, pen: { recordedByName: viewer?.name ?? null, how: r.how } }) } : n
      }),
    )
    setPenOpen(null)
    showToast(words)
    onRecorded()
  }
  const notePrinted = (keys: string[]) => {
    const next = new Set(printedCopies)
    for (const k of keys) next.add(k)
    setPrintedCopies(next)
    const before = new Set(noticesFullyPrinted(notices, printedCopies).map((n) => n.itemId))
    const done = noticesFullyPrinted(notices, next).filter((n) => !before.has(n.itemId)).map((n) => n.itemId)
    // A reprint (v2.7328): a notice already printed whose copy printed again is stamped again — the tick clears and re-marks with now.
    const touched = new Set(keys.map((k) => k.split(':')[0]!))
    const again = notices.filter((n) => before.has(n.itemId) && touched.has(n.itemId) && n.recipients.every((r) => keys.includes(runCopyKey(n.itemId, r.key)) || recipientViaDocsmit(r))).map((n) => n.itemId)
    const stamped = [...done, ...again]
    if (stamped.length) {
      const at = new Date().toISOString()
      setPrintedNowAt((prev) => {
        const m = new Map(prev)
        for (const id of stamped) m.set(id, { at, by: viewer?.name?.trim() || null })
        return m
      })
    }
    if (done.length) {
      setPrintedNow((prev) => [...prev, ...done.filter((id) => !prev.includes(id))])
      setTakenBack(null)
    }
    if (stamped.length) {
      const landing = Promise.resolve(onPrinted?.(stamped)).catch(() => undefined)
      stamping.current = Promise.all([stamping.current, landing])
    }
    if (noticesFullyPrinted(notices, next).length === notices.length && notices.length > 0) setPrintedAt((v) => v ?? new Date().toISOString())
  }
  // Printed ▸ on a checklist row (v2.7328): the paper printed elsewhere; every copy of it counts as printed, with who and when.
  // What was mailed (the owner's ask of 2026-11-16): a printed row takes a scan or a photo of what goes in its envelope. The file goes
  // into the job's Drive folder and the notice remembers it; a file that cannot go says why and nothing is saved.
  const [addingCopy, setAddingCopy] = useState<string | null>(null)
  // The file that did not go up (v2.7635): its reason stays under the row, and the same file goes again on Try again.
  const [failedCopy, setFailedCopy] = useState<{ itemId: string; file: File; words: string; retry: boolean } | null>(null)
  const addCopy = async (row: LienRunRow, file: File) => {
    const problem = lienMailedCopyProblem(file)
    if (problem) {
      showToast(problem, 'error')
      return
    }
    setAddingCopy(row.itemId)
    setFailedCopy(null)
    try {
      // The file's name says which paper it is: a retainage notice rides in this run beside the monthly ones (v2.7525).
      const paper = notices.find((n) => n.itemId === row.itemId)?.kind === 'retainage_53_057' ? 'retainage' : 'notice'
      const list = await addMailedCopy({ itemId: row.itemId, jobId: row.jobId, jobNumber: row.jobNumber, file, todayYmd, userId, paper })
      setNotices((prev) => prev.map((n) => (n.itemId === row.itemId ? { ...n, mailedCopies: list } : n)))
      const last = list[list.length - 1]
      if (last) showToast(lienMailedCopyAddedWords(last.name), 'success')
      onRecorded()
    } catch (e) {
      const said = formatErrorMessage(e, LIEN_MAILED_COPY_WORDS.failed)
      setFailedCopy({ itemId: row.itemId, file, words: said, retry: addFileCanRetry(e) })
      showToast(said, 'error')
    } finally {
      setAddingCopy(null)
    }
  }
  // Take off (v2.7525): the notice forgets one file. The file stays in the job's Drive folder, and the words say so.
  const [removingCopy, setRemovingCopy] = useState<string | null>(null)
  // Where the file just taken off is now (v2.7699): Drive's trash, or still in Drive with the reason. The link comes
  // off first and stands whatever Drive answers; Put it back lists the file again, out of the trash.
  const [offCopy, setOffCopy] = useState<{ itemId: string; jobId: string; copy: LienMailedCopy; outcome: FileTakenOff | null; working: 'trash' | 'back' | null } | null>(null)
  const copyFileId = (copy: LienMailedCopy): string | null => copy.driveFileId.trim() || driveFileIdOfUrl(copy.url)
  const removeCopy = async (row: LienRunRow, copy: LienMailedCopy) => {
    setRemovingCopy(row.itemId)
    setOffCopy(null)
    try {
      const list = await removeMailedCopy({ itemId: row.itemId, copy })
      setNotices((prev) => prev.map((n) => (n.itemId === row.itemId ? { ...n, mailedCopies: list } : n)))
      onRecorded()
      const outcome = await trashFile(row.jobId, copyFileId(copy))
      setOffCopy({ itemId: row.itemId, jobId: row.jobId, copy, outcome, working: null })
      showToast(lienMailedCopyTakenOffWords(copy.name, outcome), 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, LIEN_MAILED_COPY_WORDS.takeOffFailed), 'error')
    } finally {
      setRemovingCopy(null)
    }
  }
  const trashCopyAgain = async () => {
    const off = offCopy
    if (!off || off.working) return
    setOffCopy({ ...off, working: 'trash' })
    const outcome = await trashFile(off.jobId, copyFileId(off.copy))
    setOffCopy((now) => (now && now.copy === off.copy ? { ...now, outcome, working: null } : now))
  }
  const putCopyBack = async () => {
    const off = offCopy
    if (!off || off.working) return
    setOffCopy({ ...off, working: 'back' })
    try {
      const id = copyFileId(off.copy)
      if (id && off.outcome?.where === 'trash') await untrashFile(off.jobId, id)
      const list = await restoreMailedCopy({ itemId: off.itemId, copy: off.copy })
      setNotices((prev) => prev.map((n) => (n.itemId === off.itemId ? { ...n, mailedCopies: list } : n)))
      setOffCopy(null)
      showToast(lienMailedCopyPutBackWords(off.copy.name), 'success')
      onRecorded()
    } catch (e) {
      setOffCopy((now) => (now && now.copy === off.copy ? { ...now, working: null } : now))
      showToast(formatErrorMessage(e, TAKE_OFF_FILE_WORDS.putBackFailed), 'error')
    }
  }
  const markPrintedByHand = (row: LienRunRow) => {
    const n = notices.find((x) => x.itemId === row.itemId)
    if (!n) return
    notePrinted(n.recipients.map((r) => runCopyKey(n.itemId, r.key)))
    if (onTakeBack) setMarkedByHand([n.itemId])
  }
  // Mark N printed: every ready row at once.
  const markPrintedBatch = () => {
    const keys = plans.print.ready.flatMap((row) => (notices.find((x) => x.itemId === row.itemId)?.recipients ?? []).map((r) => runCopyKey(row.itemId, r.key)))
    if (keys.length) notePrinted(keys)
    if (keys.length && onTakeBack) setMarkedByHand(plans.print.ready.map((row) => row.itemId))
  }
  // A checklist row's number (v2.7328) is the envelope's: every notice sharing the envelope takes it, as the card's box does.
  const trackingFor = (row: LienRunRow, recipientKey: RunRecipient['key'], value: string) => {
    const env = envelopes.find((e) => e.contents.some((c) => c.recipient.key === recipientKey && partsIds(c.notice as CombinedRunNotice).some((p) => p.itemId === row.itemId)))
    if (env) setEnvelope(env, { tracking: value })
  }
  // The pen pane under a checklist row or the batch: the notices it writes for, and the leader it names.
  const penTargets = (key: string | null): RunNotice[] => {
    if (key === 'batch') return plans.sign.ready.map((row) => notices.find((n) => n.itemId === row.itemId)!).filter(Boolean)
    if (key?.startsWith('item:')) {
      const n = notices.find((x) => x.itemId === key.slice(5))
      return n && n.signature === null ? [n] : []
    }
    return []
  }
  const penRecordedRows = (recorded: PenPaneRecorded[], words: string) => {
    const targets = penTargets(penOpen)
    const leader = targets[0]?.leader ?? null
    if (!leader) return
    const byId = new Map(recorded.map((r) => [r.itemId, r]))
    setNotices((prev) =>
      prev.map((n) => {
        const r = byId.get(n.itemId)
        return r ? { ...n, signature: lienNoticeSignatureAfterSigning({ mode: 'pen', printedName: leader.name, pngDataUrl: null, signedAtIso: r.signedAtIso, jobNumber: n.jobNumber, itemId: n.itemId, onDeviceName: null, pen: { recordedByName: viewer?.name ?? null, how: r.how } }) } : n
      }),
    )
    setPenOpen(null)
    showToast(words)
    onRecorded()
  }
  const penPaneFor = (key: string, compact: boolean) => {
    const targets = penTargets(key)
    const leader = targets[0]?.leader
    if (!viewer || !leader || targets.length === 0) return null
    return (
      <LienPenSignaturePane
        compact={compact}
        leader={leader}
        recorder={{ userId: viewer.userId, name: viewer.name }}
        notices={targets.map((n) => ({ itemId: n.itemId, jobNumber: n.jobNumber, label: n.label, amount: n.amount, fields: n.rowFields ?? null }))}
        printedYmd={(() => { const at = printedNowAt.get(targets[0]!.itemId)?.at ?? targets[0]!.printedAt ?? printedAt; return at ? calendarYmdInAppTzFromIso(at) : null })()}
        todayYmd={todayYmd}
        onClose={() => setPenOpen(null)}
        onRecorded={penRecordedRows}
      />
    )
  }
  // Print the sheet (v2.7328): one page for the batch — the rows, their three boxes as the desk holds them, and a code per row that
  // opens this envelope's Mailed box on a phone. A desk paper, never a sent copy, so it is not filed.
  const printSheet = () => {
    const page = `<style>${LIEN_RUN_SHEET_CSS}</style>` + lienRunSheetHtml({ rows, todayYmd, dayWords: demandDate(todayYmd), issuerName: (issuer?.companyName ?? '').trim() || 'The run', codeFor: lienRunMailCode })
    if (!openHtmlPrintWindow(runPagesHtml([page], `The run — ${demandDate(todayYmd)}`))) showToast('Popup blocked — allow popups to print the sheet.', 'error')
  }
  // The one print (v2.7477): the ready notices, each whole, in envelope order. `printed` prints again what already printed.
  const printPacket = (which: 'ready' | 'printed' = 'ready') => {
    const ns = paperShown.filter((n) => stackOf(partOfItem.get(n.itemId)) === which)
    if (ns.length === 0) return
    // A print counts as a send (docs/SENT_COPIES.md): the packet is filed as it printed, on every job in it.
    const packetJobIds = ns.flatMap((n) => (partsOf(n) ?? [{ jobId: n.jobId }]).map((p) => p.jobId))
    const filing = { kind: 'lien_notice_packet', title: ns.length === 1 ? '§ 53.056 notice packet' : `§ 53.056 notice packet · ${ns.length} notices`, jobIds: packetJobIds }
    // The sheet still lists in red what stayed out: the stopped notices' envelopes, each with its reason.
    if (!printAndFile(runPacketHtml(ns, todayYmd, issuer, invoiceSectionsByJob, payPagesByJob, lienRunGuideCode(), which === 'ready' ? mailing.held : []), filing)) {
      showToast('Popup blocked — allow popups to print the packet.', 'error')
      return
    }
    // Printed is a state (v2.4119): the desk shows these items in their own pile until the mailing is recorded. Best-effort.
    // The copies counted are the ones the packet printed: its own envelopes, as it stacks them.
    notePrinted(runMailing(runEnvelopes(ns)).mailed.flatMap((env) => env.contents.flatMap((c) => partsIds(c.notice as CombinedRunNotice).map((p) => runCopyKey(p.itemId, c.recipient.key)))))
  }
  const printCopy = (n: CombinedRunNotice, r: RunRecipient) => {
    // v2.7517: a notice whose paper and bills have parted prints by no route, this one included.
    const refused = runNoticePrintRefusal(n)
    if (refused) {
      showToast(refused, 'error')
      return
    }
    const filing = { kind: 'lien_notice', title: `${n.label} · copy for ${r.label.toLowerCase()}`, jobIds: partsIds(n).map((p) => p.jobId), recipientName: r.name || null }
    if (!printAndFile(runCopyHtml(n, r, invoiceSectionsByJob, payPagesByJob), filing)) {
      showToast('Popup blocked — allow popups to print the copy.', 'error')
      return
    }
    notePrinted(partsIds(n).map((p) => runCopyKey(p.itemId, r.key)))
  }
  const printEnvelope = (env: RunEnvelope) => {
    const inside = env.contents.map((c) => c.notice as CombinedRunNotice)
    const refused = inside.map((n) => runNoticePrintRefusal(n)).find(Boolean)
    if (refused) {
      showToast(refused, 'error')
      return
    }
    const filing = { kind: 'lien_notice', title: `Envelope ${env.n} · ${env.label} ${env.name}`.trim(), jobIds: inside.flatMap((n) => partsIds(n).map((p) => p.jobId)), recipientName: env.name || null }
    if (!printAndFile(runEnvelopeHtml(env, invoiceSectionsByJob, payPagesByJob), filing)) {
      showToast('Popup blocked — allow popups to print the envelope.', 'error')
      return
    }
    notePrinted(env.contents.flatMap((c) => partsIds(c.notice as CombinedRunNotice).map((p) => runCopyKey(p.itemId, c.recipient.key))))
  }
  // The run's addresses for a certified-mail label service (v2.4977): one CSV row per envelope that goes out on paper,
  // in the vendor's batch columns, numbered as the sheet is. Nothing is filed: the labels the service prints are the record.
  const saveLabelAddresses = () => {
    const rows = runLabelRows(mailing)
    if (rows.length === 0) {
      showToast(runLabelSavedWords(0), 'info')
      return
    }
    const blob = new Blob([runLabelCsv(rows)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = runLabelFilename(todayYmd)
    a.setAttribute('data-run-labels-download', 'yes')
    a.click()
    URL.revokeObjectURL(url)
    showToast(runLabelSavedWords(rows.length), 'success')
  }
  // The envelope faces are addresses, not a paper anyone reads: the packet is what is filed.
  const printEnvelopes = () => {
    if (!openHtmlPrintWindow(runEnvelopeFacesHtml(paperMailed, issuer))) showToast('Popup blocked — allow popups to print the envelopes.', 'error')
  }
  // Take back (punch list #101): every notice that printed — before this sitting or in it — and is still here, unrecorded.
  const printedIds = useMemo(() => runPrintedItemIds(notices, printedNow), [notices, printedNow])
  const lastPrintedAt = printedAt ?? notices.reduce<string | null>((m, n) => (n.printedAt && (!m || n.printedAt > m) ? n.printedAt : m), null)
  // v2.7503: a take-back clears the signature, so the confirm counts the signed ones and the strip says who is next.
  const takeBackSigned = runSignedCount(notices, printedIds)
  const takeBackWords = runTakeBackConfirm({ count: printedIds.length, printedAt: lastPrintedAt, typed: runTypedTrackingCount(notices, printedIds), all: printedIds.length === notices.length, signed: takeBackSigned })
  const takeBack = async () => {
    if (!onTakeBack || busy || printedIds.length === 0) return
    setBusy(true)
    try {
      const ids = printedIds
      await stamping.current
      const signed = takeBackSigned
      const count = await onTakeBack(ids)
      setNotices((prev) => runNoticesTakenBack(prev, ids))
      setTakeBackOne(null)
      setMarkedByHand(null)
      setPrintedCopies(new Set())
      setPrintedNow([])
      setPrintedAt(null)
      setPrintedNowAt(new Map())
      setTakeBackOpen(false)
      setTakenBack({ count, printedAt: lastPrintedAt, signed })
    } catch (e) {
      showToast(`Not taken back: ${formatErrorMessage(e, 'try again')}`, 'error')
    } finally {
      setBusy(false)
    }
  }
  // Un-print some of what printed (v2.7481): one notice from its own row, or the rows just marked by hand. The same
  // write as the run's take-back, for these ids alone; the rest of the run is left as it is.
  const takeBackThese = async (ids: string[]) => {
    if (!onTakeBack || busy || ids.length === 0) return
    setBusy(true)
    try {
      await stamping.current
      const count = await onTakeBack(ids)
      if (count === 0) {
        showToast('Not taken back. It may already be recorded as mailed. Close the run and open it again.', 'error')
        return
      }
      const one = ids.length === 1 ? notices.find((n) => n.itemId === ids[0]) : undefined
      const stamps = ids.map((id) => printedNowAt.get(id)?.at ?? notices.find((n) => n.itemId === id)?.printedAt ?? null).filter((at): at is string => !!at).sort()
      const left = runSittingWithout({ copies: printedCopies, ids: printedNow, stamps: printedNowAt }, ids)
      // A take-back takes the signature off (v2.7503): `runNoticesTakenBack` drops it in the window too, so it never shows or prints one the desk no longer holds.
      const signed = runSignedCount(notices, ids)
      setNotices((prev) => runNoticesTakenBack(prev, ids))
      setPrintedCopies(left.copies)
      setPrintedNow(left.ids)
      setPrintedNowAt(left.stamps)
      setPrintedAt(null)
      setTakeBackOpen(false)
      setTakeBackOne(null)
      setMarkedByHand(null)
      setTakenBack({ count, printedAt: stamps[stamps.length - 1] ?? null, ...(one ? { job: one.jobNumber } : {}), signed })
    } catch (e) {
      showToast(`Not taken back: ${formatErrorMessage(e, 'try again')}`, 'error')
    } finally {
      setBusy(false)
    }
  }
  // The row the confirm asks about, while it is still printed and in the run.
  const takeBackOneNotice = takeBackOne && printedIds.includes(takeBackOne) ? notices.find((n) => n.itemId === takeBackOne) ?? null : null
  const takeBackOneWords = takeBackOneNotice ? runTakeBackOneConfirm({ jobNumber: takeBackOneNotice.jobNumber, printedAt: printedNowAt.get(takeBackOneNotice.itemId)?.at ?? takeBackOneNotice.printedAt ?? null, typed: runTypedTrackingCount(notices, [takeBackOneNotice.itemId]), signed: takeBackOneNotice.signature != null }) : null
  // The undo of a mark by hand: offered while those rows are still printed here and nothing was typed on them.
  // A number typed says the mark was meant, and the row's own press asks before it drops one. A signed row's undo
  // takes its signature off, so for one such row the press opens the confirm; several with a signature get no strip.
  const markedStill = (markedByHand ?? []).filter((id) => printedIds.includes(id))
  const markedSigned = markedStill.filter((id) => notices.find((n) => n.itemId === id)?.signature != null).length
  const markedAsks = markedStill.length === 1 && markedSigned === 1
  const markedUndo =
    markedStill.length > 0 && runTypedTrackingCount(notices, markedStill) === 0 && (markedSigned === 0 || markedAsks)
      ? runMarkedPrintedWords(markedStill.length, markedStill.length === 1 ? notices.find((n) => n.itemId === markedStill[0])?.jobNumber : null, { asks: markedAsks })
      : null
  // Close paid notices (v2.7353): a notice whose job owes $0 leaves the run and the desk; one that fails stays, named with its reason.
  const paidSplit = useMemo(() => runPaidNotices(notices), [notices])
  const paidHeldWhy = useMemo(() => new Map(paidSplit.held.map((h) => [h.itemId, h.why])), [paidSplit])
  const closePaidAsk = useMemo(() => (closePaidIds ?? []).filter((id) => paidSplit.ready.includes(id)), [closePaidIds, paidSplit])
  const closePaidWords = runClosePaidConfirm({ count: closePaidAsk.length, printed: closePaidAsk.filter((id) => printedIds.includes(id)).length })
  const closePaid = async () => {
    if (!onClosePaid || busy || closePaidAsk.length === 0) return
    setBusy(true)
    try {
      const labelOf = new Map(notices.map((n) => [n.itemId, n.label]))
      const out = await onClosePaid(closePaidAsk)
      const words = batchOutcomeWords({ verb: 'close', past: 'Closed', done: out.closed.length, failed: out.failed.length, noun: 'paid notice' })
      setNotices((prev) => runNoticesClosed(prev, out.closed))
      setClosePaidIds(null)
      setClosedPaid({ count: out.closed.length, head: words.head, failed: out.failed.map((f) => ({ label: labelOf.get(f.itemId) ?? 'A notice', why: f.why })) })
      showToast(words.line, words.tone)
    } catch (e) {
      showToast(`Not closed: ${formatErrorMessage(e, 'try again')}`, 'error')
    } finally {
      setBusy(false)
    }
  }
  // Record N mailings (v2.7328, v2.7477): the notices the one count reads as ready to record: printed, and every envelope with its number.
  const recordable = useMemo(() => shown.filter((n) => partOfItem.get(n.itemId) === 'record'), [shown, partOfItem])
  const nothingToRecord = recordable.length === 0
  // What a record leaves, each with its reason, under the press.
  const leftByRecord = useMemo(() => {
    const why = new Map(plans.mail.held.map((h) => [h.itemId, h.why]))
    const leader = (waitLeader ?? '').trim() || 'the leader'
    return rows.filter((r) => partOfItem.get(r.itemId) !== 'record').map((r) => ({ itemId: r.itemId, label: r.label, why: partOfItem.get(r.itemId) === 'wait' ? `waits on ${leader}’s signature` : (why.get(r.itemId) ?? 'not ready to record') }))
  }, [rows, plans, partOfItem, waitLeader])
  const record = async () => {
    if (busy || nothingToRecord || notices.length === 0) return
    setBusy(true)
    try {
      const result = await recordLienDeskRun(recordable, { userId, todayYmd, mailedOn, invoiceDocsByJob: invoiceDocsShown, payBlocksByJob, document: { url: docUrl, note: docNote } })
      const courtesy = runCourtesyResultWords(result.courtesySent, result.courtesyFailed)
      const stay = notices.length - recordable.reduce((s, n) => s + (partsOf(n)?.length ?? 1), 0)
      if (result.recorded.length) showToast(`${result.recorded.length} ${result.recorded.length === 1 ? 'notice' : 'notices'} recorded — the desk reads them as sent.${courtesy.sent ? ` ${courtesy.sent}` : ''}${stay > 0 ? ` ${stay} ${stay === 1 ? 'stays' : 'stay'} here until its ticks are in.` : ''}`, 'success')
      if (result.failed.length) showToast(`${result.failed.length} not recorded: ${result.failed.map((f) => `${f.label} (${f.reason})`).join('; ')}`, 'error')
      if (courtesy.failed) showToast(courtesy.failed, 'warning')
      if (result.releaseFailed.length) showToast(`The enclosed release was not issued on ${result.releaseFailed.map((f) => `${f.label} (${f.reason})`).join('; ')}. Issue it from the Release of Lien window.`, 'warning')
      onRecorded()
      const recordedIds = new Set(recordable.filter((n) => !result.failed.some((f) => f.itemId === n.itemId)).flatMap((n) => (partsOf(n) ?? [{ itemId: n.itemId }]).map((p) => p.itemId)))
      if (recordedIds.size === notices.length) onClose()
      else setNotices((prev) => prev.filter((n) => !recordedIds.has(n.itemId)))
    } finally {
      setBusy(false)
    }
  }

  // Esc and a click outside (v2.5530): one layer at a time, and never over work closing would lose. The preview and
  // the Docsmit review close on Esc by themselves (both listen on window too, so the run stands aside rather than count
  // on their preventDefault); a sign pad or pen pane that is on screen makes Esc wait; the take-back question and More ▾
  // close first; then the run closes only while nothing in it changed since it opened (runHoldSinceOpen).
  const signingOnScreen = envelopes.some((env) => (env.key === signOpen || env.key === penOpen) && heldWhy.has(env.key) && !!viewer && !!unsignedIn(env)[0]?.leader) || penTargets(penOpen).length > 0
  // Mailed on is measured against the day the run opened; the checklist's ticks are facts on the desk (v2.7328), never unsaved work.
  const holdNow = () => {
    // Combine counts only while it still joins something: a partial record can take every pair out and the box with it.
    return runHoldSinceOpen(openedWith, notices, { mailedOn, openedYmd, combine: combine && combinable.combined > 0, docUrl, docNote, ticks: [] })
  }
  // A write in flight, Docsmit's own included; the review counts as open only while it is drawn (its outcome is set),
  // so a review closed mid-send, which mailDocsmit puts back to idle when the send lands, never keeps the run's Esc.
  const working = busy || dsm.stage === 'preparing' || dsm.stage === 'sending'
  const reviewOpen = dsm.stage === 'review' && dsm.outcome != null
  const SIGNING_WORDS = 'Finish the signature first, or close its pane.'
  const closeUnlessHeld = () => {
    if (working) return
    if (signingOnScreen) {
      showToast(SIGNING_WORDS, 'info')
      return
    }
    const hold = holdNow()
    if (hold) showToast(runHoldWords(hold), hold === 'docsmit' ? 'warning' : 'info')
    else onClose()
  }
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape' || ev.defaultPrevented || !isTopmostModal()) return
      const hold = holdNow()
      const action = runEscapeAction({ busy: working, overlayOpen: preview != null || reviewOpen, signing: signingOnScreen, takeBackOpen: (takeBackOpen && printedIds.length > 0) || closePaidAsk.length > 0 || takeBackOneWords != null, moreOpen, hold })
      if (action === 'ignore') return
      ev.preventDefault()
      if (action === 'wait-signing') showToast(SIGNING_WORDS, 'info')
      else if (action === 'close-take-back') {
        // The confirm on screen: the paid notices' first, since it opens over the take-back's.
        if (closePaidAsk.length > 0) setClosePaidIds(null)
        else if (takeBackOneWords) setTakeBackOne(null)
        else setTakeBackOpen(false)
      }
      else if (action === 'close-more') setMoreOpen(false)
      else if (action === 'hold' && hold) showToast(runHoldWords(hold), hold === 'docsmit' ? 'warning' : 'info')
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={LIEN_RUN_ACT[recording ? 'record' : 'print']}
      style={{ position: 'fixed', inset: 0, paddingTop: 'var(--app-top-chrome, 0px)', background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 790 }}
      onClick={(e) => {
        // The Lien desk and Put a GC on notice draw the run inside their own backdrop: a click
        // outside closes the run only, not the window behind it (v2.4352) — and, like Esc, only
        // while nothing in it would be lost (v2.5530).
        e.stopPropagation()
        closeUnlessHeld()
      }}
    >
      {/* `lienRunWindow`: on a phone the window fills the screen and its presses and fields are a thumb tall (punch list #352, PR 7; index.css). */}
      <div className="lienRunWindow" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 10, width: 'min(960px, calc(100vw - 2rem))', maxHeight: 'min(90vh, calc(100dvh - 2rem - var(--app-top-chrome, 0px)))', display: 'grid', gridTemplateRows: 'auto 1fr auto', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', padding: '1rem 1.25rem 0.6rem', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.05rem' }}>{lienRunWindowTitle(recording ? 'record' : 'print', notices.length)}</h2>
              <button
                type="button"
                aria-label="What the packet is"
                aria-expanded={explainerOpen}
                aria-pressed={explainerOpen}
                title="What the packet is"
                onClick={() => setExplainerOpen((v) => !v)}
                data-testid="run-explainer-toggle"
                style={{ width: 20, height: 20, borderRadius: 999, border: '1px solid var(--border-strong)', background: explainerOpen ? 'var(--bg-blue-tint)' : 'var(--surface)', color: explainerOpen ? 'var(--text-link)' : 'var(--text-muted)', font: 'inherit', fontSize: '0.72rem', fontWeight: 700, lineHeight: 1, padding: 0, cursor: 'pointer', flexShrink: 0 }}
              >
                ?
              </button>
            </div>
            {subLine ? <div data-testid="run-sub" style={{ marginTop: 2, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{subLine}</div> : null}
            <div data-testid="run-what" style={{ marginTop: 2, fontSize: '0.78rem', color: 'var(--text-muted)', maxWidth: '78ch' }}>
              <span style={{ color: 'var(--text-700)', fontWeight: 600 }}>{what.line}</span> {what.not}
            </div>
            {explainerOpen ? (
              <p data-testid="run-explainer" style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)', maxWidth: '78ch' }}>
                One packet with every notice that is ready: a checklist sheet listing its {(readyPaper.length || printedPaper.length)} {(readyPaper.length || printedPaper.length) === 1 ? 'envelope' : 'envelopes'}, then for each one a divider page with its face and what goes in it, in that order.{mailing.held.length ? ` ${mailing.held.length} ${mailing.held.length === 1 ? 'envelope stays' : 'envelopes stay'} out. A notice inside is held or waits on the signature, and the sheet lists ${mailing.held.length === 1 ? 'it' : 'them'} in red.` : ''} The owner of record's copy behind its cover page; the original contractor's copy alone{payCodes > 0 ? `; the pay codes page behind the owner's copy (${payCodes} ${payCodes === 1 ? 'code' : 'codes'}, one per Stripe bill)` : ''}{invoicesEnclosed > 0 ? `; the job's unpaid ${invoicesEnclosed === 1 ? 'invoice' : 'invoices'} behind each copy (§ 53.056(a-3))` : ''}.{shared ? ' Notices to one name at one address share an envelope, so its tracking number covers everything inside.' : ''} {recording ? `It printed ${demandDate(calendarYmdInAppTzFromIso(opening.printedAt!))}; type the tracking numbers when you are back from the post office.` : 'Print it first; type the tracking numbers when you are back from the post office.'} Recording the run writes each notice to its job with every month it named. Press Preview on any copy to read it as the packet prints it. {what.more}
              </p>
            ) : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-muted)', padding: 4 }}>×</button>
        </div>
        {undo ? (
          <div data-testid="run-undo" role="status" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', padding: '0.5rem 1.25rem', borderBottom: '1px solid var(--border)', borderLeft: '4px solid #f59e0b', background: 'var(--bg-amber-tint)', fontSize: '0.8125rem' }}>
            <span aria-hidden style={{ fontSize: '1rem', lineHeight: 1 }}>↶</span>
            <span style={{ flex: '1 1 16rem', minWidth: 0 }}>{undo.words}</span>
            <button type="button" onClick={undo.onUndo} disabled={undo.busy || busy} style={{ padding: '4px 11px', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, whiteSpace: 'nowrap', cursor: undo.busy || busy ? 'not-allowed' : 'pointer' }}>
              {undo.busy ? 'Undoing…' : 'Undo the approval…'}
            </button>
          </div>
        ) : null}
        {/* The journey (v2.7477): the run's three steps, each counting notices. Then the one count: the total and its parts, in the words the groups and the press use. */}
        <LienRunJourney nodes={parts.nodes} />
        {parts.total > 0 ? (
          <div className="lienRunParts" data-testid="run-parts" role="status" aria-label="What is in this run">
            <span className="lienRunPart" data-testid="run-parts-total"><b>{parts.line.total.n}</b> {parts.line.total.words}</span>
            {parts.line.parts.length ? <span className="lienRunPartsEq" aria-hidden="true">=</span> : null}
            {parts.line.parts.map((part) => (
              <span key={part.key} className="lienRunPart" data-tone={part.tone} data-testid={`run-part-${part.key}`}><b>{part.n}</b> {part.words}</span>
            ))}
          </div>
        ) : null}
        {takeBackOpen && printedIds.length > 0 ? (
          <div data-testid="run-take-back-confirm" role="group" aria-label={takeBackWords.title} style={{ margin: '0.6rem 1.25rem 0', padding: '0.6rem 0.8rem', borderRadius: 8, border: '1px solid var(--border-amber)', background: 'var(--bg-amber-tint)', fontSize: '0.8125rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 2 }}>{takeBackWords.title}</div>
            <div>Use this when none of {printedIds.length === 1 ? 'it' : 'these envelopes'} was mailed.</div>
            <ul style={{ margin: '0.25rem 0 0.35rem', paddingLeft: '1.1rem' }}>
              {takeBackWords.lines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
            <div style={{ color: 'var(--text-muted)' }}>Mailed some of them? Record those first. Then take back the rest.</div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              <button type="button" data-testid="run-take-back-yes" onClick={() => void takeBack()} disabled={busy} style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid #dc2626', background: '#dc2626', color: '#ffffff', font: 'inherit', fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer' }}>
                {busy ? 'Taking back…' : takeBackWords.button}
              </button>
              <button type="button" onClick={() => setTakeBackOpen(false)} disabled={busy} style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', font: 'inherit', fontWeight: 600, cursor: 'pointer' }}>
                Keep it
              </button>
            </div>
          </div>
        ) : null}
        {takeBackOneWords && takeBackOneNotice ? (
          <div data-testid="run-take-back-one-confirm" role="group" aria-label={takeBackOneWords.title} style={{ margin: '0.6rem 1.25rem 0', padding: '0.6rem 0.8rem', borderRadius: 8, border: '1px solid var(--border-amber)', background: 'var(--bg-amber-tint)', fontSize: '0.8125rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 2 }}>{takeBackOneWords.title}</div>
            <div style={{ color: 'var(--text-muted)' }}>{takeBackOneNotice.label}. Use this when it did not print, or was not mailed.</div>
            <ul style={{ margin: '0.25rem 0 0.35rem', paddingLeft: '1.1rem' }}>
              {takeBackOneWords.lines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              <button type="button" data-testid="run-take-back-one-yes" onClick={() => void takeBackThese([takeBackOneNotice.itemId])} disabled={busy} style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid #dc2626', background: '#dc2626', color: '#ffffff', font: 'inherit', fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer' }}>
                {busy ? 'Taking back…' : takeBackOneWords.button}
              </button>
              <button type="button" onClick={() => setTakeBackOne(null)} disabled={busy} style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', font: 'inherit', fontWeight: 600, cursor: 'pointer' }}>
                Keep it printed
              </button>
            </div>
          </div>
        ) : null}
        {markedUndo && !takeBackOneWords ? (
          <div data-testid="run-marked-undo" role="status" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', margin: '0.6rem 1.25rem 0', padding: '0.45rem 0.8rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-subtle)', fontSize: '0.8125rem' }}>
            <span style={{ flex: '1 1 14rem', minWidth: 0 }}>{markedUndo.words}</span>
            <button type="button" data-testid="run-marked-undo-go" onClick={() => (markedAsks ? (setTakeBackOpen(false), setClosePaidIds(null), setTakeBackOne(markedStill[0]!)) : void takeBackThese(markedStill))} disabled={busy} style={{ padding: '4px 11px', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-link)', font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, whiteSpace: 'nowrap', cursor: busy ? 'not-allowed' : 'pointer' }}>
              {busy ? 'Taking back…' : markedUndo.button}
            </button>
            <button type="button" onClick={() => setMarkedByHand(null)} aria-label="Keep the Printed mark" title="Keep the Printed mark" style={{ border: 'none', background: 'none', padding: '0 4px', color: 'var(--text-muted)', font: 'inherit', fontSize: '1rem', lineHeight: 1, cursor: 'pointer' }}>×</button>
          </div>
        ) : null}
        {closePaidAsk.length > 0 ? (
          <div data-testid="run-close-paid-confirm" role="group" aria-label={closePaidWords.title} style={{ margin: '0.6rem 1.25rem 0', padding: '0.6rem 0.8rem', borderRadius: 8, border: '1px solid var(--border-amber)', background: 'var(--bg-amber-tint)', fontSize: '0.8125rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 2 }}>{closePaidWords.title}</div>
            <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{closePaidAsk.map((id) => notices.find((n) => n.itemId === id)?.label ?? '').filter(Boolean).join(', ')}</div>
            <ul style={{ margin: '0 0 0.3rem', paddingLeft: '1.1rem' }}>
              {closePaidWords.lines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
            <div style={{ color: 'var(--text-muted)' }}>{RUN_CLOSE_PAID_CAUTION}</div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button type="button" data-testid="run-close-paid-yes" onClick={() => void closePaid()} disabled={busy} style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid #2563eb', background: '#2563eb', color: '#ffffff', font: 'inherit', fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer' }}>
                {busy ? 'Closing…' : closePaidWords.button}
              </button>
              <button type="button" onClick={() => setClosePaidIds(null)} disabled={busy} style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', font: 'inherit', fontWeight: 600, cursor: 'pointer' }}>
                {closePaidAsk.length === 1 ? 'Keep it here' : 'Keep them here'}
              </button>
            </div>
          </div>
        ) : null}
        {closedPaid && closedPaid.count > 0 ? (
          <div data-testid="run-closed-paid" role="status" style={{ margin: '0.6rem 1.25rem 0', padding: '0.5rem 0.8rem', borderRadius: 8, background: 'var(--bg-green-tint)', color: 'var(--text-green-800)', fontSize: '0.8125rem' }}>
            {runClosedPaidWords(closedPaid.count)}
          </div>
        ) : null}
        {closedPaid && closedPaid.failed.length > 0 ? (
          <div data-testid="run-close-paid-failed" role="alert" style={{ margin: '0.6rem 1.25rem 0', padding: '0.5rem 0.8rem', borderRadius: 8, border: '1px solid var(--border-red)', background: 'var(--bg-red-tint)', color: 'var(--text-red-600)', fontSize: '0.8125rem' }}>
            <div style={{ fontWeight: 700 }}>{closedPaid.head}</div>
            <ul style={{ margin: '0.2rem 0 0', paddingLeft: '1.1rem' }}>
              {closedPaid.failed.map((f) => (
                <li key={`${f.label}:${f.why}`}>{f.label}: {f.why}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {takenBack ? (
          <div data-testid="run-taken-back" role="status" style={{ margin: '0.6rem 1.25rem 0', padding: '0.5rem 0.8rem', borderRadius: 8, background: 'var(--bg-green-tint)', color: 'var(--text-green-800)', fontSize: '0.8125rem' }}>
            {takenBack.job ? runTakenBackOneWords(takenBack.job, takenBack.signed > 0) : runTakenBackWords(takenBack.count, takenBack.printedAt, takenBack.signed)}
          </div>
        ) : null}
        <div style={{ overflow: 'auto', padding: '0.5rem 1.25rem' }}>
          {notices.length === 0 ? <EmptyState compact {...LIEN_RUN_EMPTY} /> : null}
          <LienRunChecklist
            rows={rows}
            busy={busy}
            viewer={viewer}
            onMarkPrinted={markPrintedByHand}
            onOpenSign={(row) => setPenOpen(`item:${row.itemId}`)}
            onTracking={trackingFor}
            // Scan › on a phone (v2.7331): the camera reads the receipt's barcode into this envelope's box; a refusal leaves typing as it was.
            besideBox={isMobile ? (row, key) => <LienRunScanPress label={`${row.label} — ${key === 'owner' ? 'owner' : 'GC'}`} onRead={(value) => trackingFor(row, key, value)} /> : undefined}
            paneFor={(row) => (penOpen === `item:${row.itemId}` ? penPaneFor(penOpen, true) : null)}
            focusMailItemId={focusMailItemId}
            // Close… (v2.7353): a paid row's own press and the fold's ask for the confirm above; nothing is written until it is pressed.
            paid={onClosePaid ? { readyIds: paidSplit.ready, heldWhy: paidHeldWhy, onClose: (ids) => { setClosedPaid(null); setTakeBackOpen(false); setTakeBackOne(null); setClosePaidIds(ids) } } : undefined}
            mailedCopies={{
              onAdd: (row, file) => void addCopy(row, file),
              addingItemId: addingCopy,
              onRemove: (row, copy) => void removeCopy(row, copy),
              removingItemId: removingCopy,
              failed: failedCopy ? { itemId: failedCopy.itemId, words: failedCopy.words, retry: failedCopy.retry } : null,
              onRetry: (row) => (failedCopy && failedCopy.itemId === row.itemId ? void addCopy(row, failedCopy.file) : undefined),
              off: offCopy?.outcome ? { itemId: offCopy.itemId, words: fileTakenOffWords(offCopy.outcome), canRetry: offCopy.outcome.where === 'drive' && offCopy.outcome.retry, working: offCopy.working } : null,
              onTrashAgain: () => void trashCopyAgain(),
              onPutBack: () => void putCopyBack(),
            }}
            // Un-print one (v2.7481): a ticked Printed is a press on every row the run could take back; the confirm above asks first.
            unprint={onTakeBack ? { ids: printedIds, onAsk: (row) => { setTakeBackOpen(false); setClosePaidIds(null); setTakenBack(null); setTakeBackOne(row.itemId) } } : undefined}
            // The groups (v2.7477): each row under its part's head, what is stopped first.
            partOf={parts.partOf}
            leaderName={waitLeader}
            step={parts.step}
          />
          {penOpen === 'batch' ? <div data-testid="run-sign-batch">{penPaneFor('batch', false)}</div> : null}
          {envelopes.length ? (
            <button type="button" className="lienRunCardsFold" onClick={() => setCardsOpen((v) => !v)} aria-expanded={cardsOpen} data-testid="run-cards-fold">
              Envelopes and copies · {envelopes.length} {cardsOpen ? '▴' : '▾'}
              <span>{cardsOpen ? 'the method, the courtesy email, a copy to read or print' : 'press for the method, the courtesy email, a copy to read or print'}</span>
            </button>
          ) : null}
          {cardsOpen ? (
          <div className="lienRunCards" data-testid="run-cards">
            {envelopes.map((env) => {
              const who = `Envelope ${env.n} · ${env.label}: ${env.name || '—'}`
              const st = stageByKey.get(env.key)!
              const viaDsm = env.contents.map((c) => c.recipient).find((r) => r.via === 'docsmit')
              const dsmMailed = !!viaDsm && (viaDsm.pieceStatus === 'sent' || viaDsm.pieceStatus === 'mailed')
              const chip = dsmMailed
                ? { tone: 'blue' as const, words: env.tracking.trim() ? `mailed through Docsmit · ${env.tracking.trim()}` : 'mailed through Docsmit · number coming', next: 'Docsmit brings the USPS number within the hour; nothing to type.' }
                : viaDsm?.pieceStatus === 'failed'
                  ? { tone: 'amber' as const, words: `Docsmit held it · ${viaDsm.pieceProblem ?? ''}`.trim(), next: 'It stays on paper: print it here.' }
                  : runEnvelopeChip(st, env, { held: heldWhy.get(env.key) ?? null, leaderName })
              const tone = st.waiting || heldWhy.has(env.key) ? 'waiting' : st.glyph !== 'open' ? 'sealed' : 'open'
              return (
                <div key={env.key} className="lienRunCard" data-testid={`run-envelope-${env.n}`} data-tone={tone}>
                  <LienRunEnvelopeGlyph glyph={st.glyph} waiting={tone === 'waiting'} />
                  <div style={{ minWidth: 0 }}>
                      <div className="lienRunCardWho">
                        <span className="lienRunCardN">Envelope {env.n} · {env.label}</span>{' '}
                        {env.name || <span style={{ color: 'var(--text-red-600)' }}>— {env.label.toLowerCase()} missing</span>}
                      </div>
                      <div className="lienRunCardLine">
                        {env.address || (env.name ? 'no mailing address' : '')}{env.email ? ` · ${env.email}` : ''}
                        {env.contents.length > 1 ? ` · ${env.contents.length} notices inside` : ''}
                        {' · '}
                        <button type="button" onClick={() => printEnvelope(env)} data-testid={`run-print-envelope-${env.n}`} title="Print every copy inside this envelope, in packet order, and file them as printed" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-link)', font: 'inherit', fontSize: '0.72rem', fontWeight: 600 }}>
                          Print this envelope ›
                        </button>
                      </div>
                      {heldWhy.has(env.key) ? (
                        <div className="lienRunCardHeld" data-testid={`run-held-${env.n}`}>
                          Held · {heldWhy.get(env.key)}
                        </div>
                      ) : unsignedIn(env).length ? (
                        // v2.5533: printed and in the mail unsigned — not held, it records as it went; the doors below record a signature first.
                        <div data-testid={`run-unsigned-${env.n}`} style={{ color: 'var(--text-amber-800)', fontSize: '0.72rem', fontWeight: 600 }}>
                          In the mail unsigned · it records as it went. If {unsignedIn(env)[0]?.leader?.name ?? leaderName ?? 'the leader'} signed the paper, record that first.
                        </div>
                      ) : null}
                      <div className="lienRunSteps" aria-label="This envelope's steps">
                        {st.stages.map((s, i) => (
                          <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center' }}>
                            {i > 0 ? <span className="lienRunStepGap" aria-hidden="true" /> : null}
                            <span className="lienRunStep" data-done={s.done ? 'yes' : 'no'} data-now={!s.done && s.key === st.current ? (tone === 'waiting' ? 'wait' : 'yes') : 'no'}>
                              {s.label}
                              {!s.done && s.key === st.current && s.key === 'signed' && tone === 'waiting' ? ` · waits on ${leaderName ?? 'the leader'}` : ''}
                            </span>
                          </span>
                        ))}
                      </div>
                      {viewer && unsignedIn(env)[0]?.leader ? (
                        signOpen === env.key ? (
                          <div data-testid={`run-sign-here-${env.n}`} style={{ marginTop: '0.45rem', display: 'grid', gap: '0.4rem', maxWidth: 480 }}>
                            <LienNoticeSignLine ref={signRef} printedName={unsignedIn(env)[0]!.leader!.name} under={[unsignedIn(env)[0]!.fields.contactPerson, unsignedIn(env)[0]!.fields.claimantName]} signedLabel={`Signed ${demandDate(todayYmd)}`} allowPress={false} codeSigner={codeSigner} codeProblem={codeProblem} compact disabled={busy} />
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{unsignedIn(env)[0]!.leader!.name} {codeSigner?.status === 'ready' ? 'types his code or draws' : 'draws'} on this screen. The record names {viewer.name || 'you'} as whose screen it was.</div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button type="button" onClick={() => void signHere(env)} disabled={busy} data-testid={`run-sign-here-go-${env.n}`} style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid #15803d', background: '#15803d', color: '#fff', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer' }}>Sign ▸</button>
                              <button type="button" onClick={() => setSignOpen(null)} disabled={busy} style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)', fontSize: '0.8125rem', cursor: 'pointer' }}>Cancel</button>
                            </div>
                          </div>
                        ) : penOpen === env.key ? (
                          <LienPenSignaturePane
                            compact
                            leader={unsignedIn(env)[0]!.leader!}
                            recorder={{ userId: viewer.userId, name: viewer.name }}
                            notices={unsignedIn(env).map((n) => ({ itemId: n.itemId, jobNumber: n.jobNumber, label: n.label, amount: n.amount, fields: n.rowFields ?? null }))}
                            printedYmd={printedAt ? calendarYmdInAppTzFromIso(printedAt) : null}
                            todayYmd={todayYmd}
                            onClose={() => setPenOpen(null)}
                            onRecorded={(recorded, words) => penRecorded(env, recorded, words)}
                          />
                        ) : (
                          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.3rem' }}>
                            <button type="button" onClick={() => setSignOpen(env.key)} data-testid={`run-leader-here-sign-${env.n}`} title="The leader is beside you: he types his signing code or draws his signature on this screen, and the record names yours" style={{ padding: '4px 11px', borderRadius: 7, border: '1px solid var(--text-link)', background: 'var(--surface)', color: 'var(--text-link)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>Leader here, sign ▸</button>
                            <button type="button" onClick={() => setPenOpen(env.key)} data-testid={`run-pen-sign-${env.n}`} title="He signed the printed paper with a pen: write down who, when, how you know, and add the signed page" style={{ padding: '4px 11px', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>He signed the paper ▸</button>
                          </div>
                        )
                      ) : null}
                      {(() => {
                        const offer = envelopeCourtesy(env)
                        return offer ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: '0.35rem', marginTop: 3, fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-muted)' }}>
                            <label data-testid={`run-courtesy-${env.n}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                              <input type="checkbox" checked={offer.on} onChange={(ev) => setCourtesy(env, ev.target.checked)} aria-label={`${who} — courtesy PDF by email`} style={{ margin: 0 }} />
                              <span>
                                Courtesy PDF to {offer.emails.join(', ')}, emailed when the run is recorded{offer.copies > 1 ? ', one email per notice' : ''}
                              </span>
                            </label>
                            {/* Outside the label, so pressing it never flips the tick (v2.5073). */}
                            <span aria-hidden="true">·</span>
                            <button
                              type="button"
                              data-testid={`run-courtesy-preview-${env.n}`}
                              disabled={!enclosuresRead}
                              onClick={() => previewCourtesy(env)}
                              title={enclosuresRead ? `Opens in a new tab, as ${offer.emails.join(', ')} would get it. Nothing is sent.` : 'Reading the bills the PDF carries…'}
                              style={{ background: 'none', border: 'none', padding: 0, cursor: enclosuresRead ? 'pointer' : 'default', color: enclosuresRead ? 'var(--text-link)' : 'var(--text-muted)', font: 'inherit', fontSize: '0.72rem', fontWeight: 600 }}
                            >
                              {enclosuresRead ? 'Preview the email ›' : 'Preview the email · reading the bills…'}
                            </button>
                          </div>
                        ) : null
                      })()}
                      <div className="lienRunCopies">
                      {env.contents.map(({ notice: n, recipient: r }) => {
                    const mine = (problemsOf.get(n.itemId) ?? []).filter((p) => p.startsWith(`${r.label}:`))
                    return (
                      <div key={`${n.itemId}-${r.key}`} className="lienRunCopyRow" data-testid={`run-row-${n.jobId}-${r.key}`}>
                        <div className="lienRunJob">
                          {n.label}
                          {n.street ? <span className="lienRunStreet"> · {n.street}</span> : null}
                          {partsOf(n as CombinedRunNotice) ? <div style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: '0.72rem' }} data-testid="run-combined-parts">{partsOf(n as CombinedRunNotice)!.map((p) => `${p.jobNumber} ${formatUsdNoCents(p.amount)}`).join(' · ')}</div> : null}
                          <div style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: '0.75rem' }}>{formatUsdNoCents(n.amount)}{r.key === 'owner' ? (n.coverLetter ? ' · cover letter' : n.coverNote ? ' · cover note' : '') : ''}</div>
                          {mine.length ? <div style={{ color: 'var(--text-red-600)', fontSize: '0.72rem' }}>{mine.join(' · ')}</div> : null}
                        </div>
                        <div className="lienRunMonths">{n.kind === 'retainage_53_057' ? '§ 53.057 retainage' : describeNoticeMonths(n.months)}</div>
                        <div className="lienRunFor">
                          Copy for: {r.label.toLowerCase()}
                          {(() => {
                            const at = previewEntries.findIndex((e) => e.key === `${n.itemId}-${r.key}`)
                            return at >= 0 ? (
                              <>
                                {' · '}
                                <button type="button" onClick={() => setPreview(at)} data-testid={`run-preview-${n.jobId}-${r.key}`} title="Read this copy as the packet prints it" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-link)' }}>
                                  Preview ›
                                </button>
                                {' · '}
                                <button type="button" onClick={() => printCopy(n as CombinedRunNotice, r)} data-testid={`run-print-${n.jobId}-${r.key}`} title="Print this copy on its own and file it as printed" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-link)', font: 'inherit', fontSize: '0.75rem', fontWeight: 600 }}>
                                  {printedCopies.has(runCopyKey(n.itemId, r.key)) ? 'Printed ✓ · Print again ›' : 'Print ›'}
                                </button>
                              </>
                            ) : null
                          })()}
                        </div>
                      </div>
                    )
                      })}
                      </div>
                      {(() => {
                        // The other jobs at this envelope's properties (v2.7559): one line for the envelope, and a press a property.
                        const line = lienRunEnvelopePropertyLine({ inside: env.contents.flatMap(({ notice: n }) => (partsOf(n as CombinedRunNotice) ?? [n]).map((j) => ({ jobId: j.jobId, propertyId: propertyOfJob.get(j.jobId) ?? null }))), properties })
                        return line ? (
                          <div className="lienRunCardProperty" data-testid={`run-property-${env.n}`}>
                            <span>{line.words}</span>
                            {onOpenProperty ? (
                              <span className="lienRunCardPropertyPresses">
                                {line.presses.map((p) => (
                                  <button key={p.addressId} type="button" onClick={() => onOpenProperty(p.addressId)} data-testid={`run-property-open-${env.n}-${p.addressId}`} title="Every job at this property, with where each paper stands">
                                    {p.label}
                                  </button>
                                ))}
                              </span>
                            ) : null}
                          </div>
                        ) : null
                      })()}
                  </div>
                  <div className="lienRunCardSide">
                      <select value={env.method} onChange={(ev) => setEnvelope(env, { method: ev.target.value as RunSendMethod })} aria-label={`${who} — method`} className="lienRunSelect" style={{ font: 'inherit', fontSize: '0.78rem', padding: '3px 6px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit' }}>
                        {RUN_SEND_METHODS.map((m) => (
                          <option key={m.key} value={m.key} disabled={m.key === 'email' && !env.email}>{m.label}</option>
                        ))}
                      </select>
                      <span className="lienRunChip" data-tone={chip.tone} data-testid={`run-chip-${env.n}`}>{chip.words}</span>
                      {env.method === 'email' ? (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>sent on record — the email id is the tracking{env.contents.length > 1 ? ', one email per notice' : ''}</span>
                      ) : (
                        <>
                        <input value={env.tracking} onChange={(ev) => setEnvelope(env, { tracking: ev.target.value })} disabled={dsmMailed} placeholder={dsmMailed ? 'number coming from Docsmit' : env.method === 'hand' ? 'who signed for it' : '9407 1118 …'} aria-label={`${who} — tracking`} className="lienRunTracking" style={{ width: '100%', font: 'inherit', fontSize: '0.78rem', padding: '3px 6px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit' }} />
                        {(() => {
                          const shape = trackingShape(env.method, env.tracking)
                          return env.tracking.trim() && shape.hint ? (
                            <div data-testid={`run-tracking-shape-${env.n}`} style={{ fontSize: '0.7rem', color: shape.ok ? 'var(--text-green-700)' : 'var(--text-red-600)', marginTop: 2 }}>
                              {shape.ok ? '✓ ' : ''}
                              {shape.hint}
                            </div>
                          ) : null
                        })()}
                        </>
                      )}
                      {chip.next ? <span className="lienRunCardNext">{chip.next}</span> : null}
                  </div>
                </div>
              )
            })}
          </div>
          ) : null}
        </div>
        {/* The foot (v2.7477): what the one press takes and what stays, then More and the press for the step the run is on. Every other press is under More. */}
        <div className="lienRunFoot2" data-testid="run-foot">
          <div className="lienRunFootStatus" data-testid="run-foot-status">
            <b>{parts.press.line1}</b>
            <span>{parts.press.line2}</span>
          </div>
          <button type="button" onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen} data-testid="run-more" style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>
            More {moreOpen ? '▴' : '▾'}
          </button>
          {(() => {
            const press = parts.press
            const dead = busy || press.dead || (press.act === 'record' && nothingToRecord)
            return (
              <button
                type="button"
                className="lienRunPress"
                data-testid="run-press"
                data-act={press.act}
                onClick={() => (press.act === 'print' ? printPacket('ready') : press.act === 'record' ? void record() : undefined)}
                disabled={dead}
                title={press.act === 'print' ? 'Prints every ready notice, each with both its copies, and files the packet on its jobs' : press.act === 'record' ? 'Each notice goes to its job with how it went and every month it covered' : undefined}
                style={{ padding: '7px 16px', borderRadius: 7, border: '1px solid transparent', background: dead ? DEAD_PRESS_FILL : '#2563eb', color: dead ? DEAD_PRESS_TEXT : '#ffffff', fontSize: '0.875rem', fontWeight: 700, cursor: dead ? 'default' : 'pointer' }}
              >
                {busy && press.act === 'record' ? 'Recording…' : press.label}
              </button>
            )
          })()}
          {parts.press.act === 'record' && !parts.press.dead && leftByRecord.length ? (
            <ul className="lienRunHeldList" data-testid="run-held-list">
              {leftByRecord.map((h) => (
                <li key={h.itemId}>
                  <b>{h.label}</b> · {h.why}
                </li>
              ))}
            </ul>
          ) : null}
          {moreOpen ? (
            <div className="lienRunMore" data-testid="run-more-panel">
              {combinable.combined > 0 ? (
                <label style={{ flexBasis: '100%', display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: '0.8125rem' }} data-testid="run-combine">
                  <input type="checkbox" checked={combine} onChange={(ev) => setCombine(ev.target.checked)} aria-label="Combine the jobs at one property into one notice" style={{ marginTop: 3 }} />
                  <span>
                    <strong>Combine the jobs at one property into one notice</strong> · {combinable.jobs - (combinable.notices - combinable.combined)} jobs could combine into {combinable.combined} {combinable.combined === 1 ? 'notice' : 'notices'}.{' '}
                    <span style={{ color: 'var(--text-muted)' }}>One form to the same owner from the same original contractor, with the claims summed and the months joined. Each job keeps its own record. The form’s claim changes when jobs combine, so this stays off unless the office says so.</span>
                  </span>
                </label>
              ) : null}
              {showDocsmit ? (
                <button type="button" onClick={() => void openDocsmit()} disabled={busy || !docsmitDoor.door.enabled} title={docsmitDoor.door.why || 'Each certified envelope goes to Docsmit as a PDF; you review every one before anything mails.'} data-testid="run-docsmit" style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text)', cursor: busy || !docsmitDoor.door.enabled ? 'not-allowed' : 'pointer', fontSize: '0.8125rem', fontWeight: 600 }}>
                  {dsm.stage === 'preparing' ? 'Preparing…' : `${docsmitDoor.door.label} ▸`}
                </button>
              ) : null}
              {showDocsmit && sendBy ? (
                <span data-testid="run-docsmit-send-by" style={{ padding: '0.3rem 0.6rem', borderRadius: 6, fontSize: '0.78rem', background: sendBy.late ? 'var(--bg-red-tint)' : 'var(--bg-page)', color: sendBy.late ? 'var(--text-red-600)' : 'var(--text-muted)', border: '1px solid var(--border)' }}>
                  {sendBy.words}
                </span>
              ) : null}
              {/* The checklist's batch presses (v2.7328): each counted, dead when nothing is ready, its hover naming what it leaves and why. */}
              <button type="button" onClick={markPrintedBatch} disabled={busy || plans.print.words.dead} title={plans.print.held.length ? plans.print.held.map((h) => `${h.label}: ${h.why}`).join('\n') : 'The papers printed elsewhere: tick every unprinted row at once, with your name and the time'} data-testid="run-mark-printed" style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontSize: '0.8125rem', fontWeight: 600, cursor: plans.print.words.dead ? 'default' : 'pointer', opacity: plans.print.words.dead ? 0.55 : 1 }}>
                {plans.print.words.button}
              </button>
              <button type="button" onClick={() => { setPenOpen('batch'); setMoreOpen(false) }} disabled={busy || plans.sign.words.dead || !viewer} title={plans.sign.held.length ? plans.sign.held.map((h) => `${h.label}: ${h.why}`).join('\n') : 'The leader signed the printed papers with a pen: one record for every printed, unsigned notice'} data-testid="run-mark-signed" style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontSize: '0.8125rem', fontWeight: 600, cursor: plans.sign.words.dead ? 'default' : 'pointer', opacity: plans.sign.words.dead || !viewer ? 0.55 : 1 }}>
                {plans.sign.words.button}
              </button>
          <div style={{ flexBasis: '100%', display: 'grid', gridTemplateColumns: 'auto minmax(160px, 2fr) minmax(120px, 1fr)', gap: '0.4rem 0.5rem', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }} data-testid="run-saved-copy">
            <span title="Where the packet lives once you saved it — a Drive link. Every notice's record carries it, so the paper can be found from the job later.">Saved copy</span>
            <input value={docUrl} onChange={(ev) => setDocUrl(ev.target.value)} placeholder="Drive link to the packet as printed (optional)" aria-label="Saved copy — link" style={{ width: '100%', font: 'inherit', fontSize: '0.78rem', padding: '3px 6px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit' }} />
            <input value={docNote} onChange={(ev) => setDocNote(ev.target.value)} placeholder="note (optional)" aria-label="Saved copy — note" style={{ width: '100%', font: 'inherit', fontSize: '0.78rem', padding: '3px 6px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit' }} />
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Mailed on
            <input type="date" value={mailedOn} onChange={(ev) => setMailedOn(ev.target.value || todayYmd)} aria-label="Mailed on" style={{ font: 'inherit', fontSize: '0.78rem', padding: '3px 6px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit' }} />
          </label>
          <button type="button" onClick={printEnvelopes} disabled={envelopes.length === 0} title="One page per envelope — the return address, the certified line, a blank for the article number, and the recipient as the notice names it" style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem' }}>
            Envelope faces
          </button>
          <button type="button" onClick={saveLabelAddresses} disabled={mailing.mailed.length === 0} data-testid="run-label-addresses" title="Saves a spreadsheet for a certified-mail label service: one row per envelope that goes out, the name and address as the envelope reads them, the envelope number and its jobs as the reference. Upload it as a batch; the labels print with the 20-digit number already on them." style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem' }}>
            Addresses for the labels
          </button>
              <button type="button" onClick={printSheet} disabled={rows.length === 0} data-testid="run-print-sheet" title="One page for the batch: every row with its three boxes, and a code per row that opens its Mailed box on your phone. A desk paper, not a sent copy." style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem' }}>
                Print the sheet
              </button>
              {printedPaper.length > 0 ? (
                <button type="button" data-testid="run-print-again" onClick={() => printPacket('printed')} title="It already printed. Print it again only if the first copy was lost; every copy is filed on the job, and the Printed tick re-marks with now." style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontSize: '0.8125rem', fontWeight: 400, cursor: 'pointer' }}>
                  Print it again · {printedPaper.length} {printedPaper.length === 1 ? 'envelope' : 'envelopes'}
                </button>
              ) : null}
              {onTakeBack && printedIds.length > 0 && !takeBackOpen ? (
                <button type="button" data-testid="run-take-back" onClick={() => { setTakeBackOne(null); setTakeBackOpen(true); setMoreOpen(false) }} disabled={busy} title="Nothing was mailed? Put the printed notices back in Approved · to print." style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-link)', fontSize: '0.8125rem', fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer' }}>
                  Take back…
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      {dsm.stage !== 'idle' && dsm.outcome && docsmitPrice ? (
        <DocsmitReviewModal prepared={dsm.outcome.prepared} held={dsm.outcome.held} priceWords={docsmitPrice.words} short={docsmitPrice.short} low={docsmitPrice.low} sendBy={sendBy} busy={busy || dsm.stage === 'sending'} outcome={dsm.sent} onMail={() => void mailDocsmit()} onClose={closeDocsmit} />
      ) : null}
      {preview != null && previewEntries.length > 0 ? (
        <LienRunPreviewOverlay
          entries={previewEntries}
          index={preview}
          onIndex={setPreview}
          onClose={() => setPreview(null)}
          onPrint={(i) => {
            const e = previewEntries[i]
            const hit = envelopes.flatMap((env) => env.contents).find((c) => `${c.notice.itemId}-${c.recipient.key}` === e?.key)
            if (hit) printCopy(hit.notice as CombinedRunNotice, hit.recipient)
          }}
        />
      ) : null}
    </div>
  )
}
