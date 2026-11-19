/**
 * The Supply houses tab's Add / Edit invoice window (SupplyHousesTab map, extraction step 8).
 *
 * The form's JSX, moved from `SupplyHousesTab` as it stood. It draws only: every field, flag and handler comes from
 * the form's engine (`useSupplyHouseInvoiceForm`), handed in whole as `form` and read under the names the tab used,
 * and the open house with its bills and its PO ledger comes from the tab. It holds no state of its own, so closing
 * and opening it loses nothing.
 */
import type { ReactNode } from 'react'
import { CreditPairPick } from './CreditPairPick'
import { AlertCircle } from 'lucide-react'
import { billTint, fillCounts } from '../../lib/materials/bills/billFill'
import { billsForHouse } from '../../lib/materials/bills/billsToRecord'
import { ticketStartChipWords } from '../../lib/tickets/ticketRowWords'
import { LEGEND, NO_PDF_LINE, PDF_PANE_NOTE, START_WORDS, STATUS_YOURS, countLine, dueWords, duplicateWords, houseWords, jobAccountGuessWords, jobFromPairWords, jobGuessWords, jobSettledWords, pairGuessWords, pairMissingWords, paperworkWords, statementWords, sumWords } from '../../lib/materials/bills/billWords'
import { PdfPageCanvas } from '../contracts/formStudio/PdfPageCanvas'
import { STATED_NEED_COLUMN, STATED_NEED_NONE_WRITTEN } from '../../lib/materials/poCodeStatedNeed'
import { DEFAULT_JOB_LEDGER_PREFIX, effectiveJobLedgerNumber, formatJobLedgerNumberLabel } from '../../lib/ledgerDisplayPrefixes'
import { stripTrailingZip } from '../../lib/displayAddress'
import { UnifiedSearchResultRow } from '../search/UnifiedSearchResultRow'
import { STICKY_MODAL_CLOSE_BUTTON_STYLE, stickyModalHeaderStyle, stickyModalPanelStyle } from '../../lib/stickyModalHeaderStyle'
import {
  addAllocation,
  allocationTotal,
  dueDateHint,
  paidOnYmdFromIso,
  poCodeHint,
  poCodeHintText,
  poLedgerEntryCard,
  poLedgerEntryJobMismatch,
  poLedgerJobMatches,
  removeAllocation,
  setAllocationPct,
  type PoLedgerEntriesByCode,
  type SupplyDocumentKind,
} from '../../lib/materials/supplyHouseInvoiceForm'
import { MarkJobAccountOpenedModal } from './MarkJobAccountOpenedModal'
import { openedViaPhrase } from '../../lib/materials/jobSupplyHouseAccounts'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import type { SupplyHouse, SupplyHouseInvoiceForm, SupplyHouseInvoiceWithAllocations } from './useSupplyHouseInvoiceForm'

const INVOICE_INPUT_STYLE = { width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box' as const }
const INVOICE_LABEL_STYLE = { display: 'block', marginBottom: '0.25rem', fontWeight: 500 }

/** The Add / Edit Invoice form reads in the order the paper does — each group gets a small rule-off caption (v2.3474). */
function InvoiceFormSection({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.6875rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, margin: '0.25rem 0 0.5rem' }}>
      {children}
      <span aria-hidden style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  )
}

export interface SupplyHouseInvoiceFormModalProps {
  /** The form's engine, whole. */
  form: SupplyHouseInvoiceForm
  selectedSupplyHouseForDetail: SupplyHouse | null
  supplyHouseInvoices: SupplyHouseInvoiceWithAllocations[]
  poGeneratorEntriesForSelectedHouse: PoLedgerEntriesByCode | null
  poGeneratorCodesForSelectedHouse: ReadonlySet<number> | null
  narrowAging: boolean
}

export function SupplyHouseInvoiceFormModal({ form, selectedSupplyHouseForDetail, supplyHouseInvoices, poGeneratorEntriesForSelectedHouse, poGeneratorCodesForSelectedHouse, narrowAging }: SupplyHouseInvoiceFormModalProps) {
  const {
    billFillOn,
    billCandidates,
    billPick,
    ticketBills,
    billBusy,
    billRefusal,
    billRead,
    billPlan,
    billFields,
    billPane,
    billDriveInstead,
    setBillDriveInstead,
    billFileInputRef,
    invoiceFormOpen,
    editingInvoice,
    invoiceNumber,
    setInvoiceNumber,
    invoiceDate,
    setInvoiceDate,
    invoiceDueDate,
    setInvoiceDueDate,
    invoiceAmount,
    setInvoiceAmount,
    invoiceDocumentKind,
    setInvoiceDocumentKind,
    invoiceCreditsInvoiceId,
    setInvoiceCreditsInvoiceId,
    invoicePurchaseOrderNumber,
    setInvoicePurchaseOrderNumber,
    invoiceLink,
    setInvoiceLink,
    invoiceIsPaid,
    setInvoiceIsPaid,
    invoicePaidOn,
    setInvoicePaidOn,
    invoiceOnJobAccount,
    setInvoiceOnJobAccount,
    invoiceJobAllocations,
    setInvoiceJobAllocations,
    invoiceJobSearchText,
    setInvoiceJobSearchText,
    invoiceJobSearchResults,
    invoiceJobPrefixMap,
    invoiceJobEvidence,
    invoiceJobEvidenceMode,
    invoiceSingleAllocatedJobId,
    invoiceJobAccount,
    setInvoiceJobAccount,
    invoiceJobAccountKey,
    invoiceJobAccountReps,
    invoiceMarkOpenedOpen,
    setInvoiceMarkOpenedOpen,
    invoiceOnJobAccountTouchedRef,
    invoiceJobDetailsMap,
    setInvoiceJobDetailsMap,
    savingInvoice,
    invoiceIsInterest,
    setInvoiceIsInterest,
    invoiceLateInvoiceId,
    setInvoiceLateInvoiceId,
    editingTypedPaid,
    invoiceWords,
    creditEffect,
    closeInvoiceForm,
    markBillTyped,
    pickThreadBill,
    pickUploadedBill,
    pickTicketBill,
    pickNoPdf,
    settleJob,
    pickAnotherJob,
    settlePair,
    saveInvoice,
    deleteInvoice,
  } = form
  if (!invoiceFormOpen || !selectedSupplyHouseForDetail) return null
  const house = selectedSupplyHouseForDetail
  const poHintKind = poCodeHint(invoicePurchaseOrderNumber, poGeneratorCodesForSelectedHouse)
  const poHint = poCodeHintText(poHintKind, house.name)
  const poHintTone = poHintKind.kind
  const poEntryCard = poLedgerEntryCard(poHintKind, poGeneratorEntriesForSelectedHouse)
  // v2.3724: the ledger read against the job the invoice is on — the exact code's job must agree,
  // and when the paper carries no code (the house printed the job name) the codes for that job near the date.
  const poJobIds = invoiceJobAllocations.map((a) => a.job_id)
  const poJobMismatch = poLedgerEntryJobMismatch(poHintKind, poGeneratorEntriesForSelectedHouse, poJobIds)
  const poJobMatches = poLedgerJobMatches({ hint: poHintKind, entries: poGeneratorEntriesForSelectedHouse, jobIds: poJobIds, invoiceDateYmd: invoiceDate, houseName: house.name })
  const dueHint = dueDateHint(house.name, house.monthly_payment_day)
  const showPct = invoiceJobAllocations.length >= 2
  const flagOn = invoiceOnJobAccount && invoiceSingleAllocatedJobId != null
  const pdfHref = /^https?:\/\//i.test(invoiceLink.trim()) ? invoiceLink.trim() : null
  const searchOpen = invoiceJobSearchText.trim().length > 0
  // Supply-house bill capture (punch list #179): the checks as sentences under the fields, and Save still works.
  const houseBills = billsForHouse(billCandidates, house.id)
  const billChipStyle = (on: boolean) => ({ font: 'inherit', fontSize: '0.78rem', fontWeight: 600, padding: '0.2rem 0.65rem', borderRadius: 999, border: `1px solid ${on ? 'var(--border-blue)' : 'var(--border-strong)'}`, background: on ? 'var(--bg-blue-200)' : 'var(--surface)', color: on ? 'var(--text-blue-700)' : 'var(--text-base)', cursor: 'pointer' }) as const
  const sum = billPlan ? sumWords(billPlan.checks.sum, invoiceDocumentKind) : null
  const dup = billPlan?.checks.duplicate ? duplicateWords(billPlan.checks.duplicate, house.name) : null
  const dupRow = billPlan?.checks.duplicate ? supplyHouseInvoices.find((r) => r.id === billPlan.checks.duplicate!.invoiceId) : null
  const billSentences = billRead && billPlan ? (
    <div data-bill-sentences style={{ display: 'grid', gap: '0.3rem', margin: '-0.25rem 0 0.75rem', fontSize: '0.75rem' }}>
      {dup ? (
        <div data-bill-duplicate style={{ padding: '0.3rem 0.5rem', borderRadius: 4, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span>{dup.line}</span>
          {dupRow?.link ? <a href={dupRow.link} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, color: 'inherit' }}>{dup.press}</a> : null}
        </div>
      ) : null}
      {billPlan.checks.house === 'other' ? <div data-bill-house style={{ padding: '0.3rem 0.5rem', borderRadius: 4, background: 'var(--bg-red-tint)', color: 'var(--text-red-800)' }}>{houseWords(billRead.read.houseName, house.name)}</div> : null}
      {sum ? (
        <div data-bill-sum={sum.tone} style={{ padding: '0.3rem 0.5rem', borderRadius: 4, background: sum.tone === 'right' ? 'var(--bg-green-tint)' : 'var(--bg-amber-tint)', color: sum.tone === 'right' ? 'var(--text-green-800)' : 'var(--text-amber-800)', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span>{sum.line}</span>
          {sum.presses && billPlan.checks.sum.kind === 'off' ? (
            <>
              <button type="button" onClick={() => { const v = (billPlan.checks.sum as { sumCents: number }).sumCents; setInvoiceAmount((v / 100).toFixed(2)); markBillTyped('amount', (v / 100).toFixed(2)) }} style={{ font: 'inherit', fontSize: '0.72rem', fontWeight: 600, padding: '0.1rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-base)', cursor: 'pointer' }}>{sum.presses.useSum}</button>
              <button type="button" onClick={() => { const v = (billPlan.checks.sum as { totalCents: number }).totalCents; setInvoiceAmount((v / 100).toFixed(2)); markBillTyped('amount', (v / 100).toFixed(2)) }} style={{ font: 'inherit', fontSize: '0.72rem', fontWeight: 600, padding: '0.1rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-base)', cursor: 'pointer' }}>{sum.presses.keepTotal}</button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  ) : null
  const billPairLine = billRead && billPlan && invoiceDocumentKind === 'credit' ? (
    billFields.creditsInvoice.source === 'guessed' && billPlan.pair ? (
      <div data-bill-pair style={{ margin: '-0.5rem 0 0.75rem', padding: '0.3rem 0.5rem', borderRadius: 4, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', fontSize: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span>{pairGuessWords(billRead.read.referencesNumber).line}</span>
        <button type="button" onClick={() => settlePair(billPlan.pair!.invoiceId)} style={{ font: 'inherit', fontSize: '0.72rem', fontWeight: 600, padding: '0.1rem 0.5rem', border: '1px solid var(--border-green)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-green-800)', cursor: 'pointer' }}>{pairGuessWords(billRead.read.referencesNumber).yes}</button>
      </div>
    ) : billRead.read.referencesNumber && !billPlan.pair && billFields.creditsInvoice.source !== 'typed' ? (
      <div data-bill-pair-missing style={{ margin: '-0.5rem 0 0.75rem', fontSize: '0.75rem', color: 'var(--text-amber-800)' }}>{pairMissingWords(billRead.read.referencesNumber)}</div>
    ) : null
  ) : null
  const billDueHint = billPlan ? dueWords(billPlan.due, house.name, house.monthly_payment_day, invoiceDocumentKind) : null
  return (
  <div style={{ position: 'fixed', inset: 0, padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1003 }}>
    {/* This panel is the scroller — the form outgrew short screens once the job-account block landed (v2.2669)
        and a centered, unscrollable panel clipped both ends; the title bar and the Save footer stick (v2.990 pattern). */}
    <div role="dialog" aria-modal="true" aria-label={invoiceWords.title(editingInvoice != null)} style={{ background: 'var(--surface)', borderRadius: 8, maxHeight: 'min(90vh, 100%)', overflow: 'auto', ...stickyModalPanelStyle(560) }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', ...stickyModalHeaderStyle() }}>
        <div>
          <h3 style={{ margin: 0 }}>{invoiceWords.title(editingInvoice != null)}</h3>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            {house.name}{editingInvoice?.invoice_number ? ` · ${editingInvoice.invoice_number}` : ''}
          </p>
        </div>
        <button type="button" onClick={closeInvoiceForm} style={STICKY_MODAL_CLOSE_BUTTON_STYLE} aria-label="Close">×</button>
      </div>
      <form onSubmit={saveInvoice}>
        {/* The bill (punch list #179, v2.6095): the form's first question. Start from a file on the house's thread, another file, or no PDF. */}
        {billFillOn && !editingInvoice ? (
          <div data-bill-section>
            <InvoiceFormSection>{START_WORDS.section}</InvoiceFormSection>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', fontSize: '0.8125rem', marginBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>{START_WORDS.startFrom}</span>
              {houseBills.map((c) => {
                const on = billPick !== null && billPick !== 'none' && billPick.source === 'thread' && billPick.attachmentId === c.attachmentId
                return (
                  <button key={c.attachmentId} type="button" data-bill-chip={c.attachmentId} disabled={billBusy} onClick={() => pickThreadBill(c)} style={billChipStyle(on)}>
                    {c.chip}
                  </button>
                )
              })}
              {ticketBills.map((t) => {
                const on = billPick !== null && billPick !== 'none' && billPick.source === 'ticket' && billPick.ticketId === t.id
                return (
                  <button key={t.id} type="button" data-ticket-chip={t.id} disabled={billBusy} onClick={() => void pickTicketBill(t)} style={billChipStyle(on)}>
                    {ticketStartChipWords(t, t.po?.po_code ?? null)}
                  </button>
                )
              })}
              <button type="button" disabled={billBusy} onClick={() => billFileInputRef.current?.click()} style={billChipStyle(billPick !== null && billPick !== 'none' && billPick.source === 'upload')}>
                {billPick !== null && billPick !== 'none' && billPick.source === 'upload' ? billPick.name : START_WORDS.anotherFile}
              </button>
              <input
                ref={billFileInputRef}
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/gif,image/webp"
                aria-label={START_WORDS.anotherFile}
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (f) void pickUploadedBill(f)
                }}
              />
              <button type="button" disabled={billBusy} onClick={pickNoPdf} style={billChipStyle(billPick === 'none')}>
                {START_WORDS.noPdf}
              </button>
            </div>
            {billBusy ? <div role="status" style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{START_WORDS.reading}</div> : null}
            {billRefusal ? <div role="status" data-bill-refusal style={{ fontSize: '0.8125rem', padding: '0.4rem 0.6rem', borderRadius: 6, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', marginBottom: '0.5rem' }}>{billRefusal}</div> : null}
            {billRead && billPlan ? (
              <div data-bill-count style={{ fontSize: '0.8125rem', padding: '0.4rem 0.6rem', borderRadius: 6, background: 'var(--bg-subtle)', border: '1px solid var(--border)', marginBottom: '0.5rem' }}>{countLine(fillCounts(billFields, billPlan.checks))}</div>
            ) : billPick === 'none' ? (
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{NO_PDF_LINE}</div>
            ) : null}
            {billPlan?.checks.statement ? <div data-bill-statement style={{ fontSize: '0.8125rem', padding: '0.4rem 0.6rem', borderRadius: 6, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', marginBottom: '0.5rem' }}>{statementWords(billPlan.checks.statement.numbers)}</div> : null}
          </div>
        ) : null}
        <div style={{ display: 'grid', gridTemplateColumns: billPane && !narrowAging ? '200px minmax(0, 1fr)' : '1fr', gap: '0.75rem', alignItems: 'start' }}>
        {billPane ? (
          <div data-bill-pane style={{ background: 'var(--bg-subtle)', padding: '0.5rem', borderRadius: 8, overflow: 'hidden' }}>
            {narrowAging ? (
              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', fontSize: '0.8125rem' }}>
                <span style={{ fontWeight: 600, minWidth: 0, overflowWrap: 'anywhere' }}>{billRead?.file.name}</span>
                <a href={billPane.href} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 'auto', fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 6, color: 'var(--text-base)', textDecoration: 'none', whiteSpace: 'nowrap' }}>Open</a>
              </div>
            ) : billPane.kind === 'pdf' ? (
              <a href={billPane.href} target="_blank" rel="noopener noreferrer" title="Open the whole file" style={{ display: 'block' }}>
                <PdfPageCanvas bytes={billPane.bytes} page={1} scale={0.3} />
              </a>
            ) : (
              <a href={billPane.href} target="_blank" rel="noopener noreferrer" title="Open the whole file" style={{ display: 'block' }}>
                <img src={billPane.url} alt="" style={{ width: '100%', display: 'block', borderRadius: 4 }} />
              </a>
            )}
            {!narrowAging ? <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>{PDF_PANE_NOTE}</div> : null}
          </div>
        ) : null}
        <div style={{ minWidth: 0 }}>
        {/* ① The fields in the order they sit on the paper: number · date · amount, then the PO. */}
        {/* ⓪ What the paper is (v2.3503). The sign is derived from this, never typed. */}
        <InvoiceFormSection>What the paper is</InvoiceFormSection>
        <div style={{ marginBottom: '0.75rem' }}>
          <div role="radiogroup" aria-label="Document kind" style={{ display: 'flex', border: '1px solid var(--border-strong)', borderRadius: 5, overflow: 'hidden', ...(billFields.kind.source === 'read' ? { borderLeft: '3px solid var(--border-green)' } : {}) }}>
            {(['invoice', 'credit'] as SupplyDocumentKind[]).map((k, i) => {
              const on = invoiceDocumentKind === k
              return (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    setInvoiceDocumentKind(k)
                    markBillTyped('kind', k)
                  }}
                  style={{
                    flex: 1,
                    padding: '0.45rem 0.5rem',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: 'none',
                    borderLeft: i === 0 ? 'none' : '1px solid var(--border-strong)',
                    background: on ? (k === 'credit' ? 'var(--bg-green-200)' : 'var(--bg-blue-200)') : 'var(--bg-subtle)',
                    color: on ? (k === 'credit' ? 'var(--text-green-700)' : 'var(--text-blue-700)') : 'var(--text-muted)',
                  }}
                >
                  {k === 'invoice' ? 'Invoice' : 'Credit'}
                </button>
              )
            })}
          </div>
          {invoiceDocumentKind === 'credit' ? (
            <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              A credit memo, a return, or a price correction the house issued. Type the amount as a positive number.
            </div>
          ) : null}
        </div>
        <InvoiceFormSection>{invoiceDocumentKind === 'credit' ? 'From the credit' : 'From the invoice'}</InvoiceFormSection>
        <div style={{ display: 'grid', gridTemplateColumns: narrowAging ? '1fr' : '1.2fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div>
            <label htmlFor="invoice-number" style={{ ...INVOICE_LABEL_STYLE, whiteSpace: 'nowrap' }}>{invoiceWords.numberLabel} *</label>
            <input id="invoice-number" type="text" value={invoiceNumber} onChange={(e) => { setInvoiceNumber(e.target.value); markBillTyped('number', e.target.value) }} required style={{ ...INVOICE_INPUT_STYLE, ...billTint(billFields.number.source) }} />
          </div>
          <div>
            <label htmlFor="invoice-date" style={INVOICE_LABEL_STYLE}>{invoiceWords.dateLabel} *</label>
            <input id="invoice-date" type="date" value={invoiceDate} onChange={(e) => { setInvoiceDate(e.target.value); markBillTyped('date', e.target.value) }} required style={{ ...INVOICE_INPUT_STYLE, ...billTint(billFields.date.source) }} />
          </div>
          <div>
            <label htmlFor="invoice-amount" style={INVOICE_LABEL_STYLE}>Amount *</label>
            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border-strong)', borderRadius: 4, paddingLeft: '0.5rem', background: 'var(--surface)', ...billTint(billPlan?.checks.sum.kind === 'off' && billFields.amount.source === 'read' ? 'guessed' : billFields.amount.source) }}>
              <span aria-hidden style={{ color: invoiceDocumentKind === 'credit' ? 'var(--text-green-700)' : 'var(--text-muted)', fontWeight: invoiceDocumentKind === 'credit' ? 600 : 400, whiteSpace: 'nowrap' }}>{invoiceWords.amountAdornment}</span>
              <input
                id="invoice-amount"
                type="number"
                step="0.01"
                min={0}
                inputMode="decimal"
                value={invoiceAmount}
                onChange={(e) => {
                  setInvoiceAmount(e.target.value)
                  markBillTyped('amount', e.target.value)
                }}
                required
                style={{ flex: 1, minWidth: 0, padding: '0.5rem', border: 'none', background: 'transparent', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontFamily: 'inherit', color: 'inherit' }}
              />
            </div>
          </div>
        </div>
        {billSentences}
        {invoiceDocumentKind === 'credit' ? (
          <>
            <CreditPairPick rows={supplyHouseInvoices} creditId={editingInvoice?.id ?? null} value={invoiceCreditsInvoiceId} onChange={(v) => { setInvoiceCreditsInvoiceId(v); markBillTyped('creditsInvoice', v) }} />
            {billPairLine}
          </>
        ) : null}
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="invoice-po" style={INVOICE_LABEL_STYLE}>Purchase order #</label>
          <input id="invoice-po" type="text" value={invoicePurchaseOrderNumber} onChange={(e) => { setInvoicePurchaseOrderNumber(e.target.value); markBillTyped('purchaseOrder', e.target.value) }} placeholder="e.g. PO-12345" style={{ ...INVOICE_INPUT_STYLE, ...billTint(billFields.purchaseOrder.source) }} />
          {/* ② The PO Generator check, while she types — the table's red icon only ever showed after Save. */}
          {poHint ? (
            <div
              data-invoice-po-hint={poHintTone}
              style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: poHintTone === 'not_on_ledger' ? 'var(--text-red-800)' : poHintTone === 'on_ledger' ? 'var(--text-green-800)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
            >
              {poHintTone === 'not_on_ledger' ? <AlertCircle size={13} color="#dc2626" aria-hidden style={{ flexShrink: 0 }} /> : null}
              {poHint}
            </div>
          ) : null}
          {/* ②b The matched ledger row (v2.3599): what the code was minted for, so the amount above can be read against it. */}
          {poEntryCard ? (
            <div
              data-invoice-po-entry
              style={{ marginTop: '0.4rem', padding: '0.5rem 0.65rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--bg-subtle)', fontSize: '0.8125rem' }}
            >
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
                <span style={{ fontWeight: 600 }}>{poEntryCard.head}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{poEntryCard.meta}</span>
              </div>
              <div style={{ marginTop: '0.25rem', paddingLeft: '0.6rem', borderLeft: '3px solid var(--border-strong)' }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{STATED_NEED_COLUMN}</div>
                {poEntryCard.statedNeed ? (
                  <div style={{ whiteSpace: 'pre-wrap' }}>{poEntryCard.statedNeed}</div>
                ) : (
                  <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{STATED_NEED_NONE_WRITTEN}</div>
                )}
              </div>
              {poJobMismatch ? (
                <div data-invoice-po-job-mismatch style={{ marginTop: '0.4rem', padding: '0.35rem 0.5rem', borderRadius: 5, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', fontSize: '0.8125rem' }}>
                  {poJobMismatch}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* ③ Inline job search; the job becomes a card. Percent fields only once there are two jobs to split. */}
        <InvoiceFormSection>Which job</InvoiceFormSection>
        <input
          id="invoice-job-search"
          type="search"
          placeholder="Add a job — J#, name or address…"
          aria-label="Add a job"
          value={invoiceJobSearchText}
          onChange={(e) => setInvoiceJobSearchText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && invoiceJobSearchText) {
              e.preventDefault()
              e.stopPropagation()
              setInvoiceJobSearchText('')
            }
            // Enter in the search box must not submit the invoice.
            if (e.key === 'Enter') e.preventDefault()
          }}
          style={{ ...INVOICE_INPUT_STYLE, marginBottom: '0.5rem' }}
        />
        {searchOpen ? (
          <div role="listbox" aria-label="Matching jobs" style={{ maxHeight: 240, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 6, marginBottom: '0.5rem' }}>
            {invoiceJobSearchResults.length === 0 ? (
              <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Searching…</div>
            ) : (
              invoiceJobSearchResults.map((j) => {
                const already = invoiceJobAllocations.some((a) => a.job_id === j.id)
                return (
                  <button
                    key={j.id}
                    type="button"
                    role="option"
                    aria-selected={already}
                    disabled={already}
                    onClick={() => {
                      setInvoiceJobDetailsMap((prev) => ({ ...prev, [j.id]: { hcp_number: j.hcp_number, click_number: j.click_number, job_name: j.job_name, job_address: j.job_address } }))
                      setInvoiceJobAllocations((prev) => addAllocation(prev, j.id))
                      markBillTyped('job', j.id)
                      setInvoiceJobSearchText('')
                    }}
                    style={{ display: 'block', width: '100%', padding: '0.5rem 0.75rem', textAlign: 'left', border: 'none', borderBottom: '1px solid var(--border)', background: 'none', cursor: already ? 'default' : 'pointer', fontSize: '0.875rem', opacity: already ? 0.5 : 1, fontFamily: 'inherit', color: 'inherit' }}
                  >
                    <UnifiedSearchResultRow
                      result={{ source: 'job', ...j }}
                      prefixMap={invoiceJobPrefixMap}
                      jobEvidence={invoiceJobEvidence.get(j.id)}
                      evidenceMode={invoiceJobEvidenceMode}
                    />
                  </button>
                )
              })
            )}
          </div>
        ) : null}
        {invoiceJobAllocations.length === 0 ? (
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>{invoiceWords.noJobLine}</div>
        ) : null}
        {invoiceJobAllocations.map((a, idx) => {
          const details = invoiceJobDetailsMap[a.job_id]
          // Plain J prefix, like the search row above it (the per-trade JP/JE prefixes belong on the ledger pages).
          const label = details
            ? `${formatJobLedgerNumberLabel(DEFAULT_JOB_LEDGER_PREFIX, details.hcp_number, details.click_number)} · ${details.job_name || '—'}`
            : a.job_id.slice(0, 8)
          const isSingle = invoiceSingleAllocatedJobId === a.job_id
          // Supply-house bill capture (punch list #179): a job the fill guessed asks for a look; one the person answered, or one a credit took from its invoice, says so.
          const jobLook = billFields.job.value === a.job_id ? billFields.job.source : 'none'
          const jobLabelFull = details ? label : (billPlan?.job?.code != null ? poGeneratorEntriesForSelectedHouse?.get(billPlan.job.code)?.jobLabel : undefined) ?? label
          const jobGuessed = jobLook === 'guessed' && billPlan?.job?.jobId === a.job_id
          const guessWords = jobGuessed && billPlan?.job ? jobGuessWords(billPlan.job, jobLabelFull) : null
          return (
            <div
              key={a.job_id}
              data-invoice-job-card
              data-bill-job={jobLook}
              style={{ border: `1px solid ${jobGuessed ? 'var(--border-amber-soft)' : 'var(--border)'}`, borderLeft: `3px solid ${jobGuessed ? 'var(--border-amber-soft)' : isSingle && flagOn ? '#0f766e' : 'var(--border-strong)'}`, background: jobGuessed ? 'var(--bg-amber-tint)' : undefined, borderRadius: 6, padding: '0.6rem 0.75rem', marginBottom: '0.5rem' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem' }}>
                <strong style={{ fontSize: '0.9375rem' }}>{label}</strong>
                {guessWords ? <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-amber-800)' }}>{guessWords.check}</span> : jobLook === 'typed' && billRead ? <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f766e' }}>{jobSettledWords(jobLabelFull).check}</span> : jobLook === 'read' && billRead ? <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f766e' }}>{jobFromPairWords(jobLabelFull, billRead.read.referencesNumber).check}</span> : null}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                  {showPct ? (
                    <>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step="0.1"
                        aria-label={`Share of this invoice on ${label}`}
                        value={a.pct}
                        onChange={(e) => setInvoiceJobAllocations((prev) => setAllocationPct(prev, idx, parseFloat(e.target.value)))}
                        style={{ width: 56, padding: '0.15rem 0.25rem', fontSize: '0.875rem', border: '1px solid var(--border-strong)', borderRadius: 4, textAlign: 'right' }}
                      />
                      <span style={{ fontSize: '0.875rem' }}>%</span>
                    </>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setInvoiceJobAllocations((prev) => removeAllocation(prev, idx))
                      markBillTyped('job', '')
                    }}
                    style={{ padding: '0.1rem 0.3rem', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1rem', lineHeight: 1 }}
                    aria-label={`Remove ${label}`}
                    title="Remove job"
                  >
                    ×
                  </button>
                </span>
              </div>
              {details?.job_address ? <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{stripTrailingZip(details.job_address)}</div> : null}
              {guessWords ? (
                <div data-bill-job-guess style={{ marginTop: '0.4rem', fontSize: '0.8125rem', color: 'var(--text-amber-800)' }}>
                  <div>{guessWords.line}</div>
                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => settleJob(a.job_id)} style={{ font: 'inherit', fontSize: '0.75rem', fontWeight: 600, padding: '0.15rem 0.6rem', border: '1px solid var(--border-green)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-green-800)', cursor: 'pointer' }}>{guessWords.yes}</button>
                    <button type="button" onClick={pickAnotherJob} style={{ font: 'inherit', fontSize: '0.75rem', fontWeight: 600, padding: '0.15rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-base)', cursor: 'pointer' }}>{guessWords.another}</button>
                  </div>
                </div>
              ) : jobLook === 'typed' && billRead ? (
                <div style={{ marginTop: '0.3rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{jobSettledWords(jobLabelFull).line}</div>
              ) : jobLook === 'read' && billRead ? (
                <div style={{ marginTop: '0.3rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{jobFromPairWords(jobLabelFull, billRead.read.referencesNumber).line}</div>
              ) : null}
              {/* ④ The job account is a fact about this job at this house, so it lives on the job card. */}
              {isSingle ? (
                <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed var(--border)' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={flagOn}
                      onChange={(e) => {
                        invoiceOnJobAccountTouchedRef.current = true
                        setInvoiceOnJobAccount(e.target.checked)
                        markBillTyped('onJobAccount', String(e.target.checked))
                      }}
                      style={{ marginTop: 2, accentColor: '#0f766e' }}
                    />
                    <span>
                      <span style={{ fontWeight: 600, fontSize: '0.875rem', color: flagOn ? '#0f766e' : 'var(--text-base)' }}>On {house.name}'s job account</span>
                      {billFields.onJobAccount.source === 'guessed' ? <span data-bill-account-guess style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-amber-800)' }}>{jobAccountGuessWords(house.name).why}</span> : null}
                      <span style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>If this goes unpaid the house bills the property owner, not you.</span>
                    </span>
                  </label>
                  {invoiceJobAccountKey === `${a.job_id}:${house.id}` ? (
                    invoiceJobAccount?.status === 'open' ? (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.8125rem', padding: '0.4rem 0.55rem', borderRadius: 5, background: 'var(--bg-green-tint)', color: 'var(--text-green-800)' }} data-invoice-job-account="open">
                        <strong>Job account open at {house.name}</strong>
                        {invoiceJobAccount.account_ref ? ` · ref ${invoiceJobAccount.account_ref}` : ''}
                        {invoiceJobAccount.opened_at ? ` · ${openedViaPhrase(invoiceJobAccount.opened_via)} ${new Date(invoiceJobAccount.opened_at).toLocaleDateString()}` : ''}.
                        {!invoiceOnJobAccount ? ' The flag is off — untick only if this invoice is not on the account.' : ''}
                      </div>
                    ) : invoiceJobAccount?.status === 'not_needed' ? (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.8125rem', padding: '0.4rem 0.55rem', borderRadius: 5, background: 'var(--bg-muted)', color: 'var(--text-muted)' }} data-invoice-job-account="not_needed">
                        Marked <strong>not needed</strong> at {house.name}{invoiceJobAccount.note ? ` — ${invoiceJobAccount.note}` : ''}.
                      </div>
                    ) : (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.8125rem', padding: '0.4rem 0.55rem', borderRadius: 5, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }} data-invoice-job-account={invoiceJobAccount?.status === 'requested' ? 'requested' : 'none'}>
                        <span>
                          <strong>{invoiceJobAccount?.status === 'requested' ? 'Job account asked for, not open yet' : `No job account at ${house.name} on record for this job`}.</strong>{' '}
                          If the house opened one, mark it — the flag will default on from then.
                        </span>
                        <button
                          type="button"
                          onClick={() => setInvoiceMarkOpenedOpen(true)}
                          style={{ padding: '0.2rem 0.55rem', fontSize: '0.75rem', fontWeight: 600, background: '#0f766e', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          Mark opened…
                        </button>
                      </div>
                    )
                  ) : null}
                </div>
              ) : null}
            </div>
          )
        })}
        {/* ③b The codes for this job at this house near the invoice date (v2.3724) — the reader for the
            bills whose PO # is the job's name, not a code. Under the job cards, because it needs the job. */}
        {poJobMatches ? (
          <div data-invoice-po-job-matches style={{ marginBottom: '0.75rem', padding: '0.5rem 0.65rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-subtle)', fontSize: '0.8125rem' }}>
            <div style={{ color: poJobMatches.rows.length > 0 ? 'var(--text-strong)' : 'var(--text-muted)', fontWeight: poJobMatches.rows.length > 0 ? 600 : 400 }}>{poJobMatches.line}</div>
            {poJobMatches.rows.length > 0 ? (
              <ul style={{ listStyle: 'none', margin: '0.35rem 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {poJobMatches.rows.map((r) => (
                  <li key={r.code} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
                    <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>PO {r.code}</span>
                    {poJobMatches.showJob ? <span>{r.jobLabel}</span> : null}
                    <span style={{ color: 'var(--text-muted)' }}>for {r.personName}{r.when ? ` · ${r.when} (${r.apart})` : ''}</span>
                    {r.statedNeed ? <span>— {r.statedNeed}</span> : <span style={{ color: 'var(--text-faint)', fontStyle: 'italic' }}>— nothing written down</span>}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        {showPct ? (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 1rem' }}>
            Total: {allocationTotal(invoiceJobAllocations).toFixed(1)}% · Job accounts are per property — available when the invoice is on a single job.
          </div>
        ) : (
          <div style={{ height: '0.5rem' }} />
        )}
        {invoiceMarkOpenedOpen && invoiceSingleAllocatedJobId ? (
          <MarkJobAccountOpenedModal
            jobId={invoiceSingleAllocatedJobId}
            jobLabel={(() => {
              const d = invoiceJobDetailsMap[invoiceSingleAllocatedJobId]
              return d ? `${effectiveJobLedgerNumber(d.hcp_number, d.click_number) || '—'} · ${d.job_name || '—'}` : 'this job'
            })()}
            house={{ id: house.id, name: house.name }}
            existing={invoiceJobAccount}
            reps={invoiceJobAccountReps}
            onClose={() => setInvoiceMarkOpenedOpen(false)}
            onSaved={(row) => {
              setInvoiceMarkOpenedOpen(false)
              setInvoiceJobAccount(row)
              if (row.status === 'open' && !invoiceOnJobAccountTouchedRef.current) setInvoiceOnJobAccount(true)
            }}
          />
        ) : null}

        {/* ⑤ Paid is a status with a date (paid_at already exists); the due-date hint says where the prefill came from. */}
        {/* Interest or a late fee (2026-11-16): a bill of its own, tied to the bill that ran late, kept off every job's cost. */}
        {invoiceDocumentKind === 'invoice' ? (
          <div style={{ marginBottom: '1rem' }} data-testid="invoice-interest">
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.875rem' }}>
              <input type="checkbox" checked={invoiceIsInterest} onChange={(e) => setInvoiceIsInterest(e.target.checked)} />
              This is interest or a late fee
            </label>
            {invoiceIsInterest ? (
              <>
                <label style={{ display: 'block', marginTop: '0.4rem' }}>
                  <span style={INVOICE_LABEL_STYLE}>Which bill was late (optional)</span>
                  <select value={invoiceLateInvoiceId} onChange={(e) => setInvoiceLateInvoiceId(e.target.value)} style={{ ...INVOICE_INPUT_STYLE, width: 'auto', maxWidth: '100%' }}>
                    <option value="">Not tied to a bill</option>
                    {supplyHouseInvoices
                      .filter((row) => row.amount > 0 && !row.is_interest && row.id !== editingInvoice?.id)
                      .slice(0, 60)
                      .map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.invoice_number}
                        </option>
                      ))}
                  </select>
                </label>
                <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>It is owed and paid like any bill. It is kept off every job’s cost, so any job on it comes off when you save.</div>
              </>
            ) : null}
          </div>
        ) : null}
        <InvoiceFormSection>{invoiceWords.statusCaption}</InvoiceFormSection>
        <div style={{ display: 'grid', gridTemplateColumns: narrowAging ? '1fr' : '1fr 1.6fr', gap: '0.75rem', marginBottom: '1rem' }}>
          <div>
            <label htmlFor="invoice-due" style={INVOICE_LABEL_STYLE}>Due date</label>
            <input id="invoice-due" type="date" value={invoiceDueDate} onChange={(e) => { setInvoiceDueDate(e.target.value); markBillTyped('dueDate', e.target.value) }} style={{ ...INVOICE_INPUT_STYLE, ...billTint(billFields.dueDate.source) }} />
            {billDueHint ?? dueHint ? <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{billDueHint ?? dueHint}</div> : null}
          </div>
          <fieldset style={{ border: 'none', padding: 0, margin: 0, minWidth: 0 }}>
            <legend style={INVOICE_LABEL_STYLE}>Status{billRead ? <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> · {STATUS_YOURS}</span> : null}</legend>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem 1rem', minHeight: 36 }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input id="invoice-status-unpaid" type="radio" name="invoice-paid-status" checked={!invoiceIsPaid} disabled={editingTypedPaid} onChange={() => { setInvoiceIsPaid(false); setInvoicePaidOn('') }} />
                {invoiceWords.openLabel}
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  id="invoice-status-paid"
                  type="radio"
                  name="invoice-paid-status"
                  checked={invoiceIsPaid}
                  disabled={editingTypedPaid}
                  onChange={() => {
                    setInvoiceIsPaid(true)
                    if (!invoicePaidOn) setInvoicePaidOn(paidOnYmdFromIso(editingInvoice?.paid_at) || todayYmdInAppTz())
                  }}
                />
                {invoiceWords.closedLabel}
              </label>
              <input
                id="invoice-paid-on"
                type="date"
                aria-label="Paid on"
                value={invoicePaidOn}
                disabled={!invoiceIsPaid || editingTypedPaid}
                onChange={(e) => setInvoicePaidOn(e.target.value)}
                style={{ ...INVOICE_INPUT_STYLE, width: 'auto', padding: '0.3rem 0.4rem', marginLeft: '-0.5rem', opacity: invoiceIsPaid ? 1 : 0.5 }}
              />
            </div>
            {editingTypedPaid ? (
              <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)' }} data-testid="invoice-paid-by-payment">
                A recorded payment paid this bill, so its status and paid day follow that payment. Press See the payment on the bill’s row to change it.
              </div>
            ) : null}
          </fieldset>
        </div>

        {/* ⑥ Every link here is the scanned invoice on Drive — name it, and give her a way to glance at it. */}
        <InvoiceFormSection>Paperwork</InvoiceFormSection>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="invoice-link" style={INVOICE_LABEL_STYLE}>{invoiceWords.documentPdfLabel}</label>
          {billRead && !billDriveInstead ? (
            <div data-bill-paperwork style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.8125rem', padding: '0.45rem 0.6rem', borderRadius: 4, ...billTint('read') }}>
              <span>{paperworkWords(invoiceDocumentKind, billRead.file.name, billRead.file.attachmentId != null).line}</span>
              <button type="button" onClick={() => { setBillDriveInstead(true); setInvoiceLink(''); markBillTyped('link', '') }} style={{ font: 'inherit', fontSize: '0.75rem', fontWeight: 600, padding: '0.1rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-base)', cursor: 'pointer' }}>{paperworkWords(invoiceDocumentKind, billRead.file.name, false).press}</button>
            </div>
          ) : (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch' }}>
            <input id="invoice-link" type="url" value={invoiceLink} onChange={(e) => { setInvoiceLink(e.target.value); markBillTyped('link', e.target.value) }} placeholder="https://drive.google.com/…" style={{ ...INVOICE_INPUT_STYLE, flex: 1, minWidth: 0 }} />
            {pdfHref ? (
              <a href={pdfHref} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', padding: '0 0.75rem', fontSize: '0.8125rem', fontWeight: 500, border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-base)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                Open ↗
              </a>
            ) : null}
            {billRead && billDriveInstead ? (
              <button type="button" onClick={() => { setBillDriveInstead(false); setInvoiceLink(billPlan?.fields.link.value ?? ''); markBillTyped('link', billPlan?.fields.link.value ?? '') }} style={{ font: 'inherit', fontSize: '0.75rem', fontWeight: 600, padding: '0 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-base)', cursor: 'pointer', whiteSpace: 'nowrap' }}>Use our copy</button>
            ) : null}
          </div>
          )}
        </div>

        {/* ⑧ What this credit does, in the office's words, while a wrong house or job can still be fixed. */}
        {invoiceDocumentKind === 'credit' && creditEffect ? (
          <div
            role="status"
            style={{
              margin: '0 0 1rem',
              border: '1px solid var(--border-green)',
              background: 'var(--bg-green-tint)',
              borderRadius: 5,
              padding: '0.6rem 0.75rem',
              fontSize: '0.8125rem',
              color: 'var(--text-green-700)',
              display: 'flex',
              gap: '0.5rem',
            }}
          >
            <span aria-hidden style={{ fontWeight: 700 }}>&rarr;</span>
            <span>{creditEffect}</span>
          </div>
        ) : null}

        {billRead ? (
          <div data-bill-legend style={{ display: 'flex', gap: '0.9rem', flexWrap: 'wrap', fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0 0 0.75rem' }}>
            <span><span aria-hidden style={{ display: 'inline-block', width: 11, height: 11, verticalAlign: -1, marginRight: 4, borderRadius: 2, ...billTint('read') }} />{LEGEND.paper}</span>
            <span><span aria-hidden style={{ display: 'inline-block', width: 11, height: 11, verticalAlign: -1, marginRight: 4, borderRadius: 2, ...billTint('guessed') }} />{LEGEND.guess}</span>
            <span><span aria-hidden style={{ display: 'inline-block', width: 11, height: 11, verticalAlign: -1, marginRight: 4, borderRadius: 2, border: '1px solid var(--border-strong)' }} />{LEGEND.yours}</span>
          </div>
        ) : null}
        </div>
        </div>
        {/* ⑦ Save never scrolls away — the footer sticks to the panel's bottom edge, mirroring the title bar. */}
        <div style={{ position: 'sticky', bottom: 0, zIndex: 2, background: 'var(--surface)', borderTop: '1px solid var(--border)', margin: '0 -1.5rem -1.5rem', padding: '0.75rem 1.5rem', display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
          {editingInvoice ? (
            <button
              type="button"
              onClick={() => deleteInvoice(editingInvoice)}
              style={{ padding: '0.5rem 1rem', background: 'var(--bg-red-100)', color: 'var(--text-red-800)', border: '1px solid var(--border-red)', borderRadius: 4, cursor: 'pointer' }}
            >
              Delete
            </button>
          ) : null}
          <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
            <button type="button" onClick={closeInvoiceForm} style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={savingInvoice} style={{ padding: '0.5rem 1rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>{invoiceWords.saveLabel(editingInvoice != null, savingInvoice)}</button>
          </div>
        </div>
      </form>
    </div>
  </div>
  )
}
