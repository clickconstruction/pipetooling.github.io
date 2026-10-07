import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { buildUncollectibleReport, uncollectibleReportCsv, type UncollectibleReport, type UncollectibleReportRow } from '../../lib/jobs/uncollectibleReport'
import { uncollectibleDayWords } from '../../lib/jobs/uncollectible'
import { saveBlobAs } from '../../lib/storageSave'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'

// The three columns are ahead of the generated types until they regenerate.
const db = supabase as unknown as SupabaseClient

/**
 * Settings → Jobs & dispatch: the bills the office gave up on, by year (punch list #94, v2.4795) — the
 * accountant's bad-debt list, which the office never had a number for. Reads the jobs still marked
 * Uncollectible (a bill paid later leaves the list: the debt was recovered). CSV for the books.
 */
export default function UncollectibleListSettingsBlock() {
  const [open, setOpen] = useState(false)
  const [report, setReport] = useState<UncollectibleReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!open || report) return
    void (async () => {
      const { data, error: err } = await db
        .from('jobs_ledger')
        .select('id, hcp_number, click_number, job_name, revenue, payments_made, uncollectible_at, uncollectible_reason, customer:customers!jobs_ledger_customer_id_fkey(name)')
        .not('uncollectible_at', 'is', null)
        .order('uncollectible_at', { ascending: false })
      if (err) {
        setError(err.message)
        return
      }
      const rows: UncollectibleReportRow[] = ((data ?? []) as Array<Record<string, unknown> & { customer?: { name?: string | null } | { name?: string | null }[] | null }>).map((r) => {
        const c = Array.isArray(r.customer) ? r.customer[0] : r.customer
        return {
          id: String(r.id),
          hcp_number: (r.hcp_number as string | null) ?? null,
          click_number: (r.click_number as string | null) ?? null,
          job_name: (r.job_name as string | null) ?? null,
          customer_name: c?.name ?? null,
          revenue: (r.revenue as number | null) ?? null,
          payments_made: (r.payments_made as number | null) ?? null,
          uncollectible_at: (r.uncollectible_at as string | null) ?? null,
          uncollectible_reason: (r.uncollectible_reason as string | null) ?? null,
        }
      })
      setReport(buildUncollectibleReport(rows))
    })()
  }, [open, report])
  const download = () => {
    if (!report) return
    saveBlobAs(new Blob([uncollectibleReportCsv(report)], { type: 'text/csv;charset=utf-8' }), `uncollectible-${new Date().toISOString().slice(0, 10)}.csv`)
  }
  return (
    <div data-testid="uncollectible-list-block" style={{ marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.75rem 1rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'inherit' }}
      >
        <span aria-hidden>{open ? '▼' : '▶'}</span>
        <span style={{ fontWeight: 600 }}>Uncollectible: the accountant's list</span>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>the bills the office gave up on, by year, with a CSV for the books</span>
      </button>
      {open ? (
        <div style={{ padding: '0 1rem 1rem' }}>
          {error ? <p style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>Could not read the list: {error}</p> : null}
          {!report && !error ? <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Reading…</p> : null}
          {report && report.count === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Nothing has been marked Uncollectible.</p> : null}
          {report && report.count > 0 ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.75rem', fontSize: '0.875rem' }}>
                <span>
                  <strong>{report.count}</strong> bill{report.count === 1 ? '' : 's'} · <strong>{formatUsdNoCents(report.total)}</strong> given up on, all years
                </span>
                <button type="button" onClick={download} style={{ padding: '0.3rem 0.8rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem' }}>
                  Download CSV
                </button>
              </div>
              {report.years.map((y) => (
                <div key={y.year} style={{ marginBottom: '0.75rem' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', margin: '0.5rem 0 0.25rem' }}>
                    {`${y.year} · ${y.count} bill${y.count === 1 ? '' : 's'} · ${formatUsdNoCents(y.total)}`}
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                    <thead>
                      <tr style={{ color: 'var(--text-muted)', textAlign: 'left' }}>
                        <th style={{ padding: '0.25rem 0.5rem 0.25rem 0' }}>Given up on</th>
                        <th style={{ padding: '0.25rem 0.5rem' }}>Job</th>
                        <th style={{ padding: '0.25rem 0.5rem' }}>Customer</th>
                        <th style={{ padding: '0.25rem 0.5rem', textAlign: 'right' }}>Open</th>
                        <th style={{ padding: '0.25rem 0 0.25rem 0.5rem' }}>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {y.lines.map((l) => (
                        <tr key={l.id} style={{ borderTop: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.3rem 0.5rem 0.3rem 0', whiteSpace: 'nowrap' }}>{l.ymd ? uncollectibleDayWords(l.ymd) : '—'}</td>
                          <td style={{ padding: '0.3rem 0.5rem' }}>{`${l.number} · ${l.job}`}</td>
                          <td style={{ padding: '0.3rem 0.5rem' }}>{l.customer}</td>
                          <td style={{ padding: '0.3rem 0.5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>{formatUsdNoCents(l.open)}</td>
                          <td style={{ padding: '0.3rem 0 0.3rem 0.5rem', color: 'var(--text-red-700)', fontStyle: 'italic' }}>{l.reason || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
