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
import { GcOutcomePill } from './BidBoardGcRows'
import { BidWonJobActions } from './BidWonJobActions'
import { formatCurrency } from '../../lib/format'

type VersionRow = { id: string; name: string; sort_order: number; include_in_submission: boolean; is_alternate?: boolean | null; customer_id: string | null; created_at?: string | null; outcome?: string | null }

export function BidPackageSendsDetails({ bidId, bidOutcome = null, bidGcName = null, bidDateSent = null }: { bidId: string; bidOutcome?: string | null; bidGcName?: string | null; bidDateSent?: string | null }) {
  const { showToast } = useToastContext()
  const [versions, setVersions] = useState<VersionRow[]>([])
  const [sends, setSends] = useState<VersionSendRow[]>([])
  const [gcNames, setGcNames] = useState<Record<string, string>>({})
  const [recipients, setRecipients] = useState<Array<{ customerId: string; name: string }>>([])
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const [{ data: v }, { data: s, error }, recRes] = await Promise.all([
        supabase.from('bid_versions').select('id, name, sort_order, include_in_submission, is_alternate, customer_id, created_at, outcome').eq('bid_id', bidId).order('sort_order'),
        supabase.from('bid_version_sends').select('bid_version_id, sent_on, value, is_alternate, created_at').eq('bid_id', bidId),
        supabase.from('bid_gc_recipients').select('customer_id, customers(name)').eq('bid_id', bidId),
      ])
      if (cancelled) return
      const vs = ((v ?? []) as VersionRow[])
      setVersions(vs)
      setSends(error ? [] : ((s ?? []) as VersionSendRow[]))
      type RecRow = { customer_id: string; customers: { name: string | null } | { name: string | null }[] | null }
      setRecipients(((recRes.data ?? []) as RecRow[]).map((r) => ({ customerId: r.customer_id, name: (Array.isArray(r.customers) ? r.customers[0]?.name : r.customers?.name) ?? '—' })))
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
  const packets = groupVersionsByGc(versions, { bidGcName, gcNames, latestSends: latest, bidDateSent, recipients })
  const fmtSent = (ymd: string) => { const [, m, d] = ymd.split('-'); return m && d ? `${Number(m)}/${Number(d)}` : ymd }
  async function change(pKey: string, next: PacketOutcome) {
    const p = packets.find((x) => x.key === pKey)
    if (!p) return
    const after = packets.map((x) => ({ key: x.key, name: x.name, outcome: x.key === pKey ? next : x.outcome, sentOn: x.sentOn, versionIds: x.versions.map((v) => v.id), sharedLetter: x.sharedLetter }))
    const res = await setGcPacketOutcome({ bidId, bidOutcome, versionIds: p.versions.map((v) => v.id), outcome: next, packetsAfter: after })
    if (res.error) { showToast('Could not save: ' + res.error, 'error'); return }
    window.dispatchEvent(new Event('bid-gc-outcome-changed'))
    const autoNote = res.autoLost.length > 0 ? ` — ${res.autoLost.join(', ')} marked lost · GC lost the project.` : ''
    if (res.bidOutcomeSet) showToast(`Bid marked ${res.bidOutcomeSet}${autoNote}`, 'success')
    else if (autoNote) showToast(`${p.name} marked won${autoNote}`, 'success')
  }
  return (
    <div style={{ gridColumn: '1 / -1', minWidth: 0 }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Sent to — by GC</div>
      {packets.map((p) => p.sharedLetter ? (
        <div key={p.key} style={{ padding: '0.2rem 0 0.35rem', display: 'flex', gap: '0.6rem', alignItems: 'center', fontSize: '0.85rem', flexWrap: 'wrap' }} title="On the bid's “Also sent to” list — got the same letter as the bid's GC. Give it its own packet (＋ Add GC on the bid's pages) to track its answer separately.">
          <span style={{ fontWeight: 600 }}>{p.name}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>same letter as {packets.find((x) => !x.sharedLetter)?.name ?? 'the bid’s GC'}{p.sentOn ? ` · sent ${fmtSent(p.sentOn)}` : ''}</span>
        </div>
      ) : (
        <div key={p.key} style={{ padding: '0.2rem 0 0.35rem' }}>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', fontSize: '0.85rem', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600 }}>{p.name}</span>
            <span style={{ fontSize: '0.75rem', color: p.sentOn ? 'var(--text-green-600)' : 'var(--text-muted)' }}>{p.sentOn ? `sent ${fmtSent(p.sentOn)}` : 'not sent'}{p.sentValue != null ? ` · ★ $${formatCurrency(p.sentValue)}` : ''}</span>
            <GcOutcomePill value={p.outcome === 'won' || p.outcome === 'lost' ? p.outcome : null} gcName={p.name} onChange={(next) => void change(p.key, next)} />
            {/* Tier-1 #8: the per-GC Won moment offers the job right here. */}
            {p.outcome === 'won' ? <BidWonJobActions bidId={bidId} compact /> : null}
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
