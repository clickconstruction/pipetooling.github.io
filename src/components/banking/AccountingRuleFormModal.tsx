import { useState } from 'react'
import type { Database } from '../../types/database'
import { useToastContext } from '../../contexts/ToastContext'
import {
  type AccountingLabelRuleCriteriaV1,
  accountingRuleEffectiveClauseCount,
} from '../../lib/accountingLabelRuleMatch'

type DragLabelRow = Database['public']['Tables']['mercury_drag_sort_labels']['Row']

export type AccountingRuleFormState = {
  name: string
  enabled: boolean
  labelId: string
  amountMin: string
  amountMax: string
  counterpartyOp: 'contains' | 'equals'
  counterpartyValue: string
  bankOp: 'contains' | 'equals'
  bankValue: string
}

export const RULE_NAME_MAX = 200

export function emptyRuleForm(): AccountingRuleFormState {
  return {
    name: '',
    enabled: true,
    labelId: '',
    amountMin: '',
    amountMax: '',
    counterpartyOp: 'contains',
    counterpartyValue: '',
    bankOp: 'contains',
    bankValue: '',
  }
}

function formToCriteria(form: AccountingRuleFormState): AccountingLabelRuleCriteriaV1 {
  const c: AccountingLabelRuleCriteriaV1 = { v: 1 }
  const minT = form.amountMin.trim()
  const maxT = form.amountMax.trim()
  if (minT !== '' || maxT !== '') {
    c.amount = {}
    if (minT !== '') {
      const n = Number(minT)
      if (Number.isFinite(n)) c.amount.min = n
    }
    if (maxT !== '') {
      const n = Number(maxT)
      if (Number.isFinite(n)) c.amount.max = n
    }
    if (c.amount.min === undefined && c.amount.max === undefined) delete c.amount
    else if (Object.keys(c.amount).length === 0) delete c.amount
  }
  if (form.counterpartyValue.trim() !== '') {
    c.counterparty = { op: form.counterpartyOp, value: form.counterpartyValue }
  }
  if (form.bankValue.trim() !== '') {
    c.bankDescription = { op: form.bankOp, value: form.bankValue }
  }
  return c
}

export type AccountingRuleSaveDraft = {
  name: string
  enabled: boolean
  labelId: string
  criteria: AccountingLabelRuleCriteriaV1
}

export type AccountingRuleFormModalProps = {
  editingRuleId: string | null
  initialForm: AccountingRuleFormState
  labels: DragLabelRow[]
  onClose: () => void
  onRunTest: (criteria: AccountingLabelRuleCriteriaV1) => void
  onSave: (draft: AccountingRuleSaveDraft) => Promise<void>
}

export function AccountingRuleFormModal({
  editingRuleId,
  initialForm,
  labels,
  onClose,
  onRunTest,
  onSave,
}: AccountingRuleFormModalProps) {
  const { showToast } = useToastContext()
  const [form, setForm] = useState<AccountingRuleFormState>(() => initialForm)

  const handleTest = () => {
    const c = formToCriteria(form)
    if (accountingRuleEffectiveClauseCount(c) === 0) {
      showToast('Add at least one criterion to test.', 'error')
      return
    }
    onRunTest(c)
  }

  const handleSave = async () => {
    const name = form.name.trim()
    if (name.length === 0) {
      showToast('Enter a rule name.', 'error')
      return
    }
    if (name.length > RULE_NAME_MAX) {
      showToast(`Rule name must be at most ${RULE_NAME_MAX} characters.`, 'error')
      return
    }
    if (!form.labelId) {
      showToast('Choose an Accounting Label.', 'error')
      return
    }
    const c = formToCriteria(form)
    if (accountingRuleEffectiveClauseCount(c) === 0) {
      showToast('Add at least one criterion (amount, counterparty, or bank description).', 'error')
      return
    }
    await onSave({ name, enabled: form.enabled, labelId: form.labelId, criteria: c })
  }

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1200,
        padding: '1rem',
        boxSizing: 'border-box',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: 8,
          maxWidth: 520,
          width: '100%',
          padding: '1.25rem',
          boxShadow: '0 20px 40px rgba(0,0,0,0.12)',
          border: '1px solid #e5e7eb',
          boxSizing: 'border-box',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <h3 style={{ margin: '0 0 1rem' }}>{editingRuleId ? 'Edit rule' : 'New rule'}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.875rem' }}>
            Name
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              maxLength={RULE_NAME_MAX}
              style={{ padding: '0.4rem 0.55rem' }}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem' }}>
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
            />
            Enabled
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.875rem' }}>
            Accounting Label
            <select
              value={form.labelId}
              onChange={(e) => setForm((f) => ({ ...f, labelId: e.target.value }))}
              style={{ padding: '0.4rem 0.55rem' }}
            >
              {labels.map((L) => (
                <option key={L.id} value={L.id}>
                  {L.name}
                </option>
              ))}
            </select>
          </label>
          <fieldset style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.75rem' }}>
            <legend style={{ fontSize: '0.85rem', fontWeight: 600 }}>Amount (USD)</legend>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <label style={{ flex: '1 1 6rem', fontSize: '0.8rem' }}>
                Min
                <input
                  type="number"
                  step="any"
                  value={form.amountMin}
                  onChange={(e) => setForm((f) => ({ ...f, amountMin: e.target.value }))}
                  style={{ width: '100%', marginTop: 4 }}
                />
              </label>
              <label style={{ flex: '1 1 6rem', fontSize: '0.8rem' }}>
                Max
                <input
                  type="number"
                  step="any"
                  value={form.amountMax}
                  onChange={(e) => setForm((f) => ({ ...f, amountMax: e.target.value }))}
                  style={{ width: '100%', marginTop: 4 }}
                />
              </label>
            </div>
          </fieldset>
          <fieldset style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.75rem' }}>
            <legend style={{ fontSize: '0.85rem', fontWeight: 600 }}>Counterparty name</legend>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <select
                value={form.counterpartyOp}
                onChange={(e) =>
                  setForm((f) => ({ ...f, counterpartyOp: e.target.value as 'contains' | 'equals' }))
                }
                style={{ padding: '0.35rem' }}
              >
                <option value="contains">contains</option>
                <option value="equals">equals</option>
              </select>
              <input
                value={form.counterpartyValue}
                onChange={(e) => setForm((f) => ({ ...f, counterpartyValue: e.target.value }))}
                placeholder="text"
                style={{ flex: '1 1 12rem', padding: '0.4rem 0.55rem' }}
              />
            </div>
          </fieldset>
          <fieldset style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.75rem' }}>
            <legend style={{ fontSize: '0.85rem', fontWeight: 600 }}>Bank description</legend>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <select
                value={form.bankOp}
                onChange={(e) => setForm((f) => ({ ...f, bankOp: e.target.value as 'contains' | 'equals' }))}
                style={{ padding: '0.35rem' }}
              >
                <option value="contains">contains</option>
                <option value="equals">equals</option>
              </select>
              <input
                value={form.bankValue}
                onChange={(e) => setForm((f) => ({ ...f, bankValue: e.target.value }))}
                placeholder="text"
                style={{ flex: '1 1 12rem', padding: '0.4rem 0.55rem' }}
              />
            </div>
          </fieldset>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={handleTest}
              style={{
                padding: '0.45rem 0.85rem',
                fontWeight: 600,
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Test
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              style={{
                padding: '0.45rem 0.85rem',
                fontWeight: 600,
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Save
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.45rem 0.85rem',
                fontWeight: 600,
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
