import { useEffect, useState } from 'react'

import { supabase } from '../lib/supabase'
import { SupplyHouseContactsSection } from './SupplyHouseContactsSection'
import type { Database } from '../types/database'
import { useNarrowViewport640 } from '../hooks/useNarrowViewport640'
import { isUrlLikelyMapsOrDirectionsPortal, normalizeSupplyHouseWebsiteUrlForStorage } from '../lib/supplyHouseWebsite'
import { VENDOR_KINDS, VENDOR_KIND_HINTS, isInsurerFor, vendorKindLabel, vendorKindOf, type VendorKind } from '../lib/materials/vendorKind'
import type { TradeType } from '../lib/materials/supplyHouseTrades'

type SupplyHouse = Database['public']['Tables']['supply_houses']['Row']
type UserRole = 'dev' | 'master_technician' | 'assistant' | 'estimator' | 'primary' | 'superintendent'

export interface SupplyHouseFormData {
  name: string
  /** The counter / main number. Who to email lives on the reps (supply_house_contacts), never on the house (v2.3170). */
  phone: string
  address: string
  website_url: string | null
  notes: string
  monthly_payment_day: number | null
  /** v2.3172: what kind of vendor this is; only `supply_house` is quoted from or shown to estimators. */
  vendor_kind: VendorKind
  /** Derived from `vendor_kind` (the DB trigger does the same) — kept for pre-push clients' pickers. */
  is_insurer: boolean
  /** v2.3173: trades this house serves (service_type ids). Empty = everyone. */
  service_type_ids: string[]
}

interface SupplyHouseFormProps {
  editingSupplyHouse: SupplyHouse | null
  name: string
  phone: string
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
  phone,
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
  // Owned here (not by the hosts' string-field onChange): the hosts only need it at submit.
  // Reads vendor_kind once pushed, the legacy is_insurer flag before that.
  const [vendorKind, setVendorKind] = useState<VendorKind>(editingSupplyHouse ? vendorKindOf(editingSupplyHouse as { vendor_kind?: string | null; is_insurer?: boolean | null }) : 'supply_house')
  // Estimators never reclassify a vendor: the row is hidden for them and stays what it was (or supply_house for a new one).
  const canPickKind = myRole !== 'estimator'
  // Trades served (v2.3173): the chips load the trade list and the house's links; the table may not exist before its push.
  const [tradeTypes, setTradeTypes] = useState<TradeType[]>([])
  const [tradeIds, setTradeIds] = useState<Set<string>>(new Set())
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data: types } = await supabase.from('service_types').select('id, name').order('sequence_order', { ascending: true })
      if (cancelled) return
      setTradeTypes(((types ?? []) as TradeType[]))
      if (!editingSupplyHouse) return
      const { data: links } = await supabase
        .from('supply_house_service_types' as never)
        .select('service_type_id')
        .eq('supply_house_id', editingSupplyHouse.id)
      if (cancelled) return
      setTradeIds(new Set(((links ?? []) as Array<{ service_type_id: string }>).map((l) => l.service_type_id)))
    })()
    return () => {
      cancelled = true
    }
  }, [editingSupplyHouse])
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
      phone: phone.trim() || '',
      address: address.trim() || '',
      website_url: normalizedWebsite,
      notes: notes.trim() || '',
      monthly_payment_day: day,
      vendor_kind: vendorKind,
      is_insurer: isInsurerFor(vendorKind),
      service_type_ids: tradeTypes.filter((t) => tradeIds.has(t.id)).map((t) => t.id),
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
        <FieldRow label="Main phone" narrow={narrow}>
          <input type="tel" value={phone} onChange={(e) => onChange('phone', e.target.value)} placeholder="the counter" style={fieldStyles} />
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
        {tradeTypes.length > 0 ? (
          <FieldRow label="Trades served" narrow={narrow} alignTop>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {tradeTypes.map((t) => {
                const on = tradeIds.has(t.id)
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setTradeIds((prev) => { const next = new Set(prev); if (next.has(t.id)) next.delete(t.id); else next.add(t.id); return next })}
                    style={{
                      padding: '0.3rem 0.7rem',
                      borderRadius: 999,
                      border: `1px solid ${on ? '#3b82f6' : 'var(--border-strong)'}`,
                      background: on ? 'var(--bg-blue-tint)' : 'var(--surface)',
                      color: on ? 'var(--text-blue-700)' : 'var(--text-700)',
                      fontWeight: on ? 600 : 400,
                      fontSize: '0.8125rem',
                      cursor: 'pointer',
                      font: 'inherit',
                    }}
                  >
                    {t.name}
                  </button>
                )
              })}
            </div>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Estimators restricted to a trade only see houses that serve it. Leave all off to show it to everyone.
            </p>
          </FieldRow>
        ) : null}
        {canPickKind ? (
          <FieldRow label="Kind" narrow={narrow} alignTop>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {VENDOR_KINDS.map((k) => {
                const on = k === vendorKind
                return (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setVendorKind(k)}
                    style={{
                      padding: '0.3rem 0.7rem',
                      borderRadius: 999,
                      border: `1px solid ${on ? '#3b82f6' : 'var(--border-strong)'}`,
                      background: on ? 'var(--bg-blue-tint)' : 'var(--surface)',
                      color: on ? 'var(--text-blue-700)' : 'var(--text-700)',
                      fontWeight: on ? 600 : 400,
                      fontSize: '0.8125rem',
                      cursor: 'pointer',
                      font: 'inherit',
                    }}
                  >
                    {vendorKindLabel(k)}
                  </button>
                )
              })}
            </div>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{VENDOR_KIND_HINTS[vendorKind]}</p>
          </FieldRow>
        ) : null}
        {editingSupplyHouse ? (
          <SupplyHouseContactsSection supplyHouseId={editingSupplyHouse.id} showAddedBy />
        ) : (
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: '0.7rem' }}>
            Save the house, then add its reps — who price requests go to.
          </p>
        )}
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
