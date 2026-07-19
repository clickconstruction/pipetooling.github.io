import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import type { Database, Json } from '../../types/database'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import { SearchableSelect, type SearchableSelectOption } from '../SearchableSelect'
import { parseBankingAttributionValue } from '../../lib/bankingAttributionOptions'
import { pushRecentPersonUserId } from '../../lib/mercuryAllocRecentPersonUserIds'
import {
  lineDisplayDollars,
  redistributeEqualSplit,
  round2,
  sumEpsilon,
  type SplitLine,
} from '../../lib/mercurySplitMath'
import {
  fetchAttributionsByMercuryTxIds,
  fetchJobAllocationsByMercuryTxIds,
} from '../../lib/fetchMercuryRelationsByTxIds'
import { formatMercuryDebitCardIdCompact, mercuryDebitCardIdFromRaw } from '../../lib/mercuryRawDebitCard'
import { mercuryBankDescriptionFromRaw } from '../../lib/mercuryBankDescriptionFromRaw'
import { formatMercuryKind } from '../../lib/mercuryKindLabels'
import { shortUuidPrefix } from '../../lib/shortUuidPrefix'
import {
  buildSortedAccountingLabelSelectOptions,
  type AccountingDragLabelRow,
} from '../../lib/accountingLabelSelectOptions'
import {
  matchingAccountingRulesForTx,
  type AccountingRuleForMatch,
} from '../../lib/accountingLabelRuleMatch'
import { formatJobLedgerShortLine } from '../../lib/ledgerDisplayPrefixes'
import { useLedgerPrefixMap } from '../../contexts/LedgerDisplayPrefixContext'
import { INTERNAL_TRANSFERS_DEFAULT_KEY } from '../../lib/dragSortDefaultLabels'
import { TransactionContextModal } from './TransactionContextModal'
import {
  AccountingRuleFormModal,
  emptyRuleForm,
  ruleRowToForm,
  type AccountingRuleFormState,
  type AccountingRuleSaveDraft,
} from './AccountingRuleFormModal'

type MercuryTxRow = Database['public']['Tables']['mercury_transactions']['Row']
type JobSearchRow = { id: string; hcp_number: string; job_name: string; job_address: string; service_type_id: string | null }

type ReplaceSplitsCall = {
  p_mercury_transaction_id: string
  p_rows: Json
  p_person_id: string | null
  p_user_id: string | null
}

export type TransactionDetailModalProps = {
  open: boolean
  onClose: () => void
  /** Transaction row WITH `raw` hydrated. */
  transaction: MercuryTxRow | null
  attributionOptions: SearchableSelectOption[]
  nicknameByAccount: Record<string, string>
  nicknameByDebitCard: Record<string, string>
  recentPersonPicksStorageKey: string | null
  /** Called after any field is saved so the parent can refresh. */
  onChanged: () => void
  /** Re-anchor the detail to another transaction (from the "around this date" context modal). */
  onOpenTransaction?: (txId: string) => void
  zIndex?: number
}

const NOTE_MAX = 2000

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}
function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    return new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, month: 'short', day: 'numeric', year: 'numeric' }).format(d)
  } catch {
    return '—'
  }
}

const sectionStyle = { marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #f1f5f9' } as const
const sectionTitleStyle = { margin: '0 0 0.5rem', fontSize: '0.8125rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' } as const
const factLabel = { fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' } as const
const factValue = { fontSize: '0.875rem', color: 'var(--text-strong)', fontWeight: 500 } as const

export function TransactionDetailModal({
  open,
  onClose,
  transaction,
  attributionOptions,
  nicknameByAccount,
  nicknameByDebitCard,
  recentPersonPicksStorageKey,
  onChanged,
  onOpenTransaction,
  zIndex = 1250,
}: TransactionDetailModalProps) {
  const { showToast } = useToastContext()
  const ledgerPrefixMap = useLedgerPrefixMap()

  const [contextOpen, setContextOpen] = useState(false)
  const [ruleModalOpen, setRuleModalOpen] = useState(false)
  const [editRuleId, setEditRuleId] = useState<string | null>(null)
  const [ruleModalInitial, setRuleModalInitial] = useState<AccountingRuleFormState>(() => emptyRuleForm())
  const [ruleModalKey, setRuleModalKey] = useState(0)
  const [labelAssignmentCountById, setLabelAssignmentCountById] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [attrValue, setAttrValue] = useState('')
  const [lines, setLines] = useState<SplitLine[]>([])
  const [jobSearch, setJobSearch] = useState('')
  const [jobResults, setJobResults] = useState<JobSearchRow[]>([])
  const [jobSearchLoading, setJobSearchLoading] = useState(false)
  const [savingSplits, setSavingSplits] = useState(false)

  const [labels, setLabels] = useState<AccountingDragLabelRow[]>([])
  const [currentLabelId, setCurrentLabelId] = useState('')
  const [savingLabel, setSavingLabel] = useState(false)

  const [rules, setRules] = useState<AccountingRuleForMatch[]>([])

  const [noteInitial, setNoteInitial] = useState('')
  const [noteDraft, setNoteDraft] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  const txId = transaction?.id ?? null
  const txAmount = transaction ? Number(transaction.amount) : 0
  const displayTotal = Math.abs(txAmount)
  const allocationSign = (txAmount === 0 ? 1 : Math.sign(txAmount)) as 1 | -1

  const labelById = useMemo(() => {
    const m = new Map<string, AccountingDragLabelRow>()
    for (const L of labels) m.set(L.id, L)
    return m
  }, [labels])
  const internalTransfersLocked = useMemo(
    () => (currentLabelId ? labelById.get(currentLabelId)?.default_key === INTERNAL_TRANSFERS_DEFAULT_KEY : false),
    [currentLabelId, labelById],
  )

  // Self-load this transaction's current state when the modal opens.
  useEffect(() => {
    if (!open || !txId) return
    let cancelled = false
    setLoading(true)
    setJobSearch('')
    setJobResults([])
    void (async () => {
      try {
        const [allocs, attrs, labelRows, ruleRows, assignRows, noteRows, countRows] = await Promise.all([
          fetchJobAllocationsByMercuryTxIds([txId], 'tx detail allocations'),
          fetchAttributionsByMercuryTxIds([txId], 'tx detail attributions'),
          withSupabaseRetry(async () => supabase.from('mercury_drag_sort_labels').select('*').order('sort_order', { ascending: true }), 'tx detail labels'),
          withSupabaseRetry(async () => supabase.from('mercury_accounting_label_rules').select('id, name, label_id, enabled, sort_order, criteria'), 'tx detail rules'),
          withSupabaseRetry(async () => supabase.from('mercury_transaction_drag_sort_assignments').select('label_id').eq('mercury_transaction_id', txId).limit(1), 'tx detail label assignment'),
          withSupabaseRetry(async () => supabase.from('mercury_transaction_org_notes').select('body').eq('mercury_transaction_id', txId).limit(1), 'tx detail org note'),
          withSupabaseRetry(async () => supabase.rpc('list_mercury_drag_sort_label_assignment_counts'), 'tx detail label assignment counts'),
        ])
        if (cancelled) return

        const attr = (attrs[0] ?? null) as { person_id: string | null; user_id: string | null } | null
        setAttrValue(attr?.user_id ? `u:${attr.user_id}` : attr?.person_id ? `p:${attr.person_id}` : '')

        // Job labels for the existing allocation lines.
        const jobIds = [...new Set(allocs.map((a) => a.job_id))]
        const jobLabelById = new Map<string, string>()
        if (jobIds.length > 0) {
          const jobRows = await withSupabaseRetry(
            async () => supabase.from('jobs_ledger').select('id, hcp_number, job_name, service_type_id').in('id', jobIds),
            'tx detail job labels',
          )
          for (const j of (jobRows ?? []) as { id: string; hcp_number: string | null; job_name: string | null; service_type_id: string | null }[]) {
            jobLabelById.set(j.id, formatJobLedgerShortLine(ledgerPrefixMap, j.service_type_id, j.hcp_number, j.job_name).trim() || j.id)
          }
        }
        if (cancelled) return
        setLines(
          allocs.map((a) => ({
            jobId: a.job_id,
            jobLabel: jobLabelById.get(a.job_id) ?? a.job_id,
            mode: 'dollars' as const,
            valueStr: String(round2(Math.abs(Number(a.amount)))),
            note: a.note ?? '',
          })),
        )

        setLabels((labelRows ?? []) as AccountingDragLabelRow[])
        setRules((ruleRows ?? []) as AccountingRuleForMatch[])
        const counts: Record<string, number> = {}
        for (const c of (countRows ?? []) as { label_id: string; assignment_count: number }[]) {
          counts[c.label_id] = Number(c.assignment_count)
        }
        setLabelAssignmentCountById(counts)
        setCurrentLabelId(((assignRows ?? [])[0] as { label_id?: string } | undefined)?.label_id ?? '')
        const body = ((noteRows ?? [])[0] as { body?: string } | undefined)?.body ?? ''
        setNoteInitial(body)
        setNoteDraft(body)
      } catch (e) {
        if (!cancelled) showToast(e instanceof Error ? e.message : 'Could not load transaction details', 'error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, txId, ledgerPrefixMap, showToast])

  // Escape to close — but only when this is the topmost modal. With the rule
  // editor or the "around this date" context modal stacked on top, Escape
  // should dismiss that one (each handles its own key), not the detail beneath.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !ruleModalOpen && !contextOpen) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, ruleModalOpen, contextOpen])

  // Job search.
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
      void withSupabaseRetry(async () => supabase.rpc('search_jobs_ledger', { search_text: q }), 'tx detail job search')
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
  }, [open, jobSearch])

  const allocationSum = useMemo(() => {
    let sum = 0
    for (const ln of lines) {
      const d = lineDisplayDollars(ln, displayTotal)
      if (d === null) return { ok: false as const, sum: NaN }
      sum += d
    }
    return { ok: true as const, sum: round2(sum) }
  }, [lines, displayTotal])
  const remainder = allocationSum.ok ? round2(displayTotal - allocationSum.sum) : NaN
  const canSaveSplits = useMemo(() => {
    if (!transaction || internalTransfersLocked) return false
    if (lines.length === 0) return true
    if (displayTotal <= 0 || !allocationSum.ok) return false
    return Math.abs(remainder) < sumEpsilon
  }, [transaction, internalTransfersLocked, lines.length, displayTotal, allocationSum.ok, remainder])

  const addJobLine = useCallback(
    (row: JobSearchRow) => {
      setLines((prev) => {
        if (prev.some((p) => p.jobId === row.id)) return prev
        const label = formatJobLedgerShortLine(ledgerPrefixMap, row.service_type_id, row.hcp_number, row.job_name).trim()
        return redistributeEqualSplit([...prev, { jobId: row.id, jobLabel: label, mode: 'dollars', valueStr: '', note: '' }], displayTotal)
      })
      setJobSearch('')
      setJobResults([])
    },
    [displayTotal, ledgerPrefixMap],
  )
  const removeLine = useCallback((jobId: string) => {
    setLines((prev) => {
      const next = prev.filter((p) => p.jobId !== jobId)
      return next.length === 0 ? [] : redistributeEqualSplit(next, displayTotal)
    })
  }, [displayTotal])
  const updateLine = useCallback((jobId: string, patch: Partial<Pick<SplitLine, 'mode' | 'valueStr' | 'note'>>) => {
    setLines((prev) => prev.map((p) => (p.jobId === jobId ? { ...p, ...patch } : p)))
  }, [])

  const matchingRules = useMemo(() => {
    if (!transaction) return []
    return matchingAccountingRulesForTx(
      { amount: transaction.amount, counterparty_name: transaction.counterparty_name, raw: transaction.raw },
      rules,
    )
  }, [transaction, rules])

  const reloadRules = useCallback(async () => {
    const ruleRows = await withSupabaseRetry(
      async () => supabase.from('mercury_accounting_label_rules').select('id, name, label_id, enabled, sort_order, criteria'),
      'tx detail rules reload',
    )
    setRules((ruleRows ?? []) as AccountingRuleForMatch[])
  }, [])

  const openEditRule = useCallback(
    (ruleId: string) => {
      const rule = rules.find((r) => r.id === ruleId)
      if (!rule) return
      setRuleModalInitial(ruleRowToForm(rule, labels[0]?.id ?? rule.label_id))
      setEditRuleId(ruleId)
      setRuleModalKey((k) => k + 1)
      setRuleModalOpen(true)
    },
    [rules, labels],
  )

  const handleSaveRule = useCallback(
    async (draft: AccountingRuleSaveDraft) => {
      if (!editRuleId) return
      await withSupabaseRetry(
        async () =>
          supabase
            .from('mercury_accounting_label_rules')
            .update({ name: draft.name, enabled: draft.enabled, label_id: draft.labelId, criteria: draft.criteria as unknown as Json })
            .eq('id', editRuleId),
        'tx detail update rule',
      )
      showToast('Rule updated.', 'success')
      await reloadRules()
      setRuleModalOpen(false)
    },
    [editRuleId, reloadRules, showToast],
  )

  const handleDeleteRule = useCallback(async () => {
    if (!editRuleId) return
    await withSupabaseRetry(
      async () => supabase.from('mercury_accounting_label_rules').delete().eq('id', editRuleId),
      'tx detail delete rule',
    )
    showToast('Rule deleted.', 'success')
    await reloadRules()
    setRuleModalOpen(false)
  }, [editRuleId, reloadRules, showToast])

  const handleSavePersonJobs = useCallback(async () => {
    if (!transaction || !canSaveSplits) return
    setSavingSplits(true)
    try {
      const p_rows = lines.map((ln) => {
        const d = lineDisplayDollars(ln, displayTotal)
        if (d === null) throw new Error('Invalid split line')
        const row: { job_id: string; amount: number; note?: string } = { job_id: ln.jobId, amount: round2(allocationSign * d) }
        const nt = ln.note.trim()
        if (nt !== '') row.note = nt
        return row
      })
      const { userId: p_user_id, personId: p_person_id } = parseBankingAttributionValue(attrValue)
      const payload: ReplaceSplitsCall = {
        p_mercury_transaction_id: transaction.id,
        p_rows: p_rows as unknown as Json,
        p_person_id,
        p_user_id,
      }
      await withSupabaseRetry(
        async () => supabase.rpc('replace_mercury_transaction_splits', payload as unknown as Database['public']['Functions']['replace_mercury_transaction_splits']['Args']),
        'tx detail replace splits',
      )
      if (p_user_id && recentPersonPicksStorageKey) pushRecentPersonUserId(recentPersonPicksStorageKey, p_user_id)
      showToast('Saved person & jobs.', 'success')
      onChanged()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Save failed', 'error')
    } finally {
      setSavingSplits(false)
    }
  }, [transaction, canSaveSplits, lines, displayTotal, allocationSign, attrValue, recentPersonPicksStorageKey, showToast, onChanged])

  const handleSaveLabel = useCallback(
    async (nextLabelId: string) => {
      if (!transaction) return
      setSavingLabel(true)
      try {
        if (nextLabelId === '') {
          await withSupabaseRetry(async () => supabase.from('mercury_transaction_drag_sort_assignments').delete().eq('mercury_transaction_id', transaction.id), 'tx detail clear label')
        } else {
          await withSupabaseRetry(
            async () => supabase.from('mercury_transaction_drag_sort_assignments').upsert({ mercury_transaction_id: transaction.id, label_id: nextLabelId }, { onConflict: 'mercury_transaction_id' }),
            'tx detail set label',
          )
        }
        setCurrentLabelId(nextLabelId)
        showToast(nextLabelId === '' ? 'Label cleared.' : 'Label saved.', 'success')
        onChanged()
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Could not save label', 'error')
      } finally {
        setSavingLabel(false)
      }
    },
    [transaction, showToast, onChanged],
  )

  const handleSaveNote = useCallback(async () => {
    if (!transaction) return
    setSavingNote(true)
    try {
      await withSupabaseRetry(
        async () => supabase.rpc('upsert_mercury_org_transaction_note', { p_mercury_transaction_id: transaction.id, p_body: noteDraft }),
        'tx detail save note',
      )
      setNoteInitial(noteDraft.trim())
      showToast(noteDraft.trim() === '' ? 'Note cleared.' : 'Note saved.', 'success')
      onChanged()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save note', 'error')
    } finally {
      setSavingNote(false)
    }
  }, [transaction, noteDraft, showToast, onChanged])

  if (!open || !transaction) return null

  const cardId = mercuryDebitCardIdFromRaw(transaction.raw)
  const debitDisplay = cardId ? nicknameByDebitCard[cardId] ?? formatMercuryDebitCardIdCompact(cardId) : null
  const accountDisplay = nicknameByAccount[transaction.mercury_account_id] ?? shortUuidPrefix(transaction.mercury_account_id)
  const bankDescription = mercuryBankDescriptionFromRaw(transaction.raw)
  const labelOptions = buildSortedAccountingLabelSelectOptions(labels, {})
  const noteDirty = noteDraft.trim() !== noteInitial.trim()
  const rawText =
    transaction.raw != null
      ? (() => {
          try {
            return JSON.stringify(transaction.raw, null, 2)
          } catch {
            return String(transaction.raw)
          }
        })()
      : '—'

  return (
    <>
    <div
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !savingSplits && !savingLabel && !savingNote) onClose()
      }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex, padding: '1rem', boxSizing: 'border-box' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Transaction detail"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderRadius: 8, width: 'min(680px, 100%)', maxHeight: 'min(90vh, 52rem)', overflowY: 'auto', padding: '1.25rem', boxSizing: 'border-box', boxShadow: '0 24px 48px rgba(0,0,0,0.18)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-strong)' }}>Transaction detail</h2>
          <button type="button" onClick={onClose} style={{ padding: '0.35rem 0.65rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer' }}>Close</button>
        </div>

        {/* Read-only facts */}
        <div style={{ ...sectionStyle, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.65rem' }}>
          <Fact label="Date" value={formatDate(transaction.created_at)} />
          <div>
            <div style={factLabel}>Posted</div>
            <button
              type="button"
              onClick={() => setContextOpen(true)}
              title="See ledger transactions around this date"
              style={{ all: 'unset', cursor: 'pointer', color: 'var(--text-blue-700)', fontWeight: 500, fontSize: '0.875rem', textDecoration: 'underline', textUnderlineOffset: 2 }}
            >
              {formatDate(transaction.posted_at)}
            </button>
          </div>
          <Fact label="Amount" value={formatCurrency(txAmount)} />
          <Fact label="Counterparty" value={transaction.counterparty_name?.trim() || '—'} />
          <Fact label="Kind" value={`${formatMercuryKind(transaction.kind)}${debitDisplay ? ` · ${debitDisplay}` : ''}`} />
          <Fact label="Account" value={accountDisplay} />
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={factLabel}>Bank description</div>
            <div style={{ ...factValue, whiteSpace: 'normal', wordBreak: 'break-word' }}>{bankDescription ?? '—'}</div>
          </div>
        </div>

        {loading ? <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Loading…</div> : null}

        {/* Assigned Person */}
        <div style={sectionStyle}>
          <h3 style={sectionTitleStyle}>Assigned person</h3>
          <SearchableSelect
            value={attrValue}
            onChange={setAttrValue}
            options={attributionOptions}
            emptyOption={{ value: '', label: '— Unassigned —' }}
            placeholder="Assign person…"
            listAriaLabel="Assigned person"
            portalZIndex={zIndex + 60}
          />
        </div>

        {/* Jobs (splits) */}
        <div style={sectionStyle}>
          <h3 style={sectionTitleStyle}>Jobs</h3>
          {internalTransfersLocked ? (
            <div style={{ fontSize: '0.8125rem', color: '#334155', background: 'var(--bg-slate-tint)', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '0.6rem 0.8rem' }}>
              Labeled <strong>Internal Transfers</strong> — cannot be split onto jobs. Change the label to edit jobs.
            </div>
          ) : (
            <>
              <input
                type="text"
                value={jobSearch}
                onChange={(e) => setJobSearch(e.target.value)}
                placeholder="Search jobs (3+ characters)…"
                style={{ width: '100%', padding: '8px 10px', marginBottom: '0.4rem', fontSize: '0.875rem', boxSizing: 'border-box', border: '1px solid var(--border-strong)', borderRadius: 6 }}
              />
              {jobSearch.trim().length > 2 && jobSearchLoading ? <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Searching…</div> : null}
              {jobSearch.trim().length > 2 && jobResults.length > 0 ? (
                <div style={{ maxHeight: 140, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 4, marginBottom: '0.5rem', fontSize: '0.8125rem' }}>
                  {jobResults.map((r) => (
                    <button key={r.id} type="button" onClick={() => addJobLine(r)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.45rem 0.65rem', border: 'none', borderBottom: '1px solid #f3f4f6', background: 'var(--surface)', cursor: 'pointer' }}>
                      <span style={{ fontWeight: 600 }}>{formatJobLedgerShortLine(ledgerPrefixMap, r.service_type_id, r.hcp_number, r.job_name)}</span>
                      <span style={{ color: 'var(--text-muted)' }}> · {r.job_address}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              {lines.map((ln) => {
                const dd = lineDisplayDollars(ln, displayTotal)
                return (
                  <div key={ln.jobId} style={{ marginBottom: '0.5rem', padding: '0.5rem 0.6rem', borderRadius: 8, border: '1px solid #f1f5f9', background: 'var(--bg-page)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ flex: '1 1 130px', minWidth: 0, fontSize: '0.8125rem', fontWeight: 500 }} title={ln.jobLabel}>{ln.jobLabel}</span>
                      <button type="button" onClick={() => updateLine(ln.jobId, { mode: 'dollars' })} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border-strong)', background: ln.mode === 'dollars' ? '#2563eb' : 'var(--surface)', color: ln.mode === 'dollars' ? '#fff' : '#334155', cursor: 'pointer', fontSize: '0.8125rem' }}>$</button>
                      <button type="button" onClick={() => updateLine(ln.jobId, { mode: 'percent' })} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border-strong)', background: ln.mode === 'percent' ? '#2563eb' : 'var(--surface)', color: ln.mode === 'percent' ? '#fff' : '#334155', cursor: 'pointer', fontSize: '0.8125rem' }}>%</button>
                      <input type="text" inputMode="decimal" value={ln.valueStr} onChange={(e) => updateLine(ln.jobId, { valueStr: e.target.value })} placeholder={ln.mode === 'dollars' ? '0.00' : '0'} style={{ width: 90, padding: '6px 10px', fontSize: '0.875rem', border: '1px solid var(--border)', borderRadius: 8, boxSizing: 'border-box', fontVariantNumeric: 'tabular-nums' }} />
                      <button type="button" onClick={() => removeLine(ln.jobId)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #fecdd3', background: '#fff1f2', color: '#e11d48', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600 }}>Remove</button>
                    </div>
                    {ln.mode === 'percent' && displayTotal > 0 && dd !== null && ln.valueStr.trim() !== '' ? (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>≈ {formatCurrency(dd)} of {formatCurrency(displayTotal)}</div>
                    ) : null}
                    <input type="text" value={ln.note} onChange={(e) => updateLine(ln.jobId, { note: e.target.value })} placeholder="Note (optional)" style={{ width: '100%', marginTop: '0.4rem', padding: '6px 10px', fontSize: '0.8125rem', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: 8 }} />
                  </div>
                )
              })}
              {lines.length > 0 ? (
                <div style={{ fontSize: '0.8125rem', marginBottom: '0.5rem', color: displayTotal <= 0 ? '#6b7280' : canSaveSplits ? 'var(--text-green-600)' : 'var(--text-amber-700)' }}>
                  {displayTotal <= 0 ? 'Zero charge — cannot split.' : <>Allocated: {allocationSum.ok ? formatCurrency(allocationSum.sum) : '—'} · Remainder: {allocationSum.ok ? formatCurrency(remainder) : '—'}</>}
                </div>
              ) : null}
            </>
          )}
          <button
            type="button"
            onClick={() => void handleSavePersonJobs()}
            disabled={savingSplits || !canSaveSplits}
            style={{ marginTop: '0.5rem', padding: '0.45rem 1rem', borderRadius: 6, border: '1px solid #1d4ed8', background: savingSplits || !canSaveSplits ? '#93c5fd' : '#2563eb', color: '#fff', cursor: savingSplits || !canSaveSplits ? 'not-allowed' : 'pointer', fontSize: '0.875rem', fontWeight: 600 }}
          >
            {savingSplits ? 'Saving…' : 'Save person & jobs'}
          </button>
        </div>

        {/* Accounting Label */}
        <div style={sectionStyle}>
          <h3 style={sectionTitleStyle}>Accounting label</h3>
          <SearchableSelect
            value={currentLabelId}
            onChange={(v) => void handleSaveLabel(v)}
            options={labelOptions}
            emptyOption={{ value: '', label: '— None —' }}
            placeholder="Set label…"
            listAriaLabel="Accounting label"
            portalZIndex={zIndex + 60}
            disabled={savingLabel}
          />
        </div>

        {/* Applicable rules (read-only) */}
        <div style={sectionStyle}>
          <h3 style={sectionTitleStyle}>Applicable rules</h3>
          {matchingRules.length === 0 ? (
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-faint)' }}>No accounting rules match this transaction.</div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.8125rem', color: 'var(--text-700)' }}>
              {matchingRules.map((r) => (
                <li key={r.id} style={{ marginBottom: '0.2rem' }}>
                  <button
                    type="button"
                    onClick={() => openEditRule(r.id)}
                    title="Edit this rule"
                    style={{ all: 'unset', cursor: 'pointer', color: 'var(--text-blue-700)', fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 2 }}
                  >
                    {r.name}
                  </button>{' '}
                  → {labelById.get(r.labelId)?.name ?? '—'}
                  {r.isFirstMatch ? <span style={{ marginLeft: '0.4rem', fontSize: '0.7rem', color: 'var(--text-link)', fontWeight: 600 }}>(would apply)</span> : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Transaction note */}
        <div style={{ ...sectionStyle, borderBottom: 'none', marginBottom: '0.25rem', paddingBottom: 0 }}>
          <h3 style={sectionTitleStyle}>Transaction note</h3>
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value.slice(0, NOTE_MAX))}
            placeholder="Org-wide note for this transaction…"
            rows={3}
            style={{ width: '100%', padding: '0.5rem 0.65rem', fontSize: '0.875rem', boxSizing: 'border-box', border: '1px solid var(--border-strong)', borderRadius: 6, resize: 'vertical', fontFamily: 'inherit' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem' }}>
            <button type="button" onClick={() => void handleSaveNote()} disabled={savingNote || !noteDirty} style={{ padding: '0.4rem 0.85rem', borderRadius: 6, border: '1px solid #1d4ed8', background: savingNote || !noteDirty ? '#93c5fd' : '#2563eb', color: '#fff', cursor: savingNote || !noteDirty ? 'not-allowed' : 'pointer', fontSize: '0.8125rem', fontWeight: 600 }}>{savingNote ? 'Saving…' : 'Save note'}</button>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>{noteDraft.length}/{NOTE_MAX}</span>
          </div>
        </div>

        {/* Raw (Mercury API) — collapsed, matches the Ledger's raw block */}
        <details style={{ marginTop: '0.75rem' }}>
          <summary style={{ ...sectionTitleStyle, cursor: 'pointer', marginBottom: 0 }}>Raw (Mercury API)</summary>
          <pre
            style={{
              margin: '0.5rem 0 0',
              padding: '0.75rem',
              maxHeight: 'min(50vh, 24rem)',
              overflow: 'auto',
              fontSize: '0.75rem',
              lineHeight: 1.4,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              fontFamily: 'monospace',
              wordBreak: 'break-all',
            }}
          >
            {rawText}
          </pre>
        </details>
      </div>
    </div>
    <TransactionContextModal
      open={contextOpen}
      onClose={() => setContextOpen(false)}
      anchor={transaction}
      nicknameByAccount={nicknameByAccount}
      onOpenTransaction={(txId) => {
        setContextOpen(false)
        onOpenTransaction?.(txId)
      }}
      zIndex={zIndex + 100}
    />
    {ruleModalOpen ? (
      <AccountingRuleFormModal
        key={ruleModalKey}
        editingRuleId={editRuleId}
        initialForm={ruleModalInitial}
        labels={labels}
        labelAssignmentCountById={labelAssignmentCountById}
        onClose={() => setRuleModalOpen(false)}
        onSave={handleSaveRule}
        onDelete={handleDeleteRule}
        zIndex={zIndex + 120}
      />
    ) : null}
    </>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={factLabel}>{label}</div>
      <div style={{ ...factValue, whiteSpace: 'normal', wordBreak: 'break-word' }}>{value}</div>
    </div>
  )
}
