import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { buildServiceTypeTradePill } from '../../lib/serviceTypeTradePill'
import { DashboardGroupCard } from './DashboardGroupCard'
import { parsePartnerJobCosting, parsePartnerJobsPayload, type PartnerJobCosting, type PartnerJobRow } from '../../lib/partnerLedger/partnerJobsPayload'

/**
 * "Your jobs" — the partner's §5 window (PARTNERSHIPS_PLAN.md PR 7).
 * Lists ONLY checked-off (majority-confirmed) jobs; tapping one expands its
 * cost sheet inline — reported hours per person (no wages), supply-house
 * invoice allocations, card charges, direct expenses (incl. §4h transfers),
 * with a freshness stamp. Self-gating + fail-soft like the ledger card.
 */

type JobRow = PartnerJobRow
type Costing = PartnerJobCosting

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function DashboardPartnerJobsSection({ asPartnershipId }: { asPartnershipId?: string } = {}) {
  const [rows, setRows] = useState<JobRow[] | null>(null)
  const [costingOn, setCostingOn] = useState(false)
  const [openJob, setOpenJob] = useState<string | null>(null)
  const [costing, setCosting] = useState<Costing | null>(null)
  const [costingErr, setCostingErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    // Lens mode (asPartnershipId): dev-only *_as RPC, same inner body as the
    // partner's own call.
    const { data, error } = asPartnershipId
      ? await supabase.rpc('get_partner_jobs_as', { p_partnership_id: asPartnershipId })
      : await supabase.rpc('get_my_partner_jobs')
    const parsed = error ? null : parsePartnerJobsPayload(data)
    if (!parsed) {
      setRows(null)
      return
    }
    setCostingOn(parsed.costingOn)
    setRows(parsed.rows)
  }, [asPartnershipId])

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
    const { data, error } = asPartnershipId
      ? await supabase.rpc('get_partner_job_costing_as', { p_partnership_id: asPartnershipId, p_job_id: jobId })
      : await supabase.rpc('get_my_partner_job_costing', { p_job_id: jobId })
    if (error) {
      setCostingErr(error.message)
      return
    }
    setCosting(parsePartnerJobCosting(data))
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
        rows.map((j) => {
          const pill = buildServiceTypeTradePill(j.service_type_name)
          return (
          <div key={j.job_id} style={{ borderBottom: '1px solid var(--border)', padding: '0.45rem 0' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.4rem 0.7rem' }}>
              <span style={{ flex: '1 1 200px', minWidth: 0, fontSize: '0.85rem' }}>
                {pill ? <span style={{ ...pill.style, marginTop: 0, marginRight: '0.4rem', verticalAlign: '1px' }}>{pill.label}</span> : null}
                <b>{pill ? j.label : `#${j.label}`}</b>
                {j.job_name && j.job_name !== j.label ? ` — ${j.job_name}` : ''}
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
          )
        })
      )}
    </DashboardGroupCard>
  )
}
