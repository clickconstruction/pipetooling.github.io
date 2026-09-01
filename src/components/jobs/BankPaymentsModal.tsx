import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { SearchableSelect } from '../SearchableSelect'
import { BankingSortingConfigModal } from '../BankingSortingConfigModal'
import type { BankingSortingConfigV1 } from '../../lib/bankingSortingConfig'
import {
  BANKING_SORTING_CONFIG_VERSION,
  bankSortingConfigsFilterEqual,
  defaultBankingSortingConfig,
  fetchBankPaymentsSortingConfigFromAppSettings,
  loadBankPaymentsSortingConfig,
  loadBankPaymentsSortingConfigFromLocalCache,
  resolveSortingConfigAfterFetch,
  saveBankPaymentsSortingConfigToLocalCache,
  upsertBankPaymentsSortingConfigToAppSettings,
} from '../../lib/bankingSortingConfig'
import {
  defaultKindBadgeColor,
  fetchBankPaymentsKindBadgesFromAppSettings,
  loadBankPaymentsKindBadges,
  mercuryKindPaymentTypeLabel,
  normalizeHexColor,
  pickTextOnBackground,
  saveBankPaymentsKindBadgesLocalCache,
  upsertBankPaymentsKindBadgesToAppSettings,
  type MercuryKindBadge,
} from '../../lib/bankPaymentsKindBadges'
import { mercuryDebitCardIdFromRaw } from '../../lib/mercuryRawDebitCard'
import { supabase } from '../../lib/supabase'
import {
  bankPaymentTargetCuesAfterAmount,
  bankPaymentTargetDetailLead,
  bankPaymentTargetPrimaryLabel,
  bankPaymentTargetsFromStageRows,
  formatBankPaymentTargetDollars,
  type BankPaymentTarget,
  type StageRow,
} from '../../lib/jobsStagesBoard'
import { useMercuryLedgerNicknames } from '../../hooks/useMercuryLedgerNicknames'
import { APP_CALENDAR_TZ, denverCalendarDayKey, formatWorkDateYmdFriendly } from '../../utils/dateUtils'
import { withSupabaseRetry } from '../../utils/errorHandling'
import type { Database } from '../../types/database'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'
import {
  arRecordedPaymentAmountStr,
  arRecordedPaymentOptions,
  arRecordedPaymentSearchLabel,
  type ArRecordedPaymentCandidate,
} from '../../lib/arRecordedPaymentTargets'
import {
  allStripeAllocationsAutoClose,
  arStripeAutoCloseCandidates,
  type ArStripeAutoCloseCandidate,
} from '../../lib/arStripeAutoClose'
import { matchArDepositToPayer } from '../../lib/jobs/arDepositCustomerMatch'
import { buildArExactMatchSweep } from '../../lib/jobs/arExactMatchSweep'
import { findExactBillCombos } from '../../lib/jobs/arPayerBillCombos'
import { readEdgeFunctionErrorBody } from '../../lib/readEdgeFunctionErrorBody'

type MercuryCandidate =
  Database['public']['Functions']['list_mercury_transactions_for_bank_payments']['Returns'][number]

type ArAllocationRow =
  Database['public']['Functions']['list_ar_allocations_for_mercury_transaction']['Returns'][number]

function formatMoney(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Parses allocation amount input; strips thousands commas and optional leading `$` (auto-fill uses commas). */
function parseBankPaymentAllocationAmount(raw: string): number {
  let s = raw.trim().replace(/,/g, '')
  if (s.startsWith('$')) s = s.slice(1).trim()
  const n = Number(s)
  return Number.isFinite(n) ? n : Number.NaN
}

function allocationAmountStrForTargetChange(
  target: BankPaymentTarget | undefined,
  mercuryCap: number,
  otherRowsPositiveSum: number,
): string {
  if (!target) return ''
  const mercuryLeft = Math.max(0, mercuryCap - otherRowsPositiveSum)
  const suggested = Math.min(target.remaining, mercuryLeft)
  if (!(suggested > 0)) return ''
  return formatMoney(suggested)
}

/** Mercury row has no linked job payments yet (full deposit still available). */
const AR_BANK_PAYMENT_QUICK_MATCH_EPS = 0.02
/** Billed line balance may be up to this much over the deposit to show as a quick pick. */
const AR_BANK_PAYMENT_QUICK_MATCH_MAX_OVER = 26
/** Show "Applied to jobs" when linked payment sum exceeds this (aligns with validation tolerances). */
const AR_BANK_PAYMENT_CONSUMED_DISPLAY_EPS = 0.01
/** Matches list RPC remainder rule: treat as no allocatable balance when at or below this. */
const AR_BANK_REMAINING_EPS = 0.0005

const BANK_PAYMENTS_SUMMARY_CARD_STYLE: CSSProperties = {
  marginBottom: '1rem',
  padding: '0.75rem',
  background: 'var(--bg-subtle)',
  borderRadius: 6,
  fontSize: '0.875rem',
}

function canRoleApplyBankPayments(role: string | null): boolean {
  return role === 'dev' || role === 'master_technician' || isAssistantLike(role) || role === 'primary'
}

function KindBadgePill({
  kind,
  kindBadges,
}: {
  kind: string
  kindBadges: Record<string, MercuryKindBadge>
}) {
  const b = kindBadges[kind]
  const label = mercuryKindPaymentTypeLabel(kind, kindBadges)
  const bg = normalizeHexColor(b?.color ?? '') ?? defaultKindBadgeColor()
  const color = pickTextOnBackground(bg)
  return (
    <span
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        maxWidth: '100%',
        padding: '1px 6px',
        borderRadius: 4,
        fontSize: '0.7rem',
        fontWeight: 600,
        lineHeight: 1.35,
        background: bg,
        color,
        wordBreak: 'break-word',
      }}
    >
      {label}
    </span>
  )
}

export type BankPaymentsModalProps = {
  open: boolean
  onClose: () => void
  authUserId: string | undefined
  authRole: string | null
  billedRows: StageRow[]
  /** True while parent jobs list is still loading and billed rows are not yet available (deep link open). */
  billedTargetsLoading?: boolean
  onApplied: () => void | Promise<void>
  /** Applied breakdown: open Edit job for this jobs_ledger id (e.g. from Jobs + JobFormModalContext). */
  onOpenEditJob?: (jobId: string) => void
}

/**
 * kind 'billed' (default) targets a billed non-Stripe line (creates a payment);
 * kind 'payment' (v2.1191) LINKS an existing recorded payment row — targetKey is
 * the jobs_ledger_payments id and the amount is locked to that row.
 */
type AllocLine = { id: string; kind: 'billed' | 'payment'; targetKey: string; amountStr: string }

export default function BankPaymentsModal({
  open,
  onClose,
  authUserId,
  authRole,
  billedRows,
  billedTargetsLoading = false,
  onApplied,
  onOpenEditJob,
}: BankPaymentsModalProps) {
  const { nicknameByAccount, nicknameByDebitCard } = useMercuryLedgerNicknames({ enabled: open })
  const [sortingConfig, setSortingConfig] = useState<BankingSortingConfigV1>(
    () => loadBankPaymentsSortingConfigFromLocalCache() ?? defaultBankingSortingConfig(),
  )
  /**
   * Cold cache: hold the list fetch until the org config resolves — otherwise the
   * first fetch runs with the unfiltered default and shows the whole bank feed.
   */
  const [sortingConfigResolved, setSortingConfigResolved] = useState<boolean>(
    () => loadBankPaymentsSortingConfigFromLocalCache() != null,
  )
  const [devFilterOpen, setDevFilterOpen] = useState(false)
  const [sortingConfigModalOpen, setSortingConfigModalOpen] = useState(false)
  const [kindChoices, setKindChoices] = useState<string[]>([])
  const [accountChoices, setAccountChoices] = useState<string[]>([])
  const [debitCardChoices, setDebitCardChoices] = useState<string[]>([])

  const [candidates, setCandidates] = useState<MercuryCandidate[]>([])
  const [bankTxSearchQuery, setBankTxSearchQuery] = useState('')
  const [includeHiddenArDeposits, setIncludeHiddenArDeposits] = useState(false)
  const [arBankReturnedMarkMode, setArBankReturnedMarkMode] = useState(false)
  const [returnedToggleSavingId, setReturnedToggleSavingId] = useState<string | null>(null)
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState<string | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [allocLines, setAllocLines] = useState<AllocLine[]>([])
  const [recordedPayments, setRecordedPayments] = useState<ArRecordedPaymentCandidate[]>([])
  const [internalNote, setInternalNote] = useState('')
  const [applyError, setApplyError] = useState<string | null>(null)
  const [applySubmitting, setApplySubmitting] = useState(false)
  const [kindBadges, setKindBadges] = useState<Record<string, MercuryKindBadge>>(() => loadBankPaymentsKindBadges())
  const [arAllocations, setArAllocations] = useState<ArAllocationRow[]>([])
  const [arAllocationsLoading, setArAllocationsLoading] = useState(false)
  const [arAllocationsError, setArAllocationsError] = useState<string | null>(null)

  const targets = useMemo(() => bankPaymentTargetsFromStageRows(billedRows), [billedRows])
  const targetByKey = useMemo(() => new Map(targets.map((t) => [t.key, t] as const)), [targets])
  const targetSelectOptions = useMemo(
    () =>
      targets.map((t) => {
        const cues = bankPaymentTargetCuesAfterAmount(t)
        const dollars = formatBankPaymentTargetDollars(t.remaining)
        return {
          value: t.key,
          label: t.searchLabel,
          labelContent: (
            <>
              <strong style={{ fontWeight: 600 }}>{dollars}</strong>
              {cues ? <span>{` · ${cues}`}</span> : null}
            </>
          ),
        }
      }),
    [targets],
  )

  const filteredCandidates = useMemo(() => {
    const q = bankTxSearchQuery.trim().toLowerCase()
    if (!q) return candidates
    return candidates.filter((c) => {
      const cp = (c.counterparty_name ?? '').toLowerCase()
      const note = (c.note ?? '').toLowerCase()
      const memo = (c.external_memo ?? '').toLowerCase()
      const amountStr = formatMoney(Math.abs(Number(c.amount))).toLowerCase()
      const posted = c.posted_at
        ? new Date(c.posted_at).toLocaleDateString('en-US', { timeZone: APP_CALENDAR_TZ }).toLowerCase()
        : ''
      return (
        cp.includes(q) ||
        note.includes(q) ||
        memo.includes(q) ||
        amountStr.includes(q) ||
        posted.includes(q)
      )
    })
  }, [candidates, bankTxSearchQuery])

  const selected = useMemo(
    () => (selectedId ? candidates.find((c) => c.mercury_transaction_id === selectedId) ?? null : null),
    [candidates, selectedId],
  )

  const canAllocateRemaining = useMemo(
    () => selected != null && Number(selected.remaining_available) > AR_BANK_REMAINING_EPS,
    [selected],
  )

  const kindPaymentTypeLabel = useMemo(
    () => (selected ? mercuryKindPaymentTypeLabel(selected.kind, kindBadges) : ''),
    [selected, kindBadges],
  )

  /** `jobs_ledger_payments.paid_on` — Chicago calendar day from Mercury `posted_at` only (not user-editable). */
  const paidOnYmdFromMercury = useMemo(() => {
    if (!selected?.posted_at) return null
    try {
      const ms = new Date(selected.posted_at).getTime()
      if (Number.isNaN(ms)) return null
      return denverCalendarDayKey(ms)
    } catch {
      return null
    }
  }, [selected])

  const canApply = canRoleApplyBankPayments(authRole)

  /** List is loading OR the first fetch is still held for the org sorting config (cold cache). */
  const listBusy = listLoading || !sortingConfigResolved

  const applyAllocationTarget = useCallback(
    (lineId: string, targetKey: string) => {
      setAllocLines((rows) => {
        const otherSum = rows
          .filter((r) => r.id !== lineId)
          .reduce((s, r) => {
            const n = parseBankPaymentAllocationAmount(r.amountStr)
            return s + (Number.isFinite(n) && n > 0 ? n : 0)
          }, 0)
        const mercuryCap = selected ? Number(selected.remaining_available) : 0
        const target = targetKey.trim() ? targetByKey.get(targetKey) : undefined
        const amountStr = allocationAmountStrForTargetChange(target, mercuryCap, otherSum)
        return rows.map((r) => (r.id === lineId ? { ...r, targetKey, amountStr } : r))
      })
    },
    [selected, targetByKey],
  )

  const recordedPaymentById = useMemo(
    () => new Map(recordedPayments.map((p) => [p.payment_id, p] as const)),
    [recordedPayments],
  )

  /** Switch an allocation line's kind, clearing its target and amount. */
  const setAllocLineKind = useCallback((lineId: string, kind: 'billed' | 'payment') => {
    setAllocLines((rows) =>
      rows.map((r) => (r.id === lineId && r.kind !== kind ? { ...r, kind, targetKey: '', amountStr: '' } : r)),
    )
  }, [])

  /** Pick a recorded payment for a line — the amount locks to the row. */
  const applyRecordedPaymentTarget = useCallback(
    (lineId: string, paymentId: string) => {
      setAllocLines((rows) =>
        rows.map((r) => {
          if (r.id !== lineId) return r
          const p = paymentId.trim() ? recordedPaymentById.get(paymentId) : undefined
          return { ...r, targetKey: paymentId, amountStr: p ? arRecordedPaymentAmountStr(p) : '' }
        }),
      )
    },
    [recordedPaymentById],
  )

  const bankPaymentQuickMatchTargets = useMemo(() => {
    if (!selected || targets.length === 0) return []
    const bankAbs = Math.abs(Number(selected.amount))
    const remAvail = Number(selected.remaining_available)
    if (bankAbs - remAvail > AR_BANK_PAYMENT_QUICK_MATCH_EPS) return []
    return targets
      .filter(
        (t) =>
          t.remaining >= bankAbs - 0.01 && t.remaining <= bankAbs + AR_BANK_PAYMENT_QUICK_MATCH_MAX_OVER,
      )
      .slice()
      .sort((a, b) => a.remaining - b.remaining)
  }, [selected, targets])

  /**
   * The payer this deposit most plausibly came from (counterparty → note →
   * memo vs customer/GC names on the open billed lines). Leads the chip UI
   * with that payer's bills; never auto-applies.
   */
  const depositPayerMatch = useMemo(() => {
    if (!selected || targets.length === 0) return null
    return matchArDepositToPayer(
      {
        counterparty_name: selected.counterparty_name,
        note: selected.note,
        external_memo: selected.external_memo,
      },
      targets,
    )
  }, [selected, targets])

  /** The matched payer's open billed lines: deposit-amount matches first, then largest remaining. */
  const depositPayerTargets = useMemo(() => {
    if (!depositPayerMatch || !selected) return []
    const remAvail = Number(selected.remaining_available)
    const matchesDeposit = (rem: number) =>
      rem >= remAvail - 0.01 && rem <= remAvail + AR_BANK_PAYMENT_QUICK_MATCH_MAX_OVER
    const keys = new Set(depositPayerMatch.targetKeys)
    return targets
      .filter((t) => keys.has(t.key))
      .slice()
      .sort((a, b) => {
        const am = matchesDeposit(a.remaining)
        const bm = matchesDeposit(b.remaining)
        if (am !== bm) return am ? -1 : 1
        return b.remaining - a.remaining
      })
      .slice(0, 8)
  }, [depositPayerMatch, selected, targets])

  /** Amount-only quick picks not already shown in the payer section. */
  const quickMatchTargetsOutsidePayer = useMemo(() => {
    if (depositPayerTargets.length === 0) return bankPaymentQuickMatchTargets
    const shown = new Set(depositPayerTargets.map((t) => t.key))
    return bankPaymentQuickMatchTargets.filter((t) => !shown.has(t.key))
  }, [bankPaymentQuickMatchTargets, depositPayerTargets])

  /**
   * Exact-match sweep (batch pass): deposits where exactly one open non-Stripe
   * bill shares the cents-exact amount, and no other deposit claims it.
   */
  const exactMatchSweep = useMemo(
    () => buildArExactMatchSweep(candidates, targets),
    [candidates, targets],
  )
  const [sweepOpen, setSweepOpen] = useState(false)
  /** Deposit ids the user un-ticked in the review panel. */
  const [sweepExcluded, setSweepExcluded] = useState<Set<string>>(() => new Set())
  const [sweepApplying, setSweepApplying] = useState(false)
  const [sweepProgress, setSweepProgress] = useState(0)
  const [sweepResults, setSweepResults] = useState<Array<{ depositId: string; ok: boolean; error?: string }> | null>(
    null,
  )

  useEffect(() => {
    if (!open) {
      setSweepOpen(false)
      setSweepExcluded(new Set())
      setSweepResults(null)
      setSweepProgress(0)
    }
  }, [open])

  const candidateById = useMemo(
    () => new Map(candidates.map((c) => [c.mercury_transaction_id, c] as const)),
    [candidates],
  )

  /** Ticked pairs not already applied in this panel session (guards Retry from double-applying successes before the list refreshes). */
  const sweepPairsPending = exactMatchSweep.pairs.filter(
    (p) => !sweepExcluded.has(p.depositId) && sweepResults?.find((r) => r.depositId === p.depositId)?.ok !== true,
  )

  async function applyExactMatchSweep() {
    const toApply = sweepPairsPending
    if (toApply.length === 0 || !canApply) return
    setSweepApplying(true)
    /** Successes from a prior pass stay recorded so Retry can't double-apply them before the list refreshes. */
    const priorOk = (sweepResults ?? []).filter((r) => r.ok)
    setSweepResults(null)
    setSweepProgress(0)
    const results: Array<{ depositId: string; ok: boolean; error?: string }> = [...priorOk]
    for (const pair of toApply) {
      const d = candidateById.get(pair.depositId)
      const t = targetByKey.get(pair.targetKey)
      let outcome: { ok: boolean; error?: string }
      if (!d || !t) {
        outcome = { ok: false, error: 'Deposit or bill no longer listed — refresh and retry.' }
      } else {
        const postedMs = d.posted_at ? new Date(d.posted_at).getTime() : Number.NaN
        const paidOn = Number.isNaN(postedMs) ? null : denverCalendarDayKey(postedMs)
        if (!paidOn) {
          outcome = { ok: false, error: 'Missing Mercury posted date.' }
        } else {
          try {
            const data = await withSupabaseRetry(
              async () =>
                supabase.rpc('apply_mercury_bank_payment_allocations', {
                  p_mercury_transaction_id: d.mercury_transaction_id,
                  p_paid_on: paidOn,
                  p_payment_type: mercuryKindPaymentTypeLabel(d.kind, kindBadges),
                  p_note: '',
                  p_allocations: [
                    t.invoiceId
                      ? { invoice_id: t.invoiceId, amount: pair.amountCents / 100 }
                      : { job_id: t.jobId, amount: pair.amountCents / 100 },
                  ],
                  p_allow_stripe_hosted: false,
                }),
              'apply_mercury_bank_payment_allocations',
            )
            const payload = data as { error?: string } | null
            if (payload && typeof payload === 'object' && typeof payload.error === 'string' && payload.error) {
              outcome = { ok: false, error: payload.error }
            } else {
              outcome = { ok: true }
            }
          } catch (e: unknown) {
            outcome = { ok: false, error: e instanceof Error ? e.message : 'Apply failed' }
          }
        }
      }
      results.push({ depositId: pair.depositId, ...outcome })
      setSweepProgress((n) => n + 1)
    }
    setSweepResults(results)
    setSweepApplying(false)
    await onApplied()
    void refreshList()
    if (results.every((r) => r.ok)) {
      setSweepOpen(false)
      setSweepExcluded(new Set())
      setSweepResults(null)
    }
  }

  /** Targets whose remaining equals this deposit's remaining (same tolerance as the quick picks) — accents payer chips. */
  const depositAmountMatchKeys = useMemo(() => {
    if (!selected) return new Set<string>()
    const remAvail = Number(selected.remaining_available)
    return new Set(
      targets
        .filter(
          (t) => t.remaining >= remAvail - 0.01 && t.remaining <= remAvail + AR_BANK_PAYMENT_QUICK_MATCH_MAX_OVER,
        )
        .map((t) => t.key),
    )
  }, [selected, targets])

  /**
   * One-check-several-bills suggestion: when none of the matched payer's bills
   * equals the deposit but exactly ONE set of 2–4 of them sums to it
   * cents-exactly, offer that set as a single chip that fills the allocation
   * lines. More than one exact combo → too ambiguous, no suggestion.
   */
  const payerBillCombo = useMemo(() => {
    if (!depositPayerMatch || !selected || depositPayerTargets.length < 2) return null
    if (depositPayerTargets.some((t) => depositAmountMatchKeys.has(t.key))) return null
    const combos = findExactBillCombos(Number(selected.remaining_available), depositPayerTargets)
    if (combos.length !== 1) return null
    const comboTargets = combos[0]!.map((k) => targetByKey.get(k))
    if (comboTargets.some((t) => t == null)) return null
    return comboTargets as BankPaymentTarget[]
  }, [depositPayerMatch, selected, depositPayerTargets, depositAmountMatchKeys, targetByKey])

  /** Fill one allocation line per combo bill (replaces the single untouched line the chip renders next to). */
  const applyComboAllocation = useCallback((comboTargets: BankPaymentTarget[]) => {
    setAllocLines(
      comboTargets.map((t) => ({
        id: crypto.randomUUID(),
        kind: 'billed' as const,
        targetKey: t.key,
        amountStr: formatMoney(t.remaining),
      })),
    )
  }, [])

  /**
   * Monotonic id of the newest list request. A refetch (config landing, filter
   * toggle) bumps it; older in-flight responses then discard themselves instead
   * of overwriting the newer list — the unfiltered cold-cache query is the slow
   * one, and last-resolve-wins is how it used to stomp the filtered result.
   */
  const listRequestSeqRef = useRef(0)

  const refreshList = useCallback(async () => {
    if (!open) return
    const seq = ++listRequestSeqRef.current
    setListLoading(true)
    setListError(null)
    try {
      const cfg = sortingConfig
      const p_filter = {
        v: BANKING_SORTING_CONFIG_VERSION,
        kinds: cfg.kinds,
        accountIds: cfg.accountIds,
        debitCardIds: cfg.debitCardIds,
        startDateYmd: cfg.startDateYmd,
        excludeCounterpartyContains: cfg.excludeCounterpartyContains,
        excludeNoteContains: cfg.excludeNoteContains,
        ...(includeHiddenArDeposits ? { includeHiddenArDeposits: true } : {}),
      }
      const data = await withSupabaseRetry(
        async () =>
          supabase.rpc('list_mercury_transactions_for_bank_payments', {
            p_filter,
          }),
        'list_mercury_transactions_for_bank_payments',
      )
      if (seq !== listRequestSeqRef.current) return
      const rows = (data ?? []) as MercuryCandidate[]
      setCandidates(rows)
      setSelectedId((prev) => {
        if (prev && rows.some((r) => r.mercury_transaction_id === prev)) return prev
        const first = rows[0]
        return first?.mercury_transaction_id ?? null
      })
    } catch (e: unknown) {
      if (seq !== listRequestSeqRef.current) return
      setListError(e instanceof Error ? e.message : 'Failed to load bank transactions')
      setCandidates([])
    } finally {
      if (seq === listRequestSeqRef.current) setListLoading(false)
    }
  }, [open, sortingConfig, includeHiddenArDeposits])

  const toggleMercuryReturned = useCallback(
    async (mercuryTransactionId: string, nextReturned: boolean) => {
      if (!canRoleApplyBankPayments(authRole)) return
      setReturnedToggleSavingId(mercuryTransactionId)
      try {
        await withSupabaseRetry(
          async () =>
            supabase.rpc('set_mercury_transaction_ar_returned', {
              p_mercury_transaction_id: mercuryTransactionId,
              p_returned: nextReturned,
            }),
          'set_mercury_transaction_ar_returned',
        )
        setCandidates((prev) => {
          const next =
            nextReturned && !includeHiddenArDeposits
              ? prev.filter((x) => x.mercury_transaction_id !== mercuryTransactionId)
              : prev.map((x) =>
                  x.mercury_transaction_id === mercuryTransactionId
                    ? { ...x, returned: nextReturned }
                    : x,
                )
          queueMicrotask(() => {
            setSelectedId((sel) =>
              next.some((r) => r.mercury_transaction_id === sel)
                ? sel
                : next[0]?.mercury_transaction_id ?? null,
            )
          })
          return next
        })
      } catch {
        void refreshList()
      } finally {
        setReturnedToggleSavingId(null)
      }
    },
    [authRole, includeHiddenArDeposits, refreshList],
  )

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      const { config, outcome } = await fetchBankPaymentsSortingConfigFromAppSettings()
      if (cancelled) return
      const resolution = resolveSortingConfigAfterFetch({
        outcome,
        fetched: config,
        legacyLocal: loadBankPaymentsSortingConfig(authUserId),
        orgCachePresent: loadBankPaymentsSortingConfigFromLocalCache() != null,
      })
      const next = resolution.config
      if (next) {
        setSortingConfig((prev) => (bankSortingConfigsFilterEqual(prev, next) ? prev : next))
        if (resolution.saveCache) saveBankPaymentsSortingConfigToLocalCache(next)
      }
      setSortingConfigResolved(true)
      if (resolution.migrateUpsert && next && authRole === 'dev') {
        try {
          await upsertBankPaymentsSortingConfigToAppSettings(next)
        } catch {
          /* RLS or network; keep legacy/local-derived filters for this browser */
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, authUserId, authRole])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      const local = loadBankPaymentsKindBadges()
      const { badges: remote, rowExists } = await fetchBankPaymentsKindBadgesFromAppSettings()
      if (cancelled) return
      if (rowExists) {
        setKindBadges(remote)
        saveBankPaymentsKindBadgesLocalCache(remote)
        return
      }
      setKindBadges(local)
      if (authRole === 'dev' && Object.keys(local).length > 0) {
        try {
          await upsertBankPaymentsKindBadgesToAppSettings(local)
          saveBankPaymentsKindBadgesLocalCache(local)
        } catch {
          /* RLS or network; keep local-only badges for this browser */
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, authRole])

  useEffect(() => {
    if (!open || !sortingConfigResolved) return
    void refreshList()
  }, [open, sortingConfigResolved, refreshList])

  useEffect(() => {
    if (open) return
    setArBankReturnedMarkMode(false)
  }, [open])

  useEffect(() => {
    if (!open || !selectedId) return
    setAllocLines([{ id: crypto.randomUUID(), kind: 'billed', targetKey: '', amountStr: '' }])
    setApplyError(null)
    setStripeOutOfBandConfirmed(false)
    setStripeCloseResults(null)
  }, [open, selectedId])

  // Recorded-payment candidates for the "Payment received" allocation kind
  // (v2.1191). Fail-soft: before the RPC is deployed (or on any error) the list
  // stays empty and the per-line kind toggle simply doesn't render.
  useEffect(() => {
    if (!open) {
      setRecordedPayments([])
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const { data, error } = await supabase.rpc('list_unlinked_payments_for_bank_payments')
        if (cancelled || error || !Array.isArray(data)) return
        setRecordedPayments(data as ArRecordedPaymentCandidate[])
      } catch {
        /* fail-soft — billed-line allocations still work */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) setBankTxSearchQuery('')
  }, [open])

  useEffect(() => {
    if (!open) {
      setArAllocations([])
      setArAllocationsError(null)
      setArAllocationsLoading(false)
    }
  }, [open])

  useEffect(() => {
    if (!open || !selected?.mercury_transaction_id) {
      setArAllocations([])
      setArAllocationsError(null)
      setArAllocationsLoading(false)
      return
    }
    const consumed = Number(selected.consumed)
    if (!(consumed > AR_BANK_PAYMENT_CONSUMED_DISPLAY_EPS)) {
      setArAllocations([])
      setArAllocationsError(null)
      setArAllocationsLoading(false)
      return
    }
    let cancelled = false
    const txId = selected.mercury_transaction_id
    setArAllocationsLoading(true)
    setArAllocationsError(null)
    void (async () => {
      try {
        const data = await withSupabaseRetry(
          async () =>
            supabase.rpc('list_ar_allocations_for_mercury_transaction', {
              p_mercury_transaction_id: txId,
            }),
          'list_ar_allocations_for_mercury_transaction',
        )
        if (!cancelled) {
          setArAllocations((data ?? []) as ArAllocationRow[])
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setArAllocationsError(e instanceof Error ? e.message : 'Failed to load applied breakdown')
          setArAllocations([])
        }
      } finally {
        if (!cancelled) setArAllocationsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, selected?.mercury_transaction_id, selected?.consumed])

  /** Keep selection on the filtered bank list; when the filter hides the current row, select the first visible row. */
  useEffect(() => {
    if (!open) return
    setSelectedId((prev) => {
      if (prev && filteredCandidates.some((r) => r.mercury_transaction_id === prev)) return prev
      return filteredCandidates[0]?.mercury_transaction_id ?? null
    })
  }, [open, filteredCandidates])

  const loadMercurySamplesForConfigModal = useCallback(async () => {
    const { data, error } = await supabase
      .from('mercury_transactions')
      .select('kind, mercury_account_id, raw')
      .limit(5000)
    if (error || !data) {
      setKindChoices([])
      setAccountChoices([])
      setDebitCardChoices([])
      return
    }
    const kinds = new Set<string>()
    const accounts = new Set<string>()
    const debits = new Set<string>()
    for (const row of data) {
      kinds.add(row.kind)
      accounts.add(row.mercury_account_id)
      const d = mercuryDebitCardIdFromRaw(row.raw)
      if (d) debits.add(d)
    }
    setKindChoices(Array.from(kinds).sort())
    setAccountChoices(Array.from(accounts).sort())
    setDebitCardChoices(Array.from(debits).sort())
  }, [])

  useEffect(() => {
    if (!sortingConfigModalOpen || authRole !== 'dev') return
    void loadMercurySamplesForConfigModal()
  }, [sortingConfigModalOpen, authRole, loadMercurySamplesForConfigModal])

  /**
   * v2.1614: allocations may target Stripe-hosted lines (customer paid outside
   * Stripe — check/cash/ACH), but only behind an explicit confirmation that
   * also reminds the user to void / mark the invoice out-of-band in Stripe.
   */
  const [stripeOutOfBandConfirmed, setStripeOutOfBandConfirmed] = useState(false)
  /**
   * v2.1639: per-invoice results of the post-apply Stripe auto-close. Non-null
   * with a failure keeps the modal open on a retry panel — the allocation
   * already applied (correct app-side); only the Stripe closure is pending.
   */
  const [stripeCloseResults, setStripeCloseResults] = useState<
    Array<ArStripeAutoCloseCandidate & { ok: boolean; error?: string }> | null
  >(null)
  const [stripeCloseRetrying, setStripeCloseRetrying] = useState(false)

  const stripeAllocationSelected = useMemo(() => {
    for (const line of allocLines) {
      if (!line.targetKey) continue
      if (line.kind === 'billed') {
        if (targetByKey.get(line.targetKey)?.stripeHosted) return true
      } else {
        if (recordedPaymentById.get(line.targetKey)?.stripe_hosted) return true
      }
    }
    return false
  }, [allocLines, targetByKey, recordedPaymentById])

  /** Parsed lines + targets in the kernel's shape (payment-kind lines pass through and are ignored there). */
  const stripeAutoCloseLines = useMemo(
    () =>
      allocLines.map((line) => ({
        kind: line.kind,
        targetKey: line.targetKey,
        amount: line.kind === 'billed' ? parseBankPaymentAllocationAmount(line.amountStr) : 0,
      })),
    [allocLines],
  )
  /** Every selected Stripe line exactly covered → the apply will close those Stripe invoices itself. */
  const stripeAutoCloseAll = useMemo(
    () => allStripeAllocationsAutoClose(stripeAutoCloseLines, targetByKey),
    [stripeAutoCloseLines, targetByKey],
  )

  const validationMessage = useMemo(() => {
    if (!selected) return null
    const cap = selected.remaining_available
    let sum = 0
    for (const line of allocLines) {
      if (line.kind === 'payment') {
        const p = line.targetKey ? recordedPaymentById.get(line.targetKey) : undefined
        if (!p) continue
        const amt = Math.abs(Number(p.amount) || 0)
        if (!(amt > 0)) continue
        sum += amt
        if (amt > cap + 0.01) {
          return `Recorded payment ${formatMoney(amt)} exceeds this bank transaction remaining (${formatMoney(cap)}).`
        }
        continue
      }
      const t = line.targetKey ? targetByKey.get(line.targetKey) : undefined
      if (!t) continue
      const amt = parseBankPaymentAllocationAmount(line.amountStr)
      if (!Number.isFinite(amt) || amt <= 0) continue
      sum += amt
      if (amt > t.remaining + 0.01) {
        return `Amount exceeds remaining on ${t.label} (${formatMoney(t.remaining)} max).`
      }
    }
    if (sum > cap + 0.01) {
      return `Total allocations (${formatMoney(sum)}) exceed this bank transaction remaining (${formatMoney(cap)}).`
    }
    return null
  }, [selected, allocLines, targetByKey, recordedPaymentById])

  const applyDisabled =
    !canApply ||
    !selected ||
    applySubmitting ||
    stripeCloseResults != null ||
    !!validationMessage ||
    (targets.length === 0 && recordedPayments.length === 0) ||
    !paidOnYmdFromMercury ||
    !canAllocateRemaining ||
    (stripeAllocationSelected && !stripeOutOfBandConfirmed)

  /**
   * v2.1639: mark one exactly-covered Stripe-hosted bill paid out-of-band in
   * Stripe (kills the emailed link). Runs AFTER the allocation RPC — the app
   * invoice is already `paid`, so the webhook's paid event no-ops (no second
   * payment row). The function re-checks the amount against Stripe's
   * amount_remaining and is idempotent, so retries are always safe.
   */
  async function closeStripeInvoiceOob(
    c: ArStripeAutoCloseCandidate,
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      const { data: sess } = await supabase.auth.getSession()
      const token = sess.session?.access_token
      if (!token) return { ok: false, error: 'No session' }
      if (!paidOnYmdFromMercury) return { ok: false, error: 'Missing Mercury posted date' }
      const { data, error } = await supabase.functions.invoke('record-stripe-invoice-out-of-band-payment', {
        headers: { Authorization: `Bearer ${token}` },
        body: {
          jobs_ledger_invoice_id: c.invoiceId,
          amount_dollars: c.amountDollars,
          paid_on: paidOnYmdFromMercury,
          payment_type: kindPaymentTypeLabel,
          internal_note:
            [internalNote.trim(), `AR allocation from Mercury deposit ${selected?.mercury_transaction_id ?? ''}`.trim()]
              .filter(Boolean)
              .join(' · ') || undefined,
          allow_app_paid: true,
        },
      })
      if (error) {
        const detail = await readEdgeFunctionErrorBody(error)
        return { ok: false, error: detail ?? (error instanceof Error ? error.message : 'Edge function failed') }
      }
      const payload = data as { error?: string } | null
      if (payload && typeof payload === 'object' && typeof payload.error === 'string' && payload.error) {
        return { ok: false, error: payload.error }
      }
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  }

  async function retryFailedStripeCloses() {
    if (!stripeCloseResults) return
    setStripeCloseRetrying(true)
    const next = [...stripeCloseResults]
    for (let i = 0; i < next.length; i++) {
      const r = next[i]!
      if (r.ok) continue
      const res = await closeStripeInvoiceOob(r)
      next[i] = { ...r, ok: res.ok, error: res.error }
    }
    setStripeCloseResults(next)
    setStripeCloseRetrying(false)
    if (next.every((r) => r.ok)) onClose()
  }

  async function submitApply() {
    if (!selected || !canApply || !canAllocateRemaining) return
    if (stripeAllocationSelected && !stripeOutOfBandConfirmed) return
    if (!paidOnYmdFromMercury) {
      setApplyError('Missing Mercury posted date for this transaction.')
      return
    }
    setApplySubmitting(true)
    setApplyError(null)
    const allocations: Array<{ invoice_id?: string; job_id?: string; payment_id?: string; amount: number }> = []
    for (const line of allocLines) {
      if (line.kind === 'payment') {
        const p = line.targetKey ? recordedPaymentById.get(line.targetKey) : undefined
        if (!p) continue
        const amt = Math.abs(Number(p.amount) || 0)
        if (!(amt > 0)) continue
        // Server uses the row's amount; amount is included for transparency only.
        allocations.push({ payment_id: p.payment_id, amount: amt })
        continue
      }
      const t = line.targetKey ? targetByKey.get(line.targetKey) : undefined
      if (!t) continue
      const amt = parseBankPaymentAllocationAmount(line.amountStr)
      if (!Number.isFinite(amt) || amt <= 0) continue
      if (t.invoiceId) allocations.push({ invoice_id: t.invoiceId, amount: amt })
      else allocations.push({ job_id: t.jobId, amount: amt })
    }
    if (allocations.length === 0) {
      setApplyError('Add at least one allocation with a target and amount.')
      setApplySubmitting(false)
      return
    }
    if (validationMessage) {
      setApplyError(validationMessage)
      setApplySubmitting(false)
      return
    }
    try {
      const data = await withSupabaseRetry(
        async () =>
          supabase.rpc('apply_mercury_bank_payment_allocations', {
            p_mercury_transaction_id: selected.mercury_transaction_id,
            p_paid_on: paidOnYmdFromMercury,
            p_payment_type: kindPaymentTypeLabel,
            p_note: internalNote.trim(),
            p_allocations: allocations,
            // Only claimed when a Stripe-hosted target is in play AND the user
            // checked the out-of-band confirmation (gated above).
            p_allow_stripe_hosted: stripeAllocationSelected,
          }),
        'apply_mercury_bank_payment_allocations',
      )
      const payload = data as { error?: string; ok?: boolean } | null
      if (payload && typeof payload === 'object' && typeof payload.error === 'string') {
        throw new Error(payload.error)
      }
      // v2.1639: allocation applied — now close exactly-covered Stripe-hosted
      // bills in Stripe so the emailed links die. Failures keep the modal open
      // on a retry panel (the allocation itself already stands).
      const candidates = stripeAllocationSelected
        ? arStripeAutoCloseCandidates(stripeAutoCloseLines, targetByKey)
        : []
      if (candidates.length === 0) {
        await onApplied()
        onClose()
        return
      }
      const results: Array<ArStripeAutoCloseCandidate & { ok: boolean; error?: string }> = []
      for (const c of candidates) {
        const res = await closeStripeInvoiceOob(c)
        results.push({ ...c, ok: res.ok, error: res.error })
      }
      await onApplied()
      if (results.every((r) => r.ok)) {
        onClose()
      } else {
        setStripeCloseResults(results)
      }
    } catch (e: unknown) {
      setApplyError(e instanceof Error ? e.message : 'Apply failed')
    } finally {
      setApplySubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 70,
        padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))',
        boxSizing: 'border-box',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="accounts-receivable-modal-title"
    >
      <div
        aria-busy={listBusy}
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          maxWidth: 980,
          width: '100%',
          maxHeight: 'min(90vh, 100%)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <h2 id="accounts-receivable-modal-title" style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>
            Accounts Receivable
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'none',
              background: 'var(--bg-muted)',
              borderRadius: 6,
              padding: '0.35rem 0.65rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Close
          </button>
        </div>

        <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Match Mercury deposits to <strong>Billed Awaiting Payment</strong> lines. Payments appear in Edit Job →
          Payments received. Stripe-hosted bills are marked <strong>· Stripe</strong> — pick one only when the customer
          paid outside Stripe (check, cash, ACH).
        </div>

        {authRole === 'dev' && (
          <div style={{ padding: '0.5rem 1.25rem', background: 'var(--bg-page)', borderBottom: '1px solid var(--border)' }}>
            <button
              type="button"
              onClick={() => setDevFilterOpen((v) => !v)}
              style={{
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: 'var(--text-link)',
                fontSize: '0.8125rem',
                fontWeight: 500,
                padding: '0.25rem 0',
              }}
            >
              {devFilterOpen ? '\u25BC' : '\u25B6'} Dev: Mercury filter (Banking Sorting)
            </button>
            {devFilterOpen && (
              <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-600)' }}>
                  Start date {sortingConfig.startDateYmd}; kinds {sortingConfig.kinds.length || 'all'}; accounts{' '}
                  {sortingConfig.accountIds.length || 'all'}; debit cards {sortingConfig.debitCardIds.length || 'any'}.
                </span>
                <button
                  type="button"
                  onClick={() => setSortingConfigModalOpen(true)}
                  style={{
                    padding: '0.35rem 0.65rem',
                    borderRadius: 4,
                    border: '1px solid var(--border-strong)',
                    background: 'var(--surface)',
                    cursor: 'pointer',
                    fontSize: '0.8125rem',
                  }}
                >
                  Edit sorting configuration…
                </button>
              </div>
            )}
          </div>
        )}

        {!canApply && (
          <div style={{ padding: '0.5rem 1.25rem', background: 'var(--bg-amber-tint)', fontSize: '0.8125rem', color: 'var(--text-amber-800)' }}>
            Your role cannot record job payments. Recording payments from this modal is limited to dev, master, assistant, and
            primary (same as Mark Paid).
          </div>
        )}

        <div style={{ position: 'relative', display: 'flex', flex: 1, flexDirection: 'column', minHeight: 0 }}>
          {listBusy ? (
            <div
              role="status"
              aria-live="polite"
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 2,
                background: 'rgba(255,255,255,0.94)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                padding: '1.25rem',
                gap: '1rem',
                boxSizing: 'border-box',
              }}
            >
              <p style={{ margin: 0, textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-700)', fontWeight: 600 }}>
                Loading bank transactions…
              </p>
              <div style={{ display: 'flex', flex: 1, minHeight: 200, gap: '1rem', alignItems: 'stretch' }}>
                <div style={{ flex: '0 0 42%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="dashboard-skeleton-pulse"
                      style={{ height: 44, borderRadius: 6, background: 'var(--bg-200)' }}
                    />
                  ))}
                </div>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div className="dashboard-skeleton-pulse" style={{ height: 72, borderRadius: 6, background: 'var(--bg-200)' }} />
                  <div className="dashboard-skeleton-pulse" style={{ height: 120, borderRadius: 6, background: 'var(--bg-200)' }} />
                  <div className="dashboard-skeleton-pulse" style={{ height: 88, borderRadius: 6, background: 'var(--bg-200)' }} />
                </div>
              </div>
            </div>
          ) : null}
          {sweepOpen ? (
            <div
              role="dialog"
              aria-label="Review exact deposit matches"
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 3,
                background: 'var(--surface)',
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
              }}
            >
              <div style={{ padding: '0.85rem 1.25rem 0.5rem', flexShrink: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>Exact deposit matches</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  Each deposit below matches exactly one open bill to the cent. Un-tick any pair you're not sure
                  about, then apply the rest in one pass. Ambiguous amounts are skipped, never guessed.
                </div>
              </div>
              <div style={{ flex: 1, overflow: 'auto', padding: '0 1.25rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                  <tbody>
                    {exactMatchSweep.pairs.map((p) => {
                      const d = candidateById.get(p.depositId)
                      const t = targetByKey.get(p.targetKey)
                      const result = sweepResults?.find((r) => r.depositId === p.depositId)
                      const posted = d?.posted_at
                        ? new Date(d.posted_at).toLocaleDateString('en-US', { timeZone: APP_CALENDAR_TZ })
                        : '—'
                      return (
                        <tr key={p.depositId} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.5rem 0.5rem 0.5rem 0', width: 24, verticalAlign: 'top' }}>
                            <input
                              type="checkbox"
                              checked={!sweepExcluded.has(p.depositId)}
                              disabled={sweepApplying}
                              onChange={(e) => {
                                const checked = e.target.checked
                                setSweepExcluded((prev) => {
                                  const next = new Set(prev)
                                  if (checked) next.delete(p.depositId)
                                  else next.add(p.depositId)
                                  return next
                                })
                              }}
                              aria-label={`Include ${formatMoney(p.amountCents / 100)} from ${d?.counterparty_name ?? '—'}`}
                            />
                          </td>
                          <td style={{ padding: '0.5rem 0.5rem 0.5rem 0', verticalAlign: 'top' }}>
                            <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {formatMoney(p.amountCents / 100)}
                            </strong>
                            <span style={{ color: 'var(--text-muted)' }}>
                              {' '}
                              · {(d?.counterparty_name ?? '').trim() || '—'} · {posted}
                            </span>
                          </td>
                          <td style={{ padding: '0.5rem 0', verticalAlign: 'top' }}>
                            <span style={{ color: 'var(--text-faint)' }}>→ </span>
                            {t ? bankPaymentTargetPrimaryLabel(t) : '—'}
                            {result ? (
                              <div
                                style={{
                                  fontSize: '0.75rem',
                                  color: result.ok ? 'var(--text-green-700)' : 'var(--text-red-700)',
                                  marginTop: 2,
                                }}
                              >
                                {result.ok ? '✓ applied' : `✗ ${result.error ?? 'failed'}`}
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {exactMatchSweep.skipped.length > 0 ? (
                  <div style={{ margin: '0.6rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Skipped as ambiguous:{' '}
                    {exactMatchSweep.skipped
                      .map(
                        (s) =>
                          `$${formatMoney(s.amountCents / 100)} (${s.depositCount} deposit${s.depositCount === 1 ? '' : 's'} / ${s.targetCount} bill${s.targetCount === 1 ? '' : 's'})`,
                      )
                      .join(' · ')}{' '}
                    — pick those by hand.
                  </div>
                ) : null}
              </div>
              <div
                style={{
                  padding: '0.75rem 1.25rem',
                  borderTop: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  gap: '0.5rem',
                  flexShrink: 0,
                }}
              >
                {sweepApplying ? (
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginRight: 'auto' }}>
                    Applying {sweepProgress} of {sweepPairsPending.length}…
                  </span>
                ) : null}
                <button
                  type="button"
                  disabled={sweepApplying}
                  onClick={() => {
                    setSweepOpen(false)
                    setSweepResults(null)
                  }}
                  style={{
                    padding: '0.45rem 0.9rem',
                    borderRadius: 4,
                    border: '1px solid var(--border-strong)',
                    background: 'var(--surface)',
                    cursor: sweepApplying ? 'not-allowed' : 'pointer',
                  }}
                >
                  {sweepResults?.some((r) => !r.ok) ? 'Close' : 'Cancel'}
                </button>
                <button
                  type="button"
                  disabled={sweepApplying || sweepPairsPending.length === 0}
                  onClick={() => void applyExactMatchSweep()}
                  style={{
                    padding: '0.45rem 0.9rem',
                    borderRadius: 4,
                    border: 'none',
                    background: sweepApplying ? '#9ca3af' : '#2563eb',
                    color: 'white',
                    cursor: sweepApplying ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                  }}
                >
                  {sweepResults?.some((r) => !r.ok) ? 'Retry failed' : 'Apply'} {sweepPairsPending.length} deposit
                  {sweepPairsPending.length === 1 ? '' : 's'}
                </button>
              </div>
            </div>
          ) : null}
          <div
            style={{
              display: 'flex',
              flex: 1,
              minHeight: 0,
              opacity: listBusy ? 0.35 : 1,
              pointerEvents: listBusy ? 'none' : 'auto',
            }}
            aria-hidden={listBusy}
          >
          <div
            style={{
              width: '42%',
              minWidth: 260,
              borderRight: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.5rem',
                padding: '0.5rem 0.75rem 0.35rem',
              }}
            >
              <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-700)' }}>Bank transactions</span>
              {canApply ? (
                <button
                  type="button"
                  onClick={() => setArBankReturnedMarkMode((v) => !v)}
                  aria-pressed={arBankReturnedMarkMode}
                  aria-label={arBankReturnedMarkMode ? 'Exit mark returned mode' : 'Mark deposits as returned'}
                  style={{
                    border: '1px solid var(--border-strong)',
                    background: arBankReturnedMarkMode ? 'var(--bg-blue-tint)' : 'var(--surface)',
                    borderRadius: 4,
                    padding: '2px 8px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--text-700)',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  Mark
                </button>
              ) : null}
            </div>
            <div style={{ padding: '0 0.5rem 0.5rem', flexShrink: 0 }}>
              <input
                id="ar-bank-tx-search"
                type="search"
                autoComplete="off"
                aria-label="Search bank transactions by counterparty, note, memo, or amount"
                placeholder="Search counterparty, note, memo, amount…"
                value={bankTxSearchQuery}
                onChange={(e) => setBankTxSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '0.4rem 0.5rem',
                  fontSize: '0.8125rem',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                }}
              />
            </div>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0 0.5rem 0.5rem',
                fontSize: '0.75rem',
                color: 'var(--text-600)',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={includeHiddenArDeposits}
                onChange={(e) => setIncludeHiddenArDeposits(e.target.checked)}
                aria-label="Show fully applied and returned deposits"
              />
              Show fully applied and returned deposits
            </label>
            {canApply && exactMatchSweep.pairs.length > 0 ? (
              <div
                style={{
                  margin: '0 0.5rem 0.5rem',
                  padding: '0.45rem 0.6rem',
                  border: '1px solid var(--border-green)',
                  background: 'var(--bg-green-tint)',
                  borderRadius: 6,
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ color: 'var(--text-700)' }}>
                  <strong>{exactMatchSweep.pairs.length}</strong>
                  {exactMatchSweep.pairs.length === 1 ? ' deposit matches' : ' deposits each match'} exactly one open
                  bill — <strong>${formatMoney(exactMatchSweep.totalCents / 100)}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSweepOpen(true)
                    setSweepResults(null)
                  }}
                  style={{
                    padding: '0.3rem 0.6rem',
                    borderRadius: 4,
                    border: 'none',
                    background: '#2563eb',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  Review &amp; apply…
                </button>
              </div>
            ) : null}
            <div style={{ flex: 1, overflow: 'auto' }}>
              {listError && (
                <p style={{ padding: '1rem', fontSize: '0.875rem', color: 'var(--text-red-700)' }}>{listError}</p>
              )}
              {!listBusy && !listError && candidates.length === 0 && (
                <p style={{ padding: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>No matching transactions.</p>
              )}
              {!listBusy && !listError && candidates.length > 0 && filteredCandidates.length === 0 && (
                <p style={{ padding: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  No bank transactions match this search.
                </p>
              )}
              {filteredCandidates.map((c) => {
                const active = c.mercury_transaction_id === selectedId
                const posted = c.posted_at
                  ? new Date(c.posted_at).toLocaleDateString('en-US', { timeZone: APP_CALENDAR_TZ })
                  : '—'
                return (
                  <button
                    key={c.mercury_transaction_id}
                    type="button"
                    onClick={() => setSelectedId(c.mercury_transaction_id)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'stretch',
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.6rem 0.75rem',
                      border: 'none',
                      borderBottom: '1px solid var(--border)',
                      background: active ? 'var(--bg-blue-tint)' : 'var(--surface)',
                      cursor: 'pointer',
                      fontSize: '0.8125rem',
                      boxSizing: 'border-box',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.5rem',
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 600,
                          color: 'var(--text-strong)',
                          minWidth: 0,
                          flex: '1 1 auto',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {formatMoney(Math.abs(Number(c.amount)))}
                      </div>
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          flexShrink: 0,
                        }}
                      >
                        {c.returned ? (
                          <span
                            style={{
                              color: 'var(--text-red-700)',
                              fontWeight: 600,
                              fontSize: '0.72rem',
                              flexShrink: 0,
                            }}
                          >
                            Returned
                          </span>
                        ) : null}
                        <KindBadgePill kind={c.kind} kindBadges={kindBadges} />
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>{posted}</span>
                        {canApply && arBankReturnedMarkMode ? (
                          <label
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              marginLeft: 4,
                              fontSize: '0.7rem',
                              color: 'var(--text-600)',
                              cursor: returnedToggleSavingId === c.mercury_transaction_id ? 'wait' : 'pointer',
                            }}
                            onClick={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(c.returned)}
                              disabled={returnedToggleSavingId === c.mercury_transaction_id}
                              onChange={(e) => {
                                e.stopPropagation()
                                void toggleMercuryReturned(c.mercury_transaction_id, e.target.checked)
                              }}
                              aria-label={`Returned: ${c.counterparty_name?.trim() || formatMoney(Math.abs(Number(c.amount)))}`}
                            />
                            Returned
                          </label>
                        ) : null}
                      </div>
                    </div>
                    <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>{c.counterparty_name?.trim() || '—'}</div>
                    <div style={{ color: 'var(--text-faint)', marginTop: 2, fontSize: '0.75rem' }}>
                      rem. {formatMoney(Number(c.remaining_available))}
                    </div>
                    {Number(c.consumed) > AR_BANK_PAYMENT_CONSUMED_DISPLAY_EPS ? (
                      <div style={{ color: 'var(--text-muted)', marginTop: 2, fontSize: '0.75rem' }}>
                        <strong>Applied to jobs:</strong> {formatMoney(Number(c.consumed))}
                      </div>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
            <div style={{ flex: 1, overflow: 'auto', padding: '1rem 1.25rem' }}>
              {!selected ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Select a bank transaction.</p>
              ) : (
                <>
                  <div style={BANK_PAYMENTS_SUMMARY_CARD_STYLE}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem' }}>
                      <strong>Amount:</strong> {formatMoney(Math.abs(Number(selected.amount)))} ·{' '}
                      <strong>Remaining to allocate:</strong> {formatMoney(Number(selected.remaining_available))}
                      {selected.returned ? (
                        <>
                          {' '}
                          <span
                            style={{
                              color: 'var(--text-red-700)',
                              fontWeight: 600,
                              fontSize: '0.75rem',
                            }}
                          >
                            Returned
                          </span>
                        </>
                      ) : null}
                    </div>
                    {selected.note?.trim() ? (
                      <div style={{ marginTop: 6 }}>
                        <strong>Note:</strong> {selected.note}
                      </div>
                    ) : null}
                    {selected.external_memo?.trim() ? (
                      <div style={{ marginTop: 6 }}>
                        <strong>Memo:</strong> {selected.external_memo}
                      </div>
                    ) : null}
                  </div>

                  {Number(selected.consumed) > AR_BANK_PAYMENT_CONSUMED_DISPLAY_EPS ? (
                    <div style={BANK_PAYMENTS_SUMMARY_CARD_STYLE}>
                      <div>
                        <strong>Applied to jobs:</strong> {formatMoney(Number(selected.consumed))}
                      </div>
                      {arAllocationsLoading ? (
                        <div style={{ marginTop: 10 }}>
                          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 6 }}>Loading breakdown…</div>
                          <div
                            className="dashboard-skeleton-pulse"
                            style={{ height: 14, borderRadius: 4, background: 'var(--bg-200)', maxWidth: '85%' }}
                          />
                          <div
                            className="dashboard-skeleton-pulse"
                            style={{ height: 14, borderRadius: 4, background: 'var(--bg-200)', maxWidth: '65%', marginTop: 6 }}
                          />
                        </div>
                      ) : arAllocationsError ? (
                        <div style={{ marginTop: 8, fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>
                          {arAllocationsError}
                        </div>
                      ) : arAllocations.length > 0 ? (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.8125rem', marginBottom: 4 }}>
                            Applied breakdown
                          </div>
                          <ul
                            style={{
                              margin: 0,
                              paddingLeft: '1.1rem',
                              fontSize: '0.8125rem',
                              color: 'var(--text-700)',
                            }}
                          >
                            {arAllocations.map((row) => {
                              const hcp = (row.hcp_number ?? '').trim() || '—'
                              const jn = (row.job_name ?? '').trim() || '—'
                              const inv =
                                row.invoice_sequence_order != null
                                  ? ` · Invoice #${row.invoice_sequence_order}`
                                  : ''
                              const paidRaw = row.paid_on?.trim() ?? ''
                              const paid =
                                paidRaw && /^\d{4}-\d{2}-\d{2}$/.test(paidRaw)
                                  ? formatWorkDateYmdFriendly(paidRaw)
                                  : paidRaw || null
                              const jobLinkEnabled = Boolean(
                                onOpenEditJob && (row.job_id ?? '').trim() !== '',
                              )
                              return (
                                <li key={row.payment_id} style={{ marginBottom: 4 }}>
                                  <strong>{formatMoney(Number(row.amount))}</strong>
                                  {' · '}
                                  {jobLinkEnabled ? (
                                    <button
                                      type="button"
                                      onClick={() => onOpenEditJob?.(row.job_id)}
                                      aria-label={`Edit job ${hcp} ${jn}`}
                                      style={{
                                        display: 'inline',
                                        margin: 0,
                                        padding: 0,
                                        border: 'none',
                                        background: 'none',
                                        font: 'inherit',
                                        color: 'var(--text-link)',
                                        cursor: 'pointer',
                                        textDecoration: 'underline',
                                        textUnderlineOffset: 2,
                                      }}
                                    >
                                      {hcp} · {jn}
                                    </button>
                                  ) : (
                                    <span>
                                      {hcp} · {jn}
                                    </span>
                                  )}
                                  {inv}
                                  {paid ? (
                                    <span style={{ color: 'var(--text-muted)' }}>{` · ${paid}`}</span>
                                  ) : null}
                                  {row.note?.trim() ? (
                                    <div
                                      style={{
                                        color: 'var(--text-muted)',
                                        fontSize: '0.75rem',
                                        marginTop: 2,
                                      }}
                                    >
                                      {row.note.trim()}
                                    </div>
                                  ) : null}
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: 'var(--text-700)' }}>
                    <strong>Posted:</strong>{' '}
                    {paidOnYmdFromMercury ? (
                      <span>{formatWorkDateYmdFriendly(paidOnYmdFromMercury)}</span>
                    ) : (
                      <span style={{ color: 'var(--text-faint)' }}>—</span>
                    )}
                  </div>

                  <div
                    style={{
                      marginBottom: '0.75rem',
                      fontSize: '0.875rem',
                      color: 'var(--text-700)',
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: '0.35rem',
                    }}
                  >
                    <strong>Kind:</strong> <KindBadgePill kind={selected.kind} kindBadges={kindBadges} />
                  </div>

                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.25rem' }}>
                    Memo (optional)
                  </label>
                  <textarea
                    value={internalNote}
                    onChange={(e) => setInternalNote(e.target.value)}
                    disabled={!canApply}
                    rows={2}
                    style={{
                      width: '100%',
                      padding: '0.35rem',
                      marginBottom: '1rem',
                      boxSizing: 'border-box',
                      resize: 'vertical',
                    }}
                  />

                  {canAllocateRemaining ? (
                    <>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.5rem' }}>Allocations</div>
                      {targets.length === 0 && recordedPayments.length === 0 ? (
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                          {billedTargetsLoading
                            ? 'Loading billed job lines…'
                            : 'No eligible billed lines with balance.'}
                        </p>
                      ) : (
                        <>
                          {allocLines.map((line) => {
                        const picked =
                          line.kind === 'billed' && line.targetKey ? targetByKey.get(line.targetKey) : undefined
                        const detailLead = picked ? bankPaymentTargetDetailLead(picked) : ''
                        const pickedPayment =
                          line.kind === 'payment' && line.targetKey
                            ? recordedPaymentById.get(line.targetKey)
                            : undefined
                        const takenPaymentIds = new Set(
                          allocLines
                            .filter((r) => r.id !== line.id && r.kind === 'payment' && r.targetKey.trim())
                            .map((r) => r.targetKey),
                        )
                        const kindToggleSegStyle = (active: boolean): CSSProperties => ({
                          padding: '0.25rem 0.6rem',
                          fontSize: '0.75rem',
                          border: 'none',
                          background: active ? 'var(--bg-blue-tint)' : 'transparent',
                          color: active ? 'var(--text-link)' : 'var(--text-muted)',
                          cursor: canApply ? 'pointer' : 'not-allowed',
                          fontWeight: active ? 600 : 400,
                        })
                        return (
                          <div
                            key={line.id}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '0.5rem',
                              marginBottom: '0.75rem',
                            }}
                          >
                            <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                              {recordedPayments.length > 0 ? (
                                <div
                                  role="group"
                                  aria-label="Allocation target type"
                                  style={{
                                    display: 'inline-flex',
                                    border: '1px solid var(--border-strong)',
                                    borderRadius: 999,
                                    overflow: 'hidden',
                                    marginBottom: 6,
                                  }}
                                >
                                  <button
                                    type="button"
                                    disabled={!canApply}
                                    aria-pressed={line.kind === 'billed'}
                                    onClick={() => setAllocLineKind(line.id, 'billed')}
                                    style={kindToggleSegStyle(line.kind === 'billed')}
                                  >
                                    Billed line
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!canApply}
                                    aria-pressed={line.kind === 'payment'}
                                    onClick={() => setAllocLineKind(line.id, 'payment')}
                                    title="Link this deposit to a payment already recorded on the job (Edit Job → Payments received) — no new payment is created"
                                    style={kindToggleSegStyle(line.kind === 'payment')}
                                  >
                                    Payment received
                                  </button>
                                </div>
                              ) : null}
                              {line.kind === 'payment' ? (
                                <SearchableSelect
                                  id={`ar-alloc-target-${line.id}`}
                                  value={line.targetKey}
                                  onChange={(v) => applyRecordedPaymentTarget(line.id, v)}
                                  options={arRecordedPaymentOptions(recordedPayments, takenPaymentIds)}
                                  emptyOption={{ value: '', label: '— Select recorded payment —' }}
                                  hideEmptyOptionInListWhenUnset
                                  disabled={!canApply}
                                  placeholder="— Select recorded payment —"
                                  listAriaLabel="Recorded payment to link"
                                  portalZIndex={1200}
                                />
                              ) : (
                              <SearchableSelect
                                id={`ar-alloc-target-${line.id}`}
                                value={line.targetKey}
                                onChange={(v) => applyAllocationTarget(line.id, v)}
                                options={targetSelectOptions}
                                emptyOption={{ value: '', label: '— Select billed line —' }}
                                hideEmptyOptionInListWhenUnset
                                disabled={!canApply}
                                placeholder="— Select billed line —"
                                listAriaLabel="Billed line for allocation"
                                portalZIndex={1200}
                              />
                              )}
                              {pickedPayment ? (
                                <div
                                  style={{
                                    marginTop: 6,
                                    fontSize: '0.75rem',
                                    color: 'var(--text-600)',
                                    lineHeight: 1.4,
                                  }}
                                >
                                  <div style={{ fontWeight: 600 }}>{arRecordedPaymentSearchLabel(pickedPayment)}</div>
                                  <div style={{ color: 'var(--text-muted)' }}>
                                    Links the deposit to this recorded payment — amount locked, no new payment created.
                                  </div>
                                </div>
                              ) : null}
                              {line.kind === 'billed' &&
                              allocLines[0]?.id === line.id &&
                              !line.targetKey.trim() &&
                              depositPayerTargets.length > 0 &&
                              depositPayerMatch ? (
                                <div style={{ marginTop: 8 }}>
                                  <div
                                    style={{
                                      fontSize: '0.75rem',
                                      color: 'var(--text-muted)',
                                      marginBottom: 6,
                                      fontWeight: 500,
                                    }}
                                  >
                                    {depositPayerMatch.source === 'counterparty' ? (
                                      <>
                                        From{' '}
                                        <strong style={{ color: 'var(--text-700)' }}>{depositPayerMatch.name}</strong>
                                        {' — their open bills'}
                                      </>
                                    ) : (
                                      <>
                                        {depositPayerMatch.source === 'note' ? 'Note mentions ' : 'Memo mentions '}
                                        <strong style={{ color: 'var(--text-700)' }}>{depositPayerMatch.name}</strong>
                                        {' — their open bills'}
                                      </>
                                    )}
                                  </div>
                                  <div
                                    style={{
                                      display: 'flex',
                                      flexWrap: 'wrap',
                                      gap: '0.35rem',
                                      alignItems: 'stretch',
                                    }}
                                  >
                                    {payerBillCombo && allocLines.length === 1 ? (
                                      <button
                                        type="button"
                                        disabled={!canApply}
                                        onClick={() => applyComboAllocation(payerBillCombo)}
                                        aria-label={`Fill ${payerBillCombo.length} allocations: ${payerBillCombo
                                          .map((t) => `${formatBankPaymentTargetDollars(t.remaining)} ${t.hcpNumber}`)
                                          .join(' + ')}`}
                                        style={{
                                          display: 'inline-flex',
                                          flexDirection: 'column',
                                          alignItems: 'flex-start',
                                          gap: 1,
                                          padding: '0.3rem 0.55rem',
                                          fontSize: '0.75rem',
                                          border: '1px dashed var(--border-green)',
                                          borderRadius: 4,
                                          background: 'var(--bg-green-tint)',
                                          color: 'var(--text-700)',
                                          cursor: !canApply ? 'not-allowed' : 'pointer',
                                          textAlign: 'left',
                                          maxWidth: '100%',
                                          lineHeight: 1.35,
                                        }}
                                      >
                                        <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                                          {payerBillCombo.length} bills ={' '}
                                          {formatBankPaymentTargetDollars(Number(selected.remaining_available))}
                                        </span>
                                        <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                                          {payerBillCombo
                                            .map((t) => `${formatBankPaymentTargetDollars(t.remaining)} · ${t.hcpNumber || '—'}`)
                                            .join('  +  ')}
                                        </span>
                                        <span style={{ fontSize: '0.66rem', color: 'var(--text-green-700)' }}>
                                          fills {payerBillCombo.length} allocation lines
                                        </span>
                                      </button>
                                    ) : null}
                                    {depositPayerTargets.map((t) => {
                                      const isAmountMatch = depositAmountMatchKeys.has(t.key)
                                      const chipLabel = `${formatBankPaymentTargetDollars(t.remaining)} · ${bankPaymentTargetPrimaryLabel(t)}`
                                      return (
                                        <button
                                          key={t.key}
                                          type="button"
                                          disabled={!canApply}
                                          onClick={() => applyAllocationTarget(line.id, t.key)}
                                          aria-label={`Apply allocation: ${chipLabel}`}
                                          style={{
                                            display: 'inline-flex',
                                            flexDirection: 'column',
                                            alignItems: 'flex-start',
                                            gap: 1,
                                            padding: '0.3rem 0.55rem',
                                            fontSize: '0.75rem',
                                            border: isAmountMatch
                                              ? '1px solid var(--border-green)'
                                              : '1px solid var(--border-strong)',
                                            borderRadius: 4,
                                            background: isAmountMatch ? 'var(--bg-green-tint)' : 'var(--surface)',
                                            color: 'var(--text-700)',
                                            cursor: !canApply ? 'not-allowed' : 'pointer',
                                            textAlign: 'left',
                                            maxWidth: '100%',
                                            lineHeight: 1.35,
                                          }}
                                        >
                                          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{chipLabel}</span>
                                          {isAmountMatch ? (
                                            <span style={{ fontSize: '0.66rem', color: 'var(--text-green-700)' }}>
                                              matches this deposit
                                            </span>
                                          ) : null}
                                        </button>
                                      )
                                    })}
                                  </div>
                                </div>
                              ) : null}
                              {line.kind === 'billed' &&
                              allocLines[0]?.id === line.id &&
                              quickMatchTargetsOutsidePayer.length > 0 &&
                              !line.targetKey.trim() ? (
                                <div style={{ marginTop: 8 }}>
                                  <div
                                    style={{
                                      fontSize: '0.75rem',
                                      color: 'var(--text-muted)',
                                      marginBottom: 6,
                                      fontWeight: 500,
                                    }}
                                  >
                                    Matches deposit amount
                                  </div>
                                  <div
                                    style={{
                                      display: 'flex',
                                      flexWrap: 'wrap',
                                      gap: '0.35rem',
                                      alignItems: 'center',
                                    }}
                                  >
                                    {quickMatchTargetsOutsidePayer.map((t) => {
                                      const chipLabel = `${bankPaymentTargetPrimaryLabel(t)} · ${formatBankPaymentTargetDollars(t.remaining)}`
                                      return (
                                        <button
                                          key={t.key}
                                          type="button"
                                          disabled={!canApply}
                                          onClick={() => applyAllocationTarget(line.id, t.key)}
                                          aria-label={`Apply allocation: ${chipLabel}`}
                                          style={{
                                            padding: '0.3rem 0.5rem',
                                            fontSize: '0.75rem',
                                            border: '1px solid var(--border-strong)',
                                            borderRadius: 4,
                                            background: 'var(--surface)',
                                            color: 'var(--text-700)',
                                            cursor: !canApply ? 'not-allowed' : 'pointer',
                                            textAlign: 'left',
                                            maxWidth: '100%',
                                          }}
                                        >
                                          {chipLabel}
                                        </button>
                                      )
                                    })}
                                  </div>
                                </div>
                              ) : null}
                              {picked ? (
                                <div
                                  style={{
                                    marginTop: 6,
                                    fontSize: '0.75rem',
                                    color: 'var(--text-600)',
                                    lineHeight: 1.4,
                                  }}
                                >
                                  <div style={{ fontWeight: 600 }}>{bankPaymentTargetPrimaryLabel(picked)}</div>
                                  <div style={{ color: 'var(--text-muted)' }}>
                                    {detailLead ? (
                                      <>
                                        {detailLead}
                                        {' · '}
                                      </>
                                    ) : null}
                                    <strong style={{ fontWeight: 600, color: 'var(--text-700)' }}>
                                      {formatBankPaymentTargetDollars(picked.remaining)}
                                    </strong>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="Amount"
                              aria-label="Allocation amount"
                              value={line.amountStr}
                              onChange={(e) => {
                                const v = e.target.value
                                setAllocLines((rows) =>
                                  rows.map((r) => (r.id === line.id ? { ...r, amountStr: v } : r)),
                                )
                              }}
                              title={line.kind === 'payment' ? 'Amount is locked to the recorded payment' : undefined}
                              disabled={!canApply || line.kind === 'payment'}
                              style={{
                                flexShrink: 0,
                                alignSelf: 'flex-start',
                                padding: '0.35rem',
                                width: '7.5rem',
                                boxSizing: 'border-box',
                                marginTop: 2,
                              }}
                            />
                            {allocLines.length > 1 ? (
                              <button
                                type="button"
                                disabled={!canApply}
                                onClick={() => setAllocLines((rows) => rows.filter((r) => r.id !== line.id))}
                                aria-label="Remove allocation"
                                title="Remove allocation"
                                style={{
                                  flexShrink: 0,
                                  alignSelf: 'flex-start',
                                  marginTop: 2,
                                  padding: '0.25rem',
                                  border: 'none',
                                  background: 'none',
                                  color: 'var(--text-red-700)',
                                  cursor: !canApply ? 'not-allowed' : 'pointer',
                                  lineHeight: 0,
                                }}
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 640 640"
                                  width={18}
                                  height={18}
                                  aria-hidden
                                >
                                  <path
                                    fill="currentColor"
                                    d="M232.7 69.9L224 96L128 96C110.3 96 96 110.3 96 128C96 145.7 110.3 160 128 160L512 160C529.7 160 544 145.7 544 128C544 110.3 529.7 96 512 96L416 96L407.3 69.9C402.9 56.8 390.7 48 376.9 48L263.1 48C249.3 48 237.1 56.8 232.7 69.9zM512 208L128 208L149.1 531.1C150.7 556.4 171.7 576 197 576L443 576C468.3 576 489.3 556.4 490.9 531.1L512 208z"
                                  />
                                </svg>
                              </button>
                            ) : null}
                          </div>
                        )
                      })}
                      {canApply ? (
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            gap: '0.5rem',
                            marginTop: '0.15rem',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setAllocLines((rows) => [
                                ...rows,
                                { id: crypto.randomUUID(), kind: 'billed', targetKey: '', amountStr: '' },
                              ])
                            }
                            style={{
                              padding: '0.35rem 0.65rem',
                              fontSize: '0.8125rem',
                              border: '1px solid var(--border-strong)',
                              borderRadius: 4,
                              background: 'var(--surface)',
                              cursor: 'pointer',
                            }}
                          >
                            Add Additional Allocation
                          </button>
                        </div>
                      ) : null}
                        </>
                      )}
                    </>
                  ) : (
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 0 }}>
                      No remaining balance to allocate on this deposit.
                    </p>
                  )}

                  {stripeAllocationSelected ? (
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.5rem',
                        marginTop: '0.75rem',
                        padding: '0.6rem 0.75rem',
                        border: '1px solid #f59e0b',
                        borderRadius: 6,
                        background: 'var(--bg-amber-tint)',
                        fontSize: '0.8125rem',
                        color: 'var(--text-amber-800)',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={stripeOutOfBandConfirmed}
                        onChange={(e) => setStripeOutOfBandConfirmed(e.target.checked)}
                        style={{ marginTop: 2, flexShrink: 0 }}
                      />
                      <span>
                        {stripeAutoCloseAll ? (
                          <>
                            <strong>This bill was sent through Stripe.</strong> The customer paid outside Stripe
                            (check, cash, ACH). The amount matches the full balance, so applying will also mark the
                            Stripe invoice paid — the emailed link can’t be paid a second time.
                          </>
                        ) : (
                          <>
                            <strong>This bill was sent through Stripe.</strong> The customer paid outside Stripe
                            (check, cash, ACH) — after applying, void the invoice or mark it paid out-of-band in
                            Stripe so the emailed link can’t be paid a second time.
                          </>
                        )}
                      </span>
                    </label>
                  ) : null}
                  {stripeCloseResults ? (
                    <div
                      style={{
                        marginTop: '0.75rem',
                        padding: '0.75rem',
                        border: '1px solid #f59e0b',
                        borderRadius: 6,
                        background: 'var(--bg-amber-tint)',
                        fontSize: '0.8125rem',
                      }}
                    >
                      <p style={{ margin: '0 0 0.5rem', fontWeight: 600, color: 'var(--text-amber-800)' }}>
                        Allocation applied — but a Stripe invoice could not be closed.
                      </p>
                      {stripeCloseResults.map((r) => (
                        <p key={r.invoiceId} style={{ margin: '0 0 0.35rem', color: r.ok ? 'var(--text-green-700)' : 'var(--text-red-700)' }}>
                          {r.ok ? '✓' : '✗'} {r.label} — {r.ok ? 'Stripe invoice marked paid; link closed.' : r.error ?? 'failed'}
                        </p>
                      ))}
                      <p style={{ margin: '0.25rem 0 0.5rem', color: 'var(--text-amber-800)' }}>
                        The payment is recorded in the app. Retry, or mark the invoice paid out-of-band in Stripe
                        yourself so the emailed link can’t be paid again.
                      </p>
                      <button
                        type="button"
                        onClick={() => void retryFailedStripeCloses()}
                        disabled={stripeCloseRetrying}
                        style={{
                          padding: '0.35rem 0.9rem',
                          borderRadius: 4,
                          border: 'none',
                          background: stripeCloseRetrying ? '#9ca3af' : '#3b82f6',
                          color: 'white',
                          cursor: stripeCloseRetrying ? 'not-allowed' : 'pointer',
                          fontSize: '0.8125rem',
                        }}
                      >
                        {stripeCloseRetrying ? 'Retrying…' : 'Retry Stripe close'}
                      </button>
                    </div>
                  ) : null}
                  {validationMessage && (
                    <p style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: 'var(--text-amber-700)' }}>{validationMessage}</p>
                  )}
                  {applyError && (
                    <p style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>{applyError}</p>
                  )}
                </>
              )}
            </div>

            <div
              style={{
                padding: '0.75rem 1.25rem',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '0.5rem',
              }}
            >
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '0.45rem 0.9rem',
                  borderRadius: 4,
                  border: '1px solid var(--border-strong)',
                  background: 'var(--surface)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={applyDisabled}
                onClick={() => void submitApply()}
                style={{
                  padding: '0.45rem 0.9rem',
                  borderRadius: 4,
                  border: 'none',
                  background: applyDisabled ? '#d1d5db' : '#2563eb',
                  color: 'white',
                  cursor: applyDisabled ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                }}
              >
                {applySubmitting ? 'Applying…' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>

      <BankingSortingConfigModal
        open={sortingConfigModalOpen}
        onClose={() => setSortingConfigModalOpen(false)}
        initialConfig={sortingConfig}
        kindChoices={kindChoices}
        accountChoices={accountChoices}
        nicknameByAccount={nicknameByAccount}
        debitCardChoices={debitCardChoices}
        nicknameByDebitCard={nicknameByDebitCard}
        dialogAriaSuffix="bank-payments"
        title="Accounts Receivable Sorting"
        contextNote="This filter is org-wide (saved in app settings by a dev). It applies only to Jobs → Stages → Accounts Receivable and does not change Banking or Quickfill sorting filters."
        enableKindBadgeEditor={authRole === 'dev'}
        enableTextExclusionEditor
        kindBadges={kindBadges}
        onSaveKindBadges={
          authRole === 'dev'
            ? async (badges) => {
                await upsertBankPaymentsKindBadgesToAppSettings(badges)
                saveBankPaymentsKindBadgesLocalCache(badges)
                setKindBadges(badges)
              }
            : undefined
        }
        onSave={async (cfg) => {
          await upsertBankPaymentsSortingConfigToAppSettings(cfg)
          saveBankPaymentsSortingConfigToLocalCache(cfg)
          setSortingConfig(cfg)
          void refreshList()
        }}
      />
    </div>
  )
}
