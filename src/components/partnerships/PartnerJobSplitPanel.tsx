import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { parsePartnerSplitPreview, type PartnerSplitPreview } from '../../lib/partnerLedger/splitPreview'

/**
 * §3 profit-split panel on the job detail modal (PARTNERSHIPS_PLAN.md PR 5).
 * Mounts (dev only) under the profit band for jobs carrying the partner
 * majority flag: contract buckets from the verified cost streams, the split
 * at the partnership's percentages, and the idempotent Post / explicit
 * Reverse actions. Renders nothing for unflagged jobs; fail-soft pre-push.
 */

const money = (n: number) => `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const signed = (n: number) => `${n < 0 ? '−' : ''}${money(n)}`

type EstTransferRow = {
  bid_id: string
  bid_name: string
  hours: number
  rate: number
  amount: number
  applied_job_id: string | null
  applied_here: boolean
}

export function PartnerJobSplitPanel({ jobId }: { jobId: string }) {
  const [preview, setPreview] = useState<PartnerSplitPreview | null>(null)
  const [hidden, setHidden] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [estRows, setEstRows] = useState<EstTransferRow[]>([])
  const [estOn, setEstOn] = useState(true)

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_partner_job_split_preview', { p_job_id: jobId })
    if (error) {
      setHidden(true)
      return
    }
    const p = parsePartnerSplitPreview(data)
    if (!p || !p.exists) {
      setHidden(true)
      return
    }
    setHidden(false)
    setPreview(p)
    // §4h picker (PR 6) — fail-soft: pre-push or non-flagged just hides the block.
    const est = await supabase.rpc('get_partner_bid_estimating_hours', { p_job_id: jobId })
    if (!est.error && est.data && typeof est.data === 'object' && (est.data as Record<string, unknown>).exists === true) {
      const d = est.data as Record<string, unknown>
      setEstOn(d.est_transfer_on === true)
      setEstRows(
        Array.isArray(d.rows)
          ? (d.rows as Record<string, unknown>[])
              .filter((r) => typeof r.bid_id === 'string')
              .map((r) => ({
                bid_id: String(r.bid_id),
                bid_name: String(r.bid_name ?? ''),
                hours: Number(r.hours) || 0,
                rate: Number(r.rate) || 0,
                amount: Number(r.amount) || 0,
                applied_job_id: typeof r.applied_job_id === 'string' ? r.applied_job_id : null,
                applied_here: r.applied_here === true,
              }))
          : [],
      )
    } else {
      setEstRows([])
    }
  }, [jobId])

  useEffect(() => {
    setPreview(null)
    setHidden(false)
    setMsg(null)
    setErr(null)
    void load()
  }, [load])

  if (hidden || !preview) return null

  async function act(fn: 'post_partner_profit_share' | 'reverse_partner_profit_share') {
    setBusy(true)
    setErr(null)
    setMsg(null)
    const { data, error } = await supabase.rpc(fn, { p_job_id: jobId })
    if (error) {
      setErr(error.message)
    } else {
      const d = (data ?? {}) as Record<string, unknown>
      setMsg(
        fn === 'post_partner_profit_share'
          ? d.already === true
            ? 'Already posted — the live posting stands.'
            : `Posted ${money(Number(d.amount ?? 0))} to the partner ledger.`
          : `Reversed with an explicit negating row (${signed(Number(d.amount ?? 0))}).`,
      )
      await load()
    }
    setBusy(false)
  }

  const rows: [string, number][] = [
    ['Revenue', preview.revenue],
    ['Labor (crew wages + sub books)', -preview.labor],
    ['Direct expenses (other job charges)', -preview.direct],
    ['Materials (cards + supply + tally)', -preview.materials],
  ]

  const livePosting = preview.posted && !preview.posted.reversed ? preview.posted : null

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.8rem 0.9rem', marginTop: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>
          Partner split — {preview.partner_name} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>(§3, majority confirmed{preview.confirmed_at ? ` ${new Date(preview.confirmed_at).toLocaleDateString()}` : ''})</span>
        </span>
        {livePosting ? (
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#16a34a' }}>posted {money(livePosting.amount)}</span>
        ) : preview.posted?.reversed ? (
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>previous posting reversed</span>
        ) : null}
      </div>

      <div style={{ marginTop: '0.4rem' }}>
        {rows.map(([label, amount]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', padding: '0.25rem 0', fontSize: '0.8rem', borderBottom: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--text-700)' }}>{label}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{signed(amount)}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', padding: '0.3rem 0', fontSize: '0.82rem', fontWeight: 700 }}>
          <span>Profit</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{signed(preview.profit)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', padding: '0.2rem 0', fontSize: '0.78rem', color: 'var(--text-700)' }}>
          <span>Company first {preview.company_first_pct}%</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{signed(-preview.company_first)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', padding: '0.2rem 0 0.2rem 1rem', fontSize: '0.78rem', color: 'var(--text-700)' }}>
          <span>Partner {preview.partner_remainder_pct}% of remainder</span>
          <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: preview.partner_share >= 0 ? '#16a34a' : 'var(--text-red-600)' }}>{signed(preview.partner_share)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', padding: '0.2rem 0 0.2rem 1rem', fontSize: '0.78rem', color: 'var(--text-700)' }}>
          <span>Company share of remainder</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{signed(preview.company_share)}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem', alignItems: 'center' }}>
        {!livePosting ? (
          <button
            type="button"
            disabled={busy || !preview.profit_shares_on || preview.partner_share <= 0}
            onClick={() => void act('post_partner_profit_share')}
            title={!preview.profit_shares_on ? 'Profit shares are off for this partnership (Deal tab)' : preview.partner_share <= 0 ? 'Partner share is not positive' : undefined}
            style={{ font: 'inherit', fontSize: '0.8rem', fontWeight: 650, padding: '0.35rem 0.75rem', borderRadius: 6, border: 'none', background: '#2563eb', color: 'var(--surface)', cursor: 'pointer', opacity: busy || !preview.profit_shares_on || preview.partner_share <= 0 ? 0.55 : 1 }}
          >
            Post {money(Math.max(0, preview.partner_share))} to partner ledger
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void act('reverse_partner_profit_share')}
            style={{ font: 'inherit', fontSize: '0.8rem', fontWeight: 650, padding: '0.35rem 0.75rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text-red-600)', cursor: 'pointer', opacity: busy ? 0.55 : 1 }}
          >
            Reverse posting
          </button>
        )}
        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
          Posts once per job; reopening writes a reversal row, never an edit.
        </span>
      </div>
      {msg ? <p style={{ fontSize: '0.75rem', color: '#16a34a', margin: '0.4rem 0 0' }}>{msg}</p> : null}
      {err ? <p style={{ fontSize: '0.75rem', color: 'var(--text-red-600)', margin: '0.4rem 0 0' }}>{err}</p> : null}

      {estRows.length > 0 ? (
        <div style={{ marginTop: '0.7rem', borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
            Estimating at award (§4h)
          </div>
          {estRows.map((r) => (
            <div key={r.bid_id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.4rem 0.6rem', padding: '0.3rem 0', fontSize: '0.78rem', borderBottom: '1px solid var(--border)' }}>
              <span style={{ flex: '1 1 200px', minWidth: 0, color: 'var(--text-700)' }}>
                {r.bid_name} · {r.hours.toFixed(1)} h × ${r.rate}
              </span>
              <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{money(r.amount)}</span>
              {r.applied_here ? (
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#16a34a' }}>on this job</span>
              ) : r.applied_job_id ? (
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)' }}>applied to another job</span>
              ) : (
                <button
                  type="button"
                  disabled={busy || !estOn}
                  title={!estOn ? 'Estimate-hours transfer is off for this partnership (Deal tab)' : undefined}
                  onClick={() => {
                    void (async () => {
                      setBusy(true)
                      setErr(null)
                      const { data, error } = await supabase.rpc('apply_bid_estimating_hours_to_job', { p_job_id: jobId, p_bid_id: r.bid_id })
                      if (error) setErr(error.message)
                      else {
                        const d = (data ?? {}) as Record<string, unknown>
                        setMsg(d.already === true ? 'That bid’s transfer already exists.' : `Moved ${money(Number(d.amount ?? 0))} of estimating onto this job (direct expenses).`)
                        await load()
                      }
                      setBusy(false)
                    })()
                  }}
                  style={{ font: 'inherit', fontSize: '0.72rem', fontWeight: 650, padding: '0.2rem 0.55rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text-link)', cursor: 'pointer', opacity: busy || !estOn ? 0.55 : 1 }}
                >
                  Apply to this job
                </button>
              )}
            </div>
          ))}
          <p style={{ fontSize: '0.66rem', color: 'var(--text-muted)', margin: '0.35rem 0 0' }}>
            The partner was already paid these hours as estimating pay — applying moves the COST onto the job’s direct
            expenses so the split carries the price of winning it. One transfer per bid, ever.
          </p>
        </div>
      ) : null}
    </div>
  )
}
