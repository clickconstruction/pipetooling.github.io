import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { cleanStoredAddress } from '../../lib/displayAddress'
import { PORTAL_OPEN_INVOICE_STATUS } from '../../../supabase/functions/_shared/portalBillMembership'
import { ownerShareApplies, ownerSharePropertyState, ownerShareState, type OwnerShareInvoice, type OwnerShareJob } from '../../lib/jobs/ownerBillShare'
import OwnerShareChip from '../jobs/OwnerShareChip'

/**
 * The portal window's "On their jobs, billed to someone else" (v2.3827, punch list #45 PR 1): the
 * jobs where this customer is the owner and the GC pays, one line per property, with the same
 * switch the Pipeline row carries. Nothing renders when there are none. Office roles only (the
 * window itself is).
 */
type Row = OwnerShareJob & { job_address: string | null; revenue: number | null; payments_made: number | null; gc: { name: string | null } | null }

export default function PortalOwnerShareSection({ customerId, customerName, role, onChanged }: { customerId: string; customerName: string; role: string | null | undefined; onChanged?: () => void }) {
  const [jobs, setJobs] = useState<Row[]>([])
  const [invoices, setInvoices] = useState<OwnerShareInvoice[]>([])
  const load = useCallback(async () => {
    const { data } = await supabase
      .from('jobs_ledger')
      .select('id, customer_id, gc_customer_id, bill_to_party, customer_address_id, show_bills_to_other_party, job_address, revenue, payments_made, gc:customers!jobs_ledger_gc_customer_id_fkey(name)')
      .eq('customer_id', customerId)
      .not('gc_customer_id', 'is', null)
      .neq('status', 'paid')
    const rows = ((data ?? []) as unknown as Row[]).filter(ownerShareApplies)
    setJobs(rows)
    if (rows.length === 0) return setInvoices([])
    const { data: inv } = await supabase.from('jobs_ledger_invoices').select('id, job_id, status, bill_to_party, bill_to_email, shown_to_party').in('job_id', rows.map((r) => r.id)).eq('status', PORTAL_OPEN_INVOICE_STATUS)
    setInvoices((inv ?? []) as OwnerShareInvoice[])
  }, [customerId])
  useEffect(() => {
    void load()
  }, [load])

  const groups = new Map<string, Row[]>()
  for (const j of jobs) {
    const key = (j.customer_address_id ?? '').trim() || `job:${j.id}`
    groups.set(key, [...(groups.get(key) ?? []), j])
  }
  if (groups.size === 0) return null
  const owed = (j: Row) => Math.max(0, (Number(j.revenue) || 0) - (Number(j.payments_made) || 0))
  return (
    <div data-portal-owner-share style={{ marginTop: '0.8rem', border: '1px solid var(--border)', borderRadius: 8, padding: '0.55rem 0.7rem', background: 'var(--bg-subtle)', display: 'grid', gap: 6 }}>
      <div style={{ fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>On {customerName}'s jobs, billed to someone else</div>
      {[...groups.values()].map((g) => {
        const first = g[0]!
        const state = ownerSharePropertyState(g.map((j) => ownerShareState(j, invoices)))
        const billed = g.filter((j) => invoices.some((i) => i.job_id === j.id))
        const total = billed.reduce((s, j) => s + owed(j), 0)
        const gcName = (first.gc?.name ?? '').trim()
        return (
          <div key={first.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', fontSize: '0.78rem' }}>
            <span style={{ minWidth: 0 }}>
              <strong>{cleanStoredAddress(first.job_address) || 'A job'}</strong>
              <span style={{ color: 'var(--text-muted)' }}>
                {' '}
                · {g.length} job{g.length === 1 ? '' : 's'} · {billed.length ? `${formatUsdNoCents(total)} on open bills` : 'no bill yet'} · billed to {gcName || 'the GC'}
              </span>
            </span>
            <OwnerShareChip job={first} invoices={invoices} state={state ?? undefined} ownerName={customerName} gcName={gcName} role={role} onChanged={() => { void load(); onChanged?.() }} />
          </div>
        )
      })}
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Shown for their records — no Pay button, never in their balance.</div>
    </div>
  )
}
