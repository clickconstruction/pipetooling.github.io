import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { ACCOUNT_TYPE_OPTIONS, type AccountType, isAccountType } from '../../lib/bankingAccountTypes'

/** Minimal category (mercury_drag_sort_labels) shape the modal edits. */
export type CategoryDetailLabel = {
  id: string
  name: string
  account_type: string | null
  schedule_c_line: string | null
  description: string | null
  is_system_default: boolean
}

export type CategoryDetailModalProps = {
  open: boolean
  label: CategoryDetailLabel | null
  onClose: () => void
  /** Called after a successful save so the opener can reload labels. */
  onSaved: () => void
}

export function CategoryDetailModal({ open, label, onClose, onSaved }: CategoryDetailModalProps) {
  const { showToast } = useToastContext()
  const [name, setName] = useState('')
  const [accountType, setAccountType] = useState<AccountType | ''>('')
  const [scheduleC, setScheduleC] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !label) return
    setName(label.name ?? '')
    setAccountType(isAccountType(label.account_type) ? label.account_type : '')
    setScheduleC(label.schedule_c_line ?? '')
    setNotes(label.description ?? '')
    setSaving(false)
  }, [open, label])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, saving, onClose])

  if (!open || !label) return null

  const trimmedName = name.trim()
  const canSave = !saving && trimmedName !== ''

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      await withSupabaseRetry(
        async () =>
          supabase
            .from('mercury_drag_sort_labels')
            .update({
              name: trimmedName,
              account_type: accountType === '' ? null : accountType,
              schedule_c_line: scheduleC.trim() || null,
              description: notes.trim() || null,
            })
            .eq('id', label.id),
        'save category detail',
      )
      showToast('Category saved.', 'success')
      onSaved()
      onClose()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save category', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose()
      }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1280, padding: '1rem', boxSizing: 'border-box' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-detail-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 10, maxWidth: 480, width: '100%', maxHeight: 'min(90vh, 640px)', overflow: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.15)', padding: '1.25rem', boxSizing: 'border-box' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <h2 id="category-detail-modal-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
            Category detail
          </h2>
          {label.is_system_default ? (
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#475569', background: '#f1f5f9', borderRadius: 999, padding: '2px 8px' }}>Built-in</span>
          ) : null}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.8rem', fontWeight: 600 }}>
            Name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              disabled={saving}
              style={{ padding: '0.4rem 0.55rem', borderRadius: 6, border: '1px solid #e5e7eb', fontWeight: 400 }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.8rem', fontWeight: 600 }}>
            Account type
            <select
              value={accountType}
              onChange={(e) => setAccountType(e.target.value === '' ? '' : (e.target.value as AccountType))}
              disabled={saving}
              style={{ padding: '0.4rem 0.55rem', borderRadius: 6, border: '1px solid #e5e7eb', fontWeight: 400, background: 'white' }}
            >
              <option value="">Unclassified</option>
              {ACCOUNT_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label} — {o.hint}
                </option>
              ))}
            </select>
            <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 400 }}>
              Income/Expense drive the P&L; Asset/Liability/Equity drive the Balance Sheet; Transfer is excluded from both.
            </span>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.8rem', fontWeight: 600 }}>
            Schedule C line (optional)
            <input
              type="text"
              value={scheduleC}
              onChange={(e) => setScheduleC(e.target.value)}
              maxLength={32}
              disabled={saving}
              placeholder="e.g. 8"
              style={{ padding: '0.4rem 0.55rem', borderRadius: 6, border: '1px solid #e5e7eb', fontWeight: 400 }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.8rem', fontWeight: 600 }}>
            Notes (optional)
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={2000}
              disabled={saving}
              placeholder="What belongs in this category…"
              style={{ padding: '0.4rem 0.55rem', borderRadius: 6, border: '1px solid #e5e7eb', fontWeight: 400, resize: 'vertical' }}
            />
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
          <button
            type="button"
            onClick={() => !saving && onClose()}
            disabled={saving}
            style={{ padding: '0.5rem 1rem', background: 'white', color: '#111827', border: '1px solid #e5e7eb', borderRadius: 6, cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 500 }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!canSave}
            style={{ padding: '0.5rem 1rem', background: canSave ? '#2563eb' : '#94a3b8', color: 'white', border: 'none', borderRadius: 6, cursor: canSave ? 'pointer' : 'not-allowed', fontWeight: 600 }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
