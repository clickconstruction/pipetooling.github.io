import { useCallback, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { pairExactValueMatches, unambiguousMatches, type BackfillBid, type BackfillJob, type BidJobValueMatch } from '../../lib/jobs/bidJobValueMatches'

/**
 * Settings → Data & recovery (dev): the one-time list of unlinked jobs whose price
 * equals a won bid's value to the dollar (Burn against the bid, PR 5 — v2.3306).
 * Each row links with a confirm (`snapshot_job_budget_from_bid`: the job is stamped
 * with the bid, the bid reads Started, the estimate becomes the budget); "Link all
 * unambiguous" takes every row that has exactly one match on both sides. A job that
 * matches two bids, or a bid two jobs, waits for a person. Nothing auto-links.
 */
const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function BidJobBackfillSettingsBlock() {
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [pairs, setPairs] = useState<BidJobValueMatch[] | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [bidsRes, jobsRes] = await Promise.all([
        supabase.from('bids').select('id, bid_number, project_name, outcome, bid_value, agreed_value').in('outcome', ['won', 'started_or_complete']).limit(1000),
        supabase.from('jobs_ledger').select('id, hcp_number, job_name, revenue, status, bid_id').is('bid_id', null).gt('revenue', 0).limit(1000),
      ])
      if (bidsRes.error) throw bidsRes.error
      if (jobsRes.error) throw jobsRes.error
      setPairs(pairExactValueMatches({ bids: (bidsRes.data ?? []) as BackfillBid[], jobs: (jobsRes.data ?? []) as BackfillJob[] }))
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not load the bid ↔ job matches'), 'error')
      setPairs([])
    } finally {
      setLoading(false)
    }
  }, [showToast])

  const link = useCallback(
    async (p: BidJobValueMatch): Promise<boolean> => {
      const { error } = await supabase.rpc('snapshot_job_budget_from_bid', { p_job_id: p.jobId, p_bid_id: p.bidId })
      if (error) {
        showToast(`${p.jobLabel}: ${error.message}`, 'error')
        return false
      }
      return true
    },
    [showToast],
  )

  const linkOne = async (p: BidJobValueMatch) => {
    const ok = await confirmDialog({ message: `Link ${p.jobLabel} to ${p.bidLabel}? The job is stamped with the bid, the bid reads Started, and the bid's estimate becomes the job's budget.`, confirmLabel: 'Link' })
    if (!ok) return
    setBusy(p.jobId)
    if (await link(p)) showToast(`${p.jobLabel} linked to ${p.bidLabel}.`, 'success')
    setBusy(null)
    void load()
  }

  const linkAll = async () => {
    const todo = unambiguousMatches(pairs ?? [])
    if (todo.length === 0) return
    const ok = await confirmDialog({ message: `Link ${todo.length} job${todo.length === 1 ? '' : 's'} to their bids? Each job is stamped with its bid, each bid reads Started, and each bid's estimate becomes its job's budget. Ambiguous rows are skipped.`, confirmLabel: `Link ${todo.length}` })
    if (!ok) return
    setBusy('all')
    let done = 0
    for (const p of todo) if (await link(p)) done += 1
    setBusy(null)
    showToast(`${done} of ${todo.length} linked.`, done === todo.length ? 'success' : 'info')
    void load()
  }

  const ambiguous = (pairs ?? []).filter((p) => p.ambiguous).length
  const clean = (pairs ?? []).length - ambiguous

  return (
    <div id="settings-bid-job-backfill" style={{ marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8 }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen((prev) => {
            const next = !prev
            if (next && pairs == null) void load()
            return next
          })
        }}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', padding: '0.85rem 1rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', font: 'inherit' }}
      >
        <span>
          <span style={{ fontWeight: 600 }}>Link jobs to their bids</span>
          <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>Unlinked jobs whose price equals a won bid's value to the dollar. Linking stamps the job with the bid and takes the bid's estimate as its budget (Burn reads against it). Nothing links on its own.</span>
        </span>
        <span aria-hidden style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{open ? '▼' : '▶'}</span>
      </button>
      {open ? (
        <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid var(--border)' }}>
          {loading || pairs == null ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Reading won bids and unlinked jobs…</p>
          ) : pairs.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No unlinked job matches a won bid's value. Every job that came from a bid is linked.</p>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', margin: '0.75rem 0', fontSize: '0.85rem' }}>
                <span>
                  <b>{pairs.length}</b> match{pairs.length === 1 ? '' : 'es'} · {clean} clear{ambiguous > 0 ? ` · ${ambiguous} ambiguous (a job or a bid with two matches — pick by hand)` : ''}
                </span>
                {clean > 0 ? (
                  <button type="button" onClick={() => void linkAll()} disabled={busy != null} style={{ padding: '0.35rem 0.75rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600 }}>
                    {busy === 'all' ? 'Linking…' : `Link all ${clean} unambiguous`}
                  </button>
                ) : null}
                <button type="button" onClick={() => void load()} disabled={busy != null} style={{ padding: '0.35rem 0.6rem', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 6, cursor: 'pointer', fontSize: '0.8125rem' }}>
                  Refresh
                </button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.3rem 0.5rem', fontWeight: 500 }}>Job</th>
                    <th style={{ padding: '0.3rem 0.5rem', fontWeight: 500 }}>Bid</th>
                    <th style={{ padding: '0.3rem 0.5rem', fontWeight: 500, textAlign: 'right' }}>Value</th>
                    <th style={{ width: '7rem' }} />
                  </tr>
                </thead>
                <tbody>
                  {pairs.map((p) => (
                    <tr key={`${p.jobId}:${p.bidId}`} style={{ borderTop: '1px solid var(--border)' }} data-testid="bid-job-match">
                      <td style={{ padding: '0.35rem 0.5rem' }}>
                        {p.jobLabel} <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{p.jobStatus ?? ''}</span>
                      </td>
                      <td style={{ padding: '0.35rem 0.5rem' }}>
                        {p.bidLabel}
                        {p.ambiguous ? <span style={{ marginLeft: 6, fontSize: '0.72rem', color: 'var(--text-amber-700)', fontWeight: 600 }}>ambiguous</span> : null}
                      </td>
                      <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{usd(p.jobRevenue)}</td>
                      <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>
                        <button type="button" onClick={() => void linkOne(p)} disabled={busy != null} style={{ padding: '0.25rem 0.6rem', background: 'var(--surface)', color: 'var(--text-blue-700)', border: '1px solid var(--border-strong)', borderRadius: 6, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
                          {busy === p.jobId ? 'Linking…' : 'Link'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
