import { useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import {
  backfillInvoiceNote,
  buildInvoiceReconcilePlan,
  buildPaymentReconcilePlan,
  parseHcpInvoicesExport,
  parseHcpJobsBridge,
  parseHcpPaymentsExport,
  splitInsertNote,
  type InvoiceReconcilePlan,
  type PaymentReconcilePlan,
  type ReconcileInvoice,
  type ReconcileJob,
  type ReconcilePayment,
  type ReconcileSkip,
} from '../../lib/settings/hcpReconcile'

/**
 * Settings → Jobs & billing → HCP reconcile (dev-only, v2.2255) — the
 * Billing Truth Plan Phase 3 importer. Turns the 2026-08-24 one-off psql
 * backfills into a repeatable two-lane flow: the HCP invoices export creates
 * dated paid invoices / stamps bill dates / links payments; the HCP payments
 * export (+ the jobs export as the customer/created-date bridge) corrects
 * paid dates and splits import rollups. Everything previews before anything
 * writes; plans are idempotent — re-running the same files plans nothing.
 */

type AppSlices = {
  jobs: ReconcileJob[]
  invoices: ReconcileInvoice[]
  payments: ReconcilePayment[]
}

async function fetchAppSlices(): Promise<AppSlices> {
  const [jobs, invoices, payments] = await Promise.all([
    withSupabaseRetry(() => supabase.from('jobs_ledger').select('id, hcp_number').range(0, 9999), 'load jobs for HCP reconcile'),
    withSupabaseRetry(
      () =>
        supabase
          .from('jobs_ledger_invoices')
          .select('id, job_id, status, billed_at, estimated_bill_date, stripe_invoice_id, external_send_note')
          .range(0, 9999),
      'load invoices for HCP reconcile',
    ),
    withSupabaseRetry(
      () =>
        supabase
          .from('jobs_ledger_payments')
          .select('id, job_id, amount, paid_on, invoice_id, payment_type, note, sequence_order, mercury_transaction_id')
          .range(0, 9999),
      'load payments for HCP reconcile',
    ),
  ])
  return {
    jobs: (jobs ?? []) as ReconcileJob[],
    invoices: (invoices ?? []) as ReconcileInvoice[],
    payments: (payments ?? []) as ReconcilePayment[],
  }
}

function SkipList({ skips }: { skips: ReconcileSkip[] }) {
  if (skips.length === 0) return null
  return (
    <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.1rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
      {skips.map((s) => (
        <li key={s.key}>
          {s.count} × {s.reason}
        </li>
      ))}
    </ul>
  )
}

function planChip(label: string, count: number, tone: 'act' | 'quiet'): React.ReactNode {
  return (
    <span
      style={{
        fontSize: '0.76rem',
        fontVariantNumeric: 'tabular-nums',
        borderRadius: 9999,
        padding: '2px 10px',
        fontWeight: 600,
        background: tone === 'act' && count > 0 ? 'var(--bg-blue-tint)' : 'var(--bg-muted)',
        color: tone === 'act' && count > 0 ? 'var(--text-blue-800)' : 'var(--text-muted)',
      }}
    >
      {count} {label}
    </span>
  )
}

const fileButtonStyle: React.CSSProperties = {
  padding: '0.35rem 0.75rem',
  fontSize: '0.8125rem',
  fontWeight: 600,
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
  background: 'var(--surface)',
  color: 'var(--text-700)',
  cursor: 'pointer',
}

const applyButtonStyle: React.CSSProperties = {
  padding: '0.35rem 0.9rem',
  fontSize: '0.8125rem',
  fontWeight: 600,
  border: 'none',
  borderRadius: 6,
  background: '#2563eb',
  color: '#fff',
  cursor: 'pointer',
}

export default function SettingsHcpReconcileSection() {
  const { showToast } = useToastContext()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const slicesRef = useRef<AppSlices | null>(null)

  const [invoicePlan, setInvoicePlan] = useState<InvoiceReconcilePlan | null>(null)
  const [invoiceFileName, setInvoiceFileName] = useState<string | null>(null)

  const [paymentsText, setPaymentsText] = useState<string | null>(null)
  const [paymentsFileName, setPaymentsFileName] = useState<string | null>(null)
  const [bridgeText, setBridgeText] = useState<string | null>(null)
  const [bridgeFileName, setBridgeFileName] = useState<string | null>(null)
  const [paymentPlan, setPaymentPlan] = useState<PaymentReconcilePlan | null>(null)

  const runYmd = calendarYmdInAppTzFromIso(new Date().toISOString())

  const ensureSlices = async (): Promise<AppSlices> => {
    if (slicesRef.current) return slicesRef.current
    const slices = await fetchAppSlices()
    slicesRef.current = slices
    return slices
  }

  const refreshSlices = async (): Promise<AppSlices> => {
    slicesRef.current = null
    return ensureSlices()
  }

  const readFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result ?? ''))
      r.onerror = () => reject(new Error('Could not read the file'))
      r.readAsText(file)
    })

  const onInvoicesFile = async (file: File | null) => {
    if (!file) return
    setBusy('Reading the invoices export…')
    try {
      const text = await readFile(file)
      const rows = parseHcpInvoicesExport(text)
      if (!rows) {
        showToast('That file is missing the invoices-export columns (Invoice #, Invoice status, Latest send date, Job #).', 'error')
        return
      }
      const slices = await ensureSlices()
      setInvoicePlan(buildInvoiceReconcilePlan(rows, slices.jobs, slices.invoices, slices.payments))
      setInvoiceFileName(file.name)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not build the plan', 'error')
    } finally {
      setBusy(null)
    }
  }

  const recomputePaymentPlan = async (payText: string | null, brText: string | null) => {
    if (!payText || !brText) return
    const payRows = parseHcpPaymentsExport(payText)
    if (!payRows) {
      showToast('That file is missing the payments-export columns (Payment Received Date, Job Created Date, Customer Name, Payment Amount).', 'error')
      return
    }
    const bridgeRows = parseHcpJobsBridge(brText)
    if (!bridgeRows) {
      showToast('That file is missing the jobs-export columns (Job #, Customer name, Job created date).', 'error')
      return
    }
    const slices = await ensureSlices()
    setPaymentPlan(buildPaymentReconcilePlan(payRows, bridgeRows, slices.jobs, slices.invoices, slices.payments, runYmd))
  }

  const onPaymentsFile = async (file: File | null) => {
    if (!file) return
    setBusy('Reading the payments export…')
    try {
      const text = await readFile(file)
      setPaymentsText(text)
      setPaymentsFileName(file.name)
      await recomputePaymentPlan(text, bridgeText)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not read the file', 'error')
    } finally {
      setBusy(null)
    }
  }

  const onBridgeFile = async (file: File | null) => {
    if (!file) return
    setBusy('Reading the jobs export…')
    try {
      const text = await readFile(file)
      setBridgeText(text)
      setBridgeFileName(file.name)
      await recomputePaymentPlan(paymentsText, text)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not read the file', 'error')
    } finally {
      setBusy(null)
    }
  }

  const applyInvoicePlan = async () => {
    if (!invoicePlan) return
    const total = invoicePlan.creates.length + invoicePlan.stamps.length + invoicePlan.links.length
    if (total === 0) return
    setBusy(`Applying 0/${total}…`)
    let done = 0
    try {
      for (const c of invoicePlan.creates) {
        const created = await withSupabaseRetry(
          () =>
            supabase
              .from('jobs_ledger_invoices')
              .insert({
                job_id: c.jobId,
                amount: c.amount,
                status: 'paid',
                sequence_order: 1,
                billed_at: new Date(c.sentAtIso).toISOString(),
                external_send_channel: 'housecallpro',
                external_send_note: backfillInvoiceNote(runYmd, c.invoiceNo),
              })
              .select('id')
              .single(),
          'create reconciled invoice',
        )
        const invoiceId = (created as unknown as { id: string }).id
        if (c.linkPaymentIds.length > 0) {
          await withSupabaseRetry(
            () => supabase.from('jobs_ledger_payments').update({ invoice_id: invoiceId }).in('id', c.linkPaymentIds),
            'link payments to reconciled invoice',
          )
        }
        done += 1
        setBusy(`Applying ${done}/${total}…`)
      }
      for (const s of invoicePlan.stamps) {
        await withSupabaseRetry(
          () =>
            supabase
              .from('jobs_ledger_invoices')
              .update({ billed_at: new Date(s.sentAtIso).toISOString() })
              .eq('id', s.invoiceId),
          'stamp bill date from HCP',
        )
        done += 1
        setBusy(`Applying ${done}/${total}…`)
      }
      for (const l of invoicePlan.links) {
        await withSupabaseRetry(
          () => supabase.from('jobs_ledger_payments').update({ invoice_id: l.invoiceId }).eq('id', l.paymentId),
          'link payment to invoice',
        )
        done += 1
        setBusy(`Applying ${done}/${total}…`)
      }
      showToast(`Reconciled: ${invoicePlan.creates.length} invoices created, ${invoicePlan.stamps.length} dated, ${invoicePlan.links.length} payments linked.`, 'success')
      await refreshSlices()
      setInvoicePlan(null)
      setInvoiceFileName(null)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Apply failed part-way — re-pick the file to see what remains (already-applied rows plan nothing).', 'error')
      await refreshSlices()
    } finally {
      setBusy(null)
    }
  }

  const applyPaymentPlan = async () => {
    if (!paymentPlan) return
    const total = paymentPlan.corrections.length + paymentPlan.splits.length
    if (total === 0) return
    setBusy(`Applying 0/${total}…`)
    let done = 0
    try {
      for (const c of paymentPlan.corrections) {
        await withSupabaseRetry(
          () => supabase.from('jobs_ledger_payments').update({ paid_on: c.toYmd, note: c.newNote }).eq('id', c.paymentId),
          'correct payment date from HCP',
        )
        done += 1
        setBusy(`Applying ${done}/${total}…`)
      }
      for (const s of paymentPlan.splits) {
        // Insert the true rows first, then delete the rollup — a mid-apply
        // failure can only overcount transiently, never lose a payment.
        await withSupabaseRetry(
          () =>
            supabase.from('jobs_ledger_payments').insert(
              s.inserts.map((i) => ({
                job_id: s.jobId,
                amount: i.amount,
                sequence_order: i.sequenceOrder,
                paid_on: i.paidYmd,
                payment_type: i.paymentType,
                note: splitInsertNote(runYmd),
                invoice_id: i.invoiceId,
              })),
            ),
          'insert split payments',
        )
        await withSupabaseRetry(
          () => supabase.from('jobs_ledger_payments').delete().eq('id', s.deletePaymentId),
          'remove split rollup payment',
        )
        done += 1
        setBusy(`Applying ${done}/${total}…`)
      }
      showToast(`Corrected ${paymentPlan.corrections.length} payment dates, split ${paymentPlan.splits.length} rollups.`, 'success')
      await refreshSlices()
      setPaymentPlan(null)
      setPaymentsText(null)
      setPaymentsFileName(null)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Apply failed part-way — re-pick the files; already-applied rows plan nothing.', 'error')
      await refreshSlices()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div style={{ marginTop: '1.25rem', border: '1px solid var(--border)', borderRadius: 8, padding: '0.9rem 1rem' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', width: '100%', border: 'none', background: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'inherit' }}
      >
        <span aria-hidden style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{open ? '▼' : '▶'}</span>
        <h3 style={{ margin: 0, fontSize: '0.95rem' }}>HCP reconcile</h3>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          import billing history from HouseCall Pro exports — previews everything before writing
        </span>
      </button>

      {open && (
        <div style={{ marginTop: '0.75rem', display: 'grid', gap: '1rem' }}>
          {busy && (
            <p role="status" aria-busy style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{busy}</p>
          )}

          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
              <strong style={{ fontSize: '0.85rem' }}>1 · Bill dates &amp; links</strong>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                from the HCP <em>invoices</em> export (Customers → Invoices → Actions → Export)
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.45rem' }}>
              <label style={fileButtonStyle}>
                {invoiceFileName ?? 'Choose invoices export…'}
                <input
                  type="file"
                  accept=".csv,text/csv"
                  style={{ display: 'none' }}
                  onChange={(e) => void onInvoicesFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {invoicePlan && (
                <>
                  {planChip('invoices to create', invoicePlan.creates.length, 'act')}
                  {planChip('bill dates to stamp', invoicePlan.stamps.length, 'act')}
                  {planChip('payments to link', invoicePlan.links.length, 'act')}
                  {invoicePlan.creates.length + invoicePlan.stamps.length + invoicePlan.links.length > 0 ? (
                    <button type="button" style={applyButtonStyle} disabled={busy != null} onClick={() => void applyInvoicePlan()}>
                      Apply
                    </button>
                  ) : (
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-green-800)', fontWeight: 600 }}>Nothing to do — reconciled ✓</span>
                  )}
                </>
              )}
            </div>
            {invoicePlan && <SkipList skips={invoicePlan.skips} />}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
              <strong style={{ fontSize: '0.85rem' }}>2 · True payment dates</strong>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                from the HCP <em>payments</em> report (Reporting → Payments) + the <em>jobs</em> export (the job-number bridge)
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.45rem' }}>
              <label style={fileButtonStyle}>
                {paymentsFileName ?? 'Choose payments report…'}
                <input type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={(e) => void onPaymentsFile(e.target.files?.[0] ?? null)} />
              </label>
              <label style={fileButtonStyle}>
                {bridgeFileName ?? 'Choose jobs export…'}
                <input type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={(e) => void onBridgeFile(e.target.files?.[0] ?? null)} />
              </label>
              {paymentPlan && (
                <>
                  {planChip('dates to correct', paymentPlan.corrections.length, 'act')}
                  {planChip('rollups to split', paymentPlan.splits.length, 'act')}
                  {paymentPlan.corrections.length + paymentPlan.splits.length > 0 ? (
                    <button type="button" style={applyButtonStyle} disabled={busy != null} onClick={() => void applyPaymentPlan()}>
                      Apply
                    </button>
                  ) : (
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-green-800)', fontWeight: 600 }}>Nothing to do — reconciled ✓</span>
                  )}
                </>
              )}
            </div>
            {paymentPlan && (
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                {paymentPlan.resolvedRows} of {paymentPlan.exportRows} export payments matched to a job. Bank- and
                Stripe-dated rows are never changed; HCP payments with no app match are never auto-added.
              </p>
            )}
            {paymentPlan && <SkipList skips={paymentPlan.skips} />}
          </div>
        </div>
      )}
    </div>
  )
}
