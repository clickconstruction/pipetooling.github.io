import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../lib/supabase'
import { fetchDispatchScheduledJobsForAssigneeDay, type DispatchScheduledJobForAssign } from '../lib/jobScheduleBlocks'
import { useToastContext } from '../contexts/ToastContext'
import { withSupabaseRetry } from '../utils/errorHandling'
import type { Database, Json } from '../types/database'
import { APP_CALENDAR_TZ, denverCalendarDayKey } from '../utils/dateUtils'
import { formatMercuryDebitCardIdCompact, mercuryDebitCardIdFromRaw } from '../lib/mercuryRawDebitCard'
import { pushRecentPersonUserId, readRecentPersonUserIds } from '../lib/mercuryAllocRecentPersonUserIds'
import { shortUuidPrefix } from '../lib/shortUuidPrefix'
import {
  isSelectableOption,
  SearchableSelect,
  type SearchableSelectOption,
  type SearchableSelectSelectableOption,
} from './SearchableSelect'
import { useAuth } from '../hooks/useAuth'
import { useLedgerPrefixMap } from '../contexts/LedgerDisplayPrefixContext'
import { formatBidLedgerShortLine, formatJobLedgerShortLine } from '../lib/ledgerDisplayPrefixes'
import { INTERNAL_TRANSFERS_DEFAULT_KEY } from '../lib/dragSortDefaultLabels'

type MercuryTxRow = Database['public']['Tables']['mercury_transactions']['Row']
type JobSearchRow = {
  id: string
  hcp_number: string
  job_name: string
  job_address: string
  service_type_id: string | null
}

/** Runtime RPC args (`replace_mercury_transaction_splits` allows null for XOR/clear; `gen types` does not). */
type ReplaceMercuryTransactionSplitsCall = {
  p_mercury_transaction_id: string
  p_rows: Json
  p_person_id: string | null
  p_user_id: string | null
}

export type MercuryJobSplit = {
  job_id: string
  amount: number
  note?: string | null
}

/** Snapshot of person/job splits after a successful save (for optimistic parent updates). */
export type MercuryAllocSavedDetail = {
  mercuryTransactionId: string
  userId: string | null
  personId: string | null
  allocations: MercuryJobSplit[]
}

export type MercuryTransactionAllocationsModalProps = {
  open: boolean
  onClose: () => void
  transaction: MercuryTxRow | null
  /** Existing splits from DB (signed amounts). */
  initialAllocations: MercuryJobSplit[]
  /** Legacy people-only attribution (no user row). */
  initialPersonId: string | null
  /** User attribution (auth.users). */
  initialUserId: string | null
  /** Display name when initialPersonId is set and initialUserId is null. */
  legacyPersonDisplayName?: string | null
  jobLabelById: Record<string, string>
  usersOptions: SearchableSelectOption[]
  onSaved: (detail: MercuryAllocSavedDetail) => void
  /** Optional; debit keys are lowercased (matches Banking nickname load). */
  nicknameByDebitCard?: Record<string, string>
  nicknameByAccount?: Record<string, string>
  /** Logged-in operator auth user id; when null, recent Person chips are disabled. */
  recentPersonPicksStorageKey: string | null
  /** Job Tally linked-card flow: hide attribution, save via replace_mercury_job_splits_for_my_linked_card, scoped job search. */
  tallySelfService?: boolean
  /**
   * When set with tallySelfService, job search and save use staff RPCs on behalf of this user
   * (linked card must belong to them).
   */
  tallyActAsUserId?: string | null
  /** Display name for schedule/clock subsection titles when staff assign for that user (ignored if not acting as another person). */
  tallyActAsDisplayName?: string | null
}

type SplitMode = 'dollars' | 'percent'

type SplitLine = {
  jobId: string
  jobLabel: string
  mode: SplitMode
  valueStr: string
  note: string
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

/** Assign modal summary Posted cell: e.g. Tue, Apr 19 in company calendar (America/Chicago). */
function formatPostedDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return new Intl.DateTimeFormat('en-US', {
      timeZone: APP_CALENDAR_TZ,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(d)
  } catch {
    return iso
  }
}

function dispatchScheduledJobToSearchRow(d: DispatchScheduledJobForAssign): JobSearchRow {
  return {
    id: d.jobId,
    hcp_number: d.hcp_number,
    job_name: d.job_name,
    job_address: d.job_address,
    service_type_id: d.service_type_id,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** English possessive for tally headings: "Alex" → "Alex's". */
function tallySchedulePossessiveName(displayName: string): string {
  const t = displayName.trim()
  return t === '' ? '' : `${t}'s`
}

function lineDisplayDollars(ln: SplitLine, displayTotal: number): number | null {
  const raw = ln.valueStr.trim()
  if (raw === '') return null
  const v = Number(raw)
  if (!Number.isFinite(v) || v < 0) return null
  if (ln.mode === 'dollars') return round2(v)
  if (displayTotal <= 0) return null
  return round2((displayTotal * v) / 100)
}

/** Equal % shares on add/remove; last line may switch to dollars to close cent drift vs displayTotal. */
function redistributeEqualSplit(lines: SplitLine[], displayTotal: number): SplitLine[] {
  if (lines.length === 0) return []
  if (displayTotal <= 0) return lines

  const n = lines.length
  const base = (ln: SplitLine) => ({
    jobId: ln.jobId,
    jobLabel: ln.jobLabel,
    note: ln.note,
  })

  let next: SplitLine[]
  if (n === 1) {
    const only = lines[0]
    if (!only) return []
    next = [{ ...base(only), mode: 'percent', valueStr: '100' }]
  } else {
    const pct = round2(100 / n)
    const pctLast = round2(100 - (n - 1) * pct)
    next = lines.map((ln, i) => ({
      ...base(ln),
      mode: 'percent' as SplitMode,
      valueStr: i < n - 1 ? String(pct) : String(pctLast),
    }))
  }

  let sum = 0
  for (const ln of next) {
    const d = lineDisplayDollars(ln, displayTotal)
    if (d === null) return lines
    sum += d
  }
  sum = round2(sum)
  if (Math.abs(displayTotal - sum) <= sumEpsilon) return next

  const lastIdx = next.length - 1
  let sumFirst = 0
  for (let i = 0; i < lastIdx; i++) {
    const row = next[i]
    if (!row) return lines
    const d = lineDisplayDollars(row, displayTotal)
    if (d === null) return lines
    sumFirst += d
  }
  sumFirst = round2(sumFirst)
  const rem = round2(displayTotal - sumFirst)
  return next.map((ln, i) =>
    i === lastIdx ? { ...ln, mode: 'dollars', valueStr: String(rem) } : ln,
  )
}

const sumEpsilon = 0.0001

const segmentGroupStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'stretch',
  background: '#f1f5f9',
  padding: 3,
  borderRadius: 10,
  gap: 3,
  border: '1px solid #e2e8f0',
  boxSizing: 'border-box',
}

const segmentBtnBase: CSSProperties = {
  border: 'none',
  borderRadius: 7,
  padding: '7px 14px',
  fontSize: '0.8125rem',
  fontWeight: 600,
  cursor: 'pointer',
  lineHeight: 1.15,
  minWidth: 42,
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

const segmentBtnInactive: CSSProperties = {
  ...segmentBtnBase,
  background: 'transparent',
  color: '#64748b',
}

const segmentBtnActive: CSSProperties = {
  ...segmentBtnBase,
  background: '#ffffff',
  color: '#1d4ed8',
  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.08)',
}

const splitAmountInputStyle: CSSProperties = {
  width: 104,
  minWidth: 88,
  maxWidth: 120,
  padding: '8px 12px',
  fontSize: '0.875rem',
  fontWeight: 500,
  border: '1px solid #e2e8f0',
  borderRadius: 10,
  background: '#fff',
  color: '#0f172a',
  boxSizing: 'border-box',
  fontVariantNumeric: 'tabular-nums',
  fontFamily: 'inherit',
}

function fillRemainderButtonStyle(disabled: boolean): CSSProperties {
  return {
    fontSize: '0.8125rem',
    fontWeight: 500,
    padding: '8px 14px',
    borderRadius: 10,
    border: `1px solid ${disabled ? '#e2e8f0' : '#cbd5e1'}`,
    background: disabled ? '#f8fafc' : '#fff',
    color: disabled ? '#94a3b8' : '#334155',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
    boxShadow: disabled ? 'none' : '0 1px 2px rgba(15, 23, 42, 0.05)',
  }
}

const removeLineButtonStyle: CSSProperties = {
  fontSize: '0.8125rem',
  fontWeight: 600,
  padding: '8px 14px',
  borderRadius: 10,
  border: '1px solid #fecdd3',
  background: '#fff1f2',
  color: '#e11d48',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

export function MercuryTransactionAllocationsModal({
  open,
  onClose,
  transaction,
  initialAllocations,
  initialPersonId,
  initialUserId,
  legacyPersonDisplayName,
  jobLabelById,
  usersOptions,
  onSaved,
  nicknameByDebitCard = {},
  nicknameByAccount = {},
  recentPersonPicksStorageKey,
  tallySelfService = false,
  tallyActAsUserId = null,
  tallyActAsDisplayName = null,
}: MercuryTransactionAllocationsModalProps) {
  const { showToast } = useToastContext()
  const { user: authUser } = useAuth()
  const ledgerPrefixMap = useLedgerPrefixMap()
  const [lines, setLines] = useState<SplitLine[]>([])
  const [userId, setUserId] = useState<string>('')
  const [stripAttribution, setStripAttribution] = useState(false)
  const [saving, setSaving] = useState(false)
  const [jobSearch, setJobSearch] = useState('')
  const [jobResults, setJobResults] = useState<JobSearchRow[]>([])
  const [jobSearchLoading, setJobSearchLoading] = useState(false)
  const [recentPersonIds, setRecentPersonIds] = useState<string[]>([])
  const [staffDayScheduleJobs, setStaffDayScheduleJobs] = useState<DispatchScheduledJobForAssign[]>([])
  const [staffDaySessionJobs, setStaffDaySessionJobs] = useState<JobSearchRow[]>([])
  const [staffDaySessionBids, setStaffDaySessionBids] = useState<{ id: string; label: string }[]>([])
  const [staffDayContextLoading, setStaffDayContextLoading] = useState(false)
  const [staffDayContextError, setStaffDayContextError] = useState<string | null>(null)
  /**
   * Whether this Mercury transaction currently carries the **Internal
   * Transfers** Drag Sort label. Internal Transfers and job splits are
   * mutually exclusive — when this is true the form is read-only and Save
   * is disabled (matched by the guard in `BankingMercuryDragSortTab`).
   * `null` while loading; `false` otherwise.
   */
  const [internalTransfersLabelLocked, setInternalTransfersLabelLocked] = useState<boolean | null>(null)

  const txAmount = transaction ? Number(transaction.amount) : 0
  const displayTotal = Math.abs(txAmount)
  const allocationSign = (txAmount === 0 ? 1 : Math.sign(txAmount)) as 1 | -1

  /** Tally self-service + staff follow-up: show Dispatch schedule + clock-session quick picks for the calendar day of posted_at. */
  const showTallyDayContext = Boolean(
    tallySelfService && transaction?.posted_at && (tallyActAsUserId ?? authUser?.id),
  )

  const scheduleForOtherPerson = Boolean(
    tallyActAsUserId && authUser?.id && tallyActAsUserId !== authUser.id,
  )

  const tallyOtherPossessive = scheduleForOtherPerson
    ? tallySchedulePossessiveName(tallyActAsDisplayName ?? '')
    : ''
  const tallyUseTheirFallback = scheduleForOtherPerson && tallyOtherPossessive === ''

  const tallyScheduleHeadings = useMemo(() => {
    if (!transaction?.posted_at) {
      return {
        scheduleTitle: scheduleForOtherPerson
          ? tallyUseTheirFallback
            ? 'Jobs on their schedule'
            : `Jobs on ${tallyOtherPossessive} schedule`
          : 'Jobs on my schedule',
        clockSessionsTitle: scheduleForOtherPerson
          ? tallyUseTheirFallback
            ? 'Their clock sessions that day'
            : `${tallyOtherPossessive} clock sessions that day`
          : 'Clock sessions that day',
      }
    }
    const ms = new Date(transaction.posted_at).getTime()
    if (!Number.isFinite(ms)) {
      return {
        scheduleTitle: scheduleForOtherPerson
          ? tallyUseTheirFallback
            ? 'Jobs on their schedule'
            : `Jobs on ${tallyOtherPossessive} schedule`
          : 'Jobs on my schedule',
        clockSessionsTitle: scheduleForOtherPerson
          ? tallyUseTheirFallback
            ? 'Their clock sessions that day'
            : `${tallyOtherPossessive} clock sessions that day`
          : 'Clock sessions that day',
      }
    }
    const postedYmd = denverCalendarDayKey(ms)
    const todayYmd = denverCalendarDayKey(Date.now())
    const isToday = postedYmd === todayYmd
    if (scheduleForOtherPerson) {
      if (tallyUseTheirFallback) {
        return {
          scheduleTitle: isToday ? 'Jobs on their schedule' : 'Jobs on their schedule that day',
          clockSessionsTitle: isToday ? 'Their clock sessions today' : 'Their clock sessions that day',
        }
      }
      return {
        scheduleTitle: isToday
          ? `Jobs on ${tallyOtherPossessive} schedule`
          : `Jobs on ${tallyOtherPossessive} schedule that day`,
        clockSessionsTitle: isToday
          ? `${tallyOtherPossessive} clock sessions today`
          : `${tallyOtherPossessive} clock sessions that day`,
      }
    }
    return {
      scheduleTitle: isToday ? 'Jobs on my schedule' : 'Jobs on my schedule that day',
      clockSessionsTitle: isToday ? 'Clock sessions today' : 'Clock sessions that day',
    }
  }, [transaction?.posted_at, scheduleForOtherPerson, tallyUseTheirFallback, tallyOtherPossessive])

  // Re-seed only when the modal opens or the transaction / user identity changes — not when the parent
  // passes new object/array refs for the same row (e.g. stale tally follow-up rebuilds `transaction` each render).
  useEffect(() => {
    if (!open || !transaction?.id) return
    setLines(
      initialAllocations.map((a) => {
        const display = round2(Math.abs(Number(a.amount)))
        return {
          jobId: a.job_id,
          jobLabel: jobLabelById[a.job_id] ?? a.job_id,
          mode: 'dollars' as SplitMode,
          valueStr: String(display),
          note: a.note ?? '',
        }
      }),
    )
    setUserId(initialUserId ?? '')
    setStripAttribution(false)
    setJobSearch('')
    setJobResults([])
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: `initialAllocations` / `jobLabelById` / `transaction` identity churn must not wipe in-progress edits
  }, [open, transaction?.id, initialUserId])

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => {
      const q = jobSearch.trim()
      if (q.length <= 2) {
        setJobResults([])
        setJobSearchLoading(false)
        return
      }
      setJobSearchLoading(true)
      const rpcName = !tallySelfService
        ? 'search_jobs_ledger'
        : tallyActAsUserId
          ? 'search_jobs_for_tally_mercury_assign_as_user'
          : 'search_jobs_for_tally_mercury_assign'
      void withSupabaseRetry(
        async () =>
          tallySelfService && tallyActAsUserId
            ? supabase.rpc('search_jobs_for_tally_mercury_assign_as_user', {
                p_for_user_id: tallyActAsUserId,
                search_text: q,
              })
            : supabase.rpc(rpcName, { search_text: q }),
        'mercury allocations job search',
      )
        .then((data) => {
          setJobSearchLoading(false)
          setJobResults((data ?? []) as JobSearchRow[])
        })
        .catch(() => {
          setJobSearchLoading(false)
          setJobResults([])
        })
    }, 300)
    return () => clearTimeout(t)
  }, [open, jobSearch, tallySelfService, tallyActAsUserId])

  useEffect(() => {
    if (!open || !recentPersonPicksStorageKey) {
      setRecentPersonIds([])
      return
    }
    setRecentPersonIds(readRecentPersonUserIds(recentPersonPicksStorageKey))
  }, [open, recentPersonPicksStorageKey])

  /**
   * Probe the Drag Sort assignment + label `default_key` for this transaction.
   * One round-trip per modal open via Supabase's foreign-table embed; result
   * locks the form when the tx is currently labeled Internal Transfers.
   */
  useEffect(() => {
    if (!open || !transaction?.id) {
      setInternalTransfersLabelLocked(null)
      return
    }
    let cancelled = false
    setInternalTransfersLabelLocked(null)
    void (async () => {
      try {
        const rows = await withSupabaseRetry(
          async () =>
            supabase
              .from('mercury_transaction_drag_sort_assignments')
              .select('mercury_transaction_id, mercury_drag_sort_labels(default_key)')
              .eq('mercury_transaction_id', transaction.id)
              .limit(1),
          'mercury alloc internal transfers probe',
        )
        if (cancelled) return
        const head = (rows ?? [])[0] as
          | { mercury_drag_sort_labels: { default_key: string | null } | null }
          | undefined
        const dk = head?.mercury_drag_sort_labels?.default_key ?? null
        setInternalTransfersLabelLocked(dk === INTERNAL_TRANSFERS_DEFAULT_KEY)
      } catch {
        if (!cancelled) setInternalTransfersLabelLocked(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, transaction?.id])

  useEffect(() => {
    if (!open || !tallySelfService || !transaction?.posted_at) {
      setStaffDayScheduleJobs([])
      setStaffDaySessionJobs([])
      setStaffDaySessionBids([])
      setStaffDayContextLoading(false)
      setStaffDayContextError(null)
      return
    }
    const targetUserId = tallyActAsUserId ?? authUser?.id ?? null
    if (!targetUserId) {
      setStaffDayScheduleJobs([])
      setStaffDaySessionJobs([])
      setStaffDaySessionBids([])
      setStaffDayContextLoading(false)
      setStaffDayContextError(null)
      return
    }
    const ms = new Date(transaction.posted_at).getTime()
    if (!Number.isFinite(ms)) {
      setStaffDayScheduleJobs([])
      setStaffDaySessionJobs([])
      setStaffDaySessionBids([])
      setStaffDayContextError('Invalid posted date.')
      setStaffDayContextLoading(false)
      return
    }
    const workDateYmd = denverCalendarDayKey(ms)
    let cancelled = false
    setStaffDayContextLoading(true)
    setStaffDayContextError(null)
    setStaffDayScheduleJobs([])
    setStaffDaySessionJobs([])
    setStaffDaySessionBids([])

    void (async () => {
      const errParts: string[] = []
      try {
        const schedRes = await fetchDispatchScheduledJobsForAssigneeDay(targetUserId, workDateYmd)
        if (cancelled) return
        if (schedRes.error) errParts.push(schedRes.error)
        setStaffDayScheduleJobs(schedRes.data ?? [])

        type SessRow = { work_date: string; job_ledger_id: string | null; bid_id: string | null }
        const sessRows = await withSupabaseRetry(
          async () =>
            supabase
              .from('clock_sessions')
              .select('work_date, job_ledger_id, bid_id')
              .eq('user_id', targetUserId)
              .eq('work_date', workDateYmd)
              .is('rejected_at', null)
              .is('revoked_at', null),
          'MercuryTransactionAllocationsModal tally day clock_sessions',
        )
        if (cancelled) return
        const rows = (sessRows ?? []) as SessRow[]

        const jobOrder: string[] = []
        const bidOrder: string[] = []
        const seenJ = new Set<string>()
        const seenB = new Set<string>()
        for (const r of rows) {
          if (r.job_ledger_id) {
            const id = r.job_ledger_id
            if (!seenJ.has(id)) {
              seenJ.add(id)
              jobOrder.push(id)
            }
          } else if (r.bid_id) {
            const id = r.bid_id
            if (!seenB.has(id)) {
              seenB.add(id)
              bidOrder.push(id)
            }
          }
        }

        const sessionJobs: JobSearchRow[] = []
        if (jobOrder.length > 0) {
          const jobRows = await withSupabaseRetry(
            async () =>
              supabase
                .from('jobs_ledger')
                .select('id, hcp_number, job_name, job_address, service_type_id')
                .in('id', jobOrder),
            'MercuryTransactionAllocationsModal staff day jobs_ledger',
          )
          if (cancelled) return
          const byId = new Map(
            ((jobRows ?? []) as {
              id: string
              hcp_number: string | null
              job_name: string | null
              job_address: string | null
              service_type_id: string | null
            }[]).map(
              (j) => [j.id, j],
            ),
          )
          for (const id of jobOrder) {
            const row = byId.get(id)
            const hn = row?.hcp_number?.trim() ?? ''
            const jn = row?.job_name?.trim() ?? ''
            const ja = row?.job_address?.trim() ?? ''
            sessionJobs.push({
              id,
              hcp_number: hn,
              job_name: jn || '—',
              job_address: ja,
              service_type_id: row?.service_type_id ?? null,
            })
          }
        }

        const sessionBids: { id: string; label: string }[] = []
        if (bidOrder.length > 0) {
          const bidRows = await withSupabaseRetry(
            async () =>
              supabase.from('bids').select('id, bid_number, project_name, service_type_id').in('id', bidOrder),
            'MercuryTransactionAllocationsModal staff day bids',
          )
          if (cancelled) return
          const byId = new Map(
            ((bidRows ?? []) as {
              id: string
              bid_number: string | null
              project_name: string | null
              service_type_id: string | null
            }[]).map((b) => [
              b.id,
              b,
            ]),
          )
          for (const id of bidOrder) {
            const row = byId.get(id)
            sessionBids.push({
              id,
              label: formatBidLedgerShortLine(
                ledgerPrefixMap,
                row?.service_type_id ?? null,
                row?.bid_number ?? null,
                row?.project_name ?? null,
              ),
            })
          }
        }

        if (cancelled) return
        setStaffDaySessionJobs(sessionJobs)
        setStaffDaySessionBids(sessionBids)
        setStaffDayContextError(errParts.length > 0 ? errParts.join(' ') : null)
      } catch (e) {
        if (!cancelled) {
          setStaffDayContextError(e instanceof Error ? e.message : 'Could not load schedule and sessions for that day.')
          setStaffDayScheduleJobs([])
          setStaffDaySessionJobs([])
          setStaffDaySessionBids([])
        }
      } finally {
        if (!cancelled) setStaffDayContextLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, tallySelfService, tallyActAsUserId, authUser?.id, transaction?.posted_at, transaction?.id, ledgerPrefixMap])

  const allocationSum = useMemo(() => {
    let sum = 0
    for (const ln of lines) {
      const d = lineDisplayDollars(ln, displayTotal)
      if (d === null) return { ok: false as const, sum: NaN }
      sum += d
    }
    return { ok: true as const, sum: round2(sum) }
  }, [lines, displayTotal])

  const remainder = useMemo(() => {
    if (!allocationSum.ok) return NaN
    return round2(displayTotal - allocationSum.sum)
  }, [displayTotal, allocationSum])

  const canSave = useMemo(() => {
    if (!transaction) return false
    if (internalTransfersLabelLocked === true) return false
    if (lines.length === 0) return true
    if (displayTotal <= 0) return false
    if (!allocationSum.ok) return false
    return Math.abs(remainder) < sumEpsilon
  }, [transaction, internalTransfersLabelLocked, lines.length, displayTotal, allocationSum.ok, remainder])

  const recentChipsOrdered = useMemo(() => {
    if (!recentPersonPicksStorageKey) return []
    const valid = new Set(usersOptions.filter(isSelectableOption).map((o) => o.value))
    return recentPersonIds.filter((id) => valid.has(id))
  }, [recentPersonPicksStorageKey, recentPersonIds, usersOptions])

  const addJobLine = useCallback(
    (row: JobSearchRow) => {
      if (internalTransfersLabelLocked === true) {
        showToast(
          'This transaction is labeled Internal Transfers and cannot be split onto jobs. Remove the label first.',
          'error',
        )
        return
      }
      setLines((prev) => {
        if (prev.some((p) => p.jobId === row.id)) return prev
        const label = formatJobLedgerShortLine(
          ledgerPrefixMap,
          row.service_type_id,
          row.hcp_number,
          row.job_name,
        ).trim()
        const appended = [
          ...prev,
          { jobId: row.id, jobLabel: label, mode: 'dollars' as SplitMode, valueStr: '', note: '' },
        ]
        return redistributeEqualSplit(appended, displayTotal)
      })
      setJobSearch('')
      setJobResults([])
    },
    [displayTotal, ledgerPrefixMap, internalTransfersLabelLocked, showToast],
  )

  const removeLine = useCallback((jobId: string) => {
    setLines((prev) => {
      const next = prev.filter((p) => p.jobId !== jobId)
      if (next.length === 0) return []
      return redistributeEqualSplit(next, displayTotal)
    })
  }, [displayTotal])

  const updateLine = useCallback((jobId: string, patch: Partial<Pick<SplitLine, 'mode' | 'valueStr' | 'note'>>) => {
    setLines((prev) => prev.map((p) => (p.jobId === jobId ? { ...p, ...patch } : p)))
  }, [])

  const fillRemainder = useCallback(
    (jobId: string) => {
      setLines((prev) => {
        let sumOthers = 0
        for (const p of prev) {
          if (p.jobId === jobId) continue
          const d = lineDisplayDollars(p, displayTotal)
          if (d === null) return prev
          sumOthers += d
        }
        const rem = round2(displayTotal - sumOthers)
        if (rem < -sumEpsilon) return prev
        return prev.map((p) =>
          p.jobId === jobId ? { ...p, mode: 'dollars' as SplitMode, valueStr: rem < sumEpsilon ? '0' : String(rem) } : p,
        )
      })
    },
    [displayTotal],
  )

  async function handleSave() {
    if (!transaction) return
    if (internalTransfersLabelLocked === true) {
      showToast(
        'This transaction is labeled Internal Transfers and cannot be split onto jobs. Remove the label first.',
        'error',
      )
      return
    }
    if (!canSave) {
      showToast(
        lines.length > 0
          ? displayTotal <= 0
            ? 'Cannot split a zero-amount transaction.'
            : 'Allocated amounts must equal the charge total.'
          : 'Invalid amounts.',
        'error',
      )
      return
    }
    setSaving(true)
    try {
      const p_rows =
        lines.length === 0
          ? []
          : lines.map((ln) => {
              const displayD = lineDisplayDollars(ln, displayTotal)
              if (displayD === null) throw new Error('Invalid line')
              const row: { job_id: string; amount: number; note?: string } = {
                job_id: ln.jobId,
                amount: round2(allocationSign * displayD),
              }
              const nt = ln.note.trim()
              if (nt !== '') row.note = nt
              return row
            })
      const uid = userId.trim()
      const legacyOnly = Boolean(initialPersonId && !initialUserId)
      let p_user_id: string | null = null
      let p_person_id: string | null = null
      if (stripAttribution) {
        p_user_id = null
        p_person_id = null
      } else if (uid !== '') {
        p_user_id = uid
        p_person_id = null
      } else if (initialUserId) {
        p_user_id = null
        p_person_id = null
      } else if (legacyOnly) {
        p_person_id = initialPersonId
        p_user_id = null
      } else {
        p_user_id = null
        p_person_id = null
      }
      if (tallySelfService) {
        if (tallyActAsUserId) {
          await withSupabaseRetry(
            async () =>
              supabase.rpc('replace_mercury_job_splits_for_linked_card_as_staff', {
                p_for_user_id: tallyActAsUserId,
                p_mercury_transaction_id: transaction.id,
                p_rows: p_rows as unknown as Json,
              }),
            'replace_mercury_job_splits_for_linked_card_as_staff',
          )
        } else {
          await withSupabaseRetry(
            async () =>
              supabase.rpc('replace_mercury_job_splits_for_my_linked_card', {
                p_mercury_transaction_id: transaction.id,
                p_rows: p_rows as unknown as Json,
              }),
            'replace_mercury_job_splits_for_my_linked_card',
          )
        }
      } else {
        const replaceMercurySplitsPayload: ReplaceMercuryTransactionSplitsCall = {
          p_mercury_transaction_id: transaction.id,
          p_rows: p_rows as unknown as Json,
          p_person_id: p_person_id ?? null,
          p_user_id: p_user_id ?? null,
        }
        await withSupabaseRetry(
          async () =>
            supabase.rpc(
              'replace_mercury_transaction_splits',
              replaceMercurySplitsPayload as unknown as Database['public']['Functions']['replace_mercury_transaction_splits']['Args'],
            ),
          'replace_mercury_transaction_splits',
        )
      }
      if (!tallySelfService && recentPersonPicksStorageKey && p_user_id) {
        pushRecentPersonUserId(recentPersonPicksStorageKey, p_user_id)
      }
      const savedAllocations: MercuryJobSplit[] = p_rows.map((r) => {
        const s: MercuryJobSplit = { job_id: r.job_id, amount: r.amount }
        if (r.note != null && r.note !== '') s.note = r.note
        return s
      })
      showToast('Saved allocations.', 'success')
      onSaved({
        mercuryTransactionId: transaction.id,
        userId: tallySelfService ? tallyActAsUserId ?? null : p_user_id,
        personId: tallySelfService ? null : p_person_id,
        allocations: savedAllocations,
      })
      onClose()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open || !transaction) return null

  const emptyUserOption: SearchableSelectOption = { value: '', label: '—' }
  const hasLegacyPerson = Boolean(initialPersonId && !initialUserId)
  const showAttributionHint = hasLegacyPerson && legacyPersonDisplayName

  const summaryDebitCardId = mercuryDebitCardIdFromRaw(transaction.raw)
  const summaryDebitDisplay = summaryDebitCardId
    ? nicknameByDebitCard[summaryDebitCardId] ?? formatMercuryDebitCardIdCompact(summaryDebitCardId)
    : '—'
  const summaryAccountDisplay =
    nicknameByAccount[transaction.mercury_account_id] ?? shortUuidPrefix(transaction.mercury_account_id)
  const summaryCounterparty = transaction.counterparty_name ?? '—'

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1150,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mercury-alloc-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: 8,
          width: 'min(640px, calc(100vw - 2rem))',
          maxHeight: '90vh',
          overflow: 'auto',
          padding: '1rem 1.25rem',
          boxSizing: 'border-box',
        }}
      >
        <h2 id="mercury-alloc-title" style={{ margin: '0 0 0.75rem', fontSize: '1.125rem', fontWeight: 600 }}>
          {tallySelfService ? 'Assign to jobs' : 'Link to person and jobs'}
        </h2>

        {internalTransfersLabelLocked === true ? (
          <div
            role="status"
            aria-live="polite"
            style={{
              marginBottom: '0.85rem',
              padding: '0.65rem 0.85rem',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              color: '#334155',
              fontSize: '0.8125rem',
              lineHeight: 1.45,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '0.15rem' }}>
              Locked: Internal Transfers
            </div>
            This transaction is labeled <strong>Internal Transfers</strong> and cannot be split onto jobs.
            Remove the label in <strong>Banking → Mercury → Drag Sort</strong> first.
          </div>
        ) : null}

        <div style={{ overflowX: 'auto', marginBottom: '0.85rem' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.8125rem',
              border: '1px solid #e5e7eb',
              borderRadius: 6,
            }}
          >
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                <th style={{ padding: '0.4rem 0.5rem', textAlign: 'center', fontWeight: 600, color: '#475569' }}>Posted</th>
                <th style={{ padding: '0.4rem 0.5rem', textAlign: 'center', fontWeight: 600, color: '#475569' }}>Amount</th>
                <th style={{ padding: '0.4rem 0.5rem', textAlign: 'center', fontWeight: 600, color: '#475569' }}>Debit card</th>
                <th style={{ padding: '0.4rem 0.5rem', textAlign: 'center', fontWeight: 600, color: '#475569' }}>Account</th>
                <th style={{ padding: '0.4rem 0.5rem', textAlign: 'center', fontWeight: 600, color: '#475569' }}>Counterparty</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '0.45rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                  {formatPostedDate(transaction.posted_at)}
                </td>
                <td style={{ padding: '0.45rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                  {formatCurrency(Number(transaction.amount))}
                </td>
                <td
                  style={{
                    padding: '0.45rem 0.5rem',
                    textAlign: 'center',
                    maxWidth: 120,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    verticalAlign: 'top',
                  }}
                  title={summaryDebitDisplay}
                >
                  {summaryDebitDisplay}
                </td>
                <td
                  style={{
                    padding: '0.45rem 0.5rem',
                    textAlign: 'center',
                    maxWidth: 120,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    verticalAlign: 'top',
                  }}
                  title={summaryAccountDisplay}
                >
                  {summaryAccountDisplay}
                </td>
                <td
                  style={{
                    padding: '0.45rem 0.5rem',
                    textAlign: 'center',
                    maxWidth: 180,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    verticalAlign: 'top',
                  }}
                  title={summaryCounterparty}
                >
                  {summaryCounterparty}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ marginBottom: '1rem' }}>
        <input
          type="text"
          value={jobSearch}
          onChange={(e) => setJobSearch(e.target.value)}
          placeholder="Transaction's Job Assignment (to search type 3+ characters)"
          aria-label="Search jobs for transaction assignment"
          disabled={internalTransfersLabelLocked === true}
          style={{
            width: '100%',
            padding: '8px 10px',
            marginBottom: '0.5rem',
            fontSize: '0.875rem',
            boxSizing: 'border-box',
            opacity: internalTransfersLabelLocked === true ? 0.55 : 1,
            cursor: internalTransfersLabelLocked === true ? 'not-allowed' : 'auto',
          }}
        />
        {lines.length === 0 ? (
          <div
            style={{
              fontSize: '0.8125rem',
              marginBottom: '0.5rem',
              color: '#6b7280',
              textAlign: 'center',
            }}
          >
            Adding multiple jobs splits the cost across those jobs. This happens rarely.
          </div>
        ) : null}
        {jobSearch.trim().length > 2 && jobSearchLoading ? (
          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.35rem' }}>Searching…</div>
        ) : null}
        {jobSearch.trim().length > 2 && jobResults.length > 0 ? (
          <div
            style={{
              maxHeight: 140,
              overflow: 'auto',
              border: '1px solid #e5e7eb',
              borderRadius: 4,
              marginBottom: 0,
              fontSize: '0.8125rem',
            }}
          >
            {jobResults.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => addJobLine(r)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '0.45rem 0.65rem',
                  border: 'none',
                  borderBottom: '1px solid #f3f4f6',
                  background: 'white',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontWeight: 600 }}>
                  {formatJobLedgerShortLine(ledgerPrefixMap, r.service_type_id ?? null, r.hcp_number, r.job_name)}
                </span>
                <span style={{ color: '#6b7280' }}> · {r.job_address}</span>
              </button>
            ))}
          </div>
        ) : null}
        </div>

        {!tallySelfService && showAttributionHint ? (
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', color: '#6b7280' }}>
            Legacy person (roster): <strong>{legacyPersonDisplayName}</strong>. Pick a user below to replace with a login, or remove attribution.
          </p>
        ) : null}

        {!tallySelfService ? (
          <>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '0.4rem 0.5rem',
                marginBottom: '0.35rem',
              }}
            >
              <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Person</span>
              {recentChipsOrdered.length > 0 ? (
                <>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Recent</span>
                  {recentChipsOrdered.map((id) => {
                    const opt = usersOptions.find(
                      (o): o is SearchableSelectSelectableOption =>
                        isSelectableOption(o) && o.value === id,
                    )
                    const label = opt?.label ?? shortUuidPrefix(id)
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          setUserId(id)
                          setStripAttribution(false)
                        }}
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          padding: '3px 10px',
                          borderRadius: 999,
                          border: '1px solid #e2e8f0',
                          background: userId === id ? '#e0f2fe' : '#fff',
                          color: '#334155',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          maxWidth: 140,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={label}
                      >
                        {label}
                      </button>
                    )
                  })}
                </>
              ) : null}
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <SearchableSelect
                value={userId}
                onChange={(v) => {
                  setUserId(v)
                  setStripAttribution(false)
                }}
                options={usersOptions}
                emptyOption={emptyUserOption}
                placeholder="Optional"
                listAriaLabel="Person"
                portalZIndex={1160}
              />
            </div>
            {(initialPersonId || initialUserId) && (
              <div style={{ marginBottom: '1rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setUserId('')
                    setStripAttribution(true)
                  }}
                  style={{ fontSize: '0.75rem', color: '#b91c1c', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  Remove person attribution
                </button>
              </div>
            )}
          </>
        ) : null}

        {showTallyDayContext ? (
          <div style={{ marginBottom: '1rem' }}>
            {staffDayContextLoading ? (
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem' }}>Loading schedule and sessions…</div>
            ) : null}
            {staffDayContextError ? (
              <div style={{ fontSize: '0.75rem', color: '#b91c1c', marginBottom: '0.5rem' }}>{staffDayContextError}</div>
            ) : null}

            <div style={{ marginBottom: '0.75rem' }}>
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#475569',
                  marginBottom: '0.35rem',
                  textAlign: 'center',
                }}
              >
                {tallyScheduleHeadings.scheduleTitle}
              </div>
              {staffDayScheduleJobs.length === 0 && !staffDayContextLoading ? (
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>None on schedule</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {staffDayScheduleJobs.map((d) => {
                    const addr = (d.job_address ?? '').trim()
                    return (
                      <button
                        key={d.jobId}
                        type="button"
                        onClick={() => addJobLine(dispatchScheduledJobToSearchRow(d))}
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          padding: '0.45rem 0.65rem',
                          border: '1px solid #e5e7eb',
                          borderRadius: 6,
                          background: '#fff',
                          cursor: 'pointer',
                          fontSize: '0.8125rem',
                          fontFamily: 'inherit',
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <div style={{ fontWeight: 600 }}>
                            {d.windowsLabel}
                            <span style={{ fontWeight: 400, color: '#64748b' }}> | </span>
                            <span style={{ fontWeight: 600 }}>
                              {formatJobLedgerShortLine(ledgerPrefixMap, d.service_type_id, d.hcp_number, d.job_name)}
                            </span>
                          </div>
                          {addr !== '' ? (
                            <div style={{ fontSize: '0.8125rem', color: '#6b7280', fontWeight: 400 }}>{addr}</div>
                          ) : null}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div style={{ marginBottom: '0.25rem' }}>
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#475569',
                  marginBottom: '0.35rem',
                  textAlign: 'center',
                }}
              >
                {tallyScheduleHeadings.clockSessionsTitle}
              </div>
              {staffDaySessionJobs.length === 0 && staffDaySessionBids.length === 0 && !staffDayContextLoading ? (
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>No job or bid on sessions</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {staffDaySessionJobs.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => addJobLine(r)}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '0.45rem 0.65rem',
                        border: '1px solid #e5e7eb',
                        borderRadius: 6,
                        background: '#fff',
                        cursor: 'pointer',
                        fontSize: '0.8125rem',
                        fontFamily: 'inherit',
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>
                        {formatJobLedgerShortLine(ledgerPrefixMap, r.service_type_id, r.hcp_number, r.job_name)}
                      </span>
                      <span style={{ color: '#6b7280' }}> · {r.job_address}</span>
                    </button>
                  ))}
                  {staffDaySessionBids.map((b) => (
                    <div
                      key={b.id}
                      style={{
                        padding: '0.45rem 0.65rem',
                        border: '1px dashed #e5e7eb',
                        borderRadius: 6,
                        fontSize: '0.8125rem',
                        color: '#64748b',
                        background: '#f8fafc',
                      }}
                    >
                      {b.label}
                      <div style={{ fontSize: '0.72rem', marginTop: 4 }}>Splits use jobs only — use job search if you need a job line.</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {lines.map((ln) => {
          const dd = lineDisplayDollars(ln, displayTotal)
          const noteTrim = ln.note.trim()
          const jobLineTitle = [ln.jobLabel, noteTrim ? `Note: ${noteTrim}` : '', ln.jobId].filter(Boolean).join('\n')
          return (
            <div
              key={ln.jobId}
              style={{
                marginBottom: '0.65rem',
                padding: '0.65rem 0.75rem',
                borderRadius: 12,
                border: '1px solid #f1f5f9',
                background: '#fafafa',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  flexWrap: 'wrap',
                }}
              >
                <span
                  style={{ flex: '1 1 140px', minWidth: 0, fontSize: '0.8125rem', fontWeight: 500, color: '#1e293b' }}
                  title={jobLineTitle}
                >
                  {ln.jobLabel}
                </span>
                <div style={segmentGroupStyle} role="group" aria-label="Amount type">
                  <button
                    type="button"
                    onClick={() => updateLine(ln.jobId, { mode: 'dollars' })}
                    disabled={internalTransfersLabelLocked === true}
                    style={ln.mode === 'dollars' ? segmentBtnActive : segmentBtnInactive}
                    aria-pressed={ln.mode === 'dollars'}
                  >
                    $
                  </button>
                  <button
                    type="button"
                    onClick={() => updateLine(ln.jobId, { mode: 'percent' })}
                    disabled={internalTransfersLabelLocked === true}
                    style={ln.mode === 'percent' ? segmentBtnActive : segmentBtnInactive}
                    aria-pressed={ln.mode === 'percent'}
                  >
                    %
                  </button>
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  value={ln.valueStr}
                  onChange={(e) => updateLine(ln.jobId, { valueStr: e.target.value })}
                  placeholder={ln.mode === 'dollars' ? '0.00' : '0'}
                  aria-label={ln.mode === 'dollars' ? 'Dollar amount' : 'Percent of charge'}
                  disabled={internalTransfersLabelLocked === true}
                  style={splitAmountInputStyle}
                />
                {lines.length >= 2 ? (
                  <button
                    type="button"
                    onClick={() => fillRemainder(ln.jobId)}
                    disabled={displayTotal <= 0 || internalTransfersLabelLocked === true}
                    style={fillRemainderButtonStyle(
                      displayTotal <= 0 || internalTransfersLabelLocked === true,
                    )}
                    title="Set this line to the remaining dollars so totals match"
                  >
                    Fill remainder
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => removeLine(ln.jobId)}
                  disabled={internalTransfersLabelLocked === true}
                  style={removeLineButtonStyle}
                >
                  Remove
                </button>
              </div>
              {noteTrim ? (
                <div
                  aria-hidden
                  title={noteTrim}
                  style={{
                    fontSize: '0.75rem',
                    color: '#64748b',
                    marginTop: '0.35rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Note: {noteTrim}
                </div>
              ) : null}
              {ln.mode === 'percent' && displayTotal > 0 && Number.isFinite(dd ?? NaN) && ln.valueStr.trim() !== '' ? (
                <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '0.35rem' }}>
                  ≈ {formatCurrency(dd ?? 0)} of {formatCurrency(displayTotal)}
                </div>
              ) : null}
              <input
                type="text"
                value={ln.note}
                onChange={(e) => updateLine(ln.jobId, { note: e.target.value })}
                placeholder="Note (optional)"
                aria-label="Note for this job split"
                disabled={internalTransfersLabelLocked === true}
                style={{
                  width: '100%',
                  marginTop: '0.5rem',
                  padding: '8px 12px',
                  fontSize: '0.8125rem',
                  boxSizing: 'border-box',
                  border: '1px solid #e2e8f0',
                  borderRadius: 10,
                  background: '#fff',
                  fontFamily: 'inherit',
                }}
              />
            </div>
          )
        })}

        {lines.length > 0 ? (
        <div
          style={{
            fontSize: '0.8125rem',
            marginBottom: '1rem',
            color: displayTotal <= 0 ? '#6b7280' : canSave ? '#059669' : '#b45309',
            textAlign: 'start',
          }}
        >
          {displayTotal <= 0 ? (
            'Zero charge — remove job lines or adjust the transaction in Mercury.'
          ) : (
            <>
              Allocated: {allocationSum.ok ? formatCurrency(allocationSum.sum) : '—'} · Remainder:{' '}
              {allocationSum.ok ? formatCurrency(remainder) : '—'}
            </>
          )}
        </div>
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.45rem 0.85rem',
              border: '1px solid #d1d5db',
              background: 'white',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !canSave}
            style={{
              padding: '0.45rem 1rem',
              borderRadius: 4,
              border: '1px solid #1d4ed8',
              background: saving || !canSave ? '#93c5fd' : '#2563eb',
              color: 'white',
              cursor: saving || !canSave ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
