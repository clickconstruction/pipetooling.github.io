/**
 * Followup → "Full bid details": the bids in this package (versions) with their latest send —
 * date + ★ value — when the bid is split (v2.2124). Renders nothing for an unsplit bid.
 */
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatSendBadge, latestSendByVersion, type VersionSendRow } from '../../lib/bids/versionSends'
import { groupVersionsByGc } from '../../lib/bids/gcPackets'
import { setGcPacketOutcome, type PacketOutcome } from '../../lib/bids/gcPacketOutcome'
import { useToastContext } from '../../contexts/ToastContext'
import { formatCurrency } from '../../lib/format'

type VersionRow = { id: string; name: string; sort_order: number; include_in_submission: boolean; is_alternate?: boolean | null; customer_id: string | null; created_at?: string | null; outcome?: string | null }

export function BidPackageSendsDetails({ bidId, bidOutcome = null, bidGcName = null, bidDateSent = null }: { bidId: string; bidOutcome?: string | null; bidGcName?: string | null; bidDateSent?: string | null }) {
  const { showToast } = useToastContext()
  const [versions, setVersions] = useState<VersionRow[]>([])
  const [sends, setSends] = useState<VersionSendRow[]>([])
  const [gcNames, setGcNames] = useState<Record<string, string>>({})
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const [{ data: v }, { data: s, error }] = await Promise.all([
        supabase.from('bid_versions').select('id, name, sort_order, include_in_submission, is_alternate, customer_id, created_at, outcome').eq('bid_id', bidId).order('sort_order'),
        supabase.from('bid_version_sends').select('bid_version_id, sent_on, value, is_alternate, created_at').eq('bid_id', bidId),
      ])
      if (cancelled) return
      const vs = ((v ?? []) as VersionRow[])
      setVersions(vs)
      setSends(error ? [] : ((s ?? []) as VersionSendRow[]))
      const cids = [...new Set(vs.map((x) => x.customer_id).filter((c): c is string => !!c))]
      if (cids.length > 0) { const { data: cs } = await supabase.from('customers').select('id, name').in('id', cids); if (!cancelled && cs) setGcNames(Object.fromEntries(cs.map((c) => [c.id, c.name ?? '—']))) }
    }
    void load()
    const onChanged = () => { void load() }
    window.addEventListener('bid-version-sends-changed', onChanged)
    window.addEventListener('bid-gc-outcome-changed', onChanged)
    return () => { cancelled = true; window.removeEventListener('bid-version-sends-changed', onChanged); window.removeEventListener('bid-gc-outcome-changed', onChanged) }
  }, [bidId])
  if (versions.length === 0) return null
  const latest = latestSendByVersion(sends)
  const packets = groupVersionsByGc(versions, { bidGcName, gcNames, latestSends: latest, bidDateSent })
  const fmtSent = (ymd: string) => { const [, m, d] = ymd.split('-'); return m && d ? `${Number(m)}/${Number(d)}` : ymd }
  async function change(pKey: string, next: PacketOutcome) {
    const p = packets.find((x) => x.key === pKey)
    if (!p) return
    const after = packets.map((x) => (x.key === pKey ? { outcome: next, sentOn: x.sentOn } : { outcome: x.outcome, sentOn: x.sentOn }))
    const res = await setGcPacketOutcome({ bidId, bidOutcome, versionIds: p.versions.map((v) => v.id), outcome: next, packetsAfter: after })
    if (res.error) { showToast('Could not save: ' + res.error, 'error'); return }
    window.dispatchEvent(new Event('bid-gc-outcome-changed'))
    if (res.bidOutcomeSet) showToast(`Bid marked ${res.bidOutcomeSet}.`, 'success')
  }
  return (
    <div style={{ gridColumn: '1 / -1', minWidth: 0 }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Sent to — by GC</div>
      {packets.map((p) => (
        <div key={p.key} style={{ padding: '0.2rem 0 0.35rem' }}>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', fontSize: '0.85rem', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600 }}>{p.name}</span>
            <span style={{ fontSize: '0.75rem', color: p.sentOn ? 'var(--text-green-600)' : 'var(--text-muted)' }}>{p.sentOn ? `sent ${fmtSent(p.sentOn)}` : 'not sent'}{p.sentValue != null ? ` · ★ $${formatCurrency(p.sentValue)}` : ''}</span>
            <select value={p.outcome ?? ''} onChange={(e) => void change(p.key, (e.target.value || null) as PacketOutcome)} aria-label={`Outcome with ${p.name}`} style={{ font: 'inherit', fontSize: '0.74rem', padding: '0.1rem 0.3rem', borderRadius: 4, border: '1px solid var(--border-strong)', background: p.outcome === 'won' ? 'var(--bg-green-tint)' : p.outcome === 'lost' ? 'var(--bg-red-tint)' : 'var(--surface)', color: 'var(--text-strong)' }}>
              <option value="">waiting…</option><option value="won">won</option><option value="lost">lost</option>
            </select>
          </div>
          {p.versions.map((v) => {
            const badge = formatSendBadge(latest[v.id], { money: (n) => `$${formatCurrency(n)}` })
            return (
              <div key={v.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', fontSize: '0.78rem', padding: '0.05rem 0 0.05rem 1rem', color: 'var(--text-600)', flexWrap: 'wrap' }}>
                <span>{v.name}</span>
                <span style={{ fontSize: '0.72rem', color: v.include_in_submission ? 'var(--text-green-600)' : 'var(--text-muted)' }}>{v.include_in_submission ? (v.is_alternate ? 'alternate' : 'base') : 'not in letter'}</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{badge ?? (p.sentOn && !latest[v.id] && (!v.created_at || String(v.created_at).slice(0, 10) <= p.sentOn) ? `sent ${fmtSent(p.sentOn)}` : 'not sent')}</span>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
