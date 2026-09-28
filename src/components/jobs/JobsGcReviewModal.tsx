import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import {
  buildGcStatementRequestInsert,
  describePendingGcStatementSend,
  type PendingGcStatementSend,
} from '../../lib/gcStatementSchedule'
import {
  canCancelStatementRequest,
  cancelGcStatementSend,
  listPendingStatementRequests,
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
import { openHtmlPreviewWindow, openHtmlPrintWindow } from '../../lib/jobsDocuments/printWindow'
import { resolveEmailWording } from '../../lib/emailWording'
import { dollarsToCents, gcStatementSendGuard } from '../../lib/gcStatementSendGuard'
import {
  GC_ROUND_THRESHOLD,
  deriveGcAccountMen,
  describeRoundMark,
  mergeMarksIntoLastSent,
  sendChannelLabel,
  type RoundMarkAction,
  type RoundMarkRow,
  type StatementSendChannel,
  type Temperature,
} from '../../lib/jobs/gcStatementRounds'
import { buildTemperatureBoard, latestExpectedPayByGc, latestTemperatureByGc, trailingWeekStarts } from '../../lib/jobs/temperatureBoard'
import GcTemperatureBoard, { TEMP_PILL } from './GcTemperatureBoard'
import {
  deleteGcStatementRoundMark,
  listGcStatementRoundMarks,
  listGcStatementRoundMarksSince,
  listGcStatementSenders,
  setGcStatementSender,
  upsertGcStatementRoundMark,
} from '../../lib/gcStatementRoundIo'
import { formatCurrency } from '../../lib/jobs/jobFormMoney'
import {
  gcGroupCertStatus,
  gcReviewSentThisWeek,
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
import GcWorklistPanel from './GcWorklistPanel'
import GcCallSheetModal, { type WordHeardVia } from './GcCallSheetModal'
import GcWordAskDialog from './GcWordAskDialog'
import { callSheetDraftsFromAnswers, gcIdsToAskAbout, liveAskByOwner, pendingAnswersByOwner, wordAskStatusLine, type GcWordAskRow } from '../../lib/jobs/gcWordAskState'
import { decideGcWordAnswers, emailGcWordAsk, listGcWordAsks, mintGcWordAsk, revokeGcWordAsk } from '../../lib/gcWordAskIo'
import { wordAskTextMessage, wordAskUrl } from '../../lib/gcWordAsk'
import GcReviewRow from './GcReviewRow'
import GcStageTrack from './GcStageTrack'
import { buildGcStageTrack, type GcStageKey } from '../../lib/jobs/gcReviewStages'
import { buildCallSheet, buildCallSheetPrintHtml, callSheetWeekEnds, type CallSheetAnswer } from '../../lib/jobs/gcCallSheet'
import type { PromisedPayDate } from '../../lib/jobs/billedExpectedPay'
import { gcWordBills, planWordPromise, promiseChannelForWord, wordPromiseNote, wordPromiseSavedMessage } from '../../lib/jobs/gcWordPromise'
import { addJobPaymentPromisesSettled } from '../../lib/jobs/paymentChaseIo'
import { payPromiseLabel, payPromiseStatus } from '../../lib/jobs/payPromise'
import { canTakeStatementReplies, defaultReplyToUserId } from '../../lib/gcStatementReplyTo'
import { APP_SEND_NOTE, buildGcWorklist, mergeRoundMarkWrite } from '../../lib/jobs/gcWorklist'
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
import { planGcUnpaidInvoicePrint } from '../../lib/jobs/gcUnpaidInvoicePrint'
import { openGcUnpaidInvoicesPdfInNewTab } from '../../lib/jobs/gcUnpaidInvoicePrintIo'
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
  /** Who takes the GC's replies (punch list #49); omitted/null = the person sending. Someone else named = they answer "Reply" and the sender is copied. */
  replyTo?: { id: string; name: string } | null
}

type GcReviewTab = 'week' | 'temperature' | 'scheduled'

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
  /** Open on this GC (`?round=1&gc=<id>`, the week's email): its account man's call sheet comes up over the list. */
  focusGcId?: string | null
  /** The date each job was promised (the Stages board's map); with `canFilePromises`, a word's pay date files on the GC's bills. */
  promisedPayDates?: Readonly<Record<string, PromisedPayDate>> | null
  /** The roles "They said…" admits on the Stages board. */
  canFilePromises?: boolean
  /** Promises were written — the shell reloads its map. */
  onPromisesChanged?: () => void
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
  focusGcId,
  promisedPayDates,
  canFilePromises = false,
  onPromisesChanged,
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
  /** Draft Message: who takes the GC's replies — the account man by default, with the sender copied. */
  const [emailReplyToUserId, setEmailReplyToUserId] = useState('')
  /**
   * Draft Message intro (journey-map #46): the dev-saved `gc_statement_scheduled` template body,
   * rendered — the same words the scheduled dispatcher prepends, so both app-sent lanes read alike.
   * null = no template saved (the built-in statement stands alone).
   */
  const [emailIntroText, setEmailIntroText] = useState<string | null>(null)
  /** "Share all" dialog (v2.1420): print or email the whole report. */
  const [shareAllOpen, setShareAllOpen] = useState(false)
  const [shareAllTo, setShareAllTo] = useState('')
  const [shareAllSubject, setShareAllSubject] = useState('')
  const [shareAllSending, setShareAllSending] = useState(false)
  const [shareAllError, setShareAllError] = useState<string | null>(null)
  /** The stage the track narrows the list to, the open tab, and the open rows (by GC, else group key). The filter and the tab reset when the window closes, so nobody opens to a list that is quietly missing GCs. */
  const [stage, setStage] = useState<GcStageKey | null>(null)
  const [tab, setTab] = useState<GcReviewTab>('week')
  const [expandedKeys, setExpandedKeys] = useState<ReadonlySet<string>>(new Set())
  useEffect(() => {
    if (open) return
    setStage(null)
    setTab('week')
  }, [open])
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
  /** Six weeks of marks (v2.2813): the temperature board's trend, the header temperature pills, the guardrail. */
  const [boardMarks, setBoardMarks] = useState<RoundMarkRow[]>([])
  const [roundSenders, setRoundSenders] = useState<Map<string, string>>(new Map())
  const [roundBusy, setRoundBusy] = useState(false)
  const [roundError, setRoundError] = useState<string | null>(null)
  const [assigningGcId, setAssigningGcId] = useState<string | null>(null)
  /** Mark sent with channel + note (v2.2761): the worklist's Word / mark-sent steps and Share → Mark sent…. */
  const [markSentGroup, setMarkSentGroup] = useState<GcReviewGroup | null>(null)
  const [historyGc, setHistoryGc] = useState<{ id: string; name: string } | null>(null)
  /** The call sheet: the worklist group it is open on. */
  const [callSheetGroupKey, setCallSheetGroupKey] = useState<string | null>(null)
  /** The call sheet opened on an account man's answers from his link, to read and save. */
  const [callSheetFromLink, setCallSheetFromLink] = useState(false)
  /** Ask by link (punch list #49, step 7): the week's links with their answers; `wordAsksOn` is false until the database has the tables. */
  const [wordAsks, setWordAsks] = useState<GcWordAskRow[]>([])
  const [wordAsksOn, setWordAsksOn] = useState(false)
  const [wordAskGroupKey, setWordAskGroupKey] = useState<string | null>(null)
  const [wordAskBusy, setWordAskBusy] = useState(false)
  const [wordAskError, setWordAskError] = useState<string | null>(null)
  const [wordAskNotice, setWordAskNotice] = useState<string | null>(null)
  const refreshWordAsks = useCallback(() => {
    void listGcWordAsks(certWeekStart).then(({ asks, missing }) => {
      setWordAsks(asks)
      setWordAsksOn(!missing)
    })
  }, [certWeekStart])
  useEffect(() => {
    if (open) refreshWordAsks()
  }, [open, refreshWordAsks])
  /** What the mark form opens on: a statement that went out, or the word with no statement. */
  const [markSentDefaultAction, setMarkSentDefaultAction] = useState<'sent' | 'contacted'>('sent')
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
    void listGcStatementRoundMarksSince(trailingWeekStarts(certWeekStart, 6)[0] ?? certWeekStart).then(setBoardMarks, () => setBoardMarks([]))
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
    void listPendingStatementRequests().then(
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
    void listPendingStatementRequests().then(setPendingSends, () => {})
  }
  const standingGroups = groupStandingCopies(pendingSends)
  const standingRowIds = new Set(standingGroups.flatMap((g) => g.allRowIds))
  /** Owner-only Cancel (journey-map #45): the office sees every scheduled send; only its requester (or a dev) may end it. */
  const canCancelRow = (row: PendingGcStatementSend) => canCancelStatementRequest(row, { id: authUser?.id, isDev })
  const canCancelStanding = (g: StandingCopyGroup) => pendingSends.filter((r) => g.allRowIds.includes(r.id)).every(canCancelRow)
  const requesterNameOf = (userId: string | null | undefined) => (userId ? users.find((u) => u.id === userId)?.name || '—' : '—')
  const requesterOf = (g: StandingCopyGroup) => requesterNameOf(pendingSends.find((r) => g.allRowIds.includes(r.id))?.requested_by)
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
  /** Temperature board (v2.2813): every round GC, cold first, six-week trend, guardrail. */
  const boardWeeks = useMemo(() => trailingWeekStarts(certWeekStart, 6), [certWeekStart])
  const boardRows = useMemo(
    () => buildTemperatureBoard({ groups: roundRollup.groups, marks: boardMarks, senders: roundSenders, accountMen, weekStarts: boardWeeks, appLastSentByGc: lastSentByGcId, threshold: GC_ROUND_THRESHOLD }),
    [roundRollup, boardMarks, roundSenders, accountMen, boardWeeks, lastSentByGcId],
  )
  const boardRowByGc = useMemo(() => new Map(boardRows.map((r) => [r.gcId, r] as const)), [boardRows])
  const temperatureByGc = useMemo(() => latestTemperatureByGc(boardMarks), [boardMarks])
  /** Every GC's pay date, the ones under the line included — the board's rows stop at it. */
  const payByByGc = useMemo(() => latestExpectedPayByGc(boardMarks), [boardMarks])
  const todayYmd = chicagoYmdOf(new Date())
  const worklist = useMemo(
    () =>
      buildGcWorklist({
        groups: roundRollup.groups,
        certsByGc: latestCertByGc(certRows),
        marks: roundMarks,
        senders: roundSenders,
        accountMen,
        lastSentByGcId: mergedLastSent,
        weekStartYmd: certWeekStart,
        expectedPayByByGc: payByByGc,
        todayYmd,
      }),
    [roundRollup, certRows, roundMarks, roundSenders, accountMen, mergedLastSent, certWeekStart, payByByGc, todayYmd],
  )
  const worklistWordsDue = worklist.groups.reduce((n, g) => n + (g.kind === 'under_line' ? 0 : g.rows.length), 0)
  // Opened on one GC (the week's email, `?round=1&gc=`): bring up its account man's call sheet, once per open.
  const [focusedGcId, setFocusedGcId] = useState<string | null>(null)
  useEffect(() => {
    if (!open) {
      if (focusedGcId) setFocusedGcId(null)
      return
    }
    if (!focusGcId || focusedGcId === focusGcId) return
    const group = worklist.groups.find((g) => g.kind !== 'under_line' && g.rows.some((r) => r.gcId === focusGcId))
    if (!group) return
    setFocusedGcId(focusGcId)
    setCallSheetGroupKey(group.key)
  }, [open, focusGcId, focusedGcId, worklist])
  /** Each GC's account man — who a word most likely came from. */
  const accountManByGc = useMemo(() => new Map(worklist.groups.flatMap((g) => g.rows.flatMap((r) => (r.ownerUserId ? [[r.gcId, r.ownerUserId] as const] : [])))), [worklist])
  /** Who a word can come from: the office roster, the person signed in first. */
  const wordSources = useMemo(
    () =>
      users
        .filter((u) => ['dev', 'master_technician', 'assistant', 'controller'].includes(u.role))
        .map((u) => ({ id: u.id, name: u.name }))
        .sort((a, b) => Number(b.id === authUser?.id) - Number(a.id === authUser?.id) || a.name.localeCompare(b.name)),
    [users, authUser?.id],
  )
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
  /** Share → Print unpaid invoices: the group whose PDF is building — one at a time, so a second click cannot open a second tab. */
  const [invoicePrintGroupKey, setInvoicePrintGroupKey] = useState<string | null>(null)
  const printUnpaidInvoices = (g: GcReviewGroup) => {
    if (invoicePrintGroupKey) return
    setInvoicePrintGroupKey(g.key)
    void openGcUnpaidInvoicesPdfInNewTab(g.gcName, planGcUnpaidInvoicePrint(g, [...billedActiveRows, ...collectionsRows]), {
      onBlocked: () => showToast('Allow pop-ups to print the invoices.', 'error'),
      onError: (message) => showToast(`Could not build the invoices — ${message}`, 'error'),
      onDone: (s) => showToast(s.message, s.printed === 0 ? 'error' : s.complete ? 'success' : 'warning'),
    }).finally(() => setInvoicePrintGroupKey(null))
  }
  const authUserName = users.find((u) => u.id === authUser?.id)?.name ?? ''
  const userNameById = (id: string | null) => (id ? users.find((u) => u.id === id)?.name || '—' : 'nobody assigned')
  /** Returns true on success so callers can close their form. A sent mark carries how + note (v2.2761); a skip carries neither. */
  async function markRound(
    gcId: string,
    action: RoundMarkAction,
    how?: { channel: StatementSendChannel; note: string; temperature?: Temperature | null; expectedPayBy?: string | null; wordFrom?: { userId: string; name: string } | null; heardVia?: StatementSendChannel | null; promiseJobIds?: string[] },
  ): Promise<boolean> {
    if (!authUser?.id) return false
    setRoundBusy(true)
    setRoundError(null)
    let ok = false
    try {
      // One mark a week holds both the statement and the word — whichever is written second keeps the first.
      const existing = roundMarks.find((m) => m.gc_customer_id === gcId) ?? null
      await upsertGcStatementRoundMark({
        week_start: certWeekStart,
        gc_customer_id: gcId,
        acted_by: authUser.id,
        acted_by_name: authUserName,
        ...mergeRoundMarkWrite(existing, {
          action,
          channel: how?.channel,
          note: how?.note,
          temperature: how?.temperature,
          expectedPayBy: how?.expectedPayBy,
          // Whose word it is, and that the person signed in typed it. No source given = their own.
          word: {
            fromUserId: how?.wordFrom?.userId ?? authUser.id,
            fromName: how?.wordFrom?.name ?? authUserName,
            heardVia: how?.heardVia ?? null,
            enteredBy: authUser.id,
            enteredByName: authUserName,
          },
        }),
      })
      refreshRoundMarks()
      ok = true
    } catch (e) {
      setRoundError(e instanceof Error ? e.message : 'Could not save the mark — try again.')
    }
    if (ok && how?.expectedPayBy && how.promiseJobIds && how.promiseJobIds.length > 0) {
      const filed = await fileWordPromises(how.promiseJobIds, how.expectedPayBy, { channel: how.heardVia ?? how.channel, note: how.note, wordFromName: how.wordFrom?.name })
      const said = wordPromiseSavedMessage({ ymd: how.expectedPayBy, saved: filed.saved.length, failed: filed.failed.length })
      showToast(said.text, said.tone)
    }
    setRoundBusy(false)
    return ok
  }
  /** The word's pay date, filed on the GC's bills — the record "They said…" keeps on the Stages board. Never throws. */
  async function fileWordPromises(jobIds: readonly string[], ymd: string, word: { channel: StatementSendChannel | 'link' | null; note: string; wordFromName?: string | null }) {
    if (!canFilePromises || jobIds.length === 0) return { saved: [], failed: [] }
    const filed = await addJobPaymentPromisesSettled({
      jobIds,
      ymd,
      channel: promiseChannelForWord(word.channel),
      note: wordPromiseNote({ note: word.note, wordFromName: word.wordFromName, enteredByName: authUserName }),
    })
    if (filed.saved.length > 0) onPromisesChanged?.()
    return filed
  }
  /** The call sheet's save: every answered row in one go. A row that fails stays on the sheet with the reason; the rest are kept. */
  async function saveCallSheet(answers: CallSheetAnswer[], word: { wordFrom: { userId: string; name: string }; heardVia: WordHeardVia | null }, linkAnswers: readonly { id: string; gc_customer_id: string }[] = []) {
    if (!authUser?.id) return
    setRoundBusy(true)
    setRoundError(null)
    const failed: string[] = []
    const dated = { bills: 0, missed: 0 }
    for (const a of answers) {
      try {
        const existing = roundMarks.find((m) => m.gc_customer_id === a.gcId) ?? null
        await upsertGcStatementRoundMark({
          week_start: certWeekStart,
          gc_customer_id: a.gcId,
          acted_by: authUser.id,
          acted_by_name: authUserName,
          ...mergeRoundMarkWrite(existing, {
            action: 'contacted',
            channel: a.channel,
            note: a.note,
            temperature: a.temperature,
            expectedPayBy: a.expectedPayBy,
            word: { fromUserId: word.wordFrom.userId, fromName: word.wordFrom.name, heardVia: word.heardVia, enteredBy: authUser.id, enteredByName: authUserName },
          }),
        })
        // A date still ahead goes on every bill of the GC that is not on it yet; a repeated date that has passed is not promised again.
        const rows = roundRollup.groups.find((g) => g.gcId === a.gcId)?.rows ?? []
        if (canFilePromises && a.expectedPayBy && a.expectedPayBy >= todayYmd && rows.length > 0) {
          const bills = gcWordBills(rows, promisedPayDates)
          const plan = planWordPromise({ bills, picked: new Set(bills.map((b) => b.jobId)), ymd: a.expectedPayBy })
          const filed = await fileWordPromises(plan.file.map((b) => b.jobId), a.expectedPayBy, { channel: word.heardVia ?? a.channel, note: a.note, wordFromName: word.wordFrom.name })
          dated.bills += filed.saved.length
          dated.missed += filed.failed.length
        }
      } catch {
        failed.push(roundRollup.groups.find((g) => g.gcId === a.gcId)?.gcName ?? 'a GC')
      }
    }
    refreshRoundMarks()
    setRoundBusy(false)
    if (failed.length > 0) {
      setRoundError(`Could not save ${failed.join(', ')} — the rest are in. Try those again.`)
      return
    }
    // His answers that were just saved are read; the ones she left blank stay waiting.
    const savedGcIds = new Set(answers.map((a) => a.gcId))
    const readIds = linkAnswers.filter((a) => savedGcIds.has(a.gc_customer_id)).map((a) => a.id)
    if (readIds.length > 0) {
      const decided = await decideGcWordAnswers(readIds, 'accepted', { id: authUser.id, name: authUserName })
      if (!decided.ok) showToast(`The words are saved, but his answers still show as unread — ${decided.error ?? 'try again'}.`, 'warning')
      refreshWordAsks()
    }
    setCallSheetGroupKey(null)
    setCallSheetFromLink(false)
    const datesSaid = dated.missed > 0 ? ` The pay date did not reach ${dated.missed} bill${dated.missed === 1 ? '' : 's'} — set ${dated.missed === 1 ? 'it' : 'them'} from the Stages board.` : dated.bills > 0 ? ` Pay dates are on ${dated.bills} bill${dated.bills === 1 ? '' : 's'}.` : ''
    showToast(`${answers.length} word${answers.length === 1 ? '' : 's'} in — ${word.wordFrom.name}.${datesSaid}`, dated.missed > 0 ? 'warning' : 'success')
  }
  const liveWordAsks = useMemo(() => liveAskByOwner(wordAsks), [wordAsks])
  const pendingWordAnswers = useMemo(() => pendingAnswersByOwner(wordAsks), [wordAsks])
  const wordAskByOwner = useMemo(() => {
    const out = new Map<string, { statusLine: string; pending: number }>()
    const now = Date.now()
    for (const [ownerId, ask] of liveWordAsks) out.set(ownerId, { statusLine: wordAskStatusLine(ask, now), pending: pendingWordAnswers.get(ownerId)?.length ?? 0 })
    for (const [ownerId, pending] of pendingWordAnswers) if (!out.has(ownerId)) out.set(ownerId, { statusLine: 'the link is off', pending: pending.length })
    return out
  }, [liveWordAsks, pendingWordAnswers])
  /** Runs one ask-by-link step with the dialog's busy / error / notice around it. */
  async function wordAskStep(run: () => Promise<{ error?: string; notice?: string }>) {
    setWordAskBusy(true)
    setWordAskError(null)
    setWordAskNotice(null)
    try {
      const r = await run()
      if (r.error) setWordAskError(r.error)
      if (r.notice) setWordAskNotice(r.notice)
    } catch (e) {
      setWordAskError(e instanceof Error ? e.message : 'That did not work — try again.')
    }
    refreshWordAsks()
    setWordAskBusy(false)
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
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    const fallbackSubject = gcStatementEmailSubject(g, dateStr)
    setEmailDialogGroup(g)
    setEmailDialogTo(!byDevelopment && g.gcId ? emailForGc(g.gcId) : '')
    setEmailDialogCcText('')
    setEmailDialogSubject(fallbackSubject)
    setEmailIntroText(null)
    setEmailError(null)
    setEmailIncludePortal(true)
    const accountManId = !byDevelopment && g.gcId ? accountManByGc.get(g.gcId) ?? null : null
    setEmailReplyToUserId(defaultReplyToUserId(authUser?.id ?? '', users.find((u) => u.id === accountManId) ?? null))
    setEmailWhen('now')
    setEmailRepeatWeekly(false)
    // Same editable wording as the scheduled lane (Settings → Email templates → GC statement,
    // v2.2660; journey-map #46 routes Draft Message through it too). Fail-soft: no row / no
    // read → the built-in subject and no intro. The subject only follows the template while
    // the person hasn't touched it.
    void resolveEmailWording('gc_statement_scheduled', { date: dateStr, default_subject: fallbackSubject }, { subject: fallbackSubject, body: '' }).then((w) => {
      if (!w.overridden) return
      setEmailIntroText(w.text.trim() || null)
      if (w.subject.trim()) setEmailDialogSubject((cur) => (cur === fallbackSubject ? w.subject.trim() : cur))
    })
  }
  /** Send guard (journey-map #46 / J20-F4): the one rule the Draft Message button, its status line, and the dispatcher's skip agree on. */
  const emailSendGuard = emailDialogGroup
    ? gcStatementSendGuard({
        totalOwedCents: dollarsToCents(emailDialogGroup.subtotal),
        emailSending,
        hasAddress: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailDialogTo.trim()),
        scheduled: emailWhen === 'schedule',
      })
    : null
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
  /** The GC's statement as the screen shows it (Include Collections and all), by GC — what a worklist row says is owed and opens onto. */
  const statementByGc = new Map(rollup.groups.flatMap((g) => (!byDevelopment && !g.isNoGc && g.gcId ? [[g.gcId, g] as const] : [])))
  /** Statements the week asks nothing of: a GC with only Collections jobs, the no-GC bucket — and every development. */
  const worklistGcIds = new Set(worklist.groups.flatMap((g) => g.rows.map((r) => r.gcId)))
  const otherGroups = byDevelopment ? rollup.groups : rollup.groups.filter((g) => g.isNoGc || !g.gcId || !worklistGcIds.has(g.gcId))
  const showTrack = !byDevelopment && worklist.counts.gcs > 0
  const activeStage = showTrack ? stage : null
  const scheduledCount = standingGroups.length + pendingSends.filter((s) => !standingRowIds.has(s.id)).length
  const tabs: Array<{ key: GcReviewTab; label: string; count: number | null }> = [
    { key: 'week', label: byDevelopment ? 'Developments' : 'This week', count: showTrack ? worklist.counts.gcs : rollup.groups.length || null },
    ...(!byDevelopment && boardRows.length > 0 ? [{ key: 'temperature' as const, label: 'Temperature', count: null }] : []),
    ...(pendingSends.length > 0 || (!byDevelopment && worklistWordsDue > 0) ? [{ key: 'scheduled' as const, label: 'Scheduled', count: scheduledCount || null }] : []),
  ]
  const activeTab: GcReviewTab = tabs.some((t) => t.key === tab) ? tab : 'week'
  const toggleRow = (key: string) =>
    setExpandedKeys((prev) => {
      const next = new Set(prev)
      if (!next.delete(key)) next.add(key)
      return next
    })
  /** The opened row: the statement's chips and its actions, then its bills. */
  const groupDetail = (g: GcReviewGroup) => (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
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
        {!byDevelopment && !g.isNoGc && g.gcId && temperatureByGc.has(g.gcId)
          ? (() => {
              // Temperature pill (v2.2813): the newest read on record, the sentence on hover; opens the send history.
              const t = temperatureByGc.get(g.gcId!)!
              const pill = TEMP_PILL[t.temperature]
              return (
                <>
                  <button
                    type="button"
                    onClick={() => setHistoryGc({ id: g.gcId!, name: g.gcName })}
                    title={`${t.temperature} — ${t.by}${t.enteredBy ? ` (entered by ${t.enteredBy})` : ''}, ${new Date(t.at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}${t.note ? `\n${t.note}` : ''}`}
                    style={{ font: 'inherit', display: 'inline-flex', alignItems: 'center', padding: '0.1rem 0.55rem', fontSize: '0.6875rem', fontWeight: 600, borderRadius: 9999, border: 'none', background: pill.bg, color: pill.fg, whiteSpace: 'nowrap', cursor: 'pointer' }}
                  >
                    {t.temperature} · {new Date(t.at).toLocaleDateString('en-US', { weekday: 'short' })} · {t.by.split(/\s+/)[0]}
                  </button>
                  {(() => {
                    // The promise (punch list #49): green while the date is ahead, red once it has passed with money still owed.
                    const promise = payPromiseStatus(payByByGc.get(g.gcId!), todayYmd, g.subtotal)
                    if (!promise) return null
                    return (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '0.1rem 0.55rem',
                          fontSize: '0.6875rem',
                          fontWeight: promise.late ? 700 : 600,
                          borderRadius: 9999,
                          background: promise.late ? 'var(--bg-orange-tint)' : 'var(--bg-green-tint)',
                          color: promise.late ? 'var(--text-red-700)' : 'var(--text-green-800)',
                          whiteSpace: 'nowrap',
                        }}
                        title={promise.late ? 'The date they gave has passed and they still owe — call them' : "They said they'd pay by this date — hold them to it"}
                      >
                        {payPromiseLabel(promise)}
                      </span>
                    )
                  })()}
                </>
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
                  <button
                    type="button"
                    disabled={invoicePrintGroupKey != null}
                    onClick={() => {
                      setShareMenuGroupKey(null)
                      printUnpaidInvoices(g)
                    }}
                    title={`Open every unpaid invoice on the ${g.gcName} statement as one PDF — print or save it from there`}
                    style={{ ...gcShareMenuItemStyle, ...(invoicePrintGroupKey != null ? { opacity: 0.6, cursor: 'default' } : null) }}
                  >
                    {invoicePrintGroupKey === g.key ? 'Building invoices…' : 'Print unpaid invoices'}
                  </button>
                  {!byDevelopment && g.gcId && canCertify ? (
                    <button
                      type="button"
                      onClick={() => {
                        setShareMenuGroupKey(null)
                        setMarkSentDefaultAction('sent')
                        setMarkSentGroup(g)
                      }}
                      title={`Record that ${g.gcName} got their statement another way — text, call, in person — with a note for later`}
                      style={gcShareMenuItemStyle}
                    >
                      Mark sent / spoke with them…
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
    </>
  )
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
        className="gcReviewPanel"
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          minWidth: 360,
          maxWidth: 720,
          width: 'calc(100vw - 2rem)',
          maxHeight: '85vh',
          overflow: 'auto',
        }}
      >
        <div className="gcReviewTop">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.35rem' }}>
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
        </div>
        {/* Pinned over the list: the tabs, and where the week stands. The track is per GC, so it hides under By Development. */}
        <div className="gcReviewSticky">
          <div className="gcReviewTabs" role="tablist" aria-label="GC Review">
            {tabs.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={activeTab === t.key} onClick={() => setTab(t.key)}>
                {t.label}
                {t.count != null ? <span className="gcReviewTabCount">{t.count}</span> : null}
              </button>
            ))}
            {rollup.groups.length > 0 ? (
              <span className="gcReviewTabsActions">
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
              </span>
            ) : null}
          </div>
          {showTrack && activeTab === 'week' ? <GcStageTrack track={buildGcStageTrack(worklist)} stage={activeStage} onPick={setStage} /> : null}
        </div>
        <div className="gcReviewBody" role="tabpanel">
          {activeTab === 'week' ? (
            rollup.groups.length === 0 ? (
              <p style={{ margin: '0.75rem 0 0', color: 'var(--text-muted)' }}>No billed jobs awaiting payment.</p>
            ) : (
              <>
              {/* The week's worklist: every GC is the office's to work, grouped by the account man who knows it.
                  It replaced the Weekly statement rounds panel, which handed each GC to its sender and waited. */}
              {!byDevelopment ? (
                <GcWorklistPanel
                  worklist={worklist}
                  stage={activeStage}
                  onClearStage={() => setStage(null)}
                  statementByGc={statementByGc}
                  expanded={expandedKeys}
                  onToggle={(r) => toggleRow(r.gcId)}
                  renderDetail={(r) => groupDetail(statementByGc.get(r.gcId) ?? r.group)}
                  authUserId={authUser?.id ?? null}
                  userNameById={userNameById}
                  canAct={canCertify}
                  busy={roundBusy}
                  error={roundError}
                  lastWordByGc={temperatureByGc}
                  assignableUsers={users.filter((u) => ['dev', 'master_technician', 'assistant', 'controller'].includes(u.role))}
                  assigningGcId={assigningGcId}
                  onStartAssign={setAssigningGcId}
                  onAssign={(gcId, userId) => void assignSender(gcId, userId)}
                  onCancelAssign={() => setAssigningGcId(null)}
                  onCheck={(r) => setCertifyGroup(r.group)}
                  onSend={(r) => openEmailDialogForGroup(r.group)}
                  onMarkSent={(r) => {
                    setMarkSentDefaultAction('sent')
                    setMarkSentGroup(r.group)
                  }}
                  onWord={(r) => {
                    setMarkSentDefaultAction('contacted')
                    setMarkSentGroup(r.group)
                  }}
                  onUndoMark={(r) => void undoRoundMark(r.gcId)}
                  onOpenHistory={(r) => setHistoryGc({ id: r.gcId, name: r.gcName })}
                  onOpenCallSheet={(g) => {
                    setRoundError(null)
                    setCallSheetFromLink(false)
                    setCallSheetGroupKey(g.key)
                  }}
                  onAskByLink={
                    wordAsksOn
                      ? (g) => {
                          setWordAskError(null)
                          setWordAskNotice(null)
                          setWordAskGroupKey(g.key)
                        }
                      : undefined
                  }
                  askByOwner={wordAskByOwner}
                  onReviewAnswers={(g) => {
                    setRoundError(null)
                    setCallSheetFromLink(true)
                    setCallSheetGroupKey(g.key)
                  }}
                />
              ) : null}
                {activeStage == null && otherGroups.length > 0 ? (
                  <div className="gcWorklist">
                    {!byDevelopment ? (
                      <div className="gcWorklistGroup">
                        <b>Nothing to check this week</b>
                        <span style={{ color: 'var(--text-muted)' }}>· Collections only, or not billed to a GC</span>
                      </div>
                    ) : null}
                    {otherGroups.map((g) => (
                      <GcReviewRow
                        key={g.key}
                        testId="gc-review-other-row"
                        expanded={expandedKeys.has(g.key)}
                        onToggle={() => toggleRow(g.key)}
                        toggleName={g.gcName}
                        name={
                          g.isNoGc ? (
                            <b style={{ color: 'var(--text-muted)' }}>{g.gcName}</b>
                          ) : (
                            <>
                              <EntityIcon size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                              <b>{g.gcName}</b>
                            </>
                          )
                        }
                        meta={
                          <>
                            ${formatCurrency(g.subtotal)} · {g.jobCount} job{g.jobCount === 1 ? '' : 's'}
                            {g.oldestAgeDays != null ? ` · oldest ${g.oldestAgeDays}d` : ''}
                          </>
                        }
                      >
                        {groupDetail(g)}
                      </GcReviewRow>
                    ))}
                  </div>
                ) : null}
              </>
            )
          ) : activeTab === 'temperature' ? (
            <div style={{ paddingTop: '0.75rem' }}>
            {!byDevelopment && boardRows.length > 0 ? (
              <GcTemperatureBoard
                rows={boardRows}
                weekLabels={boardWeeks.map((w) => {
                  const [y, m, d] = w.split('-').map(Number)
                  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })
                })}
                userNameById={userNameById}
                todayYmd={todayYmd}
                onOpenGc={(gc) => setHistoryGc(gc)}
              />
            ) : null}
            </div>
          ) : (
            <div style={{ paddingTop: '0.75rem' }}>
            {!byDevelopment && worklistWordsDue > 0 ? (
              <div style={{ margin: '0 auto 1rem', border: '1px solid var(--border)', borderRadius: 8, padding: '0.1rem 0.85rem 0.6rem' }}>
                {/* The week's list by email (statement_round stream): every GC over the line, grouped by the account man to ask, rebuilt at send time. */}
                {authUser?.id ? (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.8125rem' }}>
                    {!roundEmailOpen ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span aria-hidden>✉</span>
                        {myRoundEmailChain ? (
                          <>
                            <span style={{ flex: 1, minWidth: 0 }}>
                              The week’s list is emailed to you {formatWeekdays(myRoundEmailChain.weekdays)} · {formatMinutes(parseHhMm(myRoundEmailChain.timeHm) ?? 0)} · weekly
                            </span>
                            <button type="button" onClick={() => authUser?.id && openRoundEmailForm(authUser.id)} style={{ padding: '0.1rem 0.5rem', fontSize: '0.75rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text-700)' }}>
                              Edit
                            </button>
                          </>
                        ) : (
                          <>
                            <span style={{ flex: 1, minWidth: 0, color: 'var(--text-muted)' }}>Get the week’s GCs by email on the mornings you work them — who to call, what to send, who broke a promise.</span>
                            <button type="button" onClick={() => authUser?.id && openRoundEmailForm(authUser.id)} style={{ padding: '0.15rem 0.6rem', fontSize: '0.75rem', fontWeight: 600, border: '1px solid var(--border-blue)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-blue-700)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                              Email me the week’s list…
                            </button>
                          </>
                        )}
                        {roundEmailChains.filter((c) => c.recipientUserId !== authUser?.id).map((c) => (
                          <span key={c.recipientUserId} style={{ width: '100%', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                            {userNameById(c.recipientUserId)} gets it {formatWeekdays(c.weekdays)} · {formatMinutes(parseHhMm(c.timeHm) ?? 0)}
                            {canCertify ? (
                              <button type="button" onClick={() => openRoundEmailForm(c.recipientUserId)} style={{ marginLeft: '0.4rem', font: 'inherit', fontSize: '0.7rem', border: 'none', background: 'none', padding: 0, color: 'var(--text-link)', cursor: 'pointer' }}>
                                edit
                              </button>
                            ) : null}
                          </span>
                        ))}
                        {canCertify && roundEmailPickableUsers.some((u) => u.id !== authUser?.id && !roundEmailChains.some((c) => c.recipientUserId === u.id)) ? (
                          <select
                            aria-label="Set up the week’s list email for someone else"
                            value=""
                            onChange={(e) => {
                              if (e.target.value) openRoundEmailForm(e.target.value)
                            }}
                            style={{ width: '100%', font: 'inherit', fontSize: '0.75rem', padding: '0.1rem', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-muted)' }}
                          >
                            <option value="">Set it up for someone else…</option>
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
                          {roundEmailRecipient === authUser?.id ? 'Email me the week’s list' : `Email ${userNameById(roundEmailRecipient)} the week’s list`}
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
              <div style={{ margin: '0 0 1rem', border: '1px solid var(--border)', borderRadius: 6, padding: '0.5rem 0.75rem' }}>
                <p style={{ margin: '0 0 0.3rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Scheduled statement sends
                </p>
                {/* Every office role sees every scheduled send (journey-map #45); Cancel shows only to the requester or a dev. */}
                {/* Standing whole-report copies render grouped (one line per recipient, v2.1431). */}
                {standingGroups.map((g) => (
                  <div key={`standing-${g.email}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', padding: '0.15rem 0' }}>
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {byDevelopment ? 'All developments' : 'All GCs'} → {standingUserByEmail(g.email)?.name ?? g.email}
                    </span>
                    <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {formatWeekdays(g.weekdays)} · {formatMinutes(parseHhMm(g.timeHm) ?? 0)} · weekly
                    </span>
                    {canCancelStanding(g) ? (
                      <button
                        type="button"
                        onClick={() => removeStanding(g)}
                        disabled={standingBusy}
                        title="Cancel this standing copy (all its weekdays)"
                        style={{ padding: '0.1rem 0.5rem', fontSize: '0.75rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text-700)' }}
                      >
                        Cancel
                      </button>
                    ) : (
                      <span title="Only the person who scheduled this (or a dev) can cancel it" style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        by {requesterOf(g)}
                      </span>
                    )}
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
                    {canCancelRow(s) ? (
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
                    ) : (
                      <span title="Only the person who scheduled this (or a dev) can cancel it" style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        by {requesterNameOf(s.requested_by)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : null}
              {pendingSends.length === 0 ? <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No statement sends are scheduled.</p> : null}
            </div>
          )}
        </div>
        {/* Pinned under the list: the total, beside the one switch that changes it. */}
        <div className="gcReviewFoot">
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
          <span className="gcReviewFootTotal">
            Total outstanding <b>${formatCurrency(rollup.grandTotal)}</b>
          </span>
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
                    Include portal link <span style={{ color: 'var(--text-muted)' }}>— a "Your account, any time" card under the table: Pay online any time at </span>
                    <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.76rem' }}>{link.url.replace(/^https?:\/\//, '')}</span>
                    <span style={{ color: 'var(--text-muted)' }}> ({gcPortalLinkCaption(link)}){emailWhen === 'schedule' ? ' · scheduled sends include it automatically while the portal is active' : ''}</span>
                  </span>
                </label>
              )
            })()}
            {(() => {
              // Replies go to (punch list #49): the assistant sends, the account man knows the account.
              if (byDevelopment || !authUser?.id) return null
              const takers = users.filter((u) => canTakeStatementReplies(u)).sort((a, b) => Number(b.id === authUser.id) - Number(a.id === authUser.id) || a.name.localeCompare(b.name))
              if (takers.length < 2) return null
              const accountManId = emailDialogGroup.gcId ? accountManByGc.get(emailDialogGroup.gcId) ?? null : null
              const scheduled = emailWhen === 'schedule'
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.6rem', fontSize: '0.8125rem' }}>
                  <label htmlFor="gc-email-reply-to" style={{ fontWeight: 600 }}>
                    Replies go to
                  </label>
                  <select
                    id="gc-email-reply-to"
                    value={scheduled ? authUser.id : emailReplyToUserId || authUser.id}
                    disabled={emailSending || scheduled}
                    onChange={(e) => setEmailReplyToUserId(e.target.value)}
                    style={{ font: 'inherit', fontSize: '0.8125rem', padding: '0.2rem 0.35rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'inherit' }}
                  >
                    {takers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.id === authUser.id ? 'Me' : `${u.name}${u.id === accountManId ? ' · account man' : ''} — copy me`}
                      </option>
                    ))}
                  </select>
                  {scheduled ? <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>A scheduled send replies to whoever scheduled it.</span> : null}
                </div>
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
            {/* Send guard (journey-map #46 / J20-F4): a $0 group cannot be sent now — the dispatcher's own skip, surfaced before the click. */}
            {emailSendGuard?.message ? (
              <p role="status" style={{ margin: '0 0 0.6rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{emailSendGuard.message}</p>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              {/* Preview (v2.2061): the exact email the recipient gets, in a new window — nothing sends. */}
              <button
                type="button"
                onClick={() => {
                  const g = emailDialogGroup
                  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  const subject = emailDialogSubject.trim() || gcStatementEmailSubject(g, dateStr)
                  if (!openHtmlPreviewWindow(buildGcStatementEmailPreviewHtml(g, subject, { dateStr, groupBy: effectiveGroupBy, officePhone: getPhysicalInvoiceIssuerForDocument().phone, portalUrl: emailIncludePortal ? portalLinkFor(g)?.url ?? null : null, introText: emailIntroText }))) {
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
                disabled={!emailSendGuard?.canSend}
                title={emailSendGuard?.message ?? undefined}
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
                    emailHtml: buildGcStatementEmailHtml(g, { dateStr, groupBy: effectiveGroupBy, officePhone: getPhysicalInvoiceIssuerForDocument().phone, portalUrl: emailIncludePortal ? portalLinkFor(g)?.url ?? null : null, introText: emailIntroText }),
                    emailText: buildGcStatementEmailText(g, { dateStr, officePhone: getPhysicalInvoiceIssuerForDocument().phone, portalUrl: emailIncludePortal ? portalLinkFor(g)?.url ?? null : null, introText: emailIntroText }),
                    total: g.subtotal,
                    jobCount: g.jobCount,
                    replyTo: (() => {
                      const taker = !byDevelopment && emailReplyToUserId && emailReplyToUserId !== authUser?.id ? users.find((u) => u.id === emailReplyToUserId) : undefined
                      return taker ? { id: taker.id, name: taker.name } : null
                    })(),
                  }).then((res) => {
                    setEmailSending(false)
                    if (res.ok) {
                      setEmailDialogGroup(null)
                      // An app send of a GC in the round counts as its Sent it (v2.2771) — the mark keeps the
                      // round honest; app sends already stamped the last-sent pill.
                      const weekRow = g.gcId ? worklist.groups.flatMap((wg) => wg.rows).find((r) => r.gcId === g.gcId) : undefined
                      if (g.gcId && weekRow?.overLine && weekRow.mark?.action !== 'sent') {
                        void markRound(g.gcId, 'sent', { channel: 'email', note: APP_SEND_NOTE })
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
                  cursor: emailSending ? 'wait' : emailSendGuard?.canSend ? 'pointer' : 'not-allowed',
                  opacity: emailSendGuard?.canSend || emailSending ? 1 : 0.55,
                  fontWeight: 500,
                }}
              >
                {emailSending ? (emailWhen === 'schedule' ? 'Scheduling…' : 'Sending…') : emailWhen === 'schedule' ? 'Schedule send' : 'Send statement'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 10, padding: '1rem 1.2rem', width: 'min(520px, 92vw)', maxHeight: '92vh', overflowY: 'auto', boxSizing: 'border-box', boxShadow: '0 12px 40px rgba(0,0,0,0.3)' }}>
            <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.15rem' }}>{markSentGroup.gcName}</div>
            <p style={{ margin: '0 0 0.6rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {markSentGroup.jobCount} job{markSentGroup.jobCount === 1 ? '' : 's'} · ${formatCurrency(markSentGroup.subtotal)} outstanding
              {mergedLastSent[markSentGroup.gcId] ? ` · last sent ${new Date(mergedLastSent[markSentGroup.gcId]!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ' · never sent'}
            </p>
            <GcStatementMarkSentForm
              gcName={markSentGroup.gcName}
              actorName={authUserName}
              actorId={authUser.id}
              wordSources={wordSources}
              defaultWordSourceId={accountManByGc.get(markSentGroup.gcId) ?? null}
              defaultChannel="text"
              defaultAction={markSentDefaultAction}
              bills={canFilePromises ? gcWordBills(markSentGroup.rows, promisedPayDates) : undefined}
              todayYmd={todayYmd}
              busy={roundBusy}
              onSave={(m) => {
                const gcId = markSentGroup.gcId
                if (!gcId) return
                void markRound(gcId, m.action, m).then((ok) => {
                  if (ok) setMarkSentGroup(null)
                })
              }}
              onCancel={() => setMarkSentGroup(null)}
            />
            {roundError ? <p style={{ margin: '0.4rem 0 0', fontSize: '0.75rem', color: 'var(--text-red-700)' }}>{roundError}</p> : null}
          </div>
        </div>
      ) : null}
      {callSheetGroupKey && authUser?.id
        ? (() => {
            const g = worklist.groups.find((x) => x.key === callSheetGroupKey)
            if (!g) return null
            const sheet = buildCallSheet({ group: g, boardRowByGc, todayYmd })
            const ownerName = g.ownerUserId ? userNameById(g.ownerUserId) : null
            return (
              <GcCallSheetModal
                key={`${g.key}:${callSheetFromLink ? 'link' : 'call'}`}
                sheet={sheet}
                ownerName={ownerName}
                actorId={authUser.id}
                actorName={authUserName}
                wordSources={wordSources}
                initialDrafts={callSheetFromLink && g.ownerUserId ? callSheetDraftsFromAnswers(pendingWordAnswers.get(g.ownerUserId) ?? []) : undefined}
                busy={roundBusy}
                error={roundError}
                onSave={(answers, word) => void saveCallSheet(answers, word, callSheetFromLink && g.ownerUserId ? pendingWordAnswers.get(g.ownerUserId) ?? [] : [])}
                onPrint={() => {
                  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  if (!openHtmlPrintWindow(buildCallSheetPrintHtml(sheet, { ownerName: ownerName ?? 'no account man yet', dateStr, weekEndsYmd: callSheetWeekEnds(certWeekStart) }))) {
                    showToast('Allow pop-ups to print the call sheet.', 'error')
                  }
                }}
                onClose={() => {
                  setCallSheetGroupKey(null)
                  setCallSheetFromLink(false)
                }}
              />
            )
          })()
        : null}
      {wordAskGroupKey && authUser?.id
        ? (() => {
            const g = worklist.groups.find((x) => x.key === wordAskGroupKey)
            if (!g || !g.ownerUserId) return null
            const ownerId = g.ownerUserId
            const owner = users.find((u) => u.id === ownerId)
            const ownerName = owner?.name || userNameById(ownerId)
            const ask = liveWordAsks.get(ownerId) ?? null
            const live = ask && new Date(ask.expires_at).getTime() > Date.now() ? ask : null
            const url = live?.token ? wordAskUrl(window.location.origin, live.token) : null
            const askIds = gcIdsToAskAbout(g)
            const names = g.rows.filter((r) => askIds.includes(r.gcId)).map((r) => r.gcName)
            const copy = async (text: string, notice: string) => {
              try {
                await navigator.clipboard.writeText(text)
                return { notice }
              } catch {
                return { error: 'Could not copy — select the link and copy it by hand.' }
              }
            }
            return (
              <GcWordAskDialog
                ownerName={ownerName}
                ownerHasEmail={(owner?.email ?? '').includes('@')}
                gcNames={names}
                ask={live}
                url={url}
                busy={wordAskBusy}
                error={wordAskError}
                notice={wordAskNotice}
                onMake={() =>
                  void wordAskStep(async () => {
                    const r = await mintGcWordAsk(ownerId, askIds)
                    return r.ok ? { notice: 'The link is made. Text it or email it.' } : { error: r.error }
                  })
                }
                onNewLink={() =>
                  void wordAskStep(async () => {
                    const r = await mintGcWordAsk(ownerId, askIds.length > 0 ? askIds : (live?.gc_ids ?? []), true)
                    return r.ok ? { notice: 'New link made — the old one no longer opens.' } : { error: r.error }
                  })
                }
                onCopyLink={() => void wordAskStep(async () => (url ? copy(url, 'Link copied.') : { error: 'There is no link yet.' }))}
                onCopyText={() =>
                  void wordAskStep(async () =>
                    url ? copy(wordAskTextMessage({ ownerName, askedByName: authUserName, gcCount: Math.max(1, names.length || live?.gc_ids.length || 1), url }), `Copied — paste it into a text to ${ownerName.split(/\s+/)[0]}.`) : { error: 'There is no link yet.' },
                  )
                }
                onEmail={() =>
                  void wordAskStep(async () => {
                    if (!live) return { error: 'There is no link yet.' }
                    // Bring the link's GCs up to date before it goes out.
                    if (askIds.length > 0) await mintGcWordAsk(ownerId, askIds)
                    const r = await emailGcWordAsk(live.id)
                    return r.ok ? { notice: `Emailed to ${r.emailedTo}.` } : { error: r.error }
                  })
                }
                onTurnOff={() =>
                  void wordAskStep(async () => {
                    if (!live) return {}
                    const r = await revokeGcWordAsk(live.id)
                    return r.ok ? { notice: 'The link is off.' } : { error: r.error ?? 'Could not turn the link off.' }
                  })
                }
                onClose={() => setWordAskGroupKey(null)}
              />
            )
          })()
        : null}
      {historyGc ? (
        <GcStatementSendHistoryModal gcId={historyGc.id} gcName={historyGc.name} onClose={() => setHistoryGc(null)} />
      ) : null}
    </div>
  )
}
