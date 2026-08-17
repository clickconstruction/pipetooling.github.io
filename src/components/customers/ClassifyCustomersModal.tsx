import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { suggestCustomerType } from '../../lib/customers/suggestCustomerType'

/**
 * Classify untyped customers in one sitting (list redesign PR 3): every row
 * arrives pre-selected from the name heuristic (suggestCustomerType); the
 * user flips any before applying. Apply is two batched UPDATEs (one per
 * type) — nothing is written until the button is pressed.
 */

type UntypedCustomer = { id: string; name: string | null }

const UPDATE_CHUNK = 100

export default function ClassifyCustomersModal({
  customers,
  onClose,
  onApplied,
}: {
  customers: UntypedCustomer[]
  onClose: () => void
  onApplied: () => void
}) {
  const { showToast } = useToastContext()
  const [choices, setChoices] = useState<Record<string, 'commercial' | 'residential'>>({})
  const [saving, setSaving] = useState(false)

  const suggestions = useMemo(
    () => new Map(customers.map((c) => [c.id, suggestCustomerType(c.name)])),
    [customers],
  )

  useEffect(() => {
    setChoices(Object.fromEntries(customers.map((c) => [c.id, suggestions.get(c.id)!.suggested])))
  }, [customers, suggestions])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, saving])

  const commercialCount = Object.values(choices).filter((v) => v === 'commercial').length
  const residentialCount = customers.length - commercialCount

  async function apply() {
    setSaving(true)
    try {
      for (const type of ['commercial', 'residential'] as const) {
        const ids = customers.filter((c) => choices[c.id] === type).map((c) => c.id)
        for (let i = 0; i < ids.length; i += UPDATE_CHUNK) {
          const chunk = ids.slice(i, i + UPDATE_CHUNK)
          const { error } = await supabase.from('customers').update({ customer_type: type }).in('id', chunk)
          if (error) throw new Error(error.message)
        }
      }
      showToast(
        `Classified ${customers.length} customer${customers.length === 1 ? '' : 's'} — ${residentialCount} residential, ${commercialCount} commercial.`,
        'success',
      )
      onApplied()
      onClose()
    } catch (e: unknown) {
      showToast(formatErrorMessage(e, 'Could not save customer types'), 'error')
      setSaving(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Classify untyped customers"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
        padding: '1rem',
      }}
      onClick={() => {
        if (!saving) onClose()
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          width: 'min(560px, 100%)',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 700, color: 'var(--text-strong)', fontSize: '0.98rem' }}>
            Classify {customers.length} untyped customer{customers.length === 1 ? '' : 's'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
            Pre-selected from the name — business words suggest Commercial. Flip any that look wrong, then apply once.
          </div>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {customers.map((c) => {
            const suggestion = suggestions.get(c.id)!
            const choice = choices[c.id] ?? suggestion.suggested
            return (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '7px 16px',
                  borderBottom: '1px solid var(--border)',
                  fontSize: '0.85rem',
                }}
              >
                <span style={{ flex: 1, color: 'var(--text-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {(c.name ?? '').trim() || '(unnamed)'}
                </span>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
                  {suggestion.matchedWord ? `"${suggestion.matchedWord}"` : ''}
                </span>
                <span style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
                  {(['residential', 'commercial'] as const).map((t) => {
                    const on = choice === t
                    return (
                      <button
                        key={t}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setChoices((prev) => ({ ...prev, [c.id]: t }))}
                        style={{
                          padding: '2px 10px',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          border: 'none',
                          cursor: 'pointer',
                          background: on
                            ? t === 'commercial'
                              ? 'var(--bg-amber-tint)'
                              : 'var(--bg-blue-tint)'
                            : 'var(--surface)',
                          color: on
                            ? t === 'commercial'
                              ? 'var(--text-amber-800)'
                              : 'var(--text-blue-700)'
                            : 'var(--text-muted)',
                        }}
                      >
                        {t === 'commercial' ? 'Commercial' : 'Residential'}
                      </button>
                    )
                  })}
                </span>
              </div>
            )
          })}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 16px',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-subtle)',
          }}
        >
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {residentialCount} residential · {commercialCount} commercial
          </span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{
                padding: '0.4rem 0.9rem',
                border: '1px solid var(--border-strong)',
                borderRadius: 5,
                background: 'var(--surface)',
                color: 'var(--text-700)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void apply()}
              disabled={saving || customers.length === 0}
              style={{
                padding: '0.4rem 0.9rem',
                border: 'none',
                borderRadius: 5,
                background: '#2563eb',
                color: 'white',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: saving ? 'wait' : 'pointer',
              }}
            >
              {saving ? 'Applying…' : `Apply ${customers.length} type${customers.length === 1 ? '' : 's'}`}
            </button>
          </span>
        </div>
      </div>
    </div>
  )
}
