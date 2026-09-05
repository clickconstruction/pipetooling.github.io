import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import {
  buildGcStatementRequestInsert,
  describePendingGcStatementSend,
  type PendingGcStatementSend,
} from '../../lib/gcStatementSchedule'
import {
  cancelGcStatementSend,
  listMyPendingGcStatementSends,
  scheduleGcStatementSend,
} from '../../lib/gcStatementEmailRequests'
import {
  formatWeekdays,
  groupStandingCopies,
  planStandingCopyEdit,
  chicagoYmdOf,
  type StandingCopyGroup,
} from '../../lib/gcStatementStandingCopies'
import { addDaysYmd, formatMinutes, parseHhMm } from '../../lib/emailSchedule/emailScheduleWeek'
import type { StageRow } from '../../lib/jobsStagesBoard'
import { buildGcReviewRollup, type GcReviewGroup, type GcReviewGroupBy } from '../../lib/gcReviewRollup'
import {
  buildGcReviewShareAllEmailHtml,
  buildGcReviewShareAllEmailText,
  buildGcStatementEmailHtml,
  buildGcStatementEmailPreviewHtml,
  buildGcStatementEmailText,
  gcReviewShareAllEmailSubject,
  gcStatementEmailSubject,
} from '../../lib/jobsDocuments/gcStatementEmail'
import { openHtmlPreviewWindow } from '../../lib/jobsDocuments/printWindow'
import {
  GC_ROUND_THRESHOLD,
  buildStatementRound,
  deriveGcAccountMen,
  describeRoundMark,
  mergeMarksIntoLastSent,
  sendChannelLabel,
  summarizeStatementRound,
  type RoundMarkRow,
  type StatementSendChannel,
} from '../../lib/jobs/gcStatementRounds'
import {
  deleteGcStatementRoundMark,
  listGcStatementRoundMarks,
  listGcStatementSenders,
  setGcStatementSender,
  upsertGcStatementRoundMark,
} from '../../lib/gcStatementRoundIo'
import { formatCurrency } from '../../lib/jobs/jobFormMoney'
import {
  gcGroupCertStatus,
  gcReviewSentThisWeek,
  gcReviewWeekProgress,
  gcReviewWeekStartYmd,
  latestCertByGc,
  type GcReviewCertRow,
} from '../../lib/jobs/gcReviewCertification'
import { listGcReviewCertifications } from '../../lib/gcReviewCertifications'
import GcReviewCertifyModal from './GcReviewCertifyModal'
import GcStatementMarkSentForm from './GcStatementMarkSentForm'
import { groupStatementRoundChains, planStatementRoundChainEdit, type StatementRoundRequestRow } from '../../lib/statementRoundEmail'
import {
  applyStatementRoundChainPlan,
  fetchStatementRoundEmailPreview,
  listPendingStatementRoundRequests,
  sendStatementRoundEmailTest,
} from '../../lib/statementRoundEmailClient'
import GcStatementSendHistoryModal from './GcStatementSendHistoryModal'
import GcSenderRoundCard from './GcSenderRoundCard'
import GcHardHatIcon from '../icons/GcHardHatIcon'
import { TeammateEmailChips } from './TeammateEmailChips'
import { buildTeammateEmailChips } from '../../lib/teammateEmailChips'
import { ccTextIncludes, parseCcEmails, toggleCcEmailInText, GC_STATEMENT_CC_MAX } from '../../lib/gcStatementCc'
import { gcEmailChip } from '../../lib/teammateEmailChips'
import { fetchPhysicalInvoiceIssuerFromAppSettings, getPhysicalInvoiceIssuerForDocument } from '../../lib/physicalInvoiceIssuer'
import DevelopmentHouseIcon from '../icons/DevelopmentHouseIcon'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import CustomerPortalGlobeButton from '../customers/CustomerPortalGlobeButton'
import { useGcPortalLinks } from '../../hooks/useGcPortalLinks'
import { gcPortalLinkCaption } from '../../lib/portal/gcPortalLink'
import { useToastContext } from '../../contexts/ToastContext'
import { supabase } from '../../lib/supabase'

/** Tomorrow's civil date in the company calendar zone, YYYY-MM-DD. */
function chicagoTomorrowYmd(): string {
  return addDaysYmd(chicagoYmdOf(new Date()), 1)
}

/** "Send now | Schedule…" controls shared by the Email… and Share-all dialogs (v2.1427). */
function ScheduleWhenControls({
  when,
  setWhen,
  sendDate,
  setSendDate,
  sendTime,
  setSendTime,
  repeatWeekly,
  setRepeatWeekly,
  disabled,
}: {
  when: 'now' | 'schedule'
  setWhen: (w: 'now' | 'schedule') => void
  sendDate: string
  setSendDate: (v: string) => void
  sendTime: string
  setSendTime: (v: string) => void
  repeatWeekly: boolean
  setRepeatWeekly: (v: boolean) => void
  disabled: boolean
}) {
  const pill = (active: boolean): React.CSSProperties => ({
    padding: '0.2rem 0.6rem',
    fontSize: '0.75rem',
    fontWeight: 500,
    fontFamily: 'inherit',
    border: 'none',
    borderRadius: 999,
    cursor: 'pointer',
    background: active ? 'var(--bg-blue-tint)' : 'transparent',
    color: active ? 'var(--text-link)' : 'var(--text-muted)',
  })
  return (
    <div style={{ marginBottom: '0.6rem' }}>
      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 2 }}>When</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span
          role="group"
          aria-label="Send timing"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.15rem', padding: '0.15rem', border: '1px solid var(--border)', borderRadius: 999 }}
        >
          <button type="button" disabled={disabled} onClick={() => setWhen('now')} aria-pressed={when === 'now'} style={pill(when === 'now')}>
            Send now
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setWhen('schedule')
              // Default to tomorrow 7 AM Central so "Schedule send" works
              // immediately (v2.1429 — an empty date read as a dead button).
              if (!sendDate) setSendDate(chicagoTomorrowYmd())
            }}
            aria-pressed={when === 'schedule'}
            style={pill(when === 'schedule')}
          >
            Schedule…
          </button>
        </span>
        {when === 'schedule' ? (
          <>
            <input
              type="date"
              value={sendDate}
              onChange={(e) => setSendDate(e.target.value)}
              disabled={disabled}
              aria-label="Send date"
              style={{ padding: '0.3rem 0.45rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.8125rem' }}
            />
            <input
              type="time"
              value={sendTime}
              onChange={(e) => setSendTime(e.target.value)}
              disabled={disabled}
              aria-label="Send time (Central)"
              style={{ padding: '0.3rem 0.45rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.8125rem' }}
            />
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Central</span>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={repeatWeekly}
                onChange={() => setRepeatWeekly(!repeatWeekly)}
                disabled={disabled}
                style={{ margin: 0 }}
              />
              Repeat weekly
            </label>
          </>
        ) : null}
      </div>
      {when === 'schedule' ? (
        <p style={{ margin: '0.35rem 0 0', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
          Scheduled sends rebuild the statement fresh at send time — a GC with nothing outstanding is skipped, never
          emailed an empty statement.
        </p>
      ) : null}
    </div>
  )
}

const gcShareMenuItemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '0.45rem 0.75rem',
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  fontSize: '0.8125rem',
  color: 'var(--text-gray-800)',
  textAlign: 'left',
  borderRadius: 4,
  whiteSpace: 'nowrap',
}

export type SendGcStatementPayload = {
  gcCustomerId: string | null
  gcName: string
  /** 'all' = the whole GC Review report in one email ("Share all", v2.1420). */
  groupBy: GcReviewGroupBy | 'all'
  toEmail: string
  /** CC recipients (v2.2160), normalized by parseCcEmails; omitted/empty = none. */
  ccEmails?: string[]
  subject: string
  emailHtml: string
  emailText: string
  total: number
  jobCount: number
}

type JobsGcReviewModalProps = {
  open: boolean
  onClose: () => void
  billedActiveRows: StageRow[]
  collectionsRows: StageRow[]
  /** Shell glue: build the statement HTML and open the print window (toast on popup block). */
  onPrint: (groups: GcReviewGroup[], groupBy: GcReviewGroupBy) => void
  /** Shell glue: copy the GC-facing statement (rich HTML + plain text) for pasting into an email (v2.1414). */
  onCopyForEmail: (group: GcReviewGroup, groupBy: GcReviewGroupBy, extra?: { portalUrl?: string | null }) => void
  /** Shell transport for the Email… dialog: invoke send-gc-statement-email (v2.1416). */
  onSendStatement: (payload: SendGcStatementPayload) => Promise<{ ok: boolean; error?: string }>
  /** Prefill for the Email… dialog's To field (customers.contact_info email; '' when unknown). */
  emailForGc: (gcCustomerId: string) => string
  /** "Last sent" hints per GC customer id (ISO timestamps), loaded by the shell when the modal opens. */
  lastSentByGcId: Record<string, string>
  /** Office user roster for the Standing copies picker (v2.1431). */
  users: Array<{ id: string; name: string; email: string | null; role: string }>
  /** Standing copies management is dev-only. */
  isDev: boolean
  /**
   * Click a job row → open Edit Job ON TOP of this modal (v2.1976; Edit Job's
   * overlay z outranks this one). The shell's onSaved refetch re-derives the
   * row props, so the rollup refreshes in place with the modal still open.
   */
  onOpenJob?: (jobId: string) => void
  /** Wednesday certification (v2.1983): office roles that may certify groups. */
  canCertify: boolean
  /** Certify checklist job links → Job Detail on top (kept open under it). */
  onOpenJobDetail?: (jobId: string) => void
  /** Open with the personal statement round overlay already up (the Stages "Start round" card, v2.2072). */
  startInRound?: boolean
  /** With startInRound: walk the overlay starting ON this GC (the round email's per-GC button, v2.2812). */
  startInRoundGcId?: string | null
}

/**
 * GC Review (v2.1181): Billed Awaiting Payment grouped by the job's GC — each
 * General Contractor's outstanding total and their customers' bill-out dates.
 * A "Group by" pill toggle re-runs the same rollup by the job's DEVELOPMENT
 * instead (shown only when a row has one). Same overlay pattern as the "by
 * Job Name" modal in JobsStagesTab; rollup math lives in the pure
 * gcReviewRollup kernel so the grand total reconciles with the section header
 * by construction.
 */
export function JobsGcReviewModal({
  open,
  onClose,
  billedActiveRows,
  collectionsRows,
  onPrint,
  onCopyForEmail,
  onSendStatement,
  emailForGc,
  lastSentByGcId,
  users,
  isDev,
  onOpenJob,
  canCertify,
  onOpenJobDetail,
  startInRound,
  startInRoundGcId,
}: JobsGcReviewModalProps) {
  /** Collections jobs ride along by default (v2.2764, owner call); untick to see active billing only. */
  const [includeCollections, setIncludeCollections] = useState(true)
  const [groupBy, setGroupBy] = useState<GcReviewGroupBy>('gc')
  /** Email… dialog state — one group at a time; To/Subject editable before Send. */
  const [emailDialogGroup, setEmailDialogGroup] = useState<GcReviewGroup | null>(null)
  const [emailDialogTo, setEmailDialogTo] = useState('')
  /** CC row (v2.2160): free text, chips toggle addresses in and out of it. */
  const [emailDialogCcText, setEmailDialogCcText] = useState('')
  const [emailDialogSubject, setEmailDialogSubject] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  /** Draft Message: include the GC's portal card (v2.2151) — on by default whenever the GC has an active portal. */
  const [emailIncludePortal, setEmailIncludePortal] = useState(true)
  /** "Share all" dialog (v2.1420): print or email the whole report. */
  const [shareAllOpen, setShareAllOpen] = useState(false)
  const [shareAllTo, setShareAllTo] = useState('')
  const [shareAllSubject, setShareAllSubject] = useState('')
  const [shareAllSending, setShareAllSending] = useState(false)
  const [shareAllError, setShareAllError] = useState<string | null>(null)
  /** Per-GC "Share" dropdown (v2.1423) — the open group's key, one at a time. */
  const [shareMenuGroupKey, setShareMenuGroupKey] = useState<string | null>(null)
  /** Scheduling (v2.1427, gc_statement stream Phase 3): Send now vs Schedule… per dialog. */
  const { user: authUser } = useAuth()
  const [emailWhen, setEmailWhen] = useState<'now' | 'schedule'>('now')
  const [emailSendDate, setEmailSendDate] = useState('')
  const [emailSendTime, setEmailSendTime] = useState('07:00')
  const [emailRepeatWeekly, setEmailRepeatWeekly] = useState(false)
  const [shareAllWhen, setShareAllWhen] = useState<'now' | 'schedule'>('now')
  const [shareAllSendDate, setShareAllSendDate] = useState('')
  const [shareAllSendTime, setShareAllSendTime] = useState('07:00')
  const [shareAllRepeatWeekly, setShareAllRepeatWeekly] = useState(false)
  const [pendingSends, setPendingSends] = useState<PendingGcStatementSend[]>([])
  /** Wednesday certification (v2.1983): this week's attestations + the open checklist. */
  const certWeekStart = gcReviewWeekStartYmd()
  const [certRows, setCertRows] = useState<GcReviewCertRow[]>([])
  const [certifyGroup, setCertifyGroup] = useState<GcReviewGroup | null>(null)
  const refreshCerts = useCallback(() => {
    listGcReviewCertifications(certWeekStart).then(setCertRows, () => setCertRows([]))
  }, [certWeekStart])
  // Freeze the page behind the modal (v2.2144): the review scrolls inside its own panel; the Stages board under it must not.
  useBodyScrollLock(open)
  useEffect(() => {
    if (open) refreshCerts()
  }, [open, refreshCerts])
  /** Personal statement rounds (v2.2072): weekly marks + standing senders. */
  const [roundMarks, setRoundMarks] = useState<RoundMarkRow[]>([])
  const [roundSenders, setRoundSenders] = useState<Map<string, string>>(new Map())
  const [roundOpen, setRoundOpen] = useState(false)
  const [roundStartTotal, setRoundStartTotal] = useState(0)
  const [roundBusy, setRoundBusy] = useState(false)
  const [roundError, setRoundError] = useState<string | null>(null)
  const [assigningGcId, setAssigningGcId] = useState<string | null>(null)
  /** Mark sent with channel + note (v2.2761): the round overlay's inline form, the Share → Mark sent… dialog, and the send-history dialog. */
  const [roundSentFormOpen, setRoundSentFormOpen] = useState(false)
  const [markSentGroup, setMarkSentGroup] = useState<GcReviewGroup | null>(null)
  const [historyGc, setHistoryGc] = useState<{ id: string; name: string } | null>(null)
  /** The sender card (v2.2792): one sender's round as they see it — opens from any rounds chip or the per-sender tally. */
  const [senderCard, setSenderCard] = useState<{ senderId: string; highlightGcId: string | null } | null>(null)
  /** Send from the app inside the round (v2.2771): which GC's Draft Message came from the overlay, so the overlay comes back after. */
  const [emailFromRoundGcId, setEmailFromRoundGcId] = useState<string | null>(null)
  /** "Email me my round" (v2.2771, statement_round stream): pending chains + the edit form. */
  const [roundEmailRows, setRoundEmailRows] = useState<StatementRoundRequestRow[]>([])
  const [roundEmailOpen, setRoundEmailOpen] = useState(false)
  const [roundEmailRecipient, setRoundEmailRecipient] = useState('')
  const [roundEmailWeekdays, setRoundEmailWeekdays] = useState<number[]>([1, 3])
  const [roundEmailTime, setRoundEmailTime] = useState('07:00')
  const [roundEmailBusy, setRoundEmailBusy] = useState(false)
  const [roundEmailError, setRoundEmailError] = useState<string | null>(null)
  const [roundEmailNotice, setRoundEmailNotice] = useState<string | null>(null)
  const refreshRoundEmailRows = useCallback(() => {
    void listPendingStatementRoundRequests().then(setRoundEmailRows, () => setRoundEmailRows([]))
  }, [])
  useEffect(() => {
    if (open) refreshRoundEmailRows()
  }, [open, refreshRoundEmailRows])
  const refreshRoundMarks = useCallback(() => {
    void listGcStatementRoundMarks(certWeekStart).then(setRoundMarks, () => setRoundMarks([]))
  }, [certWeekStart])
  useEffect(() => {
    if (open) refreshRoundMarks()
  }, [open, refreshRoundMarks])
  /** Standing copies form (v2.1431, dev-only): teammates + weekdays for recurring whole-report emails. */
  const [standingUserId, setStandingUserId] = useState('')
  const [standingOutsideEmail, setStandingOutsideEmail] = useState('')
  const [standingWeekdays, setStandingWeekdays] = useState<number[]>([])
  const [standingTimeHm, setStandingTimeHm] = useState('07:00')
  const [standingEditingEmail, setStandingEditingEmail] = useState<string | null>(null)
  const [standingBusy, setStandingBusy] = useState(false)
  const [standingError, setStandingError] = useState<string | null>(null)
  useEffect(() => {
    if (!open) return
    let cancelled = false
    void listMyPendingGcStatementSends().then(
      (rows) => {
        if (!cancelled) setPendingSends(rows)
      },
      () => {},
    )
    return () => {
      cancelled = true
    }
  }, [open])
  const refreshPendingSends = () => {
    void listMyPendingGcStatementSends().then(setPendingSends, () => {})
  }
  const standingGroups = groupStandingCopies(pendingSends)
  const standingRowIds = new Set(standingGroups.flatMap((g) => g.allRowIds))
  /** Office-capable roster for the picker (mirrors the billed report's recipient cohort). */
  const standingPickableUsers = users
    .filter((u) => ['dev', 'master_technician', 'assistant', 'controller', 'primary'].includes(u.role) && (u.email ?? '').includes('@'))
    .sort((a, b) => a.name.localeCompare(b.name))
  const standingUserByEmail = (email: string) =>
    users.find((u) => (u.email ?? '').trim().toLowerCase() === email) ?? null
  const resetStandingForm = () => {
    setStandingUserId('')
    setStandingOutsideEmail('')
    setStandingWeekdays([])
    setStandingTimeHm('07:00')
    setStandingEditingEmail(null)
    setStandingError(null)
  }
  const applyStandingPlan = async (inserts: Parameters<typeof scheduleGcStatementSend>[0][], cancelIds: string[]) => {
    for (const id of cancelIds) await cancelGcStatementSend(id)
    for (const row of inserts) await scheduleGcStatementSend(row)
  }
  const submitStanding = () => {
    const picked = standingPickableUsers.find((u) => u.id === standingUserId)
    const email = (standingEditingEmail ?? picked?.email ?? standingOutsideEmail).trim().toLowerCase()
    const current = standingGroups.find((g) => g.email === email) ?? null
    const plan = planStandingCopyEdit({
      requestedBy: authUser?.id ?? '',
      email,
      byDevelopment,
      includeCollections,
      desiredWeekdays: standingWeekdays,
      desiredTimeHm: standingTimeHm,
      current,
    })
    if (!plan.ok) {
      setStandingError(plan.error)
      return
    }
    setStandingBusy(true)
    setStandingError(null)
    void applyStandingPlan(plan.inserts, plan.cancelIds).then(
      () => {
        setStandingBusy(false)
        resetStandingForm()
        refreshPendingSends()
      },
      (e: unknown) => {
        setStandingBusy(false)
        setStandingError(e instanceof Error ? e.message : 'Could not save — try again.')
      },
    )
  }
  const editStanding = (g: StandingCopyGroup) => {
    const u = standingUserByEmail(g.email)
    setStandingUserId(u?.id ?? '')
    setStandingOutsideEmail(u ? '' : g.email)
    setStandingWeekdays(g.weekdays)
    setStandingTimeHm(g.timeHm)
    setStandingEditingEmail(g.email)
    setStandingError(null)
  }
  const removeStanding = (g: StandingCopyGroup) => {
    setStandingBusy(true)
    void applyStandingPlan([], g.allRowIds).then(
      () => {
        setStandingBusy(false)
        if (standingEditingEmail === g.email) resetStandingForm()
        refreshPendingSends()
      },
      () => {
        setStandingBusy(false)
        refreshPendingSends()
      },
    )
  }
  const anyDevelopment = useMemo(
    () => [...billedActiveRows, ...collectionsRows].some((r) => r.job.development?.id),
    [billedActiveRows, collectionsRows],
  )
  const effectiveGroupBy: GcReviewGroupBy = anyDevelopment ? groupBy : 'gc'
  const byDevelopment = effectiveGroupBy === 'development'
  const rollup = useMemo(
    () => buildGcReviewRollup(billedActiveRows, collectionsRows, { includeCollections, groupBy: effectiveGroupBy }),
    [billedActiveRows, collectionsRows, includeCollections, effectiveGroupBy],
  )
  /** Certification is per-GC — the strip/chips hide under the Development grouping. */
  const certsByGc = latestCertByGc(certRows)
  // Personal statement rounds (v2.2072) ride the GC grouping regardless of the
  // Group-by pill, and personal "Sent it" marks count like app sends.
  const roundRollup = useMemo(
    () => buildGcReviewRollup(billedActiveRows, collectionsRows, { includeCollections: false, groupBy: 'gc' }),
    [billedActiveRows, collectionsRows],
  )
  /**
   * Certification basis (v2.2764): certify status, the Certify checklist, and
   * the week strip all read the active-only GC group, never the displayed one —
   * so the Include Collections toggle (now on by default) can't flip a certified
   * GC to "changed since certified", and a certification never snapshots
   * collections rows. A GC with only collections jobs has nothing to certify.
   */
  const certGroupByGc = useMemo(() => new Map(roundRollup.groups.flatMap((g) => (!g.isNoGc && g.gcId ? [[g.gcId, g] as const] : []))), [roundRollup])
  const roundGcIds = useMemo(
    () => roundRollup.groups.flatMap((g) => (!g.isNoGc && g.gcId ? [g.gcId] : [])),
    [roundRollup],
  )
  useEffect(() => {
    if (!open) return
    let cancelled = false
    void listGcStatementSenders(roundGcIds).then((m) => {
      if (!cancelled) setRoundSenders(m)
    })
    return () => {
      cancelled = true
    }
  }, [open, roundGcIds])
  const accountMen = useMemo(() => deriveGcAccountMen(billedActiveRows), [billedActiveRows])
  const mergedLastSent = useMemo(() => mergeMarksIntoLastSent(lastSentByGcId, roundMarks), [lastSentByGcId, roundMarks])
  const roundItems = useMemo(
    () => buildStatementRound({ groups: roundRollup.groups, certsByGc: latestCertByGc(certRows), marks: roundMarks, senders: roundSenders, accountMen }),
    [roundRollup, certRows, roundMarks, roundSenders, accountMen],
  )
  const roundSummary = useMemo(() => summarizeStatementRound(roundItems, authUser?.id ?? null), [roundItems, authUser?.id])
  /** The GC the overlay should open on (v2.2812); cleared once the user moves on by marking it. */
  const [roundFocusGcId, setRoundFocusGcId] = useState<string | null>(null)
  useEffect(() => {
    if (open && startInRound) {
      setRoundFocusGcId(startInRoundGcId ?? null)
      setRoundOpen(true)
    }
  }, [open, startInRound, startInRoundGcId])
  useEffect(() => {
    // Send from the app (v2.2771): the Draft Message dialog stacks under the round overlay,
    // so the overlay steps aside while it is open and comes back when it closes.
    if (emailDialogGroup == null && emailFromRoundGcId != null) {
      setEmailFromRoundGcId(null)
      setRoundOpen(true)
    }
  }, [emailDialogGroup, emailFromRoundGcId])
  const certProgress = gcReviewWeekProgress(roundRollup.groups, certsByGc, mergedLastSent, certWeekStart)
  /** Portal links per GC (v2.2151): the globe on the row, the Share item, and the Draft Message card all read this. */
  const gcIdsForPortal = useMemo(() => rollup.groups.filter((g) => !g.isNoGc && g.gcId).map((g) => g.gcId as string), [rollup.groups])
  const { links: portalLinks, refresh: refreshPortalLinks } = useGcPortalLinks(gcIdsForPortal, open && !byDevelopment)
  const portalLinkFor = (g: GcReviewGroup) => (!byDevelopment && !g.isNoGc && g.gcId ? portalLinks.get(g.gcId) ?? null : null)
  const { showToast } = useToastContext()
  const copyPortalLink = async (g: GcReviewGroup) => {
    const link = portalLinkFor(g)
    if (!link) return
    try {
      // The short address locks on first share (same rule as the globe's Copy link) — printed/texted copies must not go stale.
      if (link.short && !link.slugLocked && g.gcId) {
        await supabase.rpc('mark_customer_portal_slug_shared' as never, { p_customer_id: g.gcId } as never)
        refreshPortalLinks()
      }
      await navigator.clipboard.writeText(link.url)
      showToast(`Portal link copied — ${g.gcName} (${gcPortalLinkCaption(link)}).`, 'success')
    } catch {
      showToast('Could not copy the portal link.', 'error')
    }
  }
  const authUserName = users.find((u) => u.id === authUser?.id)?.name ?? ''
  const userNameById = (id: string | null) => (id ? users.find((u) => u.id === id)?.name || '—' : 'nobody assigned')
  /** Returns true on success so callers can close their form. A sent mark carries how + note (v2.2761); a skip carries neither. */
  async function markRound(gcId: string, action: 'sent' | 'skipped', how?: { channel: StatementSendChannel; note: string }): Promise<boolean> {
    if (!authUser?.id) return false
    setRoundBusy(true)
    setRoundError(null)
    let ok = false
    try {
      await upsertGcStatementRoundMark({
        week_start: certWeekStart,
        gc_customer_id: gcId,
        action,
        acted_by: authUser.id,
        acted_by_name: authUserName,
        channel: action === 'sent' ? (how?.channel ?? 'email') : null,
        note: action === 'sent' ? (how?.note ?? '') : null,
      })
      refreshRoundMarks()
      ok = true
    } catch (e) {
      setRoundError(e instanceof Error ? e.message : 'Could not save the mark — try again.')
    }
    setRoundBusy(false)
    return ok
  }
  /** This week's sent mark for a GC, when it is what the last-sent pill is showing (v2.2761). */
  const thisWeekSentMark = (gcId: string): RoundMarkRow | null => {
    const m = roundMarks.find((r) => r.gc_customer_id === gcId && r.action === 'sent')
    return m && mergedLastSent[gcId] === m.acted_at ? m : null
  }
  const markWhenLabel = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
    ' ' +
    new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  async function undoRoundMark(gcId: string) {
    setRoundBusy(true)
    setRoundError(null)
    try {
      await deleteGcStatementRoundMark(certWeekStart, gcId)
      refreshRoundMarks()
    } catch (e) {
      setRoundError(e instanceof Error ? e.message : 'Could not undo — try again.')
    }
    setRoundBusy(false)
  }
  const roundEmailChains = groupStatementRoundChains(roundEmailRows)
  const myRoundEmailChain = authUser?.id ? roundEmailChains.find((c) => c.recipientUserId === authUser.id) ?? null : null
  const roundEmailPickableUsers = users
    .filter((u) => ['dev', 'master_technician', 'assistant', 'controller'].includes(u.role) && (u.email ?? '').includes('@'))
    .sort((a, b) => a.name.localeCompare(b.name))
  function openRoundEmailForm(recipientUserId: string) {
    const current = roundEmailChains.find((c) => c.recipientUserId === recipientUserId) ?? null
    setRoundEmailRecipient(recipientUserId)
    setRoundEmailWeekdays(current ? current.weekdays : [1, 3])
    setRoundEmailTime(current ? current.timeHm : '07:00')
    setRoundEmailError(null)
    setRoundEmailNotice(null)
    setRoundEmailOpen(true)
  }
  async function saveRoundEmail(desiredWeekdays: number[]) {
    if (!authUser?.id || !roundEmailRecipient) return
    const current = roundEmailChains.find((c) => c.recipientUserId === roundEmailRecipient) ?? null
    const plan = planStatementRoundChainEdit({
      requestedBy: authUser.id,
      recipientUserId: roundEmailRecipient,
      desiredWeekdays,
      desiredTimeHm: roundEmailTime,
      current,
    })
    if (!plan.ok) {
      setRoundEmailError(plan.error)
      return
    }
    setRoundEmailBusy(true)
    setRoundEmailError(null)
    try {
      await applyStatementRoundChainPlan(plan)
      refreshRoundEmailRows()
      setRoundEmailOpen(false)
      setRoundEmailNotice(desiredWeekdays.length === 0 ? 'Round email cancelled.' : 'Round email saved — it lists in Settings → My email schedule too.')
    } catch (e) {
      setRoundEmailError(e instanceof Error ? e.message : 'Could not save — try again.')
    }
    setRoundEmailBusy(false)
  }
  async function assignSender(gcId: string, userId: string | null) {
    setRoundError(null)
    try {
      await setGcStatementSender(gcId, userId)
      const m = await listGcStatementSenders(roundGcIds)
      setRoundSenders(m)
    } catch (e) {
      setRoundError(e instanceof Error ? e.message : 'Could not assign — try again.')
    }
    setAssigningGcId(null)
  }
  // Footer office number (v2.2133): hydrate the issuer session cache once per open;
  // the builders read it synchronously at click time (falls back to the bare line).
  useEffect(() => {
    if (open) void fetchPhysicalInvoiceIssuerFromAppSettings()
  }, [open])
  const openEmailDialogForGroup = (g: GcReviewGroup) => {
    setEmailDialogGroup(g)
    setEmailDialogTo(!byDevelopment && g.gcId ? emailForGc(g.gcId) : '')
    setEmailDialogCcText('')
    setEmailDialogSubject(
      gcStatementEmailSubject(g, new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })),
    )
    setEmailError(null)
    setEmailIncludePortal(true)
    setEmailWhen('now')
    setEmailRepeatWeekly(false)
  }
  if (!open) return null
  const EntityIcon = byDevelopment ? DevelopmentHouseIcon : GcHardHatIcon
  const groupByPillStyle = (active: boolean): React.CSSProperties => ({
    padding: '0.2rem 0.6rem',
    fontSize: '0.75rem',
    fontWeight: 500,
    fontFamily: 'inherit',
    border: 'none',
    borderRadius: 999,
    cursor: 'pointer',
    background: active ? 'var(--bg-blue-tint)' : 'transparent',
    color: active ? 'var(--text-link)' : 'var(--text-muted)',
  })
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={byDevelopment ? 'GC Review — Billed Awaiting Payment by Development' : 'GC Review — Billed Awaiting Payment by General Contractor'}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          padding: '1.5rem',
          borderRadius: 8,
          minWidth: 360,
          maxWidth: 720,
          width: 'calc(100vw - 2rem)',
          maxHeight: '85vh',
          overflow: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <EntityIcon size={18} style={{ color: 'var(--text-muted)' }} />
            GC Review
          </h2>
          {anyDevelopment ? (
            <span
              role="group"
              aria-label="Group rows by"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.15rem',
                padding: '0.15rem',
                border: '1px solid var(--border)',
                borderRadius: 999,
                flexShrink: 0,
              }}
            >
              <button type="button" onClick={() => setGroupBy('gc')} aria-pressed={!byDevelopment} style={groupByPillStyle(!byDevelopment)}>
                By GC
              </button>
              <button
                type="button"
                onClick={() => setGroupBy('development')}
                aria-pressed={byDevelopment}
                style={groupByPillStyle(byDevelopment)}
              >
                By Development
              </button>
            </span>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            ×
          </button>
        </div>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          {byDevelopment ? (
            <>Billed Awaiting Payment grouped by each job&rsquo;s development, with bill-out dates.</>
          ) : (
            <>Billed Awaiting Payment grouped by each job&rsquo;s GC/Builder, with bill-out dates.</>
          )}
        </p>
        {!byDevelopment && certProgress.gcs > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.7rem',
              padding: '0.5rem 0.8rem',
              marginBottom: '0.75rem',
              border: '1px solid #f59e0b',
              borderRadius: 8,
              background: 'var(--bg-amber-tint)',
            }}
          >
            <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-amber-800)', whiteSpace: 'nowrap' }}>
              This week · due Wednesday
            </span>
            <span aria-hidden style={{ flex: 1, display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
              <span style={{ width: `${Math.round((certProgress.certified / certProgress.gcs) * 100)}%`, background: 'var(--text-green-600)' }} />
            </span>
            <span style={{ fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              <strong>
                {certProgress.certified} of {certProgress.gcs}
              </strong>{' '}
              certified · <strong>{certProgress.sent}</strong> sent
            </span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          {/* Include Collections sits left of Share all, on by default (v2.2764). Certification ignores it — see certGroupByGc. */}
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <input
              type="checkbox"
              checked={includeCollections}
              onChange={() => setIncludeCollections((p) => !p)}
              style={{ margin: 0 }}
            />
            Include Collections ({rollup.collectionsCount} · ${formatCurrency(rollup.collectionsTotal)})
          </label>
          {rollup.groups.length > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => {
                setShareAllOpen(true)
                setShareAllTo('')
                setShareAllSubject(
                  gcReviewShareAllEmailSubject(
                    effectiveGroupBy,
                    new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                  ),
                )
                setShareAllError(null)
                setShareAllWhen('now')
                setShareAllRepeatWeekly(false)
              }}
              title="Print the whole report or email it from the app"
              aria-label="Share the whole GC Review report"
              style={{
                padding: '0.25rem 0.7rem',
                fontSize: '0.8125rem',
                fontWeight: 500,
                border: 'none',
                borderRadius: 4,
                background: '#3b82f6',
                cursor: 'pointer',
                color: 'white',
              }}
            >
              <span aria-hidden>⇪</span> Share all
            </button>
            <button
              type="button"
              onClick={() => onPrint(rollup.groups, effectiveGroupBy)}
              title={byDevelopment ? 'Print every development section as one report' : 'Print every GC section as one report'}
              style={{
                padding: '0.25rem 0.7rem',
                fontSize: '0.8125rem',
                fontWeight: 500,
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
                background: 'var(--surface)',
                cursor: 'pointer',
                color: 'var(--text-700)',
              }}
            >
              <span aria-hidden>🖨</span> Print all
            </button>
          </div>
          ) : null}
        </div>
        {/* Personal statement rounds (v2.2072): GCs ≥ threshold, certify-gated,
            emailed personally by the assigned sender who then marks Sent it. */}
        {!byDevelopment && roundItems.length > 0 ? (
          <div style={{ margin: '0 auto 1rem', border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Weekly statement rounds</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                GCs over ${GC_ROUND_THRESHOLD.toLocaleString('en-US')} · a personal email from the assigned sender, released once certified
              </span>
              <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', display: 'inline-flex', gap: '0.35rem', alignItems: 'baseline' }}>
                {roundSummary.senderProgress.size === 0
                  ? 'nobody assigned yet'
                  : [...roundSummary.senderProgress.entries()].map(([uid, p], i) => (
                      <span key={uid}>
                        {i > 0 ? '· ' : ''}
                        <button
                          type="button"
                          onClick={() => setSenderCard({ senderId: uid, highlightGcId: null })}
                          title={`See ${userNameById(uid)}’s round as they see it`}
                          style={{ font: 'inherit', border: 'none', background: 'none', padding: 0, color: 'var(--text-link)', cursor: 'pointer', textDecoration: 'underline dotted' }}
                        >
                          {userNameById(uid)} {p.sent}/{p.total} sent
                        </button>
                      </span>
                    ))}
              </span>
              {roundSummary.readyForUser.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setRoundStartTotal(roundSummary.readyForUser.length)
                    setRoundOpen(true)
                  }}
                  style={{ padding: '0.2rem 0.7rem', fontSize: '0.75rem', fontWeight: 700, border: 'none', borderRadius: 4, background: '#2563eb', color: '#ffffff', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  Start round ({roundSummary.readyForUser.length})
                </button>
              ) : null}
            </div>
            {roundItems.map((it) => (
              <div key={it.gcId} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem' }}>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <b>{it.gcName}</b>
                  <span style={{ color: 'var(--text-muted)' }}>
                    {' '}· ${formatCurrency(it.amount)} · {assigningGcId === it.gcId ? '' : userNameById(it.senderUserId)}
                  </span>
                  {assigningGcId === it.gcId ? (
                    <select
                      autoFocus
                      defaultValue={it.senderUserId ?? ''}
                      onChange={(e) => void assignSender(it.gcId, e.target.value || null)}
                      onBlur={() => setAssigningGcId(null)}
                      style={{ marginLeft: '0.4rem', font: 'inherit', fontSize: '0.78rem', padding: '0.1rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'inherit' }}
                    >
                      <option value="">nobody</option>
                      {users
                        .filter((u) => ['dev', 'master_technician', 'assistant', 'controller'].includes(u.role))
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                    </select>
                  ) : canCertify ? (
                    <button
                      type="button"
                      onClick={() => setAssigningGcId(it.gcId)}
                      title={`Change who sends ${it.gcName} their statement`}
                      style={{ marginLeft: '0.35rem', font: 'inherit', fontSize: '0.7rem', border: 'none', background: 'none', padding: 0, color: 'var(--text-link)', cursor: 'pointer' }}
                    >
                      assign
                    </button>
                  ) : null}
                </span>
                <button
                  type="button"
                  title={
                    it.mark && it.mark.action === 'sent'
                      ? `${describeRoundMark(it.mark, markWhenLabel(it.mark.acted_at))}\nClick to see ${userNameById(it.senderUserId)}’s round`
                      : it.state === 'needs_sender'
                        ? canCertify
                          ? 'Pick who sends this GC their statement'
                          : undefined
                        : `See ${userNameById(it.senderUserId)}’s round as they see it`
                  }
                  onClick={() => {
                    // The sender card (v2.2792): every chip opens the sender's round; a GC with no sender opens the assign picker instead.
                    if (it.state === 'needs_sender' || !it.senderUserId) {
                      if (canCertify) setAssigningGcId(it.gcId)
                      return
                    }
                    setSenderCard({ senderId: it.senderUserId, highlightGcId: it.gcId })
                  }}
                  style={{
                    font: 'inherit',
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    borderRadius: 9999,
                    border: '1px solid var(--border)',
                    padding: '0.1rem 0.55rem',
                    cursor: 'pointer',
                    color:
                      it.state === 'sent'
                        ? 'var(--text-green-800)'
                        : it.state === 'ready'
                          ? 'var(--text-blue-700)'
                          : it.state === 'needs_sender'
                            ? 'var(--text-red-600)'
                            : it.state === 'skipped'
                              ? 'var(--text-muted)'
                              : 'var(--text-amber-800)',
                    background: it.state === 'sent' ? 'var(--bg-green-tint)' : 'transparent',
                  }}
                >
                  {it.state === 'sent'
                    ? `sent ✓ ${it.mark ? new Date(it.mark.acted_at).toLocaleDateString('en-US', { weekday: 'short' }) : ''} by ${it.mark?.acted_by_name || '—'} · ${sendChannelLabel(it.mark?.channel).toLowerCase()}${it.mark?.note?.trim() ? ' ✎' : ''}`
                    : it.state === 'skipped'
                      ? 'skipped this week'
                      : it.state === 'ready'
                        ? `in ${userNameById(it.senderUserId)}’s round`
                        : it.state === 'needs_sender'
                          ? 'needs a sender'
                          : 'certify to release'}
                </button>
              </div>
            ))}
            <p style={{ margin: '0.4rem 0 0', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              Never sent uncertified — a group that changes after sign-off drops back to “certify to release”. “Sent it”
              stamps the last-sent pill and the week’s progress. Click any chip to see that sender’s round as they see it
              (undo a mark from there).
            </p>
            {roundError ? <p style={{ margin: '0.3rem 0 0', fontSize: '0.75rem', color: 'var(--text-red-700)' }}>{roundError}</p> : null}
            {/* Email me my round (v2.2771): the statement_round stream — a morning email of your round, rebuilt at send time. */}
            {authUser?.id ? (
              <div style={{ marginTop: '0.6rem', borderTop: '1px solid var(--border)', paddingTop: '0.5rem', fontSize: '0.8125rem' }}>
                {!roundEmailOpen ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span aria-hidden>✉</span>
                    {myRoundEmailChain ? (
                      <>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          Your round is emailed to you {formatWeekdays(myRoundEmailChain.weekdays)} · {formatMinutes(parseHhMm(myRoundEmailChain.timeHm) ?? 0)} · weekly
                        </span>
                        <button type="button" onClick={() => authUser?.id && openRoundEmailForm(authUser.id)} style={{ padding: '0.1rem 0.5rem', fontSize: '0.75rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text-700)' }}>
                          Edit
                        </button>
                      </>
                    ) : (
                      <>
                        <span style={{ flex: 1, minWidth: 0, color: 'var(--text-muted)' }}>Get your round by email on the mornings you send — nothing to open, just the list.</span>
                        <button type="button" onClick={() => authUser?.id && openRoundEmailForm(authUser.id)} style={{ padding: '0.15rem 0.6rem', fontSize: '0.75rem', fontWeight: 600, border: '1px solid var(--border-blue)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-blue-700)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          Email me my round…
                        </button>
                      </>
                    )}
                    {roundEmailChains.filter((c) => c.recipientUserId !== authUser?.id).map((c) => (
                      <span key={c.recipientUserId} style={{ width: '100%', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        {userNameById(c.recipientUserId)} gets theirs {formatWeekdays(c.weekdays)} · {formatMinutes(parseHhMm(c.timeHm) ?? 0)}
                        {canCertify ? (
                          <button type="button" onClick={() => openRoundEmailForm(c.recipientUserId)} style={{ marginLeft: '0.4rem', font: 'inherit', fontSize: '0.7rem', border: 'none', background: 'none', padding: 0, color: 'var(--text-link)', cursor: 'pointer' }}>
                            edit
                          </button>
                        ) : null}
                      </span>
                    ))}
                    {canCertify && roundEmailPickableUsers.some((u) => u.id !== authUser?.id && !roundEmailChains.some((c) => c.recipientUserId === u.id)) ? (
                      <select
                        aria-label="Set up the round email for another sender"
                        value=""
                        onChange={(e) => {
                          if (e.target.value) openRoundEmailForm(e.target.value)
                        }}
                        style={{ width: '100%', font: 'inherit', fontSize: '0.75rem', padding: '0.1rem', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-muted)' }}
                      >
                        <option value="">Set it up for another sender…</option>
                        {roundEmailPickableUsers
                          .filter((u) => u.id !== authUser?.id && !roundEmailChains.some((c) => c.recipientUserId === u.id))
                          .map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                      </select>
                    ) : null}
                    {roundEmailNotice ? <span style={{ width: '100%', color: 'var(--text-green-700)', fontSize: '0.75rem' }}>{roundEmailNotice}</span> : null}
                  </div>
                ) : (
                  <form
                    aria-label="Round email schedule"
                    onSubmit={(e) => {
                      e.preventDefault()
                      void saveRoundEmail(roundEmailWeekdays)
                    }}
                    style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}
                  >
                    <div style={{ fontWeight: 600 }}>
                      {roundEmailRecipient === authUser?.id ? 'Email me my round' : `Email ${userNameById(roundEmailRecipient)} their round`}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                      {[1, 2, 3, 4, 5].map((dow) => {
                        const on = roundEmailWeekdays.includes(dow)
                        return (
                          <button
                            key={dow}
                            type="button"
                            aria-pressed={on}
                            onClick={() => setRoundEmailWeekdays((prev) => (prev.includes(dow) ? prev.filter((d) => d !== dow) : [...prev, dow].sort((a, b) => a - b)))}
                            style={{ padding: '0.15rem 0.55rem', fontSize: '0.75rem', fontWeight: on ? 700 : 500, borderRadius: 999, border: on ? '1px solid var(--text-blue-700)' : '1px solid var(--border-strong)', background: on ? 'var(--bg-blue-100)' : 'var(--surface)', color: on ? 'var(--text-blue-800)' : 'var(--text-700)', cursor: 'pointer' }}
                          >
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dow]}
                          </button>
                        )
                      })}
                      <input
                        type="time"
                        value={roundEmailTime}
                        onChange={(e) => setRoundEmailTime(e.target.value)}
                        aria-label="Send time (Central)"
                        style={{ font: 'inherit', fontSize: '0.78rem', padding: '0.1rem 0.3rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'inherit' }}
                      />
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Central · weekly · rebuilt fresh at send time</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        disabled={roundEmailBusy}
                        onClick={() => {
                          setRoundEmailError(null)
                          void fetchStatementRoundEmailPreview().then(
                            (html) => {
                              if (!openHtmlPreviewWindow(html)) setRoundEmailError('Allow pop-ups to preview the email.')
                            },
                            (e: unknown) => setRoundEmailError(e instanceof Error ? e.message : 'Preview failed'),
                          )
                        }}
                        style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer' }}
                      >
                        Preview
                      </button>
                      <button
                        type="button"
                        disabled={roundEmailBusy}
                        onClick={() => {
                          setRoundEmailError(null)
                          void sendStatementRoundEmailTest().then(
                            () => setRoundEmailNotice('Test sent to your address.'),
                            (e: unknown) => setRoundEmailError(e instanceof Error ? e.message : 'Test send failed'),
                          )
                        }}
                        title="Sends YOUR round to your own address, [TEST]-prefixed"
                        style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer' }}
                      >
                        Email me a test
                      </button>
                      <span style={{ flex: 1 }} />
                      {roundEmailChains.some((c) => c.recipientUserId === roundEmailRecipient) ? (
                        <button type="button" disabled={roundEmailBusy} onClick={() => void saveRoundEmail([])} style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', border: 'none', background: 'none', color: 'var(--text-red-700)', cursor: 'pointer' }}>
                          Stop emailing
                        </button>
                      ) : null}
                      <button type="button" disabled={roundEmailBusy} onClick={() => setRoundEmailOpen(false)} style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer' }}>
                        Cancel
                      </button>
                      <button type="submit" disabled={roundEmailBusy} style={{ padding: '0.25rem 0.8rem', fontSize: '0.75rem', fontWeight: 700, border: 'none', borderRadius: 4, background: '#2563eb', color: '#ffffff', cursor: 'pointer', opacity: roundEmailBusy ? 0.6 : 1 }}>
                        {roundEmailBusy ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                    {roundEmailError ? <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-red-700)' }}>{roundEmailError}</p> : null}
                    {roundEmailNotice ? <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-green-700)' }}>{roundEmailNotice}</p> : null}
                  </form>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
        {pendingSends.length > 0 ? (
          <div style={{ margin: '0 auto 1rem', maxWidth: 480, border: '1px solid var(--border)', borderRadius: 6, padding: '0.5rem 0.75rem' }}>
            <p style={{ margin: '0 0 0.3rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center' }}>
              Scheduled statement sends
            </p>
            {/* Standing whole-report copies render grouped (one line per recipient, v2.1431). */}
            {standingGroups.map((g) => (
              <div key={`standing-${g.email}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', padding: '0.15rem 0' }}>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {byDevelopment ? 'All developments' : 'All GCs'} → {standingUserByEmail(g.email)?.name ?? g.email}
                </span>
                <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {formatWeekdays(g.weekdays)} · {formatMinutes(parseHhMm(g.timeHm) ?? 0)} · weekly
                </span>
                <button
                  type="button"
                  onClick={() => removeStanding(g)}
                  disabled={standingBusy}
                  title="Cancel this standing copy (all its weekdays)"
                  style={{ padding: '0.1rem 0.5rem', fontSize: '0.75rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text-700)' }}
                >
                  Cancel
                </button>
              </div>
            ))}
            {pendingSends.filter((s) => !standingRowIds.has(s.id)).map((s) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', padding: '0.15rem 0' }}>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {describePendingGcStatementSend(s)}
                </span>
                <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {new Date(s.send_at).toLocaleString('en-US', { timeZone: APP_CALENDAR_TZ, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  {s.repeat_weekly ? ' · weekly' : ''}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    void cancelGcStatementSend(s.id).then(refreshPendingSends, refreshPendingSends)
                  }}
                  title="Cancel this scheduled send (ends a weekly chain)"
                  style={{ padding: '0.1rem 0.5rem', fontSize: '0.75rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text-700)' }}
                >
                  Cancel
                </button>
              </div>
            ))}
          </div>
        ) : null}
        {rollup.groups.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>No billed jobs awaiting payment.</p>
        ) : (
          rollup.groups.map((g) => (
            <div key={g.key} style={{ marginBottom: '1.25rem' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  flexWrap: 'wrap',
                  padding: '0.4rem 0.5rem',
                  background: 'var(--bg-subtle)',
                  borderRadius: 6,
                  marginBottom: '0.35rem',
                }}
              >
                {g.isNoGc ? (
                  <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{g.gcName}</span>
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                    <EntityIcon size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    {g.gcName}
                  </span>
                )}
                {!byDevelopment && !g.isNoGc && g.gcId ? (
                  // The GC's portal (v2.2151): the same globe + modal as everywhere else (address, Copy link, Preview as customer, scoped views).
                  <span style={{ display: 'inline-flex', alignItems: 'center' }} onClick={(e) => e.stopPropagation()} title={portalLinkFor(g) ? `Portal: ${portalLinkFor(g)!.url.replace(/^https?:\/\//, '')} (${gcPortalLinkCaption(portalLinkFor(g)!)})` : 'Portal — not set up yet'}>
                    <CustomerPortalGlobeButton customerId={g.gcId} customerName={g.gcName} size={14} />
                  </span>
                ) : null}
                {!g.isNoGc && g.gcId && mergedLastSent[g.gcId]
                  ? (() => {
                      // Last-sent pill (v2.2761): names the channel when this week's mark is what it shows, and opens the send history.
                      const gcId = g.gcId
                      const mark = thisWeekSentMark(gcId)
                      const when = new Date(mergedLastSent[gcId]!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      const suffix = mark ? ` · ${sendChannelLabel(mark.channel).toLowerCase()}` : ''
                      const thisWeek = gcReviewSentThisWeek(mergedLastSent[gcId], certWeekStart) && !byDevelopment
                      return (
                        <button
                          type="button"
                          onClick={() => setHistoryGc({ id: gcId, name: g.gcName })}
                          title={`${mark ? describeRoundMark(mark, markWhenLabel(mark.acted_at)) + '\n' : ''}See every send on record for ${g.gcName}`}
                          style={
                            thisWeek
                              ? { display: 'inline-flex', alignItems: 'center', padding: '0.1rem 0.55rem', fontSize: '0.6875rem', fontWeight: 600, borderRadius: 9999, border: 'none', background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)', whiteSpace: 'nowrap', cursor: 'pointer', font: 'inherit' }
                              : { padding: 0, border: 'none', background: 'none', fontSize: '0.6875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', cursor: 'pointer', font: 'inherit', textDecoration: 'underline dotted' }
                          }
                        >
                          {thisWeek ? 'Sent' : 'last sent'} {when}
                          {suffix}
                        </button>
                      )
                    })()
                  : null}
                {!byDevelopment && !g.isNoGc && g.gcId && certGroupByGc.has(g.gcId)
                  ? (() => {
                      const status = gcGroupCertStatus(certGroupByGc.get(g.gcId!)!, certsByGc.get(g.gcId!))
                      if (status.state === 'certified') {
                        return (
                          <span
                            title={status.cert.note ? `Note: ${status.cert.note}` : undefined}
                            style={{ display: 'inline-flex', alignItems: 'center', padding: '0.1rem 0.55rem', fontSize: '0.6875rem', fontWeight: 600, borderRadius: 9999, background: 'var(--bg-green-tint)', color: 'var(--text-green-800)', whiteSpace: 'nowrap' }}
                          >
                            ✓ Certified · {status.cert.certified_by_name || '—'} ·{' '}
                            {new Date(status.cert.certified_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </span>
                        )
                      }
                      if (status.state === 'changed') {
                        return (
                          <span
                            title={`Certified by ${status.cert.certified_by_name || '—'}, then the group changed`}
                            style={{ display: 'inline-flex', alignItems: 'center', padding: '0.1rem 0.55rem', fontSize: '0.6875rem', fontWeight: 600, borderRadius: 9999, background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)', whiteSpace: 'nowrap' }}
                          >
                            Changed since certified · {status.delta >= 0 ? '+' : '−'}${formatCurrency(Math.abs(status.delta))}
                          </span>
                        )
                      }
                      return null
                    })()
                  : null}
                {!g.isNoGc ? (
                  /* Right-side action group: Certify sits with Share (owner call, v2.2047). */
                  <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                    {!byDevelopment && g.gcId && canCertify && certGroupByGc.has(g.gcId)
                      ? (() => {
                          const certGroup = certGroupByGc.get(g.gcId!)!
                          const status = gcGroupCertStatus(certGroup, certsByGc.get(g.gcId!))
                          if (status.state === 'changed') {
                            return (
                              <button
                                type="button"
                                onClick={() => setCertifyGroup(certGroup)}
                                title={`Re-certify ${g.gcName} — the group changed after sign-off`}
                                style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', fontWeight: 700, border: '1px solid #f59e0b', borderRadius: 4, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                              >
                                Re-certify
                              </button>
                            )
                          }
                          if (status.state === 'certified') return null
                          return (
                            <button
                              type="button"
                              onClick={() => setCertifyGroup(certGroup)}
                              title={`Certify ${g.gcName} — review each bill and attest the group is accurate`}
                              style={{ padding: '0.2rem 0.7rem', fontSize: '0.75rem', fontWeight: 700, border: 'none', borderRadius: 4, background: '#2563eb', color: '#ffffff', cursor: 'pointer', whiteSpace: 'nowrap' }}
                            >
                              Certify
                            </button>
                          )
                        })()
                      : null}
                  {/* Share dropdown (v2.1423): Draft Message (was "Email…", v2.2141) / Copy / Print for this GC in one menu. */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => setShareMenuGroupKey((k) => (k === g.key ? null : g.key))}
                      title={`Share the ${g.gcName} statement — email, copy, print, or portal link`}
                      aria-label={`Share statement for ${g.gcName}`}
                      aria-haspopup="menu"
                      aria-expanded={shareMenuGroupKey === g.key}
                      style={{
                        padding: '0.2rem 0.6rem',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        border: '1px solid var(--border-strong)',
                        borderRadius: 4,
                        background: shareMenuGroupKey === g.key ? 'var(--bg-blue-tint)' : 'var(--surface)',
                        cursor: 'pointer',
                        color: shareMenuGroupKey === g.key ? 'var(--text-link)' : 'var(--text-700)',
                      }}
                    >
                      Share <span aria-hidden style={{ fontSize: '0.625rem' }}>▾</span>
                    </button>
                    {shareMenuGroupKey === g.key ? (
                      <>
                        <div onClick={() => setShareMenuGroupKey(null)} style={{ position: 'fixed', inset: 0, zIndex: 62 }} />
                        <div
                          role="menu"
                          style={{
                            position: 'absolute',
                            right: 0,
                            top: 'calc(100% + 4px)',
                            zIndex: 63,
                            minWidth: 150,
                            padding: '0.3rem',
                            background: 'var(--surface)',
                            border: '1px solid var(--border-strong)',
                            borderRadius: 6,
                            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.25)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 2,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setShareMenuGroupKey(null)
                              openEmailDialogForGroup(g)
                            }}
                            title={`Draft the ${g.gcName} statement email — nothing sends until you click Send statement`}
                            style={gcShareMenuItemStyle}
                          >
                            Draft Message
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShareMenuGroupKey(null)
                              onCopyForEmail(g, effectiveGroupBy, { portalUrl: portalLinkFor(g)?.url ?? null })
                            }}
                            title={`Copy the ${g.gcName} statement to paste into an email`}
                            style={gcShareMenuItemStyle}
                          >
                            Copy
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShareMenuGroupKey(null)
                              onPrint([g], effectiveGroupBy)
                            }}
                            title={`Print the ${g.gcName} statement`}
                            style={gcShareMenuItemStyle}
                          >
                            Print
                          </button>
                          {!byDevelopment && g.gcId && canCertify ? (
                            <button
                              type="button"
                              onClick={() => {
                                setShareMenuGroupKey(null)
                                setMarkSentGroup(g)
                              }}
                              title={`Record that ${g.gcName} got their statement another way — text, call, in person — with a note for later`}
                              style={gcShareMenuItemStyle}
                            >
                              Mark sent…
                            </button>
                          ) : null}
                          {!byDevelopment ? (
                            <>
                              <div style={{ height: 1, background: 'var(--border)', margin: '0.25rem 0.2rem' }} />
                              <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0.3rem 0.6rem 0.1rem' }}>Portal</div>
                              {portalLinkFor(g) ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShareMenuGroupKey(null)
                                    void copyPortalLink(g)
                                  }}
                                  title={`Copy ${g.gcName}'s portal link — their live statement with Pay online`}
                                  style={{ ...gcShareMenuItemStyle, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}
                                >
                                  <span style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: '0.5rem' }}>
                                    <span>Copy portal link</span>
                                    <span style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--text-muted)' }}>{gcPortalLinkCaption(portalLinkFor(g)!)}</span>
                                  </span>
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'ui-monospace, Menlo, monospace', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {portalLinkFor(g)!.url.replace(/^https?:\/\//, '')}
                                  </span>
                                </button>
                              ) : (
                                <div style={{ padding: '0.35rem 0.6rem 0.45rem', fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: 280 }}>
                                  No portal link yet — use the 🌐 by the name to set one up.
                                </div>
                              )}
                            </>
                          ) : null}
                        </div>
                      </>
                    ) : null}
                  </div>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onPrint([g], effectiveGroupBy)}
                    title={`Print the ${g.gcName} statement`}
                    aria-label={`Print statement for ${g.gcName}`}
                    style={{
                      marginLeft: 'auto',
                      padding: '0.2rem 0.45rem',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      border: '1px solid var(--border-strong)',
                      borderRadius: 4,
                      background: 'var(--surface)',
                      cursor: 'pointer',
                      color: 'var(--text-700)',
                    }}
                  >
                    <span aria-hidden>🖨</span>
                  </button>
                )}
                {/* Stats on their own second line (owner call, v2.2047) — the
                    GC name stays clean on line 1 with the chips/actions. */}
                <span style={{ flexBasis: '100%', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  {g.jobCount} job{g.jobCount === 1 ? '' : 's'} · ${formatCurrency(g.subtotal)} outstanding
                  {g.oldestAgeDays != null ? ` · oldest ${g.oldestAgeDays}d` : ''}
                </span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ color: 'var(--text-muted)', textAlign: 'left' }}>
                    <th style={{ padding: '0.2rem 0.4rem', fontWeight: 500 }}>Customer</th>
                    <th style={{ padding: '0.2rem 0.4rem', fontWeight: 500 }}>Job</th>
                    <th style={{ padding: '0.2rem 0.4rem', fontWeight: 500 }}>Billed on</th>
                    <th style={{ padding: '0.2rem 0.4rem', fontWeight: 500, textAlign: 'right' }}>Days</th>
                    <th style={{ padding: '0.2rem 0.4rem', fontWeight: 500, textAlign: 'right' }}>Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((r) => (
                    <tr key={r.key} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.3rem 0.4rem' }}>
                        {r.customerName}
                        {r.inCollections ? (
                          <span
                            style={{
                              marginLeft: 6,
                              padding: '0.05rem 0.35rem',
                              fontSize: '0.6875rem',
                              fontWeight: 600,
                              borderRadius: 4,
                              background: 'var(--bg-red-tint)',
                              color: 'var(--text-red-700)',
                            }}
                          >
                            Collections
                          </span>
                        ) : null}
                      </td>
                      <td style={{ padding: '0.3rem 0.4rem', color: 'var(--text-muted)' }}>
                        {onOpenJob ? (
                          <button
                            type="button"
                            onClick={() => onOpenJob(r.jobId)}
                            title="Open Edit Job — set the GC/Builder here"
                            style={{
                              padding: 0,
                              border: 'none',
                              background: 'none',
                              cursor: 'pointer',
                              font: 'inherit',
                              textAlign: 'left',
                              color: 'var(--text-blue-700)',
                              textDecoration: 'underline',
                              textUnderlineOffset: '2px',
                            }}
                          >
                            {r.hcp}
                            {r.jobName ? ` · ${r.jobName}` : ''}
                          </button>
                        ) : (
                          <>
                            {r.hcp}
                            {r.jobName ? ` · ${r.jobName}` : ''}
                          </>
                        )}
                        {r.jobAddress ? (
                          <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-faint)' }}>
                            {r.jobAddress}
                          </span>
                        ) : null}
                      </td>
                      <td style={{ padding: '0.3rem 0.4rem', whiteSpace: 'nowrap' }}>{r.referenceDateDisplay}</td>
                      <td style={{ padding: '0.3rem 0.4rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {r.ageDays != null ? `${r.ageDays}d` : '—'}
                      </td>
                      <td style={{ padding: '0.3rem 0.4rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        ${formatCurrency(r.remaining)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            borderTop: '2px solid var(--border-strong)',
            paddingTop: '0.6rem',
            fontWeight: 600,
          }}
        >
          <span>Total</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>${formatCurrency(rollup.grandTotal)}</span>
        </div>
      </div>
      {emailDialogGroup ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Email statement to ${emailDialogGroup.gcName}`}
          style={{
            position: 'fixed',
            padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 61,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !emailSending) setEmailDialogGroup(null)
          }}
        >
          <div style={{ background: 'var(--surface)', padding: '1.25rem 1.5rem', borderRadius: 8, minWidth: 340, maxWidth: 520, width: 'calc(100vw - 3rem)', maxHeight: 'min(90vh, 100%)', overflow: 'auto' }}>
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem' }}>Email statement to {emailDialogGroup.gcName}</h3>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>To — the GC, a teammate, or any email</label>
            {/* The GC's own chip leads (v2.2131): the To field opens prefilled with their email, so their pill is the lit one. */}
            <TeammateEmailChips
              users={users}
              value={emailDialogTo}
              onPick={setEmailDialogTo}
              disabled={emailSending}
              leading={(() => {
                const chip = !byDevelopment && emailDialogGroup.gcId ? gcEmailChip(emailDialogGroup.gcName, emailForGc(emailDialogGroup.gcId)) : null
                return chip ? [chip] : undefined
              })()}
            />
            <input
              type="email"
              value={emailDialogTo}
              onChange={(e) => setEmailDialogTo(e.target.value)}
              placeholder="accounting@example.com"
              disabled={emailSending}
              style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box', marginBottom: '0.6rem' }}
            />
            {/* CC (v2.2160): tap teammates to add/remove, or type any addresses (comma-separated). */}
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>CC — optional; tap teammates or type addresses</label>
            {(() => {
              const chips = buildTeammateEmailChips(users).filter((c) => c.email !== emailDialogTo.trim().toLowerCase())
              return chips.length ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.5rem' }}>
                  {chips.map((c) => {
                    const selected = ccTextIncludes(emailDialogCcText, c.email)
                    return (
                      <button
                        key={c.email}
                        type="button"
                        onClick={() => setEmailDialogCcText((t) => toggleCcEmailInText(t, c.email))}
                        disabled={emailSending}
                        title={`${c.title} — ${selected ? 'remove from CC' : 'add to CC'}`}
                        aria-pressed={selected}
                        style={{ padding: '0.25rem 0.7rem', fontSize: '0.8125rem', borderRadius: 999, cursor: emailSending ? 'default' : 'pointer', border: `1px solid ${selected ? 'var(--border-indigo-soft)' : 'var(--border-strong)'}`, background: selected ? 'var(--bg-blue-tint)' : 'var(--surface)', color: selected ? 'var(--text-blue-700)' : 'var(--text-700)', opacity: emailSending ? 0.6 : 1 }}
                      >
                        {selected ? '✓ ' : ''}{c.label}
                      </button>
                    )
                  })}
                </div>
              ) : null
            })()}
            <input
              type="text"
              value={emailDialogCcText}
              onChange={(e) => setEmailDialogCcText(e.target.value)}
              placeholder="cc@example.com, another@example.com"
              aria-label="CC"
              disabled={emailSending}
              style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box', marginBottom: parseCcEmails(emailDialogCcText, emailDialogTo).invalid.length || parseCcEmails(emailDialogCcText, emailDialogTo).overflow ? '0.15rem' : '0.6rem' }}
            />
            {(() => {
              const cc = parseCcEmails(emailDialogCcText, emailDialogTo)
              if (!cc.invalid.length && !cc.overflow) return null
              return (
                <p style={{ margin: '0 0 0.6rem', fontSize: '0.74rem', color: 'var(--text-amber-700)' }}>
                  {cc.invalid.length ? `Not an email: ${cc.invalid.join(', ')}` : ''}{cc.invalid.length && cc.overflow ? ' · ' : ''}{cc.overflow ? `Up to ${GC_STATEMENT_CC_MAX} CC addresses — extras dropped.` : ''}
                </p>
              )
            })()}
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 2 }}>
              Subject{emailWhen === 'schedule' ? ' (scheduled sends use the standard subject)' : ''}
            </label>
            <input
              type="text"
              value={emailDialogSubject}
              onChange={(e) => setEmailDialogSubject(e.target.value)}
              disabled={emailSending || emailWhen === 'schedule'}
              style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box', marginBottom: '0.6rem', opacity: emailWhen === 'schedule' ? 0.6 : 1 }}
            />
            {(() => {
              const link = emailDialogGroup ? portalLinkFor(emailDialogGroup) : null
              if (!link) return null
              return (
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem', fontSize: '0.8rem', color: 'var(--text-700)', marginBottom: '0.6rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={emailIncludePortal} onChange={(e) => setEmailIncludePortal(e.target.checked)} disabled={emailSending || emailWhen === 'schedule'} style={{ marginTop: 3 }} />
                  <span>
                    Include portal link <span style={{ color: 'var(--text-muted)' }}>— a "Your account, any time" card under the table pointing at </span>
                    <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.76rem' }}>{link.url.replace(/^https?:\/\//, '')}</span>
                    <span style={{ color: 'var(--text-muted)' }}> ({gcPortalLinkCaption(link)}){emailWhen === 'schedule' ? ' · scheduled sends include it automatically while the portal is active' : ''}</span>
                  </span>
                </label>
              )
            })()}
            <ScheduleWhenControls
              when={emailWhen}
              setWhen={setEmailWhen}
              sendDate={emailSendDate}
              setSendDate={setEmailSendDate}
              sendTime={emailSendTime}
              setSendTime={setEmailSendTime}
              repeatWeekly={emailRepeatWeekly}
              setRepeatWeekly={setEmailRepeatWeekly}
              disabled={emailSending}
            />
            {emailError ? (
              <p style={{ margin: '0 0 0.6rem', fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>{emailError}</p>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              {/* Preview (v2.2061): the exact email the recipient gets, in a new window — nothing sends. */}
              <button
                type="button"
                onClick={() => {
                  const g = emailDialogGroup
                  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  const subject = emailDialogSubject.trim() || gcStatementEmailSubject(g, dateStr)
                  if (!openHtmlPreviewWindow(buildGcStatementEmailPreviewHtml(g, subject, { dateStr, groupBy: effectiveGroupBy, officePhone: getPhysicalInvoiceIssuerForDocument().phone, portalUrl: emailIncludePortal ? portalLinkFor(g)?.url ?? null : null }))) {
                    setEmailError('Allow pop-ups to preview the statement.')
                  }
                }}
                style={{ marginRight: 'auto', padding: '0.4rem 0.8rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-link)', cursor: 'pointer' }}
              >
                Preview
              </button>
              <button
                type="button"
                disabled={emailSending}
                onClick={() => setEmailDialogGroup(null)}
                style={{ padding: '0.4rem 0.8rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={emailSending || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailDialogTo.trim())}
                onClick={() => {
                  const g = emailDialogGroup
                  if (emailWhen === 'schedule') {
                    const ccParsed = parseCcEmails(emailDialogCcText, emailDialogTo)
                    if (ccParsed.invalid.length) {
                      setEmailError(`CC has something that isn't an email: ${ccParsed.invalid.join(', ')}`)
                      return
                    }
                    const built = buildGcStatementRequestInsert({
                      requestedBy: authUser?.id ?? '',
                      toEmail: emailDialogTo,
                      byDevelopment,
                      entityId: g.gcId,
                      entityName: g.gcName,
                      includeCollections,
                      sendDateYmd: emailSendDate,
                      sendTimeHm: emailSendTime,
                      repeatWeekly: emailRepeatWeekly,
                      ccEmails: ccParsed.emails,
                    })
                    if (!built.ok) {
                      setEmailError(built.error)
                      return
                    }
                    setEmailSending(true)
                    setEmailError(null)
                    void scheduleGcStatementSend(built.row).then(
                      () => {
                        setEmailSending(false)
                        setEmailDialogGroup(null)
                        refreshPendingSends()
                      },
                      (e: unknown) => {
                        setEmailSending(false)
                        setEmailError(e instanceof Error ? e.message : 'Could not schedule — try again.')
                      },
                    )
                    return
                  }
                  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  const ccNow = parseCcEmails(emailDialogCcText, emailDialogTo)
                  if (ccNow.invalid.length) {
                    setEmailError(`CC has something that isn't an email: ${ccNow.invalid.join(', ')}`)
                    return
                  }
                  setEmailSending(true)
                  setEmailError(null)
                  void onSendStatement({
                    gcCustomerId: byDevelopment ? null : g.gcId,
                    gcName: g.gcName,
                    groupBy: effectiveGroupBy,
                    toEmail: emailDialogTo.trim(),
                    ccEmails: ccNow.emails,
                    subject: emailDialogSubject.trim() || gcStatementEmailSubject(g, dateStr),
                    emailHtml: buildGcStatementEmailHtml(g, { dateStr, groupBy: effectiveGroupBy, officePhone: getPhysicalInvoiceIssuerForDocument().phone, portalUrl: emailIncludePortal ? portalLinkFor(g)?.url ?? null : null }),
                    emailText: buildGcStatementEmailText(g, { dateStr, officePhone: getPhysicalInvoiceIssuerForDocument().phone, portalUrl: emailIncludePortal ? portalLinkFor(g)?.url ?? null : null }),
                    total: g.subtotal,
                    jobCount: g.jobCount,
                  }).then((res) => {
                    setEmailSending(false)
                    if (res.ok) {
                      setEmailDialogGroup(null)
                      // An app send of a GC in the round counts as its Sent it (v2.2771) — the mark keeps the
                      // round honest; app sends already stamped the last-sent pill.
                      const inRound = g.gcId ? roundItems.find((it) => it.gcId === g.gcId) : undefined
                      if (g.gcId && inRound && inRound.state !== 'sent') {
                        void markRound(g.gcId, 'sent', { channel: 'email', note: 'Sent from the app' })
                      }
                    } else {
                      setEmailError(res.error || 'Send failed — try again.')
                    }
                  })
                }}
                style={{
                  padding: '0.4rem 0.9rem',
                  border: 'none',
                  borderRadius: 4,
                  background: '#3b82f6',
                  color: 'white',
                  cursor: emailSending ? 'wait' : 'pointer',
                  fontWeight: 500,
                }}
              >
                {emailSending ? (emailWhen === 'schedule' ? 'Scheduling…' : 'Sending…') : emailWhen === 'schedule' ? 'Schedule send' : 'Send statement'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {roundOpen
        ? (() => {
            const focused = roundFocusGcId ? roundSummary.readyForUser.find((it) => it.gcId === roundFocusGcId) ?? null : null
            const current = focused ?? roundSummary.readyForUser[0] ?? null
            const remaining = roundSummary.readyForUser.length
            const cert = current?.gcId ? latestCertByGc(certRows).get(current.gcId) : undefined
            const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            return (
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Personal statement round"
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 64 }}
                onClick={() => setRoundOpen(false)}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{ background: 'var(--surface)', borderRadius: 10, padding: '1rem 1.2rem', width: 'min(560px, 92vw)', boxShadow: '0 12px 40px rgba(0,0,0,0.3)' }}
                >
                  {current ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1rem', fontWeight: 700, flex: 1, minWidth: 0 }}>{current.gcName}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {remaining} to go{roundStartTotal > remaining ? ` · ${roundStartTotal - remaining} sent` : ''}
                        </span>
                      </div>
                      <p style={{ margin: '0.1rem 0 0.5rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {current.jobCount} job{current.jobCount === 1 ? '' : 's'} · ${formatCurrency(current.amount)} outstanding
                        {current.group.oldestAgeDays != null ? ` · oldest ${current.group.oldestAgeDays}d` : ''}
                        {cert ? ` · ✓ certified by ${cert.certified_by_name || '—'}` : ''}
                      </p>
                      <div style={{ background: 'var(--bg-subtle)', borderRadius: 8, padding: '0.5rem 0.65rem', fontSize: '0.78rem' }}>
                        <div>
                          <b>To:</b> {current.gcId ? emailForGc(current.gcId) || 'no email on file — add one on the customer' : '—'}
                        </div>
                        <div style={{ marginTop: '0.2rem', color: 'var(--text-muted)' }}>
                          <b style={{ color: 'inherit' }}>Last sent:</b>{' '}
                          {current.gcId && mergedLastSent[current.gcId]
                            ? new Date(mergedLastSent[current.gcId]!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                            : 'never'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginTop: '0.7rem', alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => {
                            const subject = gcStatementEmailSubject(current.group, dateStr)
                            if (!openHtmlPreviewWindow(buildGcStatementEmailPreviewHtml(current.group, subject, { dateStr, officePhone: getPhysicalInvoiceIssuerForDocument().phone }))) {
                              setRoundError('Allow pop-ups to preview the statement.')
                            }
                          }}
                          style={{ padding: '0.3rem 0.7rem', fontSize: '0.78rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer' }}
                        >
                          Preview statement
                        </button>
                        <button
                          type="button"
                          onClick={() => onCopyForEmail(current.group, 'gc', { portalUrl: portalLinkFor(current.group)?.url ?? null })}
                          style={{ padding: '0.3rem 0.7rem', fontSize: '0.78rem', fontWeight: 600, border: '1px solid var(--border-blue)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-blue-700)', cursor: 'pointer' }}
                        >
                          Copy for email
                        </button>
                        <button
                          type="button"
                          disabled={roundBusy}
                          onClick={() => {
                            // Draft Message (v2.2771): the app sends and marks the round for you.
                            setEmailFromRoundGcId(current.gcId)
                            setRoundOpen(false)
                            openEmailDialogForGroup(current.group)
                          }}
                          title="Draft and send this statement from the app — it marks the round sent for you"
                          style={{ padding: '0.3rem 0.7rem', fontSize: '0.78rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer' }}
                        >
                          Send from the app…
                        </button>
                        <button
                          type="button"
                          disabled={roundBusy || roundSentFormOpen}
                          onClick={() => setRoundSentFormOpen(true)}
                          aria-expanded={roundSentFormOpen}
                          style={{ marginLeft: 'auto', padding: '0.3rem 0.8rem', fontSize: '0.78rem', fontWeight: 700, border: 'none', borderRadius: 4, background: '#2563eb', color: '#ffffff', cursor: 'pointer', opacity: roundBusy || roundSentFormOpen ? 0.6 : 1 }}
                        >
                          Sent it ✓
                        </button>
                        <button
                          type="button"
                          disabled={roundBusy}
                          onClick={() => void markRound(current.gcId, 'skipped')}
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem', border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                        >
                          Skip
                        </button>
                      </div>
                      {roundSentFormOpen ? (
                        <div style={{ marginTop: '0.6rem' }}>
                          <GcStatementMarkSentForm
                            gcName={current.gcName}
                            actorName={authUserName}
                            busy={roundBusy}
                            onSave={(channel, note) => {
                              void markRound(current.gcId, 'sent', { channel, note }).then((ok) => {
                                if (ok) setRoundSentFormOpen(false)
                              })
                            }}
                            onCancel={() => setRoundSentFormOpen(false)}
                          />
                        </div>
                      ) : null}
                      <p style={{ margin: '0.55rem 0 0', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                        Copy pastes the statement as a real table into your Gmail — add a personal line on top and send from
                        your own address. “Sent it” asks how it went out (email, text, call…) and takes a note, then stamps the
                        last-sent pill and the week’s progress.
                      </p>
                      {roundError ? <p style={{ margin: '0.3rem 0 0', fontSize: '0.75rem', color: 'var(--text-red-700)' }}>{roundError}</p> : null}
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
                      <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>Round done 🎉</p>
                      <p style={{ margin: '0.25rem 0 0.75rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Every certified GC in your round has been sent (or skipped) this week.
                      </p>
                      <button
                        type="button"
                        onClick={() => setRoundOpen(false)}
                        style={{ padding: '0.35rem 0.9rem', fontSize: '0.8125rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer' }}
                      >
                        Close
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })()
        : null}
      {shareAllOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Share the whole GC Review report"
          style={{
            position: 'fixed',
            padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 61,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !shareAllSending) setShareAllOpen(false)
          }}
        >
          <div style={{ background: 'var(--surface)', padding: '1.25rem 1.5rem', borderRadius: 8, minWidth: 340, maxWidth: 520, width: 'calc(100vw - 3rem)', maxHeight: 'min(90vh, 100%)', overflow: 'auto' }}>
            <h3 style={{ margin: '0 0 0.35rem', fontSize: '1.05rem' }}>Share the whole report</h3>
            <p style={{ margin: '0 0 0.85rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {rollup.groups.length} {byDevelopment ? 'development' : 'GC'} section{rollup.groups.length === 1 ? '' : 's'} ·{' '}
              ${formatCurrency(rollup.grandTotal)} outstanding
              {includeCollections ? ' (Collections included)' : ''}
            </p>
            <button
              type="button"
              disabled={shareAllSending}
              onClick={() => onPrint(rollup.groups, effectiveGroupBy)}
              title="Opens the print window — choose Save as PDF there to download a copy"
              style={{
                width: '100%',
                padding: '0.5rem 0.8rem',
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
                background: 'var(--surface)',
                cursor: 'pointer',
                color: 'var(--text-700)',
                fontWeight: 500,
                fontSize: '0.875rem',
                marginBottom: '1rem',
              }}
            >
              🖨 Print / save as PDF
            </button>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.85rem' }}>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', fontWeight: 600 }}>Email once</p>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>To — tap a teammate, or type any email</label>
              <TeammateEmailChips users={users} value={shareAllTo} onPick={setShareAllTo} disabled={shareAllSending} />
              <input
                type="email"
                value={shareAllTo}
                onChange={(e) => setShareAllTo(e.target.value)}
                placeholder="name@example.com"
                disabled={shareAllSending}
                style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box', marginBottom: '0.6rem' }}
              />
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 2 }}>
                Subject{shareAllWhen === 'schedule' ? ' (scheduled sends use the standard subject)' : ''}
              </label>
              <input
                type="text"
                value={shareAllSubject}
                onChange={(e) => setShareAllSubject(e.target.value)}
                disabled={shareAllSending || shareAllWhen === 'schedule'}
                style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box', marginBottom: '0.6rem', opacity: shareAllWhen === 'schedule' ? 0.6 : 1 }}
              />
              <ScheduleWhenControls
                when={shareAllWhen}
                setWhen={setShareAllWhen}
                sendDate={shareAllSendDate}
                setSendDate={setShareAllSendDate}
                sendTime={shareAllSendTime}
                setSendTime={setShareAllSendTime}
                repeatWeekly={shareAllRepeatWeekly}
                setRepeatWeekly={setShareAllRepeatWeekly}
                disabled={shareAllSending}
              />
              <div style={{ border: '1px solid var(--border)', borderRadius: 4, padding: '0.5rem 0.65rem', fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                Every section above as one email — job addresses, bill-sent dates, amounts owed, and the grand total. Sent
                from team@noreply.pipetooling.com with your email as reply-to.
              </div>
              {shareAllError ? (
                <p style={{ margin: '0 0 0.6rem', fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>{shareAllError}</p>
              ) : null}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  disabled={shareAllSending}
                  onClick={() => setShareAllOpen(false)}
                  style={{ padding: '0.4rem 0.8rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={shareAllSending || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shareAllTo.trim())}
                  onClick={() => {
                    if (shareAllWhen === 'schedule') {
                      const built = buildGcStatementRequestInsert({
                        requestedBy: authUser?.id ?? '',
                        toEmail: shareAllTo,
                        byDevelopment,
                        entityId: null,
                        entityName: byDevelopment ? 'All developments' : 'All GCs',
                        includeCollections,
                        sendDateYmd: shareAllSendDate,
                        sendTimeHm: shareAllSendTime,
                        repeatWeekly: shareAllRepeatWeekly,
                      })
                      if (!built.ok) {
                        setShareAllError(built.error)
                        return
                      }
                      setShareAllSending(true)
                      setShareAllError(null)
                      void scheduleGcStatementSend(built.row).then(
                        () => {
                          setShareAllSending(false)
                          setShareAllOpen(false)
                          refreshPendingSends()
                        },
                        (e: unknown) => {
                          setShareAllSending(false)
                          setShareAllError(e instanceof Error ? e.message : 'Could not schedule — try again.')
                        },
                      )
                      return
                    }
                    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    const report = { groups: rollup.groups, grandTotal: rollup.grandTotal }
                    setShareAllSending(true)
                    setShareAllError(null)
                    void onSendStatement({
                      gcCustomerId: null,
                      gcName: byDevelopment ? 'All developments' : 'All GCs',
                      groupBy: 'all',
                      toEmail: shareAllTo.trim(),
                      subject: shareAllSubject.trim() || gcReviewShareAllEmailSubject(effectiveGroupBy, dateStr),
                      emailHtml: buildGcReviewShareAllEmailHtml(report, { dateStr, groupBy: effectiveGroupBy, officePhone: getPhysicalInvoiceIssuerForDocument().phone }),
                      emailText: buildGcReviewShareAllEmailText(report, { dateStr, groupBy: effectiveGroupBy, officePhone: getPhysicalInvoiceIssuerForDocument().phone }),
                      total: rollup.grandTotal,
                      jobCount: rollup.groups.reduce((s, g) => s + g.jobCount, 0),
                    }).then((res) => {
                      setShareAllSending(false)
                      if (res.ok) {
                        setShareAllOpen(false)
                      } else {
                        setShareAllError(res.error || 'Send failed — try again.')
                      }
                    })
                  }}
                  style={{
                    padding: '0.4rem 0.9rem',
                    border: 'none',
                    borderRadius: 4,
                    background: '#3b82f6',
                    color: 'white',
                    cursor: shareAllSending ? 'wait' : 'pointer',
                    fontWeight: 500,
                  }}
                >
                  {shareAllSending ? (shareAllWhen === 'schedule' ? 'Scheduling…' : 'Sending…') : shareAllWhen === 'schedule' ? 'Schedule send' : 'Send report'}
                </button>
              </div>
            </div>
            {isDev ? (
              /* Standing copies (v2.1431): teammates + weekdays for recurring
                 whole-report emails. One repeat_weekly chain per weekday under
                 the hood — grouped here by recipient. Dev-only. */
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.85rem', marginTop: '0.85rem' }}>
                <p style={{ margin: '0 0 0.15rem', fontSize: '0.8125rem', fontWeight: 600 }}>Standing copies</p>
                <p style={{ margin: '0 0 0.6rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Send this report to teammates on the weekdays you pick — rebuilt fresh each send.
                </p>
                {standingGroups.map((g) => {
                  const u = standingUserByEmail(g.email)
                  return (
                    <div
                      key={g.email}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', border: '1px solid var(--border)', borderRadius: 6, padding: '0.4rem 0.6rem', marginBottom: '0.4rem' }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {u?.name ?? g.email}
                          <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> · {u ? u.role.replace('_', ' ') : 'outside'}</span>
                        </p>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {formatWeekdays(g.weekdays)} — {formatMinutes(parseHhMm(g.timeHm) ?? 0)} Central
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => editStanding(g)}
                        disabled={standingBusy}
                        style={{ padding: '0.15rem 0.55rem', fontSize: '0.75rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text-700)' }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => removeStanding(g)}
                        disabled={standingBusy}
                        aria-label={`Remove standing copy for ${u?.name ?? g.email}`}
                        style={{ padding: '0.15rem 0.55rem', fontSize: '0.75rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text-red-700)' }}
                      >
                        Remove
                      </button>
                    </div>
                  )
                })}
                <div style={{ background: 'var(--bg-subtle)', borderRadius: 6, padding: '0.6rem 0.7rem' }}>
                  {standingEditingEmail ? (
                    <p style={{ margin: '0 0 0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Editing {standingUserByEmail(standingEditingEmail)?.name ?? standingEditingEmail}
                    </p>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <select
                        value={standingUserId}
                        onChange={(e) => {
                          setStandingUserId(e.target.value)
                          if (e.target.value) setStandingOutsideEmail('')
                        }}
                        disabled={standingBusy}
                        aria-label="Add a person"
                        style={{ flex: 1, minWidth: 0, padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.8125rem' }}
                      >
                        <option value="">Add a person…</option>
                        {standingPickableUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} — {u.role.replace('_', ' ')}
                          </option>
                        ))}
                      </select>
                      <input
                        type="email"
                        value={standingOutsideEmail}
                        onChange={(e) => {
                          setStandingOutsideEmail(e.target.value)
                          if (e.target.value) setStandingUserId('')
                        }}
                        placeholder="or outside email"
                        disabled={standingBusy}
                        style={{ flex: 1, minWidth: 0, padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.8125rem', boxSizing: 'border-box' }}
                      />
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: 2 }}>Days</span>
                    {[1, 2, 3, 4, 5, 6, 0].map((dow) => {
                      const active = standingWeekdays.includes(dow)
                      return (
                        <button
                          key={dow}
                          type="button"
                          disabled={standingBusy}
                          aria-pressed={active}
                          onClick={() =>
                            setStandingWeekdays((prev) => (prev.includes(dow) ? prev.filter((d) => d !== dow) : [...prev, dow]))}
                          style={{
                            width: 38,
                            padding: '0.2rem 0',
                            fontSize: '0.75rem',
                            fontWeight: active ? 600 : 400,
                            border: active ? '1px solid transparent' : '1px solid var(--border)',
                            borderRadius: 999,
                            background: active ? 'var(--bg-blue-tint)' : 'transparent',
                            color: active ? 'var(--text-link)' : 'var(--text-muted)',
                            cursor: 'pointer',
                          }}
                        >
                          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dow]}
                        </button>
                      )
                    })}
                    <input
                      type="time"
                      value={standingTimeHm}
                      onChange={(e) => setStandingTimeHm(e.target.value)}
                      disabled={standingBusy}
                      aria-label="Send time (Central)"
                      style={{ padding: '0.25rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.8125rem' }}
                    />
                    <button
                      type="button"
                      onClick={submitStanding}
                      disabled={standingBusy || (!standingEditingEmail && !standingUserId && !standingOutsideEmail.trim())}
                      style={{ marginLeft: 'auto', padding: '0.25rem 0.7rem', fontSize: '0.8125rem', fontWeight: 500, border: 'none', borderRadius: 4, background: '#3b82f6', color: 'white', cursor: standingBusy ? 'wait' : 'pointer' }}
                    >
                      {standingBusy ? 'Saving…' : standingEditingEmail ? 'Save' : 'Add'}
                    </button>
                    {standingEditingEmail ? (
                      <button
                        type="button"
                        onClick={resetStandingForm}
                        disabled={standingBusy}
                        style={{ padding: '0.25rem 0.6rem', fontSize: '0.8125rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                    ) : null}
                  </div>
                  {standingError ? (
                    <p style={{ margin: '0.4rem 0 0', fontSize: '0.75rem', color: 'var(--text-red-700)' }}>{standingError}</p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {certifyGroup && authUser?.id && (
        <GcReviewCertifyModal
          group={certifyGroup}
          weekStartYmd={certWeekStart}
          authUserId={authUser.id}
          authUserName={authUserName}
          onClose={() => setCertifyGroup(null)}
          onCertified={({ andSend }) => {
            const g = certifyGroup
            setCertifyGroup(null)
            refreshCerts()
            if (andSend && g) openEmailDialogForGroup(g)
          }}
          onOpenJobDetail={onOpenJobDetail}
        />
      )}
      {markSentGroup && markSentGroup.gcId && authUser?.id ? (
        // Share → Mark sent… (v2.2761): any GC, any amount — a text, a call, an in-person handoff, with a note for posterity.
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Mark ${markSentGroup.gcName} statement sent`}
          onClick={() => (roundBusy ? undefined : setMarkSentGroup(null))}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 64 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 10, padding: '1rem 1.2rem', width: 'min(520px, 92vw)', boxShadow: '0 12px 40px rgba(0,0,0,0.3)' }}>
            <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.15rem' }}>{markSentGroup.gcName}</div>
            <p style={{ margin: '0 0 0.6rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {markSentGroup.jobCount} job{markSentGroup.jobCount === 1 ? '' : 's'} · ${formatCurrency(markSentGroup.subtotal)} outstanding
              {mergedLastSent[markSentGroup.gcId] ? ` · last sent ${new Date(mergedLastSent[markSentGroup.gcId]!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ' · never sent'}
            </p>
            <GcStatementMarkSentForm
              gcName={markSentGroup.gcName}
              actorName={authUserName}
              defaultChannel="text"
              busy={roundBusy}
              onSave={(channel, note) => {
                const gcId = markSentGroup.gcId
                if (!gcId) return
                void markRound(gcId, 'sent', { channel, note }).then((ok) => {
                  if (ok) setMarkSentGroup(null)
                })
              }}
              onCancel={() => setMarkSentGroup(null)}
            />
            {roundError ? <p style={{ margin: '0.4rem 0 0', fontSize: '0.75rem', color: 'var(--text-red-700)' }}>{roundError}</p> : null}
          </div>
        </div>
      ) : null}
      {senderCard
        ? (() => {
            const senderUser = users.find((u) => u.id === senderCard.senderId)
            const sender = { id: senderCard.senderId, name: senderUser?.name || '—' }
            return (
              <GcSenderRoundCard
                sender={sender}
                items={roundItems}
                chain={roundEmailChains.find((c) => c.recipientUserId === sender.id) ?? null}
                heldReason={(gcId) => {
                  const g = certGroupByGc.get(gcId)
                  if (!g) return null
                  const st = gcGroupCertStatus(g, certsByGc.get(gcId)).state
                  return st === 'changed' ? 'changed' : st === 'uncertified' ? 'uncertified' : null
                }}
                highlightGcId={senderCard.highlightGcId}
                busy={roundBusy}
                canAct={canCertify}
                onClose={() => setSenderCard(null)}
                onPreviewEmail={() => {
                  setRoundError(null)
                  void fetchStatementRoundEmailPreview(sender.id).then(
                    (html) => {
                      if (!openHtmlPreviewWindow(html)) setRoundError('Allow pop-ups to preview the email.')
                    },
                    (e: unknown) => setRoundError(e instanceof Error ? e.message : 'Preview failed'),
                  )
                }}
                onSetupEmail={() => {
                  setSenderCard(null)
                  openRoundEmailForm(sender.id)
                }}
                onAssign={(gcId) => {
                  setSenderCard(null)
                  setAssigningGcId(gcId)
                }}
                onUndoMark={(gcId) => void undoRoundMark(gcId)}
              />
            )
          })()
        : null}
      {historyGc ? (
        <GcStatementSendHistoryModal gcId={historyGc.id} gcName={historyGc.name} appLastSentAt={lastSentByGcId[historyGc.id] ?? null} onClose={() => setHistoryGc(null)} />
      ) : null}
    </div>
  )
}
