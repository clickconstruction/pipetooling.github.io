import { useEffect, useMemo, useRef, useState } from 'react'
import { LienJobHeading } from './LienJobNumber'
import { createPortal } from 'react-dom'
import type { PhysicalInvoiceIssuer } from '../../lib/physicalInvoiceIssuer'
import { buildLienAffidavitBlocks, filingDocHtml, filingLetterheadFromIssuer } from '../../lib/jobsDocuments/lienFilingDocuments'
import { demandDate } from '../../lib/jobsDocuments/demandLetter'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { lienPropertyOwnerDisplayName, resolveLienProperty } from '../../lib/jobs/lienProperty'
import { workMonthLabel, type JobWorkMonths } from '../../lib/jobs/forecastWorkMonths'
import { buildLienMonthHistory } from '../../lib/jobs/lienMonthHistory'
import { buildLienTimelineFromDesk, lienRetainageClockFromDesk } from '../../lib/jobs/lienTimelineDesk'
import { lienApproverFor } from '../../lib/jobs/lienApprovalWait'
import { LienLastWorkDayWindow } from './LienLastWorkDayWindow'
import LienTimelineStrip, { LienTimelineViewSwitch } from './LienTimelineStrip'
import { lienLastWorkDoorOffered } from '../../lib/jobs/lienLastWorkDoor'
import { lienLastWorkAffidavitMonths } from '../../lib/jobs/lienLastWorkDayPreview'
import { bringLienFooterUp } from './lienFooterFocus'
import type { LienNextAct, LienNextActDoor } from '../../lib/jobs/lienNextAct'
import { useLienPaneHeads } from './useLienPaneHeads'
import { useLienGateLanding, type LienGateAsk } from './useLienGateLanding'
import { lienAffidavitPaneSections, lienAffidavitWindowWords } from '../../lib/jobs/lienAffidavitPaneSections'
import LienStopPaperWindow, { type LienStopPaper } from './LienStopPaperWindow'
import { filingSnapshotPage, retainageStopPages } from '../../lib/jobs/lienStopPaperPages'
import { lienStopProof } from '../../lib/jobs/lienStopProof'
import { lienMailProofDoorPress, lienMailProofOwnerGap, type LienMailProofOpeners } from '../../lib/jobs/lienMailProofDoor'
import { lienServeStage, lienServeStageDoor, type LienServePrinted } from '../../lib/jobs/lienServeStage'
import { lienClosedNoticeStopNote, lienStopPaperKind } from '../../lib/jobs/lienStopPaper'
import { lienAffidavitFootBlockedSentence, lienAffidavitGateShortWords } from '../../lib/jobs/lienDeskGates'
import { lienAffidavitNoticeStanding } from '../../lib/jobs/lienAffidavitNoticeStanding'
import type { LienTimelineStep } from '../../lib/jobs/lienTimeline'
import { useIsMobile } from '../../hooks/useIsMobile'
import { affidavitMonthRows, affidavitMonthRowsWithoutHours, affidavitMonthsSentence, affidavitNoHoursSource } from '../../lib/jobs/affidavitMonths'
import { noticeDeadlineForMonth } from '../../lib/jobs/lienDeadlines'
import { claimDeltaWords, correctedClaim, correctionSetWords } from '../../lib/jobs/lienClaimCorrection'
import { daysBetweenYmd } from '../../lib/jobs/billedExpectedPay'
import { holdUntilFor, isLienLeader, isLienOffice, monthFromBill, monthIsStandIn } from '../../lib/jobs/lienDesk'
import { lienStandInSourceOf } from '../../lib/jobs/lienBillMonths'
import { LIEN_MONTH_FLAG_DOOR_WORDS, LIEN_MONTH_CHECK_CANCEL_WORDS, LIEN_MONTH_CHECK_CHANGE_WORDS, LIEN_MONTH_CHECK_NOTE_HINT, LIEN_MONTH_CHECK_SAVES_WORDS, LIEN_MONTH_SET_LAST_DAY_WORDS, lienMonthAskWords, lienMonthCheckProblem, lienMonthCheckState, lienMonthCheckedRowWords, lienMonthCheckedWords, lienMonthConfirmWords, lienMonthName, lienMonthQuestion, lienMonthYesWords, parseLienMonthCheck } from '../../lib/jobs/lienMonthCheck'
import { saveLienMonthCheck } from '../../lib/jobs/lienMonthCheckIo'
import { lienAffidavitGateHeld, lienAffidavitHoldingGate, type LienAffidavitEntry } from '../../lib/jobs/lienDeskAffidavits'
import { approveLienDeskItem, holdLienDeskItem, pullBackLienDeskItem, redrawLienAffidavitShort, LIEN_DRAFT_AUTOSAVE_MS, saveLienDeskDraft, sendLienDeskItemOnWord, submitLienDeskItem, tellLeaderOfLienAffidavits } from '../../lib/jobs/lienDeskIo'
import { lienAffidavitToldWords } from '../../lib/jobs/lienAffidavitApprovalTell'
import { defaultWordNote, wordRecordPreview, wordRecordWords, type LienWordChannel } from '../../lib/jobs/lienWord'
import { lienLeaderPressWords } from '../../lib/jobs/lienLeaderPress'
import { lienFooter } from '../../lib/jobs/lienFooterMenu'
import { LienFootMenu } from './LienFootMenu'
import { LienWordRecordRow } from './LienWordRecordRow'
import { buildLienNoticeFieldsForJob, homesteadStatementApplies, lienAffidavitSwornMonths } from '../../lib/jobs/lienNoticeDraft'
import { LIEN_NOTICE_CHECK_LEAD, lienAffidavitNoticeCheck, lienNoticeCheckLines } from '../../lib/jobs/lienAffidavitNoticeCheck'
import { lienAffidavitOwnerSends, lienAffidavitWorkMonths } from '../../lib/jobs/lienAffidavitNotices'
import { lienGateRow, type LienGateRowFacts } from '../../lib/jobs/lienGateRow'
import { lienGateLanding } from '../../lib/jobs/lienGateLanding'
import { lienAffidavitNoticeDueLine, lienLastMonthNoticeDue, lienNoticeNamedMonths } from '../../lib/jobs/lienNoticeOwed'
import { clearLienAffidavitMonthsByHand, saveLienAffidavitMonthsByHand } from '../../lib/jobs/lienAffidavitMonthsByHandIo'
import LienAffidavitMonthsByHandEditor from './LienAffidavitMonthsByHandEditor'
import { HOMESTEAD_QUESTION_DOOR } from '../../lib/customers/homesteadAnswer'
import { buildLienDeskAffidavitFields } from '../../lib/jobs/lienDeskAffidavitFields'
import { lienAffidavitSubmitOutcome } from '../../lib/jobs/lienAffidavitBatch'
import { LIEN_AFFIDAVIT_LONG_FORM_WORDS, LIEN_AFFIDAVIT_SHORT_FORM_MARK, lienAffidavitFormForItem } from '../../lib/jobs/lienAffidavitForm'
import type { LienDeskData } from '../../hooks/useLienDeskData'
import { AFFIDAVIT_PILE_WORDS, affidavitPileFor, ownerCallWords, reservationHoldEndsOn, type OwnerCall } from '../../lib/jobs/lienOwnerCall'
import type { LienPaymentBond } from '../../lib/jobs/lienDeskRetainage'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'

/**
 * The affidavit pane of the Lien desk (v2.3412): the § 53.052 gate (owner of
 * record, county + legal description, a recorded notice on sub jobs, not a
 * homestead), the affidavit as the Lien window will print it, and the same
 * draft → approve → file verbs as notices. "Filed" is recorded in the Lien
 * window (print for notarization, file with the clerk, record the filing);
 * a filed affidavit still unpaid hands the account to the Legal desk.
 */

const chip = (bg: string, fg: string): React.CSSProperties => ({ display: 'inline-block', padding: '0 6px', borderRadius: 5, fontSize: '0.68rem', fontWeight: 600, lineHeight: '18px', whiteSpace: 'nowrap', background: bg, color: fg, verticalAlign: 'middle' })
const btn = (kind: 'primary' | 'green' | 'amber' | 'plain' = 'plain', disabled = false): React.CSSProperties => ({
  padding: '5px 10px',
  borderRadius: 7,
  border: `1px solid ${kind === 'plain' ? 'var(--border-strong)' : 'transparent'}`,
  background: kind === 'primary' ? '#2563eb' : kind === 'green' ? '#166534' : kind === 'amber' ? '#92400e' : 'var(--surface)',
  color: kind === 'plain' ? 'var(--text-700)' : '#fff',
  fontSize: '0.8125rem',
  fontWeight: 600,
  cursor: disabled ? 'default' : 'pointer',
  opacity: disabled ? 0.55 : 1,
  whiteSpace: 'nowrap',
})
const boxStyle: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 9, padding: '0.6rem 0.75rem', display: 'grid', gap: '0.35rem', background: 'var(--surface)' }
// The one small caption left (v2.7320): the months worked with no notice, a row group inside the months section. The section titles are the pane's grey heads (`useLienPaneHeads`).
const rowGroupHead: React.CSSProperties = { fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }

export function affidavitDeadlineWords(e: LienAffidavitEntry): string {
  if (e.daysLeft < 0) return 'window closed'
  if (e.daysLeft === 0) return 'file today'
  if (e.daysLeft === 1) return 'file by tomorrow'
  if (e.daysLeft <= 14) return `file in ${e.daysLeft}d`
  return `file by ${formatYmdMonthDay(e.deadline)}`
}

export default function LienDeskAffidavitPane({
  entry,
  data,
  workMonths = null,
  todayYmd,
  authRole,
  authUserId,
  authName = '',
  issuer,
  signerNameFor,
  leaderNameFor,
  onChanged,
  onOpenEditJob,
  onFixProperty,
  onFixContractor,
  onOpenJob,
  onOpenLienAffidavit,
  proofOpeners,
  servePrinted,
  onServe,
  onOpenLegalDesk,
  onShowNotices,
  onShowRetainage,
  onOpenLastWork,
  onLastWorkChanged,
  footerEl,
  landOnGate,
  ownerCall = null,
  bond = 'unknown',
  onOpenLienContract,
}: {
  entry: LienAffidavitEntry
  data: LienDeskData
  /** The job's work months (the forecast kernel) — the months card (v2.3681) needs them; null while loading. */
  workMonths?: JobWorkMonths | null
  todayYmd: string
  authRole: string | null
  authUserId: string | null
  /** The signed-in person's name — who made a record on the leader's word (v2.3813). */
  authName?: string
  issuer: PhysicalInvoiceIssuer | null
  signerNameFor: (masterUserId: string | null) => string
  /** The job's master by his plain name (v2.4856): the word row and the record say *on Malachi's word*; absent, *the leader*. */
  leaderNameFor?: (masterUserId: string | null) => string
  onChanged: () => void
  onOpenEditJob: (jobId: string) => void
  /** Fill in the property record in a window over the desk (v2.4724); without it the gate's door opens Edit Job. */
  onFixProperty?: (jobId: string, focus: 'owner' | 'legal' | 'homestead_answer') => void
  /** The general contractor's customer record, where its address is typed (punch list #305); without it the gate is words alone. */
  onFixContractor?: (gcCustomerId: string) => void
  /** The heading's job number opens the job itself (v2.4535). */
  onOpenJob?: (jobId: string) => void
  /** The Lien window on its affidavit tab — print for notarization, file, record. */
  onOpenLienAffidavit: (jobId: string) => void
  /** A stop window's card (`lienMailProofDoor.ts`): how the desk opens each place a copy's lack is entered, for one filing. Absent, a card has no press. */
  proofOpeners?: (filingId: string) => LienMailProofOpeners
  /** The filed liens whose copies were printed here (`lienServeStage.ts`), from the desk's read. */
  servePrinted?: LienServePrinted
  /** The door to this job's copies, landed on the half its name says; absent, the Lien window opens. */
  onServe?: (jobId: string) => void
  onOpenLegalDesk?: () => void
  /** Switch the desk to the notices kind on this job (the notice gate's door). */
  onShowNotices: (jobId: string) => void
  /** Switch the desk to the retainage kind on this job (v2.7321): the band's door when the § 53.057 notice is the next step. */
  onShowRetainage?: (jobId: string) => void
  /** The stand-in month's second press (v2.7280): today's door, the last day of work set by hand, which moves every clock. Absent, the question keeps the words alone. */
  onOpenLastWork?: (jobId: string) => void
  /** After the day is set from under the timeline's LAST WORK stop (v2.7684): the page re-reads the lien clocks and the desk. Absent, `onChanged`. */
  onLastWorkChanged?: () => void
  /** The desk's footer strip — the pane portals its footer there, so the desk keeps one strip and never re-renders for it (v2.3753). */
  footerEl: HTMLElement | null
  /** A press on this job's list row (v2.8472, punch list #364): the pane brings its first open gate into view, once per press. Absent, or with every gate clear, the pane opens as it always did. */
  landOnGate?: LienGateAsk | null
  /** The owner's answers on the sent notice (v2.3767) — counsel's pile comes from them. */
  ownerCall?: OwnerCall | null
  /** The payment bond on the project (v2.3767), from the job. */
  bond?: LienPaymentBond
  /** Edit Job → Our contract on this job — where the bond is set. */
  onOpenLienContract?: (jobId: string) => void
}) {
  const { showToast } = useToastContext()
  const leader = isLienLeader(authRole)
  const office = isLienOffice(authRole)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  // Autosave (v2.7327): the draft row is written about 800 ms after a change to the paper — the months set by hand — never
  // on open. `draftTouch` counts the changes; a forward press saves first, after any save in flight, so no second row is made.
  const [draftTouch, setDraftTouch] = useState(0)
  const [draftSave, setDraftSave] = useState<'idle' | 'saving' | 'saved'>('idle')
  const draftIdRef = useRef<string | null>(null)
  const autosaveRef = useRef<Promise<void> | null>(null)
  const touchDraft = () => setDraftTouch((n) => n + 1)
  useEffect(() => {
    setDraftTouch(0)
    setDraftSave('idle')
    draftIdRef.current = null
  }, [entry.jobId])
  const [wordOpen, setWordOpen] = useState(false)
  const [wordNote, setWordNote] = useState('')
  const [wordChannel, setWordChannel] = useState<LienWordChannel>('phone')
  const [holdOpen, setHoldOpen] = useState<'promised' | 'call_first' | null>(null)
  // A stop's paper (v2.4793): the timeline stop whose window is open; null when closed.
  const [stopOpen, setStopOpen] = useState<number | null>(null)
  // The last day's window, opened from under the timeline's LAST WORK stop (v2.7684); the desk keys this pane by job, so it closes with the job.
  const [lastWorkOpen, setLastWorkOpen] = useState(false)
  // Redraw on the short form (punch list #305): the press asks once before it takes the paper back to a draft.
  const [redrawOpen, setRedrawOpen] = useState(false)
  // The stand-in month's ask (v2.7280, punch list #358): who said the month is right, and when; open from Yes, August is right › and from Change ›.
  const [checkOpen, setCheckOpen] = useState(false)
  const [checkNote, setCheckNote] = useState('')

  const job = data.jobsById[entry.jobId]
  const gc = entry.gcCustomerId ? data.gcsById[entry.gcCustomerId] : undefined
  const isMobile = useIsMobile()
  // The job's lien timeline (v2.3761) — the same strip the notice pane draws, from the affidavit's side.
  const timeline = buildLienTimelineFromDesk(entry.jobId, {
    rows: data.rows,
    items: data.items,
    filings: data.filingsByJob[entry.jobId] ?? [],
    servePrinted,
    entry: data.queue.entries.find((e) => e.jobId === entry.jobId) ?? null,
    affidavit: entry,
    retainage: lienRetainageClockFromDesk(data, entry.jobId),
    isSub: entry.isSub,
    propertyKind: entry.propertyKind,
    lastWorkDate: job?.last_work_date ?? null,
    job: job ?? null,
    openBalance: entry.openBalance,
    todayYmd,
    demandLetters: data.demandLettersByJob?.[entry.jobId] ?? null,
    // The path names the leader a paper sent for approval waits on, as the row does (punch list #335).
    approver: lienApproverFor({ leaderName: leaderNameFor?.(job?.master_user_id ?? null), masterUserId: job?.master_user_id, viewerUserId: authUserId, role: authRole }),
  })
  const address = job?.customer_address_id ? data.addressesById[job.customer_address_id] ?? null : null
  const property = useMemo(() => resolveLienProperty(address ?? null, data.ownerByJob[entry.jobId] ?? null), [address, data.ownerByJob, entry.jobId])
  const ownerName = lienPropertyOwnerDisplayName(property.owner)
  const promise = data.promisesByJob[entry.jobId] ?? null
  const label = job ? `${effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '—'}${(job.job_name ?? '').trim() ? ` · ${(job.job_name ?? '').trim()}` : ''}` : entry.jobId.slice(0, 8)
  // The job's master by name (v2.4856): the word row and the record say *on Malachi's word*.
  const leaderName = leaderNameFor?.(job?.master_user_id ?? null) ?? ''
  // The presses name the leader as the app has him on the job (v2.7308): the same name the word record uses.
  const press = lienLeaderPressWords(leaderName, 'affidavit')
  const item = entry.item && entry.item.status !== 'sent' && entry.item.status !== 'missed' ? entry.item : null
  // The claim set by hand (v2.3682) carries to the affidavit: it swears to the app's balance less the correction.
  const correction = data.claimCorrectionsByJob[entry.jobId] ?? null
  const claimed = correctedClaim(entry.openBalance, correction)
  // The months set by hand (v2.7270, punch list #356 part 2): the paper names these in place of the record's.
  const byHand = data.affidavitMonthsByJob[entry.jobId] ?? null
  // A paper keeps the form it was drafted on (punch list #305): an affidavit drafted before the short form stays on the earlier one until someone redraws it.
  const form = lienAffidavitFormForItem(entry.item)

  // The desk's one recipe: the same call the paper preview and a stop's window make, so the three cannot drift.
  const fields = useMemo(
    () =>
      buildLienDeskAffidavitFields({
        job,
        entry,
        gc,
        ownerName,
        ownerAddress: property.owner.mailingAddress,
        county: property.county,
        legalDescription: property.legalDescription,
        correction,
        contactPerson: signerNameFor(job?.master_user_id ?? null),
        issuer,
        todayYmd,
        form,
        filings: data.filingsByJob[entry.jobId] ?? [],
        homestead: property.homestead,
        monthsByHand: byHand?.months ?? null,
      }),
    [job, entry, gc, ownerName, property, signerNameFor, issuer, correction, todayYmd, form, data.filingsByJob, byHand],
  )
  // The job's own work months and the notice's (punch list #356): what the editor offers, and what the check reads.
  const workMonthKeys = useMemo(() => lienAffidavitWorkMonths({ isSub: entry.isSub, workDays: job ?? null, lastMonth: entry.lastMonth, todayYmd }), [entry.isSub, job, entry.lastMonth, todayYmd])
  const namedMonthKeys = useMemo(() => lienNoticeNamedMonths(data.filingsByJob[entry.jobId] ?? []), [data.filingsByJob, entry.jobId])
  // The notice behind each sworn month (punch list #314): a flag for the attorney, never a hold.
  const noticeCheck = useMemo(() => {
    const filings = data.filingsByJob[entry.jobId] ?? []
    const facts = { isSub: entry.isSub, workDays: job ?? null, lastMonth: entry.lastMonth, todayYmd, monthsByHand: byHand?.months ?? null }
    return lienAffidavitNoticeCheck({ isSub: entry.isSub, propertyKind: entry.propertyKind, months: lienAffidavitSwornMonths({ ...facts, filings }), filings, work: workMonthKeys })
  }, [data.filingsByJob, entry.jobId, entry.isSub, entry.propertyKind, entry.lastMonth, job, todayYmd, byHand, workMonthKeys])
  const noticeCheckLines = lienNoticeCheckLines(noticeCheck)
  // The last work month's own § 53.056 notice still due and not recorded (punch list #353, part 2): said above Send for approval.
  const noticeDue = useMemo(() => lienLastMonthNoticeDue({ isSub: entry.isSub, lastMonth: entry.lastMonth, propertyKind: entry.propertyKind, filings: data.filingsByJob[entry.jobId] ?? [], todayYmd }), [entry.isSub, entry.lastMonth, entry.propertyKind, data.filingsByJob, entry.jobId, todayYmd])
  // The stand-in month (v2.7224) and where it stands (v2.7280): a question with two doors, or the quiet line once a person confirmed it. Never a hold.
  const monthState = lienMonthCheckState({ source: lienStandInSourceOf(entry.lastMonthFromCreation, entry.lastMonthFromBill), month: entry.lastMonth, check: parseLienMonthCheck(job) })
  const monthChecked = monthState.kind === 'checked' ? monthState.check : null
  // The months the paper swears (v2.7302), for the months head: the same call the fields and the notice check make.
  const swornMonths = useMemo(() => lienAffidavitSwornMonths({ isSub: entry.isSub, workDays: job ?? null, lastMonth: entry.lastMonth, todayYmd, filings: data.filingsByJob[entry.jobId] ?? [], monthsByHand: byHand?.months ?? null }), [entry.isSub, job, entry.lastMonth, todayYmd, data.filingsByJob, entry.jobId, byHand])
  const docHtml = useMemo(
    () => filingDocHtml(buildLienAffidavitBlocks(fields, { letterhead: filingLetterheadFromIssuer(issuer), refItems: [`Job #${job ? effectiveJobLedgerNumber(job.hcp_number, job.click_number) : ''}`, `Last work month ${entry.lastMonth}`, demandDate(todayYmd)] })),
    [fields, issuer, job, entry.lastMonth, todayYmd],
  )

  // A stop's paper (v2.4793): what the window shows for each stop, from the affidavit's side — this pane's own affidavit,
  // the retainage notice as its pane prints it, a filing's snapshot once it went out; the notice is read on Monthly notices.
  const stopPaperFor = (step: LienTimelineStep): LienStopPaper => {
    const none: LienStopPaper = { pages: [], envelope: null, before: [], record: null, act: null }
    const filings = (data.filingsByJob[entry.jobId] ?? []).filter((f) => !f.voided_at)
    const jobNo = job ? effectiveJobLedgerNumber(job.hcp_number, job.click_number) : ''
    const when = (ymd: string | null, iso: string) => formatYmdMonthDay(ymd ?? calendarYmdInAppTzFromIso(iso))
    const asSent = (f: (typeof filings)[number], words: string, extra: Partial<LienStopPaper> = {}): LienStopPaper => {
      const page = filingSnapshotPage(f, { issuer, jobNumber: jobNo })
      // The one reading the three stop windows share (`lienStopProof.ts`): the contractor's copy counts before it has a record, and a notice lists its mailed files.
      const proof = lienStopProof(f, { isSub: entry.isSub, mailedCopies: data.items.find((it) => it.sent_filing_id === f.id)?.mailed_copies })
      const proofDoor = proof && proofOpeners ? lienMailProofDoorPress({ jobId: entry.jobId, filingId: f.id, paper: proof.paper, served: Boolean(f.served_at), printed: lienServeStage(f, servePrinted) === 'record', ownerGap: lienMailProofOwnerGap({ name: ownerName, mailingAddress: property.owner.mailingAddress }) }, proofOpeners(f.id), () => setStopOpen(null)) : null
      return { ...none, pages: page ? [page] : [], record: { words, href: f.document_url || null, proof, proofDoor }, note: page ? 'The paper as it went out, from the record.' : null, ...extra }
    }
    const envelope = `To ${ownerName || 'the owner of record'} and ${gc?.name || 'the original contractor'} by certified mail`
    const copyEnvelope = `A copy of the filed affidavit to ${ownerName || 'the owner of record'} and ${gc?.name || 'the original contractor'}, within five days of filing`
    const kind = lienStopPaperKind(step)
    if (kind === 'notice') {
      const sent = step.monthKey ? filings.find((f) => f.kind === 'notice_53_056' && (f.months_covered ?? []).includes(step.monthKey!)) : undefined
      if (sent) return asSent(sent, `Mailed ${when(sent.filed_at, sent.created_at)}`, { envelope })
      if (step.state === 'missed' || step.fold) return { ...none, note: lienClosedNoticeStopNote(timeline.next) }
      return { ...none, envelope, act: { label: 'Open it on Monthly notices ›', onPress: () => { setStopOpen(null); onShowNotices(entry.jobId) } }, note: 'The notice is drafted and read on Monthly notices, where its pages are.' }
    }
    if (kind === 'retainage') {
      const sent = filings.find((f) => f.kind === 'retainage_53_057')
      if (sent) return asSent(sent, `Mailed ${when(sent.filed_at, sent.created_at)}`, { envelope })
      const pages = retainageStopPages({ data, jobId: entry.jobId, issuer, signerNameFor, todayYmd }) ?? []
      return { ...none, pages, envelope: pages.length ? envelope : null, note: pages.length ? null : 'No retainage is recorded on this job, so there is no § 53.057 notice to show.' }
    }
    if (kind === 'affidavit' || kind === 'serve') {
      const filed = filings.filter((f) => f.kind === 'affidavit' && f.filed_at).sort((a, b) => (b.filed_at ?? '').localeCompare(a.filed_at ?? ''))[0]
      if (filed) {
        const words = kind === 'serve' ? (filed.served_at ? `Served ${when(filed.served_at, filed.created_at)}` : `Filed ${formatYmdMonthDay(filed.filed_at!)} · a copy to the owner and the GC is still owed`) : `Filed ${formatYmdMonthDay(filed.filed_at!)}${filed.recording_number ? ` · ${filed.recording_number}` : ''}`
        return asSent(filed, words, { envelope: kind === 'serve' ? copyEnvelope : null })
      }
      return {
        pages: [{ key: 'affidavit', label: 'Page 1 of 1 · the affidavit', html: docHtml }],
        envelope: kind === 'serve' ? copyEnvelope : null,
        before: entry.gates.filter((g) => !g.ok).map((g) => ({ key: g.key, words: g.label })),
        record: null,
        act: { label: 'Open it in the Lien window ›', onPress: () => { setStopOpen(null); onOpenLienAffidavit(entry.jobId) } },
        note: kind === 'serve' ? 'Served as filed: the same affidavit, a copy in each envelope.' : null,
      }
    }
    if (kind === 'release') {
      const filed = filings.find((f) => f.kind === 'release_of_record')
      if (filed) return asSent(filed, `Released ${when(filed.filed_at, filed.created_at)}`)
      return { ...none, note: 'The release of record is made in the Release of Lien window once the job is paid.' }
    }
    if (kind === 'demand') return { ...none, note: 'The demand letter is sent from the job’s Lien window; its reply day is on the strip.' }
    return none
  }

  /** `fn` may answer with its own words and tone, which replace `done`: the send for approval says which way the leader was told. */
  const run = async (labelText: string, fn: () => Promise<void | { said: string; tone: 'success' | 'warning' }>, done: string) => {
    if (busy) return
    setBusy(true)
    busyRef.current = true
    try {
      const own = await fn()
      showToast(own ? own.said : done, own ? own.tone : 'success')
      onChanged()
    } catch (e) {
      showToast(e instanceof Error && e.message ? `${labelText}: ${e.message}` : `${labelText} failed.`, 'error')
    } finally {
      setBusy(false)
      busyRef.current = false
    }
  }
  const draftFields = () => ({ notice: buildLienNoticeFieldsForJob({ jobName: job?.job_name, jobAddress: job?.job_address, homesteadStatement: homesteadStatementApplies(property), originalContractorName: gc?.name ?? '', openBalance: claimed.claim, contactPerson: fields.claimantPersonName, issuer, todayYmd, serviceTypeName: job?.service_type?.name }), gcEmail: gc?.email ?? '', ...(entry.lastMonthFromCreation ? { monthsDatedFromCreation: true as const } : {}), ...(form === 'short' ? LIEN_AFFIDAVIT_SHORT_FORM_MARK : {}) })
  const ensureDraft = async (fromAutosave = false): Promise<string> => {
    if (!fromAutosave && autosaveRef.current) await autosaveRef.current.catch(() => undefined)
    const id = await saveLienDeskDraft({ itemId: item?.id ?? draftIdRef.current, jobId: entry.jobId, months: [entry.lastMonth], fields: draftFields(), coverNote: false, userId: authUserId, kind: 'affidavit' })
    draftIdRef.current = id
    return id
  }
  const canAutosave = office && entry.ready && (!item || item.status === 'drafted')
  useEffect(() => {
    if (draftTouch === 0 || !canAutosave) return
    const t = window.setTimeout(() => {
      if (busyRef.current) return
      const p = (async () => {
        setDraftSave('saving')
        try {
          await ensureDraft(true)
          setDraftSave('saved')
          onChanged()
        } catch (e) {
          setDraftSave('idle')
          showToast(formatErrorMessage(e, 'The draft did not save.'), 'error')
        }
      })()
      autosaveRef.current = p
      void p.finally(() => {
        if (autosaveRef.current === p) autosaveRef.current = null
      })
    }, LIEN_DRAFT_AUTOSAVE_MS)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the count is the signal; the save reads the latest state when it fires
  }, [draftTouch])
  useEffect(() => {
    if (draftSave !== 'saved') return
    const t = window.setTimeout(() => setDraftSave('idle'), 2500)
    return () => window.clearTimeout(t)
  }, [draftSave])
  const policy = gc?.policy ?? 'ask'
  const submit = () =>
    run(
      'Send for approval',
      async () => {
        const id = await ensureDraft()
        const outcome = lienAffidavitSubmitOutcome(entry, { policyFor: () => policy, promiseYmdFor: () => promise?.promisedYmd ?? null, gcHasPriorNotice: (gcId) => data.gcsWithPriorNotice.has(gcId), gcHeldBefore: (gcId) => data.gcsHeldBefore.has(gcId), todayYmd })
        await submitLienDeskItem(id, outcome)
        // The leader is told (punch list #305, v2.7180), as a notice tells him: best effort, after the write, with the last day to file. A tell that fails never undoes the send.
        if (outcome.status !== 'awaiting_approval') return
        const told = await tellLeaderOfLienAffidavits([{ itemId: id, dueYmd: entry.deadline }])
        return { said: lienAffidavitToldWords(told), tone: told && !told.ok ? 'warning' : 'success' }
      },
      policy === 'send' && !promise ? 'Approved by the standing rule — ready to file.' : 'Sent for approval.',
    )
  const sendOnWord = () => run('Send on the leader’s word', async () => void (await sendLienDeskItemOnWord(await ensureDraft(), { note: wordNote, channel: wordChannel })), 'Recorded on the leader’s word — ready to file.')
  const approve = () => run('Approve', async () => void (await approveLienDeskItem(item ? item.id : await ensureDraft())), 'Approved — ready to file.')
  const hold = (reason: 'promised' | 'call_first') => run('Hold', async () => void (item && (await holdLienDeskItem(item.id, { reason, until: holdUntilFor(reason, entry.deadline, promise?.promisedYmd ?? null, todayYmd) }))), 'Held — the desk re-asks before the window closes.')
  const pullBack = () => run('Pull back', async () => void (item && (await pullBackLienDeskItem(item.id, authUserId))), 'Back in the office’s drafts.')
  // Confirm the stand-in month (v2.7280): one update on the job, with who and when. No clock moves and no paper changes; the desk's reload reads the check back.
  const confirmMonth = () =>
    monthState.kind === 'none'
      ? undefined
      : run(
          'Confirm the month',
          async () => {
            await saveLienMonthCheck({ jobId: entry.jobId, month: monthState.month, note: checkNote, userId: authUserId, userName: authName })
            setCheckOpen(false)
          },
          `${lienMonthName(monthState.month)} is checked. No date moved and no paper changed.`,
        )
  // The earlier form to the short one, on purpose: back to a draft that carries the short form's mark, in one write, so whoever approves it reads the paper that will be filed.
  const redrawShort = () =>
    run(
      'Redraw on the short form',
      async () => {
        if (!item) return
        await redrawLienAffidavitShort(item, authUserId)
        setRedrawOpen(false)
      },
      'Redrawn on the short form. It is back in To send for Master approval and needs approval again.',
    )

  // A paper in Held because a gate closed after its approval (punch list #335), not because the leader held it.
  const gateHeld = lienAffidavitGateHeld(entry)
  // The door on the contractor's-address gate (punch list #305): the GC's own customer record.
  const contractorGcId = entry.gcCustomerId
  const contractorDoor = onFixContractor && contractorGcId ? () => onFixContractor(contractorGcId) : null
  // The facts each gate row shows after its label (v2.7313): the record's own values, and the last notice to the owner's day.
  const ownerSends = lienAffidavitOwnerSends(data.filingsByJob[entry.jobId] ?? [])
  const lastOwnerSend = ownerSends[ownerSends.length - 1]
  // Where the job's notice stands while its gate is closed (`lienAffidavitNoticeStanding.ts`): the gate row, the hold line and
  // the gates head say it, so a notice already approved and waiting to be mailed is never asked for again.
  const noticeStanding = lienAffidavitNoticeStanding(entry, data.queue.entries.find((e) => e.jobId === entry.jobId))
  const gateFacts: LienGateRowFacts = { isSub: entry.isSub, ownerName, county: property.county, legalDescription: property.legalDescription, gcName: gc?.name, gcAddress: gc?.address, noticeSentWords: lastOwnerSend ? `sent ${formatYmdMonthDay(lastOwnerSend.sentOn)}` : '', noticeStanding, leaderName }

  // The band's press (v2.7321): the kernel's act in this viewer's words. The leader approves what the office sends for approval;
  // the office waits on him once it is sent, and takes a held paper back to draft. A paper the gates hold keeps the gate's door.
  const bandAct: LienNextAct | null = (() => {
    const kernel = timeline.next.act
    if (kernel.kind !== 'footer') return null
    // Another paper is the next step: the press opens it where its own presses are.
    if (timeline.next.kind === 'retainage') return { kind: 'footer', label: 'Open it on Retainage notices ›' }
    if (timeline.next.kind !== 'affidavit') return { kind: 'footer', label: 'Open it on Monthly notices ›' }
    const waitOnLeader: LienNextAct = { kind: 'none', waiting: null, words: `Waiting on ${leaderName || 'the leader'}` }
    // Held by a gate after its approval (punch list #335): the kernel's own act stands, since nothing here is the leader's to release.
    if (gateHeld) return kernel
    switch (entry.pile) {
      case 'to_draft':
        return leader ? { kind: 'footer', label: press.approve.replace(/ ▸$/, ' ›') } : office ? kernel : waitOnLeader
      case 'awaiting':
        return leader ? kernel : waitOnLeader
      case 'held':
        return leader ? { kind: 'footer', label: 'Release the hold and approve ›' } : office ? { kind: 'footer', label: 'Back to draft ›' } : waitOnLeader
      case 'ready':
        return office ? kernel : waitOnLeader
      default:
        return kernel
    }
  })()
  /** The band's doors, each the one the footer or a gate row already holds. */
  const onBandAct = (act: LienNextActDoor) => {
    const fix = (focus: 'owner' | 'legal' | 'homestead_answer') => (onFixProperty ? onFixProperty(entry.jobId, focus) : onOpenEditJob(entry.jobId))
    switch (act) {
      case 'gate:owner':
        return fix('owner')
      case 'gate:legal':
        return fix('legal')
      case 'gate:homestead':
        return fix('homestead_answer')
      case 'gate:contractor':
        return contractorDoor ? contractorDoor() : onOpenEditJob(entry.jobId)
      case 'gate:notice':
        return onShowNotices(entry.jobId)
      case 'retainage':
        return onShowRetainage ? onShowRetainage(entry.jobId) : onOpenEditJob(entry.jobId)
      case 'serve':
        return onServe ? onServe(entry.jobId) : onOpenLienAffidavit(entry.jobId)
      case 'release':
        return onOpenLienAffidavit(entry.jobId)
      case 'legal_desk':
        return onOpenLegalDesk ? onOpenLegalDesk() : bringLienFooterUp(footerEl)
      case 'footer':
        if (timeline.next.kind === 'retainage') return onShowRetainage ? onShowRetainage(entry.jobId) : onOpenEditJob(entry.jobId)
        if (timeline.next.kind !== 'affidavit') return onShowNotices(entry.jobId)
        if (busy) return bringLienFooterUp(footerEl)
        if ((entry.pile === 'to_draft' || entry.pile === 'needs_property') && entry.ready) return leader ? approve() : office ? submit() : bringLienFooterUp(footerEl)
        if (entry.pile === 'awaiting' && leader) return approve()
        if (gateHeld) return bringLienFooterUp(footerEl)
        if (entry.pile === 'held') return leader ? approve() : office ? pullBack() : bringLienFooterUp(footerEl)
        if (entry.pile === 'ready' && office) return onOpenLienAffidavit(entry.jobId)
        return bringLienFooterUp(footerEl)
    }
  }
  // Which months the lien will cover (v2.3681), lifted out of the months section so its head can count the months worked with no notice (v2.7320); null when the pane draws no months.
  // A job with no approved clock month draws the card from the months its paper's span reads (punch list #415): until then it drew none.
  const monthRows = entry.isSub ? (() => {
    const rpcMonths = data.rows
      .filter((r) => r.job_id === entry.jobId)
      .map((r) => ({ key: r.work_month, approvedHours: Number(r.approved_hours) || 0, deadline: r.deadline, daysLeft: daysBetweenYmd(todayYmd, r.deadline) ?? 0, noticed: r.noticed, fromCreation: monthIsStandIn(r), ...(monthFromBill(r) ? { fromBill: true } : {}) }))
    const history = buildLienMonthHistory(entry.jobId, data.items, rpcMonths)
    const noHours = affidavitNoHoursSource({ lastMonthFromCreation: entry.lastMonthFromCreation, lastMonthFromBill: entry.lastMonthFromBill, lastMonthByHand: entry.lastMonthByHand, firstWorkDate: job?.first_work_date, lastWorkDate: job?.last_work_date })
    const rows = workMonths && workMonths.months.length
      ? affidavitMonthRows(workMonths.months, history)
      : noHours
        ? affidavitMonthRowsWithoutHours({ months: workMonthKeys, source: noHours, named: namedMonthKeys, history, deadlineOf: (m) => noticeDeadlineForMonth(`${m}-01`, entry.propertyKind), todayYmd })
        : []
    return rows.length ? { rows, unsecured: rows.filter((r) => r.status === 'unsecured') } : null
  })() : null
  // The pane's stacked heads (v2.7320, the owner's ask of 2026-11-15): the notice pane's grey bars, one per section, where the boxes wore a tiny caption.
  const paneRef = useRef<HTMLDivElement | null>(null)
  const paneHeads = lienAffidavitPaneSections({
    nextWords: timeline.next.words,
    gates: entry.gates,
    noticeStanding,
    window: { lastMonth: entry.lastMonth, fromCreation: Boolean(entry.lastMonthFromCreation), fromBill: Boolean(entry.lastMonthFromBill) },
    ownerCall,
    bond,
    months: monthRows ? { sworn: swornMonths, unsecured: monthRows.unsecured.length } : null,
    claimWords: formatUsdNoCents(claimed.claim),
    form,
    signer: signerNameFor(job?.master_user_id ?? null),
    monthLabel: workMonthLabel,
  })
  const heads = useLienPaneHeads({ paneRef, sections: paneHeads, phone: isMobile })
  // A row press lands on the row's open gate (v2.8472, `lienGateLanding`): the first gate not clear, in this list's order, which is the order of the row's marks.
  const gateDoors = { property: Boolean(onFixProperty), contractor: Boolean(contractorDoor) }
  useLienGateLanding({
    ask: landOnGate,
    jobId: entry.jobId,
    paneRef,
    landing: () => lienGateLanding(entry.gates.map((g) => ({ key: g.key, ok: g.ok, pressable: lienGateRow(g, gateFacts, gateDoors).door != null }))),
    at: { index: paneHeads.findIndex((h) => h.key === 'gates'), count: paneHeads.length, phone: isMobile },
  })

  // ---------- footer ----------
  // Where this job's filed copies stand (`lienServeStage.ts`), for the name on the filed footer's door.
  const filedLien = (data.filingsByJob[entry.jobId] ?? []).find((f) => f.kind === 'affidavit' && !f.voided_at && f.filed_at && !f.served_at) ?? null
  const filedCopiesStage = filedLien ? lienServeStage(filedLien, servePrinted) : 'print'
  let footer: React.ReactNode = null
  const forfeit = <span style={{ color: 'var(--text-red-600)' }}>The lien right on {label} ends {demandDate(entry.deadline)}.</span>
  if (entry.pile === 'needs_property' || entry.pile === 'needs_notice' || entry.pile === 'to_draft') {
    const blocked = !entry.ready
    const foot = lienFooter({ role: authRole, paper: 'affidavit', leaderName, blocked, route: policy === 'send' && !promise ? 'run' : 'leader' })
    footer = wordOpen ? (
      <LienWordRecordRow
        note={wordNote}
        onNote={setWordNote}
        channel={wordChannel}
        onChannel={setWordChannel}
        radioName="aff-word-channel"
        recorderName={authName}
        leaderName={leaderName}
        preview={wordRecordPreview({ leaderName, note: wordNote, channel: wordChannel, recorderName: authName, jobLabel: label, gcName: gc?.name ?? null, amountWords: formatUsdNoCents(claimed.claim) })}
        actionLabel="Approve on his word ▸"
        onAction={sendOnWord}
        actionDisabled={busy || !wordNote.trim()}
        onCancel={() => setWordOpen(false)}
        btn={btn}
      />
    ) : (
      <>
        {/* The last work month's own notice is still due (punch list #353, part 2): a line, not a gate. The owner and the attorney decide the paper. */}
        {noticeDue ? <div data-lien-affidavit-notice-due style={{ fontSize: '0.8125rem', color: 'var(--text-amber-800)', background: 'var(--bg-amber-tint)', borderRadius: 6, padding: '0.35rem 0.55rem' }}>{lienAffidavitNoticeDueLine(noticeDue, formatYmdMonthDay)}</div> : null}
        {/* One press per footer (v2.7324): the leader's own okay with the notary line, or the office's ask with one line on his phone; his word waits behind He already okayed it ▾. The line says what the press on screen will do. */}
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }} data-lien-affidavit-foot-line>
          {draftSave !== 'idle' ? <span data-lien-affidavit-saved={draftSave}>{draftSave === 'saving' ? 'Saving… ' : '✓ Saved · '}</span> : null}
          {blocked ? `Blocked until every gate above is clear.` : leader ? foot.primary?.line : policy === 'send' && !promise ? `${gc?.name ?? 'This GC'} has a standing "send" rule — approved on submit.` : promise ? `They promised ${formatYmdMonthDay(promise.promisedYmd)} — ${press.name} decides between filing and their word.` : foot.primary?.line} {forfeit}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ flex: 1 }} />
          {foot.menus.map((m) => (
            <LienFootMenu key={m.key} menu={m} disabled={busy} style={btn('plain', busy)} onPick={(k) => { if (k === 'word') { setWordNote(defaultWordNote(leaderName, demandDate(todayYmd))); setWordOpen(true) } }} />
          ))}
          {leader ? (
            <button type="button" onClick={approve} disabled={busy || blocked} style={btn('green', busy || blocked)} title={foot.primary?.line} data-lien-affidavit-approve>{press.approve}</button>
          ) : (
            <button type="button" onClick={submit} disabled={busy || blocked || !office} style={btn('primary', busy || blocked || !office)} title={foot.primary?.line} data-lien-affidavit-ask>{press.ask}</button>
          )}
        </div>
      </>
    )
  } else if (entry.pile === 'awaiting') {
    footer = leader ? (
      holdOpen ? (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem' }}>
          <span>Holds until <strong>{formatYmdMonthDay(holdUntilFor(holdOpen, entry.deadline, promise?.promisedYmd ?? null, todayYmd))}</strong>, then asks again. {forfeit}</span>
          <button type="button" onClick={() => hold(holdOpen)} disabled={busy} style={btn('amber', busy)}>Hold</button>
          <button type="button" onClick={() => setHoldOpen(null)} style={btn('plain')}>Cancel</button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" onClick={() => setHoldOpen('promised')} disabled={busy} style={btn('plain', busy)}>Hold — they promised…</button>
          <button type="button" onClick={() => setHoldOpen('call_first')} disabled={busy} style={btn('plain', busy)}>Hold — I'll call first</button>
          <button type="button" onClick={pullBack} disabled={busy} style={btn('plain', busy)}>Back to the office</button>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={approve} disabled={busy} style={btn('green', busy)}>Approve — file it ▸</button>
        </div>
      )
    ) : (
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        <span>Waiting on the leader since {item?.submitted_at ? demandDate(calendarYmdInAppTzFromIso(item.submitted_at)) : '—'}. {forfeit}</span>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={pullBack} disabled={busy || !office} style={btn('plain', busy || !office)}>Pull back to draft</button>
      </div>
    )
  } else if (entry.pile === 'ready') {
    footer = (
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        <span>
          {item?.approval_mode === 'word' ? `On ${wordRecordWords(item, leaderName).slice(3)}.` : item?.approval_mode === 'rule' ? `Approved by ${gc?.name ?? 'the GC'}'s standing rule.` : 'Approved.'} Print it for notarization, sign before a notary, file it with the County Clerk in {property.county || 'the property’s county'}, then record the filing — the Lien window does all three. {forfeit}
        </span>
        {leader && item?.approval_mode === 'word' ? <button type="button" onClick={pullBack} disabled={busy} style={btn('plain', busy)}>Not what I said</button> : null}
        <span style={{ flex: 1 }} />
        <button type="button" onClick={() => onOpenLienAffidavit(entry.jobId)} disabled={!office} style={btn('primary', !office)}>Open the affidavit tab ›</button>
      </div>
    )
  } else if (entry.pile === 'held' && gateHeld) {
    // Held by a gate that closed after the approval (punch list #335, the owner's calls of 2026-11-14 and 2026-11-16): the
    // gate's reason and its door. Nothing is the leader's to release, and his approval stands once the gate is answered.
    const gate = lienAffidavitHoldingGate(entry)
    const why = lienAffidavitFootBlockedSentence(gate).replace(/^Don't file yet\.\s*/, '')
    const fix = (focus: 'owner' | 'legal' | 'homestead_answer') => (onFixProperty ? onFixProperty(entry.jobId, focus) : onOpenEditJob(entry.jobId))
    const door: { label: string; onPress: () => void } | null =
      gate?.key === 'owner' || gate?.key === 'legal'
        ? { label: 'Fix the property record ›', onPress: () => fix(gate.key === 'owner' ? 'owner' : 'legal') }
        : gate?.key === 'homestead_answer'
          ? { label: HOMESTEAD_QUESTION_DOOR, onPress: () => fix('homestead_answer') }
          : gate?.key === 'notice'
            ? { label: 'Open it on Monthly notices ›', onPress: () => onShowNotices(entry.jobId) }
            : gate?.key === 'contractor' && contractorDoor
              ? { label: 'Add the address ›', onPress: contractorDoor }
              : null
    footer = (
      <div data-lien-affidavit-gate-held={gate?.key ?? ''} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        <span>
          Approved, and held. {why} Once that is answered the paper goes back to Ready to file by itself, and the approval stands. {forfeit}
        </span>
        <span style={{ flex: 1 }} />
        {leader && item?.approval_mode === 'word' ? <button type="button" onClick={pullBack} disabled={busy} style={btn('plain', busy)}>Not what I said</button> : null}
        {door ? <button type="button" onClick={door.onPress} disabled={!office} style={btn('primary', !office)} data-lien-affidavit-gate-door>{door.label}</button> : null}
      </div>
    )
  } else if (entry.pile === 'held') {
    footer = (
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        <span>Held{item?.hold_reason === 'promised' ? ' — they promised' : " — the leader will call first"} · asks again {item?.hold_until ? demandDate(item.hold_until) : ''}. {forfeit}</span>
        <span style={{ flex: 1 }} />
        {leader ? <button type="button" onClick={approve} disabled={busy} style={btn('green', busy)}>Release the hold and approve ▸</button> : null}
        <button type="button" onClick={pullBack} disabled={busy || !office} style={btn('plain', busy || !office)}>Back to draft</button>
      </div>
    )
  } else if (entry.pile === 'filed') {
    footer = (
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        <span>Filed{item?.sent_at ? ` ${demandDate(calendarYmdInAppTzFromIso(item.sent_at))}` : ''} · a copy must reach the owner and the contractor by the 5th day after filing (§ 53.055). {entry.openBalance > 0 ? 'Still unpaid: the account is the Legal desk’s next.' : ''}</span>
        <span style={{ flex: 1 }} />
        {/* The door reads its stage's name (`lienServeStage.ts`): *Record service ›* until v2.7798. */}
        <button type="button" data-lien-aff-serve-door onClick={() => (onServe ? onServe(entry.jobId) : onOpenLienAffidavit(entry.jobId))} style={btn('plain')}>{lienServeStageDoor(filedCopiesStage)}</button>
        {onOpenLegalDesk && entry.openBalance > 0 ? <button type="button" onClick={onOpenLegalDesk} style={btn('primary')}>Refer to the Legal desk ›</button> : null}
      </div>
    )
  } else if (entry.pile === 'missed') {
    footer = <div style={{ fontSize: '0.8125rem', color: 'var(--text-red-600)' }}>The affidavit window closed {demandDate(entry.deadline)} with nothing filed — the lien right on {label} is gone. {entry.openBalance > 0 && onOpenLegalDesk ? <button type="button" onClick={onOpenLegalDesk} style={{ ...btn('plain'), marginLeft: 8 }}>The Legal desk ›</button> : null}</div>
  }
  return (
    <>
    {footerEl && footer ? createPortal(footer, footerEl) : null}
    <div
      ref={paneRef}
      data-lien-affidavit-pane
      data-lien-pane-phone={isMobile ? 'yes' : undefined}
      onScroll={heads.onScroll}
      // The pane is the scrolling box its heads stick in (v2.7320), the notice pane's shape: its gutter is the pane's padding, which the heads cancel to run across; the one column is held to the pane's width on every screen (v2.7446).
      style={{ position: 'relative', padding: '0 1.1rem', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '0.7rem', alignContent: 'start', overflow: 'auto', minWidth: 0 }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.6rem', alignItems: 'baseline', paddingTop: isMobile ? '0.6rem' : '0.9rem' }}>
        <LienJobHeading label={label} onOpenJob={onOpenJob ? () => onOpenJob(entry.jobId) : undefined} />
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{entry.isSub ? `· GC ${gc?.name ?? ''}` : '· contracted with the owner'} {job?.job_address ? `· ${job.job_address}` : ''}</span>
        {/* Steps · Windows on the title line (v2.7317): the owner's ask, out of the timeline box's corner. */}
        {!isMobile ? <span style={{ marginLeft: 'auto', alignSelf: 'center' }}><LienTimelineViewSwitch /></span> : null}
      </div>
      {heads.head('path')}
      <div data-lien-pane-body="path">
      <div data-lien-desk-timeline style={{ ...boxStyle, padding: isMobile ? '0.5rem 0.7rem' : '0.55rem 0.8rem 0.5rem' }}>
        <LienTimelineStrip timeline={timeline} switchOutside={!isMobile} onDoor={job && 'lien_contract_ended_on' in job ? () => onOpenEditJob(entry.jobId) : undefined} onChangeLastWork={lienLastWorkDoorOffered({ office, hasJob: Boolean(job) }) ? () => setLastWorkOpen(true) : undefined} onOpenStep={(s) => setStopOpen(Math.max(0, timeline.steps.findIndex((x) => x.key === s.key)))} onAct={onBandAct} act={bandAct} />
        {/* The press under LAST WORK (v2.7684): the window the notice pane's Change › line saves through, opened here on the job's day. */}
        {lastWorkOpen && job ? (
          <LienLastWorkDayWindow
            jobId={entry.jobId}
            job={job}
            todayYmd={todayYmd}
            userId={authUserId}
            onSaved={onLastWorkChanged ?? onChanged}
            onClose={() => setLastWorkOpen(false)}
            jobLabel={label}
            clockMonths={(workMonths?.months ?? []).map((m) => m.key)}
            noticedMonths={namedMonthKeys}
            affidavitMonths={lienLastWorkAffidavitMonths(entry)}
            propertyKind={entry.propertyKind}
          />
        ) : null}
        {stopOpen != null ? (
          <LienStopPaperWindow
            steps={timeline.steps}
            index={stopOpen}
            onIndex={setStopOpen}
            onClose={() => setStopOpen(null)}
            jobLabel={label}
            paperFor={stopPaperFor}
            timeline={timeline}
            holdFor={(step) => {
              // The hold line (v2.4806): the affidavit's first gate not clear, with the property record's door where that is the fix.
              if ((step.kind !== 'affidavit' && step.kind !== 'serve') || step.state === 'done' || step.state === 'missed') return null
              const gate = entry.gates.find((g) => !g.ok) ?? null
              if (!gate) return null
              const fix = onFixProperty && (gate.key === 'owner' || gate.key === 'legal') ? { label: 'Fix the property record ›', onPress: () => { setStopOpen(null); onFixProperty(entry.jobId, gate.key === 'owner' ? 'owner' : 'legal') } } : onFixProperty && gate.key === 'homestead_answer' ? { label: HOMESTEAD_QUESTION_DOOR, onPress: () => { setStopOpen(null); onFixProperty(entry.jobId, 'homestead_answer') } } : gate.key === 'notice' ? { label: 'Open it on Monthly notices ›', onPress: () => { setStopOpen(null); onShowNotices(entry.jobId) } } : gate.key === 'contractor' && contractorDoor ? { label: 'Add the address ›', onPress: () => { setStopOpen(null); contractorDoor() } } : null
              return { words: lienAffidavitFootBlockedSentence(gate, { noticeStanding, leader: leaderName }), short: lienAffidavitGateShortWords(gate, { noticeStanding }), act: fix }
            }}
          />
        ) : null}
      </div>
      </div>
      {heads.head('gates')}
      <div data-lien-pane-body="gates" data-lien-affidavit-gates style={{ display: 'grid', gap: '0.35rem' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }} data-lien-affidavit-window>{lienAffidavitWindowWords({ lastMonth: entry.lastMonth, fromCreation: Boolean(entry.lastMonthFromCreation), fromBill: Boolean(entry.lastMonthFromBill) }, workMonthLabel)}</div>
        {/* Every row is a press (v2.7313, `lienGateRow`): it opens the fact's own home at the right line. A failed gate keeps its named door; a passed one shows its fact and ends in Change ›. */}
        <div style={{ display: 'grid', gap: '0.15rem' }}>
          {entry.gates.map((g) => {
            const row = lienGateRow(g, gateFacts, gateDoors)
            const open =
              row.door === 'property_owner' || row.door === 'property_legal' || row.door === 'property_homestead'
                ? () => (onFixProperty ? onFixProperty(entry.jobId, row.door === 'property_owner' ? 'owner' : row.door === 'property_legal' ? 'legal' : 'homestead_answer') : onOpenEditJob(entry.jobId))
                : row.door === 'contractor' && contractorDoor
                  ? contractorDoor
                  : row.door === 'notices'
                    ? () => onShowNotices(entry.jobId)
                    : null
            return (
              <button
                key={g.key}
                type="button"
                className="lienGateRow"
                onClick={open ?? undefined}
                disabled={!open}
                title={row.title || undefined}
                data-lien-gate-row={g.key}
                data-lien-gate-ok={g.ok ? 'yes' : 'no'}
                {...(!g.ok && g.key === 'homestead_answer' ? { 'data-lien-affidavit-homestead-door': '' } : {})}
                {...(!g.ok && g.key === 'contractor' && contractorDoor ? { 'data-lien-affidavit-contractor-door': '' } : {})}
              >
                <span aria-hidden="true" style={{ fontWeight: 700, color: g.ok ? 'var(--text-green-800)' : 'var(--text-red-600)' }}>{g.ok ? '✓' : '✗'}</span>
                <span className="lienGateWords">{g.label}{row.fact ? ` — ${row.fact}` : ''}</span>
                {open ? <span className="lienGateDoor" data-open={g.ok ? 'yes' : 'no'}>{row.doorWords}</span> : null}
              </button>
            )
          })}
        </div>
        {/* A month from a bill or the job's creation (v2.7224): a question with two doors (v2.7280), never a hold. Confirmed, the quiet line with Change ›. */}
        {monthState.kind !== 'none' && checkOpen ? (
          <div data-lien-affidavit-month-check-ask style={{ fontSize: '0.78rem', color: 'var(--text-amber-800)', background: 'var(--bg-amber-tint)', border: '1px solid var(--border-strong)', borderRadius: 8, padding: '0.5rem 0.65rem', display: 'grid', gap: '0.4rem' }}>
            <strong>{lienMonthAskWords(monthState.month)}</strong>
            <input
              type="text"
              value={checkNote}
              onChange={(e) => setCheckNote(e.target.value)}
              placeholder={LIEN_MONTH_CHECK_NOTE_HINT}
              aria-label={lienMonthAskWords(monthState.month)}
              autoFocus
              style={{ font: 'inherit', padding: '5px 8px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-700)', width: '100%', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button type="button" data-lien-affidavit-month-confirm onClick={confirmMonth} disabled={busy || Boolean(lienMonthCheckProblem(checkNote))} style={btn('primary', busy || Boolean(lienMonthCheckProblem(checkNote)))}>{lienMonthConfirmWords(monthState.month)}</button>
              <button type="button" onClick={() => setCheckOpen(false)} style={btn('plain')}>{LIEN_MONTH_CHECK_CANCEL_WORDS}</button>
            </div>
            <span style={{ color: 'var(--text-muted)' }}>{LIEN_MONTH_CHECK_SAVES_WORDS}</span>
          </div>
        ) : monthState.kind === 'checked' ? (
          <div data-lien-affidavit-month-checked style={{ fontSize: '0.78rem', color: 'var(--text-muted)', background: 'var(--bg-muted)', borderRadius: 6, padding: '0.35rem 0.55rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ flex: 1, minWidth: 0 }}>{lienMonthCheckedWords(monthState.check, formatYmdMonthDay)}</span>
            {office ? <button type="button" data-lien-affidavit-month-change onClick={() => { setCheckNote(monthState.check.note); setCheckOpen(true) }} disabled={busy} style={{ ...btn('plain', busy), padding: '1px 8px', fontSize: '0.72rem' }}>{LIEN_MONTH_CHECK_CHANGE_WORDS}</button> : null}
          </div>
        ) : monthState.kind === 'flag' ? (
          <div data-lien-affidavit-month-stand-in style={{ fontSize: '0.78rem', color: 'var(--text-amber-800)', background: 'var(--bg-amber-tint)', borderRadius: 6, padding: '0.35rem 0.55rem', display: 'grid', gap: '0.4rem' }}>
            <span>{lienMonthQuestion(monthState.source, monthState.month)}</span>
            {office ? (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <button type="button" data-lien-affidavit-month-yes onClick={() => { setCheckNote(''); setCheckOpen(true) }} disabled={busy} style={btn('amber', busy)}>{lienMonthYesWords(monthState.month)}</button>
                {onOpenLastWork ? <button type="button" data-lien-affidavit-month-last-work onClick={() => onOpenLastWork(entry.jobId)} disabled={busy} style={btn('plain', busy)}>{LIEN_MONTH_SET_LAST_DAY_WORDS}</button> : null}
              </div>
            ) : (
              <span>{LIEN_MONTH_FLAG_DOOR_WORDS}</span>
            )}
          </div>
        ) : null}
        {noticeCheckLines.length > 0 ? (
          <div data-lien-affidavit-notice-check style={{ fontSize: '0.78rem', color: 'var(--text-amber-800)', background: 'var(--bg-amber-tint)', borderRadius: 6, padding: '0.35rem 0.55rem', display: 'grid', gap: '0.15rem' }}>
            <strong>{LIEN_NOTICE_CHECK_LEAD}</strong>
            {noticeCheckLines.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
        ) : null}
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Claim: <strong style={{ color: 'var(--text-700)' }}>{formatUsdNoCents(claimed.claim)}</strong>{claimed.corrected ? <span style={{ color: 'var(--text-amber-800)' }}> set by hand{claimDeltaWords(claimed.delta, entry.openBalance) ? `, ${claimDeltaWords(claimed.delta, entry.openBalance)}` : ''}</span> : <> unpaid of {formatUsdNoCents(Number(job?.revenue ?? 0))}</>} · {entry.propertyKind === 'residential' ? 'residential (3rd-month window)' : entry.propertyKind ? 'commercial (4th-month window)' : 'property kind unknown — commercial window shown'}
        </div>
      </div>
      {/* The owner's answers and counsel's pile (v2.3767): what the call said, which pile the affidavit is in, and the bond. */}
      {(() => {
        const pile = affidavitPileFor(ownerCall)
        const tone = pile === 'A' ? chip('var(--bg-green-tint)', 'var(--text-green-800)') : pile === 'B' ? chip('var(--bg-amber-tint)', 'var(--text-amber-800)') : chip('var(--bg-red-tint)', 'var(--text-red-600)')
        const hold = ownerCall?.originalContractCompletedOn ? reservationHoldEndsOn(ownerCall.originalContractCompletedOn) : ''
        return (
          <>
          {heads.head('owner')}
          <div data-lien-pane-body="owner" data-lien-affidavit-owner-answers data-pile={pile ?? 'none'} style={{ display: 'grid', gap: '0.35rem' }}>
            {ownerCall ? (
              <div style={{ fontSize: '0.8125rem', display: 'grid', gap: '0.25rem' }}>
                <div>{ownerCallWords(ownerCall, formatYmdMonthDay, formatUsdNoCents)}{ownerCall.originalContractCompletedOn ? ` · their contract completed ${formatYmdMonthDay(ownerCall.originalContractCompletedOn)}${hold ? ` · the 10% hold (§ 53.101) ends ${formatYmdMonthDay(hold)}` : ''}` : ' · their contract still open'}{ownerCall.note ? ` · “${ownerCall.note}”` : ''}</div>
                {pile ? (
                  <div><span style={tone}>Pile {pile} · {AFFIDAVIT_PILE_WORDS[pile].short}</span> <span style={{ color: 'var(--text-muted)' }}>{AFFIDAVIT_PILE_WORDS[pile].next}.</span></div>
                ) : (
                  <div style={{ color: 'var(--text-muted)' }}>The answers do not say which pile yet — ask the two questions again.</div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span>No call recorded yet. The letter invites it; the three answers sort this job into counsel's piles.</span>
                {entry.isSub ? <button type="button" onClick={() => onShowNotices(entry.jobId)} style={{ ...btn('plain'), padding: '1px 8px', fontSize: '0.72rem' }}>Record it on the notice ›</button> : null}
              </div>
            )}
            <div style={{ fontSize: '0.75rem', color: bond === 'yes' ? 'var(--text-amber-800)' : 'var(--text-muted)', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }} data-lien-affidavit-bond={bond}>
              <span>{bond === 'yes' ? 'Payment bond on the project — calendar the bond claim the same day as the affidavit.' : bond === 'no' ? 'No payment bond on the project.' : 'Payment bond: unknown — check the project before telling the owner to hold 10%.'}</span>
              {onOpenLienContract ? <button type="button" onClick={() => onOpenLienContract(entry.jobId)} style={{ ...btn('plain'), padding: '1px 8px', fontSize: '0.72rem' }}>{bond === 'unknown' ? 'Check the project ›' : 'Change ›'}</button> : null}
            </div>
          </div>
          </>
        )
      })()}
      {/* Which months the lien will cover (v2.3681): a month whose notice window closed with nothing sent is worked but unsecured — named here, left off the lien, never re-dated. */}
      {monthRows ? (() => {
        const { rows, unsecured } = monthRows
        const tone = (s: (typeof rows)[number]['status']) => (s === 'lien' ? chip('var(--bg-green-tint)', 'var(--text-green-800)') : s === 'open' ? chip('var(--bg-blue-tint)', 'var(--text-blue-800)') : chip('var(--bg-amber-tint)', 'var(--text-amber-800)'))
        const word = (s: (typeof rows)[number]['status']) => (s === 'lien' ? 'on the lien' : s === 'open' ? 'window open' : 'unsecured')
        return (
          <>
          {heads.head('months')}
          <div data-lien-pane-body="months" data-lien-affidavit-months style={{ display: 'grid', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>The lien covers the months a § 53.056 notice went out for. It must state each month the work was performed.</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto', gap: '0.3rem 0.8rem', alignItems: 'baseline', fontSize: '0.8125rem' }}>
              {rows
                .filter((r) => r.status !== 'unsecured')
                .map((r) => (
                  <div key={r.key} style={{ display: 'contents' }}>
                    <strong>{workMonthLabel(r.key)}</strong>
                    {/* A confirmed stand-in month (v2.7280) reads *from the bill · checked Nov 14* where it read *dated from the bill · no clock hours*. */}
                    <span style={{ minWidth: 0 }}>{monthChecked && r.key === monthChecked.month ? lienMonthCheckedRowWords(r.words, monthChecked, formatYmdMonthDay) : r.words}</span>
                    <span style={tone(r.status)}>{word(r.status)}</span>
                  </div>
                ))}
            </div>
            {unsecured.length ? (
              <div style={{ display: 'grid', gap: '0.3rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
                <span style={rowGroupHead}>Worked, not noticed</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto', gap: '0.3rem 0.8rem', alignItems: 'baseline', fontSize: '0.8125rem' }}>
                  {unsecured.map((r) => (
                    <div key={r.key} style={{ display: 'contents' }}>
                      <strong style={{ color: 'var(--text-muted)' }}>{workMonthLabel(r.key)}</strong>
                      <span style={{ minWidth: 0, color: 'var(--text-600)' }}>{r.words}</span>
                      <span style={tone(r.status)}>{word(r.status)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {/* The months set by hand (v2.7270): the line that says what is set, or the press that opens the editor; a sub job only. */}
            {entry.isSub ? (
              <LienAffidavitMonthsByHandEditor
                key={byHand ? `${byHand.setAt}:${byHand.months.join(',')}` : 'none'}
                current={byHand}
                work={workMonthKeys}
                named={namedMonthKeys}
                canEdit={office}
                busy={busy}
                onSave={(input) => run('Set the months by hand', async () => { await saveLienAffidavitMonthsByHand({ jobId: entry.jobId, months: input.months, reason: input.reason, userId: authUserId, userName: authName }); touchDraft() }, 'The paper names the months set by hand.')}
                onClear={() => run('Clear the months set by hand', async () => { await clearLienAffidavitMonthsByHand(entry.jobId); touchDraft() }, 'Back to the months the record names.')}
              />
            ) : null}
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {affidavitMonthsSentence(rows, workMonthLabel)}
              {correction ? (
                <span data-lien-affidavit-claim>
                  {' '}
                  <strong style={{ color: 'var(--text-700)' }}>The affidavit claims {formatUsdNoCents(claimed.claim)}</strong> — the app’s {formatUsdNoCents(entry.openBalance)} {correction.amountOff < 0 ? 'plus' : 'less'} the {correction.carry ? 'carried ' : ''}{formatUsdNoCents(Math.abs(correction.amountOff))} <span style={{ color: 'var(--text-amber-800)' }}>(set by hand, {correctionSetWords(correction, formatYmdMonthDay)})</span>.
                </span>
              ) : null}
            </div>
          </div>
          </>
        )
      })() : null}
      {heads.head('paper')}
      <div data-lien-pane-body="paper" style={{ display: 'grid', gap: '0.7rem', paddingBottom: '0.9rem' }}>
      {form === 'long' && item ? (
        <div data-lien-affidavit-form="long" style={{ ...boxStyle, fontSize: '0.8125rem' }}>
          {redrawOpen ? (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span>The affidavit goes back to To send for Master approval on the short form. It needs approval again before it is filed.</span>
              <span style={{ flex: 1 }} />
              <button type="button" onClick={redrawShort} disabled={busy} style={btn('amber', busy)}>Redraw on the short form</button>
              <button type="button" onClick={() => setRedrawOpen(false)} style={btn('plain')}>Cancel</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>{LIEN_AFFIDAVIT_LONG_FORM_WORDS}</span>
              <span style={{ flex: 1 }} />
              <button type="button" onClick={() => setRedrawOpen(true)} disabled={busy || !office} style={btn('plain', busy || !office)}>Redraw on the short form…</button>
            </div>
          )}
        </div>
      ) : null}
      <div data-theme="light" data-lien-affidavit-paper={form} style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '1.1rem 1.4rem', overflowX: 'auto' }}>
        <div dangerouslySetInnerHTML={{ __html: docHtml }} />
      </div>
      </div>
    </div>
    </>
  )
}
