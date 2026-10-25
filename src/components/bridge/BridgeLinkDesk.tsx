import { useEffect, useState, type CSSProperties } from 'react'
import type { BridgeCall, CallLink, CallMove } from '../../lib/bridge/calls'
import { CALL_LINK_NAMES, stageKindOf } from '../../lib/bridge/calls'
import { LINK_DESK } from '../../lib/bridge/linkDesk'

/**
 * The link's desk (link PR 2): for the pressed stage, what it is, why it
 * matters, how the Bridge reads it, today's reading, and the moves the week
 * would make with an owner each. "This is the link this week" records the
 * call with a snapshot of today's numbers.
 */

const label: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const det: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
const inputStyle: CSSProperties = { font: 'inherit', fontSize: '0.8rem', padding: '0.15rem 0.4rem', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--surface)', color: 'var(--text)', width: 110 }

export type DeskMoveDraft = { key: CallMove['key']; title: string; who: string; then: number | null; on: boolean }

export function BridgeLinkDesk({
  link,
  status,
  todayReading,
  moveNumbers,
  thisWeekCall,
  recording,
  onRecord,
  dayLabel,
  door,
}: {
  link: CallLink
  status: string
  todayReading: string
  /** Today's numbers by move key, for the snapshot. */
  moveNumbers: Partial<Record<CallMove['key'], number | null>>
  thisWeekCall: BridgeCall | null
  recording: boolean
  onRecord: (moves: CallMove[], note: string | null) => void
  dayLabel: (ymd: string) => string
  /** A door under today's reading (v2.5853: Collect's *Break it down*). */
  door?: { label: string; onPress: () => void }
}) {
  const desk = LINK_DESK[link]
  const [drafts, setDrafts] = useState<DeskMoveDraft[]>([])
  const [note, setNote] = useState('')
  useEffect(() => {
    setDrafts(desk.moves.map((m) => ({ key: m.key, title: m.title, who: '', then: m.key === 'other' ? null : (moveNumbers[m.key] ?? null), on: true })))
    setNote('')
  }, [link, desk, moveNumbers])
  const recorded = thisWeekCall?.link === link
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem 0.9rem', marginTop: '0.6rem' }} data-testid="bridge-link-desk">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 0.9rem', alignItems: 'baseline' }}>
        <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>{CALL_LINK_NAMES[link]}</span>
        <span style={det}>· {stageKindOf(link)}</span>
        <span style={{ ...det, marginLeft: 'auto' }} data-testid="bridge-link-desk-status">
          {status}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.5rem 1.2rem', marginTop: '0.5rem', fontSize: '0.85rem' }}>
        <div>
          <div style={label}>What it is</div>
          <div>{desk.what}</div>
        </div>
        <div>
          <div style={label}>Why it matters to throughput</div>
          <div>{desk.why}</div>
        </div>
        <div>
          <div style={label}>How the Bridge reads it</div>
          <div>{desk.how}</div>
        </div>
        <div>
          <div style={label}>Today's reading</div>
          <div data-testid="bridge-link-desk-today">{todayReading}</div>
          {door && (
            <button type="button" onClick={door.onPress} style={{ marginTop: 6, height: 30, padding: '0 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }} data-testid="bridge-link-desk-door">
              {door.label} ›
            </button>
          )}
        </div>
      </div>
      <div style={{ marginTop: '0.6rem' }}>
        <div style={label}>If this is the link, this week we would</div>
        <ol style={{ margin: '0.3rem 0 0', paddingLeft: '1.3rem', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {drafts.map((m, i) => (
            <li key={m.title} style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'baseline', flex: '1 1 300px', minWidth: 0 }}>
                <input type="checkbox" checked={m.on} disabled={recorded} onChange={(e) => setDrafts((ds) => ds.map((d, j) => (j === i ? { ...d, on: e.target.checked } : d)))} />
                <span>{m.title}</span>
                {m.then != null && <span style={det}>· {m.key === 'approve' ? `${Math.round(m.then)}h` : m.key === 'bill' || m.key === 'chase' ? `$${Math.round(m.then / 1000)}k` : `${Math.round(m.then)}`} today</span>}
              </label>
              <input aria-label={`Owner of: ${m.title}`} placeholder="owner" value={m.who} disabled={recorded} onChange={(e) => setDrafts((ds) => ds.map((d, j) => (j === i ? { ...d, who: e.target.value } : d)))} style={inputStyle} />
            </li>
          ))}
        </ol>
      </div>
      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.6rem' }}>
        {recorded && thisWeekCall ? (
          <span style={{ fontSize: '0.85rem', color: 'var(--text-green-700)', fontWeight: 600 }} data-testid="bridge-link-desk-recorded">
            This week's call: {CALL_LINK_NAMES[thisWeekCall.link]}, recorded {dayLabel(thisWeekCall.calledOn)}
            {thisWeekCall.calledByName ? ` by ${thisWeekCall.calledByName}` : ''}. Friday asks whether it moved.
          </span>
        ) : (
          <>
            <span style={det}>{thisWeekCall ? `This week's call is ${CALL_LINK_NAMES[thisWeekCall.link]}. Recording this one replaces it.` : 'No call recorded for this week yet.'}</span>
            <input aria-label="A note on the call" placeholder="a note, if any" value={note} onChange={(e) => setNote(e.target.value)} style={{ ...inputStyle, width: 220 }} />
            <button
              type="button"
              disabled={recording}
              onClick={() => onRecord(drafts.filter((d) => d.on).map(({ key, title, who, then }) => ({ key, title, who: who.trim(), then })), note.trim() || null)}
              style={{ marginLeft: 'auto', font: 'inherit', fontSize: '0.85rem', fontWeight: 600, padding: '0.35rem 0.8rem', border: '1px solid var(--text-green-700)', borderRadius: 6, background: 'var(--bg-green-tint, var(--surface))', color: 'var(--text-green-700)', cursor: 'pointer' }}
              data-testid="bridge-link-desk-record"
            >
              {recording ? 'Recording…' : `This is the link this week: ${CALL_LINK_NAMES[link]}`}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
