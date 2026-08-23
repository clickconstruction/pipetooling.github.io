/**
 * Followup → "Full bid details": the bids in this package (versions) with their latest send —
 * date + ★ value — when the bid is split (v2.2124). Renders nothing for an unsplit bid.
 */
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatSendBadge, latestSendByVersion, type VersionSendRow } from '../../lib/bids/versionSends'
import { formatCurrency } from '../../lib/format'

type VersionRow = { id: string; name: string; sort_order: number; include_in_submission: boolean; is_alternate?: boolean | null }

export function BidPackageSendsDetails({ bidId }: { bidId: string }) {
  const [versions, setVersions] = useState<VersionRow[]>([])
  const [sends, setSends] = useState<VersionSendRow[]>([])
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const [{ data: v }, { data: s, error }] = await Promise.all([
        supabase.from('bid_versions').select('id, name, sort_order, include_in_submission, is_alternate').eq('bid_id', bidId).order('sort_order'),
        supabase.from('bid_version_sends').select('bid_version_id, sent_on, value, is_alternate, created_at').eq('bid_id', bidId),
      ])
      if (cancelled) return
      setVersions(((v ?? []) as VersionRow[]))
      setSends(error ? [] : ((s ?? []) as VersionSendRow[]))
    }
    void load()
    const onChanged = () => { void load() }
    window.addEventListener('bid-version-sends-changed', onChanged)
    return () => { cancelled = true; window.removeEventListener('bid-version-sends-changed', onChanged) }
  }, [bidId])
  if (versions.length === 0) return null
  const latest = latestSendByVersion(sends)
  return (
    <div style={{ gridColumn: '1 / -1', minWidth: 0 }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Bids in this package</div>
      {versions.map((v) => {
        const badge = formatSendBadge(latest[v.id], { money: (n) => `$${formatCurrency(n)}` })
        return (
          <div key={v.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', fontSize: '0.85rem', padding: '0.1rem 0', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600 }}>{v.name}</span>
            <span style={{ fontSize: '0.75rem', color: v.include_in_submission ? 'var(--text-green-600)' : 'var(--text-muted)' }}>
              {v.include_in_submission ? (v.is_alternate ? 'alternate' : 'base') : 'not in letter'}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{badge ?? 'not sent'}</span>
          </div>
        )
      })}
    </div>
  )
}
