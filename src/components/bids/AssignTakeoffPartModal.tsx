import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchLowestPartPrice } from '../../lib/materialPartCatalogPrice'
import { STAGE_LABELS, type MaterialsModel, type TakeoffStage } from '../../lib/bids/bidTakeoffHelpers'
import { formatCurrency } from '../../lib/format'
import { useToastContext } from '../../contexts/ToastContext'

type PartOption = { id: string; name: string; manufacturer?: string | null; part_types?: { name?: string } | null }
type TemplateOption = { id: string; name: string; assembly_types?: { name?: string } | null }

type AssignTakeoffPartModalProps = {
  bidId: string
  /** Active bid Version this takeoff belongs to (null = the unsplit Base). */
  bidVersionId: string | null
  serviceTypeId: string
  countRowId: string
  fixture: string
  /** 'rough' = Combined materials (assign a part); 'exact' = By Stage (assign an assembly). */
  materialsModel: MaterialsModel
  defaultQuantity: number
  onClose: () => void
  /** Called after a successful insert — parent recomputes pricing and closes. */
  onAssigned: () => void | Promise<void>
}

/**
 * Inline "assign a part or assembly" modal for the Bids → Pricing margin column.
 * Writes directly to the same Takeoffs tables the Takeoffs tab uses
 * (`bids_takeoff_rough_part_lines` for Combined, `bids_takeoff_template_mappings` for By Stage),
 * then hands control back to the parent to recompute the per-fixture margin.
 */
export function AssignTakeoffPartModal({
  bidId,
  bidVersionId,
  serviceTypeId,
  countRowId,
  fixture,
  materialsModel,
  defaultQuantity,
  onClose,
  onAssigned,
}: AssignTakeoffPartModalProps) {
  const { showToast } = useToastContext()
  const isRough = materialsModel === 'rough'
  const kind = isRough ? 'part' : 'assembly'

  const [loading, setLoading] = useState(true)
  const [parts, setParts] = useState<PartOption[]>([])
  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(String(Math.max(1, Math.round(defaultQuantity || 1))))
  const [unitPrice, setUnitPrice] = useState('')
  const [unitPriceSourceId, setUnitPriceSourceId] = useState<string | null>(null)
  const [priceLoading, setPriceLoading] = useState(false)
  const [hasCatalogPrice, setHasCatalogPrice] = useState<boolean | null>(null)
  const [stage, setStage] = useState<TakeoffStage>('rough_in')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      if (isRough) {
        const { data } = await supabase
          .from('material_parts')
          .select('id, name, manufacturer, part_types(name)')
          .eq('service_type_id', serviceTypeId)
          .order('name', { ascending: true })
        if (!cancelled) setParts((data as PartOption[]) ?? [])
      } else {
        const { data } = await supabase
          .from('material_templates')
          .select('id, name, assembly_types(name)')
          .eq('service_type_id', serviceTypeId)
          .order('name', { ascending: true })
        if (!cancelled) setTemplates((data as TemplateOption[]) ?? [])
      }
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [isRough, serviceTypeId])

  const options: Array<PartOption | TemplateOption> = isRough ? parts : templates
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options
    return base.slice(0, 50)
  }, [options, search])
  const selected = options.find((o) => o.id === selectedId) ?? null

  async function selectOption(id: string) {
    setSelectedId(id)
    setSearch('')
    if (isRough) {
      setPriceLoading(true)
      setHasCatalogPrice(null)
      try {
        const low = await fetchLowestPartPrice(supabase, id)
        if (low) {
          setUnitPrice(low.price.toFixed(2))
          setUnitPriceSourceId(low.priceId)
          setHasCatalogPrice(true)
        } else {
          setUnitPrice('')
          setUnitPriceSourceId(null)
          setHasCatalogPrice(false)
        }
      } catch {
        setUnitPrice('')
        setUnitPriceSourceId(null)
        setHasCatalogPrice(false)
      } finally {
        setPriceLoading(false)
      }
    }
  }

  const qtyNum = parseFloat(quantity) || 0
  const upNum = parseFloat(unitPrice) || 0
  const canAssign =
    selectedId != null && qtyNum > 0 && !saving && (isRough ? upNum > 0 : true)

  async function handleAssign() {
    if (!selectedId || qtyNum <= 0) return
    setSaving(true)
    try {
      if (isRough) {
        let cq: any = supabase
          .from('bids_takeoff_rough_part_lines')
          .select('id', { count: 'exact', head: true })
          .eq('bid_id', bidId)
          .eq('count_row_id', countRowId)
        cq = bidVersionId == null ? cq.is('bid_version_id', null) : cq.eq('bid_version_id', bidVersionId)
        const { count } = await cq
        const { error } = await supabase.from('bids_takeoff_rough_part_lines').insert({
          bid_id: bidId,
          bid_version_id: bidVersionId,
          count_row_id: countRowId,
          part_id: selectedId,
          quantity: Math.max(0.0001, qtyNum),
          unit_price: Math.max(0, upNum),
          sequence_order: count ?? 0,
          source_material_part_price_id: unitPriceSourceId,
          source_template_id: null,
        })
        if (error) {
          showToast(`Failed to assign part: ${error.message}`, 'error')
          setSaving(false)
          return
        }
      } else {
        let cq: any = supabase
          .from('bids_takeoff_template_mappings')
          .select('id', { count: 'exact', head: true })
          .eq('bid_id', bidId)
          .eq('count_row_id', countRowId)
        cq = bidVersionId == null ? cq.is('bid_version_id', null) : cq.eq('bid_version_id', bidVersionId)
        const { count } = await cq
        const { error } = await supabase.from('bids_takeoff_template_mappings').upsert(
          {
            bid_id: bidId,
            bid_version_id: bidVersionId,
            count_row_id: countRowId,
            template_id: selectedId,
            stage,
            quantity: Math.max(0.0001, qtyNum),
            sequence_order: count ?? 0,
          },
          { onConflict: 'count_row_id,template_id,stage,bid_version_id', ignoreDuplicates: false },
        )
        if (error) {
          showToast(`Failed to assign assembly: ${error.message}`, 'error')
          setSaving(false)
          return
        }
      }
      showToast(`Assigned ${kind} to ${fixture}. Margin updated.`, 'success')
      await onAssigned()
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '0.5rem',
    border: '1px solid var(--border-strong)',
    borderRadius: 4,
    boxSizing: 'border-box' as const,
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="assign-takeoff-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          padding: '1.5rem 2rem',
          minWidth: 380,
          maxWidth: 480,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="assign-takeoff-title" style={{ margin: '0 0 0.25rem', fontSize: '1.125rem' }}>
          Assign a {kind}: {fixture}
        </h2>
        <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          {isRough ? 'Combined materials' : 'By Stage materials'} — this adds a Takeoffs cost so the
          margin can be computed.
        </p>

        {loading ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading {kind}s…</p>
        ) : options.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            No {kind}s found for this service type. Add them in Materials first.
          </p>
        ) : (
          <>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.25rem' }}>
              {isRough ? 'Part' : 'Assembly'}
            </label>
            {selected ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  padding: '0.5rem',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 4,
                  marginBottom: '0.75rem',
                }}
              >
                <span style={{ fontWeight: 500 }}>{selected.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(null)
                    setUnitPrice('')
                    setUnitPriceSourceId(null)
                    setHasCatalogPrice(null)
                  }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1, padding: 0 }}
                  aria-label="Clear selection"
                  title="Clear selection"
                >
                  ×
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={`Search ${kind}s…`}
                  style={{ ...inputStyle, marginBottom: '0.35rem' }}
                />
                <div
                  style={{
                    maxHeight: 200,
                    overflowY: 'auto',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    marginBottom: '0.75rem',
                  }}
                >
                  {filtered.length === 0 ? (
                    <div style={{ padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>No matches.</div>
                  ) : (
                    filtered.map((o) => {
                      const sub = isRough
                        ? [ (o as PartOption).manufacturer, (o as PartOption).part_types?.name ].filter(Boolean).join(' · ')
                        : (o as TemplateOption).assembly_types?.name ?? ''
                      return (
                        <div
                          key={o.id}
                          onClick={() => void selectOption(o.id)}
                          style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
                          onMouseEnter={(ev) => { ev.currentTarget.style.background = 'var(--bg-subtle)' }}
                          onMouseLeave={(ev) => { ev.currentTarget.style.background = 'var(--surface)' }}
                        >
                          <div style={{ fontWeight: 500 }}>{o.name}</div>
                          {sub ? <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{sub}</div> : null}
                        </div>
                      )
                    })
                  )}
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ flex: '0 0 7rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.25rem' }}>
                  Quantity
                </label>
                <input
                  type="number"
                  min={1}
                  step="any"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  style={inputStyle}
                />
              </div>
              {isRough ? (
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.25rem' }}>
                    Unit price
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    placeholder={priceLoading ? 'Loading…' : '0.00'}
                    disabled={priceLoading}
                    style={inputStyle}
                  />
                  {hasCatalogPrice === false && selected && (
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--text-amber-700)' }}>
                      No catalog price — enter one to set the cost.
                    </p>
                  )}
                </div>
              ) : (
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.25rem' }}>
                    Stage
                  </label>
                  <select value={stage} onChange={(e) => setStage(e.target.value as TakeoffStage)} style={inputStyle}>
                    {(Object.keys(STAGE_LABELS) as TakeoffStage[]).map((s) => (
                      <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {isRough && selected && qtyNum > 0 && upNum > 0 && (
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-700)' }}>
                Adds <strong>${formatCurrency(qtyNum * upNum)}</strong> of material cost to {fixture}.
              </p>
            )}

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => void handleAssign()}
                disabled={!canAssign}
                style={{
                  flex: 1,
                  padding: '0.5rem 1rem',
                  background: canAssign ? '#3b82f6' : 'var(--bg-200)',
                  color: canAssign ? 'white' : 'var(--text-faint)',
                  border: 'none',
                  borderRadius: 4,
                  cursor: canAssign ? 'pointer' : 'not-allowed',
                  fontWeight: 600,
                }}
              >
                {saving ? 'Assigning…' : `Assign ${kind}`}
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
