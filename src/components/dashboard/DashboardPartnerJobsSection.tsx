import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { DashboardGroupCard } from './DashboardGroupCard'

/**
 * "Your jobs" — the partner's §5 window (PARTNERSHIPS_PLAN.md PR 7).
 * Lists ONLY checked-off (majority-confirmed) jobs; tapping one expands its
 * cost sheet inline — reported hours per person (no wages), supply-house
 * invoice allocations, card charges, direct expenses (incl. §4h transfers),
 * with a freshness stamp. Self-gating + fail-soft like the ledger card.
 */

type JobRow = {
  job_id: string
  label: string
  job_name: string | null
  status: string | null
  confirmed_at: string | null
  profit_share: number | null
}

type Costing = {
  label: string
  revenue: number | null
  as_of: string
  hours: { name: string; hours: number }[]
  supply_invoices: { vendor: string | null; invoice_number: string | null; invoice_date: string | null; invoice_amount: number; pct: number; allocated: number }[]
  card_charges: { counterparty: string | null; posted_at: string | null; allocated: number }[]
  direct: { description: string; amount: number }[]
}

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function DashboardPartnerJobsSection() {
  const [rows, setRows] = useState<JobRow[] | null>(null)
  const [costingOn, setCostingOn] = useState(false)
  const [openJob, setOpenJob] = useState<string | null>(null)
  const [costing, setCosting] = useState<Costing | null>(null)
  const [costingErr, setCostingErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_my_partner_jobs')
    if (error || !data || typeof data !== 'object' || (data as Record<string, unknown>).exists !== true) {
      setRows(null)
      return
    }
    const d = data as Record<string, unknown>
    setCostingOn(d.costing_on === true)
    setRows(
      Array.isArray(d.rows)
        ? (d.rows as Record<string, unknown>[])
            .filter((r) => typeof r.job_id === 'string')
            .map((r) => ({
              job_id: String(r.job_id),
              label: String(r.label ?? ''),
              job_name: typeof r.job_name === 'string' ? r.job_name : null,
              status: typeof r.status === 'string' ? r.status : null,
              confirmed_at: typeof r.confirmed_at === 'string' ? r.confirmed_at : null,
              profit_share: Number.isFinite(Number(r.profit_share)) && r.profit_share != null ? Number(r.profit_share) : null,
            }))
        : [],
    )
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (rows == null) return null

  async function openCosting(jobId: string) {
    if (openJob === jobId) {
      setOpenJob(null)
      setCosting(null)
      return
    }
    setOpenJob(jobId)
    setCosting(null)
    setCostingErr(null)
    const { data, error } = await supabase.rpc('get_my_partner_job_costing', { p_job_id: jobId })
    if (error) {
      setCostingErr(error.message)
      return
    }
    const d = (data ?? {}) as Record<string, unknown>
    setCosting({
      label: String(d.label ?? ''),
      revenue: Number.isFinite(Number(d.revenue)) && d.revenue != null ? Number(d.revenue) : null,
      as_of: String(d.as_of ?? ''),
      hours: Array.isArray(d.hours) ? (d.hours as Record<string, unknown>[]).map((h) => ({ name: String(h.name ?? ''), hours: Number(h.hours) || 0 })) : [],
      supply_invoices: Array.isArray(d.supply_invoices)
        ? (d.supply_invoices as Record<string, unknown>[]).map((i) => ({
            vendor: typeof i.vendor === 'string' ? i.vendor : null,
            invoice_number: typeof i.invoice_number === 'string' ? i.invoice_number : null,
            invoice_date: typeof i.invoice_date === 'string' ? i.invoice_date : null,
            invoice_amount: Number(i.invoice_amount) || 0,
            pct: Number(i.pct) || 0,
            allocated: Number(i.allocated) || 0,
          }))
        : [],
      card_charges: Array.isArray(d.card_charges)
        ? (d.card_charges as Record<string, unknown>[]).map((c) => ({
            counterparty: typeof c.counterparty === 'string' ? c.counterparty : null,
            posted_at: typeof c.posted_at === 'string' ? c.posted_at : null,
            allocated: Number(c.allocated) || 0,
          }))
        : [],
      direct: Array.isArray(d.direct) ? (d.direct as Record<string, unknown>[]).map((m) => ({ description: String(m.description ?? ''), amount: Number(m.amount) || 0 })) : [],
    })
  }

  const groupHead = (t: string) => (
    <div style={{ fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0.5rem 0 0.15rem' }}>{t}</div>
  )
  const line = (l: string, r: string, key: string | number) => (
    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', padding: '0.25rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.78rem' }}>
      <span style={{ color: 'var(--text-700)', minWidth: 0 }}>{l}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, whiteSpace: 'nowrap' }}>{r}</span>
    </div>
  )

  return (
    <DashboardGroupCard title="Your jobs">
      {rows.length === 0 ? (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
          Jobs appear here once the office confirms you did the majority of the work.
        </p>
      ) : (
        rows.map((j) => (
          <div key={j.job_id} style={{ borderBottom: '1px solid var(--border)', padding: '0.45rem 0' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.4rem 0.7rem' }}>
              <span style={{ flex: '1 1 200px', minWidth: 0, fontSize: '0.85rem' }}>
                <b>#{j.label}</b>
                {j.job_name && j.job_name !== j.label ? ` — ${j.job_name}` : ''}
                <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {j.status ?? ''}
                  {j.confirmed_at ? ` · yours since ${new Date(j.confirmed_at).toLocaleDateString()}` : ''}
                </span>
              </span>
              {j.profit_share != null ? (
                <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: '#16a34a', fontSize: '0.82rem' }}>+{money(j.profit_share)}</span>
              ) : null}
              {costingOn ? (
                <button
                  type="button"
                  onClick={() => void openCosting(j.job_id)}
                  style={{ font: 'inherit', fontSize: '0.72rem', fontWeight: 650, padding: '0.2rem 0.55rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text-link)', cursor: 'pointer' }}
                >
                  {openJob === j.job_id ? 'close costing' : 'open costing'}
                </button>
              ) : null}
            </div>
            {openJob === j.job_id ? (
              <div style={{ margin: '0.4rem 0 0.2rem', padding: '0.5rem 0.6rem', border: '1px solid var(--border)', borderRadius: 8 }}>
                {costingErr ? (
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-red-600)', margin: 0 }}>{costingErr}</p>
                ) : !costing ? (
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>Loading…</p>
                ) : (
                  <>
                    {costing.revenue != null ? (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>job total {money(costing.revenue)}</div>
                    ) : null}
                    {costing.hours.length > 0 ? (
                      <>
                        {groupHead('Reported hours (§5c)')}
                        {costing.hours.map((h, i) => line(h.name, `${h.hours.toFixed(1)} h`, i))}
                      </>
                    ) : null}
                    {costing.supply_invoices.length > 0 ? (
                      <>
                        {groupHead('Supply house invoices (§5a)')}
                        {costing.supply_invoices.map((iv, i) =>
                          line(
                            `${iv.vendor ?? 'Invoice'}${iv.invoice_number ? ` #${iv.invoice_number}` : ''}${iv.invoice_date ? ` · ${iv.invoice_date}` : ''} · ${iv.pct}% allocated`,
                            money(iv.allocated),
                            i,
                          ),
                        )}
                      </>
                    ) : null}
                    {costing.card_charges.length > 0 ? (
                      <>
                        {groupHead('Card charges (§5b)')}
                        {costing.card_charges.map((c, i) =>
                          line(`${c.counterparty ?? 'Charge'}${c.posted_at ? ` · ${c.posted_at.slice(0, 10)}` : ''}`, money(c.allocated), i),
                        )}
                      </>
                    ) : null}
                    {costing.direct.length > 0 ? (
                      <>
                        {groupHead('Direct expenses')}
                        {costing.direct.map((m, i) => line(m.description || '—', money(m.amount), i))}
                      </>
                    ) : null}
                    <p style={{ fontSize: '0.66rem', color: 'var(--text-muted)', margin: '0.4rem 0 0' }}>
                      Figures as of {costing.as_of ? new Date(costing.as_of).toLocaleString() : 'now'} — best efforts (§5).
                      No one’s wages appear here; labor dollars show only in the job’s totals.
                    </p>
                  </>
                )}
              </div>
            ) : null}
          </div>
        ))
      )}
    </DashboardGroupCard>
  )
}
