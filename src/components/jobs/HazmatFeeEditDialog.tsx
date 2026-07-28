import { useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import AutoGrowTextarea from '../AutoGrowTextarea'
import { updateHazmatFeeIncident } from '../../lib/hazmatFeeEdit'
import type { JobHazmatIncidentRow } from '../../lib/hazmatIncidents'
import type { HazmatTestimonial } from '../../lib/hazmatFee'

/**
 * Edit a hazmat fee from the ① Line Items rider row (v2.1038): amount,
 * description, photo links, and testimonials. The terms snapshot stays frozen
 * (it is the contractual evidence). An amount change also moves the Job Total
 * and the linked open bill by the difference — the server does all three
 * atomically. Leaf dialog above Edit Job (z 1300, ConfirmDialog layer).
 */
export function HazmatFeeEditDialog({
  incident,
  onClose,
  onSaved,
}: {
  incident: JobHazmatIncidentRow
  onClose: () => void
  onSaved: () => void
}) {
  const { showToast } = useToastContext()
  const [amountStr, setAmountStr] = useState(String(Number(incident.fee_amount) || ''))
  const [description, setDescription] = useState(incident.description ?? '')
  const [photoLinksText, setPhotoLinksText] = useState(
    (Array.isArray(incident.photo_links) ? (incident.photo_links as string[]) : []).join('\n'),
  )
  const [testimonials, setTestimonials] = useState<HazmatTestimonial[]>(() =>
    (Array.isArray(incident.testimonials) ? (incident.testimonials as unknown[]) : []).map((t) => {
      const row = t as { name?: string; user_id?: string | null; statement?: string; given_at?: string }
      return {
        name: row.name ?? '',
        userId: row.user_id ?? null,
        statement: row.statement ?? '',
        givenAt: row.given_at ?? new Date().toISOString(),
      }
    }),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    const amount = Number(amountStr)
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) {
      setError('Amount must be between $0.01 and $100,000')
      return
    }
    const photoLinks = photoLinksText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    if (photoLinks.length === 0) {
      setError('At least one photo link is required')
      return
    }
    const cleanTestimonials = testimonials
      .map((t) => ({ ...t, name: t.name.trim(), statement: t.statement.trim() }))
      .filter((t) => t.name.length > 0 && t.statement.length > 0)
    if (cleanTestimonials.length === 0) {
      setError('At least one technician testimonial (name + statement) is required')
      return
    }
    if (!description.trim()) {
      setError('Describe the incident')
      return
    }
    setSaving(true)
    setError(null)
    const res = await updateHazmatFeeIncident(incident.id, {
      fee_amount: Math.round(amount * 100) / 100,
      description: description.trim(),
      photo_links: photoLinks,
      testimonials: cleanTestimonials,
    })
    setSaving(false)
    if (!res.ok) {
      setError(res.error ?? 'Could not save the changes')
      return
    }
    showToast('Hazmat fee updated.', 'success')
    onSaved()
    onClose()
  }

  const fieldLabel = { display: 'block', marginBottom: 4, fontWeight: 600, fontSize: '0.8125rem' } as const
  const inputStyle = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '0.45rem 0.6rem',
    border: '1px solid var(--border-strong)',
    borderRadius: 4,
    fontSize: '0.875rem',
    background: 'var(--surface)',
    color: 'inherit',
  } as const

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Edit hazmat fee"
      onClick={() => (saving ? null : onClose())}
      style={{ position: 'fixed', inset: 0, zIndex: 1300, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', boxSizing: 'border-box' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderRadius: 8, padding: '1.25rem', width: 'min(560px, 100%)', maxHeight: '88vh', overflowY: 'auto', boxSizing: 'border-box', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
      >
        <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.0625rem' }}>☣ Edit hazmat fee</h3>
        <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Changing the amount also moves the Job Total and the linked open bill by the difference. The
          terms clause snapshot stays frozen. The notice will show an edited-on date.
        </p>

        <div style={{ marginBottom: '0.85rem' }}>
          <label style={fieldLabel} htmlFor="hazmat-edit-amount">Fee amount ($)</label>
          <input
            id="hazmat-edit-amount"
            type="number"
            min={0.01}
            step={0.01}
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: '0.85rem' }}>
          <label style={fieldLabel} htmlFor="hazmat-edit-desc">Incident description</label>
          <AutoGrowTextarea
            id="hazmat-edit-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: '0.85rem' }}>
          <label style={fieldLabel} htmlFor="hazmat-edit-photos">Photo links (one per line)</label>
          <AutoGrowTextarea
            id="hazmat-edit-photos"
            value={photoLinksText}
            onChange={(e) => setPhotoLinksText(e.target.value)}
            rows={2}
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: '0.85rem' }}>
          <div style={{ ...fieldLabel, marginBottom: 6 }}>Technician testimonials</div>
          {testimonials.map((t, i) => (
            <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '0.6rem', marginBottom: '0.5rem' }}>
              <input
                type="text"
                value={t.name}
                placeholder="Technician name"
                onChange={(e) => setTestimonials((prev) => prev.map((row, j) => (j === i ? { ...row, name: e.target.value } : row)))}
                style={{ ...inputStyle, marginBottom: '0.4rem' }}
              />
              <AutoGrowTextarea
                value={t.statement}
                placeholder="Statement in the tech's own words"
                onChange={(e) => setTestimonials((prev) => prev.map((row, j) => (j === i ? { ...row, statement: e.target.value } : row)))}
                rows={2}
                style={inputStyle}
              />
              {testimonials.length > 1 && (
                <button
                  type="button"
                  onClick={() => setTestimonials((prev) => prev.filter((_, j) => j !== i))}
                  style={{ marginTop: '0.35rem', padding: '0.2rem 0.6rem', fontSize: '0.75rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-red-700)', cursor: 'pointer' }}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setTestimonials((prev) => [...prev, { name: '', userId: null, statement: '', givenAt: new Date().toISOString() }])}
            style={{ padding: '0.25rem 0.7rem', fontSize: '0.8125rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer' }}
          >
            + Add testimonial
          </button>
        </div>

        {error && <p style={{ color: 'var(--text-red-700)', fontSize: '0.875rem', margin: '0 0 0.75rem' }}>{error}</p>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            style={{ padding: '0.5rem 1rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 4, cursor: saving ? 'wait' : 'pointer' }}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
