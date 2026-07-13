/**
 * Projects → Forecast → Specific stage modal: "Line Items For Office" section.
 *
 * Self-contained collapsible section that mirrors the Workflow page's Line Items For
 * Office block at full feature parity: read-only summary row when collapsed, a Memo /
 * Date / Amount table when expanded (with View PO / View Invoice / Edit / Delete
 * per-row affordances), plus three add affordances:
 *
 *   - "+ Add Line Item" → opens a nested sub-modal with memo / link / amount / date
 *     fields. Same persistence path as Workflow's `saveLineItem`.
 *   - "+ Add Supply House Invoice" → opens a nested searchable picker over
 *     `supply_house_invoices`. Adopts the picked invoice's number/amount/supply house
 *     into a synthesized memo + stamps `supply_house_invoice_id` so the View Invoice
 *     button keeps working.
 *   - "+ Add PO" → opens a nested picker over finalized `purchase_orders`. Synthesizes
 *     a memo from the PO's name + item count + grand total + stamps `purchase_order_id`.
 *
 * Gating mirrors the Workflow page exactly: section visible to dev / master_technician
 * / assistant / superintendent (any role that can write to `workflow_step_line_items`
 * per RLS), but the PO + Invoice add buttons render only for dev / master_technician —
 * matching `loadFinalizedPOs` / `loadSupplyHouseInvoices` gating on the Workflow page.
 *
 * Nested modals (z-index 1010, above the parent stage modal at 1005) handle:
 *   - Edit Line Item form
 *   - PO picker list
 *   - Invoice picker with substring search across number / supply house / amount /
 *     date / PO# / paid/unpaid
 *   - View PO details (parts table with grand total)
 *   - View Invoice details (supply house, amount, link)
 *   - Confirm Delete Line Item
 */

import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import {
  addInvoiceToStep,
  addPOToStep,
  deleteLineItemRow,
  formatAmount,
  formatLineItemDate,
  formatShortIsoDate,
  loadFinalizedPOOptions,
  loadInvoiceDetail,
  loadLineItemsForStep,
  loadPODetail,
  loadSupplyHouseInvoiceOptions,
  normalizeUrl,
  saveLineItem,
  type AvailableInvoiceOption,
  type AvailablePOOption,
  type InvoiceDetail,
  type LineItemRow,
  type PODetail,
} from '../../lib/projectsForecastStageLineItems'

const EDITOR_ROLES = new Set(['dev', 'master_technician', 'assistant', 'superintendent'])
const POPULATED_PICKER_ROLES = new Set(['dev', 'master_technician'])

type EditingState = {
  item: LineItemRow | null
  memo: string
  amount: string
  itemDate: string
  link: string
} | null

type Props = {
  stepId: string
  stepName: string
  /** Current user's role. Section renders only for editor roles; PO + invoice picker
   *  rows render only for dev / master_technician (matches Workflow page). */
  myRole: string | null
  /** Optional: parent can force a refetch (e.g. after a different field changes the
   *  step row). Bumping this triggers `loadLineItemsForStep`. */
  refreshNonce?: number
}

export function ProjectsForecastStageLineItemsSection({ stepId, stepName, myRole, refreshNonce = 0 }: Props) {
  const { showToast } = useToastContext()
  const canEdit = myRole != null && EDITOR_ROLES.has(myRole)
  const canUsePopulatedPickers = myRole != null && POPULATED_PICKER_ROLES.has(myRole)

  const [expanded, setExpanded] = useState<boolean>(false)
  const [lineItems, setLineItems] = useState<LineItemRow[]>([])
  const [loadingItems, setLoadingItems] = useState<boolean>(false)
  const [itemsError, setItemsError] = useState<string | null>(null)

  const [availablePOs, setAvailablePOs] = useState<AvailablePOOption[]>([])
  const [availableInvoices, setAvailableInvoices] = useState<AvailableInvoiceOption[]>([])

  const [editing, setEditing] = useState<EditingState>(null)
  const [savingItem, setSavingItem] = useState<boolean>(false)

  const [poPickerOpen, setPoPickerOpen] = useState<boolean>(false)
  const [invoicePickerOpen, setInvoicePickerOpen] = useState<boolean>(false)
  const [invoiceSearch, setInvoiceSearch] = useState<string>('')

  const [viewingPO, setViewingPO] = useState<PODetail | null>(null)
  const [viewingInvoice, setViewingInvoice] = useState<InvoiceDetail | null>(null)
  const [viewLoading, setViewLoading] = useState<boolean>(false)

  const [confirmDelete, setConfirmDelete] = useState<LineItemRow | null>(null)
  const [deletingItem, setDeletingItem] = useState<boolean>(false)

  const refreshItems = useCallback(async () => {
    if (!canEdit) {
      setLineItems([])
      return
    }
    setLoadingItems(true)
    setItemsError(null)
    const result = await loadLineItemsForStep(stepId)
    setLineItems(result.items)
    setItemsError(result.error)
    setLoadingItems(false)
  }, [canEdit, stepId])

  useEffect(() => {
    void refreshItems()
  }, [refreshItems, refreshNonce])

  // Load the picker option lists once (dev/master only). These are not per-step.
  useEffect(() => {
    if (!canUsePopulatedPickers) {
      setAvailablePOs([])
      setAvailableInvoices([])
      return
    }
    let cancelled = false
    void (async () => {
      const [poResult, invResult] = await Promise.all([
        loadFinalizedPOOptions(),
        loadSupplyHouseInvoiceOptions(),
      ])
      if (cancelled) return
      setAvailablePOs(poResult.options)
      setAvailableInvoices(invResult.options)
    })()
    return () => {
      cancelled = true
    }
  }, [canUsePopulatedPickers])

  if (!canEdit) return null

  const total = lineItems.reduce((sum, item) => sum + (item.amount || 0), 0)

  const openAddLineItem = () => {
    setEditing({ item: null, memo: '', amount: '', itemDate: '', link: '' })
  }

  const openEditLineItem = (item: LineItemRow) => {
    setEditing({
      item,
      memo: item.memo,
      amount: item.amount != null ? String(item.amount) : '',
      itemDate: item.item_date ? String(item.item_date).slice(0, 10) : '',
      link: item.link ?? '',
    })
  }

  const handleSaveLineItem = async () => {
    if (!editing) return
    setSavingItem(true)
    const err = await saveLineItem({
      stepId,
      item: editing.item,
      memo: editing.memo,
      amount: editing.amount,
      itemDate: editing.itemDate,
      link: editing.link,
      existing: lineItems,
    })
    setSavingItem(false)
    if (err) {
      showToast(err, 'error')
      return
    }
    setEditing(null)
    showToast(editing.item ? 'Line item updated.' : 'Line item added.', 'success')
    await refreshItems()
  }

  const handleDeleteConfirmed = async () => {
    if (!confirmDelete) return
    setDeletingItem(true)
    const err = await deleteLineItemRow(confirmDelete.id)
    setDeletingItem(false)
    if (err) {
      showToast(err, 'error')
      return
    }
    showToast('Line item deleted.', 'success')
    setConfirmDelete(null)
    await refreshItems()
  }

  const handlePickPO = async (poId: string) => {
    const err = await addPOToStep(stepId, poId, lineItems)
    if (err) {
      showToast(err, 'error')
      return
    }
    setPoPickerOpen(false)
    showToast('PO added to stage.', 'success')
    await refreshItems()
  }

  const handlePickInvoice = async (invoiceId: string) => {
    const err = await addInvoiceToStep(stepId, invoiceId, lineItems)
    if (err) {
      showToast(err, 'error')
      return
    }
    setInvoicePickerOpen(false)
    setInvoiceSearch('')
    showToast('Invoice added to stage.', 'success')
    await refreshItems()
  }

  const handleViewPO = async (poId: string) => {
    setViewLoading(true)
    const result = await loadPODetail(poId)
    setViewLoading(false)
    if (result.error || !result.detail) {
      showToast(result.error ?? 'PO not found', 'error')
      return
    }
    setViewingPO(result.detail)
  }

  const handleViewInvoice = async (invoiceId: string) => {
    setViewLoading(true)
    const result = await loadInvoiceDetail(invoiceId)
    setViewLoading(false)
    if (result.error || !result.detail) {
      showToast(result.error ?? 'Invoice not found', 'error')
      return
    }
    setViewingInvoice(result.detail)
  }

  return (
    <section
      aria-label="Line items for office"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '0.5rem 0.75rem',
        background: 'var(--bg-sky-tint)',
        border: '1px solid #bae6fd',
        borderRadius: 6,
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        style={{
          all: 'unset',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          cursor: 'pointer',
          fontSize: '0.8125rem',
        }}
      >
        <span style={{ fontSize: '0.75rem', minWidth: 16 }}>{expanded ? '\u25BC' : '\u25B6'}</span>
        <span style={{ fontWeight: 500, color: '#0369a1' }}>
          Line Items For Office
          {!expanded ? <> | {formatAmount(total)}</> : null}
        </span>
      </button>

      {expanded ? (
        <>
          {loadingItems ? (
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              Loading line items…
            </div>
          ) : itemsError ? (
            <div
              role="alert"
              style={{
                padding: '0.4rem 0.6rem',
                background: 'var(--bg-red-tint)',
                border: '1px solid #fecaca',
                borderRadius: 4,
                color: 'var(--text-red-800)',
                fontSize: '0.75rem',
              }}
            >
              {itemsError}
            </div>
          ) : lineItems.length === 0 ? (
            <p
              style={{
                fontSize: '0.8125rem',
                color: 'var(--text-amber-800)',
                margin: 0,
                fontStyle: 'italic',
                textAlign: 'center',
              }}
            >
              No line items yet. Click “Add Line Item” to add one.
            </p>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div
                style={{
                  fontSize: '0.8125rem',
                  background: 'var(--surface)',
                  border: '1px solid #bae6fd',
                  borderRadius: 4,
                  overflow: 'hidden',
                  width: 'fit-content',
                  maxWidth: '100%',
                }}
              >
                <table style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={liHeadCell}>Memo</th>
                      <th style={{ ...liHeadCell, whiteSpace: 'nowrap' }}>Date</th>
                      <th style={{ ...liHeadCell, textAlign: 'right' }}>Amount</th>
                      <th style={{ ...liHeadCell, width: 1 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item, idx) => {
                      const isLast = idx === lineItems.length - 1
                      const border = isLast ? 'none' : '1px solid #bae6fd'
                      const linkValue = item.link && item.link.trim() ? normalizeUrl(item.link) : null
                      return (
                        <tr key={item.id}>
                          <td style={{ ...liBodyCell, borderBottom: border }}>
                            {linkValue ? (
                              <a
                                href={linkValue}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                style={{ color: 'var(--text-link)', textDecoration: 'underline' }}
                                title={item.link ?? ''}
                              >
                                {item.memo}
                              </a>
                            ) : (
                              <span>{item.memo}</span>
                            )}
                          </td>
                          <td
                            style={{
                              ...liBodyCell,
                              borderBottom: border,
                              fontSize: '0.8125rem',
                              color: 'var(--text-600)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {formatLineItemDate(item.item_date)}
                          </td>
                          <td
                            style={{
                              ...liBodyCell,
                              borderBottom: border,
                              textAlign: 'right',
                              color: (item.amount || 0) < 0 ? 'var(--text-red-700)' : 'var(--text-700)',
                              fontWeight: 500,
                            }}
                          >
                            {formatAmount(item.amount)}
                          </td>
                          <td
                            style={{
                              ...liBodyCell,
                              borderBottom: border,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center' }}>
                              {item.purchase_order_id ? (
                                <button
                                  type="button"
                                  onClick={() => handleViewPO(item.purchase_order_id!)}
                                  style={rowGhostBtn}
                                  disabled={viewLoading}
                                  title="View PO details"
                                >
                                  View PO
                                </button>
                              ) : null}
                              {item.supply_house_invoice_id ? (
                                <button
                                  type="button"
                                  onClick={() => handleViewInvoice(item.supply_house_invoice_id!)}
                                  style={rowGhostBtn}
                                  disabled={viewLoading}
                                  title="View invoice details"
                                >
                                  View Invoice
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => openEditLineItem(item)}
                                title="Edit"
                                aria-label="Edit line item"
                                style={iconBtn('#374151')}
                              >
                                <PencilIcon />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDelete(item)}
                                title="Delete"
                                aria-label="Delete line item"
                                style={iconBtn('#991b1b')}
                              >
                                <TrashIcon />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '0.4rem',
              flexWrap: 'wrap',
              marginTop: '0.25rem',
            }}
          >
            <button type="button" onClick={openAddLineItem} style={addButtonStyle}>
              + Add Line Item
            </button>
            {canUsePopulatedPickers && availableInvoices.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setInvoiceSearch('')
                  setInvoicePickerOpen(true)
                }}
                style={addButtonStyle}
              >
                + Add Supply House Invoice
              </button>
            ) : null}
            {canUsePopulatedPickers && availablePOs.length > 0 ? (
              <button type="button" onClick={() => setPoPickerOpen(true)} style={addButtonStyle}>
                + Add PO
              </button>
            ) : null}
          </div>
        </>
      ) : null}

      {/* Nested modal: Add / Edit line item */}
      {editing ? (
        <NestedModal onClose={() => (savingItem ? undefined : setEditing(null))} ariaLabel="Edit line item">
          <h3 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: '1rem' }}>
            {editing.item ? 'Edit line item' : 'Add line item'}
          </h3>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void handleSaveLineItem()
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
          >
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={fieldLabel}>Date (optional)</span>
              <input
                type="date"
                value={editing.itemDate}
                onChange={(e) =>
                  setEditing((prev) => (prev ? { ...prev, itemDate: e.target.value } : prev))
                }
                disabled={savingItem}
                style={textInputStyle}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={fieldLabel}>Link (optional)</span>
              <input
                type="url"
                value={editing.link}
                onChange={(e) =>
                  setEditing((prev) => (prev ? { ...prev, link: e.target.value } : prev))
                }
                disabled={savingItem}
                placeholder="https://..."
                pattern="https?://.*"
                style={textInputStyle}
              />
              {editing.link &&
              editing.link.trim() &&
              !editing.link.trim().match(/^https?:\/\//i) ? (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-red-600)', marginTop: 2 }}>
                  Link should start with http:// or https://
                </div>
              ) : null}
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={fieldLabel}>Memo *</span>
              <input
                type="text"
                value={editing.memo}
                onChange={(e) =>
                  setEditing((prev) => (prev ? { ...prev, memo: e.target.value } : prev))
                }
                disabled={savingItem}
                required
                placeholder="e.g. Materials, Labor, Equipment"
                style={textInputStyle}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={fieldLabel}>Amount *</span>
              <input
                type="number"
                step="0.01"
                value={editing.amount}
                onChange={(e) =>
                  setEditing((prev) => (prev ? { ...prev, amount: e.target.value } : prev))
                }
                disabled={savingItem}
                required
                placeholder="0.00 (negative allowed)"
                style={textInputStyle}
              />
            </label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setEditing(null)}
                disabled={savingItem}
                style={modalSecondaryBtn}
              >
                Cancel
              </button>
              <button type="submit" disabled={savingItem} style={modalPrimaryBtn}>
                {savingItem ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </NestedModal>
      ) : null}

      {/* Nested modal: Add PO picker */}
      {poPickerOpen ? (
        <NestedModal onClose={() => setPoPickerOpen(false)} ariaLabel="Add purchase order to stage">
          <h3 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: '1rem' }}>
            Add Purchase Order to “{stepName}”
          </h3>
          {availablePOs.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>
              No finalized purchase orders available. Go to Materials → Purchase Orders to create
              and finalize one.
            </p>
          ) : (
            <div
              style={{
                border: '1px solid var(--border)',
                borderRadius: 4,
                maxHeight: 400,
                overflow: 'auto',
              }}
            >
              {availablePOs.map((po) => (
                <button
                  key={po.id}
                  type="button"
                  onClick={() => handlePickPO(po.id)}
                  style={pickerRowStyle}
                >
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>{po.name}</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    ${po.total.toFixed(2)}
                  </div>
                </button>
              ))}
            </div>
          )}
          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setPoPickerOpen(false)} style={modalSecondaryBtn}>
              Cancel
            </button>
          </div>
        </NestedModal>
      ) : null}

      {/* Nested modal: Add Invoice picker */}
      {invoicePickerOpen ? (
        <NestedModal
          onClose={() => {
            setInvoicePickerOpen(false)
            setInvoiceSearch('')
          }}
          ariaLabel="Add supply house invoice to stage"
        >
          <h3 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: '1rem' }}>
            Add Supply House Invoice to “{stepName}”
          </h3>
          {availableInvoices.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>
              No supply house invoices available. Add invoices in Materials → Supply Houses.
            </p>
          ) : (
            <>
              <input
                type="search"
                placeholder="Search by invoice #, supply house, amount, date, PO #, paid/unpaid…"
                value={invoiceSearch}
                onChange={(e) => setInvoiceSearch(e.target.value)}
                style={{ ...textInputStyle, marginBottom: 8 }}
              />
              <div
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  maxHeight: 400,
                  overflow: 'auto',
                }}
              >
                {(() => {
                  const q = invoiceSearch.trim().toLowerCase()
                  const filtered = q
                    ? availableInvoices.filter(
                        (inv) =>
                          inv.invoice_number.toLowerCase().includes(q) ||
                          inv.supply_house_name.toLowerCase().includes(q) ||
                          String(inv.amount).includes(q) ||
                          inv.invoice_date.toLowerCase().includes(q) ||
                          (inv.purchase_order_number?.toLowerCase().includes(q) ?? false) ||
                          (q === 'paid' && inv.is_paid) ||
                          (q === 'unpaid' && !inv.is_paid),
                      )
                    : availableInvoices
                  if (filtered.length === 0) {
                    return (
                      <p style={{ padding: '1rem', color: 'var(--text-muted)', margin: 0 }}>
                        No matching invoices.
                      </p>
                    )
                  }
                  return filtered.map((inv) => (
                    <button
                      key={inv.id}
                      type="button"
                      onClick={() => handlePickInvoice(inv.id)}
                      style={pickerRowStyle}
                    >
                      <div style={{ fontWeight: 600, marginBottom: 2, fontSize: '0.875rem' }}>
                        {inv.supply_house_name}
                        <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                          {' '}
                          · {formatShortIsoDate(inv.invoice_date)} · ${inv.amount.toFixed(2)}
                        </span>
                        {inv.purchase_order_number ? (
                          <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                            {' '}
                            · {inv.purchase_order_number}
                          </span>
                        ) : null}
                      </div>
                      <div
                        style={{
                          fontSize: '0.8125rem',
                          color: 'var(--text-faint)',
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '0.4rem 1rem',
                        }}
                      >
                        <span>#{inv.invoice_number}</span>
                        {inv.due_date ? <span>Due {formatShortIsoDate(inv.due_date)}</span> : null}
                        {inv.is_paid ? (
                          <span style={{ color: 'var(--text-green-600)', fontWeight: 500 }}>Paid</span>
                        ) : null}
                      </div>
                    </button>
                  ))
                })()}
              </div>
            </>
          )}
          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => {
                setInvoicePickerOpen(false)
                setInvoiceSearch('')
              }}
              style={modalSecondaryBtn}
            >
              Cancel
            </button>
          </div>
        </NestedModal>
      ) : null}

      {/* Nested modal: View PO details */}
      {viewingPO ? (
        <NestedModal onClose={() => setViewingPO(null)} ariaLabel={`PO ${viewingPO.name}`} wide>
          <h3 style={{ marginTop: 0, marginBottom: '0.75rem' }}>{viewingPO.name}</h3>
          <div
            style={{
              border: '1px solid var(--border)',
              borderRadius: 4,
              overflow: 'auto',
              marginBottom: '1rem',
              maxHeight: 400,
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: 'var(--bg-subtle)' }}>
                <tr>
                  <th style={poHeadCell}>Part</th>
                  <th style={poHeadCell}>Qty</th>
                  <th style={poHeadCell}>Supply House</th>
                  <th style={poHeadCell}>Price</th>
                  <th style={poHeadCell}>Total</th>
                </tr>
              </thead>
              <tbody>
                {viewingPO.items.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={poBodyCell}>{item.part.name}</td>
                    <td style={poBodyCell}>{item.quantity}</td>
                    <td style={poBodyCell}>{item.supply_house?.name ?? '-'}</td>
                    <td style={poBodyCell}>${item.price_at_time.toFixed(2)}</td>
                    <td style={{ ...poBodyCell, fontWeight: 600 }}>
                      ${(item.price_at_time * item.quantity).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot style={{ background: 'var(--bg-subtle)' }}>
                <tr>
                  <td colSpan={4} style={{ ...poBodyCell, textAlign: 'right', fontWeight: 600 }}>
                    Grand Total:
                  </td>
                  <td style={{ ...poBodyCell, fontWeight: 600 }}>
                    $
                    {viewingPO.items
                      .reduce((sum, item) => sum + item.price_at_time * item.quantity, 0)
                      .toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setViewingPO(null)} style={modalSecondaryBtn}>
              Close
            </button>
          </div>
        </NestedModal>
      ) : null}

      {/* Nested modal: View Invoice details */}
      {viewingInvoice ? (
        <NestedModal
          onClose={() => setViewingInvoice(null)}
          ariaLabel={`Invoice ${viewingInvoice.invoice_number}`}
        >
          <h3 style={{ marginTop: 0, marginBottom: '0.75rem' }}>
            Invoice #{viewingInvoice.invoice_number}
          </h3>
          <div style={{ marginBottom: '1rem', fontSize: '0.9375rem', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div>
              <strong>Supply house:</strong> {viewingInvoice.supply_house_name}
            </div>
            <div>
              <strong>Amount:</strong> {formatAmount(viewingInvoice.amount)}
            </div>
            {viewingInvoice.link ? (
              <div>
                <a
                  href={normalizeUrl(viewingInvoice.link)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--text-link)', textDecoration: 'underline' }}
                >
                  View invoice link
                </a>
              </div>
            ) : null}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setViewingInvoice(null)} style={modalSecondaryBtn}>
              Close
            </button>
          </div>
        </NestedModal>
      ) : null}

      {/* Nested modal: Confirm delete */}
      {confirmDelete ? (
        <NestedModal
          onClose={() => (deletingItem ? undefined : setConfirmDelete(null))}
          ariaLabel="Confirm delete line item"
        >
          <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Delete line item?</h3>
          <p style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--text-700)', fontSize: '0.875rem' }}>
            “{confirmDelete.memo}” will be removed from this stage. This can’t be undone.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setConfirmDelete(null)}
              disabled={deletingItem}
              style={modalSecondaryBtn}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteConfirmed}
              disabled={deletingItem}
              style={{ ...modalPrimaryBtn, background: '#dc2626', borderColor: '#b91c1c' }}
            >
              {deletingItem ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </NestedModal>
      ) : null}
    </section>
  )
}

function NestedModal({
  children,
  onClose,
  ariaLabel,
  wide = false,
}: {
  children: React.ReactNode
  onClose: () => void
  ariaLabel: string
  wide?: boolean
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1010,
        padding: '1rem',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          padding: '1.25rem',
          minWidth: 320,
          maxWidth: wide ? 800 : 460,
          width: '100%',
          maxHeight: 'calc(100vh - 2rem)',
          overflow: 'auto',
          boxShadow: '0 20px 40px rgba(15, 23, 42, 0.35)',
        }}
      >
        {children}
      </div>
    </div>
  )
}

function PencilIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden>
      <path d="M535.6 85.7C513.7 63.8 478.3 63.8 456.4 85.7L432 110.1L529.9 208L554.3 183.6C576.2 161.7 576.2 126.3 554.3 104.4L535.6 85.7zM236.4 305.7C230.3 311.8 225.6 319.3 222.9 327.6L193.3 416.4C190.4 425 192.7 434.5 199.1 441C205.5 447.5 215 449.7 223.7 446.8L312.5 417.2C320.7 414.5 328.2 409.8 334.4 403.7L496 241.9L398.1 144L236.4 305.7zM160 128C107 128 64 171 64 224L64 480C64 533 107 576 160 576L416 576C469 576 512 533 512 480L512 384C512 366.3 497.7 352 480 352C462.3 352 448 366.3 448 384L448 480C448 497.7 433.7 512 416 512L160 512C142.3 512 128 497.7 128 480L128 224C128 206.3 142.3 192 160 192L256 192C273.7 192 288 177.7 288 160C288 142.3 273.7 128 256 128L160 128z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden>
      <path d="M232.7 69.9L224 96L128 96C110.3 96 96 110.3 96 128C96 145.7 110.3 160 128 160L512 160C529.7 160 544 145.7 544 128C544 110.3 529.7 96 512 96L416 96L407.3 69.9C402.9 56.8 390.7 48 376.9 48L263.1 48C249.3 48 237.1 56.8 232.7 69.9zM512 208L128 208L149.1 531.1C150.7 556.4 171.7 576 197 576L443 576C468.3 576 489.3 556.4 490.9 531.1L512 208z" />
    </svg>
  )
}

const liHeadCell: CSSProperties = {
  textAlign: 'left',
  padding: '0.35rem 0.5rem',
  fontWeight: 600,
  borderBottom: '1px solid #bae6fd',
}

const liBodyCell: CSSProperties = {
  padding: '0.35rem 0.5rem',
  verticalAlign: 'middle',
}

const rowGhostBtn: CSSProperties = {
  padding: '0.2rem 0.45rem',
  borderRadius: 4,
  border: '1px solid #bae6fd',
  background: 'var(--bg-blue-tint)',
  color: 'var(--text-blue-700)',
  fontSize: '0.6875rem',
  fontWeight: 600,
  cursor: 'pointer',
}

const iconBtn = (color: string): CSSProperties => ({
  padding: 0,
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
})

const addButtonStyle: CSSProperties = {
  padding: '0.35rem 0.7rem',
  borderRadius: 5,
  border: '1px solid #bbf7d0',
  background: '#ecfdf5',
  color: '#065f46',
  fontSize: '0.75rem',
  fontWeight: 600,
  cursor: 'pointer',
}

const fieldLabel: CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--text-700)',
  fontWeight: 600,
}

const textInputStyle: CSSProperties = {
  padding: '0.4rem 0.5rem',
  borderRadius: 6,
  border: '1px solid #cbd5e1',
  fontSize: '0.875rem',
  color: 'var(--text-slate-900)',
  background: 'var(--surface)',
  width: '100%',
  boxSizing: 'border-box',
}

const modalSecondaryBtn: CSSProperties = {
  padding: '0.45rem 0.85rem',
  borderRadius: 6,
  border: '1px solid #cbd5e1',
  background: 'var(--surface)',
  color: '#1f2937',
  fontSize: '0.8125rem',
  fontWeight: 600,
  cursor: 'pointer',
}

const modalPrimaryBtn: CSSProperties = {
  padding: '0.45rem 0.9rem',
  borderRadius: 6,
  border: '1px solid #1d4ed8',
  background: '#2563eb',
  color: '#ffffff',
  fontSize: '0.8125rem',
  fontWeight: 600,
  cursor: 'pointer',
}

const pickerRowStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '0.7rem 0.85rem',
  borderBottom: '1px solid var(--border)',
  cursor: 'pointer',
  background: 'var(--surface)',
  border: 'none',
  borderLeft: 'none',
  borderRight: 'none',
  borderTop: 'none',
  color: 'var(--text-slate-900)',
  fontFamily: 'inherit',
}

const poHeadCell: CSSProperties = {
  padding: '0.6rem',
  textAlign: 'left',
  borderBottom: '1px solid var(--border)',
  fontWeight: 600,
}

const poBodyCell: CSSProperties = {
  padding: '0.6rem',
}
