import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { useReportQuickfillSectionMetric } from '../../contexts/QuickfillSectionMetricsContext'
import { useJobFormModal } from '../../contexts/JobFormModalContext'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { billedAtIsoFromYmd } from '../../lib/jobs/billDateEntry'
import {
  filterUndatedBills,
  parseUndatedBillWorklist,
  undatedBillClue,
  type UndatedBillWorklist,
  type UndatedWorklistBill,
} from '../../lib/quickfillUndatedBills'
import InlineBillDateEditor, { AddBillDateButton } from '../jobs/InlineBillDateEditor'

/**
 * Quickfill "Missing bill dates" station (v2.2326, owner mockup a1729dbd):
 * the undated-bills backlog scoped by the No Count Date — bills that are
 * billed or paid but carry no bill date, so their payments can't teach the
 * pay-speed math. The assistant deduces the date from the row's clues
 * (payment dates, HCP number, the job itself) and types it as MM/DD/YY in
 * place; the row disappears on save. "Open job ›" lands on the Bill tab.
 */

const sectionWrapStyle: CSSProperties = { marginBottom: '2rem' }

export function QuickfillUndatedBillsSection() {
  const { showToast } = useToastContext()
  const jobFormModal = useJobFormModal()

  const [data, setData] = useState<UndatedBillWorklist | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [query, setQuery] = useState('')
  const [dateEditId, setDateEditId] = useState<string | null>(null)
  const [savingDate, setSavingDate] = useState(false)

  const load = useCallback(async () => {
    try {
      const { data: raw } = await supabase.rpc('get_undated_bill_worklist' as never)
      setData(parseUndatedBillWorklist(raw as unknown))
    } catch {
      setData(null)
    }
    setLoaded(true)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const bills = data ? filterUndatedBills(data.bills, query) : []

  useReportQuickfillSectionMetric('undated-bills', !loaded || data == null ? null : data.bills.length, !loaded)

  async function saveBillDate(bill: UndatedWorklistBill, ymd: string) {
    if (savingDate) return
    setSavingDate(true)
    const { error } = await supabase
      .from('jobs_ledger_invoices')
      .update({ billed_at: billedAtIsoFromYmd(ymd) })
      .eq('id', bill.invoiceId)
    if (!error) {
      setDateEditId(null)
      showToast(`Bill date saved${bill.customerName ? ` for ${bill.customerName}` : ''} — that payment can be measured now.`, 'success')
      await load()
    } else {
      showToast('Saving the bill date failed — try again or open the job.', 'error')
    }
    setSavingDate(false)
  }

  function openJob(jobId: string) {
    jobFormModal?.openEditJob(jobId, { initialTab: 'bill', onSaved: () => void load() })
  }

  return (
    <section style={sectionWrapStyle}>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0 0 0.5rem', maxWidth: '68ch' }}>
        These bills have money on them but no bill date, so their payments can't teach the pay-speed math. Figure out
        the day the bill actually went out — the payment date, HCP record, or the job's paper trail usually says — and
        type it as MM/DD/YY. Not sure? Open the job and dig.
      </p>
      {data?.noCountDate && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', margin: '0 0 0.6rem' }}>
          Showing bills with activity since <b style={{ color: 'var(--text-700)' }}>{data.noCountDate}</b> (the No Count
          Date) — older history is left alone.
        </p>
      )}

      {!loaded ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
      ) : data == null ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          The worklist isn't available yet — reload once the update is live.
        </p>
      ) : data.bills.length === 0 ? (
        <p style={{ color: 'var(--text-green-800)', fontSize: '0.875rem', margin: 0 }}>
          Every bill that matters has its date — nothing to fix.
        </p>
      ) : (
        <>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customer, job, address, or HCP…"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              font: 'inherit',
              fontSize: '0.8rem',
              padding: '0.35rem 0.55rem',
              border: '1px solid var(--border)',
              borderRadius: 7,
              background: 'var(--surface)',
              color: 'inherit',
              marginBottom: '0.55rem',
            }}
          />
          {bills.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Nothing matches.</p>
          ) : (
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--surface)' }}>
              {bills.map((b, i) => (
                <div
                  key={b.invoiceId}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.55rem',
                    padding: '0.5rem 0.6rem',
                    fontSize: '0.78rem',
                    borderBottom: i === bills.length - 1 ? 'none' : '1px solid var(--border)',
                    background: i % 2 === 1 ? 'var(--bg-muted)' : 'transparent',
                  }}
                >
                  <span style={{ flexShrink: 0, marginTop: '0.05rem' }}>
                    {dateEditId === b.invoiceId ? (
                      <InlineBillDateEditor
                        saving={savingDate}
                        onSave={(ymd) => void saveBillDate(b, ymd)}
                        onCancel={() => setDateEditId(null)}
                      />
                    ) : (
                      <AddBillDateButton
                        onClick={() => setDateEditId(b.invoiceId)}
                        title="Type the bill date right here — the row clears on save"
                      />
                    )}
                  </span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, width: '4.6em', textAlign: 'right', flexShrink: 0, marginTop: '0.1rem' }}>
                    {formatUsdNoCents(b.amount)}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.05rem' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {b.customerName ? (
                        <span style={{ fontWeight: 650 }}>{b.customerName}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>no customer</span>
                      )}
                      {b.jobName && <span style={{ color: 'var(--text-muted)' }}>{' · '}{b.jobName}</span>}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {[b.address, b.hcpNumber ? `HCP ${b.hcpNumber}` : null].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span
                    title={b.payments.length > 0 ? 'When this bill’s money landed — the bill date is usually a bit before' : 'No payments yet — the created date bounds the bill date'}
                    style={{
                      fontSize: '0.66rem',
                      fontWeight: 600,
                      color: 'var(--text-700)',
                      background: 'var(--bg-muted)',
                      border: '1px solid var(--border)',
                      borderRadius: 9999,
                      padding: '0.05rem 0.5rem',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      marginTop: '0.1rem',
                    }}
                  >
                    {undatedBillClue(b)}
                  </span>
                  {b.jobId && (
                    <button
                      type="button"
                      onClick={() => openJob(b.jobId!)}
                      style={{
                        border: 'none',
                        background: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        color: 'var(--text-link)',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        marginTop: '0.1rem',
                      }}
                    >
                      Open job ›
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}
