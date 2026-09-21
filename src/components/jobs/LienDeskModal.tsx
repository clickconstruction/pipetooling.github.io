import { useEffect, useMemo, useRef, useState } from 'react'
import type { PhysicalInvoiceIssuer } from '../../lib/physicalInvoiceIssuer'
import { buildLienNoticeBlocks, filingDocHtml, filingLetterheadFromIssuer, type FilingDocExtras, type LienNoticeFields } from '../../lib/jobsDocuments/lienFilingDocuments'
import { LIEN_NOTICE_FIELD_GUIDE, LIEN_NOTICE_PREVIEW_EDIT_MESSAGE, LIEN_NOTICE_PREVIEW_MESSAGE, LIEN_NOTICE_PREVIEW_SAVE_MESSAGE, LIEN_NOTICE_TYPED_FIELDS, applyWordingEdits, buildLienNoticePreviewHtml, isTypedNoticeField, lienNoticePreviewPages, noticeWordingDiff, wordingLineText } from '../../lib/jobs/lienNoticePreview'
import { demandDate } from '../../lib/jobsDocuments/demandLetter'
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
  type LienNoticePolicy,
} from '../../lib/jobs/lienDesk'
import {
  approveLienDeskItem,
  holdLienDeskItem,
  pullBackLienDeskItem,
  saveLienDeskDraft,
  sendLienDeskItemOnWord,
  setCustomerLienNoticePolicy,
  skipLienDeskItem,
  submitLienDeskItem,
} from '../../lib/jobs/lienDeskIo'
import { buildLienNoticeFieldsForJob, describeNoticeMonths, lienNoticeCoverNote, parseLienDeskDraftFields, type LienDeskDraftFields } from '../../lib/jobs/lienNoticeDraft'
import type { LienDeskData, LienDeskJob } from '../../hooks/useLienDeskData'
import { useToastContext } from '../../contexts/ToastContext'
import { useIsMobile } from '../../hooks/useIsMobile'
import { buildLienDeskRun, runCoverNoteBlocks } from '../../lib/jobs/lienDeskRun'
import { fillCoverLetter } from '../../lib/jobs/gcOnNotice'
import LienDeskRunModal from './LienDeskRunModal'
import LienDeskAffidavitPane, { affidavitDeadlineWords } from './LienDeskAffidavitPane'
import LienDeskOwnerPane from './LienDeskOwnerPane'
import LienDeskGates from './LienDeskGates'
import LienDeskMonths, { type LienDeskMonthCard } from './LienDeskMonths'
import { buildLienMonthHistory } from '../../lib/jobs/lienMonthHistory'
import { buildLienDeskGates, lienGateMonthLine, ownerSourceWords, propertyKindClockWords, type LienGate, type LienGateKey } from '../../lib/jobs/lienDeskGates'
import { rollMailingLines } from '../../lib/jobs/rollMailingLines'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { txCountyCadPropertyUrl, txCountyCadSearchUrl } from '../../lib/txCountyLookup'
import PropertyKindSwitch from './PropertyKindSwitch'
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
  /** Land on this job's item when given (the forecast's Send notice…, the row icon). */
  initialJobId?: string | null
  /** Re-read after any write. */
  onChanged: () => void
  /** "Find the owner" — Edit Job → Property record. */
  /** `focus` opens Edit Job on its Property record row — where the property kind is set (v2.3667). */
  onOpenEditJob: (jobId: string, focus?: 'property-record') => void
  /** The send door until the run ships: the Lien window on its notice tab. */
  onOpenLienInstruments: (jobId: string) => void
  /** Affidavits (v2.3412): the Lien window on its affidavit tab — print for notarization, file, record. */
  onOpenLienAffidavit?: (jobId: string) => void
  /** A filed affidavit still unpaid → the Legal desk. */
  onOpenLegalDesk?: () => void
  /** Open on the affidavit kind (the Dashboard's filing-window card). */
  initialKind?: 'notice' | 'affidavit'
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
  initialJobId,
  onChanged,
  onOpenEditJob,
  onOpenLienInstruments,
  onOpenLienAffidavit,
  onOpenLegalDesk,
  initialKind,
  onPutGcOnNotice,
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
  const [pile, setPile] = useState<LienDeskPile | null>(null)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [checkedMonths, setCheckedMonths] = useState<ReadonlySet<string> | null>(null)
  const [coverNote, setCoverNote] = useState(true)
  const [wordOpen, setWordOpen] = useState(false)
  const [wordNote, setWordNote] = useState('')
  const [wordChannel, setWordChannel] = useState<'phone' | 'in_person' | 'text'>('phone')
  const [skipOpen, setSkipOpen] = useState(false)
  const [skipReason, setSkipReason] = useState('')
  const [holdOpen, setHoldOpen] = useState<'promised' | 'call_first' | null>(null)
  const [rulePick, setRulePick] = useState<LienNoticePolicy | null>(null)
  const [busy, setBusy] = useState(false)
  const [mobileListShown, setMobileListShown] = useState(true)
  // Wording (v2.3522): the four typed values the office may shape, layered over the draft; the paper-first pane's scroll state.
  const [wordingEdits, setWordingEdits] = useState<Partial<LienNoticeFields>>({})
  const previewWinRef = useRef<Window | null>(null)
  const [previewJobId, setPreviewJobId] = useState<string | null>(null)
  const [wordingOpen, setWordingOpen] = useState(false)
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
  const [kind, setKind] = useState<'notice' | 'affidavit'>(initialKind ?? 'notice')
  const [affPile, setAffPile] = useState<LienAffidavitPile | null>(null)
  const [affSelectedJobId, setAffSelectedJobId] = useState<string | null>(null)
  const [affFooter, setAffFooter] = useState<React.ReactNode>(null)
  const affFooterRef = useRef<React.ReactNode>(null)
  const setAffFooterSafe = (node: React.ReactNode) => {
    affFooterRef.current = node
    queueMicrotask(() => setAffFooter(affFooterRef.current))
  }

  const entries = data?.queue.entries ?? []
  const visible = useMemo(() => {
    const list = pile ? entries.filter((e) => e.pile === pile) : entries
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
    setHoldOpen(null)
    setRulePick(null)
    setWordNote('')
    setWordingEdits({})
    setWordingOpen(false)
    setPaneScrolled(false)
    // jsdom has no element scrollTo; the guard keeps the render smokes honest.
    if (typeof paneRef.current?.scrollTo === 'function') paneRef.current.scrollTo({ top: 0 })
  }, [selected?.jobId])
  const months = checkedMonths ?? defaultMonths
  const monthsList = [...months].sort()

  const openBalance = selected?.openBalance ?? 0
  /** The job's own answers for the nine values — what a fresh draft says, and what "edited" is measured against. */
  const jobDefaults = useMemo(
    () =>
      buildLienNoticeFieldsForJob({
        jobName: job?.job_name,
        jobAddress: job?.job_address,
        originalContractorName: gc?.name ?? '',
        openBalance,
        contactPerson: signerNameFor(job?.master_user_id ?? null),
        issuer,
        todayYmd,
      }),
    [job, gc, openBalance, signerNameFor, issuer, todayYmd],
  )
  // The stored draft wins when there is one (the leader approves those exact values); the office's typed wording layers on top.
  const noticeFields = useMemo(() => applyWordingEdits(storedDraft?.notice ?? jobDefaults, wordingEdits), [storedDraft, jobDefaults, wordingEdits])
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
  const docHtml = useMemo(() => filingDocHtml(buildLienNoticeBlocks(noticeFields, docExtras)), [noticeFields, docExtras])
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
      coverLetter: storedDraft?.coverLetter ? fillCoverLetter(storedDraft.coverLetter, { property: (job?.job_address ?? '').trim(), months: describeNoticeMonths(monthsList), job: jobNumber }) : null,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.jobId, job, monthsList.join('|'), noticeFields, docExtras, coverNote, storedDraft?.coverLetter])
  const coverHtml = useMemo(() => (coverBlocks.length ? filingDocHtml(coverBlocks) : ''), [coverBlocks])

  const draftFields = (): LienDeskDraftFields => ({
    notice: noticeFields,
    gcEmail: gc?.email ?? '',
    // A re-save keeps what Put a GC on notice wrote on the item (v2.3522 — these used to be dropped).
    ...(storedDraft?.batchReason ? { batchReason: storedDraft.batchReason } : {}),
    ...(storedDraft?.coverLetter ? { coverLetter: storedDraft.coverLetter } : {}),
    ...(wordingDiff.length > 0 ? { wording: wordingTouched || !storedDraft?.wording ? { editedBy: authName, editedAt: new Date().toISOString() } : storedDraft.wording } : {}),
  })
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
        const outcome = submitOutcome(selected, { promiseYmd: promise?.promisedYmd ?? null, gcHasPriorNotice: Boolean(selected.gcCustomerId && data.gcsWithPriorNotice.has(selected.gcCustomerId)), gcHeldBefore: Boolean(selected.gcCustomerId && data.gcsHeldBefore.has(selected.gcCustomerId)) }, todayYmd)
        await submitLienDeskItem(id, outcome)
      },
      ruleLive && !promise ? 'Approved by the standing rule — it is in the run.' : selected?.policy === 'hold' ? 'Held by the standing rule — it re-asks before the deadline.' : 'Sent for approval.',
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
  })
  const postToPreview = (saved?: 'ok' | 'failed') => {
    const win = previewWinRef.current
    if (!win || win.closed) return
    win.postMessage(lienNoticePreviewPages(previewInput(), saved), window.location.origin)
  }
  const openPreview = () => {
    if (!selected) return
    const html = buildLienNoticePreviewHtml({ ...previewInput(), jobLabel: jobLabel(job, selected.jobId), editable: !wordingLocked })
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
    setWordingOpen(true)
    const field = d.field
    window.setTimeout(() => {
      const el = document.getElementById(`lien-wording-${field}`)
      el?.scrollIntoView({ block: 'center' })
      el?.focus()
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
  }, [open, previewIsThisJob, docHtml, coverHtml, wordingDiff.length, wordingEditedBy])

  if (!open) return null

  const counts = data?.queue.counts
  const affEntries = data?.affidavits.entries ?? []
  const affVisible = (['needs_property', 'to_draft', 'awaiting', 'ready', 'held', 'filed', 'missed'] as LienAffidavitPile[]).flatMap((p) => affEntries.filter((e) => e.pile === p && (affPile == null || affPile === p)))
  const affSelected = affVisible.find((e) => e.jobId === affSelectedJobId) ?? (!isMobile ? affVisible[0] : undefined) ?? null
  const affCount = affEntries.filter((e) => e.pile !== 'filed').length
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
                      ? `on the leader’s word · ${e.item.word_note}`
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
                    <span>{named.map(workMonthShort).join(' + ')}</span>
                    {state ? <span>· {state}</span> : null}
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
  const monthHistory = selected && data ? buildLienMonthHistory(selected.jobId, data.items, selected.months) : []
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
      }
    })

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
  })
  const gateByKey = Object.fromEntries(gates.map((g) => [g.key, g])) as Record<LienGateKey, LienGate>

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
          <span style={{ color: 'var(--text-muted)' }}>
            Claim <strong style={{ color: 'var(--text-strong)' }}>{formatUsdNoCents(openBalance)}</strong>
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
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
          {gc?.name ? `· GC ${gc.name}` : '· no GC'} {job?.job_address ? `· ${job.job_address}` : ''}
        </span>
        {deadlineWords(selected) ? <span style={chip(severityColors(selected.severity).bg, severityColors(selected.severity).fg)}>{workMonthShort(monthsList[0] ?? selected.dueMonths[0] ?? '')} notice {deadlineWords(selected)}</span> : null}
      </div>

      {leader && selected.pile === 'awaiting' ? (
        <div style={boxStyle}>
          <div style={boxHead}>What you're deciding</div>
          {wordingDiff.length ? (
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-amber-800)' }}>{wordingLineText(wordingDiff, wordingEditedBy)} — the notice below carries the changed wording.</div>
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

      {/* Months (v2.3661): open months as tickable cards that spell out the deadline; settled months as dots that open the record. */}
      <LienDeskMonths
        cards={monthCards}
        history={monthHistory.filter((h) => !monthCards.some((c) => c.key === h.month))}
        claim={formatUsdNoCents(openBalance)}
        onToggle={(key, on) => {
          const next = new Set(months)
          if (on) next.add(key)
          else next.delete(key)
          setCheckedMonths(next)
        }}
      />

      {/* Wording (v2.3522): the four values the office may change; the rest is the job's and the statute's. */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 9, background: 'var(--surface)' }} data-lien-desk-wording>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.75rem' }}>
          <button
            type="button"
            onClick={() => setWordingOpen((o) => !o)}
            aria-expanded={wordingOpen}
            style={{ ...boxHead, border: 'none', background: 'none', cursor: 'pointer', padding: 0, font: 'inherit', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: wordingDiff.length ? 'var(--text-amber-800)' : 'var(--text-muted)' }}
          >
            {wordingOpen ? '▾' : '▸'} {wordingLineText(wordingDiff, wordingEditedBy)}
          </button>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={openPreview} style={linkBtn} title="The notice as the packet prints it, in its own tab, with the values you can change marked">
            Preview in a new window ↗
          </button>
        </div>
        {wordingOpen ? (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.45rem 0.9rem', padding: '0 0.75rem 0.65rem' }}>
            {LIEN_NOTICE_FIELD_GUIDE.filter((g) => g.kind === 'typed').map((g) => (
              <label key={g.key} style={{ display: 'grid', gap: 2, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {g.label}
                <input
                  id={`lien-wording-${g.key}`}
                  type="text"
                  value={noticeFields[g.key]}
                  placeholder={g.source}
                  disabled={wordingLocked}
                  onChange={(ev) => setWordingEdits((e) => ({ ...e, [g.key]: ev.target.value }))}
                  style={{ font: 'inherit', fontSize: '0.8125rem', padding: '4px 8px', border: '1px solid var(--border-strong)', borderRadius: 6, background: wordingDiff.includes(g.key) ? 'var(--bg-amber-tint)' : 'var(--surface)', color: 'var(--text-strong)' }}
                />
              </label>
            ))}
            <div style={{ gridColumn: '1 / -1', fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span>The rest of the notice is filled from the job — the GC, the claim amount, the claimant — and the statute's own words. Change those at their source.</span>
              {wordingDiff.length && !wordingLocked ? (
                <button type="button" onClick={() => setWordingEdits(Object.fromEntries(LIEN_NOTICE_TYPED_FIELDS.map((k) => [k, jobDefaults[k]])))} style={linkBtn}>
                  Back to the job's wording
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {/* What goes in the envelope (v2.3540): the cover page first while it is ticked, then the notice — the pages as the packet prints them. */}
      {coverHtml ? (
        <>
          <div style={{ ...boxHead, marginBottom: '-0.3rem' }} data-lien-desk-page-label>Page 1 of 2 · cover note</div>
          <div data-theme="light" data-lien-desk-cover style={paperStyle}>
            <div dangerouslySetInnerHTML={{ __html: coverHtml }} />
          </div>
        </>
      ) : null}
      <div style={{ ...boxHead, marginBottom: '-0.3rem' }} data-lien-desk-page-label>
        {coverHtml ? 'Page 2 of 2 · the notice' : 'Page 1 of 1 · the notice'} <span style={{ fontWeight: 400, letterSpacing: 0, textTransform: 'none' }}>· the job's unpaid invoice follows it in the packet</span>
      </div>
      <div data-theme="light" data-lien-desk-paper style={paperStyle}>
        <div dangerouslySetInnerHTML={{ __html: docHtml }} />
      </div>

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
        todayYmd={todayYmd}
        authRole={authRole}
        authUserId={authUserId}
        issuer={issuer}
        signerNameFor={signerNameFor}
        onChanged={onChanged}
        onOpenEditJob={onOpenEditJob}
        onOpenLienAffidavit={(jobId) => (onOpenLienAffidavit ?? onOpenLienInstruments)(jobId)}
        onOpenLegalDesk={onOpenLegalDesk}
        onShowNotices={(jobId) => {
          setKind('notice')
          setSelectedJobId(jobId)
        }}
        footerSlot={setAffFooterSafe}
      />
    ) : (
      <div style={{ padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{isMobile ? '' : 'Pick a job on the left.'}</div>
    )

  // ---------- footer by state / role ----------
  let footer: React.ReactNode = null
  if (selected) {
    const state = selected.pile
    const monthsWord = monthsList.length ? describeNoticeMonths(monthsList) : 'no months'
    if (state === 'needs_owner' || state === 'to_draft' || (state === 'missed' && selected.dueMonths.length > 0)) {
      const blocked = !ready
      const say = blocked
        ? readiness.reason === 'no_gc'
          ? 'Blocked until the GC is on the job.'
          : readiness.reason === 'no_owner'
            ? 'Blocked until the owner of record is on the property record.'
            : readiness.reason === 'public_owner'
              ? PUBLIC_OWNER_DESK_SENTENCE
              : 'Pick at least one month.'
        : ruleLive && !promise
          ? `${gc?.name} has a standing "send" rule — this goes straight to the run.`
          : selected.policy === 'send' && !promise
            ? `${gc?.name} has a standing "send" rule, but this is the first notice we've sent them — it goes to the leader; the rule starts with the next one.`
          : selected.policy === 'hold'
            ? `${gc?.name} has a standing "hold" rule — this parks and re-asks before the deadline.`
            : promise
              ? `They promised ${formatYmdMonthDay(promise.promisedYmd)} — the leader decides between the paper and their word.`
              : `No standing rule for ${gc?.name ?? 'this GC'}, so this goes to the leader${askReason && askReason !== 'no_rule' ? ` — ${LIEN_ASK_REASON_LABELS[askReason]}` : ''}.`
      // The draft footer (v2.3662): the envelope on one line, then ONE next step — a headline, the why, and a single primary.
      // Blocked, the primary is the way to the gate that blocks (a dim dead button taught nothing); Skip, the one decision
      // here that cannot be undone, is a sentence that states its cost rather than a button beside Save draft.
      const firstBlocker = gates.find((g) => g.tone === 'blocker') ?? null
      const next = blocked
        ? firstBlocker
          ? `Fix gate ${firstBlocker.n} · ${firstBlocker.label.toLowerCase()} — then this can go`
          : 'This cannot go yet'
        : leader
          ? 'Next: you can approve this now'
          : ruleLive && !promise
            ? 'Next: straight into the run'
            : selected.policy === 'hold' && !promise
              ? 'Next: it parks under the hold rule'
              : 'Next: the leader approves it'
      footer = (
        <>
          <div className="lienFootEnvelope" data-lien-desk-send-line>
            <span>
              ✉ Certified mail to <strong>{ownerName || 'the owner of record'}</strong> and <strong>{gc?.name || 'the original contractor'}</strong>
            </span>
            {gc?.email ? <span>Courtesy PDF to {gc.email}</span> : null}
            <label title={lienNoticeCoverNote(noticeFields.claimantName, monthsList)}>
              <input type="checkbox" checked={coverNote} disabled={item != null && item.status !== 'drafted'} onChange={(ev) => setCoverNote(ev.target.checked)} />
              <span>Include the cover note</span>
              <span className="lienFootMuted">— routine paper, not a claim of default</span>
            </label>
          </div>
          {skipOpen ? (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem' }}>
              <span style={{ color: 'var(--text-red-600)' }}>Skipping gives up the lien right on {monthsWord}.</span>
              <input value={skipReason} onChange={(ev) => setSkipReason(ev.target.value)} placeholder="why (kept on the record)" aria-label="Skip reason" style={{ flex: '1 1 200px', padding: '4px 8px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit', font: 'inherit', fontSize: '0.8125rem' }} />
              <button type="button" onClick={skip} disabled={busy || !skipReason.trim()} style={btn('amber', busy || !skipReason.trim())}>Skip these months</button>
              <button type="button" onClick={() => setSkipOpen(false)} style={btn('plain')}>Cancel</button>
            </div>
          ) : wordOpen ? (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem' }}>
              <span>Who said it, when, and how:</span>
              <input value={wordNote} onChange={(ev) => setWordNote(ev.target.value)} placeholder="Robert, today 9:10" aria-label="Who said it and when" style={{ flex: '1 1 180px', padding: '4px 8px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit', font: 'inherit', fontSize: '0.8125rem' }} />
              {(['phone', 'in_person', 'text'] as const).map((c) => (
                <label key={c} style={{ display: 'inline-flex', gap: 4, alignItems: 'center', padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 6, background: wordChannel === c ? 'var(--bg-blue-tint)' : 'var(--bg-subtle)' }}>
                  <input type="radio" name="word-channel" checked={wordChannel === c} onChange={() => setWordChannel(c)} />
                  {c === 'phone' ? 'by phone' : c === 'in_person' ? 'in person' : 'by text'}
                </label>
              ))}
              <button type="button" onClick={sendOnWord} disabled={busy || !wordNote.trim()} style={btn('amber', busy || !wordNote.trim())}>Record it and send ▸</button>
              <button type="button" onClick={() => setWordOpen(false)} style={btn('plain')}>Cancel</button>
            </div>
          ) : (
            <>
              <div className="lienFootNext" data-lien-desk-next data-blocked={blocked ? 'yes' : 'no'}>
                <div>
                  <div className="lienFootNextHead">
                    <span aria-hidden="true">{blocked ? '✗' : '→'}</span> {next}
                  </div>
                  <div className="lienFootNextWhy">
                    <strong>{monthsWord}</strong> · {!blocked && leader ? `Approving puts it in the run${promise ? ` — they promised ${formatYmdMonthDay(promise.promisedYmd)}, so it is the paper or their word` : askReason && askReason !== 'no_rule' ? ` — ${LIEN_ASK_REASON_LABELS[askReason]}` : ''}.` : say}
                    {blocked && askReason && !(ruleLive && !promise) ? ` Once it can go: ${LIEN_ASK_REASON_LABELS[askReason]}.` : ''}
                  </div>
                </div>
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
                      {ruleLive && !promise ? 'Put it in the run ▸' : 'Send for approval ▸'}
                    </button>
                  )}
                </div>
              </div>
              {office && monthsList.length > 0 ? (
                <div className="lienFootSkip">
                  Not sending for {monthsWord}?{' '}
                  <button type="button" onClick={() => setSkipOpen(true)} disabled={busy}>
                    Skip {monthsList.length === 1 ? 'this month' : 'these months'} and give up the lien right…
                  </button>{' '}
                  It stays on the record under Earlier months.
                </div>
              ) : null}
            </>
          )}
        </>
      )
    } else if (state === 'awaiting') {
      footer = leader ? (
        <>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Approves <strong style={{ color: 'var(--text-700)' }}>{monthsWord}</strong> on {jobLabel(job, selected.jobId)}{rulePick ? ` and keeps the rule "${LIEN_NOTICE_POLICIES.find((p) => p.key === rulePick)?.label}"` : ''}.
          </div>
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
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button type="button" onClick={() => setHoldOpen('promised')} disabled={busy} style={btn('plain', busy)}>Hold — they promised…</button>
              <button type="button" onClick={() => setHoldOpen('call_first')} disabled={busy} style={btn('plain', busy)}>Hold — I'll call first</button>
              <button type="button" onClick={pullBack} disabled={busy} style={btn('plain', busy)}>Back to the office</button>
              <span style={{ flex: 1 }} />
              <button type="button" onClick={approve} disabled={busy} style={btn('green', busy)}>Approve &amp; next ▸</button>
            </div>
          )}
        </>
      ) : (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          <span>Waiting on the leader since {selected.item?.submitted_at ? demandDate(selected.item.submitted_at.slice(0, 10)) : '—'}.</span>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={pullBack} disabled={busy || !office} style={btn('plain', busy || !office)}>Pull back to draft</button>
        </div>
      )
    } else if (state === 'ready') {
      footer = (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          <span>
            {selected.item?.approval_mode === 'word' ? `On the leader's word — ${selected.item.word_note}` : selected.item?.approval_mode === 'rule' ? `Approved by ${gc?.name ?? 'the GC'}'s standing rule` : `Approved${selected.item?.approved_at ? ` ${demandDate(selected.item.approved_at.slice(0, 10))}` : ''}`} · in the run.
          </span>
          {leader && selected.item?.approval_mode === 'word' ? (
            <button type="button" onClick={pullBack} disabled={busy} style={btn('plain', busy)} title="Pull it back to the office's draft — it has not gone out">Not what I said</button>
          ) : null}
          <span style={{ flex: 1 }} />
          <button type="button" onClick={() => onOpenLienInstruments(selected.jobId)} disabled={!office} style={btn('plain', !office)} title="One notice on its own: print or email it and record the sends in the Lien window">
            Just this one, from the Lien window ›
          </button>
          <button type="button" onClick={() => setRunOpen(true)} disabled={!office} style={btn('primary', !office)} title="Every approved notice as one packet and one tracking form">
            Send the run · {counts?.ready ?? 0} ▸
          </button>
        </div>
      )
    } else if (state === 'held') {
      footer = (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          <span>
            Held{selected.item?.hold_reason === 'promised' ? ' — they promised' : selected.item?.hold_reason === 'rule' ? ` — ${gc?.name ?? 'the GC'}'s standing rule` : " — the leader will call first"} · asks again {selected.item?.hold_until ? demandDate(selected.item.hold_until) : ''}.{' '}
            <span style={{ color: 'var(--text-red-600)' }}>{monthsList[0] ? `${workMonthLabel(monthsList[0])}'s lien right ends ${selected.earliestDeadline ? demandDate(selected.earliestDeadline) : ''}.` : ''}</span>
          </span>
          <span style={{ flex: 1 }} />
          {leader ? <button type="button" onClick={approve} disabled={busy} style={btn('green', busy)}>Release the hold and approve ▸</button> : null}
          <button type="button" onClick={pullBack} disabled={busy || !office} style={btn('plain', busy || !office)}>Back to draft</button>
        </div>
      )
    } else if (state === 'sent') {
      footer = <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Sent {selected.item?.sent_at ? demandDate(selected.item.sent_at.slice(0, 10)) : ''} · the notice is on the job's lien instruments.</div>
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
            {(['notice', 'affidavit'] as const).map((k) => (
              <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)} style={{ padding: '2px 10px', border: 'none', background: kind === k ? FILL.primary : 'var(--surface)', color: kind === k ? '#fff' : 'var(--text-700)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
                {k === 'notice' ? `Notices${counts ? ` · ${entries.filter((e) => e.pile !== 'sent').length}` : ''}` : `Affidavits${data ? ` · ${affCount}` : ''}`}
              </button>
            ))}
          </div>
          <LienRulesDoor where={kind === 'affidavit' ? 'desk_affidavit' : 'desk_notice'} style={{ marginRight: '0.4rem' }} />
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
          {kind === 'notice' && office && (counts?.ready ?? 0) > 0 ? (
            <button type="button" onClick={() => setRunOpen(true)} style={{ ...btn('primary'), marginLeft: onPutGcOnNotice && gcPickerOptions.length > 0 ? 0 : 'auto' }} title="Every approved notice as one packet and one tracking form">
              Send the run · {counts?.ready}
            </button>
          ) : null}
          {leader && wordSent.length > 0 ? (
            <span style={{ marginLeft: office && (counts?.ready ?? 0) > 0 ? 0 : 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }} title="Notices the office sent on your spoken word">
              Sent on your word: {wordSent.map((e) => jobLabel(data?.jobsById[e.jobId], e.jobId).split(' · ')[0]).join(', ')}
            </span>
          ) : null}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '320px 1fr', overflow: 'hidden', minHeight: 0 }}>
          {kind === 'affidavit'
            ? (isMobile ? (mobileListShown ? affList : affPane) : (
                <>
                  {affList}
                  {affPane}
                </>
              ))
            : isMobile ? (mobileListShown ? list : pane) : (
            <>
              {list}
              {pane}
            </>
          )}
        </div>
        {kind === 'affidavit' && affFooter ? <div style={{ display: 'grid', gap: '0.5rem', padding: '0.6rem 1.25rem 0.9rem', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>{affFooter}</div> : null}
        {kind === 'notice' && footer ? <div style={{ display: 'grid', gap: '0.5rem', padding: '0.6rem 1.25rem 0.9rem', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>{footer}</div> : null}
      </div>
      {runOpen && data ? (
        <LienDeskRunModal
          notices={buildLienDeskRun(data.queue.piles.ready, data, issuer, signerNameFor, todayYmd)}
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
