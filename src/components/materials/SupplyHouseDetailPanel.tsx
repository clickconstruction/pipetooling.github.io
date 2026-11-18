/**
 * The open house's panel (SupplyHousesTab map, extraction step 11): its address and phone, its bills on their card
 * with Add invoice and Record a payment, the job accounts folded under them, and its purchase orders.
 *
 * The JSX moved from `SupplyHousesTab` as it stood, out of the summary table's expanded row. It draws only: the
 * house, its bills and its payments are the tab's data (`ap`), the presses that pay a bill or open a payment are the
 * payments' engine (`payments`), and the rest are the tab's own doors, lent as props.
 */
import { type Dispatch, type SetStateAction } from 'react'
import { ordinalDay } from '../../lib/materials/supplyHousePhone'
import { telHrefFor } from '../../lib/phoneContact'
import type { PaperRow } from '../../lib/materials/lines/paperRows'
import { formatErrorMessage } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { SupplyHouseWebsiteLink } from '../SupplyHouseWebsiteLink'
import {
} from '../../lib/materials/supplyHouseInvoiceForm'
import { SupplyHouseJobAccountsRoster } from './SupplyHouseJobAccountsRoster'
import { todayYmdInAppTz, calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { billDateWords } from '../../lib/materials/supplyBillGroups'
import { removedLately } from '../../lib/materials/payments/supplyPaymentMove'
import { SupplyHouseBillsCard } from './SupplyHouseBillsCard'
import { houseOnAccountTotal, supplyBillCardRows, supplyBillsToList } from '../../lib/materials/supplyHouseBillRows'
import { supabaseSupplyPaymentsIo } from '../../lib/materials/payments/supplyPaymentsIo'
import { billPaidBy } from '../../lib/materials/payments/supplyPayment'
import { EmptyState } from '../EmptyState'
import type { SupplyHousePayments } from './useSupplyHousePayments'
import type { SupplyHouseAccountsPayable, SupplyHouseSummaryRow } from './useSupplyHouseAccountsPayable'
import type { SupplyHouseInvoice, SupplyHouseInvoiceWithAllocations } from './useSupplyHouseInvoiceForm'
import { supplyHouseInvoicesEmptyWords, supplyHousePosEmptyWords } from '../../lib/materials/materialsEmptyWords'


export interface SupplyHouseDetailPanelProps {
  /** The tab's data, whole: the house list, the book and the open house. */
  ap: SupplyHouseAccountsPayable
  /** The payments' engine, whole. */
  payments: SupplyHousePayments
  sortedSupplyHouseSummary: SupplyHouseSummaryRow[]
  showPaidInvoices: boolean
  setShowPaidInvoices: Dispatch<SetStateAction<boolean>>
  jobAccountsOpen: boolean
  setJobAccountsOpen: Dispatch<SetStateAction<boolean>>
  papersByInvoice: Map<string, PaperRow>
  paperNames: Map<string, string>
  openPaperLook: (inv: SupplyHouseInvoice) => Promise<void>
  openAddInvoice: () => void
  openEditInvoice: (inv: SupplyHouseInvoice | SupplyHouseInvoiceWithAllocations) => void
  serviceTypeId: string | null
  selectedServiceTypeIdProp: string | undefined
  creatingPOForSupplyHouse: boolean
  createBlankPOForSupplyHouse: (supplyHouseId: string) => Promise<void>
  handleNavigateToPO: (poId: string) => void
}

export function SupplyHouseDetailPanel({ ap, payments, sortedSupplyHouseSummary, showPaidInvoices, setShowPaidInvoices, jobAccountsOpen, setJobAccountsOpen, papersByInvoice, paperNames, openPaperLook, openAddInvoice, openEditInvoice, serviceTypeId, selectedServiceTypeIdProp, creatingPOForSupplyHouse, createBlankPOForSupplyHouse, handleNavigateToPO }: SupplyHouseDetailPanelProps) {
  const { selectedSupplyHouseForDetail, supplyHouseInvoices, supplyHousePOs, poGeneratorCodesForSelectedHouse, supplyHouseDetailLoading, supplyHouseJobDetailsMap, housePayments, paidThisVisit, loadSupplyHouseDetail } = ap
  const { setHowEditId, puttingBackPaymentId, setPuttingBackPaymentId, payingInvoiceId, openRecordPayment, refreshHouseMoney, toggleInvoicePaid } = payments
  const { showToast } = useToastContext()
  if (!selectedSupplyHouseForDetail) return null
  return (
  <div style={{ padding: '1rem 1.5rem', background: 'var(--bg-subtle)', borderLeft: '3px solid #3b82f6' }}>
    {supplyHouseDetailLoading ? (
      <p>Loading…</p>
    ) : (
      <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          {selectedSupplyHouseForDetail.address && (
            <div><strong>Address:</strong> {selectedSupplyHouseForDetail.address}</div>
          )}
          {(selectedSupplyHouseForDetail.phone || selectedSupplyHouseForDetail.website_url?.trim()) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
              {selectedSupplyHouseForDetail.phone && (
                <span><strong>Phone:</strong> <a href={telHrefFor(selectedSupplyHouseForDetail.phone)} style={{ color: 'var(--text-link)' }}>{selectedSupplyHouseForDetail.phone}</a></span>
              )}
              <SupplyHouseWebsiteLink websiteUrl={selectedSupplyHouseForDetail.website_url} />
            </div>
          )}
        </div>
        <section style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>
              Invoices{' '}
              <span style={{ fontWeight: 400, fontSize: '0.875rem', color: 'var(--text-muted)' }} data-testid="supply-bills-payday">
                {(() => {
                  const day = sortedSupplyHouseSummary.find((r) => r.supply_house_id === selectedSupplyHouseForDetail.id)?.monthlyPaymentDay
                  return day ? `pays on the ${ordinalDay(day)}` : ''
                })()}
              </span>
            </h3>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); openAddInvoice() }}
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >
                Add Invoice
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); openRecordPayment() }}
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >
                Record a payment
              </button>
            </div>
          </div>
          {(() => {
            // A bill marked paid on this visit stays listed, so the rows under it do not move.
            const billToday = todayYmdInAppTz()
            const rows = supplyBillCardRows({
              shown: supplyBillsToList(supplyHouseInvoices, showPaidInvoices, paidThisVisit),
              all: supplyHouseInvoices,
              payments: housePayments,
              jobs: supplyHouseJobDetailsMap,
              ledgerCodes: poGeneratorCodesForSelectedHouse,
              papers: papersByInvoice,
              paperNames,
            })
            const byId = (id: string) => supplyHouseInvoices.find((x) => x.id === id) ?? null
            return (
              <SupplyHouseBillsCard
                bills={rows}
                todayYmd={billToday}
                jobAccountsInUse={!!selectedSupplyHouseForDetail.job_accounts?.trim() || supplyHouseInvoices.some((inv) => inv.on_job_account === true)}
                paidThisVisit={paidThisVisit}
                payingId={payingInvoiceId}
                onAccount={houseOnAccountTotal(housePayments)}
                empty={
                  <EmptyState
                    compact
                    {...supplyHouseInvoicesEmptyWords({
                      house: selectedSupplyHouseForDetail.name.trim() || 'this house',
                      total: supplyHouseInvoices.length,
                      addInvoice: openAddInvoice,
                      showPaid: () => setShowPaidInvoices(true),
                    })}
                  />
                }
                onTogglePaid={(id) => {
                  const inv = byId(id)
                  if (inv) void toggleInvoicePaid(inv)
                }}
                onEdit={(id) => {
                  const inv = byId(id)
                  if (inv) openEditInvoice(inv)
                }}
                onLook={(id) => {
                  const inv = byId(id)
                  if (inv) void openPaperLook(inv)
                }}
                removedPayments={removedLately(housePayments.payments, Date.now(), (ymd) => billDateWords(ymd, billToday), calendarYmdInAppTzFromIso).map((r) => ({ id: r.payment.id, words: r.words }))}
                puttingBackId={puttingBackPaymentId}
                onFinish={(billId) => setHowEditId(billPaidBy(billId, housePayments.payments, housePayments.lines).needsHowId ?? null)}
                onPutBack={(paymentId) => {
                  const houseId = selectedSupplyHouseForDetail.id
                  setPuttingBackPaymentId(paymentId)
                  supabaseSupplyPaymentsIo
                    .restore(paymentId)
                    .then(async () => {
                      showToast('The payment is back. Its bills read as they did.', 'success')
                      await refreshHouseMoney(houseId)
                    })
                    .catch((e: unknown) => showToast(formatErrorMessage(e, 'The payment was not put back.'), 'error', 6000))
                    .finally(() => setPuttingBackPaymentId(null))
                }}
              />
            )
          })()}
        </section>
        {/* The job accounts sit under the bills, folded until asked for. The fold is remembered. */}
        <section style={{ marginBottom: '1.5rem' }} data-testid="supply-job-accounts-fold">
          <button
            type="button"
            aria-expanded={jobAccountsOpen}
            onClick={(e) => { e.stopPropagation(); setJobAccountsOpen((o) => !o) }}
            style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', width: '100%', minHeight: 44, padding: '0.5rem 0.75rem', marginBottom: jobAccountsOpen ? '0.75rem' : 0, font: 'inherit', textAlign: 'left', background: 'var(--surface)', color: 'var(--text-strong)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}
          >
            <span aria-hidden style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{jobAccountsOpen ? '▾' : '▸'}</span>
            <b>Job accounts</b>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{jobAccountsOpen ? 'fold them away' : 'each job’s account with this house'}</span>
          </button>
          {jobAccountsOpen && (
          <SupplyHouseJobAccountsRoster
            house={selectedSupplyHouseForDetail}
            invoices={supplyHouseInvoices}
            jobDetails={supplyHouseJobDetailsMap}
            onInvoicesChanged={() => void loadSupplyHouseDetail(selectedSupplyHouseForDetail)}
          />
          )}
        </section>
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>Purchase Orders</h3>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); createBlankPOForSupplyHouse(selectedSupplyHouseForDetail.id) }}
              disabled={creatingPOForSupplyHouse || !serviceTypeId}
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 4, cursor: creatingPOForSupplyHouse || !serviceTypeId ? 'not-allowed' : 'pointer' }}
            >
              {creatingPOForSupplyHouse ? 'Creating…' : 'Create PO'}
            </button>
          </div>
          {!serviceTypeId && (
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              {selectedServiceTypeIdProp !== undefined ? 'Select a service type above to create POs.' : 'Loading service types…'}
            </p>
          )}
          <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead style={{ background: 'var(--bg-subtle)' }}>
                <tr>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Name</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Status</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {supplyHousePOs.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ padding: 0 }}>
                      <EmptyState
                        compact
                        {...supplyHousePosEmptyWords({
                          house: selectedSupplyHouseForDetail.name.trim() || 'this house',
                          createPo: serviceTypeId && !creatingPOForSupplyHouse ? () => void createBlankPOForSupplyHouse(selectedSupplyHouseForDetail.id) : null,
                        })}
                      />
                    </td>
                  </tr>
                ) : (
                  supplyHousePOs.map((po) => (
                    <tr key={po.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.5rem 0.75rem' }}>{po.name}</td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>{po.status}</td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleNavigateToPO(po.id) }}
                          style={{ marginRight: '0.5rem', padding: '0.2rem 0.5rem', fontSize: '0.8125rem', cursor: 'pointer' }}
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleNavigateToPO(po.id) }}
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.8125rem', cursor: 'pointer' }}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </>
    )}
  </div>
  )
}
