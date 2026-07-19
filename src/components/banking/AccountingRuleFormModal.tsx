import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { Database } from '../../types/database'
import { useToastContext } from '../../contexts/ToastContext'
import { SearchableSelect } from '../SearchableSelect'
import { buildSortedAccountingLabelSelectOptions } from '../../lib/accountingLabelSelectOptions'
import {
  type AccountingLabelRuleCriteriaV1,
  accountingRuleEffectiveClauseCount,
  defaultAccountingLabelRuleCriteriaV1,
  parseAccountingLabelRuleCriteria,
} from '../../lib/accountingLabelRuleMatch'
import type { Json } from '../../types/database'
import { PayStubDeleteIcon } from '../pay/PayStubDeleteIcon'

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

/** Derives default rule name from counterparty criterion (`"{trimmed} -"`). Empty input yields empty name. */
export function suggestedRuleNameFromCounterparty(value: string): string {
  const t = value.trim()
  if (t === '') return ''
  const base = `${t} -`
  return base.length <= RULE_NAME_MAX ? base : base.slice(0, RULE_NAME_MAX)
}

function stripTrailingLabelSuffix(name: string, labelDisplayName: string): string {
  const t = labelDisplayName.trim()
  if (t === '') return name
  const suffix = ` ${t}`
  if (name.endsWith(suffix)) return name.slice(0, name.length - suffix.length).trimEnd()
  return name
}

function appendLabelSuffixToRuleName(name: string, labelDisplayName: string): string {
  const t = labelDisplayName.trim()
  if (t === '') return name.trimEnd()
  return `${name.trimEnd()} ${t}`.slice(0, RULE_NAME_MAX)
}

function ruleNameWithLabelSuffix(baseName: string, labelId: string, labels: DragLabelRow[]): string {
  const L = labels.find((x) => x.id === labelId)
  const ln = L?.name?.trim()
  if (!ln) return baseName.trimEnd()
  return appendLabelSuffixToRuleName(baseName, ln)
}

/** Convert a stored rule row into editable form state. Shared by the Accounting rules
 * manager and the Transaction Detail "edit applicable rule" flow. */
export function ruleRowToForm(
  rule: { name: string; enabled: boolean; label_id: string; criteria: Json },
  fallbackLabelId: string,
): AccountingRuleFormState {
  const parsed = parseAccountingLabelRuleCriteria(rule.criteria) ?? defaultAccountingLabelRuleCriteriaV1()
  const base = emptyRuleForm()
  base.name = rule.name
  base.enabled = rule.enabled
  base.labelId = rule.label_id || fallbackLabelId
  if (parsed.amount?.min !== undefined) base.amountMin = String(parsed.amount.min)
  if (parsed.amount?.max !== undefined) base.amountMax = String(parsed.amount.max)
  if (parsed.counterparty) {
    base.counterpartyOp = parsed.counterparty.op
    base.counterpartyValue = parsed.counterparty.value
  }
  if (parsed.bankDescription) {
    base.bankOp = parsed.bankDescription.op
    base.bankValue = parsed.bankDescription.value
  }
  return base
}

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
  /** Count of mercury_transaction_drag_sort_assignments per label (missing ids treated as 0 for sort). */
  labelAssignmentCountById: Record<string, number>
  labelsLoading?: boolean
  onClose: () => void
  /** When set, shows a "Test" button; omit to hide it (e.g. opened from Transaction Detail). */
  onRunTest?: (criteria: AccountingLabelRuleCriteriaV1) => void
  onSave: (draft: AccountingRuleSaveDraft) => Promise<void>
  /** When set, shows Save and apply (persist + run apply-rules scan). */
  onSaveAndApply?: (draft: AccountingRuleSaveDraft) => Promise<void>
  /** Disables actions while parent apply-rules is running (toolbar). */
  applyRulesBusy?: boolean
  /** When set and `editingRuleId !== null`, renders a trash icon in the header that opens a nested confirm modal. */
  onDelete?: () => Promise<void>
  /** Overlay z-index (default 1200); raise when opened above another modal. */
  zIndex?: number
}

export function AccountingRuleFormModal({
  editingRuleId,
  initialForm,
  labels,
  labelAssignmentCountById,
  labelsLoading = false,
  onClose,
  onRunTest,
  onSave,
  onSaveAndApply,
  applyRulesBusy = false,
  onDelete,
  zIndex = 1200,
}: AccountingRuleFormModalProps) {
  const { showToast } = useToastContext()
  const accountingLabelFieldId = useId()
  const [form, setForm] = useState<AccountingRuleFormState>(() => initialForm)
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false)
  const [submitBusy, setSubmitBusy] = useState(false)
  const [saveActionKind, setSaveActionKind] = useState<'save' | 'saveApply' | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const labelSuffixSeededRef = useRef(false)

  const controlsDisabled = submitBusy || applyRulesBusy || deleting

  const sortedLabelSelectOptions = useMemo(
    () => buildSortedAccountingLabelSelectOptions(labels, labelAssignmentCountById),
    [labels, labelAssignmentCountById],
  )

  // Escape closes the modal, but never while a save/apply/delete is running —
  // tearing it down mid-operation would leave the write in flight and fire
  // callbacks against an unmounted modal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !controlsDisabled) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [controlsDisabled, onClose])

  useEffect(() => {
    if (editingRuleId === null) {
      setNameManuallyEdited(false)
      labelSuffixSeededRef.current = false
    }
  }, [editingRuleId])

  useEffect(() => {
    if (editingRuleId !== null || labelSuffixSeededRef.current) return
    if (labels.length === 0 || !form.labelId || !form.name.trim()) return
    const L = labels.find((x) => x.id === form.labelId)
    const ln = L?.name?.trim()
    if (!ln) return
    const base = form.name.trimEnd()
    if (base.endsWith(` ${ln}`)) {
      labelSuffixSeededRef.current = true
      return
    }
    labelSuffixSeededRef.current = true
    setForm((f) => ({
      ...f,
      name: appendLabelSuffixToRuleName(f.name, ln),
    }))
  }, [editingRuleId, form.labelId, form.name, labels])

  const handleTest = () => {
    if (controlsDisabled || !onRunTest) return
    const c = formToCriteria(form)
    if (accountingRuleEffectiveClauseCount(c) === 0) {
      showToast('Add at least one criterion to test.', 'error')
      return
    }
    onRunTest(c)
  }

  const buildValidatedDraft = (): AccountingRuleSaveDraft | null => {
    const name = form.name.trim()
    if (name.length === 0) {
      showToast('Enter a rule name.', 'error')
      return null
    }
    if (name.length > RULE_NAME_MAX) {
      showToast(`Rule name must be at most ${RULE_NAME_MAX} characters.`, 'error')
      return null
    }
    if (!form.labelId) {
      showToast('Choose an Accounting Label.', 'error')
      return null
    }
    const c = formToCriteria(form)
    if (accountingRuleEffectiveClauseCount(c) === 0) {
      showToast('Add at least one criterion (amount, counterparty, or bank description).', 'error')
      return null
    }
    return { name, enabled: form.enabled, labelId: form.labelId, criteria: c }
  }

  const handleSave = async () => {
    if (controlsDisabled) return
    const draft = buildValidatedDraft()
    if (!draft) return
    setSaveActionKind('save')
    setSubmitBusy(true)
    try {
      await onSave(draft)
    } finally {
      setSubmitBusy(false)
      setSaveActionKind(null)
    }
  }

  const handleSaveAndApply = async () => {
    if (!onSaveAndApply || controlsDisabled) return
    const draft = buildValidatedDraft()
    if (!draft) return
    setSaveActionKind('saveApply')
    setSubmitBusy(true)
    try {
      await onSaveAndApply(draft)
    } finally {
      setSubmitBusy(false)
      setSaveActionKind(null)
    }
  }

  const handleConfirmDelete = async () => {
    if (!onDelete || deleting) return
    setDeleting(true)
    try {
      await onDelete()
      // Parent typically closes the modal on success, but defensively close
      // the nested confirm too in case the parent leaves it open.
      setDeleteConfirmOpen(false)
    } catch {
      // deleteRuleCore re-throws after toasting; keep the confirm open so the
      // user can retry without re-opening it.
    } finally {
      setDeleting(false)
    }
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
        zIndex,
        padding: '1rem',
        boxSizing: 'border-box',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !controlsDisabled) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          maxWidth: 520,
          width: '100%',
          padding: '1.25rem',
          boxShadow: '0 20px 40px rgba(0,0,0,0.12)',
          border: '1px solid var(--border)',
          boxSizing: 'border-box',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            marginBottom: '1rem',
          }}
        >
          <h3 style={{ margin: 0 }}>{editingRuleId ? 'Edit rule' : 'New rule'}</h3>
          {editingRuleId !== null && onDelete ? (
            <button
              type="button"
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={controlsDisabled}
              title="Delete rule"
              aria-label="Delete rule"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                padding: 0,
                background: 'transparent',
                border: 'none',
                borderRadius: 6,
                cursor: controlsDisabled ? 'not-allowed' : 'pointer',
                color: controlsDisabled ? 'var(--text-faint)' : 'var(--text-red-700)',
              }}
            >
              <PayStubDeleteIcon color="currentColor" size={18} />
            </button>
          ) : null}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.875rem' }}>
            Name
            <input
              value={form.name}
              onChange={(e) => {
                setNameManuallyEdited(true)
                setForm((f) => ({ ...f, name: e.target.value }))
              }}
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
            <span>Accounting Label</span>
            <SearchableSelect
              id={accountingLabelFieldId}
              value={form.labelId}
              onChange={(nextId) => {
                if (editingRuleId !== null) {
                  setForm((f) => ({ ...f, labelId: nextId }))
                  return
                }
                const prevLabel = labels.find((L) => L.id === form.labelId)
                const nextLabel = labels.find((L) => L.id === nextId)
                let n = form.name
                const prevNm = prevLabel?.name?.trim()
                if (prevNm) n = stripTrailingLabelSuffix(n, prevNm)
                const nextNm = nextLabel?.name?.trim()
                n = nextNm ? appendLabelSuffixToRuleName(n, nextNm) : n.trimEnd()
                setForm((f) => ({ ...f, labelId: nextId, name: n }))
              }}
              options={sortedLabelSelectOptions}
              emptyOption={{ value: '', label: ' - select label - ' }}
              hideEmptyOptionInListWhenUnset
              searchReplacesTrigger
              listMaxHeightPx={320}
              listOptionPadding="0.35rem 0.5rem"
              listOptionFontSize="0.8125rem"
              disabled={labelsLoading || labels.length === 0}
              listAriaLabel="Accounting labels"
              portalZIndex={1250}
            />
          </label>
          <fieldset style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.75rem' }}>
            <legend style={{ fontSize: '0.85rem', fontWeight: 600 }}>Amount (USD)</legend>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
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
            </div>
          </fieldset>
          <fieldset style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.75rem' }}>
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
                onChange={(e) => {
                  const next = e.target.value
                  setForm((f) => {
                    if (editingRuleId !== null || nameManuallyEdited) {
                      return { ...f, counterpartyValue: next }
                    }
                    const base = suggestedRuleNameFromCounterparty(next)
                    return {
                      ...f,
                      counterpartyValue: next,
                      name: ruleNameWithLabelSuffix(base, f.labelId, labels),
                    }
                  })
                }}
                placeholder="text"
                style={{ flex: '1 1 12rem', padding: '0.4rem 0.55rem' }}
              />
            </div>
          </fieldset>
          <fieldset style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.75rem' }}>
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
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '0.5rem',
              justifyContent: 'space-between',
            }}
          >
            {onRunTest ? (
              <button
                type="button"
                onClick={handleTest}
                disabled={controlsDisabled}
                style={{
                  padding: '0.45rem 0.85rem',
                  fontWeight: 600,
                  background: controlsDisabled ? 'var(--bg-200)' : 'var(--bg-slate-100)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  cursor: controlsDisabled ? 'not-allowed' : 'pointer',
                  color: controlsDisabled ? 'var(--text-slate-500)' : 'var(--text-slate-900)',
                }}
              >
                Test
              </button>
            ) : (
              <span />
            )}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5rem',
                marginLeft: 'auto',
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="button"
                onClick={onClose}
                disabled={controlsDisabled}
                style={{
                  padding: '0.45rem 0.85rem',
                  fontWeight: 600,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  cursor: controlsDisabled ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={controlsDisabled}
                style={{
                  padding: '0.45rem 0.85rem',
                  fontWeight: 600,
                  background: controlsDisabled ? 'var(--bg-200)' : 'var(--surface)',
                  color: controlsDisabled ? 'var(--text-slate-500)' : 'var(--text-slate-900)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  cursor: controlsDisabled ? 'not-allowed' : 'pointer',
                }}
              >
                {saveActionKind === 'save' ? 'Saving…' : 'Save'}
              </button>
              {onSaveAndApply ? (
                <button
                  type="button"
                  onClick={() => void handleSaveAndApply()}
                  disabled={controlsDisabled}
                  style={{
                    padding: '0.45rem 0.85rem',
                    fontWeight: 600,
                    background: controlsDisabled ? '#94a3b8' : '#2563eb',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    cursor: controlsDisabled ? 'not-allowed' : 'pointer',
                  }}
                >
                  {saveActionKind === 'saveApply'
                    ? applyRulesBusy
                      ? 'Applying…'
                      : 'Saving…'
                    : 'Save and apply'}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      {deleteConfirmOpen ? (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: zIndex + 1,
            padding: '1rem',
            boxSizing: 'border-box',
          }}
          onMouseDown={(e) => {
            if (deleting) return
            if (e.target === e.currentTarget) setDeleteConfirmOpen(false)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="rule-form-delete-confirm-title"
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              background: 'var(--surface)',
              padding: '1.5rem',
              borderRadius: 8,
              minWidth: 360,
              maxWidth: 480,
              width: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.18)',
              border: '1px solid var(--border)',
              boxSizing: 'border-box',
            }}
          >
            <h2
              id="rule-form-delete-confirm-title"
              style={{ margin: '0 0 0.75rem', fontSize: '1.125rem', fontWeight: 600 }}
            >
              Delete rule?
            </h2>
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem' }}>
              <strong>{form.name.trim() || '—'}</strong>
            </p>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              Pending suggestions tied to this rule will be removed. This cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => {
                  if (!deleting) setDeleteConfirmOpen(false)
                }}
                disabled={deleting}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'var(--surface)',
                  color: 'var(--text-strong)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDelete()}
                disabled={deleting}
                style={{
                  padding: '0.5rem 1rem',
                  background: deleting ? '#9ca3af' : '#b91c1c',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                }}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
