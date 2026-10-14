import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchJobWithDetailsById } from '../../lib/fetchJobWithDetailsById'
import { noticeInvoiceDocs, noticeInvoicePrintSections, unpaidBilledInvoices, type NoticeInvoiceDoc } from '../../lib/jobs/noticeInvoiceEnclosure'
import { fetchStripeInvoiceFacts } from '../../lib/stripeInvoiceFacts'
import type { BillingStripeModePref } from '../../lib/billingStripeModePref'
import type { PhysicalInvoiceIssuer } from '../../lib/physicalInvoiceIssuer'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { openHtmlPrintWindow, openHtmlWindowWhenReady } from '../../lib/jobsDocuments/printWindow'
import { printAndFile } from '../../lib/sent/sentCopiesIo'
import { describeNoticeMonths } from '../../lib/jobs/lienNoticeDraft'
import { runMailing } from '../../lib/jobs/lienRunPaper'
import { runLabelCsv, runLabelFilename, runLabelRows, runLabelSavedWords } from '../../lib/jobs/lienRunLabels'
import { RUN_SEND_METHODS, recipientViaDocsmit, noticesFullyPrinted, runCopyHtml, runCopyKey, runCopyPages, runCourtesyResultWords, runEnvelopeFacesHtml, runEnvelopeHtml, runNoticeProblems, runOpening, runRecordWords, runPacketHtml, runPayPageBlocks, runRecordSplit, trackingShape, type RunNotice, type RunPayPages, type RunRecipient, type RunSendMethod } from '../../lib/jobs/lienDeskRun'
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
import { runNoticesTakenBack, runPrintedItemIds, runTakeBackConfirm, runTakenBackWords, runTypedTrackingCount } from '../../lib/jobs/lienRunTakeBack'
import LienRunPreviewOverlay, { type LienRunPreviewEntry } from './LienRunPreviewOverlay'
import { signLienDeskItem } from '../../lib/jobs/lienDeskSignIo'
import { lienNoticeSignatureAfterSigning } from '../../lib/jobs/lienNoticeSignature'
import { LienNoticeSignLine, type LienNoticeSignLineHandle } from './LienNoticeSignLine'
import LienPenSignaturePane, { type PenPaneRecorded } from './LienPenSignaturePane'
import LienRunJourney from './LienRunJourney'
import LienRunEnvelopeGlyph from './LienRunEnvelopeGlyph'
import { runEnvelopeChip, runEnvelopeStage, type RunEnvelopeStageState } from '../../lib/jobs/runEnvelopeStage'
import { runFootAction } from '../../lib/jobs/runFootAction'
import { runChecklistRows, runChecklistWords } from '../../lib/jobs/runChecklist'
import { runLaneOfEnvelope, runStageLabels, type RunLane } from '../../lib/jobs/runEnvelopeStage'
import { runJourney } from '../../lib/jobs/runJourney'
import DocsmitReviewModal from './DocsmitReviewModal'
import { useDocsmitSettings } from '../../hooks/useDocsmitSettings'
import { docsmitCandidates, docsmitPriceWords, docsmitRunDoor, docsmitSendByStrip, docsmitSendOutcome } from '../../lib/mail/runDocsmit'
import { docsmitHeldWords, docsmitRecipientPatches, prepareDocsmitRun, sendDocsmitRun, type DocsmitPrepareOutcome } from '../../lib/mail/runDocsmitIo'
import { noticeDeadlineForMonth } from '../../lib/jobs/lienDeadlines'

/**
 * Send the run: every approved notice on the desk as one packet (the cover
 * sheet listing the envelopes, then what goes in each — the owner's copy
 * behind its cover page, the original contractor's copy alone) and one form
 * for the tracking numbers, one per envelope. Notices to one name at one
 * address share an envelope (v2.3720): two jobs at one property, and every
 * copy for the one original contractor. Record the run writes each notice to
 * its job with every month it named and marks the desk items sent.
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
  openOnTakeBack = false,
  undo,
  stripeMode = 'live',
  viewer = null,
}: {
  notices: RunNotice[]
  issuer: PhysicalInvoiceIssuer | null
  todayYmd: string
  userId: string | null
  onClose: () => void
  /** After a record — the desk re-reads. */
  onRecorded: () => void
  /** The packet printed (v2.4119): the desk stamps these items printed so they sit in "In the mail · tracking owed" until recorded. */
  onPrinted?: (itemIds: string[]) => Promise<void> | void
  /**
   * Take back what printed (punch list #101): nothing was mailed, so these items go back to Ready
   * to send with their approvals. The host writes it and re-reads; it returns how many it took back.
   */
  onTakeBack?: (itemIds: string[]) => Promise<number>
  /** Open on the take-back confirm: Do now's run row pressed *Take back…* (punch list #101 PR 2). */
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
}) {
  const { showToast } = useToastContext()
  const [notices, setNotices] = useState<RunNotice[]>(initial)
  const [busy, setBusy] = useState(false)
  // Leader here, sign ▸ (v2.5086): the held envelope whose sign sheet is open, and the line he draws on.
  const [signOpen, setSignOpen] = useState<string | null>(null)
  const signRef = useRef<LienNoticeSignLineHandle>(null)
  // He signed the paper ▸ (the pen train, PR 2): the held envelope whose pen pane is open.
  const [penOpen, setPenOpen] = useState<string | null>(null)
  // More ▾ (Run-4): the foot's secondary doors, folded.
  const [moreOpen, setMoreOpen] = useState(false)
  // Mail through Docsmit (the Docsmit train, PR 5b): the switches, what prepare made of the certified envelopes, the review, the send's outcome.
  const docsmit = useDocsmitSettings()
  const [dsm, setDsm] = useState<{ stage: 'idle' | 'preparing' | 'review' | 'sending'; outcome: DocsmitPrepareOutcome | null; sent: string | null }>({ stage: 'idle', outcome: null, sent: null })
  // The checklist, live (Run-5): the printed sheet's three boxes per envelope, ticked here at the counter; the window's own state.
  const [ticks, setTicks] = useState<Record<number, [boolean, boolean, boolean]>>({})
  // The saved copy (v2.3763): where the office keeps the packet as printed — one link and a line for the whole run; every notice's record carries it.
  const [docUrl, setDocUrl] = useState('')
  const [docNote, setDocNote] = useState('')
  // The mailing (v2.4119): when the packet printed — in this sitting, or before it when every notice
  // handed in is already printed (v2.4823: the run then opens on recording, not on printing again) — and the day the envelopes went out.
  const opening = useMemo(() => runOpening(initial), [initial])
  // Taken back in this sitting (punch list #101): the window goes back to printing, whatever the opening said.
  const [takenBack, setTakenBack] = useState<{ count: number; printedAt: string | null } | null>(null)
  const [takeBackOpen, setTakeBackOpen] = useState(openOnTakeBack)
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
  const problems = useMemo(() => shown.map((n) => runNoticeProblems(n)), [shown])
  // Record what is ready (v2.5533): a notice with a problem in red is held and stays in the pile with its reason and
  // its doors; the ready ones record now. The button is dead only when nothing is ready.
  const split = useMemo(() => runRecordSplit(shown, problems), [shown, problems])
  const nothingReady = split.mailed.length === 0
  const footWords = runRecordWords(split)
  // The run on paper (v2.4971): an envelope with no mailing address or nothing to claim is held — listed, numbered after
  // the ones that go out, never printed. The window lists them in the paper's order so the numbers agree.
  const mailing = useMemo(() => runMailing(runEnvelopes(shown)), [shown])
  const envelopes = mailing.all
  const heldWhy = useMemo(() => new Map(mailing.held.map((h) => [h.env.key, h.why])), [mailing])
  const shared = envelopes.length < runCopies(shown)
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
  // The journey (Run-2): each envelope's stage from the same facts the rows show — printed when the packet printed before this sitting or every copy inside printed in it.
  const leaderName = useMemo(() => notices.find((n) => n.leader?.name)?.leader?.name ?? null, [notices])
  const stageByKey = useMemo(() => {
    const out = new Map<string, RunEnvelopeStageState>()
    for (const env of envelopes) out.set(env.key, runEnvelopeStage(env, { printed: printedAt != null || env.contents.every((c) => partsIds(c.notice as CombinedRunNotice).every((p) => printedCopies.has(runCopyKey(p.itemId, c.recipient.key)))) }))
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envelopes, printedAt, printedCopies])
  const journey = useMemo(() => runJourney(envelopes.map((env) => stageByKey.get(env.key)!), { leaderName }), [envelopes, stageByKey, leaderName])
  const foot = useMemo(() => runFootAction(envelopes.map((env) => stageByKey.get(env.key)!), { leaderName }), [envelopes, stageByKey, leaderName])
  const checklist = useMemo(() => runChecklistRows(envelopes, printedAt != null), [envelopes, printedAt])
  // The lanes (Run-5): once the packet printed and the envelopes travel more than one way, each way is a line with its envelopes and how far they are.
  const lanes = useMemo(() => {
    if (printedAt == null) return []
    const byLane = new Map<RunLane, RunEnvelope[]>()
    for (const env of envelopes) {
      const lane = runLaneOfEnvelope(env)
      byLane.set(lane, [...(byLane.get(lane) ?? []), env])
    }
    if (byLane.size < 2) return []
    const words: Record<string, string> = { certified: 'Certified', courier: 'Courier', hand: 'By hand', email: 'Email', docsmit: 'Docsmit' }
    return [...byLane.entries()].map(([lane, envs]) => {
      const states = envs.map((env) => stageByKey.get(env.key)!)
      const labels = runStageLabels(lane)
      const done = (key: string) => states.filter((st) => st.stages.find((x) => x.key === key)?.done).length
      return { lane, label: words[lane] ?? lane, envelopes: envs.map((e) => e.n), steps: [{ label: labels.printed, done: done('printed'), now: false }, { label: labels.mailed, done: done('mailed'), now: done('mailed') < envs.length }, { label: labels.recorded, done: done('recorded'), now: false }], total: envs.length }
    })
  }, [envelopes, printedAt, stageByKey])
  // Mail through Docsmit (PR 5b): the door shows once a dev saved the connection and while not paused, before anything printed;
  // an envelope already mailed through Docsmit leaves the paper paths and its card says so.
  const envelopeViaDocsmit = (env: RunEnvelope) => env.contents.some((c) => recipientViaDocsmit(c.recipient))
  // What still goes on paper: the mailed envelopes less the ones Docsmit carries, and the notices with a copy among them.
  const paperMailed = useMemo(() => mailing.mailed.filter((e) => !envelopeViaDocsmit(e)), [mailing])
  const paperShown = useMemo(() => shown.map((n) => ({ ...n, recipients: n.recipients.filter((r) => !recipientViaDocsmit(r)) })).filter((n) => n.recipients.length > 0), [shown])
  const docsmitDoor = useMemo(() => {
    const cands = docsmitCandidates(envelopes.filter((e) => !envelopeViaDocsmit(e)))
    return { cands, door: docsmitRunDoor(docsmit.settings, cands) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envelopes, docsmit.settings])
  const showDocsmit = docsmit.loaded && docsmit.setUp && docsmitDoor.door.show && printedAt == null && !recording
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
      const outcome = await prepareDocsmitRun(envelopes.filter((e) => !envelopeViaDocsmit(e)), {
        receipt: docsmit.settings.returnReceipt,
        invoiceDocsByJob: invoiceDocsShown,
        payBlocksByJob,
        payRowsByJob: Object.fromEntries(Object.entries(payByJob).map(([id, v]) => [id, v.rows])),
      })
      setDsm({ stage: 'review', outcome, sent: null })
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
      setDsm((d) => ({ ...d, stage: 'review', sent: result.words }))
      showToast(result.words, answer.ok ? 'success' : 'warning')
      // Every envelope that goes on paper is already through Docsmit: the run is sealed and postmarked, and the foot moves to recording.
      const paperLeft = mailing.mailed.filter((e) => !result.mailedKeys.includes(e.key) && !envelopeViaDocsmit(e))
      if (result.mailedKeys.length > 0 && paperLeft.length === 0) setPrintedAt((v) => v ?? new Date().toISOString())
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
  // Leader here, sign ▸: he draws on this screen; each unsigned notice in the envelope gets the mark, attributed to him, the row naming this sign-in's screen.
  const signHere = async (env: RunEnvelope) => {
    if (busy || !viewer) return
    const targets = unsignedIn(env)
    const leader = targets[0]?.leader ?? null
    if (!leader) return
    const png = signRef.current?.toDataURL() ?? null
    if (!png) {
      showToast('Sign on the line first.', 'error')
      return
    }
    setBusy(true)
    try {
      const signed: RunNotice[] = []
      for (const n of targets) {
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
        showToast(signed.length === 1 ? 'Signed — the notice is in the run.' : `Signed — ${signed.length} notices are in the run.`)
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
    if (done.length) {
      setPrintedNow((prev) => [...prev, ...done.filter((id) => !prev.includes(id))])
      setTakenBack(null)
      void Promise.resolve(onPrinted?.(done)).catch(() => undefined)
    }
    if (noticesFullyPrinted(notices, next).length === notices.length && notices.length > 0) setPrintedAt((v) => v ?? new Date().toISOString())
  }
  const printPacket = () => {
    // A print counts as a send (docs/SENT_COPIES.md): the packet is filed as it printed, on every job in it.
    const packetJobIds = shown.flatMap((n) => (partsOf(n) ?? [{ jobId: n.jobId }]).map((p) => p.jobId))
    const filing = { kind: 'lien_notice_packet', title: shown.length === 1 ? '§ 53.056 notice packet' : `§ 53.056 notice packet · ${shown.length} notices`, jobIds: packetJobIds }
    if (!printAndFile(runPacketHtml(paperShown, todayYmd, issuer, invoiceSectionsByJob, payPagesByJob), filing)) {
      showToast('Popup blocked — allow popups to print the packet.', 'error')
      return
    }
    // Printed is a state (v2.4119): the desk shows these items in their own pile until the mailing is recorded. Best-effort.
    // Only the copies inside the envelopes that printed count (v2.4971): a notice whose other envelope is held stays half-printed.
    notePrinted(paperMailed.flatMap((env) => env.contents.flatMap((c) => partsIds(c.notice as CombinedRunNotice).map((p) => runCopyKey(p.itemId, c.recipient.key)))))
  }
  const printCopy = (n: CombinedRunNotice, r: RunRecipient) => {
    const filing = { kind: 'lien_notice', title: `${n.label} · copy for ${r.label.toLowerCase()}`, jobIds: partsIds(n).map((p) => p.jobId), recipientName: r.name || null }
    if (!printAndFile(runCopyHtml(n, r, invoiceSectionsByJob, payPagesByJob), filing)) {
      showToast('Popup blocked — allow popups to print the copy.', 'error')
      return
    }
    notePrinted(partsIds(n).map((p) => runCopyKey(p.itemId, r.key)))
  }
  const printEnvelope = (env: RunEnvelope) => {
    const inside = env.contents.map((c) => c.notice as CombinedRunNotice)
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
  const takeBackWords = runTakeBackConfirm({ count: printedIds.length, printedAt: lastPrintedAt, typed: runTypedTrackingCount(notices, printedIds), all: printedIds.length === notices.length })
  const takeBack = async () => {
    if (!onTakeBack || busy || printedIds.length === 0) return
    setBusy(true)
    try {
      const ids = printedIds
      const count = await onTakeBack(ids)
      setNotices((prev) => runNoticesTakenBack(prev, ids))
      setPrintedCopies(new Set())
      setPrintedNow([])
      setPrintedAt(null)
      setTakeBackOpen(false)
      setTakenBack({ count, printedAt: lastPrintedAt })
    } catch (e) {
      showToast(`Not taken back: ${e instanceof Error ? e.message : 'try again'}`, 'error')
    } finally {
      setBusy(false)
    }
  }
  const record = async () => {
    if (busy || nothingReady || notices.length === 0) return
    setBusy(true)
    try {
      const result = await recordLienDeskRun(split.mailed, { userId, todayYmd, mailedOn, invoiceDocsByJob: invoiceDocsShown, payBlocksByJob, document: { url: docUrl, note: docNote } })
      const courtesy = runCourtesyResultWords(result.courtesySent, result.courtesyFailed)
      if (result.recorded.length) showToast(`${result.recorded.length} ${result.recorded.length === 1 ? 'notice' : 'notices'} recorded — the desk reads them as sent.${courtesy.sent ? ` ${courtesy.sent}` : ''}${split.waiting.length ? ` ${split.waiting.length} ${split.waiting.length === 1 ? 'stays' : 'stay'} in the mail pile until its number is typed.` : ''}`, 'success')
      if (result.failed.length) showToast(`${result.failed.length} not recorded: ${result.failed.map((f) => `${f.label} (${f.reason})`).join('; ')}`, 'error')
      if (courtesy.failed) showToast(courtesy.failed, 'warning')
      if (result.releaseFailed.length) showToast(`The enclosed release was not issued on ${result.releaseFailed.map((f) => `${f.label} (${f.reason})`).join('; ')}. Issue it from the Release of Lien window.`, 'warning')
      onRecorded()
      if (result.failed.length === 0 && split.waiting.length === 0) onClose()
      else {
        const keep = (n: RunNotice) =>
          result.failed.some((f) => f.itemId === n.itemId || shown.some((s) => s.itemId === f.itemId && (partsOf(s) ?? []).some((p) => p.itemId === n.itemId))) ||
          split.waiting.some((w) => w.itemId === n.itemId || (partsOf(w) ?? []).some((p) => p.itemId === n.itemId))
        setNotices((prev) => prev.filter(keep))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={recording ? 'Record the mailing' : 'Send the run'}
      style={{ position: 'fixed', inset: 0, paddingTop: 'var(--app-top-chrome, 0px)', background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 790 }}
      onClick={(e) => {
        // The Lien desk and Put a GC on notice draw the run inside their own backdrop: a click
        // outside closes the run only, not the window behind it (v2.4352).
        e.stopPropagation()
        onClose()
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 10, width: 'min(960px, calc(100vw - 2rem))', maxHeight: 'min(90vh, calc(100dvh - 2rem - var(--app-top-chrome, 0px)))', display: 'grid', gridTemplateRows: 'auto 1fr auto', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', padding: '1rem 1.25rem 0.6rem', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.05rem' }}>{recording ? 'Record the mailing' : 'Send the run'} · {shown.length} {shown.length === 1 ? 'notice' : 'notices'}{combine && shown.length !== notices.length ? ` for ${notices.length} jobs` : ''}</h2>
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
            {explainerOpen ? (
              <p data-testid="run-explainer" style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)', maxWidth: '78ch' }}>
                One packet with every approved notice: a checklist sheet listing the {paperMailed.length} {paperMailed.length === 1 ? 'envelope' : 'envelopes'}, then for each one a divider page with its face and what goes in it, in that order.{mailing.held.length ? ` ${mailing.held.length} ${mailing.held.length === 1 ? 'envelope is' : 'envelopes are'} held back — no mailing address, nothing to claim, or unsigned — and listed in red.` : ''} The owner of record's copy behind its cover page; the original contractor's copy alone{payCodes > 0 ? `; the pay codes page behind the owner's copy (${payCodes} ${payCodes === 1 ? 'code' : 'codes'}, one per Stripe bill)` : ''}{invoicesEnclosed > 0 ? `; the job's unpaid ${invoicesEnclosed === 1 ? 'invoice' : 'invoices'} behind each copy (§ 53.056(a-3))` : ''}.{shared ? ' Notices to one name at one address share an envelope, so its tracking number covers everything inside.' : ''} {recording ? `It printed ${demandDate(calendarYmdInAppTzFromIso(opening.printedAt!))}; type the tracking numbers when you are back from the post office.` : 'Print it first; type the tracking numbers when you are back from the post office.'} Recording the run writes each notice to its job with every month it named. Press Preview on any copy to read it as the packet prints it.
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
        {/* The journey (Run-2): where the run stands, shown. Run-4 retired the step strip under it. */}
        <LienRunJourney journey={journey} />
        {lanes.length ? (
          <div className="lienRunLanes" data-testid="run-lanes">
            {lanes.map((l) => (
              <div key={l.lane} className="lienRunLane" data-testid={`run-lane-${l.lane}`}>
                <span className="lienRunLaneKey">{l.label}</span>
                <span className="lienRunSteps" style={{ margin: 0 }}>
                  {l.steps.map((st, i) => (
                    <span key={st.label} style={{ display: 'inline-flex', alignItems: 'center' }}>
                      {i > 0 ? <span className="lienRunStepGap" aria-hidden="true" /> : null}
                      <span className="lienRunStep" data-done={st.done === l.total ? 'yes' : 'no'} data-now={st.done < l.total && st.now ? 'yes' : 'no'}>{st.label}{st.done > 0 && st.done < l.total ? ` ${st.done} of ${l.total}` : ''}</span>
                    </span>
                  ))}
                  <span className="lienRunChip" data-tone="gray" style={{ marginLeft: '0.5rem' }}>{l.envelopes.length === 1 ? `envelope ${l.envelopes[0]}` : `envelopes ${l.envelopes.join(', ')}`}</span>
                </span>
              </div>
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
        {takenBack ? (
          <div data-testid="run-taken-back" role="status" style={{ margin: '0.6rem 1.25rem 0', padding: '0.5rem 0.8rem', borderRadius: 8, background: 'var(--bg-green-tint)', color: 'var(--text-green-800)', fontSize: '0.8125rem' }}>
            {runTakenBackWords(takenBack.count, takenBack.printedAt)}
          </div>
        ) : null}
        <div style={{ overflow: 'auto', padding: '0.5rem 1.25rem' }}>
          {notices.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Nothing approved is waiting.</p> : null}
          {combinable.combined > 0 ? (
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: '0.8125rem', padding: '0.4rem 0.6rem', margin: '0.2rem 0 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--bg-amber-tint)' }} data-testid="run-combine">
              <input type="checkbox" checked={combine} onChange={(ev) => setCombine(ev.target.checked)} aria-label="Combine the jobs at one property into one notice" style={{ marginTop: 3 }} />
              <span>
                <strong>Combine the jobs at one property into one notice</strong> — one form to the same owner from the same original contractor, the claims summed, the months joined; still one record per job, on one packet.{' '}
                <span style={{ color: 'var(--text-muted)' }}>{combinable.jobs} jobs would print as {combinable.notices} {combinable.notices === 1 ? 'notice' : 'notices'} ({combinable.combined} combined). The form's claim changes when jobs combine — off unless the office says so.</span>
              </span>
            </label>
          ) : null}
          {checklist.length ? (
            <div className="lienRunChecklist" data-testid="run-checklist">
              <h3>At the counter · the checklist, live <span>{runChecklistWords(checklist)}</span></h3>
              {checklist.map((row) => {
                const t = ticks[row.n] ?? [false, false, false]
                const env = envelopes.find((e) => e.n === row.n)!
                return (
                  <div key={row.n} className="lienRunChecklistRow" data-testid={`run-checklist-${row.n}`} data-done={row.done ? 'yes' : 'no'}>
                    <LienRunEnvelopeGlyph glyph={stageByKey.get(env.key)!.glyph} size={44} />
                    <div style={{ minWidth: 0 }}>
                      <b>{row.n} · {row.name}</b>
                      <div className="lienRunCardLine">{row.inside} · {row.address}</div>
                      <div className="lienRunChecklistBoxes">
                        {row.boxes.map((label, i) => (
                          <label key={label}>
                            <input type="checkbox" checked={t[i]} onChange={(ev) => setTicks((prev) => { const next: [boolean, boolean, boolean] = [...(prev[row.n] ?? [false, false, false])] as [boolean, boolean, boolean]; next[i] = ev.target.checked; return { ...prev, [row.n]: next } })} aria-label={`Envelope ${row.n} — ${label}`} />
                            {label}
                          </label>
                        ))}
                      </div>
                    </div>
                    <input value={row.tracking} onChange={(ev) => setEnvelope(env, { tracking: ev.target.value })} placeholder={row.placeholder} aria-label={`Envelope ${row.n} — number (checklist)`} className="lienRunTracking" style={{ font: 'inherit', fontSize: '0.78rem', padding: '3px 6px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit', width: '12rem', maxWidth: '100%' }} />
                  </div>
                )
              })}
            </div>
          ) : null}
          {showDocsmit && sendBy ? (
            <div data-testid="run-docsmit-send-by" style={{ margin: '0 0 0.5rem', padding: '0.35rem 0.6rem', borderRadius: 6, fontSize: '0.78rem', background: sendBy.late ? 'var(--bg-red-tint))' : 'var(--bg-page)', color: sendBy.late ? 'var(--text-red-600)' : 'var(--text-muted)', border: '1px solid var(--border)' }}>
              {sendBy.words}
            </div>
          ) : null}
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
                            <LienNoticeSignLine ref={signRef} printedName={unsignedIn(env)[0]!.leader!.name} under={[unsignedIn(env)[0]!.fields.contactPerson, unsignedIn(env)[0]!.fields.claimantName]} signedLabel={`Signed ${demandDate(todayYmd)}`} allowPress={false} compact disabled={busy} />
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{unsignedIn(env)[0]!.leader!.name} draws on this screen. The record names {viewer.name || 'you'} as whose screen it was.</div>
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
                            <button type="button" onClick={() => setSignOpen(env.key)} data-testid={`run-leader-here-sign-${env.n}`} title="The leader is beside you: he draws his signature on this screen, and the record names yours" style={{ padding: '4px 11px', borderRadius: 7, border: '1px solid var(--text-link)', background: 'var(--surface)', color: 'var(--text-link)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>Leader here, sign ▸</button>
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
                      {env.contents.map(({ notice: n, recipient: r, noticeIndex: ni }) => {
                    const mine = problems[ni]!.filter((p) => p.startsWith(`${r.label}:`))
                    return (
                      <div key={`${n.itemId}-${r.key}`} className="lienRunCopyRow" data-testid={`run-row-${n.jobId}-${r.key}`}>
                        <div className="lienRunJob">
                          {n.label}
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
        </div>
        <div className="lienRunFoot2" data-testid="run-foot">
          <div className="lienRunFootStatus" data-testid="run-foot-status">
            <b>{footWords ? footWords.line1 : foot.line1}</b>
            <span>{footWords ? footWords.line2 : printedAt ? 'Back from the post office? Type each envelope’s number below — an envelope without one stays in the mail pile.' : foot.line2}</span>
          </div>
          <button type="button" onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen} data-testid="run-more" style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>
            More {moreOpen ? '▴' : '▾'}
          </button>
          {printedAt ? (
            <>
          <button type="button" onClick={() => void record()} disabled={busy || nothingReady || notices.length === 0} style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid transparent', background: '#2563eb', color: '#fff', fontSize: '0.8125rem', fontWeight: 600, cursor: busy || nothingReady ? 'default' : 'pointer', opacity: busy || nothingReady || notices.length === 0 ? 0.55 : 1 }}>
            {busy ? 'Recording…' : (footWords?.button ?? 'Record the run ▸')}
          </button>
            </>
          ) : (
            <>
          {showDocsmit ? (
            <button type="button" onClick={() => void openDocsmit()} disabled={busy || !docsmitDoor.door.enabled} title={docsmitDoor.door.why || 'Each certified envelope goes to Docsmit as a PDF; you review every one before anything mails.'} data-testid="run-docsmit" style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text)', cursor: busy || !docsmitDoor.door.enabled ? 'not-allowed' : 'pointer', fontSize: '0.8125rem', fontWeight: 600 }}>
              {dsm.stage === 'preparing' ? 'Preparing…' : `${docsmitDoor.door.label} ▸`}
            </button>
          ) : null}
          <button type="button" onClick={printPacket} disabled={notices.length === 0} title={printedAt ? 'It already printed. Print it again only if the first copy was lost; every copy is filed on the job.' : undefined} style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontSize: '0.8125rem', fontWeight: printedAt ? 400 : 600, cursor: 'pointer' }}>
            {printedAt ? 'Print it again' : 'Print the packet'} · {paperMailed.length} {paperMailed.length === 1 ? 'envelope' : 'envelopes'}
          </button>
            </>
          )}
          {moreOpen ? (
            <div className="lienRunMore" data-testid="run-more-panel">
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
              {printedAt ? (
                <button type="button" onClick={printPacket} disabled={notices.length === 0} title={printedAt ? 'It already printed. Print it again only if the first copy was lost; every copy is filed on the job.' : undefined} style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontSize: '0.8125rem', fontWeight: printedAt ? 400 : 600, cursor: 'pointer' }}>
            {printedAt ? 'Print it again' : 'Print the packet'} · {paperMailed.length} {paperMailed.length === 1 ? 'envelope' : 'envelopes'}
                </button>
              ) : (
                <button type="button" onClick={() => void record()} disabled={busy || nothingReady || notices.length === 0} style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid transparent', background: '#2563eb', color: '#fff', fontSize: '0.8125rem', fontWeight: 600, cursor: busy || nothingReady ? 'default' : 'pointer', opacity: busy || nothingReady || notices.length === 0 ? 0.55 : 1 }}>
            {busy ? 'Recording…' : (footWords?.button ?? 'Record the run ▸')}
                </button>
              )}
              {onTakeBack && printedIds.length > 0 && !takeBackOpen ? (
                <button type="button" data-testid="run-take-back" onClick={() => { setTakeBackOpen(true); setMoreOpen(false) }} disabled={busy} title="Nothing was mailed? Put the printed notices back in Ready to send." style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-link)', fontSize: '0.8125rem', fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer' }}>
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
