import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { fetchEstimateCatalogEvents, loadEditorDisplayByUserId, replaceEstimateCatalogFromPayload, type EstimateCatalogItemEventRow } from '../../lib/estimateCatalogApi'
import type { EstimateCatalogLineItem } from '../../lib/estimateLineItemCatalog'
import { catalogUnitPriceInputCents, coerceDraftQuantity, emptyCatalogEditRow, patchCatalogEditRow } from '../../lib/estimates/estimateDraftLines'
import { catalogEventSummary, filterCatalogItems } from '../../lib/estimates/estimateCatalogView'
import { formatEstimateMoney as formatMoney } from '../../lib/estimates/estimateListRows'
import { estDangerOutlineButton, estInputBase, estPrimaryButton, estSecondaryButton, estSmallSecondaryButton } from './estimatesPageStyles'

/**
 * The line-item catalog modal — Pick a saved line into the draft, or (for the catalog's
 * editors) Edit the catalog itself, with each item's history. Out of `src/pages/Estimates.tsx`
 * whole (step 3 of the Estimates map, v2.3870): the eight modal-only states, the Escape and
 * clear-on-open effects, the history and save handlers moved with the JSX; the page keeps
 * `open`, the catalog rows (other readers), who may edit, and what happens to a picked line.
 */
export type EstimateLineItemCatalogModalProps = {
  open: boolean
  onClose: () => void
  catalogLineItems: EstimateCatalogLineItem[]
  /** Re-read the catalog after a save (the page owns the rows). */
  onReloadCatalog: () => Promise<void>
  canManage: boolean
  /** A picked entry goes onto the draft; the page closes the modal after. */
  onInsert: (entry: EstimateCatalogLineItem) => void
}

export function EstimateLineItemCatalogModal({ open, onClose, catalogLineItems, onReloadCatalog, canManage, onInsert }: EstimateLineItemCatalogModalProps) {
  const { showToast } = useToastContext()
  const [catalogModalTab, setCatalogModalTab] = useState<'pick' | 'edit'>('pick')
  const [catalogEditRows, setCatalogEditRows] = useState<EstimateCatalogLineItem[]>([])
  const [catalogSaveBusy, setCatalogSaveBusy] = useState(false)
  const [catalogEventsByItemId, setCatalogEventsByItemId] = useState<Record<string, EstimateCatalogItemEventRow[]>>({})
  const [catalogHistoryOpenId, setCatalogHistoryOpenId] = useState<string | null>(null)
  const [catalogHistoryLoadingId, setCatalogHistoryLoadingId] = useState<string | null>(null)
  const [catalogEditorNames, setCatalogEditorNames] = useState<Map<string, string>>(() => new Map())
  const [catalogFilter, setCatalogFilter] = useState('')

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (open) setCatalogFilter('')
    else setCatalogHistoryOpenId(null)
  }, [open])

  const catalogFiltered = useMemo(() => filterCatalogItems(catalogLineItems, catalogFilter), [catalogLineItems, catalogFilter])

  async function loadHistoryForCatalogItem(itemId: string) {
    setCatalogHistoryLoadingId(itemId)
    try {
      const evs = await fetchEstimateCatalogEvents(supabase, itemId)
      const names = await loadEditorDisplayByUserId(
        supabase,
        evs.map((e) => e.editor_user_id),
      )
      setCatalogEditorNames((prev) => new Map([...prev, ...names]))
      setCatalogEventsByItemId((prev) => ({ ...prev, [itemId]: evs }))
    } catch {
      showToast('Could not load history', 'error')
    } finally {
      setCatalogHistoryLoadingId(null)
    }
  }

  async function saveCatalogEdits() {
    setCatalogSaveBusy(true)
    try {
      await replaceEstimateCatalogFromPayload(supabase, catalogEditRows)
      showToast('Line item catalog saved', 'success')
      setCatalogEventsByItemId({})
      await onReloadCatalog()
      setCatalogModalTab('pick')
    } catch (err) {
      showToast(formatErrorMessage(err, 'Could not save catalog'), 'error')
    } finally {
      setCatalogSaveBusy(false)
    }
  }

  return (
    <>
    {open ? (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Line item catalog"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1000,
          background: 'rgba(0,0,0,0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem',
        }}
        onClick={() => onClose()}
      >
        <div
          style={{
            background: 'var(--surface)',
            borderRadius: 8,
            border: '1px solid var(--border)',
            maxWidth: 560,
            width: '100%',
            maxHeight: 'min(85vh, 640px, 100%)',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 10px 40px rgba(0,0,0,0.12)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                flexWrap: 'wrap',
              }}
            >
              <span style={{ fontWeight: 600 }}>Line item catalog</span>
              {canManage ?
                <>
                  <button
                    type="button"
                    aria-pressed={catalogModalTab === 'pick'}
                    onClick={() => setCatalogModalTab('pick')}
                    style={{
                      padding: '0.35rem 0.65rem',
                      fontSize: '0.8125rem',
                      fontWeight: 500,
                      borderRadius: 4,
                      border: catalogModalTab === 'pick' ? 'none' : '1px solid var(--border-strong)',
                      background: catalogModalTab === 'pick' ? '#3b82f6' : 'var(--bg-muted)',
                      color: catalogModalTab === 'pick' ? 'white' : 'var(--text-700)',
                      cursor: 'pointer',
                    }}
                  >
                    Insert from catalog
                  </button>
                  <button
                    type="button"
                    aria-pressed={catalogModalTab === 'edit'}
                    onClick={() => {
                      setCatalogModalTab('edit')
                      setCatalogEditRows(catalogLineItems.map((r) => ({ ...r })))
                    }}
                    style={{
                      padding: '0.35rem 0.65rem',
                      fontSize: '0.8125rem',
                      fontWeight: 500,
                      borderRadius: 4,
                      border: catalogModalTab === 'edit' ? 'none' : '1px solid var(--border-strong)',
                      background: catalogModalTab === 'edit' ? '#3b82f6' : 'var(--bg-muted)',
                      color: catalogModalTab === 'edit' ? 'white' : 'var(--text-700)',
                      cursor: 'pointer',
                    }}
                  >
                    Edit book
                  </button>
                </>
              : null}
              <button
                type="button"
                onClick={() => onClose()}
                aria-label="Close"
                style={{
                  ...estSmallSecondaryButton(),
                  marginLeft: 'auto',
                  minWidth: '2rem',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
            {catalogModalTab === 'pick' ? (
              <input
                type="search"
                placeholder="Filter…"
                value={catalogFilter}
                onChange={(e) => setCatalogFilter(e.target.value)}
                style={{
                  ...estInputBase,
                  width: '100%',
                  marginTop: '0.75rem',
                  padding: '0.5rem',
                  boxSizing: 'border-box',
                }}
              />
            ) : null}
          </div>
          {catalogModalTab === 'pick' ? (
            <ul
              style={{
                listStyle: 'none',
                margin: 0,
                padding: '0.5rem',
                overflowY: 'auto',
                flex: 1,
              }}
            >
              {catalogFiltered.length === 0 ? (
                <li style={{ padding: '1rem', color: 'var(--text-muted)' }}>
                  {catalogLineItems.length === 0 ?
                    canManage ?
                      'No preset items yet. Use Edit book to add some.'
                    : 'No matching items.'
                  : 'No matching items.'}
                </li>
              ) : (
                catalogFiltered.map((c) => (
                  <li key={c.id} style={{ marginBottom: '0.35rem' }}>
                    <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'stretch' }}>
                      <button
                        type="button"
                        onClick={() => onInsert(c)}
                        style={{
                          flex: '1 1 auto',
                          textAlign: 'left',
                          padding: '0.6rem 0.75rem',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          background: 'var(--bg-page)',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                        }}
                      >
                        <span style={{ display: 'block', fontWeight: 500 }}>
                          {c.line_item.trim() || c.description.trim() || '—'}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', fontSize: '0.8125rem' }}>
                          {c.quantity} × {formatMoney(c.unit_price_cents)}
                          {c.line_item.trim() && c.description.trim() ? ` · ${c.description.trim()}` : ''}
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-expanded={catalogHistoryOpenId === c.id}
                        onClick={() => {
                          setCatalogHistoryOpenId((prev) => {
                            const next = prev === c.id ? null : c.id
                            if (next) void loadHistoryForCatalogItem(next)
                            return next
                          })
                        }}
                        style={{
                          flexShrink: 0,
                          padding: '0.35rem 0.5rem',
                          fontSize: '0.75rem',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          background: 'var(--surface)',
                          cursor: 'pointer',
                          alignSelf: 'stretch',
                        }}
                      >
                        {catalogHistoryOpenId === c.id ? '▼' : '▶'} History
                      </button>
                    </div>
                    {catalogHistoryOpenId === c.id ?
                      <div
                        style={{
                          marginTop: '0.35rem',
                          marginLeft: '0.25rem',
                          padding: '0.5rem 0.65rem',
                          background: 'var(--bg-subtle)',
                          borderRadius: 6,
                          fontSize: '0.8rem',
                          color: 'var(--text-700)',
                        }}
                      >
                        {catalogHistoryLoadingId === c.id ?
                          <span style={{ color: 'var(--text-muted)' }}>Loading…</span>
                        : (catalogEventsByItemId[c.id] ?? []).length === 0 ?
                          <span style={{ color: 'var(--text-muted)' }}>No history yet.</span>
                        : (
                          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                            {(catalogEventsByItemId[c.id] ?? []).map((ev) => (
                              <li
                                key={ev.id}
                                style={{
                                  padding: '0.35rem 0',
                                  borderBottom: '1px solid var(--border)',
                                }}
                              >
                                <div style={{ fontWeight: 500 }}>
                                  {catalogEditorNames.get(ev.editor_user_id) ?? ev.editor_user_id}
                                </div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                  {new Date(ev.edited_at).toLocaleString()}
                                </div>
                                <div style={{ marginTop: '0.2rem' }}>{catalogEventSummary(ev)}</div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    : null}
                  </li>
                ))
              )}
            </ul>
          ) : (
            <div style={{ padding: '0.5rem 1rem 1rem', overflowY: 'auto', flex: 1 }}>
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Changes apply for everyone. History is kept per line item.
              </p>
              {catalogEditRows.map((r, idx) => (
                <div
                  key={r.id && r.id.trim() !== '' ? r.id : `new-row-${idx}`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem',
                    marginBottom: '0.5rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                      alignItems: 'center',
                    }}
                  >
                    <input
                      value={r.line_item}
                      onChange={(e) => {
                        const v = e.target.value
                        setCatalogEditRows((prev) => {
                          const next = [...prev]
                          const cur = next[idx]
                          if (!cur) return prev
                          next[idx] = { ...cur, line_item: v }
                          return next
                        })
                      }}
                      placeholder="Line item"
                      style={{
                        ...estInputBase,
                        flex: '1 1 120px',
                        padding: '0.5rem',
                        minWidth: 0,
                      }}
                    />
                    <input
                      className="no-spinner"
                      type="number"
                      min={0}
                      step="any"
                      value={r.quantity}
                      onChange={(e) => {
                        const q = coerceDraftQuantity(e.target.value)
                        setCatalogEditRows((prev) => {
                          const next = [...prev]
                          const cur = next[idx]
                          if (!cur) return prev
                          next[idx] = patchCatalogEditRow(cur, { quantity: q })
                          return next
                        })
                      }}
                      placeholder="Count"
                      title="Count"
                      style={{ ...estInputBase, width: 72, padding: '0.5rem' }}
                    />
                    <input
                      className="no-spinner"
                      type="number"
                      min={0}
                      step="0.01"
                      value={r.unit_price_cents ? r.unit_price_cents / 100 : ''}
                      onChange={(e) => {
                        const unit = catalogUnitPriceInputCents(e.target.value)
                        setCatalogEditRows((prev) => {
                          const next = [...prev]
                          const cur = next[idx]
                          if (!cur) return prev
                          next[idx] = patchCatalogEditRow(cur, { unit_price_cents: unit })
                          return next
                        })
                      }}
                      placeholder="Unit ($)"
                      style={{ ...estInputBase, width: 100, padding: '0.5rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => setCatalogEditRows((prev) => prev.filter((_, j) => j !== idx))}
                      style={estDangerOutlineButton()}
                    >
                      Remove
                    </button>
                  </div>
                  <input
                    value={r.description}
                    onChange={(e) => {
                      const v = e.target.value
                      setCatalogEditRows((prev) => {
                        const next = [...prev]
                        const cur = next[idx]
                        if (!cur) return prev
                        next[idx] = { ...cur, description: v }
                        return next
                      })
                    }}
                    placeholder="Description (optional)"
                    aria-label="Description (optional)"
                    style={{
                      ...estInputBase,
                      width: '100%',
                      minWidth: 0,
                      boxSizing: 'border-box',
                      padding: '0.5rem',
                    }}
                  />
                </div>
              ))}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setCatalogEditRows((prev) => [...prev, emptyCatalogEditRow()])}
                  style={estSecondaryButton()}
                >
                  Add row
                </button>
              </div>
              <button
                type="button"
                onClick={() => void saveCatalogEdits()}
                disabled={catalogSaveBusy}
                style={estPrimaryButton(catalogSaveBusy)}
              >
                {catalogSaveBusy ? 'Saving…' : 'Save catalog'}
              </button>
            </div>
          )}
        </div>
      </div>
    ) : null}
    </>
  )
}
