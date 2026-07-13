import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'

export type PersonOffsetKind = 'backcharge' | 'damage' | 'employee_credit'

export type PersonOffsetInitialDraft = {
  personName: string
  type: PersonOffsetKind
  amount: string
  description: string
  occurredDate: string
}

export type PersonOffsetEditingRow = {
  id: string
  person_name: string
  type: string
  amount: number
  description: string | null
  occurred_date: string
}

export type PersonOffsetFormModalProps = {
  open: boolean
  onClose: () => void
  /** Default 10; use ~1150 above Stale tally follow-up (1140). */
  zIndex?: number
  /** When set, form is in edit mode */
  editingOffset: PersonOffsetEditingRow | null
  /** When `editingOffset` is null, optional prefill for create (e.g. Dashboard Backcharge). */
  initialCreateDraft?: PersonOffsetInitialDraft | null
  personNameOptions: string[]
  onSaved: () => void
  onError?: (message: string) => void
}

function defaultOccurredDateYmd(): string {
  return new Date().toLocaleDateString('en-CA')
}

export function PersonOffsetFormModal({
  open,
  onClose,
  zIndex = 10,
  editingOffset,
  initialCreateDraft = null,
  personNameOptions,
  onSaved,
  onError,
}: PersonOffsetFormModalProps) {
  const [personName, setPersonName] = useState('')
  const [offsetType, setOffsetType] = useState<PersonOffsetKind>('backcharge')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [occurredDate, setOccurredDate] = useState(defaultOccurredDateYmd)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (editingOffset) {
      setPersonName(editingOffset.person_name)
      setOffsetType(
        editingOffset.type === 'damage'
          ? 'damage'
          : editingOffset.type === 'employee_credit'
            ? 'employee_credit'
            : 'backcharge',
      )
      setAmount(editingOffset.amount?.toString() ?? '')
      setDescription(editingOffset.description ?? '')
      setOccurredDate(editingOffset.occurred_date)
      return
    }
    const d = initialCreateDraft
    if (d) {
      setPersonName(d.personName)
      setOffsetType(d.type)
      setAmount(d.amount)
      setDescription(d.description)
      setOccurredDate(d.occurredDate)
      return
    }
    setPersonName('')
    setOffsetType('backcharge')
    setAmount('')
    setDescription('')
    setOccurredDate(defaultOccurredDateYmd())
  }, [open, editingOffset, initialCreateDraft])

  const handleClose = useCallback(() => {
    if (saving) return
    onClose()
  }, [onClose, saving])

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        handleClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, handleClose])

  async function handleSave() {
    const amt = parseFloat(amount)
    if (Number.isNaN(amt) || amt <= 0) {
      onError?.('Amount must be a positive number')
      return
    }
    if (!personName.trim()) {
      onError?.('Select a person')
      return
    }
    setSaving(true)
    try {
      if (editingOffset) {
        await withSupabaseRetry(
          async () =>
            supabase
              .from('person_offsets')
              .update({
                person_name: personName.trim(),
                type: offsetType,
                amount: amt,
                description: description.trim() || null,
                occurred_date: occurredDate,
              })
              .eq('id', editingOffset.id),
          'update person offset',
        )
      } else {
        await withSupabaseRetry(
          async () =>
            supabase.from('person_offsets').insert({
              person_name: personName.trim(),
              type: offsetType,
              amount: amt,
              description: description.trim() || null,
              occurred_date: occurredDate,
            }),
          'insert person offset',
        )
      }
      onSaved()
      onClose()
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const title = editingOffset ? 'Edit offset' : 'Add offset'

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
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="person-offset-form-title"
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}
      >
        <h2 id="person-offset-form-title" style={{ marginTop: 0 }}>
          {title}
        </h2>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: 4 }}>Person *</label>
          <select
            value={personName}
            onChange={(e) => setPersonName(e.target.value)}
            style={{ width: '100%', padding: '0.5rem' }}
          >
            <option value="">— Select —</option>
            {personNameOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: 4 }}>Type *</label>
          <select
            value={offsetType}
            onChange={(e) => setOffsetType(e.target.value as PersonOffsetKind)}
            style={{ width: '100%', padding: '0.5rem' }}
          >
            <option value="backcharge">Backcharge</option>
            <option value="damage">Damage</option>
            <option value="employee_credit">Employee credit (overpayment / advance)</option>
          </select>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: 4 }}>Amount ($) *</label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: 4 }}>Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional"
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: 4 }}>Occurred date *</label>
          <input
            type="date"
            value={occurredDate}
            onChange={(e) => setOccurredDate(e.target.value)}
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" disabled={saving} onClick={() => void handleSave()} style={{ padding: '0.5rem 1rem' }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button type="button" disabled={saving} onClick={handleClose} style={{ padding: '0.5rem 1rem' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
