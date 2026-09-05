/**
 * Bid Board, per-GC (Bids by GC, v2.2162 → in-cell v2.2183): a bid that went to more than one GC
 * lists each GC in its GC/Builder cell — name · sent m/d · a small state pill (waiting / won / lost).
 * The pill is the control: tap it and the three choices pop beside it. Same lines on the phone card
 * and in Followup's "Sent to — by GC". Option A from the owner's pick (artifact 8e510a77).
 */
import { useEffect, useRef, useState } from 'react'
import { roomGcKey, type BidRoomStateSummary } from '../../lib/bids/bidRoomState'
import { BidRoomStateChip } from './BidRoomStateChip'
import type { GcPacket } from '../../lib/bids/gcPackets'
import { setGcPacketOutcome, type PacketOutcome } from '../../lib/bids/gcPacketOutcome'
import { gcNoteCountKey } from '../../lib/bids/bidGcNotes'
import { BidGcNotesPopover } from './BidGcNotesPopover'
import { useToastContext } from '../../contexts/ToastContext'
import { formatCurrency } from '../../lib/format'
import type { BidBoardJobLink } from '../../lib/bids/bidBoardJobLinks'
import { BidWonJobActions } from './BidWonJobActions'

export function gcRowsWorthShowing(packets: GcPacket[] | undefined): boolean {
  if (!packets) return false
  // An unsplit bid with only "Also sent to" GCs keeps its +N GCs pill; the lines need a real packet to anchor to.
  if (!packets.some((p) => p.versions.length > 0)) return false
  return packets.length > 1 || packets.some((p) => p.gcId != null)
}

export function fmtSentShort(ymd: string): string {
  const [, m, d] = ymd.split('-')
  return m && d ? `${Number(m)}/${Number(d)}` : ymd
}

const PILL_BASE: React.CSSProperties = {
  display: 'inline-block',
  fontFamily: 'inherit',
  fontSize: '0.66rem',
  fontWeight: 600,
  lineHeight: 1.3,
  padding: '0.05rem 0.45rem',
  borderRadius: 999,
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

function pillStyle(state: PacketOutcome, opts?: { dim?: boolean }): React.CSSProperties {
  if (state === 'won') return { ...PILL_BASE, background: 'var(--bg-emerald-tint)', color: 'var(--text-emerald-800)', borderColor: 'transparent', opacity: opts?.dim ? 0.55 : 1 }
  if (state === 'lost') return { ...PILL_BASE, background: 'var(--bg-red-tint)', color: 'var(--text-red-800)', borderColor: 'transparent', opacity: opts?.dim ? 0.55 : 1 }
  return { ...PILL_BASE, opacity: opts?.dim ? 0.55 : 1 }
}

/**
 * The state pill + its popover (waiting / won / lost). Controlled by the parent; `busy` greys it while
 * a write is in flight. Click-outside and Escape close the popover.
 */
export function GcOutcomePill({ value, gcName, busy, onChange }: { value: PacketOutcome; gcName: string; busy?: boolean; onChange: (next: PacketOutcome) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement | null>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey, true)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey, true) }
  }, [open])
  const label = value === 'won' ? 'won' : value === 'lost' ? 'lost' : 'waiting'
  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        disabled={busy}
        aria-label={`Outcome with ${gcName}: ${label}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={`Outcome with ${gcName} — tap to change`}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
        style={{ ...pillStyle(value), cursor: busy ? 'progress' : 'pointer' }}
      >
        {label}
      </button>
      {open ? (
        <span
          role="listbox"
          aria-label={`Outcome with ${gcName}`}
          style={{ position: 'absolute', left: 'calc(100% + 0.35rem)', top: '50%', transform: 'translateY(-50%)', zIndex: 30, display: 'inline-flex', gap: '0.25rem', padding: '0.2rem 0.3rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.14)' }}
        >
          {([null, 'won', 'lost'] as PacketOutcome[]).map((opt) => (
            <button
              key={opt ?? 'waiting'}
              type="button"
              role="option"
              aria-selected={opt === value}
              onClick={(e) => { e.stopPropagation(); setOpen(false); if (opt !== value) onChange(opt) }}
              style={{ ...pillStyle(opt, { dim: opt !== value && opt != null }), outline: opt === value ? '2px solid var(--text-blue-500)' : 'none', outlineOffset: 1 }}
            >
              {opt ?? 'waiting'}
            </button>
          ))}
        </span>
      ) : null}
    </span>
  )
}

/**
 * The per-GC lines: one per packet — name · sent m/d · state pill (★ value in the tooltip). Shared by the
 * table cell, the phone card and Followup. `nameStyle` lets the caller match the surrounding text.
 */
export function BidBoardGcLines({ bidId, bidLabel, bidOutcome, packets, onChanged, dense, gcNoteCounts, roomStates, jobLink }: { bidId: string; bidLabel?: string; bidOutcome: string | null; packets: GcPacket[]; onChanged: () => void; dense?: boolean; gcNoteCounts?: Record<string, number>; roomStates?: Record<string, BidRoomStateSummary>; /** Tier-1 #8: the job already opened from this bid (board index, v2.2741) — null = none, undefined = look it up. */ jobLink?: BidBoardJobLink | null }) {
  const { showToast } = useToastContext()
  const [busyKey, setBusyKey] = useState<string | null>(null)
  /** Per-GC notes popover (v2.2217): the open packet's key, one at a time. */
  const [notesKey, setNotesKey] = useState<string | null>(null)
  async function change(p: GcPacket, next: PacketOutcome) {
    setBusyKey(p.key)
    const after = packets.map((x) => ({ key: x.key, name: x.name, outcome: x.key === p.key ? next : x.outcome, sentOn: x.sentOn, versionIds: x.versions.map((v) => v.id), sharedLetter: x.sharedLetter }))
    const res = await setGcPacketOutcome({ bidId, bidOutcome, versionIds: p.versions.map((v) => v.id), outcome: next, packetsAfter: after })
    setBusyKey(null)
    if (res.error) { showToast('Could not save: ' + res.error, 'error'); return }
    window.dispatchEvent(new Event('bid-gc-outcome-changed'))
    const autoNote = res.autoLost.length > 0 ? ` — ${res.autoLost.join(', ')} marked lost · GC lost the project.` : ''
    if (res.bidOutcomeSet) showToast(`Bid marked ${res.bidOutcomeSet} (${next === 'won' ? 'with ' + p.name : 'every GC lost'})${autoNote}`, 'success')
    else if (autoNote) showToast(`${p.name} marked won${autoNote}`, 'success')
    onChanged()
  }
  const primaryName = packets.find((x) => !x.sharedLetter)?.name ?? 'the bid’s GC'
  const noteCountOf = (p: GcPacket) => (p.gcId && gcNoteCounts ? gcNoteCounts[gcNoteCountKey(bidId, p.gcId)] ?? 0 : 0)
  const gcNameButton = (p: GcPacket) => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        setNotesKey(p.key)
      }}
      title={`Notes for ${p.name} on this bid`}
      style={{ fontFamily: 'inherit', fontWeight: 600, color: 'var(--text-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: '0 1 auto', minWidth: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', textDecoration: 'underline dotted', textDecorationColor: 'var(--text-faint)', textUnderlineOffset: 3 }}
    >
      {p.name}
    </button>
  )
  const noteBadge = (p: GcPacket) => {
    const n = noteCountOf(p)
    return n > 0 ? (
      <span title={`${n} note${n === 1 ? '' : 's'} for ${p.name} on this bid`} style={{ fontSize: '0.66rem', background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)', borderRadius: 7, padding: '0 0.4rem', whiteSpace: 'nowrap', flex: '0 0 auto' }}>
        {'\uD83D\uDCAC'} {n}
      </span>
    ) : null
  }
  // The bid's own GC has packet key '' — test against null, never truthiness.
  const openPacket = notesKey != null ? packets.find((x) => x.key === notesKey) ?? null : null
  return (
    <div style={{ display: 'grid', gap: dense ? '0.1rem' : '0.15rem', fontSize: dense ? '0.72rem' : '0.76rem', color: 'var(--text-muted)', minWidth: 0 }}>
      {packets.map((p) => {
        const state: PacketOutcome = p.outcome === 'won' || p.outcome === 'lost' ? p.outcome : null
        const title = [p.name, p.sentOn ? `sent ${fmtSentShort(p.sentOn)}` : 'not sent', p.sentValue != null ? `★ $${formatCurrency(p.sentValue)}` : null, p.versions.length > 1 ? `${p.versions.length} versions` : null].filter(Boolean).join(' · ')
        if (p.sharedLetter) {
          return (
            <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'nowrap', minWidth: 0 }} title={`${p.name} — on the bid’s “Also sent to” list: same letter as ${primaryName}. Give it its own packet (＋ Add GC) to track its answer.`}>
              <span style={{ whiteSpace: 'nowrap', minWidth: '4.2rem', color: p.sentOn ? 'var(--text-green-600)' : 'var(--text-faint)' }}>{p.sentOn ? `sent ${fmtSentShort(p.sentOn)}` : 'same letter'}</span>
              {gcNameButton(p)}
              {noteBadge(p)}
            </div>
          )
        }
        return (
          <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'nowrap', minWidth: 0 }} title={title}>
            {/* v2.2217: states LEFT of the name (fixed-width date column), then the clickable name → per-GC notes. */}
            <span style={{ color: p.sentOn ? 'var(--text-green-600)' : 'var(--text-faint)', whiteSpace: 'nowrap', flex: '0 0 auto', minWidth: '4.2rem', fontVariantNumeric: 'tabular-nums' }}>{p.sentOn ? `sent ${fmtSentShort(p.sentOn)}` : 'not sent'}</span>
            <GcOutcomePill value={state} gcName={p.name} busy={busyKey === p.key} onChange={(next) => void change(p, next)} />
            {/* Tier-1 #8: a pill that reads won is a Won moment — the job is one tap away. */}
            {state === 'won' ? <BidWonJobActions bidId={bidId} compact knownJob={jobLink} /> : null}
            {gcNameButton(p)}
            {noteBadge(p)}
            {roomStates ? <BidRoomStateChip state={roomStates[roomGcKey(p.gcId)]} compact /> : null}
          </div>
        )
      })}
      {openPacket ? (
        <BidGcNotesPopover
          bidId={bidId}
          bidLabel={bidLabel ?? 'this bid'}
          gcId={openPacket.gcId}
          gcName={openPacket.name}
          sentOn={openPacket.sentOn ? fmtSentShort(openPacket.sentOn) : null}
          outcome={openPacket.outcome === 'won' || openPacket.outcome === 'lost' ? openPacket.outcome : null}
          onClose={() => setNotesKey(null)}
          onChanged={onChanged}
        />
      ) : null}
    </div>
  )
}
