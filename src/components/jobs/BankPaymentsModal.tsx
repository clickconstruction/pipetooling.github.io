import BankTransferDetailsPanel from './BankTransferDetailsPanel'
import { PORTAL_COMPANY } from '../../../supabase/functions/_shared/portalCompany'
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
  fetchBankPaymentsKindBadgesFromAppSettings,
  loadBankPaymentsKindBadges,
  mercuryKindPaymentTypeLabel,
  saveBankPaymentsKindBadgesLocalCache,
  upsertBankPaymentsKindBadgesToAppSettings,
  type MercuryKindBadge,
} from '../../lib/bankPaymentsKindBadges'
import { ArDepositRow } from './ar/ArDepositRow'
import { ArHeaderMenu } from './ar/ArHeaderMenu'
import { ArDepositHeader } from './ar/ArDepositHeader'
import { ArPayerMatches } from './ar/ArPayerMatches'
import { ArBilledLineOption, ArBilledLineTrigger } from './ar/ArBilledLineOption'
import {
  AR_BILLED_LINE_MATCH_ROW_STYLE,
  arBilledLineFooterText,
  arBilledLineRowParts,
  orderArBilledLineTargets,
} from '../../lib/jobs/arBilledLineOptions'
import { arAllocationProgress } from '../../lib/jobs/arAllocationProgress'
import { arApplySentence, arNextDepositId } from '../../lib/jobs/arApplySentence'
import { arDepositRowStates, arDepositSummary, arDepositSummaryWords } from '../../lib/jobs/arDepositRowState'
import { mercuryDebitCardIdFromRaw } from '../../lib/mercuryRawDebitCard'
import { bankReturnedChipWords, mercuryBankReturnFromRaw, type MercuryBankReturn } from '../../lib/jobs/bankReturnedDeposits'
import { supabase } from '../../lib/supabase'
import {
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
  arRecordedPaymentMatchesForQuery,
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
import { findRecordedPaymentCollisions } from '../../lib/jobs/arLinkCollision'
import { readEdgeFunctionErrorBody } from '../../lib/readEdgeFunctionErrorBody'
import { buildArTipOffer } from '../../lib/jobs/arTipOffer'
import {
  AR_APPLIED_INCOME_SETTING_KEY,
  arAppliedToast,
  arApplyBooksIncome,
  arBankLabelNote,
  arBankLabelStays,
  parseArIncomeSettingValue,
  type ArBankLabelSlice,
} from '../../lib/jobs/arBankLabel'
import { useToastContext } from '../../contexts/ToastContext'
import { ArTipOffer } from './ar/ArTipOffer'
import { ArCloseOut } from './ar/ArCloseOut'
import { buildArCloseOutOffer, describeArCloseOut, type ArClosedRow } from '../../lib/jobs/arCloseOut'
import { isMissingRpcError } from '../../lib/customers/customersListBundle'

type MercuryCandidateRow =
  Database['public']['Functions']['list_mercury_transactions_for_bank_payments']['Returns'][number]
/**
 * v2.3795: each row carries what Mercury's raw payload says about a bank
 * return (`status = failed` after posting), read once at load. A returned-by-
 * the-bank deposit is treated like a hand-marked one — out of To match, the
 * sweep, the close-out and the tip strip — without anything being written.
 */
type MercuryCandidate = MercuryCandidateRow & { bankReturn: MercuryBankReturn | null }

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

/** The To match · All switch on the deposit list (AR refresh, v2.3379). */
function listSegStyle(active: boolean): CSSProperties {
  return {
    padding: '0.2rem 0.6rem',
    fontSize: '0.75rem',
    border: 'none',
    background: active ? 'var(--bg-blue-tint)' : 'transparent',
    color: active ? 'var(--text-link)' : 'var(--text-muted)',
    cursor: 'pointer',
    fontWeight: active ? 700 : 500,
  }
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
  const [bankDetailsOpen, setBankDetailsOpen] = useState(false)
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
  /** AR refresh (v2.3380): the memo is folded to "Add a note" until wanted. */
  const [noteOpen, setNoteOpen] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)
  const [applySubmitting, setApplySubmitting] = useState(false)
  const [kindBadges, setKindBadges] = useState<Record<string, MercuryKindBadge>>(() => loadBankPaymentsKindBadges())
  const [arAllocations, setArAllocations] = useState<ArAllocationRow[]>([])
  const [arAllocationsLoading, setArAllocationsLoading] = useState(false)
  const [arAllocationsError, setArAllocationsError] = useState<string | null>(null)
  /** Applied-means-Income: the org switch (read once per open) and the selected deposit's Banking label. */
  const [arIncomeSwitchOn, setArIncomeSwitchOn] = useState<boolean>(false)
  const [bankLabel, setBankLabel] = useState<ArBankLabelSlice | null>(null)
  // The tip offer (v2.3496): money left on a deposit whose bills are settled.
  const [tipJobId, setTipJobId] = useState<string | null>(null)
  const [tipConfirming, setTipConfirming] = useState(false)
  const [tipBusy, setTipBusy] = useState(false)
  const [tipError, setTipError] = useState<string | null>(null)
  /**
   * The close-out (v2.3529): deposits that are not a customer's payment, closed out with a
   * reason. One sidecar row per deposit, read whole (it is small) beside the list so the
   * header can show the record under To match · All and the row can wear its chip.
   */
  const [closedById, setClosedById] = useState<Map<string, ArClosedRow>>(() => new Map())
  const [closeReason, setCloseReason] = useState<string | null>(null)
  const [closeNote, setCloseNote] = useState('')
  const [closeConfirming, setCloseConfirming] = useState(false)
  const [closeBusy, setCloseBusy] = useState(false)
  const [closeError, setCloseError] = useState<string | null>(null)
  const [reopenBusy, setReopenBusy] = useState(false)

  const targets = useMemo(() => bankPaymentTargetsFromStageRows(billedRows), [billedRows])
  const targetByKey = useMemo(() => new Map(targets.map((t) => [t.key, t] as const)), [targets])
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

  const { showToast } = useToastContext()
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
  /** AR refresh (v2.3379): one state per row from the data above, and the header's summary. */
  const rowStates = useMemo(
    () =>
      arDepositRowStates({
        deposits: candidates.map((c) => ({ ...c, closed: closedById.has(c.mercury_transaction_id) })),
        sweep: exactMatchSweep,
        targets,
        recordedPayments,
      }),
    [candidates, closedById, exactMatchSweep, targets, recordedPayments],
  )
  const depositSummary = useMemo(() => arDepositSummaryWords(arDepositSummary(candidates)), [candidates])
  const allocationProgress = useMemo(
    () => arAllocationProgress({ amount: selected?.amount ?? 0, consumed: selected?.consumed ?? 0, remainingAvailable: selected?.remaining_available ?? 0, lines: allocLines }),
    [selected, allocLines],
  )
  /** AR refresh PR 4 (v2.3382): the deposit "Apply & next" lands on — the row below, else above. */
  const nextDepositId = useMemo(
    () => arNextDepositId(filteredCandidates.map((c) => c.mercury_transaction_id), selectedId),
    [filteredCandidates, selectedId],
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
   * The billed-line picker's rows (v2.3383): the matched payer's bills first (the
   * deposit match on top), then other bills equal to the deposit, then the rest.
   * Each row is two lines (`ArBilledLineOption`); the closed trigger is one
   * (`ArBilledLineTrigger`); `label` stays the full search string.
   */
  const targetSelectOptions = useMemo(() => {
    const payerKeys = new Set(depositPayerMatch?.targetKeys ?? [])
    return orderArBilledLineTargets(targets, { payerKeys, amountMatchKeys: depositAmountMatchKeys }).map((t) => {
      const parts = arBilledLineRowParts(t)
      const amountMatch = depositAmountMatchKeys.has(t.key)
      return {
        value: t.key,
        label: t.searchLabel,
        labelContent: <ArBilledLineOption parts={parts} amountMatch={amountMatch} />,
        triggerContent: <ArBilledLineTrigger parts={parts} />,
        optionStyle: amountMatch ? AR_BILLED_LINE_MATCH_ROW_STYLE : undefined,
      }
    })
  }, [targets, depositPayerMatch, depositAmountMatchKeys])
  const targetSelectFooter = useMemo(() => arBilledLineFooterText(targets), [targets])

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

  /**
   * AR refresh PR 3 (v2.3381): a bill picked from the "Who paid you" list lands on
   * the first empty billed line, or on a new line when every line is taken — the
   * same amount math as picking it in the row's own picker.
   */
  const pickTargetIntoLines = useCallback(
    (targetKey: string) => {
      setAllocLines((rows) => {
        const mercuryCap = selected ? Number(selected.remaining_available) : 0
        const target = targetByKey.get(targetKey)
        const empty = rows.find((r) => r.kind === 'billed' && !r.targetKey.trim())
        const others = rows.filter((r) => r.id !== empty?.id)
        const otherSum = others.reduce((sum, r) => {
          const n = parseBankPaymentAllocationAmount(r.amountStr)
          return sum + (Number.isFinite(n) && n > 0 ? n : 0)
        }, 0)
        const amountStr = allocationAmountStrForTargetChange(target, mercuryCap, otherSum)
        if (empty) return rows.map((r) => (r.id === empty.id ? { ...r, targetKey, amountStr } : r))
        return [...rows, { id: crypto.randomUUID(), kind: 'billed' as const, targetKey, amountStr }]
      })
    },
    [selected, targetByKey],
  )

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

  /** The close-out rows (v2.3529). Quiet on failure: the strip still works, only the chips and the record are missed. */
  const loadArClosed = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('mercury_transaction_ar_closed')
        .select('mercury_transaction_id, reason, note, closed_at, closed_by')
        .limit(5000)
      if (error) return
      const next = new Map<string, ArClosedRow>()
      for (const r of (data ?? []) as ArClosedRow[]) next.set(r.mercury_transaction_id, r)
      setClosedById(next)
    } catch {
      /* the table may not be pushed yet — nothing to show */
    }
  }, [])

  const refreshList = useCallback(async (): Promise<MercuryCandidate[]> => {
    if (!open) return []
    void loadArClosed()
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
      if (seq !== listRequestSeqRef.current) return []
      const rows: MercuryCandidate[] = ((data ?? []) as MercuryCandidateRow[])
        .map((r) => ({ ...r, bankReturn: mercuryBankReturnFromRaw(r.raw, r.posted_at, r.amount) }))
        // A deposit the bank returned leaves To match like a hand-marked one; All still lists it with its chip.
        .filter((r) => includeHiddenArDeposits || r.bankReturn == null)
      setCandidates(rows)
      setSelectedId((prev) => {
        if (prev && rows.some((r) => r.mercury_transaction_id === prev)) return prev
        const first = rows[0]
        return first?.mercury_transaction_id ?? null
      })
      return rows
    } catch (e: unknown) {
      if (seq !== listRequestSeqRef.current) return []
      setListError(e instanceof Error ? e.message : 'Failed to load bank transactions')
      setCandidates([])
      return []
    } finally {
      if (seq === listRequestSeqRef.current) setListLoading(false)
    }
  }, [open, sortingConfig, includeHiddenArDeposits, loadArClosed])

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

  /** Allocation-line ids whose "link that payment instead" steer was waved off ("It's a different payment"). */
  const [linkSteerDismissedLineIds, setLinkSteerDismissedLineIds] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    if (!open || !selectedId) return
    setAllocLines([{ id: crypto.randomUUID(), kind: 'billed', targetKey: '', amountStr: '' }])
    // The note belongs to this deposit's payment (p_note / the Stripe OOB internal_note) —
    // it must not ride along to the next deposit (v2.3831).
    setInternalNote('')
    setNoteOpen(false)
    setApplyError(null)
    setStripeOutOfBandConfirmed(false)
    setStripeCloseResults(null)
    setLinkSteerDismissedLineIds(new Set())
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

  /**
   * The tip offer (v2.3496): a matched deposit that still carries money. The rule and the words
   * live in `arTipOffer`; the write is `record_job_tip_from_deposit`.
   */
  const tipOffer = useMemo(
    () =>
      selected
        ? buildArTipOffer({
            remaining: Number(selected.remaining_available),
            allocations: arAllocations,
            returned: Boolean(selected.returned) || selected.bankReturn != null,
          })
        : null,
    [selected, arAllocations],
  )

  /** Reset the offer's own state whenever the deposit or the available jobs change. */
  useEffect(() => {
    setTipConfirming(false)
    setTipBusy(false)
    setTipError(null)
    setTipJobId(tipOffer?.jobId ?? null)
  }, [selected?.mercury_transaction_id, tipOffer?.jobId, tipOffer?.jobChoices.length])

  const addTipLine = useCallback(async () => {
    const txId = selected?.mercury_transaction_id
    if (!txId || !tipOffer || !tipJobId) return
    setTipBusy(true)
    setTipError(null)
    try {
      const data = await withSupabaseRetry(
        async () =>
          supabase.rpc('record_job_tip_from_deposit', {
            p_mercury_transaction_id: txId,
            p_job_id: tipJobId,
            p_amount: tipOffer.amount,
            p_payment_type: kindPaymentTypeLabel || undefined,
            p_note: undefined,
          }),
        'record_job_tip_from_deposit',
      )
      const payload = data as { error?: string; ok?: boolean } | null
      if (payload && typeof payload === 'object' && typeof payload.error === 'string') {
        throw new Error(payload.error)
      }
      setTipConfirming(false)
      // Both halves: onApplied refreshes the caller's jobs (the billed rows), refreshList
      // refetches the deposits so this one's remainder reads zero and it leaves To match.
      // Without the second the strip stays up until the page is reloaded.
      await onApplied()
      await refreshList()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not add the tip'
      setTipError(
        isMissingRpcError(msg)
          ? 'This is not live in the database yet — the change still has to be pushed.'
          : msg,
      )
    } finally {
      setTipBusy(false)
    }
  }, [selected?.mercury_transaction_id, tipOffer, tipJobId, kindPaymentTypeLabel, onApplied, refreshList])

  /**
   * The close-out offer (v2.3529): an untouched deposit that is not a customer's payment.
   * The rule and the words live in `arCloseOut`; the write is `set_mercury_transaction_ar_closed`.
   * Mutually exclusive with the tip strip by rule — one needs money applied, the other none.
   */
  const closedRow = selected ? closedById.get(selected.mercury_transaction_id) ?? null : null
  const closeOutOffer = useMemo(
    () =>
      selected && canApply
        ? buildArCloseOutOffer({
            remaining: Number(selected.remaining_available),
            consumed: Number(selected.consumed),
            returned: Boolean(selected.returned),
            bankReturned: selected.bankReturn != null,
            closed: closedById.has(selected.mercury_transaction_id),
            counterpartyName: selected.counterparty_name,
            note: selected.note,
            memo: selected.external_memo,
          })
        : null,
    [selected, canApply, closedById],
  )

  useEffect(() => {
    setCloseConfirming(false)
    setCloseBusy(false)
    setCloseError(null)
    setCloseNote('')
    setCloseReason(closeOutOffer?.suggestedReason ?? null)
  }, [selected?.mercury_transaction_id, closeOutOffer?.suggestedReason])

  const closeOutDeposit = useCallback(async () => {
    const txId = selected?.mercury_transaction_id
    if (!txId || !closeOutOffer || !closeReason) return
    setCloseBusy(true)
    setCloseError(null)
    try {
      const data = await withSupabaseRetry(
        async () =>
          supabase.rpc('set_mercury_transaction_ar_closed', {
            p_mercury_transaction_id: txId,
            p_reason: closeReason,
            p_note: closeNote.trim() || undefined,
          }),
        'set_mercury_transaction_ar_closed',
      )
      const payload = data as { error?: string; ok?: boolean } | null
      if (payload && typeof payload === 'object' && typeof payload.error === 'string') {
        throw new Error(payload.error)
      }
      setCloseConfirming(false)
      showToast('Closed out — it has left To match.', 'success')
      await refreshList()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not close out the deposit'
      setCloseError(
        isMissingRpcError(msg)
          ? 'This is not live in the database yet — the change still has to be pushed.'
          : msg,
      )
    } finally {
      setCloseBusy(false)
    }
  }, [selected?.mercury_transaction_id, closeOutOffer, closeReason, closeNote, showToast, refreshList])

  const reopenDeposit = useCallback(async () => {
    const txId = selected?.mercury_transaction_id
    if (!txId) return
    setReopenBusy(true)
    try {
      await withSupabaseRetry(
        async () =>
          supabase.rpc('set_mercury_transaction_ar_closed', {
            p_mercury_transaction_id: txId,
            p_reason: null as unknown as string,
          }),
        'set_mercury_transaction_ar_closed',
      )
      showToast('Reopened — it is back in To match.', 'success')
      await refreshList()
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Could not reopen the deposit', 'error')
    } finally {
      setReopenBusy(false)
    }
  }, [selected?.mercury_transaction_id, showToast, refreshList])

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

  // Applied-means-Income: the org switch, once per open. A failed read means
  // "off", which only hides the clause — the database decides the label either way.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      try {
        const { data } = await supabase
          .from('app_settings')
          .select('value_text')
          .eq('key', AR_APPLIED_INCOME_SETTING_KEY)
          .maybeSingle()
        if (!cancelled) setArIncomeSwitchOn(parseArIncomeSettingValue((data as { value_text: string | null } | null)?.value_text))
      } catch {
        if (!cancelled) setArIncomeSwitchOn(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  // The selected deposit's Banking label. Office staff can read the assignment
  // and label tables; a role that cannot simply sees no clause (null), never a
  // wrong one — an unlabelled read is only trusted when the query succeeded.
  useEffect(() => {
    const txId = selected?.mercury_transaction_id
    if (!open || !txId) {
      setBankLabel(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const [assign, ar] = await Promise.all([
          supabase
            .from('mercury_transaction_drag_sort_assignments')
            .select('label_id, mercury_drag_sort_labels(name, default_key)')
            .eq('mercury_transaction_id', txId)
            .maybeSingle(),
          supabase
            .from('mercury_transaction_ar_income_labels')
            .select('mercury_transaction_id')
            .eq('mercury_transaction_id', txId)
            .maybeSingle(),
        ])
        if (cancelled) return
        if (assign.error) {
          setBankLabel(null)
          return
        }
        const row = assign.data as
          | { label_id: string; mercury_drag_sort_labels: { name: string; default_key: string | null } | null }
          | null
        setBankLabel({
          switchOn: arIncomeSwitchOn,
          labelName: row?.mercury_drag_sort_labels?.name ?? null,
          labelDefaultKey: row?.mercury_drag_sort_labels?.default_key ?? null,
          setByAr: !ar.error && ar.data != null,
        })
      } catch {
        if (!cancelled) setBankLabel(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, selected?.mercury_transaction_id, arIncomeSwitchOn])

  /** The one-line deviation note under the header — only when the label is something other than Income. */
  const bankLabelNote = useMemo(() => arBankLabelNote(bankLabel), [bankLabel])

  /** AR refresh PR 4 (v2.3382): the footer's words — what Apply will do, or why it can't yet. */
  const applySentence = useMemo(
    () =>
      arApplySentence({
        lines: allocLines,
        targetByKey,
        paymentById: recordedPaymentById,
        depositRemaining: selected ? Number(selected.remaining_available) : 0,
        validation: validationMessage,
        tipOffered: tipOffer != null,
        closeOutOffered: closeOutOffer != null,
        booksIncome: arApplyBooksIncome(bankLabel),
        bankLabelStays: arBankLabelStays(bankLabel),
      }),
    [allocLines, targetByKey, recordedPaymentById, selected, validationMessage, tipOffer, closeOutOffer, bankLabel],
  )

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

  /**
   * After a successful apply: close (the default), or stay open and move to the
   * next deposit in the list ("Apply & next", v2.3382) — the list is refreshed
   * first so a fully applied deposit has left the pile.
   */
  async function finishApply(mode: 'close' | 'next', nextId: string | null) {
    if (mode === 'close') {
      onClose()
      return
    }
    const rows = await refreshList()
    if (nextId && rows.some((r) => r.mercury_transaction_id === nextId)) setSelectedId(nextId)
  }

  async function submitApply(mode: 'close' | 'next' = 'close') {
    if (!selected || !canApply || !canAllocateRemaining) return
    const nextId = mode === 'next' ? nextDepositId : null
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
      // Applied-means-Income: the trigger inside that RPC labelled the deposit
      // when the switch was on and nothing had labelled it — say so, once.
      showToast(arAppliedToast(applySentence.total, arApplyBooksIncome(bankLabel)), 'success')
      // v2.1639: allocation applied — now close exactly-covered Stripe-hosted
      // bills in Stripe so the emailed links die. Failures keep the modal open
      // on a retry panel (the allocation itself already stands).
      const candidates = stripeAllocationSelected
        ? arStripeAutoCloseCandidates(stripeAutoCloseLines, targetByKey)
        : []
      if (candidates.length === 0) {
        await onApplied()
        await finishApply(mode, nextId)
        return
      }
      const results: Array<ArStripeAutoCloseCandidate & { ok: boolean; error?: string }> = []
      for (const c of candidates) {
        const res = await closeStripeInvoiceOob(c)
        results.push({ ...c, ok: res.ok, error: res.error })
      }
      await onApplied()
      if (results.every((r) => r.ok)) {
        await finishApply(mode, nextId)
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
          <h2 id="accounts-receivable-modal-title" style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
            Accounts Receivable
          </h2>
          {/* AR refresh (v2.3379): the header summarises the pile instead of explaining the modal. */}
          {depositSummary ? (
            <span data-testid="ar-summary" style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <strong style={{ color: 'var(--text-strong)' }}>{depositSummary.count}</strong> to match ·{' '}
              <strong style={{ color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>{depositSummary.money}</strong> unapplied
            </span>
          ) : (
            <span style={{ flex: '1 1 auto' }} />
          )}
          {/* Bank transfer details (v2.3308): the routing / account / check address
              the customer on the phone is asking for — the same row the portal
              statement shows, read here for the office. */}
          <button
            type="button"
            onClick={() => setBankDetailsOpen((v) => !v)}
            aria-expanded={bankDetailsOpen}
            aria-controls="ar-bank-transfer-panel"
            style={{
              border: '1px solid var(--border)',
              background: bankDetailsOpen ? 'var(--bg-muted)' : 'var(--surface)',
              color: 'var(--text)',
              borderRadius: 6,
              padding: '0.35rem 0.65rem',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            🏦 Bank transfer details
          </button>
          <ArHeaderMenu
            ariaLabel="More Accounts Receivable options"
            items={[
              ...(canApply
                ? [
                    {
                      key: 'mark',
                      label: 'Mark returned deposits',
                      hint: 'Tick bounced checks on the list so they leave the pile',
                      checked: arBankReturnedMarkMode,
                      onSelect: () => setArBankReturnedMarkMode((v) => !v),
                    },
                  ]
                : []),
              ...(authRole === 'dev'
                ? [
                    {
                      key: 'filter',
                      label: 'Mercury filter…',
                      hint: `Start ${sortingConfig.startDateYmd} · kinds ${sortingConfig.kinds.length || 'all'} · accounts ${sortingConfig.accountIds.length || 'all'} · debit cards ${sortingConfig.debitCardIds.length || 'any'} · dev only`,
                      onSelect: () => setSortingConfigModalOpen(true),
                    },
                  ]
                : []),
            ]}
          />
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

        <div id="ar-bank-transfer-panel">
          <BankTransferDetailsPanel open={bankDetailsOpen} phone={PORTAL_COMPANY.phone} canEdit={authRole === 'dev' || authRole === 'master_technician'} />
        </div>

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
              <span style={{ fontWeight: 700, fontSize: '0.8125rem', color: 'var(--text-700)' }}>Deposits</span>
              {/* AR refresh (v2.3379): To match · All replaces the "Show fully applied and returned" checkbox. */}
              <div role="group" aria-label="Which deposits to list" style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 999, overflow: 'hidden' }}>
                <button type="button" aria-pressed={!includeHiddenArDeposits} onClick={() => setIncludeHiddenArDeposits(false)} style={listSegStyle(!includeHiddenArDeposits)}>
                  To match{depositSummary ? ` · ${depositSummary.count.split(' ')[0]}` : ''}
                </button>
                <button
                  type="button"
                  aria-pressed={includeHiddenArDeposits}
                  onClick={() => setIncludeHiddenArDeposits(true)}
                  title="Also list deposits already fully applied and those marked returned"
                  style={listSegStyle(includeHiddenArDeposits)}
                >
                  All
                </button>
              </div>
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
              {filteredCandidates.map((c) => (
                <ArDepositRow
                  key={c.mercury_transaction_id}
                  deposit={c}
                  active={c.mercury_transaction_id === selectedId}
                  state={rowStates.get(c.mercury_transaction_id) ?? 'hand'}
                  kindBadges={kindBadges}
                  markMode={arBankReturnedMarkMode}
                  canApply={canApply}
                  savingReturned={returnedToggleSavingId === c.mercury_transaction_id}
                  onSelect={() => setSelectedId(c.mercury_transaction_id)}
                  onToggleReturned={(next) => void toggleMercuryReturned(c.mercury_transaction_id, next)}
                />
              ))}
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
            <div style={{ flex: 1, overflow: 'auto', padding: '1rem 1.25rem' }}>
              {!selected ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Select a bank transaction.</p>
              ) : (
                <>
                  <ArDepositHeader
                    name={(selected.counterparty_name ?? '').trim() || 'Unnamed deposit'}
                    amount={Math.abs(Number(selected.amount))}
                    kind={selected.kind}
                    kindBadges={kindBadges}
                    postedLabel={paidOnYmdFromMercury ? formatWorkDateYmdFriendly(paidOnYmdFromMercury) : null}
                    note={selected.note}
                    memo={selected.external_memo}
                    returned={Boolean(selected.returned)}
                    returnedLabel={selected.bankReturn ? bankReturnedChipWords(selected.bankReturn) : null}
                    closedLabel={
                      closedRow
                        ? describeArCloseOut(closedRow, (iso) =>
                            new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: APP_CALENDAR_TZ }),
                          )
                        : null
                    }
                    onReopen={closedRow && canApply ? () => void reopenDeposit() : undefined}
                    reopenBusy={reopenBusy}
                    consumed={Number(selected.consumed) || 0}
                    progress={allocationProgress}
                  />
                  {bankLabelNote ? (
                    <div
                      data-testid="ar-bank-label-note"
                      style={{ marginBottom: '0.75rem', fontSize: '0.8125rem', color: 'var(--text-amber-700)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}
                    >
                      <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--text-amber-700)', display: 'inline-block', flex: 'none' }} />
                      {bankLabelNote.text}
                    </div>
                  ) : null}

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

                  {canAllocateRemaining ? (
                    <>
                      {/* AR refresh PR 3 (v2.3381): the matches lead the pane as a list; bills already on a line are left out. */}
                      <ArPayerMatches
                        match={depositPayerMatch}
                        payerTargets={depositPayerTargets.filter((t) => !allocLines.some((r) => r.kind === 'billed' && r.targetKey === t.key))}
                        amountMatchKeys={depositAmountMatchKeys}
                        combo={payerBillCombo && allocLines.length === 1 && !(allocLines[0]?.targetKey ?? '').trim() ? payerBillCombo : null}
                        depositRemaining={Number(selected.remaining_available)}
                        outsideTargets={quickMatchTargetsOutsidePayer.filter((t) => !allocLines.some((r) => r.kind === 'billed' && r.targetKey === t.key))}
                        canApply={canApply}
                        onPick={pickTargetIntoLines}
                        onPickCombo={applyComboAllocation}
                      />
                      {tipOffer ? (
                        <div style={{ marginBottom: '0.6rem' }}>
                          <ArTipOffer
                            offer={tipOffer}
                            chosenJobId={tipJobId}
                            busy={tipBusy}
                            confirming={tipConfirming}
                            error={tipError}
                            onChooseJob={(id) => setTipJobId(id || null)}
                            onRequest={() => {
                              setTipError(null)
                              setTipConfirming(true)
                            }}
                            onConfirm={() => void addTipLine()}
                            onCancel={() => setTipConfirming(false)}
                          />
                        </div>
                      ) : null}
                      {closeOutOffer ? (
                        <div style={{ marginBottom: '0.6rem' }}>
                          <ArCloseOut
                            offer={closeOutOffer}
                            reason={closeReason}
                            note={closeNote}
                            busy={closeBusy}
                            confirming={closeConfirming}
                            error={closeError}
                            onChangeReason={(r) => setCloseReason(r || null)}
                            onChangeNote={setCloseNote}
                            onRequest={() => {
                              setCloseError(null)
                              setCloseConfirming(true)
                            }}
                            onConfirm={() => void closeOutDeposit()}
                            onCancel={() => setCloseConfirming(false)}
                          />
                        </div>
                      ) : null}
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.35rem' }}>Allocations</div>
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
                        /** v2.2591 link guard: a same-amount unlinked recorded payment on the picked job usually means LINK, not create. */
                        const linkCollisions =
                          line.kind === 'billed' && picked && !linkSteerDismissedLineIds.has(line.id)
                            ? findRecordedPaymentCollisions(
                                picked.jobId,
                                parseBankPaymentAllocationAmount(line.amountStr),
                                recordedPayments,
                              ).filter((p) => !takenPaymentIds.has(p.payment_id))
                            : []
                        const linkCollision = linkCollisions[0]
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
                            data-testid="ar-allocation-row"
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'auto minmax(0, 1fr) 7.5rem 1.5rem',
                              gap: '0 0.5rem',
                              alignItems: 'start',
                              padding: '0.5rem 0',
                              borderTop: '1px solid var(--border)',
                            }}
                          >
                            <div style={{ paddingTop: 2 }}>
                              {recordedPayments.length > 0 ? (
                                <div
                                  role="group"
                                  aria-label="Allocation target type"
                                  style={{
                                    display: 'inline-flex',
                                    border: '1px solid var(--border-strong)',
                                    borderRadius: 999,
                                    overflow: 'hidden',
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
                              {recordedPayments.length === 0 ? (
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Billed line</span>
                              ) : null}
                            </div>
                            <div style={{ minWidth: 0 }}>
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
                                // v2.3383: two-line rows want the row's width and the modal's
                                // height, not the trigger's width and 140px.
                                listMinWidthPx={560}
                                listMaxHeightPx={320}
                                fillViewportHeight
                                listOptionPadding="0.45rem 0.75rem"
                                searchPlaceholder="Name, job #, address or amount"
                                listFooter={targetSelectFooter}
                                // v2.2597: a fully-paid line (Mark Paid before the deposit was
                                // allocated) has no billed-line row — steer the dead-ended
                                // search to the recorded payment it should link instead.
                                noMatchesAction={
                                  recordedPayments.length > 0
                                    ? {
                                        label: (q) => {
                                          const n = arRecordedPaymentMatchesForQuery(recordedPayments, takenPaymentIds, q).length
                                          return n > 0
                                            ? `No billed line — but ${n} recorded payment${n === 1 ? '' : 's'} match${n === 1 ? 'es' : ''} “${q}”. Link it instead`
                                            : 'Nothing billed matches — search recorded payments instead'
                                        },
                                        onSelect: (q) => {
                                          const matches = arRecordedPaymentMatchesForQuery(recordedPayments, takenPaymentIds, q)
                                          setAllocLineKind(line.id, 'payment')
                                          if (matches.length === 1) applyRecordedPaymentTarget(line.id, matches[0]!.payment_id)
                                        },
                                      }
                                    : undefined
                                }
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
                              {linkCollision ? (
                                <div
                                  role="note"
                                  aria-label="This payment may already be recorded"
                                  style={{
                                    marginTop: 8,
                                    padding: '0.55rem 0.7rem',
                                    border: '1px solid #f59e0b',
                                    borderRadius: 6,
                                    background: 'var(--bg-amber-tint)',
                                    fontSize: '0.78rem',
                                    lineHeight: 1.45,
                                    color: 'var(--text-amber-800)',
                                  }}
                                >
                                  <strong>This payment may already be recorded.</strong> A{' '}
                                  {formatMoney(Math.abs(Number(linkCollision.amount) || 0))} payment
                                  {linkCollision.paid_on && /^\d{4}-\d{2}-\d{2}$/.test(linkCollision.paid_on.trim())
                                    ? ` dated ${formatWorkDateYmdFriendly(linkCollision.paid_on.trim())}`
                                    : ''}{' '}
                                  is on this job with no bank deposit linked
                                  {linkCollisions.length > 1 ? ` (${linkCollisions.length} such payments)` : ''}.
                                  Linking it avoids counting the money twice.
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: 6 }}>
                                    <button
                                      type="button"
                                      disabled={!canApply}
                                      onClick={() => {
                                        setAllocLineKind(line.id, 'payment')
                                        applyRecordedPaymentTarget(line.id, linkCollision.payment_id)
                                      }}
                                      style={{
                                        padding: '0.3rem 0.6rem',
                                        borderRadius: 4,
                                        border: 'none',
                                        background: '#2563eb',
                                        color: 'white',
                                        cursor: !canApply ? 'not-allowed' : 'pointer',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                      }}
                                    >
                                      Link that payment instead
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setLinkSteerDismissedLineIds((prev) => {
                                          const next = new Set(prev)
                                          next.add(line.id)
                                          return next
                                        })
                                      }
                                      style={{
                                        padding: '0.3rem 0.6rem',
                                        borderRadius: 4,
                                        border: '1px solid var(--border-strong)',
                                        background: 'var(--surface)',
                                        color: 'var(--text-700)',
                                        cursor: 'pointer',
                                        fontSize: '0.75rem',
                                      }}
                                    >
                                      It&apos;s a different payment
                                    </button>
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
                                padding: '0.35rem 0.5rem',
                                width: '100%',
                                boxSizing: 'border-box',
                                textAlign: 'right',
                                fontVariantNumeric: 'tabular-nums',
                                border: '1px solid var(--border-strong)',
                                borderRadius: 4,
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
                                  marginTop: 4,
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
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.25rem 0.9rem', marginTop: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.5rem', fontSize: '0.8125rem' }}>
                          <button
                            type="button"
                            onClick={() =>
                              setAllocLines((rows) => [
                                ...rows,
                                { id: crypto.randomUUID(), kind: 'billed', targetKey: '', amountStr: '' },
                              ])
                            }
                            style={{ border: 'none', background: 'none', padding: 0, color: 'var(--text-link)', fontWeight: 600, cursor: 'pointer', fontSize: '0.8125rem' }}
                          >
                            + Split across another bill
                          </button>
                          {!noteOpen && !internalNote.trim() ? (
                            <button
                              type="button"
                              onClick={() => setNoteOpen(true)}
                              style={{ border: 'none', background: 'none', padding: 0, color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8125rem' }}
                            >
                              · Add a note
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                      {noteOpen || internalNote.trim() ? (
                        <div style={{ marginTop: '0.5rem' }}>
                          <label htmlFor="ar-internal-note" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 3 }}>
                            Note on this payment <span style={{ fontWeight: 400 }}>— internal, shows on the job's Payments received</span>
                          </label>
                          <textarea
                            id="ar-internal-note"
                            value={internalNote}
                            onChange={(e) => setInternalNote(e.target.value)}
                            disabled={!canApply}
                            rows={2}
                            autoFocus={noteOpen && !internalNote.trim()}
                            style={{ width: '100%', padding: '0.35rem 0.5rem', boxSizing: 'border-box', resize: 'vertical', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.8125rem' }}
                          />
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
                  {applyError && (
                    <p style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>{applyError}</p>
                  )}
                </>
              )}
            </div>

            <div
              data-testid="ar-footer"
              style={{
                padding: '0.65rem 1.25rem',
                borderTop: '1px solid var(--border)',
                background: 'var(--bg-subtle)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                flexWrap: 'wrap',
              }}
            >
              {/* AR refresh PR 4 (v2.3382): the footer says what Apply will do. */}
              <span
                data-testid="ar-apply-sentence"
                style={{ flex: '1 1 240px', minWidth: 0, fontSize: '0.8125rem', lineHeight: 1.4, color: applySentence.tone === 'warn' ? 'var(--text-amber-700)' : applySentence.tone === 'ready' ? 'var(--text-strong)' : 'var(--text-muted)' }}
              >
                {selected ? applySentence.text : ''}
              </span>
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
              {nextDepositId && !applyDisabled ? (
                <button
                  type="button"
                  onClick={() => void submitApply('next')}
                  title="Apply, then stay here on the next deposit in the list"
                  style={{
                    padding: '0.45rem 0.9rem',
                    borderRadius: 4,
                    border: '1px solid var(--border-strong)',
                    background: 'var(--surface)',
                    color: 'var(--text-link)',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Apply &amp; next ›
                </button>
              ) : null}
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
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {applySubmitting ? 'Applying…' : applySentence.total > 0 && !applyDisabled ? `Apply $${formatMoney(applySentence.total)}` : 'Apply'}
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
