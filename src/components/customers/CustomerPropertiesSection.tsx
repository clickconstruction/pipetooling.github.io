import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { customerAddressLienGaps, type CustomerAddressRow } from '../../lib/jobs/lienProperty'
import { jobCountsByProperty, suggestPropertiesFromJobs, type JobAddressLike } from '../../lib/customers/customerPropertiesFromJobs'
import CustomerPropertySheet from './CustomerPropertySheet'
import { emptyPropertyDraft, type PropertyDraft } from '../../lib/customers/propertyDraft'

/**
 * Properties on Edit customer (customer properties train, PR 3 — v2.3009):
 * every address the customer owns in one list — the ★ primary first — each
 * row answering the three office questions (which county, is it lien-ready,
 * how many jobs sit there), plus job addresses not yet saved as properties
 * offered as one-click adds. Edit / Add opens the property sheet inline.
 * Every change persists on its own (`customer_addresses`), independent of
 * the form's Save; the primary row mirrors `customers.address` by trigger
 * (v2.3008).
 */

type Props = {
  customerId: string
  /** The primary row's address changed (starred, edited, removed) — the form mirrors it for merge previews. */
  onPrimaryAddressChange?: (address: string) => void
}

type JobRow = JobAddressLike

const smallBtn: CSSProperties = { padding: '0.2rem 0.55rem', fontSize: '0.75rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }
const linkBtn: CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', padding: '0 0.2rem', fontSize: '0.8125rem', color: 'var(--text-link)', fontWeight: 600 }
const chip = (extra: CSSProperties): CSSProperties => ({ fontSize: '0.6875rem', fontWeight: 600, borderRadius: 6, padding: '0.05rem 0.45rem', border: '1px solid var(--border)', color: 'var(--text-muted)', background: 'var(--surface)', whiteSpace: 'nowrap', ...extra })

function draftFromRow(a: CustomerAddressRow): PropertyDraft {
  return {
    address: a.address,
    note: a.note ?? '',
    county: a.county ?? '',
    county_source: a.county_source ?? '',
    legal_description: a.legal_description ?? '',
    property_kind: a.property_kind ?? '',
    homestead: a.homestead ?? false,
    owner_mode: a.owner_mode ?? '',
    owner_name: a.owner_name ?? '',
    owner_company: a.owner_company ?? '',
    owner_mailing_address: a.owner_mailing_address ?? '',
    parcel_id: a.parcel_id ?? '',
    parcel_source: a.parcel_source ?? '',
    parcel_tax_year: a.parcel_tax_year ?? '',
    parcel_looked_up_at: a.parcel_looked_up_at ?? '',
  }
}

function payloadFromDraft(d: PropertyDraft) {
  return {
    address: d.address.trim(),
    note: d.note.trim() || null,
    county: d.county.trim(),
    county_source: d.county.trim() ? d.county_source : '',
    legal_description: d.legal_description.trim(),
    property_kind: d.property_kind,
    homestead: d.homestead,
    owner_mode: d.owner_mode,
    owner_name: d.owner_name.trim(),
    owner_company: d.owner_company.trim(),
    owner_mailing_address: d.owner_mailing_address.trim(),
    parcel_id: d.parcel_id.trim(),
    parcel_source: d.parcel_source.trim(),
    parcel_tax_year: d.parcel_tax_year.trim(),
    parcel_looked_up_at: d.parcel_looked_up_at.trim() || null,
    updated_at: new Date().toISOString(),
  }
}

export default function CustomerPropertiesSection({ customerId, onPrimaryAddressChange }: Props) {
  const { showToast } = useToastContext()
  const [rows, setRows] = useState<CustomerAddressRow[]>([])
  const [jobs, setJobs] = useState<JobRow[]>([])
  const [loaded, setLoaded] = useState(false)
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [draft, setDraft] = useState<PropertyDraft>(() => emptyPropertyDraft())
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const [addr, jl] = await Promise.all([
      supabase.from('customer_addresses').select('*').eq('customer_id', customerId).order('sequence_order', { ascending: true }).order('created_at', { ascending: true }),
      supabase.from('jobs_ledger').select('id, job_address, customer_address_id').eq('customer_id', customerId).order('created_at', { ascending: false }),
    ])
    const list = ((addr.data ?? []) as CustomerAddressRow[]).slice()
    // Primary first (v2.3008); `is_primary` reads soft until the column is pushed.
    list.sort((x, y) => Number(Boolean(y.is_primary)) - Number(Boolean(x.is_primary)))
    setRows(list)
    setJobs((jl.data ?? []) as JobRow[])
    setLoaded(true)
  }, [customerId])
  useEffect(() => {
    void load()
  }, [load])

  const jobCounts = useMemo(() => jobCountsByProperty(rows, jobs), [rows, jobs])
  const suggestions = useMemo(() => suggestPropertiesFromJobs(rows, jobs), [rows, jobs])

  function openNew(address = '') {
    setEditingId('new')
    setDraft(emptyPropertyDraft(address))
  }
  function openEdit(a: CustomerAddressRow) {
    setEditingId(a.id)
    setDraft(draftFromRow(a))
  }
  function close() {
    setEditingId(null)
    setDraft(emptyPropertyDraft())
  }

  async function saveDraft() {
    if (busy || !draft.address.trim()) return
    setBusy(true)
    const payload = payloadFromDraft(draft)
    let error: { message: string } | null = null
    if (editingId === 'new') {
      const isFirst = rows.length === 0
      const res = await supabase.from('customer_addresses').insert({ customer_id: customerId, ...payload, sequence_order: rows.length, ...(isFirst ? { is_primary: true } : {}) })
      error = res.error
      if (!error && isFirst) onPrimaryAddressChange?.(payload.address)
    } else if (editingId) {
      const res = await supabase.from('customer_addresses').update(payload).eq('id', editingId)
      error = res.error
      const row = rows.find((r) => r.id === editingId)
      if (!error && row?.is_primary) onPrimaryAddressChange?.(payload.address)
    }
    setBusy(false)
    if (error) {
      showToast(`Could not save the property: ${error.message}`, 'error')
      return
    }
    close()
    await load()
  }

  async function setPrimary(a: CustomerAddressRow) {
    if (busy || a.is_primary) return
    setBusy(true)
    const { error } = await supabase.from('customer_addresses').update({ is_primary: true, updated_at: new Date().toISOString() }).eq('id', a.id)
    setBusy(false)
    if (error) {
      showToast(`Could not set the primary property: ${error.message}`, 'error')
      return
    }
    onPrimaryAddressChange?.(a.address)
    showToast('Primary property updated', 'success')
    await load()
  }

  async function remove(id: string) {
    if (busy) return
    if ((jobCounts.get(id) ?? 0) > 0) return
    setBusy(true)
    const wasPrimary = rows.find((r) => r.id === id)?.is_primary
    const { error } = await supabase.from('customer_addresses').delete().eq('id', id)
    setBusy(false)
    if (error) {
      showToast(`Could not remove the property: ${error.message}`, 'error')
      return
    }
    if (editingId === id) close()
    await load()
    if (wasPrimary) {
      const next = rows.filter((r) => r.id !== id)[0]
      onPrimaryAddressChange?.(next?.address ?? '')
    }
  }

  function sheetFor(id: string | 'new') {
    const row = id === 'new' ? null : rows.find((r) => r.id === id)
    return (
      <CustomerPropertySheet
        draft={draft}
        onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
        isNew={id === 'new'}
        isPrimary={Boolean(row?.is_primary)}
        busy={busy}
        linkedJobCount={row ? (jobCounts.get(row.id) ?? 0) : 0}
        onDone={() => void saveDraft()}
        onCancel={close}
        onRemove={row ? () => void remove(row.id) : undefined}
      />
    )
  }

  return (
    <section aria-label="Properties">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
        <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>
          Properties <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({rows.length})</span>
        </h3>
        {editingId !== 'new' ? (
          <button type="button" onClick={() => openNew()} style={{ ...smallBtn, marginLeft: 'auto' }}>
            + Add property
          </button>
        ) : null}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
        {editingId === 'new' ? sheetFor('new') : null}
        {loaded && rows.length === 0 && editingId !== 'new' ? (
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            No property yet. Add the customer's address; the first one becomes the ★ primary, and its legal record for lien paperwork is found for you.
          </p>
        ) : null}
        {rows.map((a) => {
          if (editingId === a.id) return <div key={a.id}>{sheetFor(a.id)}</div>
          const gaps = customerAddressLienGaps(a)
          const lookedUp = Boolean((a.parcel_looked_up_at ?? '').trim())
          const n = jobCounts.get(a.id) ?? 0
          return (
            <div key={a.id} style={{ border: `1px solid ${a.is_primary ? 'var(--border-strong)' : 'var(--border)'}`, borderRadius: 8, padding: '0.45rem 0.65rem', display: 'grid', gridTemplateColumns: '20px minmax(0, 1fr) auto', gap: '0.15rem 0.5rem', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => void setPrimary(a)}
                disabled={busy || Boolean(a.is_primary)}
                title={a.is_primary ? 'Primary property' : 'Set as the primary property'}
                aria-label={a.is_primary ? 'Primary property' : 'Set as the primary property'}
                aria-pressed={Boolean(a.is_primary)}
                style={{ background: 'none', border: 'none', cursor: a.is_primary ? 'default' : 'pointer', padding: 0, fontSize: '1.05rem', lineHeight: 1, color: a.is_primary ? 'var(--text-amber-700)' : 'var(--border-strong)', gridRow: '1 / span 2' }}
              >
                {a.is_primary ? '★' : '☆'}
              </button>
              <div style={{ fontWeight: 500, fontSize: '0.875rem', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.address}>
                {a.address}
              </div>
              <button type="button" onClick={() => openEdit(a)} style={{ ...linkBtn, gridRow: '1 / span 2' }} aria-label={`Edit property ${a.address}`}>
                Edit
              </button>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.75px', minWidth: 0 }}>
                {a.is_primary ? <span style={chip({ background: 'var(--bg-muted)', border: '1px solid transparent' })}>Primary</span> : null}
                {(a.note ?? '').trim() ? <span style={chip({ background: 'var(--bg-muted)', border: '1px solid transparent', fontWeight: 500 })}>{a.note}</span> : null}
                {gaps.length === 0 ? (
                  <span style={chip({ color: 'var(--text-green-700)', border: '1px solid var(--border-green)', background: 'var(--bg-green-tint)' })}>✓ lien-ready</span>
                ) : lookedUp ? (
                  <span style={chip({})} title={`Missing: ${gaps.join(', ')}`}>
                    {gaps.length} lien field{gaps.length === 1 ? '' : 's'} missing
                  </span>
                ) : (
                  <span style={chip({ color: 'var(--text-amber-700)', border: '1px solid var(--border-amber)', background: 'var(--bg-amber-tint)' })}>not looked up yet</span>
                )}
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {(a.county ?? '').trim() ? a.county : 'county unknown'}
                  {' · '}
                  {n === 0 ? 'no jobs yet' : `${n} job${n === 1 ? '' : 's'}`}
                </span>
              </div>
            </div>
          )
        })}
        {suggestions.map((s) => (
          <div key={s.address} style={{ border: '1px dashed var(--border-strong)', borderRadius: 8, padding: '0.45rem 0.65rem', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.1rem 0.5rem', alignItems: 'center', background: 'var(--bg-subtle)' }}>
            <div style={{ fontWeight: 500, fontSize: '0.875rem', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.address}>
              {s.address}
            </div>
            <button type="button" onClick={() => openNew(s.address)} disabled={busy || editingId === 'new'} style={{ ...smallBtn, gridRow: '1 / span 2' }}>
              Add as property
            </button>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              From this customer's jobs · {s.jobCount} job{s.jobCount === 1 ? '' : 's'} · not saved as a property
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
