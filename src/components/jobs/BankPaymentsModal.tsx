import { useCallback, useEffect, useMemo, useState } from 'react'
import { BankingSortingConfigModal } from '../BankingSortingConfigModal'
import type { BankingSortingConfigV1 } from '../../lib/bankingSortingConfig'
import {
  BANKING_SORTING_CONFIG_VERSION,
  loadBankingSortingConfig,
  saveBankingSortingConfig,
} from '../../lib/bankingSortingConfig'
import { formatMercuryKind } from '../../lib/mercuryKindLabels'
import { mercuryDebitCardIdFromRaw } from '../../lib/mercuryRawDebitCard'
import { supabase } from '../../lib/supabase'
import { bankPaymentTargetsFromStageRows, type StageRow } from '../../lib/jobsStagesBoard'
import { denverCalendarDayKey } from '../../utils/dateUtils'
import { withSupabaseRetry } from '../../utils/errorHandling'
import type { Database } from '../../types/database'

type MercuryCandidate =
  Database['public']['Functions']['list_mercury_transactions_for_bank_payments']['Returns'][number]

const PAYMENT_TYPES = ['ACH', 'Wire', 'Check', 'Cash', 'Card (external)', 'Other'] as const

function formatMoney(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function canRoleApplyBankPayments(role: string | null): boolean {
  return role === 'dev' || role === 'master_technician' || role === 'assistant' || role === 'primary'
}

export type BankPaymentsModalProps = {
  open: boolean
  onClose: () => void
  authUserId: string | undefined
  authRole: string | null
  billedRows: StageRow[]
  onApplied: () => void | Promise<void>
}

type AllocLine = { id: string; targetKey: string; amountStr: string }

export default function BankPaymentsModal({
  open,
  onClose,
  authUserId,
  authRole,
  billedRows,
  onApplied,
}: BankPaymentsModalProps) {
  const [sortingConfig, setSortingConfig] = useState<BankingSortingConfigV1>(() =>
    loadBankingSortingConfig(authUserId),
  )
  const [devFilterOpen, setDevFilterOpen] = useState(false)
  const [sortingConfigModalOpen, setSortingConfigModalOpen] = useState(false)
  const [kindChoices, setKindChoices] = useState<string[]>([])
  const [accountChoices, setAccountChoices] = useState<string[]>([])
  const [debitCardChoices, setDebitCardChoices] = useState<string[]>([])

  const [candidates, setCandidates] = useState<MercuryCandidate[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState<string | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [allocLines, setAllocLines] = useState<AllocLine[]>([])
  const [paidOnYmd, setPaidOnYmd] = useState(() => denverCalendarDayKey(Date.now()))
  const [paymentType, setPaymentType] = useState<(typeof PAYMENT_TYPES)[number]>('ACH')
  const [internalNote, setInternalNote] = useState('')
  const [applyError, setApplyError] = useState<string | null>(null)
  const [applySubmitting, setApplySubmitting] = useState(false)

  const targets = useMemo(() => bankPaymentTargetsFromStageRows(billedRows), [billedRows])
  const targetByKey = useMemo(() => new Map(targets.map((t) => [t.key, t] as const)), [targets])

  const selected = useMemo(
    () => (selectedId ? candidates.find((c) => c.mercury_transaction_id === selectedId) ?? null : null),
    [candidates, selectedId],
  )

  const canApply = canRoleApplyBankPayments(authRole)

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
  }, [open, sortingConfig])

  useEffect(() => {
    if (!open) return
    setSortingConfig(loadBankingSortingConfig(authUserId))
  }, [open, authUserId])

  useEffect(() => {
    if (!open) return
    void refreshList()
  }, [open, refreshList])

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
      const amt = Number(line.amountStr)
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

  async function submitApply() {
    if (!selected || !canApply) return
    setApplySubmitting(true)
    setApplyError(null)
    const allocations: Array<{ invoice_id?: string; job_id?: string; amount: number }> = []
    for (const line of allocLines) {
      const t = line.targetKey ? targetByKey.get(line.targetKey) : undefined
      if (!t) continue
      const amt = Number(line.amountStr)
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
            p_paid_on: paidOnYmd,
            p_payment_type: paymentType,
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
      aria-labelledby="bank-payments-modal-title"
    >
      <div
        style={{
          background: 'white',
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
            borderBottom: '1px solid #e5e7eb',
          }}
        >
          <h2 id="bank-payments-modal-title" style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>
            Bank Payments
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'none',
              background: '#f3f4f6',
              borderRadius: 6,
              padding: '0.35rem 0.65rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Close
          </button>
        </div>

        <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid #f3f4f6', fontSize: '0.8125rem', color: '#6b7280' }}>
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
          <div style={{ padding: '0.5rem 1.25rem', background: '#fafafa', borderBottom: '1px solid #e5e7eb' }}>
            <button
              type="button"
              onClick={() => setDevFilterOpen((v) => !v)}
              style={{
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: '#2563eb',
                fontSize: '0.8125rem',
                fontWeight: 500,
                padding: '0.25rem 0',
              }}
            >
              {devFilterOpen ? '\u25BC' : '\u25B6'} Dev: Mercury filter (Banking Sorting)
            </button>
            {devFilterOpen && (
              <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8125rem', color: '#4b5563' }}>
                  Start date {sortingConfig.startDateYmd}; kinds {sortingConfig.kinds.length || 'all'}; accounts{' '}
                  {sortingConfig.accountIds.length || 'all'}; debit cards {sortingConfig.debitCardIds.length || 'any'}.
                </span>
                <button
                  type="button"
                  onClick={() => setSortingConfigModalOpen(true)}
                  style={{
                    padding: '0.35rem 0.65rem',
                    borderRadius: 4,
                    border: '1px solid #d1d5db',
                    background: 'white',
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
          <div style={{ padding: '0.5rem 1.25rem', background: '#fffbeb', fontSize: '0.8125rem', color: '#92400e' }}>
            Your role cannot record job payments. Bank Payments apply is limited to dev, master, assistant, and primary (same as
            Mark Paid).
          </div>
        )}

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <div
            style={{
              width: '42%',
              minWidth: 260,
              borderRight: '1px solid #e5e7eb',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
            }}
          >
            <div style={{ padding: '0.5rem 0.75rem', fontWeight: 600, fontSize: '0.8125rem', color: '#374151' }}>
              Bank transactions
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              {listLoading && <p style={{ padding: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>Loading…</p>}
              {listError && (
                <p style={{ padding: '1rem', fontSize: '0.875rem', color: '#b91c1c' }}>{listError}</p>
              )}
              {!listLoading && !listError && candidates.length === 0 && (
                <p style={{ padding: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>No matching transactions.</p>
              )}
              {candidates.map((c) => {
                const active = c.mercury_transaction_id === selectedId
                const posted = c.posted_at
                  ? new Date(c.posted_at).toLocaleDateString('en-US', { timeZone: 'America/Chicago' })
                  : '—'
                return (
                  <button
                    key={c.mercury_transaction_id}
                    type="button"
                    onClick={() => setSelectedId(c.mercury_transaction_id)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.6rem 0.75rem',
                      border: 'none',
                      borderBottom: '1px solid #f3f4f6',
                      background: active ? '#eff6ff' : 'white',
                      cursor: 'pointer',
                      fontSize: '0.8125rem',
                    }}
                  >
                    <div style={{ fontWeight: 600, color: '#111827' }}>{formatMoney(Math.abs(Number(c.amount)))}</div>
                    <div style={{ color: '#6b7280', marginTop: 2 }}>{c.counterparty_name?.trim() || '—'}</div>
                    <div style={{ color: '#9ca3af', marginTop: 2, fontSize: '0.75rem' }}>
                      {posted} · {formatMercuryKind(c.kind)} · rem. {formatMoney(Number(c.remaining_available))}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
            <div style={{ flex: 1, overflow: 'auto', padding: '1rem 1.25rem' }}>
              {!selected ? (
                <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Select a bank transaction.</p>
              ) : (
                <>
                  <div
                    style={{
                      marginBottom: '1rem',
                      padding: '0.75rem',
                      background: '#f9fafb',
                      borderRadius: 6,
                      fontSize: '0.875rem',
                    }}
                  >
                    <div>
                      <strong>Amount:</strong> {formatMoney(Math.abs(Number(selected.amount)))} ·{' '}
                      <strong>Remaining to allocate:</strong> {formatMoney(Number(selected.remaining_available))}
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

                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.25rem' }}>
                    Effective date
                  </label>
                  <input
                    type="date"
                    value={paidOnYmd}
                    onChange={(e) => setPaidOnYmd(e.target.value)}
                    disabled={!canApply}
                    style={{ width: '100%', maxWidth: 200, padding: '0.35rem', marginBottom: '0.75rem', boxSizing: 'border-box' }}
                  />

                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.25rem' }}>
                    Payment type
                  </label>
                  <select
                    value={paymentType}
                    onChange={(e) => setPaymentType(e.target.value as (typeof PAYMENT_TYPES)[number])}
                    disabled={!canApply}
                    style={{ width: '100%', maxWidth: 280, padding: '0.35rem', marginBottom: '0.75rem' }}
                  >
                    {PAYMENT_TYPES.map((pt) => (
                      <option key={pt} value={pt}>
                        {pt}
                      </option>
                    ))}
                  </select>

                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.25rem' }}>
                    Internal note (optional)
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

                  <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.5rem' }}>Allocations</div>
                  {targets.length === 0 ? (
                    <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>No eligible billed lines (non-Stripe with balance).</p>
                  ) : (
                    allocLines.map((line) => (
                      <div
                        key={line.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 120px auto',
                          gap: '0.5rem',
                          alignItems: 'center',
                          marginBottom: '0.5rem',
                        }}
                      >
                        <select
                          value={line.targetKey}
                          onChange={(e) => {
                            const v = e.target.value
                            setAllocLines((rows) =>
                              rows.map((r) => (r.id === line.id ? { ...r, targetKey: v } : r)),
                            )
                          }}
                          disabled={!canApply}
                          style={{ padding: '0.35rem', minWidth: 0 }}
                        >
                          <option value="">— Select billed line —</option>
                          {targets.map((t) => (
                            <option key={t.key} value={t.key}>
                              {t.label} (max {formatMoney(t.remaining)})
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="Amount"
                          value={line.amountStr}
                          onChange={(e) => {
                            const v = e.target.value
                            setAllocLines((rows) => rows.map((r) => (r.id === line.id ? { ...r, amountStr: v } : r)))
                          }}
                          disabled={!canApply}
                          style={{ padding: '0.35rem' }}
                        />
                        <button
                          type="button"
                          disabled={!canApply || allocLines.length <= 1}
                          onClick={() => setAllocLines((rows) => rows.filter((r) => r.id !== line.id))}
                          style={{
                            border: 'none',
                            background: 'none',
                            color: '#b91c1c',
                            cursor: allocLines.length <= 1 ? 'not-allowed' : 'pointer',
                            fontSize: '0.8125rem',
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ))
                  )}

                  {targets.length > 0 && canApply && (
                    <button
                      type="button"
                      onClick={() =>
                        setAllocLines((rows) => [...rows, { id: crypto.randomUUID(), targetKey: '', amountStr: '' }])
                      }
                      style={{
                        marginTop: '0.25rem',
                        padding: '0.35rem 0.65rem',
                        fontSize: '0.8125rem',
                        border: '1px solid #d1d5db',
                        borderRadius: 4,
                        background: 'white',
                        cursor: 'pointer',
                      }}
                    >
                      Add allocation
                    </button>
                  )}

                  {validationMessage && (
                    <p style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: '#b45309' }}>{validationMessage}</p>
                  )}
                  {applyError && (
                    <p style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: '#b91c1c' }}>{applyError}</p>
                  )}
                </>
              )}
            </div>

            <div
              style={{
                padding: '0.75rem 1.25rem',
                borderTop: '1px solid #e5e7eb',
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
                  border: '1px solid #d1d5db',
                  background: 'white',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canApply || !selected || applySubmitting || !!validationMessage || targets.length === 0}
                onClick={() => void submitApply()}
                style={{
                  padding: '0.45rem 0.9rem',
                  borderRadius: 4,
                  border: 'none',
                  background:
                    !canApply || !selected || applySubmitting || !!validationMessage || targets.length === 0
                      ? '#d1d5db'
                      : '#2563eb',
                  color: 'white',
                  cursor:
                    !canApply || !selected || applySubmitting || !!validationMessage || targets.length === 0
                      ? 'not-allowed'
                      : 'pointer',
                  fontWeight: 600,
                }}
              >
                {applySubmitting ? 'Applying…' : 'Apply'}
              </button>
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
        nicknameByAccount={{}}
        debitCardChoices={debitCardChoices}
        nicknameByDebitCard={{}}
        onSave={(cfg) => {
          saveBankingSortingConfig(authUserId, cfg)
          setSortingConfig(cfg)
          setSortingConfigModalOpen(false)
          void refreshList()
        }}
      />
    </div>
  )
}
