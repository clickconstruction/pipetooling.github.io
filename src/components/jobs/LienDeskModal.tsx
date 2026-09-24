import { useEffect, useMemo, useRef, useState } from 'react'
import type { PhysicalInvoiceIssuer } from '../../lib/physicalInvoiceIssuer'
import { buildLienNoticeBlocks, filingDocHtml, filingLetterheadFromIssuer, type FilingDocExtras, type FilingFieldMark, type LienNoticeFields } from '../../lib/jobsDocuments/lienFilingDocuments'
import { LIEN_NOTICE_FIELD_GUIDE, LIEN_NOTICE_PREVIEW_EDIT_MESSAGE, LIEN_NOTICE_PREVIEW_MESSAGE, LIEN_NOTICE_PREVIEW_SAVE_MESSAGE, applyWordingEdits, buildLienNoticePreviewHtml, isTypedNoticeField, lienNoticePreviewPages, noticeWordingDiff, wordingLineText, type LienNoticeFieldKey } from '../../lib/jobs/lienNoticePreview'
import { demandDate, demandMoney } from '../../lib/jobsDocuments/demandLetter'
import { defaultSignoffAsk, signoffWords, type LegalSignoffState } from '../../lib/legal/legalAsks'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { LienRulesDoor } from './LienRulesDoor'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { lienPropertyOwnerDisplayName, resolveLienProperty } from '../../lib/jobs/lienProperty'
import { workMonthLabel, workMonthShort, type JobWorkMonths } from '../../lib/jobs/forecastWorkMonths'
import {
  LIEN_ASK_REASON_LABELS,
  LIEN_DESK_PILES,
  LIEN_NOTICE_POLICIES,
  PUBLIC_OWNER_DESK_SENTENCE,
  draftReadiness,
  holdUntilFor,
  canSendLienOnWord,
  isLienLeader,
  isLienOffice,
  ruleWaitsOnFirstNotice,
  submitOutcome,
  type LienAskReason,
  type LienDeskEntry,
  type LienDeskPile,
  type LienNoticePolicy, DATED_FROM_CREATION_WORDS } from '../../lib/jobs/lienDesk'
import {
  approveLienDeskItem,
  holdLienDeskItem,
  pullBackLienDeskItem,
  saveLienDeskDraft,
  sendLienDeskItemOnWord,
  setCustomerLienNoticePolicy,
  skipLienDeskItem,
  noteLienWindowMissed,
  submitLienDeskItem,
  noteGcAuthorizedDirectPay,
  startLetterTwo,
  noteOwnerCall,
} from '../../lib/jobs/lienDeskIo'
import { wordRecordBlock, wordRecordWords, type LienWordChannel } from '../../lib/jobs/lienWord'
import { LienWordRecordRow } from './LienWordRecordRow'
import { buildLienNoticeFieldsForJob, describeNoticeMonths, homesteadStatementApplies, lienNoticeCoverNote, parseLienDeskDraftFields, type LienDeskDraftFields } from '../../lib/jobs/lienNoticeDraft'
import type { LienDeskData, LienDeskJob } from '../../hooks/useLienDeskData'
import { useNoticePayPage } from '../../hooks/useNoticePayPage'
import { payPageBlocks, payPageSummary } from '../../lib/jobs/lienNoticePayPage'
import { useToastContext } from '../../contexts/ToastContext'
import { useIsMobile } from '../../hooks/useIsMobile'
import { buildLienDeskRun, buildLienRetainageRun, runCoverNoteBlocks } from '../../lib/jobs/lienDeskRun'
import { affidavitMonthWord, coverLetterKindFor, fillCoverLetter, letterTwoTemplate } from '../../lib/jobs/gcOnNotice'
import { LETTER_TWO_KINDS, letterTwoIsDue, letterTwoKindLabel, type LetterTwoKind } from '../../lib/jobs/lienLetterTwo'
import { AFFIDAVIT_PILE_WORDS, affidavitPileFor, ownerCallWords } from '../../lib/jobs/lienOwnerCall'
import { parsePaymentBond } from '../../lib/jobs/lienDeskRetainage'
import LienOwnerCallDialog from './LienOwnerCallDialog'
import LienDeskRunModal from './LienDeskRunModal'
import LienDeskAffidavitPane, { affidavitDeadlineWords } from './LienDeskAffidavitPane'
import LienDeskRetainagePane from './LienDeskRetainagePane'
import { LIEN_RETAINAGE_PILES, contractEndedWords, retainageDeadlineWords, type LienRetainagePile } from '../../lib/jobs/lienDeskRetainage'
import { retainageInsideClaim } from '../../lib/jobs/lienNoticeDraft'
import LienDeskOwnerPane from './LienDeskOwnerPane'
import LienDeskGates from './LienDeskGates'
import LienDeskMonths, { type LienDeskMonthCard } from './LienDeskMonths'
import LienNoticeByHandPane from './LienNoticeByHandPane'
import { buildLienMonthGrid } from '../../lib/jobs/lienMonthGrid'
import { buildLienTimelineFromDesk, lienRetainageClockFromDesk } from '../../lib/jobs/lienTimelineDesk'
import LienTimelineStrip from './LienTimelineStrip'
import LienDeskTimelineTab from './LienDeskTimelineTab'
import { useLienTimelineBook } from '../../hooks/useLienTimelineBook'
import { lienGridHtml, type LienBookShow, type LienTimelineBookRow } from '../../lib/jobs/lienTimelineBook'
import { printHtmlInNewWindow } from '../../lib/bidDocuments/htmlDoc'
import { buildLienDeskGates, lienGateMonthLine, ownerSourceWords, propertyKindClockWords, type LienGate, type LienGateKey } from '../../lib/jobs/lienDeskGates'
import { rollMailingLines } from '../../lib/jobs/rollMailingLines'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { txCountyCadPropertyUrl, txCountyCadSearchUrl } from '../../lib/txCountyLookup'
import PropertyKindSwitch from './PropertyKindSwitch'
import LienClaimBox from './LienClaimBox'
import { claimDeltaWords, claimSplit, claimSplitWords, correctedClaim, correctionGateWords, correctionNeedsLook, correctionSendGate, correctionSetWords } from '../../lib/jobs/lienClaimCorrection'
import { clearLienClaimCorrection, lookLienClaimCorrection, saveLienClaimCorrection } from '../../lib/jobs/lienClaimCorrectionIo'
import { jobsSharingProperty, normalizePropertyKind, propertyKindWords, sharedPropertyWords, type PropertyKind } from '../../lib/jobs/propertyKind'
import { savePropertyKind } from '../../lib/jobs/propertyKindWrite'
import { formatErrorMessage } from '../../utils/errorHandling'
import { LIEN_AFFIDAVIT_PILES, type LienAffidavitPile } from '../../lib/jobs/lienDeskAffidavits'

/**
 * The Lien desk: the queue of § 53.056 notices the law says are due per
 * unpaid work month on sub jobs. The office readies (owner of record) and
 * drafts; the leader approves — once per GC with a standing rule, or per
 * item — or the office sends on his spoken word with a note; approved
 * notices go out and are recorded (the run, PR 3; until then the Lien
 * window's notice tab). Doors: the Dashboard's Needs you cards, the
 * Collections header, the Pipeline's tools menus, the forecast's Send
 * notice…, and `?liendesk=1`.
 */

export type LienDeskModalProps = {
  open: boolean
  onClose: () => void
  data: LienDeskData | null
  loading: boolean
  todayYmd: string
  authRole: string | null
  authUserId: string | null
  /** The office's display name, for the spoken-word note. */
  authName: string
  /** Evidence per job — the forecast's work-months kernel over the desk's jobs. */
  workMonths: Record<string, JobWorkMonths> | null
  issuer: PhysicalInvoiceIssuer | null
  /** The signer's "Full name and title" for a job's master (else the session name) — the notice's contact person. */
  signerNameFor: (masterUserId: string | null) => string
  /** The signer's own phone for the cover letters' `{{phone}}` (v2.3753); the letterhead's when he has none. */
  signerPhoneFor?: (masterUserId: string | null) => string
  /** Land on this job's item when given (the forecast's Send notice…, the row icon). */
  initialJobId?: string | null
  /** Re-read after any write. */
  onChanged: () => void
  /** "Find the owner" — Edit Job → Property record. */
  /** `focus` opens Edit Job on its Property record row — where the property kind is set (v2.3667). */
  onOpenEditJob: (jobId: string, focus?: 'property-record' | 'gc' | 'lien-contract') => void
  /** A plain value's door to Settings → Company (v2.3697): the claimant's name or address, landed on and ringed. */
  onOpenCompanySettings?: (field: 'companyName' | 'addressText') => void
  /** The send door until the run ships: the Lien window on its notice tab. */
  onOpenLienInstruments: (jobId: string) => void
  /** Affidavits (v2.3412): the Lien window on its affidavit tab — print for notarization, file, record. */
  onOpenLienAffidavit?: (jobId: string) => void
  /** A filed affidavit still unpaid → the Legal desk. */
  onOpenLegalDesk?: () => void
  /** Counsel's sign-off on a sent notice (#41 PR 3): the job's state on the firm's matter, and the ask. Absent when the board has no legal matters. */
  legalSignoff?: { stateFor: (jobId: string) => LegalSignoffState | null; ask: (jobId: string, text: string) => Promise<string | null> } | null
  /** Open on the affidavit kind (the Dashboard's filing-window card), the retainage kind (v2.3753) or the Timeline tab (v2.3768). */
  initialKind?: 'notice' | 'affidavit' | 'retainage' | 'timeline'
  /** Open on a pile — the Dashboard's missed-window line lands on the Missed lens (v2.3679). */
  initialPile?: LienDeskPile | null
  /** Put a GC on notice (v2.3470): the header door — every owner on every job with this GC, one approved run. */
  onPutGcOnNotice?: (gcId: string) => void
}

const PILE_ORDER: LienDeskPile[] = ['needs_owner', 'to_draft', 'awaiting', 'ready', 'held', 'sent', 'missed']

const isLeader = isLienLeader
const isOffice = isLienOffice
const canSendOnWord = canSendLienOnWord

function jobLabel(j: LienDeskJob | undefined, jobId: string): string {
  if (!j) return jobId.slice(0, 8)
  const number = effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—'
  const name = (j.job_name ?? '').trim()
  return name ? `${number} · ${name}` : number
}

function severityColors(sev: LienDeskEntry['severity']): { bg: string; fg: string } {
  if (sev === 'red') return { bg: 'var(--bg-red-tint)', fg: 'var(--text-red-600)' }
  if (sev === 'amber') return { bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-800)' }
  return { bg: 'var(--bg-subtle)', fg: 'var(--text-muted)' }
}

function deadlineWords(e: LienDeskEntry): string {
  if (e.daysLeft == null || !e.earliestDeadline) return e.missedMonths.length ? 'window closed' : ''
  if (e.daysLeft < 0) return 'window closed'
  if (e.daysLeft === 0) return 'due today'
  if (e.daysLeft === 1) return 'due tomorrow'
  if (e.daysLeft <= 14) return `due in ${e.daysLeft}d`
  return `by ${formatYmdMonthDay(e.earliestDeadline)}`
}

const chip = (bg: string, fg: string): React.CSSProperties => ({
  display: 'inline-block',
  padding: '0 6px',
  borderRadius: 5,
  fontSize: '0.68rem',
  fontWeight: 600,
  lineHeight: '18px',
  whiteSpace: 'nowrap',
  background: bg,
  color: fg,
  verticalAlign: 'middle',
})
/** Filled buttons carry a white label, so the fill is a literal that holds in both themes — the `--text-*` tokens go pale in dark mode and the label with them. */
const FILL = { primary: '#2563eb', green: '#166534', amber: '#92400e' } as const
const btn = (kind: 'primary' | 'green' | 'amber' | 'plain' = 'plain', disabled = false): React.CSSProperties => ({
  padding: '5px 10px',
  borderRadius: 7,
  border: `1px solid ${kind === 'plain' ? 'var(--border-strong)' : 'transparent'}`,
  background: kind === 'plain' ? 'var(--surface)' : FILL[kind],
  color: kind === 'plain' ? 'var(--text-700)' : '#fff',
  fontSize: '0.8125rem',
  fontWeight: 600,
  cursor: disabled ? 'default' : 'pointer',
  opacity: disabled ? 0.55 : 1,
  whiteSpace: 'nowrap',
})
const boxStyle: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 9, padding: '0.6rem 0.75rem', display: 'grid', gap: '0.35rem', background: 'var(--surface)' }
const boxHead: React.CSSProperties = { fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }
/** The paper stays light in both themes — `data-theme="light"` re-pins the tokens and the text color (index.css). */
const paperStyle: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '1.1rem 1.4rem' }
const linkBtn: React.CSSProperties = { border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: '0.78rem', fontWeight: 600, padding: 0, whiteSpace: 'nowrap' }
/** How far into the pane the gates scroll away and the one-line strip takes over (v2.3522). */
const STRIP_COLLAPSE_PX = 72

export default function LienDeskModal({
  open,
  onClose,
  data,
  loading,
  todayYmd,
  authRole,
  authUserId,
  authName,
  workMonths,
  issuer,
  signerNameFor,
  signerPhoneFor,
  initialJobId,
  onChanged,
  onOpenEditJob,
  onOpenLienInstruments,
  onOpenLienAffidavit,
  onOpenLegalDesk,
  legalSignoff,
  initialKind,
  initialPile,
  onPutGcOnNotice,
  onOpenCompanySettings,
}: LienDeskModalProps) {
  const { showToast } = useToastContext()
  const isMobile = useIsMobile()
  const leader = isLeader(authRole)
  const office = isOffice(authRole)
  const [gcPickerOpen, setGcPickerOpen] = useState(false)
  /** The GCs on the desk right now, by open dollars — the picker behind Put a GC on notice… (v2.3470). */
  const gcPickerOptions = useMemo(() => {
    const by = new Map<string, { id: string; name: string; jobs: number; open: number; policy: LienNoticePolicy }>()
    for (const e of data?.queue.entries ?? []) {
      if (!e.gcCustomerId || e.pile === 'sent') continue
      const g = data?.gcsById[e.gcCustomerId]
      const cur = by.get(e.gcCustomerId) ?? { id: e.gcCustomerId, name: g?.name || 'GC', jobs: 0, open: 0, policy: e.policy }
      cur.jobs += 1
      cur.open += e.openBalance
      by.set(e.gcCustomerId, cur)
    }
    return [...by.values()].sort((a, b) => b.open - a.open)
  }, [data])
  const [pile, setPile] = useState<LienDeskPile | null>(initialPile ?? null)
  useEffect(() => {
    if (open && initialPile) setPile(initialPile)
  }, [open, initialPile])
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [checkedMonths, setCheckedMonths] = useState<ReadonlySet<string> | null>(null)
  const [coverNote, setCoverNote] = useState(true)
  const [wordOpen, setWordOpen] = useState(false)
  const [wordNote, setWordNote] = useState('')
  const [wordChannel, setWordChannel] = useState<LienWordChannel>('phone')
  const [skipOpen, setSkipOpen] = useState(false)
  // Record a notice that already went out (#35 PR 2): the paper was printed here and mailed by hand.
  const [byHandOpen, setByHandOpen] = useState(false)
  /** Counsel's sign-off ask on a sent notice (#41 PR 3). */
  const [signoffOpen, setSignoffOpen] = useState(false)
  const [signoffText, setSignoffText] = useState('')
  const [skipReason, setSkipReason] = useState('')
  const [holdOpen, setHoldOpen] = useState<'promised' | 'call_first' | null>(null)
  const [rulePick, setRulePick] = useState<LienNoticePolicy | null>(null)
  const [busy, setBusy] = useState(false)
  const [mobileListShown, setMobileListShown] = useState(true)
  // Wording (v2.3522): the four typed values the office may shape, layered over the draft; the paper-first pane's scroll state.
  const [wordingEdits, setWordingEdits] = useState<Partial<LienNoticeFields>>({})
  const previewWinRef = useRef<Window | null>(null)
  const [previewJobId, setPreviewJobId] = useState<string | null>(null)
  // The paper is the editor (v2.3694): the value being typed, where it sits on the paper, and the font it wears there.
  const [editing, setEditing] = useState<{ key: LienNoticeFieldKey; value: string; rect: { top: number; left: number; width: number; height: number }; font: string } | null>(null)
  const paperRef = useRef<HTMLDivElement | null>(null)
  const editInputRef = useRef<HTMLInputElement | null>(null)
  // A plain value's door (v2.3697): remember what it read when the office left, ring it on the paper when it comes back changed.
  const sourceTripRef = useRef<{ field: LienNoticeFieldKey; before: string } | null>(null)
  const [ringField, setRingField] = useState<LienNoticeFieldKey | null>(null)
  const [claimOpenSignal, setClaimOpenSignal] = useState(0)
  const [paneScrolled, setPaneScrolled] = useState(false)
  const paneRef = useRef<HTMLDivElement | null>(null)
  // The gate being brought up (v2.3670): a cell click or the footer's Go to gate rings the cell and its section for 4s.
  const [activeGate, setActiveGate] = useState<{ key: LienGateKey; at: number } | null>(null)
  useEffect(() => {
    if (!activeGate) return
    const t = window.setTimeout(() => setActiveGate(null), 4000)
    return () => window.clearTimeout(t)
  }, [activeGate])
  const pickGate = (key: LienGateKey) => setActiveGate({ key, at: Date.now() })
  // Gate 3's switch writes the property's kind in place (v2.3670) — the same column the property sheet and Edit Job write.
  const [kindBusy, setKindBusy] = useState(false)
  // The run (v2.3410): every approved notice as one packet + one tracking form.
  const [runOpen, setRunOpen] = useState(false)
  // The kind (v2.3412): notices per month, or the one affidavit per job.
  const [kind, setKind] = useState<'notice' | 'affidavit' | 'retainage' | 'timeline'>(initialKind ?? 'notice')
  // The Timeline tab (v2.3768): the book is read the first time the tab opens and kept for the modal's life.
  const [bookOpened, setBookOpened] = useState(initialKind === 'timeline')
  // The desk stays mounted between opens, so a door's kind (the Dashboard's filing-window card, `?kind=timeline`) lands on each open, not only the first (v2.3781).
  const wasOpenRef = useRef(open)
  useEffect(() => {
    if (open && !wasOpenRef.current) setKind(initialKind ?? 'notice')
    wasOpenRef.current = open
  }, [open, initialKind])
  const [bookGcId, setBookGcId] = useState<string | null>(null)
  const [bookShow, setBookShow] = useState<LienBookShow>('due')
  useEffect(() => {
    if (kind === 'timeline') setBookOpened(true)
  }, [kind])
  const { book, loading: bookLoading, error: bookError } = useLienTimelineBook(open && bookOpened && data != null, todayYmd, data?.items ?? null)
  const [affPile, setAffPile] = useState<LienAffidavitPile | null>(null)
  // The retainage kind (v2.3753): the one § 53.057 notice per job with recorded retainage.
  const [retPile, setRetPile] = useState<LienRetainagePile | null>(null)
  const [retSelectedJobId, setRetSelectedJobId] = useState<string | null>(null)
  const [retFooterEl, setRetFooterEl] = useState<HTMLDivElement | null>(null)
  // Letter two (v2.3760): the sent footer's two doors — the GC's written okay, and the second letter.
  const [letterTwoMenu, setLetterTwoMenu] = useState(false)
  const [gcOkayOpen, setGcOkayOpen] = useState(false)
  const [gcOkayNote, setGcOkayNote] = useState('')
  // The owner's call (v2.3767): the three questions, recorded on the first packet.
  const [ownerCallOpen, setOwnerCallOpen] = useState(false)
  const [affSelectedJobId, setAffSelectedJobId] = useState<string | null>(null)
  // The pane's footer lands in the desk's one footer strip through a portal (v2.3753). It used to be
  // handed up as state from the pane's render on a microtask, which re-rendered the desk on every paint —
  // a loop the Affidavits tab had spun in since v2.3412 (about one render a millisecond while it was open).
  const [affFooterEl, setAffFooterEl] = useState<HTMLDivElement | null>(null)

  const entries = data?.queue.entries ?? []
  const visible = useMemo(() => {
    // Missed is a lens (v2.3679): a job in To draft with a closed month shows under it too.
    const list = pile ? entries.filter((e) => e.pile === pile || (pile === 'missed' && e.missedMonths.length > 0)) : entries
    return PILE_ORDER.flatMap((p) => list.filter((e) => e.pile === p))
  }, [entries, pile])

  // Selection follows the list: the requested job, else the first visible row (desktop).
  useEffect(() => {
    if (!open) return
    if (initialJobId && entries.some((e) => e.jobId === initialJobId)) {
      setSelectedJobId(initialJobId)
      setMobileListShown(false)
      return
    }
    if (selectedJobId && visible.some((e) => e.jobId === selectedJobId)) return
    setSelectedJobId(!isMobile && visible[0] ? visible[0].jobId : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialJobId, visible.map((e) => e.jobId).join('|')])

  const selected = visible.find((e) => e.jobId === selectedJobId) ?? entries.find((e) => e.jobId === selectedJobId) ?? null
  const job = selected ? data?.jobsById[selected.jobId] : undefined
  const gc = selected?.gcCustomerId ? data?.gcsById[selected.gcCustomerId] : undefined
  const address = job?.customer_address_id ? data?.addressesById[job.customer_address_id] ?? null : null
  const ownerRow = selected ? data?.ownerByJob[selected.jobId] ?? null : null
  const property = useMemo(() => resolveLienProperty(address ?? null, ownerRow ?? null), [address, ownerRow])
  const ownerName = lienPropertyOwnerDisplayName(property.owner)
  const pickKind = async (next: PropertyKind) => {
    if (!address || kindBusy) return
    setKindBusy(true)
    try {
      await savePropertyKind(address.id, next)
      showToast(`Property kind saved on ${address.address}: ${propertyKindWords(next)}.`, 'success')
      onChanged()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not save the property kind'), 'error')
    } finally {
      setKindBusy(false)
    }
  }
  const promise = selected ? data?.promisesByJob[selected.jobId] ?? null : null
  const gcHasPriorNotice = Boolean(selected?.gcCustomerId && data?.gcsWithPriorNotice.has(selected.gcCustomerId))
  /** The GC's "send" rule is live: a notice has been recorded to them before (v2.3469). */
  const ruleLive = selected ? selected.policy === 'send' && !ruleWaitsOnFirstNotice(selected.policy, gcHasPriorNotice) : false
  const wm = selected ? workMonths?.[selected.jobId] ?? null : null
  const item = selected?.item && selected.item.status !== 'sent' && selected.item.status !== 'missed' ? selected.item : null
  const storedDraft = useMemo(() => (selected?.item ? parseLienDeskDraftFields(selected.item.fields) : null), [selected?.item])

  // Months a new notice names: the draft's, else every open month, minus what the user unticked.
  const monthChoices = useMemo(() => (selected ? selected.months.map((m) => ({ ...m, closed: m.daysLeft < 0 })) : []), [selected])
  const defaultMonths = useMemo(() => new Set(item?.months.length ? item.months : (selected?.dueMonths ?? [])), [item, selected])
  useEffect(() => {
    setCheckedMonths(null)
    setCoverNote(selected?.item ? selected.item.cover_note : true)
    setWordOpen(false)
    setSkipOpen(false)
    setByHandOpen(false)
    setHoldOpen(null)
    setRulePick(null)
    setWordNote('')
    setWordingEdits({})
    setEditing(null)
    setPaneScrolled(false)
    // jsdom has no element scrollTo; the guard keeps the render smokes honest.
    if (typeof paneRef.current?.scrollTo === 'function') paneRef.current.scrollTo({ top: 0 })
  }, [selected?.jobId])
  const months = checkedMonths ?? defaultMonths
  const monthsList = [...months].sort()

  const openBalance = selected?.openBalance ?? 0
  // The claim set by hand (v2.3682): an amount off the moving balance, carried until cleared; the notice claims the rest.
  const correction = selected && data ? data.claimCorrectionsByJob[selected.jobId] ?? null : null
  const lastSentAt = selected && data ? data.items.filter((i) => i.job_id === selected.jobId && i.status === 'sent' && i.sent_at).map((i) => i.sent_at as string).sort().pop() ?? null : null
  const claimed = correctedClaim(openBalance, correction)
  const claimSplitLine = claimSplitWords(claimSplit(monthsList, claimed.claim, correction?.perMonth))
  const claimGate = correctionSendGate(correction, openBalance, lastSentAt)
  const handSetClaimWords = correction ? [claimDeltaWords(claimed.delta, openBalance), correctionSetWords(correction, formatYmdMonthDay)].filter(Boolean).join(' · ') : ''
  /** The job's own answers for the nine values — what a fresh draft says, and what "edited" is measured against. */
  const jobDefaults = useMemo(
    () =>
      buildLienNoticeFieldsForJob({
        jobName: job?.job_name,
        jobAddress: job?.job_address,
        homesteadStatement: homesteadStatementApplies(property),
        originalContractorName: gc?.name ?? '',
        openBalance: claimed.claim,
        claimSplit: claimSplitLine || undefined,
        contactPerson: signerNameFor(job?.master_user_id ?? null),
        issuer,
        todayYmd,
        retainageHeld: job?.lien_retainage_held ?? null,
      }),
    [job, gc, claimed.claim, claimSplitLine, signerNameFor, issuer, todayYmd],
  )
  // The stored draft wins when there is one (the leader approves those exact values); the office's typed wording layers on top.
  // The claim is re-read live (v2.3682): the balance and a hand-set correction are sources, and the paper follows its source.
  const noticeFields = useMemo(
    () => applyWordingEdits({ ...(storedDraft?.notice ?? jobDefaults), claimAmount: jobDefaults.claimAmount, ...(jobDefaults.claimSplit ? { claimSplit: jobDefaults.claimSplit } : { claimSplit: undefined }), ...(jobDefaults.retainageIncluded ? { retainageIncluded: jobDefaults.retainageIncluded } : { retainageIncluded: undefined }) }, wordingEdits),
    [storedDraft, jobDefaults, wordingEdits],
  )
  const wordingDiff = useMemo(() => noticeWordingDiff(noticeFields, jobDefaults), [noticeFields, jobDefaults])
  const wordingTouched = Object.keys(wordingEdits).length > 0
  const wordingEditedBy = wordingDiff.length === 0 ? null : wordingTouched ? authName || null : (storedDraft?.wording?.editedBy ?? null)
  const wordingLocked = !office || (item != null && item.status !== 'drafted')
  const docExtras: FilingDocExtras = useMemo(
    () => ({
      letterhead: filingLetterheadFromIssuer(issuer),
      refItems: [`Job #${job ? effectiveJobLedgerNumber(job.hcp_number, job.click_number) : ''}`, monthsList.length ? `Work months ${describeNoticeMonths(monthsList)}` : '', demandDate(todayYmd)].filter(Boolean),
    }),
    [issuer, job, monthsList, todayYmd],
  )
  // The desk's marks on the paper (v2.3694): a shaded box on each value the office may change, a dotted one once locked, and a title on every filled-from-the-job value saying where it comes from.
  const paperMarks = useMemo(() => {
    const m: Record<string, FilingFieldMark> = {}
    for (const g of LIEN_NOTICE_FIELD_GUIDE) {
      if (g.kind === 'typed') m[g.key] = { kind: wordingLocked ? 'locked' : 'typed', changed: wordingDiff.includes(g.key), title: wordingLocked ? 'Sent for approval — pull it back to a draft to change it' : 'Click to change — on the paper', ring: ringField === g.key }
      else {
        // Every plain value says where it is filled from; the ones with a door say the click lands there (v2.3697).
        const door = g.key === 'originalContractorName' ? 'gc' : g.key === 'claimantName' || g.key === 'claimantAddress' ? 'company' : g.key === 'claimAmount' ? 'claim' : undefined
        const title =
          door === 'gc' ? 'Filled from the job · the GC — click to change it there'
          : door === 'company' ? 'Filled from Settings → Company — click to change it there'
          : door === 'claim' ? 'Set on the claim box above — click, and it opens there'
          : g.key === 'noticeDate' ? 'The day it is drafted or sent — nothing to change'
          : `Filled from ${g.source}`
        m[g.key] = { kind: 'derived', title, ...(door && (door !== 'company' || onOpenCompanySettings) ? { door } : {}), ring: ringField === g.key }
      }
    }
    return m
  }, [wordingLocked, wordingDiff, ringField, onOpenCompanySettings])
  useEffect(() => {
    const trip = sourceTripRef.current
    if (!trip) return
    const now = noticeFields[trip.field] ?? ''
    if (now === trip.before) return
    sourceTripRef.current = null
    setRingField(trip.field)
    const t = window.setTimeout(() => setRingField(null), 4000)
    return () => window.clearTimeout(t)
  }, [noticeFields])
  const docHtml = useMemo(() => filingDocHtml(buildLienNoticeBlocks(noticeFields, docExtras, { ghostOptional: !wordingLocked }), { marks: paperMarks }), [noticeFields, docExtras, paperMarks])
  /** Click a shaded box: the value becomes a box in its place. A Back button under a changed value puts the job's wording back. */
  const startEdit = (key: LienNoticeFieldKey) => {
    const wrap = paperRef.current
    const el = wrap?.querySelector<HTMLElement>(`[data-field="${key}"]`)
    if (!wrap || !el || wordingLocked) return
    const target = el.querySelector<HTMLElement>('[data-field-text]') ?? el
    const r = target.getBoundingClientRect()
    const w = wrap.getBoundingClientRect()
    const cs = typeof window !== 'undefined' && typeof window.getComputedStyle === 'function' ? window.getComputedStyle(target) : null
    setEditing({ key, value: noticeFields[key] ?? '', rect: { top: r.top - w.top, left: r.left - w.left, width: r.width, height: r.height }, font: cs?.font ?? '' })
  }
  const onPaperClick = (ev: React.MouseEvent<HTMLDivElement>) => {
    const t = ev.target as HTMLElement
    const reset = t.closest<HTMLElement>('[data-reset]')?.getAttribute('data-reset')
    if (reset && isTypedNoticeField(reset)) {
      if (!wordingLocked) setWordingEdits((e) => ({ ...e, [reset]: jobDefaults[reset] }))
      return
    }
    const el = t.closest<HTMLElement>('[data-field]')
    const key = el?.getAttribute('data-field') ?? ''
    if (!el) return
    if (!isTypedNoticeField(key)) {
      // A plain value's door (v2.3697): land where it is set, on the field, and ring it here when it comes back changed.
      const door = el.getAttribute('data-door')
      if (!door || !selected) return
      const k = key as LienNoticeFieldKey
      sourceTripRef.current = { field: k, before: noticeFields[k] ?? '' }
      if (door === 'gc') onOpenEditJob(selected.jobId, 'gc')
      else if (door === 'company') onOpenCompanySettings?.(k === 'claimantAddress' ? 'addressText' : 'companyName')
      else if (door === 'claim') {
        paneRef.current?.querySelector('[data-lien-claim-box], [data-lien-claim-editor]')?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
        setClaimOpenSignal((n) => n + 1)
      }
      return
    }
    if (wordingLocked) {
      showToast('Sent for approval — pull it back to a draft to change the wording.', 'info')
      return
    }
    startEdit(key)
  }
  const commitEdit = () => {
    setEditing((e) => {
      if (e) setWordingEdits((w) => ({ ...w, [e.key]: e.value }))
      return null
    })
  }
  useEffect(() => {
    if (editing) editInputRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.key])
  // The cover page (v2.3540): the same page the run prints — the note while the box is ticked, or the run's cover letter when the item carries one.
  const coverBlocks = useMemo(() => {
    if (!selected) return []
    const jobNumber = job ? effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '' : ''
    return runCoverNoteBlocks({
      label: jobLabel(job, selected.jobId),
      months: monthsList,
      fields: noticeFields,
      extras: docExtras,
      coverNote: coverNote ? lienNoticeCoverNote(noticeFields.claimantName, monthsList) : null,
      coverLetter: storedDraft?.coverLetter ? fillCoverLetter(storedDraft.coverLetter, { property: (job?.job_address ?? '').trim(), months: describeNoticeMonths(monthsList), job: jobNumber, amount: demandMoney(noticeFields.claimAmount), staleNote: storedDraft.staleNote ?? '', contact: noticeFields.contactPerson, phone: signerPhoneFor ? signerPhoneFor(job?.master_user_id ?? null) : (issuer?.phone ?? '').trim(), affidavitMonth: affidavitMonthWord(coverLetterKindFor(property)) }) : null,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.jobId, job, monthsList.join('|'), noticeFields, docExtras, coverNote, storedDraft?.coverLetter, signerPhoneFor])
  const coverHtml = useMemo(() => (coverBlocks.length ? filingDocHtml(coverBlocks) : ''), [coverBlocks])
  // The pay page (punch list #35, PR 3): the page the run prints behind the owner's copy, from the job's unpaid bills — fetched once per job while the desk is open.
  const payPage = useNoticePayPage(selected?.jobId ?? null, open)
  const payBlocks = useMemo(
    () =>
      selected && payPage.rows.length
        ? payPageBlocks({
            rows: payPage.rows,
            assets: payPage.assets,
            copy: 'owner',
            copyLabel: '',
            gcName: noticeFields.originalContractorName,
            claimantName: noticeFields.claimantName,
            contactPerson: noticeFields.contactPerson,
            phone: (issuer?.phone ?? '').trim(),
            extras: docExtras,
          })
        : [],
    [selected, payPage, noticeFields, issuer, docExtras],
  )
  const payHtml = useMemo(() => (payBlocks.length ? filingDocHtml(payBlocks) : ''), [payBlocks])
  const pageTotal = (coverHtml ? 1 : 0) + 1 + (payHtml ? 1 : 0)

  const draftFields = (): LienDeskDraftFields => ({
    notice: noticeFields,
    gcEmail: gc?.email ?? '',
    // A re-save keeps what Put a GC on notice wrote on the item (v2.3522 — these used to be dropped).
    ...(storedDraft?.batchReason ? { batchReason: storedDraft.batchReason } : {}),
    ...(storedDraft?.coverLetter ? { coverLetter: storedDraft.coverLetter } : {}),
    // The month is the job's creation month, not clock hours (v2.3747): the record says where the date came from.
    ...(selected?.datedFromCreation ? { monthsDatedFromCreation: true as const } : {}),
    ...(wordingDiff.length > 0 ? { wording: wordingTouched || !storedDraft?.wording ? { editedBy: authName, editedAt: new Date().toISOString() } : storedDraft.wording } : {}),
  })
  // A closed window, written down (v2.3679): one `missed` row naming the months and who looked; the live draft is untouched.
  const noteMissed = async (months: string[]) => {
    if (!selected || !months.length) return
    await run('Note it as missed', async () => noteLienWindowMissed({ jobId: selected.jobId, months, fields: draftFields(), userId: authUserId, userName: authName }), `Noted — ${describeNoticeMonths(months)} is on the record as missed.`)
  }
  // Readiness (v2.3450 kernel): GC, owner with a mailing address, months — and never a public owner.
  const readiness = draftReadiness({ gcName: gc?.name ?? '', ownerName, ownerMailingAddress: property.owner.mailingAddress, monthsCount: monthsList.length })
  const ready = readiness.ready


  /** Why this one comes to the leader (v2.3405) — said once, in the footer, beside the button (v2.3522). */
  const askReason: LienAskReason | null = useMemo(() => {
    if (!selected || !data) return null
    if (promise) return 'promise_live'
    if (selected.gcCustomerId && data.gcsHeldBefore.has(selected.gcCustomerId)) return 'held_before'
    if (selected.gcCustomerId && !data.gcsWithPriorNotice.has(selected.gcCustomerId)) return 'first_notice'
    return 'no_rule'
  }, [selected, data, promise])

  const gcOpenTotal = useMemo(() => {
    if (!selected?.gcCustomerId) return 0
    return entries.filter((e) => e.gcCustomerId === selected.gcCustomerId).reduce((s, e) => s + e.openBalance, 0)
  }, [entries, selected])

  const run = async (label: string, fn: () => Promise<void>, done?: string): Promise<boolean> => {
    if (busy) return false
    setBusy(true)
    try {
      await fn()
      if (done) showToast(done, 'success')
      onChanged()
      return true
    } catch (e) {
      showToast(e instanceof Error && e.message ? `${label}: ${e.message}` : `${label} failed.`, 'error')
      return false
    } finally {
      setBusy(false)
    }
  }

  const ensureDraft = async (): Promise<string> => {
    if (!selected) throw new Error('nothing selected')
    return saveLienDeskDraft({ itemId: item?.id ?? null, jobId: selected.jobId, months: monthsList, fields: draftFields(), coverNote, userId: authUserId })
  }

  const saveDraft = () => run('Save draft', async () => void (await ensureDraft()), 'Draft saved.')
  const sendToLeader = () =>
    run(
      'Send for approval',
      async () => {
        if (!selected || !data) return
        const id = await ensureDraft()
        // A claim set by hand over the balance, or carried and not looked at since the last notice, goes to the leader whatever the rule (v2.3682).
        const outcome = claimGate
          ? ({ status: 'awaiting_approval', reason: 'claim_by_hand' } as const)
          : submitOutcome(selected, { promiseYmd: promise?.promisedYmd ?? null, gcHasPriorNotice: Boolean(selected.gcCustomerId && data.gcsWithPriorNotice.has(selected.gcCustomerId)), gcHeldBefore: Boolean(selected.gcCustomerId && data.gcsHeldBefore.has(selected.gcCustomerId)) }, todayYmd)
        await submitLienDeskItem(id, outcome)
      },
      ruleLive && !promise && !claimGate ? 'Approved by the standing rule — it is in the run.' : selected?.policy === 'hold' ? 'Held by the standing rule — it re-asks before the deadline.' : 'Sent for approval.',
    )
  const sendOnWord = () =>
    run(
      'Send on the leader’s word',
      async () => {
        const id = await ensureDraft()
        await sendLienDeskItemOnWord(id, { note: wordNote, channel: wordChannel })
      },
      'Recorded on the leader’s word — it is in the run.',
    )
  const skip = () =>
    run(
      'Skip',
      async () => {
        if (!selected) return
        await skipLienDeskItem({ itemId: item?.id ?? null, jobId: selected.jobId, months: monthsList, fields: draftFields(), reason: skipReason, userId: authUserId, userName: authName })
      },
      'Skipped — the lien right on those months is given up.',
    )
  const approve = () => run('Approve', async () => void (item && (await approveLienDeskItem(item.id))), 'Approved — it is in the run.')
  const hold = (reason: 'promised' | 'call_first') =>
    run('Hold', async () => void (item && selected && (await holdLienDeskItem(item.id, { reason, until: holdUntilFor(reason, selected.earliestDeadline, promise?.promisedYmd ?? null, todayYmd) }))), 'Held — the desk re-asks before the deadline.')
  const pullBack = () => run('Pull back', async () => void (item && (await pullBackLienDeskItem(item.id, authUserId))), 'Back in the office’s drafts.')
  const saveRule = (policy: LienNoticePolicy) =>
    run('Standing rule', async () => void (selected?.gcCustomerId && (await setCustomerLienNoticePolicy(selected.gcCustomerId, policy, ''))), `Rule saved for ${gc?.name ?? 'this GC'}.`)

  // Preview (v2.3522): the notice as the packet prints it, in its own tab, with the values marked.
  // Not `noopener` — the preview posts back to this window: a field to focus, or (v2.3660) a typed value
  // it changed. The desk stays the source of truth: it layers the edit on, and the effect below posts the
  // rebuilt pages back, so the preview only ever shows what these builders print.
  const previewInput = () => ({
    blocks: buildLienNoticeBlocks(noticeFields, docExtras),
    fields: noticeFields,
    defaults: jobDefaults,
    editedBy: wordingEditedBy,
    coverBlocks,
    payBlocks,
  })
  const postToPreview = (saved?: 'ok' | 'failed') => {
    const win = previewWinRef.current
    if (!win || win.closed) return
    win.postMessage(lienNoticePreviewPages(previewInput(), saved), window.location.origin)
  }
  const openPreview = () => {
    if (!selected) return
    const html = buildLienNoticePreviewHtml({ ...previewInput(), jobLabel: jobLabel(job, selected.jobId), editable: !wordingLocked, handSetClaim: handSetClaimWords || undefined })
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
    const win = window.open(url, '_blank')
    if (!win) showToast('Popup blocked — allow popups to preview the notice.', 'error')
    previewWinRef.current = win
    setPreviewJobId(win ? selected.jobId : null)
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }
  // A preview belongs to the job it was opened on: once the desk moves to another job its boxes must not write here.
  const previewIsThisJob = previewJobId != null && previewJobId === selected?.jobId
  const onPreviewMessageRef = useRef<(ev: MessageEvent) => void>(() => {})
  onPreviewMessageRef.current = (ev: MessageEvent) => {
    if (ev.origin !== window.location.origin) return
    const d = ev.data as { type?: unknown; field?: unknown; value?: unknown } | null
    if (!d) return
    if (d.type === LIEN_NOTICE_PREVIEW_EDIT_MESSAGE) {
      if (ev.source !== previewWinRef.current || !previewIsThisJob || wordingLocked) return
      if (typeof d.field !== 'string' || !isTypedNoticeField(d.field) || typeof d.value !== 'string') return
      const field = d.field
      const value = d.value
      setWordingEdits((e) => ({ ...e, [field]: value }))
      return
    }
    if (d.type === LIEN_NOTICE_PREVIEW_SAVE_MESSAGE) {
      if (ev.source !== previewWinRef.current || !previewIsThisJob || wordingLocked || monthsList.length === 0) {
        postToPreview('failed')
        return
      }
      void run('Save draft', async () => void (await ensureDraft()), 'Draft saved.').then((ok) => postToPreview(ok ? 'ok' : 'failed'))
      return
    }
    if (d.type !== LIEN_NOTICE_PREVIEW_MESSAGE || typeof d.field !== 'string' || !isTypedNoticeField(d.field)) return
    const field = d.field
    window.setTimeout(() => {
      paperRef.current?.querySelector<HTMLElement>(`[data-field="${field}"]`)?.scrollIntoView?.({ block: 'center' })
      startEdit(field)
    }, 0)
  }
  useEffect(() => {
    if (!open) return
    const onMessage = (ev: MessageEvent) => onPreviewMessageRef.current(ev)
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [open])
  // Whatever changed the pages — a box here, a box there, the cover-note tick — the open preview follows.
  useEffect(() => {
    if (!open || !previewIsThisJob) return
    postToPreview()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the pages are a function of exactly these
  }, [open, previewIsThisJob, docHtml, coverHtml, payHtml, wordingDiff.length, wordingEditedBy])

  if (!open) return null

  const counts = data?.queue.counts
  const affEntries = data?.affidavits.entries ?? []
  const affVisible = (['needs_property', 'to_draft', 'awaiting', 'ready', 'held', 'filed', 'missed'] as LienAffidavitPile[]).flatMap((p) => affEntries.filter((e) => e.pile === p && (affPile == null || affPile === p)))
  const affSelected = affVisible.find((e) => e.jobId === affSelectedJobId) ?? (!isMobile ? affVisible[0] : undefined) ?? null
  const affCount = affEntries.filter((e) => e.pile !== 'filed').length
  const retEntries = data?.retainage.entries ?? []
  const retVisible = LIEN_RETAINAGE_PILES.flatMap((p) => retEntries.filter((e) => e.pile === p.key && (retPile == null || retPile === p.key)))
  const retSelected = retVisible.find((e) => e.jobId === retSelectedJobId) ?? (!isMobile ? retVisible[0] : undefined) ?? null
  const retCount = retEntries.filter((e) => e.pile !== 'sent').length
  const retReady = data?.retainage.counts.ready ?? 0
  const wordSent = entries.filter((e) => e.item?.approval_mode === 'word' && (e.pile === 'ready' || e.pile === 'sent'))

  const list = (
    <div style={{ borderRight: isMobile ? 'none' : '1px solid var(--border)', overflow: 'auto', minWidth: 0 }}>
      {visible.length === 0 ? (
        <p style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
          {loading || data == null ? 'Looking at every unpaid sub job…' : pile ? 'Nothing in this pile.' : 'Nothing is due — every unpaid month on a sub job is noticed, or is more than 30 days from its deadline.'}
        </p>
      ) : null}
      {PILE_ORDER.map((p) => {
        const rows = visible.filter((e) => e.pile === p)
        if (rows.length === 0) return null
        const label = LIEN_DESK_PILES.find((x) => x.key === p)?.label ?? p
        return (
          <div key={p}>
            <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0.6rem 0.9rem 0.2rem' }}>{label}</div>
            {rows.map((e) => {
              const j = data?.jobsById[e.jobId]
              const g = e.gcCustomerId ? data?.gcsById[e.gcCustomerId] : undefined
              const sel = e.jobId === selectedJobId
              const sev = severityColors(e.severity)
              const named = e.item && e.item.status !== 'sent' && e.item.status !== 'missed' && e.item.months.length ? e.item.months : e.dueMonths
              const state =
                e.pile === 'awaiting'
                  ? `awaiting approval · ${e.item?.submitted_at ? formatYmdMonthDay(e.item.submitted_at.slice(0, 10)) : ''}`
                  : e.pile === 'ready'
                    ? e.item?.approval_mode === 'word'
                      ? wordRecordWords(e.item)
                      : e.item?.approval_mode === 'rule'
                        ? 'standing rule'
                        : 'approved'
                    : e.pile === 'held'
                      ? `held · ${e.item?.hold_reason === 'promised' ? 'they promised' : 'call first'} · re-asks ${e.item?.hold_until ? formatYmdMonthDay(e.item.hold_until) : ''}`
                      : e.pile === 'sent'
                        ? `sent ${e.item?.sent_at ? formatYmdMonthDay(e.item.sent_at.slice(0, 10)) : ''}`
                        : e.pile === 'missed'
                          ? `window closed on ${e.missedMonths.map(workMonthShort).join(', ')}`
                          : e.pile === 'needs_owner'
                            ? 'owner of record missing'
                            : e.item
                              ? 'draft saved'
                              : ''
              return (
                <button
                  key={e.jobId}
                  type="button"
                  onClick={() => {
                    setSelectedJobId(e.jobId)
                    setMobileListShown(false)
                  }}
                  aria-current={sel ? 'true' : undefined}
                  style={{ display: 'grid', gridTemplateColumns: '8px 1fr auto', gap: '0.2rem 0.6rem', width: '100%', textAlign: 'left', padding: '0.5rem 0.9rem', border: 'none', borderTop: '1px solid var(--border)', background: sel ? 'var(--bg-blue-tint)' : 'transparent', cursor: 'pointer', font: 'inherit', color: 'inherit', fontSize: '0.8125rem' }}
                >
                  <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 6, background: e.severity === 'red' ? 'var(--text-red-600)' : e.severity === 'amber' ? 'var(--text-amber-800)' : 'var(--border-strong)' }} />
                  <span style={{ minWidth: 0 }}>
                    <strong>{jobLabel(j, e.jobId)}</strong>
                    {g?.name ? <span style={{ color: 'var(--text-muted)' }}> · GC {g.name}</span> : null}
                  </span>
                  <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatUsdNoCents(e.openBalance)}</span>
                  <span style={{ gridColumn: '2 / 4', display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {deadlineWords(e) ? <span style={chip(sev.bg, sev.fg)}>{deadlineWords(e)}</span> : null}
                    {e.pile !== 'missed' && e.missedMonths.length ? (
                      <span style={chip('var(--bg-red-tint)', 'var(--text-red-600)')} data-lien-desk-missed-chip title={e.missedUnrecorded.length ? 'The window closed with nothing recorded — the pane has the note' : 'The window closed; someone noted it'}>
                        {e.missedMonths.map(workMonthShort).join(', ')} window closed{e.missedUnrecorded.length ? ' · not noted' : ''}
                      </span>
                    ) : null}
                    <span>{named.map(workMonthShort).join(' + ')}</span>
                    {e.datedFromCreation ? <span data-lien-desk-dated-from-creation>· {DATED_FROM_CREATION_WORDS}</span> : null}
                    {state ? <span>· {state}</span> : null}
                    {(() => {
                      // Letter two (v2.3760): the second letter's clock on a sent notice, and its mark on a draft that is one.
                      const lt = data?.letterTwoByJob[e.jobId]
                      const draftTwo = e.item && e.item.status !== 'sent' ? parseLienDeskDraftFields(e.item.fields)?.letterTwo : undefined
                      if (draftTwo) return <span style={chip('var(--bg-blue-tint)', 'var(--text-blue-800)')} data-lien-letter-two="draft">letter two · {letterTwoKindLabel(draftTwo.kind)}</span>
                      if (!lt || e.pile !== 'sent' || lt.state === 'none' || lt.state === 'paid') return null
                      const tone = lt.state === 'overdue' ? chip('var(--bg-red-tint)', 'var(--text-red-600)') : lt.state === 'due' ? chip('var(--bg-amber-tint)', 'var(--text-amber-800)') : lt.state === 'sent' || lt.state === 'gc_authorized' || lt.state === 'owner_called' ? chip('var(--bg-green-tint)', 'var(--text-green-800)') : chip('var(--bg-subtle)', 'var(--text-muted)')
                      return <span style={tone} data-lien-letter-two={lt.state}>{lt.words}</span>
                    })()}
                  </span>
                </button>
              )
            })}
          </div>
        )
      })}
    </div>
  )

  // A month is shown once: still-open months (and whatever this item names) are cards; the rest of the job's months are history.
  const monthCards: LienDeskMonthCard[] = monthChoices
    .filter((m) => months.has(m.key) || (!m.noticed && !m.closed))
    .map((m) => {
      const ev = wm?.months.find((x) => x.key === m.key)
      return {
        key: m.key,
        on: months.has(m.key),
        locked: m.noticed || m.closed || (item != null && item.status !== 'drafted'),
        hours: ev?.hours ?? m.approvedHours,
        crew: ev ? `${ev.people.length} ${ev.people.length === 1 ? 'person' : 'people'} · ${ev.dayCount} ${ev.dayCount === 1 ? 'day' : 'days'}` : '',
        deadline: m.deadline,
        daysLeft: m.daysLeft,
        noticed: m.noticed,
        closed: m.closed,
        fromCreation: m.fromCreation,
      }
    })

  // Months down, papers across (#38): every month the job has, every § 53.056 paper that went out, this notice as the last column.
  const monthGrid = selected && data
    ? buildLienMonthGrid({
        jobId: selected.jobId,
        months: monthChoices,
        evidence: wm?.months.map((x) => ({ key: x.key, hours: x.hours, people: x.people.length, dayCount: x.dayCount, pendingHours: x.pendingHours })) ?? [],
        items: data.items,
        filings: data.filingsByJob[selected.jobId] ?? [],
        allFilings: Object.values(data.filingsByJob).flat(),
        checked: months,
        thisItem: item ?? null,
        thisPile: selected.pile,
        propertyKind: property.propertyKind ?? '',
        todayYmd,
      })
    : null

  const { gates, verdict: gateVerdict } = buildLienDeskGates({
    ownerName,
    ownerMailingAddress: property.owner.mailingAddress,
    gcName: gc?.name ?? '',
    gcAddress: gc?.address ?? '',
    propertyKind: property.propertyKind,
    county: property.county ?? '',
    monthLabels: (selected?.months ?? []).map((m) => workMonthShort(m.key)),
    pickedMonthsCount: monthsList.length,
    pendingSessions: wm?.pendingSessions ?? 0,
    datedFromCreation: selected?.datedFromCreation ?? false,
  })
  const gateByKey = Object.fromEntries(gates.map((g) => [g.key, g])) as Record<LienGateKey, LienGate>

  // A book row opens the job on the pane its next step belongs to; a job the desk does not list yet opens its Lien window (v2.3768).
  const openBookRow = (row: LienTimelineBookRow) => {
    const k = row.timeline.next.kind
    const onAffidavitSide = k === 'affidavit' || k === 'serve' || k === 'suit' || k === 'release'
    if (onAffidavitSide && data?.affidavits.entries.some((e) => e.jobId === row.jobId)) {
      setKind('affidavit')
      setAffSelectedJobId(row.jobId)
      setMobileListShown(false)
    } else if (data?.queue.entries.some((e) => e.jobId === row.jobId)) {
      setKind('notice')
      setSelectedJobId(row.jobId)
      setMobileListShown(false)
    } else {
      onOpenLienInstruments(row.jobId)
    }
  }

  // The job's lien timeline (v2.3761): every Chapter 53 step in order, from what the desk already loaded.
  const timeline =
    selected && data
      ? buildLienTimelineFromDesk(selected.jobId, {
          rows: data.rows,
          items: data.items,
          filings: data.filingsByJob[selected.jobId] ?? [],
          entry: selected,
          affidavit: data.affidavits.entries.find((e) => e.jobId === selected.jobId) ?? null,
          retainage: lienRetainageClockFromDesk(data, selected.jobId),
          isSub: Boolean(selected.gcCustomerId),
          propertyKind: property.propertyKind,
          lastWorkDate: job?.last_work_date ?? null,
          openBalance,
          todayYmd,
        })
      : null

  // The pane (v2.3522): a strip — title, gates, months, wording — then the paper, which takes the rest and is the
  // pane's own scroll. Once the gates scroll away a one-line strip sticks to the top so the facts stay one glance away.
  const pane = selected ? (
    <div
      ref={paneRef}
      data-lien-desk-pane
      onScroll={(ev) => {
        const next = ev.currentTarget.scrollTop > STRIP_COLLAPSE_PX
        setPaneScrolled((prev) => (prev === next ? prev : next))
      }}
      style={{ padding: '0 1.1rem 0.9rem', display: 'grid', gap: '0.6rem', alignContent: 'start', overflow: 'auto', minWidth: 0 }}
    >
      {paneScrolled ? (
        <div
          data-lien-desk-strip
          style={{ position: 'sticky', top: 0, zIndex: 2, margin: '0 -1.1rem', padding: '0.45rem 1.1rem', background: 'var(--surface)', borderBottom: '1px solid var(--border)', boxShadow: '0 8px 14px -12px rgba(0,0,0,0.35)', display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.7rem', alignItems: 'center', fontSize: '0.8125rem' }}
        >
          <strong>{jobLabel(job, selected.jobId)}</strong>
          <span style={chip(gateVerdict.ready ? 'var(--bg-green-tint)' : 'var(--bg-red-tint)', gateVerdict.ready ? 'var(--text-green-800)' : 'var(--text-red-600)')}>{gateVerdict.ready ? '✓' : '✗'} {gateVerdict.headline}</span>
          {gates.filter((g) => g.tone !== 'ok').map((g) => (
            <span key={g.key} style={chip(g.tone === 'blocker' ? 'var(--bg-red-tint)' : 'var(--bg-amber-tint)', g.tone === 'blocker' ? 'var(--text-red-600)' : 'var(--text-amber-800)')} title={g.title}>
              {g.n} · {g.label}: {g.value}
            </span>
          ))}
          <span style={{ color: 'var(--text-muted)' }}>{monthsList.length ? monthsList.map(workMonthShort).join(' + ') : 'no months'}</span>
          {timeline ? (
            <span data-lien-desk-strip-next style={chip(timeline.next.tone === 'red' ? 'var(--bg-red-tint)' : timeline.next.tone === 'amber' ? 'var(--bg-amber-tint)' : timeline.next.tone === 'green' ? 'var(--bg-green-tint)' : 'var(--bg-subtle)', timeline.next.tone === 'red' ? 'var(--text-red-600)' : timeline.next.tone === 'amber' ? 'var(--text-amber-800)' : timeline.next.tone === 'green' ? 'var(--text-green-800)' : 'var(--text-700)')} title="Next on the path">
              {timeline.next.words}
            </span>
          ) : null}
          <span style={{ color: 'var(--text-muted)' }}>
            Claim <strong style={{ color: 'var(--text-strong)' }}>{formatUsdNoCents(claimed.claim)}</strong>{claimed.corrected ? <span style={chip('var(--bg-amber-tint)', 'var(--text-amber-800)')}>set by hand</span> : null}
          </span>
          {wordingDiff.length ? <span style={chip('var(--bg-amber-tint)', 'var(--text-amber-800)')}>{wordingLineText(wordingDiff, wordingEditedBy)}</span> : null}
          <span style={{ flex: 1 }} />
          <button type="button" onClick={() => paneRef.current?.scrollTo?.({ top: 0, behavior: 'smooth' })} style={linkBtn}>
            Show gates ▴
          </button>
        </div>
      ) : null}
      {isMobile ? (
        <button type="button" onClick={() => setMobileListShown(true)} style={{ ...btn('plain'), justifySelf: 'start', marginTop: '0.9rem' }}>
          ← Back to the list
        </button>
      ) : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.6rem', alignItems: 'baseline', paddingTop: isMobile ? 0 : '0.9rem' }}>
        <strong style={{ fontSize: '1rem' }}>{jobLabel(job, selected.jobId)}</strong>
        {storedDraft?.letterTwo && item ? (
          <span style={chip('var(--bg-blue-tint)', 'var(--text-blue-800)')} data-lien-letter-two-heading title="The second owner letter, on the same form to the same two recipients; the first packet stays on the record">
            letter two · {letterTwoKindLabel(storedDraft.letterTwo.kind)}{storedDraft.letterTwo.afterSentAt ? ` · after the ${formatYmdMonthDay(storedDraft.letterTwo.afterSentAt.slice(0, 10))} packet` : ''}
          </span>
        ) : null}
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
          {gc?.name ? `· GC ${gc.name}` : '· no GC'} {job?.job_address ? `· ${job.job_address}` : ''}
        </span>
      </div>
      {timeline ? (
        <div data-lien-desk-timeline style={{ ...boxStyle, padding: isMobile ? '0.5rem 0.7rem' : '0.55rem 0.8rem 0.5rem' }}>
          <LienTimelineStrip timeline={timeline} onDoor={job && 'lien_contract_ended_on' in job ? () => onOpenEditJob(selected.jobId) : undefined} />
        </div>
      ) : null}

      {leader && selected.pile === 'awaiting' ? (
        <div style={boxStyle}>
          <div style={boxHead}>What you're deciding</div>
          {correction ? (
            <div style={{ fontSize: '0.8125rem', color: claimed.over ? 'var(--text-red-700)' : 'var(--text-amber-800)' }} data-lien-claim-leader-line>
              <strong>Claim set by hand: {formatUsdNoCents(claimed.claim)}</strong>
              {claimDeltaWords(claimed.delta, openBalance) ? `, ${claimDeltaWords(claimed.delta, openBalance)}` : ''} — {correctionSetWords(correction, formatYmdMonthDay)}.{correction.carry ? ' It carries to later notices and the affidavit.' : ' This notice only.'} The notice below carries it.
            </div>
          ) : null}
          {wordingDiff.length ? (
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-amber-800)' }}>{wordingLineText(wordingDiff, wordingEditedBy)} from the job’s wording — the notice below carries it.</div>
          ) : null}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.25rem 1rem', fontSize: '0.8125rem' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Open with {gc?.name ?? 'this GC'}: </span>
              <strong>{formatUsdNoCents(gcOpenTotal)}</strong> on {entries.filter((e) => e.gcCustomerId === selected.gcCustomerId).length} {entries.filter((e) => e.gcCustomerId === selected.gcCustomerId).length === 1 ? 'job' : 'jobs'} in the desk
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Their word: </span>
              {promise ? (
                <span style={chip('var(--bg-subtle)', 'var(--text-green-800)')}>✓ promised {formatYmdMonthDay(promise.promisedYmd)}{promise.markedByName ? ` · ${promise.markedByName}` : ''}</span>
              ) : (
                'no promise on file'
              )}
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Months: </span>
              {monthsList.map(workMonthShort).join(' · ')}
              {wm ? ` — ${wm.totalHours.toLocaleString(undefined, { maximumFractionDigits: 1 })} h, ${new Set(wm.months.flatMap((m) => m.people)).size} people` : ''}
            </div>
            <div style={{ color: 'var(--text-red-600)' }}>
              If you hold: {monthsList[0] ? `${workMonthLabel(monthsList[0])}'s lien right ends ${selected.earliestDeadline ? demandDate(selected.earliestDeadline) : '—'}` : ''}
            </div>
          </div>
        </div>
      ) : null}

      {/* The gates (v2.3657): four numbered steps in fixed slots under a verdict headline. Every gate has its section (v2.3670): a gate that is not clear carries its sentence and its door, a clear one the fact the notice will use; a cell click brings its section up. */}
      <LienDeskGates
        gates={gates}
        verdict={gateVerdict}
        active={activeGate?.key ?? null}
        activeAt={activeGate?.at ?? 0}
        onPick={pickGate}
        details={{
          owner: (
            <>
              {gateByKey.owner.tone !== 'ok' && gateByKey.owner.value !== 'Public property' ? (
                <div>
                  Owner of record with a mailing address{ownerName ? ` — ${ownerName}, mailing address missing` : ''} — the statute sends the notice to the owner, so this comes first.
                </div>
              ) : null}
              {gateByKey.owner.tone === 'ok'
                ? (() => {
                    // The owner on file as the envelope will read (the roll's shape, v2.3658), where it came from, and the doors to check or change it.
                    const mailing = rollMailingLines(property.owner.mailingAddress)
                    const county = (address?.county ?? '').trim()
                    const cadUrl = property.owner.source === 'property_record' ? txCountyCadPropertyUrl(county, (address?.parcel_id ?? '').trim()) || txCountyCadSearchUrl(county) : ''
                    return (
                      <>
                        <div className="lienGateFact" data-lien-gate-owner-fact>
                          <address className="lienOwnerRollAddress">
                            <strong>{ownerName}</strong>
                            {mailing.careOf ? <span className="lienOwnerRollCareOf">c/o {mailing.careOf}</span> : null}
                            {mailing.lines.map((line) => (
                              <span key={line}>{line}</span>
                            ))}
                          </address>
                          <span className="lienGateFactActions">
                            {cadUrl ? (
                              <button type="button" style={linkBtn} onClick={() => openInExternalBrowser(cadUrl)} title={`Check this owner on the ${county || 'county'} appraisal district site`}>
                                Check on {county || 'the county'} CAD ↗
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => onOpenEditJob(selected.jobId, property.owner.source === 'property_record' ? 'property-record' : undefined)}
                              style={{ ...btn('plain'), padding: '1px 8px', fontSize: '0.72rem' }}
                              title={property.owner.source === 'property_record' ? 'Edit Job → Property record: the owner of record lives on the property' : 'Edit Job: the owner set on this job'}
                            >
                              Change ›
                            </button>
                          </span>
                        </div>
                        {ownerSourceWords(property.owner.source) ? <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{ownerSourceWords(property.owner.source)}</div> : null}
                      </>
                    )
                  })()
                : null}
              {/* The roll's answer with Use, the Confirm on an unconfirmed nightly save, or the bond-claim sentence (v2.3450); renders nothing when the owner is fine. */}
              <LienDeskOwnerPane
                key={selected.jobId}
                job={job}
                jobId={selected.jobId}
                gcName={gc?.name ?? ''}
                gcCustomerId={selected.gcCustomerId}
                address={address}
                owner={property.owner}
                ownerName={ownerName}
                userId={authUserId}
                onChanged={onChanged}
                onOpenEditJob={onOpenEditJob}
              />
            </>
          ),
          gc:
            gateByKey.gc.tone !== 'ok' ? (
              <div className="lienGateFact">
                <span>The notice names the original contractor — set the GC on the job.</span>
                <span className="lienGateFactActions">
                  <button type="button" onClick={() => onOpenEditJob(selected.jobId)} style={{ ...btn('plain'), padding: '1px 8px', fontSize: '0.72rem' }}>
                    Set the GC ›
                  </button>
                </span>
              </div>
            ) : (
              // The GC as the notice names them, with the address the certified copy goes to.
              <div className="lienGateFact" data-lien-gate-gc-fact>
                <span style={{ minWidth: 0 }}>
                  <strong>{gc?.name}</strong>
                  {gc?.address ? <span style={{ color: 'var(--text-600)' }}> · {gc.address}</span> : <span style={{ color: 'var(--text-amber-800)' }}> · no mailing address on the customer</span>}
                </span>
                <span className="lienGateFactActions">
                  <button type="button" onClick={() => onOpenEditJob(selected.jobId)} style={{ ...btn('plain'), padding: '1px 8px', fontSize: '0.72rem' }} title="Edit Job: the GC on the job">
                    Change the GC ›
                  </button>
                </span>
              </div>
            ),
          kind: (
            // The kind as the switch the claims row and Edit Job use (v2.3667), set right here; without a linked property there is nothing to write on, so the door stays.
            <>
              <div className="lienGateFact" data-lien-gate-kind-fact>
                {address ? <PropertyKindSwitch value={normalizePropertyKind(property.propertyKind)} onPick={(k) => void pickKind(k)} disabled={kindBusy} label={`Property kind for ${jobLabel(job, selected.jobId)}`} /> : null}
                <span style={{ minWidth: 0 }}>{kindBusy ? 'saving…' : propertyKindClockWords(property.propertyKind, property.county)}</span>
                {!address ? (
                  <span className="lienGateFactActions">
                    <button type="button" onClick={() => onOpenEditJob(selected.jobId, 'property-record')} style={{ ...btn('plain'), padding: '1px 8px', fontSize: '0.72rem' }} title="Edit Job → Property record: link the property, then say whether it is residential or commercial">
                      Set property kind ›
                    </button>
                  </span>
                ) : null}
              </div>
              {address ? (
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Saved on the property record
                  {(() => {
                    const shared = data ? jobsSharingProperty(selected.jobId, Object.keys(data.jobsById), (id) => data.jobsById[id]?.customer_address_id) : []
                    const words = sharedPropertyWords(shared.map((id) => effectiveJobLedgerNumber(data?.jobsById[id]?.hcp_number ?? null, data?.jobsById[id]?.click_number ?? null) || id.slice(0, 8)))
                    return words ? ` — ${words}, which follows it` : ''
                  })()}
                  .
                </div>
              ) : null}
            </>
          ),
          months: (
            <>
              {gateByKey.months.tone !== 'ok' ? (
                <div className="lienGateFact">
                  <span>Tick at least one month below — the notice has to name the work it covers.</span>
                  <span className="lienGateFactActions">
                    <button type="button" style={linkBtn} onClick={() => paneRef.current?.querySelector('[data-lien-desk-months]')?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })}>
                      Months and deadlines ↓
                    </button>
                  </span>
                </div>
              ) : (
                // One line per work month with approved hours — the cell's list — from the same evidence as the Months card; the ticked ones say so.
                <div className="lienGateFact" data-lien-gate-months-fact>
                  <span style={{ display: 'grid', minWidth: 0 }}>
                    {monthCards.map((c) => (
                      <span key={c.key}>
                        {lienGateMonthLine(workMonthLabel(c.key), c.hours, c.crew)}
                        {c.on ? <span style={{ color: 'var(--text-muted)' }}> · on this notice</span> : null}
                      </span>
                    ))}
                  </span>
                  <span className="lienGateFactActions">
                    <button type="button" style={linkBtn} onClick={() => paneRef.current?.querySelector('[data-lien-desk-months]')?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })}>
                      Months and deadlines ↓
                    </button>
                  </span>
                </div>
              )}
              {wm && wm.pendingSessions > 0 ? (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {wm.pendingSessions} {wm.pendingSessions === 1 ? 'session' : 'sessions'} awaiting approval not counted in the hours.
                </div>
              ) : null}
            </>
          ),
        }}
      />

      {/* A carried correction nobody has looked at since the last notice (v2.3682): the paper says so and asks before it goes. */}
      {correction && correctionNeedsLook(correction, lastSentAt) ? (
        <div data-lien-claim-carry-strip style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.3rem 0.8rem', padding: '0.5rem 0.75rem', borderRadius: 9, border: '1px solid var(--border-amber)', background: 'var(--bg-amber-tint)', fontSize: '0.8125rem' }}>
          <span style={{ color: 'var(--text-amber-800)', minWidth: 0, flex: '1 1 20rem' }}>
            <strong>Carrying {correction.setByName || 'the office'}’s correction{correction.setAt ? ` from ${formatYmdMonthDay(correction.setAt.slice(0, 10))}` : ''}:</strong> {formatUsdNoCents(correction.amountOff)} {correction.amountOff < 0 ? 'on top' : 'off'} — “{correction.reason}”. This notice claims <strong>{formatUsdNoCents(claimed.claim)}</strong>, not the app’s {formatUsdNoCents(openBalance)}.
          </span>
          {office ? (
            <>
              <button type="button" disabled={busy} style={btn('plain', busy)} onClick={() => void run('Still true', async () => lookLienClaimCorrection(selected.jobId, authName), 'Noted — the correction stands for this notice.')} data-lien-claim-still-true>
                Still true
              </button>
              <button type="button" disabled={busy} style={btn('plain', busy)} onClick={() => void run('Clear the correction', async () => clearLienClaimCorrection(selected.jobId), 'Cleared — the notice claims the job’s figure.')}>
                Clear it
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {/* Months (#38): the grid — months down, papers across, this notice as the last column. */}
      <LienDeskMonths
        grid={monthGrid!}
        claimNode={
          <LienClaimBox
            openSignal={claimOpenSignal}
            balance={openBalance}
            correction={correction}
            months={monthsList}
            office={office}
            busy={busy}
            onSave={(input) => void run('Correct the claim', async () => saveLienClaimCorrection({ jobId: selected.jobId, ...input, userId: authUserId, userName: authName }), input.amountOff > 0 ? 'The notice claims the corrected figure.' : input.amountOff < 0 ? 'Set over the balance — the leader decides this one.' : 'The notice claims the job’s figure.')}
            onClear={() => void run('Back to the job’s figure', async () => clearLienClaimCorrection(selected.jobId), 'Cleared — the notice claims the job’s figure.')}
          />
        }
        claimTail={
          // Retainage inside the claim (v2.3753, counsel): named on the form so the owner traps it now; the figure lives on the job.
          retainageInsideClaim(claimed.claim, job?.lien_retainage_held) > 0 ? (
            <span data-lien-claim-retainage="yes">
              Includes <strong style={{ color: 'var(--text-700)' }}>{formatUsdNoCents(retainageInsideClaim(claimed.claim, job?.lien_retainage_held))}</strong> unpaid retainage {gc?.name ?? 'the GC'} holds — named on the form.
              {office ? <button type="button" onClick={() => onOpenEditJob(selected.jobId, 'lien-contract')} style={{ border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: '0.72rem', fontWeight: 600, padding: '0 0 0 4px' }}>Change ›</button> : null}
            </span>
          ) : job?.lien_retainage_held == null && office ? (
            <span data-lien-claim-retainage="unset">
              Retainage {gc?.name ?? 'the GC'} holds: not recorded.
              <button type="button" onClick={() => onOpenEditJob(selected.jobId, 'lien-contract')} style={{ border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: '0.72rem', fontWeight: 600, padding: '0 0 0 4px' }}>Set on the job ›</button>
            </span>
          ) : null
        }
        onNoteMissed={office ? (month) => void noteMissed([month]) : undefined}
        onRecordByHand={office ? () => setByHandOpen(true) : undefined}
        claim={formatUsdNoCents(claimed.claim)}
        onToggle={(key, on) => {
          const next = new Set(months)
          if (on) next.add(key)
          else next.delete(key)
          setCheckedMonths(next)
        }}
      />

      {/* The envelope (v2.3776): who the paper goes to and the cover-note switch, with the paper they describe — the footer keeps only the verbs. */}
      <div className="lienEnvelope" data-lien-desk-send-line>
        <span>
          ✉ To <strong>{ownerName || 'the owner of record'}</strong> and <strong>{gc?.name || 'the original contractor'}</strong> by certified mail{gc?.email ? <span className="lienFootMuted"> · courtesy PDF to {gc.email}</span> : null}
        </span>
        <label title={`${lienNoticeCoverNote(noticeFields.claimantName, monthsList)} — routine paper, not a claim of default`}>
          <input type="checkbox" checked={coverNote} disabled={item != null && item.status !== 'drafted'} onChange={(ev) => setCoverNote(ev.target.checked)} />
          <span>Include the cover note</span>
        </label>
      </div>

      {/* The paper is the editor (v2.3694): the four values the office may change sit in shaded boxes on the notice itself; this row keeps only the legend and the preview door. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.3rem 0.8rem', padding: '0.4rem 0.75rem', border: '1px solid var(--border)', borderRadius: 9, background: 'var(--surface)', fontSize: '0.75rem', color: 'var(--text-muted)' }} data-lien-desk-paper-legend>
        {wordingLocked ? (
          <span>{office ? 'Sent for approval — pull it back to a draft to change the wording.' : 'The values in a box were typed by the office; the rest is the statute’s form or filled from the job.'}</span>
        ) : (
          <span>
            <span aria-hidden="true" style={{ display: 'inline-block', width: 22, height: 12, verticalAlign: 'middle', marginRight: 6, borderRadius: 4, background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber-soft)' }} />a shaded box is yours to change — click it, on the paper · plain text is the statute’s form or filled from the job; hover says where
          </span>
        )}
        <span style={{ flex: 1 }} />
        <button type="button" onClick={openPreview} style={linkBtn} title="The notice as the packet prints it, in its own tab, with the values you can change marked">
          Preview in a new window ↗
        </button>
      </div>

      {/* What goes in the envelope (v2.3540): the cover page first while it is ticked, then the notice — the pages as the packet prints them. */}
      {coverHtml ? (
        <>
          <div style={{ ...boxHead, marginBottom: '-0.3rem' }} data-lien-desk-page-label>Page 1 of {pageTotal} · cover note</div>
          <div data-theme="light" data-lien-desk-cover style={paperStyle}>
            <div dangerouslySetInnerHTML={{ __html: coverHtml }} />
          </div>
        </>
      ) : null}
      <div style={{ ...boxHead, marginBottom: '-0.3rem' }} data-lien-desk-page-label>
        {`Page ${coverHtml ? 2 : 1} of ${pageTotal} · the notice`}{' '}
        <span style={{ fontWeight: 400, letterSpacing: 0, textTransform: 'none', color: wordingDiff.length ? 'var(--text-amber-800)' : undefined }}>
          · {wordingDiff.length ? wordingLineText(wordingDiff, wordingEditedBy) : payHtml ? 'the pay codes and the invoice follow it in the packet' : "the job's unpaid invoice follows it in the packet"}
        </span>
      </div>
      <div data-theme="light" data-lien-desk-paper ref={paperRef} onClick={onPaperClick} style={{ ...paperStyle, position: 'relative' }}>
        <div dangerouslySetInnerHTML={{ __html: docHtml }} />
        {editing ? (
          <input
            ref={editInputRef}
            aria-label={LIEN_NOTICE_FIELD_GUIDE.find((g) => g.key === editing.key)?.label ?? editing.key}
            value={editing.value}
            onChange={(ev) => setEditing((e) => (e ? { ...e, value: ev.target.value } : e))}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter') {
                ev.preventDefault()
                commitEdit()
              } else if (ev.key === 'Escape') {
                ev.preventDefault()
                setEditing(null)
              }
            }}
            onBlur={commitEdit}
            placeholder={LIEN_NOTICE_FIELD_GUIDE.find((g) => g.key === editing.key)?.source}
            data-lien-desk-paper-input
            style={{ position: 'absolute', top: editing.rect.top, left: editing.rect.left, width: Math.max(editing.rect.width, 160), minHeight: editing.rect.height, boxSizing: 'border-box', font: editing.font || 'inherit', fontWeight: 600, color: 'var(--text-strong)', padding: '0.1em 0.5em', border: '2px solid #d97706', borderRadius: 5, background: 'var(--bg-amber-tint)', outline: 'none', zIndex: 3 }}
          />
        ) : null}
      </div>

      {/* The pay page (punch list #35, PR 3): one code per unpaid Stripe bill, as the run prints it behind the owner's copy. Nothing on it is typed — it is filled from the bills. */}
      {payHtml ? (
        <>
          <div style={{ ...boxHead, marginBottom: '-0.3rem' }} data-lien-desk-page-label>
            {`Page ${pageTotal} of ${pageTotal} · pay codes`}{' '}
            <span style={{ fontWeight: 400, letterSpacing: 0, textTransform: 'none' }}>· {payPageSummary(payPage.rows)} · filled from the bills, nothing to type</span>
          </div>
          <div data-theme="light" data-lien-desk-pay style={paperStyle}>
            <div dangerouslySetInnerHTML={{ __html: payHtml }} />
          </div>
        </>
      ) : null}

      {leader && (selected.pile === 'awaiting' || selected.pile === 'held' || selected.pile === 'to_draft') && selected.gcCustomerId ? (
        <div style={boxStyle}>
          <div style={boxHead}>Standing rule for {gc?.name ?? 'this GC'}</div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.8125rem' }}>
            {LIEN_NOTICE_POLICIES.map((p) => (
              <label key={p.key} title={p.hint} style={{ display: 'inline-flex', gap: 5, alignItems: 'center', padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 6, background: (rulePick ?? selected.policy) === p.key ? 'var(--bg-blue-tint)' : 'var(--bg-subtle)' }}>
                <input type="radio" name="lien-rule" checked={(rulePick ?? selected.policy) === p.key} onChange={() => { setRulePick(p.key); void saveRule(p.key) }} />
                {p.label}
              </label>
            ))}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>A rule sets the default for every future month on every {gc?.name ?? 'GC'} job. You still see each send in your FYI list, and a live promise always comes back to you.{gcHasPriorNotice ? '' : ' “Send” starts with the second notice — this first one comes to you either way, so the office proves the addresses on real mail first.'}</div>
        </div>
      ) : null}
    </div>
  ) : (
    <div style={{ padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{isMobile ? '' : 'Pick a job on the left.'}</div>
  )

  // ---------- affidavits: the list and the pane (v2.3412) ----------
  const affList = (
    <div style={{ borderRight: isMobile ? 'none' : '1px solid var(--border)', overflow: 'auto', minWidth: 0 }}>
      {affVisible.length === 0 ? (
        <p style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
          {loading || data == null ? 'Looking at every unpaid job…' : affPile ? 'Nothing in this pile.' : 'No affidavit window closes within 30 days.'}
        </p>
      ) : null}
      {LIEN_AFFIDAVIT_PILES.map((p) => {
        const rows = affVisible.filter((e) => e.pile === p.key)
        if (rows.length === 0) return null
        return (
          <div key={p.key}>
            <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0.6rem 0.9rem 0.2rem' }}>{p.label}</div>
            {rows.map((e) => {
              const j = data?.jobsById[e.jobId]
              const g = e.gcCustomerId ? data?.gcsById[e.gcCustomerId] : undefined
              const sel = e.jobId === affSelected?.jobId
              const missing = e.gates.filter((x) => !x.ok).map((x) => x.key)
              return (
                <button
                  key={e.jobId}
                  type="button"
                  onClick={() => {
                    setAffSelectedJobId(e.jobId)
                    setMobileListShown(false)
                  }}
                  aria-current={sel ? 'true' : undefined}
                  style={{ display: 'grid', gridTemplateColumns: '8px 1fr auto', gap: '0.2rem 0.6rem', width: '100%', textAlign: 'left', padding: '0.5rem 0.9rem', border: 'none', borderTop: '1px solid var(--border)', background: sel ? 'var(--bg-blue-tint)' : 'transparent', cursor: 'pointer', font: 'inherit', color: 'inherit', fontSize: '0.8125rem' }}
                >
                  <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 6, background: e.severity === 'red' ? 'var(--text-red-600)' : e.severity === 'amber' ? 'var(--text-amber-800)' : 'var(--border-strong)' }} />
                  <span style={{ minWidth: 0 }}>
                    <strong>{jobLabel(j, e.jobId)}</strong>
                    <span style={{ color: 'var(--text-muted)' }}> · {e.isSub ? `GC ${g?.name ?? ''}` : 'with the owner'}</span>
                  </span>
                  <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatUsdNoCents(e.openBalance)}</span>
                  <span style={{ gridColumn: '2 / 4', display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    <span style={chip(severityColors(e.severity).bg, severityColors(e.severity).fg)}>{affidavitDeadlineWords(e)}</span>
                    {(() => {
                      // Counsel's piles (v2.3767): from the owner's answers on the sent notice.
                      const pile = affidavitPileFor(data?.ownerCallByJob[e.jobId])
                      if (!pile) return null
                      const tone = pile === 'A' ? chip('var(--bg-green-tint)', 'var(--text-green-800)') : pile === 'B' ? chip('var(--bg-amber-tint)', 'var(--text-amber-800)') : chip('var(--bg-red-tint)', 'var(--text-red-600)')
                      return <span style={tone} data-lien-affidavit-pile={pile}>{pile} · {AFFIDAVIT_PILE_WORDS[pile].short}</span>
                    })()}
                    <span>last work {workMonthShort(e.lastMonth)}</span>
                    {missing.length ? <span>· missing {missing.join(', ')}</span> : null}
                  </span>
                </button>
              )
            })}
          </div>
        )
      })}
    </div>
  )
  const affPane =
    affSelected && data ? (
      <LienDeskAffidavitPane
        key={affSelected.jobId}
        entry={affSelected}
        data={data}
        workMonths={workMonths?.[affSelected.jobId] ?? null}
        todayYmd={todayYmd}
        authRole={authRole}
        authUserId={authUserId}
        authName={authName}
        issuer={issuer}
        signerNameFor={signerNameFor}
        onChanged={onChanged}
        onOpenEditJob={onOpenEditJob}
        ownerCall={data.ownerCallByJob[affSelected.jobId] ?? null}
        bond={parsePaymentBond(data.jobsById[affSelected.jobId]?.lien_payment_bond)}
        onOpenLienContract={(jobId) => onOpenEditJob(jobId, 'lien-contract')}
        onOpenLienAffidavit={(jobId) => (onOpenLienAffidavit ?? onOpenLienInstruments)(jobId)}
        onOpenLegalDesk={onOpenLegalDesk}
        onShowNotices={(jobId) => {
          setKind('notice')
          setSelectedJobId(jobId)
        }}
        footerEl={affFooterEl}
      />
    ) : (
      <div style={{ padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{isMobile ? '' : 'Pick a job on the left.'}</div>
    )

  // ---------- retainage: the list and the pane (v2.3753) ----------
  const retList = (
    <div style={{ borderRight: isMobile ? 'none' : '1px solid var(--border)', overflow: 'auto', minWidth: 0 }} data-lien-retainage-list>
      {retVisible.length === 0 ? (
        <p style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
          {loading || data == null ? 'Looking at every job with retainage…' : retPile ? 'Nothing in this pile.' : 'No job with a GC has retainage recorded. Edit Job → Our contract on this job is where it goes.'}
        </p>
      ) : null}
      {LIEN_RETAINAGE_PILES.map((p) => {
        const rows = retVisible.filter((e) => e.pile === p.key)
        if (rows.length === 0) return null
        return (
          <div key={p.key}>
            <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0.6rem 0.9rem 0.2rem' }}>{p.label}</div>
            {rows.map((e) => {
              const j = data?.jobsById[e.jobId]
              const g = e.gcCustomerId ? data?.gcsById[e.gcCustomerId] : undefined
              const sel = e.jobId === retSelected?.jobId
              return (
                <button
                  key={e.jobId}
                  type="button"
                  onClick={() => {
                    setRetSelectedJobId(e.jobId)
                    setMobileListShown(false)
                  }}
                  aria-current={sel ? 'true' : undefined}
                  style={{ display: 'grid', gridTemplateColumns: '8px 1fr auto', gap: '0.2rem 0.6rem', width: '100%', textAlign: 'left', padding: '0.5rem 0.9rem', border: 'none', borderTop: '1px solid var(--border)', background: sel ? 'var(--bg-blue-tint)' : 'transparent', cursor: 'pointer', font: 'inherit', color: 'inherit', fontSize: '0.8125rem' }}
                >
                  <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 6, background: e.severity === 'red' ? 'var(--text-red-600)' : e.severity === 'amber' ? 'var(--text-amber-800)' : 'var(--border-strong)' }} />
                  <span style={{ minWidth: 0 }}>
                    <strong>{jobLabel(j, e.jobId)}</strong>
                    <span style={{ color: 'var(--text-muted)' }}> · {g?.name ?? ''}</span>
                  </span>
                  <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatUsdNoCents(e.retainageHeld)}</span>
                  <span style={{ gridColumn: '2 / 4', display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    <span style={chip(severityColors(e.severity).bg, severityColors(e.severity).fg)}>{retainageDeadlineWords(e, formatYmdMonthDay)}</span>
                    <span>{contractEndedWords(e.contractEndedHow, e.contractEndedOn, formatYmdMonthDay)}</span>
                    <span>· {e.inClaim ? 'in the § 53.056 claim' : 'not yet in a § 53.056 claim'}</span>
                  </span>
                </button>
              )
            })}
          </div>
        )
      })}
    </div>
  )
  const retPane =
    retSelected && data ? (
      <LienDeskRetainagePane
        key={retSelected.jobId}
        entry={retSelected}
        data={data}
        todayYmd={todayYmd}
        authRole={authRole}
        authUserId={authUserId}
        authName={authName}
        issuer={issuer}
        signerNameFor={signerNameFor}
        onChanged={onChanged}
        onOpenEditJob={onOpenEditJob}
        onOpenRun={() => setRunOpen(true)}
        onShowNotices={(jobId) => {
          setKind('notice')
          setSelectedJobId(jobId)
        }}
        footerEl={retFooterEl}
      />
    ) : (
      <div style={{ padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{isMobile ? '' : 'Pick a job on the left.'}</div>
    )

  // Record a notice that already went out (#35 PR 2) — the desk passes its own claim and months; the pane writes one filing per covered job and the desk re-reads.
  const byHandPane =
    selected && byHandOpen ? (
      <LienNoticeByHandPane
        job={{
          id: selected.jobId,
          label: jobLabel(job, selected.jobId),
          jobAddress: job?.job_address ?? null,
          customerAddressId: job?.customer_address_id ?? null,
          amount: claimed.claim,
          itemId: selected.item && selected.item.status !== 'sent' && selected.item.status !== 'missed' ? selected.item.id : null,
        }}
        fields={noticeFields}
        appClaim={claimed.claim}
        appClaimIsTimely={false}
        defaultMonths={monthsList}
        todayYmd={todayYmd}
        userId={authUserId}
        onClose={() => setByHandOpen(false)}
        onRecorded={() => {
          setByHandOpen(false)
          onChanged()
        }}
      />
    ) : null

  // ---------- footer by state / role ----------
  let footer: React.ReactNode = null
  if (selected) {
    const state = selected.pile
    const monthsWord = monthsList.length ? describeNoticeMonths(monthsList) : 'no months'
    if (state === 'needs_owner' || state === 'to_draft' || (state === 'missed' && selected.dueMonths.length > 0)) {
      const blocked = !ready
      // The draft footer (v2.3776, punch list #36): ONE row — the state and its verb on the left, Save draft and a quiet
      // Skip on the right. The envelope line sits above the paper; the why is a parenthetical, not a sentence; the skip's
      // cost is said in its confirm step. Blocked, the primary is the way to the gate that blocks (a dim dead button taught nothing).
      const firstBlocker = gates.find((g) => g.tone === 'blocker') ?? null
      const stateWords = blocked
        ? firstBlocker
          ? firstBlocker.value.toLowerCase() === 'missing'
            ? `${firstBlocker.label} missing`
            : `${firstBlocker.label} · ${firstBlocker.value.toLowerCase()}`
          : monthsList.length === 0
            ? 'Pick at least one month'
            : 'This cannot go yet'
        : leader
          ? 'Approving puts it in the run'
          : claimGate
            ? 'Goes to the leader'
            : ruleLive && !promise
              ? 'Straight into the run'
              : selected.policy === 'hold' && !promise
                ? 'Parks under the hold rule'
                : 'Goes to the leader'
      const stateWhy = blocked
        ? readiness.reason === 'public_owner'
          ? PUBLIC_OWNER_DESK_SENTENCE
          : ''
        : leader
          ? promise
            ? `they promised ${formatYmdMonthDay(promise.promisedYmd)} — the paper or their word`
            : askReason && askReason !== 'no_rule'
              ? LIEN_ASK_REASON_LABELS[askReason]
              : ''
          : claimGate
            ? correctionGateWords(claimGate)
            : ruleLive && !promise
              ? 'standing “send” rule'
              : selected.policy === 'send' && !promise
                ? 'first notice to this GC — the rule starts with the next one'
                : selected.policy === 'hold' && !promise
                  ? 're-asks before the deadline'
                  : promise
                    ? `they promised ${formatYmdMonthDay(promise.promisedYmd)} — the paper or their word`
                    : askReason && askReason !== 'no_rule'
                      ? LIEN_ASK_REASON_LABELS[askReason]
                      : `no standing rule for ${gc?.name ?? 'this GC'}`
      footer = (
        <>
          {byHandPane ? (
            byHandPane
          ) : skipOpen ? (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem' }}>
              <span style={{ color: 'var(--text-red-600)' }}>Skipping gives up the lien right on {monthsWord}.</span>
              <input value={skipReason} onChange={(ev) => setSkipReason(ev.target.value)} placeholder="why (kept on the record)" aria-label="Skip reason" style={{ flex: '1 1 200px', padding: '4px 8px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit', font: 'inherit', fontSize: '0.8125rem' }} />
              <button type="button" onClick={skip} disabled={busy || !skipReason.trim()} style={btn('amber', busy || !skipReason.trim())}>Skip these months</button>
              <button type="button" onClick={() => setSkipOpen(false)} style={btn('plain')}>Cancel</button>
            </div>
          ) : wordOpen ? (
            <LienWordRecordRow
              note={wordNote}
              onNote={setWordNote}
              channel={wordChannel}
              onChannel={setWordChannel}
              radioName="word-channel"
              recorderName={authName}
              actionLabel="Record it and send ▸"
              onAction={sendOnWord}
              actionDisabled={busy || !wordNote.trim()}
              actionBlock={wordRecordBlock(claimGate, wordChannel)}
              onCancel={() => setWordOpen(false)}
              btn={btn}
            />
          ) : (
            <div className="lienFootRow" data-lien-desk-next data-blocked={blocked ? 'yes' : 'no'}>
              <span className="lienFootState">
                <span aria-hidden="true">{blocked ? '✗' : '→'}</span> {stateWords}
                {stateWhy ? <span className="lienFootWhy"> · {stateWhy}</span> : null}
              </span>
              <span className="lienFootSpacer" />
              {office && monthsList.length > 0 ? (
                <>
                <button type="button" className="lienFootSkip" onClick={() => setSkipOpen(true)} disabled={busy} title="Give up the lien right on these months on purpose, with a reason kept on the record — it stays under Earlier months">
                  Skip {monthsList.map(workMonthShort).join(' + ')}…
                </button>
                <button type="button" className="lienFootSkip" onClick={() => setByHandOpen(true)} disabled={busy} data-lien-desk-by-hand title="The paper was printed here and went out by hand — record when, how, what it claimed, and which jobs at the property it covered">
                  Already mailed? Record it…
                </button>
                </>
              ) : null}
              <div className="lienFootActions">
                <button type="button" onClick={saveDraft} disabled={busy || !office || monthsList.length === 0} style={btn('plain', busy || !office || monthsList.length === 0)}>Save draft</button>
                {canSendOnWord(authRole) && !blocked ? (
                  <button type="button" onClick={() => { setWordNote(`the leader, ${demandDate(todayYmd)}`); setWordOpen(true) }} disabled={busy} style={btn('plain', busy)} title="The leader already said to send it — record who, when and how, and it goes in the run">
                    The leader said to send it…
                  </button>
                ) : null}
                {blocked ? (
                  <button type="button" onClick={() => (firstBlocker ? pickGate(firstBlocker.key) : paneRef.current?.scrollTo?.({ top: 0, behavior: 'smooth' }))} style={btn('primary')} data-lien-desk-go-to-gate>
                    {firstBlocker ? `Go to gate ${firstBlocker.n} ▴` : 'Show what is missing ▴'}
                  </button>
                ) : leader ? (
                  <button type="button" onClick={() => run('Approve', async () => { const id = await ensureDraft(); await approveLienDeskItem(id) }, 'Approved — it is in the run.')} disabled={busy} style={btn('green', busy)}>
                    Approve ▸
                  </button>
                ) : (
                  <button type="button" onClick={sendToLeader} disabled={busy || !office} style={btn('primary', busy || !office)}>
                    {ruleLive && !promise && !claimGate ? 'Put it in the run ▸' : 'Send for approval ▸'}
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )
    } else if (state === 'awaiting') {
      footer = byHandPane ?? (leader ? (
        <>
          {holdOpen ? (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem' }}>
              <span>
                Holds until <strong>{formatYmdMonthDay(holdUntilFor(holdOpen, selected.earliestDeadline, promise?.promisedYmd ?? null, todayYmd))}</strong>, then asks again.{' '}
                <span style={{ color: 'var(--text-red-600)' }}>{monthsList[0] ? `${workMonthLabel(monthsList[0])}'s lien right ends ${selected.earliestDeadline ? demandDate(selected.earliestDeadline) : ''}.` : ''}</span>
              </span>
              <button type="button" onClick={() => hold(holdOpen)} disabled={busy} style={btn('amber', busy)}>Hold</button>
              <button type="button" onClick={() => setHoldOpen(null)} style={btn('plain')}>Cancel</button>
            </div>
          ) : (
            <div className="lienFootRow" data-lien-desk-next data-blocked="no">
              <span className="lienFootState">
                <span aria-hidden="true">→</span> Your call on {monthsWord}
                {rulePick ? <span className="lienFootWhy"> · keeps the rule “{LIEN_NOTICE_POLICIES.find((p) => p.key === rulePick)?.label}”</span> : null}
              </span>
              <span className="lienFootSpacer" />
              <button type="button" onClick={() => setHoldOpen('promised')} disabled={busy} style={btn('plain', busy)}>Hold — they promised…</button>
              <button type="button" onClick={() => setHoldOpen('call_first')} disabled={busy} style={btn('plain', busy)}>Hold — I'll call first</button>
              <button type="button" onClick={pullBack} disabled={busy} style={btn('plain', busy)}>Back to the office</button>
              <button type="button" onClick={() => setByHandOpen(true)} disabled={busy} style={btn('plain', busy)} data-lien-desk-by-hand title="The paper was printed here and already went out by hand — record it instead of approving">Already mailed? Record it…</button>
              <button type="button" onClick={approve} disabled={busy} style={btn('green', busy)}>Approve &amp; next ▸</button>
            </div>
          )}
        </>
      ) : wordOpen ? (
        <LienWordRecordRow
          note={wordNote}
          onNote={setWordNote}
          channel={wordChannel}
          onChannel={setWordChannel}
          radioName="word-channel"
          recorderName={authName}
          leadIn="He is here — who, when, and how:"
          actionLabel="Record it and send ▸"
          onAction={sendOnWord}
          actionDisabled={busy || !wordNote.trim()}
          actionBlock={wordRecordBlock(claimGate, wordChannel)}
          onCancel={() => setWordOpen(false)}
          btn={btn}
        />
      ) : (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          <span>Waiting on the leader since {selected.item?.submitted_at ? demandDate(selected.item.submitted_at.slice(0, 10)) : '—'}.</span>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={() => setByHandOpen(true)} disabled={!office || busy} style={btn('plain', !office || busy)} data-lien-desk-by-hand title="The paper was printed here and already went out by hand — record it, and this stops waiting">
            Already mailed? Record it…
          </button>
          <button type="button" onClick={pullBack} disabled={busy || !office} style={btn('plain', busy || !office)}>Pull back to draft</button>
          {canSendOnWord(authRole) ? (
            <button
              type="button"
              onClick={() => { setWordNote(`the leader, ${demandDate(todayYmd)}`); setWordChannel('standing_over'); setWordOpen(true) }}
              disabled={busy}
              style={btn('amber', busy)}
              data-lien-desk-leader-here
              title="The leader is beside you — write down that he is standing here or typing it in, and it goes to Ready to send on his word"
            >
              He is here — record it ▸
            </button>
          ) : null}
        </div>
      ))
    } else if (state === 'ready') {
      footer = byHandPane ?? (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          <span>
            {selected.item?.approval_mode === 'word' ? `On ${wordRecordWords(selected.item).slice(3)}` : selected.item?.approval_mode === 'rule' ? `Approved by ${gc?.name ?? 'the GC'}'s standing rule` : `Approved${selected.item?.approved_at ? ` ${demandDate(selected.item.approved_at.slice(0, 10))}` : ''}`} · in the run.
          </span>
          {leader && selected.item?.approval_mode === 'word' ? (
            <button type="button" onClick={pullBack} disabled={busy} style={btn('plain', busy)} title="Pull it back to the office's draft — it has not gone out">Not what I said</button>
          ) : null}
          <span style={{ flex: 1 }} />
          <button type="button" onClick={() => setByHandOpen(true)} disabled={!office || busy} style={btn('plain', !office || busy)} data-lien-desk-by-hand title="The paper was printed here and already went out by hand — record it instead of sending the run">
            Already mailed? Record it…
          </button>
          <button type="button" onClick={() => onOpenLienInstruments(selected.jobId)} disabled={!office} style={btn('plain', !office)} title="One notice on its own: print or email it and record the sends in the Lien window">
            Just this one, from the Lien window ›
          </button>
          <button type="button" onClick={() => setRunOpen(true)} disabled={!office} style={btn('primary', !office)} title="Every approved notice as one packet and one tracking form">
            Send the run · {counts?.ready ?? 0} ▸
          </button>
        </div>
      )
    } else if (state === 'held') {
      footer = byHandPane ?? (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          <span>
            Held{selected.item?.hold_reason === 'promised' ? ' — they promised' : selected.item?.hold_reason === 'rule' ? ` — ${gc?.name ?? 'the GC'}'s standing rule` : " — the leader will call first"} · asks again {selected.item?.hold_until ? demandDate(selected.item.hold_until) : ''}.{' '}
            <span style={{ color: 'var(--text-red-600)' }}>{monthsList[0] ? `${workMonthLabel(monthsList[0])}'s lien right ends ${selected.earliestDeadline ? demandDate(selected.earliestDeadline) : ''}.` : ''}</span>
          </span>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={() => setByHandOpen(true)} disabled={!office || busy} style={btn('plain', !office || busy)} data-lien-desk-by-hand title="The paper was printed here and already went out by hand — record it, and this stops waiting">
            Already mailed? Record it…
          </button>
          {leader ? <button type="button" onClick={approve} disabled={busy} style={btn('green', busy)}>Release the hold and approve ▸</button> : null}
          <button type="button" onClick={pullBack} disabled={busy || !office} style={btn('plain', busy || !office)}>Back to draft</button>
        </div>
      )
    } else if (state === 'sent') {
      // Letter two (v2.3760): what has happened since the packet went out, and the two doors — the GC's written okay, or the second letter.
      const lt = data?.letterTwoByJob[selected.jobId]
      // The first packet's item carries the GC's okay and the owner's call; the entry's item may be a later letter two.
      const first = (lt?.firstItemId ? data?.items.find((i) => i.id === lt.firstItemId) : null) ?? selected.item
      const call = data?.ownerCallByJob[selected.jobId] ?? null
      const jobBalance = Math.max(0, Number(job?.revenue ?? 0) - Number(job?.payments_made ?? 0))
      // Counsel's sign-off (#41 PR 3, v2.3790): the memo's moment — an owner paying Click direct while the GC is silent needs
      // counsel's per-job okay. Read from the firm's matter through `legalSignoff`; no matter with the firm, no door.
      const signoff = legalSignoff?.stateFor(selected.jobId) ?? null
      const signoffLine = signoff ? signoffWords(signoff, demandDate) : ''
      const startTwo = (kind: LetterTwoKind) => {
        if (!first) return
        setLetterTwoMenu(false)
        const fields: LienDeskDraftFields = {
          notice: jobDefaults,
          gcEmail: storedDraft?.gcEmail || gc?.email || '',
          ...(storedDraft?.batchReason ? { batchReason: storedDraft.batchReason } : {}),
          ...(storedDraft?.staleNote ? { staleNote: storedDraft.staleNote } : {}),
          ...(storedDraft?.monthsDatedFromCreation ? { monthsDatedFromCreation: true as const } : {}),
          coverLetter: letterTwoTemplate(kind, { gcName: gc?.name ?? '', claimantName: jobDefaults.claimantName }),
          letterTwo: { kind, afterItemId: first.id, afterSentAt: first.sent_at ?? '' },
        }
        void run('Start letter two', async () => void (await startLetterTwo({ first, fields, userId: authUserId })), 'Letter two drafted — read it on the paper, then send it for approval.')
      }
      const noteOkay = () => {
        if (!first) return
        void run('Note the GC’s okay', async () => noteGcAuthorizedDirectPay(first, { name: authName, note: gcOkayNote }), 'Noted — letter two is off; the owner may pay us against a release.').then((ok) => {
          if (ok) {
            setGcOkayOpen(false)
            setGcOkayNote('')
          }
        })
      }
      footer = (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }} data-lien-since-sent>
            <span>Sent <strong style={{ color: 'var(--text-700)' }}>{first?.sent_at ? demandDate(first.sent_at.slice(0, 10)) : ''}</strong> · on the job's lien instruments</span>
            {lt && lt.day != null ? <span>Day <strong style={{ color: 'var(--text-700)' }}>{lt.day}</strong></span> : null}
            <span>GC paid: <strong style={{ color: 'var(--text-700)' }}>{jobBalance <= 0.005 ? 'yes' : 'no'}</strong></span>
            <span>GC authorized direct pay: <strong style={{ color: 'var(--text-700)' }}>{lt?.gcAuthorized ? `yes · ${formatYmdMonthDay(lt.gcAuthorized.at.slice(0, 10))}${lt.gcAuthorized.note ? ` · ${lt.gcAuthorized.note}` : ''}` : 'no'}</strong></span>
            {lt?.letterTwo ? <span>Letter two: <strong style={{ color: 'var(--text-700)' }}>{lt.words}</strong></span> : null}
            {signoff ? <span data-lien-counsel-signoff style={signoff.state === 'signed_off' ? { color: 'var(--text-green-800)' } : signoff.state === 'declined' ? { color: 'var(--text-red-600)' } : undefined}>Counsel: <strong style={{ color: 'inherit' }}>{signoffLine || 'not asked'}</strong></span> : null}
            <span data-lien-owner-called>Owner called: <strong style={{ color: 'var(--text-700)' }}>{call ? ownerCallWords(call, formatYmdMonthDay, formatUsdNoCents) : 'not yet'}</strong>{call && affidavitPileFor(call) ? <span style={{ ...chip('var(--bg-green-tint)', 'var(--text-green-800)'), marginLeft: 6 }}>Pile {affidavitPileFor(call)}</span> : null}</span>
          </div>
          {gcOkayOpen ? (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem' }}>
              <span>The GC's written okay for the owner to pay us — where it is and when:</span>
              <input value={gcOkayNote} onChange={(ev) => setGcOkayNote(ev.target.value)} placeholder="email from Harborline, Sep 15" aria-label="The GC's okay — where and when" style={{ flex: '1 1 200px', padding: '4px 8px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit', font: 'inherit', fontSize: '0.8125rem' }} />
              <button type="button" onClick={noteOkay} disabled={busy || !gcOkayNote.trim()} style={btn('green', busy || !gcOkayNote.trim())} data-lien-gc-okay-record>Record it ▸</button>
              <button type="button" onClick={() => setGcOkayOpen(false)} style={btn('plain')}>Cancel</button>
            </div>
          ) : signoffOpen ? (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem' }} data-lien-desk-signoff>
              <span style={{ color: 'var(--text-muted)' }}>Ask counsel to sign off on {gc?.name ?? 'the GC'}'s job:</span>
              <input value={signoffText} onChange={(ev) => setSignoffText(ev.target.value)} aria-label="The ask" style={{ flex: '1 1 260px', padding: '4px 8px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit', font: 'inherit', fontSize: '0.8125rem' }} />
              <button type="button" disabled={busy || !signoffText.trim()} style={btn('primary', busy || !signoffText.trim())} onClick={() => void run('Ask counsel', async () => { const err = await legalSignoff!.ask(selected.jobId, signoffText.trim()); if (err) throw new Error(err) }, 'Asked — the firm sees it on their portal; their answer lands on your Needs You list.').then((ok) => { if (ok) setSignoffOpen(false) })}>Send to the firm</button>
              <button type="button" onClick={() => setSignoffOpen(false)} style={btn('plain')}>Cancel</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              <span>
                {lt?.state === 'sent' ? 'Letter two went out. The next step is the affidavit, on its own date.' : lt?.state === 'gc_authorized' ? 'The GC said the owner may pay us — take the check against a release; no second letter.' : lt?.state === 'paid' || jobBalance <= 0.005 ? 'Paid — nothing more to send.' : lt && letterTwoIsDue(lt) ? `Letter two goes 10–14 days after the packet when the GC has neither paid nor authorized a direct payment — day ${lt.day}${lt.state === 'overdue' ? ', past the 14' : ''}. Same form, same two recipients, the GC copied by the same mail.` : `Letter two goes 10–14 days after the packet if the GC has neither paid nor authorized a direct payment${lt?.day != null ? ` — day ${lt.day} today` : ''}.`}
              </span>
              <span style={{ flex: 1 }} />
              {office && first && signoff && signoff.state !== 'asked' && jobBalance > 0.005 ? <button type="button" onClick={() => { setSignoffText(defaultSignoffAsk({ gcName: gc?.name ?? '', amount: `$${Math.round(jobBalance).toLocaleString('en-US')}` })); setSignoffOpen(true) }} disabled={busy} style={btn('plain', busy)} data-lien-desk-ask-signoff title="The owner wants to pay Click direct while the GC is silent — counsel signs off per job before the office takes the check (counsel's memo)">Ask counsel to sign off…</button> : null}
              {office && first ? <button type="button" onClick={() => setOwnerCallOpen(true)} disabled={busy} style={btn('plain', busy)} data-lien-owner-call-door>{call ? 'The owner called again…' : 'Record the owner’s call…'}</button> : null}
              {office && first && !lt?.gcAuthorized && jobBalance > 0.005 && lt?.state !== 'sent' ? <button type="button" onClick={() => setGcOkayOpen(true)} disabled={busy} style={btn('plain', busy)} data-lien-gc-okay>The GC authorized direct pay…</button> : null}
              {office && first && jobBalance > 0.005 && lt?.state !== 'sent' && lt?.state !== 'in_flight' ? (
                <span style={{ position: 'relative' }}>
                  <button type="button" onClick={() => setLetterTwoMenu((o) => !o)} disabled={busy} aria-haspopup="menu" aria-expanded={letterTwoMenu} style={lt && letterTwoIsDue(lt) ? { ...btn('amber', busy) } : btn('plain', busy)} data-lien-letter-two-door>Send letter two ▸</button>
                  {letterTwoMenu ? (
                    <>
                      <div onClick={() => setLetterTwoMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 5 }} />
                      <div role="menu" aria-label="Letter two — pick the letter" style={{ position: 'absolute', right: 0, bottom: 'calc(100% + 4px)', zIndex: 6, minWidth: 320, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 8, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
                        <div style={{ ...boxHead, padding: '0.4rem 0.75rem 0.1rem' }}>Letter two · pick the letter</div>
                        {LETTER_TWO_KINDS.map((k) => (
                          <button key={k.key} type="button" role="menuitem" onClick={() => startTwo(k.key)} style={{ display: 'grid', gap: 2, width: '100%', padding: '0.45rem 0.75rem', border: 'none', borderTop: '1px solid var(--border)', background: 'var(--surface)', textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit', fontSize: '0.8125rem' }} data-lien-letter-two-kind={k.key}>
                            <strong>{k.label}</strong>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{k.hint}</span>
                          </button>
                        ))}
                        <div style={{ padding: '0.35rem 0.75rem 0.5rem', borderTop: '1px solid var(--border)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>Drafts the letter on this job's notice — read it on the paper, then send it for approval as usual.</div>
                      </div>
                    </>
                  ) : null}
                </span>
              ) : null}
            </div>
          )}
        </>
      )
    } else if (state === 'missed') {
      footer = (
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-red-600)' }}>
          The window closed on {selected.missedMonths.map(workMonthLabel).join(', ')} with no notice — the lien right on that work is gone. {selected.item?.status === 'missed' ? `Skipped: ${parseLienDeskDraftFields(selected.item.fields)?.skipReason ?? ''}` : ''}
        </div>
      )
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Lien desk"
      // The Dispatch / Job mode footer is fixed at z 1000; the overlay ends above it (--app-bottom-chrome, v2.2184) so the buttons are never under the bar (v2.3522).
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 'var(--app-bottom-chrome, 0px)', background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 80 }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderRadius: 10, width: 'min(1140px, calc(100vw - 2rem))', maxHeight: 'calc(100dvh - 2rem - var(--app-bottom-chrome, 0px))', display: 'grid', gridTemplateRows: 'auto 1fr auto', overflow: 'hidden' }}
      >
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem 0.5rem', padding: '0.7rem 2.6rem 0.6rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
          <h2
            style={{ margin: '0 0.4rem 0 0', fontSize: '1.125rem', cursor: 'help' }}
            title="Every unpaid work month on a job with a GC needs its own § 53.056 notice — the office readies and drafts, the leader approves once per GC or per notice, the run goes out and is recorded. The help guide “send lien notices from the Lien desk” has the whole flow."
          >
            ⏱ Lien desk
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ position: 'absolute', right: '0.8rem', top: '0.5rem', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-muted)', padding: 4 }}>×</button>
          <div role="tablist" aria-label="Kind" style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 7, overflow: 'hidden', marginRight: '0.4rem' }}>
            {(['notice', 'affidavit', 'retainage', 'timeline'] as const).map((k) => (
              <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)} style={{ padding: '2px 10px', border: 'none', background: kind === k ? FILL.primary : 'var(--surface)', color: kind === k ? '#fff' : 'var(--text-700)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }} title={k === 'retainage' ? 'The § 53.057 notice of claim for unpaid retainage — one per job, 30 days after our contract on it ends' : k === 'timeline' ? 'Every billed job with money open and a lien month — the whole path, sorted by the next date; Print the grid for counsel' : undefined}>
                {k === 'notice' ? `Notices${counts ? ` · ${entries.filter((e) => e.pile !== 'sent').length}` : ''}` : k === 'affidavit' ? `Affidavits${data ? ` · ${affCount}` : ''}` : k === 'retainage' ? `Retainage${data ? ` · ${retCount}` : ''}` : `Timeline${book ? ` · ${book.counts.due}` : ''}`}
              </button>
            ))}
          </div>
          <LienRulesDoor where={kind === 'affidavit' ? 'desk_affidavit' : 'desk_notice'} style={{ marginRight: '0.4rem' }} />
          {kind === 'retainage'
            ? LIEN_RETAINAGE_PILES.map((p) => {
                const n = data?.retainage.counts[p.key] ?? 0
                if (n === 0 && retPile !== p.key) return null
                const on = retPile === p.key
                return (
                  <button key={p.key} type="button" aria-pressed={on} onClick={() => setRetPile(on ? null : p.key)} style={{ padding: '2px 10px', borderRadius: 999, border: `1px solid ${on ? 'var(--bg-blue-tint)' : 'var(--border-strong)'}`, background: on ? 'var(--bg-blue-tint)' : 'var(--surface)', color: on ? 'var(--text-blue-800)' : 'var(--text-700)', fontSize: '0.78rem', fontWeight: on ? 600 : 500, cursor: 'pointer' }}>
                    {p.label} · <strong>{n}</strong>
                  </button>
                )
              })
            : null}
          {kind === 'affidavit'
            ? LIEN_AFFIDAVIT_PILES.map((p) => {
                const n = data?.affidavits.counts[p.key] ?? 0
                if (n === 0 && affPile !== p.key) return null
                const on = affPile === p.key
                return (
                  <button key={p.key} type="button" aria-pressed={on} onClick={() => setAffPile(on ? null : p.key)} style={{ padding: '2px 10px', borderRadius: 999, border: `1px solid ${on ? 'var(--bg-blue-tint)' : 'var(--border-strong)'}`, background: on ? 'var(--bg-blue-tint)' : 'var(--surface)', color: on ? 'var(--text-blue-800)' : 'var(--text-700)', fontSize: '0.78rem', fontWeight: on ? 600 : 500, cursor: 'pointer' }}>
                    {p.label} · <strong>{n}</strong>
                  </button>
                )
              })
            : null}
          {kind === 'notice' ? LIEN_DESK_PILES.map((p) => {
            const n = counts?.[p.key] ?? 0
            if (n === 0 && pile !== p.key) return null
            const on = pile === p.key
            return (
              <button key={p.key} type="button" aria-pressed={on} onClick={() => setPile(on ? null : p.key)} style={{ padding: '2px 10px', borderRadius: 999, border: `1px solid ${on ? 'var(--bg-blue-tint)' : 'var(--border-strong)'}`, background: on ? 'var(--bg-blue-tint)' : 'var(--surface)', color: on ? 'var(--text-blue-800)' : 'var(--text-700)', fontSize: '0.78rem', fontWeight: on ? 600 : 500, cursor: 'pointer' }}>
                {p.label} · <strong>{n}</strong>
              </button>
            )
          }) : null}
          {kind === 'notice' && office && onPutGcOnNotice && gcPickerOptions.length > 0 ? (
            <div style={{ position: 'relative', marginLeft: 'auto' }}>
              <button type="button" onClick={() => setGcPickerOpen((o) => !o)} aria-haspopup="menu" aria-expanded={gcPickerOpen} style={{ ...btn('plain'), background: 'var(--bg-amber-tint)', borderColor: 'var(--border-amber)', color: 'var(--text-amber-800)' }} title="Every owner on every job with a failing GC gets the § 53.056 notice for every unnoticed month, in one approved run">
                ⚠ Put a GC on notice…
              </button>
              {gcPickerOpen ? (
                <>
                  <div onClick={() => setGcPickerOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 5 }} />
                  <div role="menu" aria-label="GCs with unpaid work" style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 6, minWidth: 300, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 8, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
                    <div style={{ ...boxHead, padding: '0.4rem 0.75rem 0.1rem' }}>GCs with notices due · most open first</div>
                    {gcPickerOptions.map((g) => (
                      <button key={g.id} type="button" role="menuitem" onClick={() => { setGcPickerOpen(false); onPutGcOnNotice(g.id) }} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', width: '100%', padding: '0.45rem 0.75rem', border: 'none', borderTop: '1px solid var(--border)', background: 'var(--surface)', textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit', fontSize: '0.8125rem' }}>
                        <span><strong>{g.name}</strong>{g.policy === 'send' ? <span style={{ ...chip('var(--bg-subtle)', 'var(--text-muted)'), marginLeft: 6 }}>rule: send</span> : null}</span>
                        <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{g.jobs} job{g.jobs === 1 ? '' : 's'} · {formatUsdNoCents(g.open)}</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
          {kind !== 'affidavit' && office && (counts?.ready ?? 0) + retReady > 0 ? (
            <button type="button" onClick={() => setRunOpen(true)} style={{ ...btn('primary'), marginLeft: kind === 'notice' && onPutGcOnNotice && gcPickerOptions.length > 0 ? 0 : 'auto' }} title="Every approved notice — monthly and retainage — as one packet and one tracking form">
              Send the run · {(counts?.ready ?? 0) + retReady}
            </button>
          ) : null}
          {leader && wordSent.length > 0 ? (
            <span style={{ marginLeft: office && (counts?.ready ?? 0) > 0 ? 0 : 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }} title="Notices the office sent on your spoken word">
              Sent on your word: {wordSent.map((e) => jobLabel(data?.jobsById[e.jobId], e.jobId).split(' · ')[0]).join(', ')}
            </span>
          ) : null}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile || kind === 'timeline' ? '1fr' : '320px 1fr', overflow: 'hidden', minHeight: 0 }}>
          {kind === 'timeline' ? (
            <LienDeskTimelineTab
              book={book}
              loading={bookLoading}
              error={bookError}
              gcId={bookGcId}
              onGcId={setBookGcId}
              show={bookShow}
              onShow={setBookShow}
              onOpenRow={openBookRow}
              onPrint={(rows, title) => printHtmlInNewWindow(lienGridHtml(rows, { title, todayYmd, companyName: issuer?.companyName ?? '' }))}
            />
          ) : kind === 'affidavit'
            ? (isMobile ? (mobileListShown ? affList : affPane) : (
                <>
                  {affList}
                  {affPane}
                </>
              ))
            : kind === 'retainage'
              ? (isMobile ? (mobileListShown ? retList : retPane) : (
                  <>
                    {retList}
                    {retPane}
                  </>
                ))
            : isMobile ? (mobileListShown ? list : pane) : (
            <>
              {list}
              {pane}
            </>
          )}
        </div>
        {kind === 'affidavit' ? <div ref={setAffFooterEl} className="lienDeskFooterSlot" data-lien-desk-footer="affidavit" /> : null}
        {kind === 'retainage' ? <div ref={setRetFooterEl} className="lienDeskFooterSlot" data-lien-desk-footer="retainage" /> : null}
        {kind === 'notice' && footer ? <div style={{ display: 'grid', gap: '0.5rem', padding: '0.6rem 1.25rem 0.9rem', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>{footer}</div> : null}
      </div>
      {ownerCallOpen && selected && data ? (() => {
        const lt = data.letterTwoByJob[selected.jobId]
        const first = (lt?.firstItemId ? data.items.find((i) => i.id === lt.firstItemId) : null) ?? selected.item
        if (!first) return null
        return (
          <LienOwnerCallDialog
            jobLabel={jobLabel(job, selected.jobId)}
            ownerName={ownerName}
            gcName={gc?.name ?? ''}
            existing={data.ownerCallByJob[selected.jobId] ?? null}
            takerName={authName}
            busy={busy}
            onClose={() => setOwnerCallOpen(false)}
            onSave={(c) => void run('Record the owner’s call', async () => noteOwnerCall(first, c), 'Recorded — the affidavit pile and the grid read it.').then((ok) => { if (ok) setOwnerCallOpen(false) })}
          />
        )
      })() : null}
      {runOpen && data ? (
        <LienDeskRunModal
          notices={[...buildLienDeskRun(data.queue.piles.ready, data, issuer, signerNameFor, todayYmd, signerPhoneFor), ...buildLienRetainageRun(data.retainage.piles.ready, data, issuer, signerNameFor, todayYmd)]}
          issuer={issuer}
          todayYmd={todayYmd}
          userId={authUserId}
          onClose={() => setRunOpen(false)}
          onRecorded={onChanged}
        />
      ) : null}
    </div>
  )
}
