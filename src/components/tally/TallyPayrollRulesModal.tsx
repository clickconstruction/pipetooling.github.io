import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry, formatErrorMessage } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import {
  matchAccountingLabelRuleCriteria,
  type AccountingLabelRuleCriteriaV1,
} from '../../lib/accountingLabelRuleMatch'
import type { TallyLinkedMercuryRow } from '../../lib/mercuryTxRowFromTally'
import type { TallyPayrollRuleFormSeed } from '../../lib/tallyPayrollRuleSeed'
import type { Json } from '../../types/database'

type RuleRow = { id: string; name: string; criteria: Json; enabled: boolean; sort_order: number }

type FormState = {
  name: string
  amountMin: string
  amountMax: string
  counterpartyOp: 'contains' | 'equals'
  counterpartyValue: string
  bankOp: 'contains' | 'equals'
  bankValue: string
}

const EMPTY_FORM: FormState = {
  name: '',
  amountMin: '',
  amountMax: '',
  counterpartyOp: 'contains',
  counterpartyValue: '',
  bankOp: 'contains',
  bankValue: '',
}

function formToCriteria(form: FormState): AccountingLabelRuleCriteriaV1 {
  const c: AccountingLabelRuleCriteriaV1 = { v: 1 }
  const minT = form.amountMin.trim()
  const maxT = form.amountMax.trim()
  if (minT !== '' || maxT !== '') {
    const amount: { min?: number; max?: number } = {}
    if (minT !== '' && Number.isFinite(Number(minT))) amount.min = Number(minT)
    if (maxT !== '' && Number.isFinite(Number(maxT))) amount.max = Number(maxT)
    if (amount.min !== undefined || amount.max !== undefined) c.amount = amount
  }
  if (form.counterpartyValue.trim() !== '') c.counterparty = { op: form.counterpartyOp, value: form.counterpartyValue.trim() }
  if (form.bankValue.trim() !== '') c.bankDescription = { op: form.bankOp, value: form.bankValue.trim() }
  return c
}

function criteriaSummary(criteria: Json): string {
  const c = criteria as AccountingLabelRuleCriteriaV1 | null
  if (!c || typeof c !== 'object') return '—'
  const parts: string[] = []
  if (c.amount) parts.push(`amount ${c.amount.min ?? '−∞'}…${c.amount.max ?? '∞'}`)
  if (c.counterparty) parts.push(`counterparty ${c.counterparty.op} "${c.counterparty.value}"`)
  if (c.bankDescription) parts.push(`description ${c.bankDescription.op} "${c.bankDescription.value}"`)
  return parts.length ? parts.join(' · ') : '(no criteria)'
}

const inputStyle = {
  padding: '0.35rem 0.5rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 4,
  fontSize: '0.8125rem',
  width: '100%',
  boxSizing: 'border-box' as const,
}

export function TallyPayrollRulesModal({
  open,
  onClose,
  autoApply,
  onToggleAutoApply,
  onApplyNow,
  sampleTransactions,
  initialForm,
  onRuleSaved,
}: {
  open: boolean
  onClose: () => void
  autoApply: boolean
  onToggleAutoApply: (next: boolean) => void
  onApplyNow: () => void | Promise<void>
  sampleTransactions: TallyLinkedMercuryRow[]
  /** Pre-fills the New-rule form when opening ("Create rule…" from a transaction). Parent must hold this in state — an inline object would re-seed on every render and clobber edits. */
  initialForm?: TallyPayrollRuleFormSeed | null
  /** Fired after a rule insert/update succeeds (parent runs an apply pass so the new rule takes effect immediately). */
  onRuleSaved?: () => void
}) {
  const { showToast } = useToastContext()
  const [rules, setRules] = useState<RuleRow[]>([])
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await withSupabaseRetry(
        () => supabase.from('mercury_tally_payroll_rules').select('id, name, criteria, enabled, sort_order').order('sort_order').order('created_at'),
        'load tally payroll rules',
      )
      setRules((data ?? []) as RuleRow[])
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not load payroll rules'), 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  useEffect(() => {
    if (open && initialForm) {
      setEditingId(null)
      setForm({ ...EMPTY_FORM, ...initialForm })
    }
  }, [open, initialForm])

  if (!open) return null

  const criteria = formToCriteria(form)
  const testMatches = sampleTransactions.filter((r) =>
    matchAccountingLabelRuleCriteria({ amount: r.amount, counterparty_name: r.counterparty_name ?? null, raw: r.raw }, criteria),
  )
  const hasCriteria = !!(criteria.amount || criteria.counterparty || criteria.bankDescription)

  const resetForm = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  const saveRule = async () => {
    if (form.name.trim() === '') {
      showToast('Rule name is required', 'error')
      return
    }
    if (!hasCriteria) {
      showToast('Add at least one criterion (counterparty, amount, or description)', 'error')
      return
    }
    setSaving(true)
    try {
      const payload = { name: form.name.trim(), criteria: criteria as unknown as Json, enabled: true }
      if (editingId) {
        await withSupabaseRetry(
          () => supabase.from('mercury_tally_payroll_rules').update(payload).eq('id', editingId),
          'update tally payroll rule',
        )
      } else {
        await withSupabaseRetry(
          () => supabase.from('mercury_tally_payroll_rules').insert(payload),
          'insert tally payroll rule',
        )
      }
      resetForm()
      await load()
      showToast('Rule saved', 'success')
      onRuleSaved?.()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not save rule'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const editRule = (r: RuleRow) => {
    const c = (r.criteria as AccountingLabelRuleCriteriaV1) ?? { v: 1 }
    setEditingId(r.id)
    setForm({
      name: r.name,
      amountMin: c.amount?.min !== undefined ? String(c.amount.min) : '',
      amountMax: c.amount?.max !== undefined ? String(c.amount.max) : '',
      counterpartyOp: c.counterparty?.op ?? 'contains',
      counterpartyValue: c.counterparty?.value ?? '',
      bankOp: c.bankDescription?.op ?? 'contains',
      bankValue: c.bankDescription?.value ?? '',
    })
  }

  const toggleEnabled = async (r: RuleRow) => {
    try {
      await withSupabaseRetry(
        () => supabase.from('mercury_tally_payroll_rules').update({ enabled: !r.enabled }).eq('id', r.id),
        'toggle tally payroll rule',
      )
      await load()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not update rule'), 'error')
    }
  }

  const deleteRule = async (r: RuleRow) => {
    try {
      await withSupabaseRetry(
        () => supabase.from('mercury_tally_payroll_rules').delete().eq('id', r.id),
        'delete tally payroll rule',
      )
      if (editingId === r.id) resetForm()
      await load()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not delete rule'), 'error')
    }
  }

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1100, padding: '2rem 1rem', boxSizing: 'border-box', overflow: 'auto' }}
    >
      <div role="dialog" aria-modal="true" aria-label="Payroll auto-mark rules" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 8, maxWidth: 640, width: '100%', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, flex: 1 }}>Payroll auto-mark rules</h3>
          <button type="button" onClick={onClose} aria-label="Close" style={{ padding: '0.35rem 0.65rem', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Rules auto-mark matching transactions as <strong>payroll</strong> — resolved without any job allocation, so job spend isn't double-counted. A manual mark/unmark always wins; transactions already split to jobs are skipped.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={autoApply} onChange={(e) => onToggleAutoApply(e.target.checked)} />
              Auto-apply on load
            </label>
            <button type="button" onClick={() => void onApplyNow()} style={{ padding: '0.35rem 0.8rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600 }}>
              Apply payroll rules now
            </button>
          </div>

          {/* Rule form */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.85rem' }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.5rem' }}>{editingId ? 'Edit rule' : 'New rule'}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <input style={inputStyle} placeholder="Rule name (e.g. Gusto payroll)" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <select style={{ ...inputStyle, width: 'auto' }} value={form.counterpartyOp} onChange={(e) => setForm((f) => ({ ...f, counterpartyOp: e.target.value as 'contains' | 'equals' }))}>
                  <option value="contains">Counterparty contains</option>
                  <option value="equals">Counterparty equals</option>
                </select>
                <input style={inputStyle} placeholder="e.g. Gusto" value={form.counterpartyValue} onChange={(e) => setForm((f) => ({ ...f, counterpartyValue: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <select style={{ ...inputStyle, width: 'auto' }} value={form.bankOp} onChange={(e) => setForm((f) => ({ ...f, bankOp: e.target.value as 'contains' | 'equals' }))}>
                  <option value="contains">Description contains</option>
                  <option value="equals">Description equals</option>
                </select>
                <input style={inputStyle} placeholder="bank description text (optional)" value={form.bankValue} onChange={(e) => setForm((f) => ({ ...f, bankValue: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Amount</span>
                <input style={inputStyle} placeholder="min" value={form.amountMin} onChange={(e) => setForm((f) => ({ ...f, amountMin: e.target.value }))} />
                <span style={{ color: 'var(--text-faint)' }}>…</span>
                <input style={inputStyle} placeholder="max" value={form.amountMax} onChange={(e) => setForm((f) => ({ ...f, amountMax: e.target.value }))} />
              </div>
              <div style={{ fontSize: '0.75rem', color: hasCriteria ? 'var(--text-green-600)' : 'var(--text-faint)' }}>
                {hasCriteria ? `Test: matches ${testMatches.length} of ${sampleTransactions.length} loaded transactions` : 'Add a criterion to test'}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                {editingId ? (
                  <button type="button" onClick={resetForm} style={{ padding: '0.35rem 0.8rem', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 6, cursor: 'pointer', fontSize: '0.8125rem' }}>Cancel edit</button>
                ) : null}
                <button type="button" onClick={() => void saveRule()} disabled={saving} style={{ padding: '0.35rem 0.8rem', background: saving ? '#93c5fd' : '#2563eb', color: 'white', border: 'none', borderRadius: 6, cursor: saving ? 'default' : 'pointer', fontSize: '0.8125rem', fontWeight: 600 }}>
                  {editingId ? 'Save changes' : 'Add rule'}
                </button>
              </div>
            </div>
          </div>

          {/* Rules list */}
          <div>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.4rem' }}>Rules</div>
            {loading ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Loading…</p>
            ) : rules.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>No rules yet.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {rules.map((r) => (
                  <li key={r.id} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '0.5rem 0.65rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: r.enabled ? 'var(--text-strong)' : 'var(--text-faint)' }}>
                        {r.name}{r.enabled ? '' : ' (disabled)'}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{criteriaSummary(r.criteria)}</div>
                    </div>
                    <button type="button" onClick={() => void toggleEnabled(r)} title={r.enabled ? 'Disable' : 'Enable'} style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}>{r.enabled ? 'Disable' : 'Enable'}</button>
                    <button type="button" onClick={() => editRule(r)} style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}>Edit</button>
                    <button type="button" onClick={() => void deleteRule(r)} style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem', background: 'var(--surface)', border: '1px solid #fecaca', color: 'var(--text-red-700)', borderRadius: 4, cursor: 'pointer' }}>Delete</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
