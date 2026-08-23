/**
 * Bid Board: the per-GC lines under a bid that has more than one GC packet (Bids by GC, v2.2162) —
 * GC · sent · ★ value · outcome (won / lost) per GC. The row the owner sketched.
 */
import { useState } from 'react'
import type { GcPacket } from '../../lib/bids/gcPackets'
import { setGcPacketOutcome, type PacketOutcome } from '../../lib/bids/gcPacketOutcome'
import { useToastContext } from '../../contexts/ToastContext'
import { formatCurrency } from '../../lib/format'

export function gcRowsWorthShowing(packets: GcPacket[] | undefined): boolean {
  if (!packets) return false
  // An unsplit bid with only "Also sent to" GCs keeps its +N GCs pill; the rows need a real packet to anchor to.
  if (!packets.some((p) => p.versions.length > 0)) return false
  return packets.length > 1 || packets.some((p) => p.gcId != null)
}

/** The per-GC lines (name · sent · ★ value · outcome) — shared by the table row and the phone card. */
export function BidBoardGcLines({ bidId, bidOutcome, packets, onChanged }: { bidId: string; bidOutcome: string | null; packets: GcPacket[]; onChanged: () => void }) {
  const { showToast } = useToastContext()
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const fmtSent = (ymd: string) => { const [, m, d] = ymd.split('-'); return m && d ? `${Number(m)}/${Number(d)}` : ymd }
  async function change(p: GcPacket, next: PacketOutcome) {
    setBusyKey(p.key)
    const after = packets.map((x) => (x.key === p.key ? { outcome: next, sentOn: x.sentOn } : { outcome: x.outcome, sentOn: x.sentOn }))
    const res = await setGcPacketOutcome({ bidId, bidOutcome, versionIds: p.versions.map((v) => v.id), outcome: next, packetsAfter: after })
    setBusyKey(null)
    if (res.error) { showToast('Could not save: ' + res.error, 'error'); return }
    window.dispatchEvent(new Event('bid-gc-outcome-changed'))
    if (res.bidOutcomeSet) showToast(`Bid marked ${res.bidOutcomeSet} (${next === 'won' ? 'with ' + p.name : 'every GC lost'}).`, 'success')
    onChanged()
  }
  return (
        <div style={{ display: 'grid', gap: '0.15rem', fontSize: '0.78rem', color: 'var(--text-700)' }}>
          {packets.map((p) => {
            const value = p.sentValue
            if (p.sharedLetter) {
              // "Also sent to" GC without its own packet: same letter as the bid's GC, answer tracked with the bid.
              return (
                <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }} title="On the bid's “Also sent to” list — got the same letter as the bid's GC. Give it its own packet (＋ Another GC…) to track its answer separately.">
                  <span style={{ fontWeight: 600, color: 'var(--text-strong)', minWidth: '10em' }}>{p.name}</span>
                  <span style={{ color: 'var(--text-muted)' }}>same letter as {packets.find((x) => !x.sharedLetter)?.name ?? 'the bid’s GC'}{p.sentOn ? ` · sent ${fmtSent(p.sentOn)}` : ''}</span>
                </div>
              )
            }
            return (
              <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-strong)', minWidth: '10em' }}>{p.name}</span>
                <span style={{ color: p.sentOn ? 'var(--text-green-600)' : 'var(--text-muted)' }}>{p.sentOn ? `sent ${fmtSent(p.sentOn)}` : 'not sent'}</span>
                {value != null ? <span style={{ fontVariantNumeric: 'tabular-nums' }}>★ ${formatCurrency(value)}</span> : null}
                {p.versions.length > 1 ? <span style={{ color: 'var(--text-muted)' }}>{p.versions.length} versions</span> : null}
                <select
                  value={p.outcome ?? ''}
                  disabled={busyKey === p.key}
                  onChange={(e) => void change(p, (e.target.value || null) as PacketOutcome)}
                  aria-label={`Outcome with ${p.name}`}
                  title="Outcome with this GC"
                  style={{ font: 'inherit', fontSize: '0.74rem', padding: '0.1rem 0.3rem', borderRadius: 4, border: '1px solid var(--border-strong)', background: p.outcome === 'won' ? 'var(--bg-green-tint)' : p.outcome === 'lost' ? 'var(--bg-red-tint)' : 'var(--surface)', color: 'var(--text-strong)' }}
                >
                  <option value="">waiting…</option>
                  <option value="won">won</option>
                  <option value="lost">lost</option>
                </select>
              </div>
            )
          })}
        </div>
  )
}

/** Table variant: one full-width row under the bid's row. */
export function BidBoardGcRows({ colSpan, ...rest }: { bidId: string; bidOutcome: string | null; packets: GcPacket[]; colSpan: number; onChanged: () => void }) {
  return (
    <tr style={{ background: 'var(--bg-subtle)' }} onClick={(e) => e.stopPropagation()}>
      <td colSpan={colSpan} style={{ padding: '0.25rem 1rem 0.35rem 2rem', borderTop: '1px dashed var(--border)' }}>
        <BidBoardGcLines {...rest} />
      </td>
    </tr>
  )
}
