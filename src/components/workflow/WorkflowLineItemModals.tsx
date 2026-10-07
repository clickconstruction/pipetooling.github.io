/**
 * The Workflow page's six line-item windows: add / edit a line item (with the
 * paste-from-clipboard import), confirm a delete, pick a purchase order or a
 * supply house invoice to attach to a step, and look at either one.
 *
 * The page still owns which window is open and what it holds — the stage
 * cards open them — and does the reads and writes; this file draws the
 * windows and hands every action back. Two things live here because only the
 * windows use them: the invoice picker's search text and the clipboard
 * import's busy flag. Each starts fresh whenever its window opens.
 */
import { useState } from 'react'
import type { Database } from '../../types/database'
import {
  filterAvailableInvoices,
  formatLineItemDate,
  normalizeUrl,
  type AvailableInvoiceOption,
  type AvailablePOOption,
  type InvoiceDetail,
  type PODetail,
} from '../../lib/projectsForecastStageLineItems'
import { formatAmount, formatDateShort } from '../../lib/workflow/workflowFormat'

type LineItem = Database['public']['Tables']['workflow_step_line_items']['Row']

export type EditingLineItem = {
  stepId: string
  item: LineItem | null
  link: string
  memo: string
  amount: string
  itemDate: string
}

export type ConfirmDeleteLineItem = { item: LineItem; stepName: string }

export type WorkflowLineItemModalsProps = {
  confirmDeleteLineItem: ConfirmDeleteLineItem | null
  onDeleteLineItem: (itemId: string) => Promise<void>
  onCloseDeleteLineItem: () => void

  editingLineItem: EditingLineItem | null
  /** The fields as typed, or null to close the window. */
  onChangeEditingLineItem: (next: EditingLineItem | null) => void
  onSaveLineItem: (stepId: string, item: LineItem | null, link: string, memo: string, amount: string, itemDate: string) => void
  /** Pasted text for a step; the page parses, writes and reloads. */
  onImportPastedLineItems: (stepId: string, text: string) => Promise<void>
  /** The page's error line — null clears it. */
  onError: (message: string | null) => void

  addingPOToStep: string | null
  availablePOs: AvailablePOOption[]
  onAddPOToStep: (stepId: string, poId: string) => void
  onCloseAddPO: () => void

  addingInvoiceToStep: string | null
  availableInvoices: AvailableInvoiceOption[]
  onAddInvoiceToStep: (stepId: string, invoiceId: string) => void
  onCloseAddInvoice: () => void

  viewingPO: PODetail | null
  onCloseViewPO: () => void

  viewingInvoice: InvoiceDetail | null
  onCloseViewInvoice: () => void
}

function DeleteLineItemConfirm({
  pending,
  onDelete,
  onClose,
}: {
  pending: ConfirmDeleteLineItem
  onDelete: (itemId: string) => Promise<void>
  onClose: () => void
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 710, paddingTop: 'var(--app-top-chrome, 0px)' }}>
      <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
        <h3 style={{ marginTop: 0 }}>Delete line item?</h3>
        <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          {pending.item.memo}
          {pending.item.amount != null && (
            <span> — {formatAmount(pending.item.amount)}</span>
          )}
          {pending.item.item_date && (
            <span style={{ display: 'block', marginTop: 4 }}>
              Date: {formatLineItemDate(pending.item.item_date)}
            </span>
          )}
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={async () => {
              await onDelete(pending.item.id)
              onClose()
            }}
            className="wf-btn-modal-primary wf-btn-danger-style"
          >
            Delete
          </button>
          <button type="button" onClick={() => onClose()} className="wf-btn-modal-secondary">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

function EditLineItemWindow({
  editing,
  onChange,
  onSave,
  onImportPastedLineItems,
  onError,
}: {
  editing: EditingLineItem
  onChange: (next: EditingLineItem | null) => void
  onSave: WorkflowLineItemModalsProps['onSaveLineItem']
  onImportPastedLineItems: (stepId: string, text: string) => Promise<void>
  onError: (message: string | null) => void
}) {
  const [pasteImporting, setPasteImporting] = useState(false)

  async function importLineItemsFromClipboard() {
    if (editing.item !== null) return
    onError(null)
    setPasteImporting(true)
    try {
      const text = await navigator.clipboard.readText()
      await onImportPastedLineItems(editing.stepId, text)
    } catch (e) {
      onError(
        e instanceof Error
          ? e.message
          : 'Could not read clipboard. Use HTTPS (or localhost) and allow clipboard access when prompted.'
      )
    } finally {
      setPasteImporting(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 710, paddingTop: 'var(--app-top-chrome, 0px)' }}>
      <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 360 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, flex: 1 }}>{editing.item ? 'Edit' : 'Add'} Line Item</h3>
          {!editing.item && (
            <button
              type="button"
              onClick={() => void importLineItemsFromClipboard()}
              disabled={pasteImporting}
              title="Import tab-separated rows from clipboard (date, memo, amount per line)"
              aria-label="Import line items from clipboard"
              className="wf-btn-modal-secondary"
              style={{
                padding: '0.35rem 0.5rem',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                opacity: pasteImporting ? 0.6 : 1,
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={22} height={22} fill="currentColor" aria-hidden>
                <path d="M360 160L280 160C266.7 160 256 149.3 256 136C256 122.7 266.7 112 280 112L360 112C373.3 112 384 122.7 384 136C384 149.3 373.3 160 360 160zM360 208C397.1 208 427.6 180 431.6 144L448 144C456.8 144 464 151.2 464 160L464 512C464 520.8 456.8 528 448 528L192 528C183.2 528 176 520.8 176 512L176 160C176 151.2 183.2 144 192 144L208.4 144C212.4 180 242.9 208 280 208L360 208zM419.9 96C407 76.7 385 64 360 64L280 64C255 64 233 76.7 220.1 96L192 96C156.7 96 128 124.7 128 160L128 512C128 547.3 156.7 576 192 576L448 576C483.3 576 512 547.3 512 512L512 160C512 124.7 483.3 96 448 96L419.9 96z" />
              </svg>
            </button>
          )}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onSave(
              editing.stepId,
              editing.item,
              editing.link,
              editing.memo,
              editing.amount,
              editing.itemDate
            )
          }}
        >
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="line-item-date" style={{ display: 'block', marginBottom: 4 }}>Date (optional)</label>
            <input
              id="line-item-date"
              type="date"
              value={editing.itemDate}
              onChange={(e) => onChange({ ...editing, itemDate: e.target.value })}
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="line-item-link" style={{ display: 'block', marginBottom: 4 }}>Link (optional)</label>
            <input
              id="line-item-link"
              type="url"
              value={editing.link}
              onChange={(e) => onChange({ ...editing, link: e.target.value })}
              placeholder="https://..."
              pattern="https?://.*"
              style={{ width: '100%', padding: '0.5rem' }}
            />
            {editing.link && editing.link.trim() && !editing.link.trim().match(/^https?:\/\//i) && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-red-600)', marginTop: '0.25rem' }}>
                Link should start with http:// or https://
              </div>
            )}
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="line-item-memo" style={{ display: 'block', marginBottom: 4 }}>Memo *</label>
            <input
              id="line-item-memo"
              type="text"
              value={editing.memo}
              onChange={(e) => onChange({ ...editing, memo: e.target.value })}
              required
              placeholder="e.g. Materials, Labor, Equipment"
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="line-item-amount" style={{ display: 'block', marginBottom: 4 }}>Amount *</label>
            <input
              id="line-item-amount"
              type="number"
              step="0.01"
              value={editing.amount}
              onChange={(e) => onChange({ ...editing, amount: e.target.value })}
              required
              placeholder="0.00 (negative allowed)"
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="wf-btn-modal-primary">Save</button>
            <button type="button" onClick={() => onChange(null)} className="wf-btn-modal-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AddPurchaseOrderPicker({
  stepId,
  availablePOs,
  onAdd,
  onClose,
}: {
  stepId: string
  availablePOs: AvailablePOOption[]
  onAdd: (stepId: string, poId: string) => void
  onClose: () => void
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 710, paddingTop: 'var(--app-top-chrome, 0px)' }}>
      <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: '90%', maxHeight: 'min(90vh, 100%)', overflow: 'auto' }}>
        <h3 style={{ marginTop: 0 }}>Add Purchase Order to Step</h3>
        {availablePOs.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No finalized purchase orders available. Go to Materials page to create and finalize purchase orders.</p>
        ) : (
          <div style={{ marginTop: '1rem' }}>
            <div style={{ border: '1px solid var(--border)', borderRadius: 4, maxHeight: '400px', overflow: 'auto' }}>
              {availablePOs.map(po => (
                <div
                  key={po.id}
                  onClick={() => onAdd(stepId, po.id)}
                  style={{
                    padding: '1rem',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    background: 'var(--surface)',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-subtle)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'var(--surface)'}
                >
                  <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{po.name}</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>${po.total.toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => onClose()}
            className="wf-btn-modal-secondary"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

function AddInvoicePicker({
  stepId,
  availableInvoices,
  onAdd,
  onClose,
}: {
  stepId: string
  availableInvoices: AvailableInvoiceOption[]
  onAdd: (stepId: string, invoiceId: string) => void
  onClose: () => void
}) {
  const [searchText, setSearchText] = useState('')
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 710, paddingTop: 'var(--app-top-chrome, 0px)' }}>
      <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: '90%', maxHeight: 'min(90vh, 100%)', overflow: 'auto' }}>
        <h3 style={{ marginTop: 0 }}>Add Supply House Invoice to Step</h3>
        {availableInvoices.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No supply house invoices available. Add invoices in Materials → Supply Houses.</p>
        ) : (
          <div style={{ marginTop: '1rem' }}>
            <input
              type="search"
              placeholder="Search by invoice #, supply house, amount, date, PO #, paid/unpaid..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', marginBottom: '0.75rem', borderRadius: 6, border: '1px solid var(--border)' }}
            />
            <div style={{ border: '1px solid var(--border)', borderRadius: 4, maxHeight: '400px', overflow: 'auto' }}>
              {(() => {
                const filtered = filterAvailableInvoices(availableInvoices, searchText)
                if (filtered.length === 0) {
                  return <p style={{ padding: '1rem', color: 'var(--text-muted)' }}>No matching invoices.</p>
                }
                return filtered.map(inv => (
                  <div
                    key={inv.id}
                    onClick={() => onAdd(stepId, inv.id)}
                    style={{
                      padding: '1rem',
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      background: 'var(--surface)',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-subtle)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'var(--surface)'}
                  >
                    {/* Primary: supply house, date, amount, PO */}
                    <div style={{ fontWeight: 600, marginBottom: '0.25rem', fontSize: '0.875rem' }}>
                      {inv.supply_house_name}
                      <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> · {formatDateShort(inv.invoice_date)} · ${inv.amount.toFixed(2)}</span>
                      {inv.purchase_order_number && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> · {inv.purchase_order_number}</span>}
                    </div>
                    {/* Secondary: invoice #, due, paid */}
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-faint)', display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem' }}>
                      <span>#{inv.invoice_number}</span>
                      {inv.due_date && <span>Due {formatDateShort(inv.due_date)}</span>}
                      {inv.is_paid && <span style={{ color: 'var(--text-green-600)', fontWeight: 500 }}>Paid</span>}
                    </div>
                  </div>
                ))
              })()}
            </div>
          </div>
        )}
        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => onClose()}
            className="wf-btn-modal-secondary"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

function PurchaseOrderDetailWindow({ po, onClose }: { po: PODetail; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 710, paddingTop: 'var(--app-top-chrome, 0px)' }}>
      <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '2rem', borderRadius: 8, maxWidth: '800px', width: '90%', maxHeight: 'min(90vh, 100%)', overflow: 'auto' }}>
        <h2 style={{ marginBottom: '1rem' }}>{po.name}</h2>
        <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden', marginBottom: '1rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: 'var(--bg-subtle)' }}>
              <tr>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Part</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Quantity</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Supply House</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Price</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {po.items.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.75rem' }}>{item.part.name}</td>
                  <td style={{ padding: '0.75rem' }}>{item.quantity}</td>
                  <td style={{ padding: '0.75rem' }}>{item.supply_house?.name || '-'}</td>
                  <td style={{ padding: '0.75rem' }}>${item.price_at_time.toFixed(2)}</td>
                  <td style={{ padding: '0.75rem', fontWeight: 600 }}>${(item.price_at_time * item.quantity).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot style={{ background: 'var(--bg-subtle)' }}>
              <tr>
                <td colSpan={4} style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>Grand Total:</td>
                <td style={{ padding: '0.75rem', fontWeight: 600 }}>
                  ${po.items.reduce((sum, item) => sum + (item.price_at_time * item.quantity), 0).toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => onClose()}
            className="wf-btn-modal-secondary"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function InvoiceDetailWindow({ invoice, onClose }: { invoice: InvoiceDetail; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 710, paddingTop: 'var(--app-top-chrome, 0px)' }}>
      <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '2rem', borderRadius: 8, minWidth: 320, maxWidth: '90%' }}>
        <h2 style={{ marginBottom: '1rem' }}>Invoice #{invoice.invoice_number}</h2>
        <div style={{ marginBottom: '1rem', fontSize: '0.9375rem' }}>
          <div style={{ marginBottom: '0.5rem' }}><strong>Supply House:</strong> {invoice.supply_house_name}</div>
          <div style={{ marginBottom: '0.5rem' }}><strong>Amount:</strong> {formatAmount(invoice.amount)}</div>
          {invoice.link && (
            <div>
              <a href={normalizeUrl(invoice.link)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-blue-500)' }}>
                View invoice link
              </a>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => onClose()}
            className="wf-btn-modal-secondary"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export function WorkflowLineItemModals(props: WorkflowLineItemModalsProps) {
  return (
    <>
      {props.confirmDeleteLineItem && (
        <DeleteLineItemConfirm
          pending={props.confirmDeleteLineItem}
          onDelete={props.onDeleteLineItem}
          onClose={props.onCloseDeleteLineItem}
        />
      )}
      {props.editingLineItem && (
        <EditLineItemWindow
          editing={props.editingLineItem}
          onChange={props.onChangeEditingLineItem}
          onSave={props.onSaveLineItem}
          onImportPastedLineItems={props.onImportPastedLineItems}
          onError={props.onError}
        />
      )}
      {props.addingPOToStep && (
        <AddPurchaseOrderPicker
          stepId={props.addingPOToStep}
          availablePOs={props.availablePOs}
          onAdd={props.onAddPOToStep}
          onClose={props.onCloseAddPO}
        />
      )}
      {props.addingInvoiceToStep && (
        <AddInvoicePicker
          stepId={props.addingInvoiceToStep}
          availableInvoices={props.availableInvoices}
          onAdd={props.onAddInvoiceToStep}
          onClose={props.onCloseAddInvoice}
        />
      )}
      {props.viewingPO && <PurchaseOrderDetailWindow po={props.viewingPO} onClose={props.onCloseViewPO} />}
      {props.viewingInvoice && <InvoiceDetailWindow invoice={props.viewingInvoice} onClose={props.onCloseViewInvoice} />}
    </>
  )
}
