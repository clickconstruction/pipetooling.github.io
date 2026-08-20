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

export function PartnerJobSplitPanel({ jobId }: { jobId: string }) {
  const [preview, setPreview] = useState<PartnerSplitPreview | null>(null)
  const [hidden, setHidden] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

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
    </div>
  )
}
