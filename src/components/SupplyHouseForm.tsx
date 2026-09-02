import { useState } from 'react'

import { SupplyHouseContactsSection } from './SupplyHouseContactsSection'
import type { Database } from '../types/database'
import { useNarrowViewport640 } from '../hooks/useNarrowViewport640'
import { isUrlLikelyMapsOrDirectionsPortal, normalizeSupplyHouseWebsiteUrlForStorage } from '../lib/supplyHouseWebsite'

type SupplyHouse = Database['public']['Tables']['supply_houses']['Row']
type UserRole = 'dev' | 'master_technician' | 'assistant' | 'estimator' | 'primary' | 'superintendent'

export interface SupplyHouseFormData {
  name: string
  contact_name: string
  phone: string
  email: string
  address: string
  website_url: string | null
  notes: string
  monthly_payment_day: number | null
}

interface SupplyHouseFormProps {
  editingSupplyHouse: SupplyHouse | null
  name: string
  contactName: string
  phone: string
  email: string
  address: string
  websiteUrl: string
  notes: string
  monthlyPaymentDay: string
  onChange: (field: keyof SupplyHouseFormData, value: string) => void
  onSubmit: (data: SupplyHouseFormData) => Promise<void>
  onClose: () => void
  onDelete?: () => void
  saving: boolean
  myRole: UserRole | null
  variant?: 'modal' | 'inline'
}

const fieldStyles = { width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 } as const

function FieldRow({ label, narrow, alignTop, children }: { label: string; narrow: boolean; alignTop?: boolean; children: React.ReactNode }) {
  if (narrow) {
    return (
      <div>
        <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>{label}</label>
        {children}
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', alignItems: alignTop ? 'flex-start' : 'center', gap: '0.75rem' }}>
      <label style={{ width: 160, flexShrink: 0, fontWeight: 500, fontSize: '0.875rem', textAlign: 'right', paddingTop: alignTop ? '0.45rem' : 0 }}>{label}</label>
      <div style={{ flexGrow: 1, minWidth: 0 }}>{children}</div>
    </div>
  )
}

export function SupplyHouseForm({
  editingSupplyHouse,
  name,
  contactName,
  phone,
  email,
  address,
  websiteUrl,
  notes,
  monthlyPaymentDay,
  onChange,
  onSubmit,
  onClose,
  onDelete,
  saving,
  myRole,
  variant = 'modal',
}: SupplyHouseFormProps) {
  const [websiteUrlError, setWebsiteUrlError] = useState<string | null>(null)
  const narrow = useNarrowViewport640()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const dayStr = monthlyPaymentDay.trim()
    let day: number | null = null
    if (dayStr) {
      const n = parseInt(dayStr, 10)
      if (isNaN(n) || n < 1 || n > 31) return
      day = n
    }
    const normalizedWebsite = normalizeSupplyHouseWebsiteUrlForStorage(websiteUrl)
    if (normalizedWebsite && isUrlLikelyMapsOrDirectionsPortal(normalizedWebsite)) {
      setWebsiteUrlError("Use the supplier's order or account website, not a Google Maps link. Put the counter address in Address above.")
      return
    }
    setWebsiteUrlError(null)
    await onSubmit({
      name: name.trim(),
      contact_name: contactName.trim() || '',
      phone: phone.trim() || '',
      email: email.trim() || '',
      address: address.trim() || '',
      website_url: normalizedWebsite,
      notes: notes.trim() || '',
      monthly_payment_day: day,
    })
  }

  const formContent = (
    <form onSubmit={handleSubmit} style={variant === 'inline' ? { marginBottom: '1.5rem', padding: '1rem', background: 'var(--bg-subtle)', borderRadius: 4 } : undefined}>
      <h3 style={{ margin: variant === 'inline' ? 0 : undefined, marginBottom: '1rem' }}>{editingSupplyHouse ? 'Edit Supply House' : 'Add Supply House'}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginBottom: '1rem' }}>
        <FieldRow label="Name *" narrow={narrow}>
          <input
            type="text"
            value={name}
            onChange={(e) => onChange('name', e.target.value)}
            required
            style={fieldStyles}
          />
        </FieldRow>
        <FieldRow label="Contact Name" narrow={narrow}>
          <input type="text" value={contactName} onChange={(e) => onChange('contact_name', e.target.value)} style={fieldStyles} />
        </FieldRow>
        <FieldRow label="Phone" narrow={narrow}>
          <input type="tel" value={phone} onChange={(e) => onChange('phone', e.target.value)} style={fieldStyles} />
        </FieldRow>
        <FieldRow label="Email" narrow={narrow}>
          <input type="email" value={email} onChange={(e) => onChange('email', e.target.value)} style={fieldStyles} />
        </FieldRow>
        <FieldRow label="Address" narrow={narrow} alignTop>
          <textarea value={address} onChange={(e) => onChange('address', e.target.value)} rows={2} style={fieldStyles} />
        </FieldRow>
        <FieldRow label="Website / order portal" narrow={narrow}>
          <input
            type="url"
            value={websiteUrl}
            onChange={(e) => {
              setWebsiteUrlError(null)
              onChange('website_url', e.target.value)
            }}
            placeholder="https://…"
            style={fieldStyles}
          />
          {websiteUrlError ? (
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>{websiteUrlError}</p>
          ) : null}
        </FieldRow>
        <FieldRow label="Monthly payment date" narrow={narrow}>
          <input
            type="number"
            min={1}
            max={31}
            placeholder="Day of month (1–31)"
            value={monthlyPaymentDay}
            onChange={(e) => onChange('monthly_payment_day', e.target.value)}
            style={narrow ? fieldStyles : { ...fieldStyles, width: 180 }}
          />
        </FieldRow>
        <FieldRow label="Notes" narrow={narrow} alignTop>
          <textarea value={notes} onChange={(e) => onChange('notes', e.target.value)} rows={2} style={fieldStyles} />
        </FieldRow>
        {editingSupplyHouse ? <SupplyHouseContactsSection supplyHouseId={editingSupplyHouse.id} /> : null}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
        {editingSupplyHouse && myRole === 'dev' && onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            style={{ padding: '0.5rem 1rem', background: 'var(--bg-red-100)', color: 'var(--text-red-800)', border: '1px solid var(--border-red)', borderRadius: 4, cursor: 'pointer' }}
          >
            Delete
          </button>
        ) : (
          <span />
        )}
        <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
          <button
            type="submit"
            disabled={saving}
            style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            {saving ? 'Saving...' : editingSupplyHouse ? 'Update' : 'Add'}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  )

  if (variant === 'modal') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
        <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, maxWidth: narrow ? 480 : 560, width: '90%', maxHeight: 'min(90vh, 100%)', overflow: 'auto' }}>
          {formContent}
        </div>
      </div>
    )
  }

  return formContent
}
