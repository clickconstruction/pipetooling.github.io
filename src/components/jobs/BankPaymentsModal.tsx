import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
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

type AllocLine = { id: string; targetKey: string; amountStr: string }

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

  const refreshList = useCallback(async () => {
    if (!open) return
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
      const rows = (data ?? []) as MercuryCandidate[]
      setCandidates(rows)
      setSelectedId((prev) => {
        if (prev && rows.some((r) => r.mercury_transaction_id === prev)) return prev
        const first = rows[0]
        return first?.mercury_transaction_id ?? null
      })
    } catch (e: unknown) {
      setListError(e instanceof Error ? e.message : 'Failed to load bank transactions')
      setCandidates([])
    } finally {
      setListLoading(false)
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
      const { config, rowExists } = await fetchBankPaymentsSortingConfigFromAppSettings()
      if (cancelled) return
      if (rowExists) {
        setSortingConfig((prev) => (bankSortingConfigsFilterEqual(prev, config) ? prev : config))
        saveBankPaymentsSortingConfigToLocalCache(config)
        return
      }
      const local = loadBankPaymentsSortingConfig(authUserId)
      setSortingConfig((prev) => (bankSortingConfigsFilterEqual(prev, local) ? prev : local))
      saveBankPaymentsSortingConfigToLocalCache(local)
      if (authRole === 'dev') {
        try {
          await upsertBankPaymentsSortingConfigToAppSettings(local)
          saveBankPaymentsSortingConfigToLocalCache(local)
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
    if (!open) return
    void refreshList()
  }, [open, refreshList])

  useEffect(() => {
    if (open) return
    setArBankReturnedMarkMode(false)
  }, [open])

  useEffect(() => {
    if (!open || !selectedId) return
    setAllocLines([{ id: crypto.randomUUID(), targetKey: '', amountStr: '' }])
    setApplyError(null)
  }, [open, selectedId])

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

  const stripeSkippedCount = useMemo(() => {
    let n = 0
    for (const r of billedRows) {
      if (r.kind === 'invoice' || r.kind === 'job_with_merged_billed') {
        if (String(r.inv.stripe_invoice_id ?? '').trim() !== '') n += 1
      }
    }
    return n
  }, [billedRows])

  const validationMessage = useMemo(() => {
    if (!selected) return null
    const cap = selected.remaining_available
    let sum = 0
    for (const line of allocLines) {
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
  }, [selected, allocLines, targetByKey])

  const applyDisabled =
    !canApply ||
    !selected ||
    applySubmitting ||
    !!validationMessage ||
    targets.length === 0 ||
    !paidOnYmdFromMercury ||
    !canAllocateRemaining

  async function submitApply() {
    if (!selected || !canApply || !canAllocateRemaining) return
    if (!paidOnYmdFromMercury) {
      setApplyError('Missing Mercury posted date for this transaction.')
      return
    }
    setApplySubmitting(true)
    setApplyError(null)
    const allocations: Array<{ invoice_id?: string; job_id?: string; amount: number }> = []
    for (const line of allocLines) {
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
          }),
        'apply_mercury_bank_payment_allocations',
      )
      const payload = data as { error?: string; ok?: boolean } | null
      if (payload && typeof payload === 'object' && typeof payload.error === 'string') {
        throw new Error(payload.error)
      }
      await onApplied()
      onClose()
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
        padding: '1rem',
        boxSizing: 'border-box',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="accounts-receivable-modal-title"
    >
      <div
        aria-busy={listLoading}
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          maxWidth: 980,
          width: '100%',
          maxHeight: '90vh',
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
          Match Mercury deposits to <strong>Billed Awaiting Payment</strong> lines (non-Stripe). Payments appear in Edit Job →
          Payments received.
          {stripeSkippedCount > 0 ? (
            <span>
              {' '}
              ({stripeSkippedCount} Stripe-hosted {stripeSkippedCount === 1 ? 'line' : 'lines'} excluded.)
            </span>
          ) : null}
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
          {listLoading ? (
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
          <div
            style={{
              display: 'flex',
              flex: 1,
              minHeight: 0,
              opacity: listLoading ? 0.35 : 1,
              pointerEvents: listLoading ? 'none' : 'auto',
            }}
            aria-hidden={listLoading}
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
            <div style={{ flex: 1, overflow: 'auto' }}>
              {listError && (
                <p style={{ padding: '1rem', fontSize: '0.875rem', color: 'var(--text-red-700)' }}>{listError}</p>
              )}
              {!listLoading && !listError && candidates.length === 0 && (
                <p style={{ padding: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>No matching transactions.</p>
              )}
              {!listLoading && !listError && candidates.length > 0 && filteredCandidates.length === 0 && (
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
                      {targets.length === 0 ? (
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                          {billedTargetsLoading
                            ? 'Loading billed job lines…'
                            : 'No eligible billed lines (non-Stripe with balance).'}
                        </p>
                      ) : (
                        <>
                          {allocLines.map((line) => {
                        const picked = line.targetKey ? targetByKey.get(line.targetKey) : undefined
                        const detailLead = picked ? bankPaymentTargetDetailLead(picked) : ''
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
                              {allocLines[0]?.id === line.id &&
                              bankPaymentQuickMatchTargets.length > 0 &&
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
                                    {bankPaymentQuickMatchTargets.map((t) => {
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
                              disabled={!canApply}
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
                                { id: crypto.randomUUID(), targetKey: '', amountStr: '' },
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
