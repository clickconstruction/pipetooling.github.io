import type { CSSProperties, MouseEvent } from 'react'
import type { LedgerAction, LedgerTone } from '../../lib/jobs/billedDatesLedger'
import type { BilledDatesTrack as TrackModel, BilledTrackMark } from '../../lib/jobs/billedDatesTrack'

/**
 * The Billed row's dates drawn as a track (v2.6139, punch list #217, jobs-pipeline-1): the
 * Track view of the dates block, the Lien desk's Deadlines glyphs at row height. Every mark,
 * band, tag and word comes from `buildBilledDatesTrack`; this only draws them. The guessed ring
 * and the promise ring open They said… / New date…; the flag and the band open the Lien window;
 * the *guessed · …* tag opens the pay-speeds breakdown.
 */

const INK: Record<LedgerTone, string> = {
  done: 'var(--text-strong)',
  plain: 'var(--text-strong)',
  green: 'var(--text-green-700)',
  amber: 'var(--text-amber-800)',
  red: 'var(--text-red-700)',
  blue: 'var(--text-blue-800)',
}
const MARK: Record<LedgerTone, string> = {
  done: 'var(--border-strong)',
  plain: 'var(--text-700)',
  green: '#16a34a',
  amber: '#d97706',
  red: '#dc2626',
  blue: '#2563eb',
}
const GREEN_HATCH = 'repeating-linear-gradient(135deg, #86efac 0 3px, var(--bg-green-tint) 3px 6px)'
const RED_HATCH = 'repeating-linear-gradient(135deg, #fca5a5 0 3px, var(--bg-red-tint) 3px 6px)'
const AMBER_HATCH = 'repeating-linear-gradient(135deg, #fcd34d 0 3px, var(--bg-amber-tint) 3px 6px)'

const TRACK_H = 64
const LINE_Y = 33
const FLAG_H = 12

function bandStyle(kind: TrackModel['band'] extends infer B ? (B extends { kind: infer K } ? K : never) : never, tone: LedgerTone): CSSProperties {
  const base: CSSProperties = { position: 'absolute', top: LINE_Y - 5, height: 10, borderRadius: 3, boxSizing: 'border-box' }
  if (kind === 'room') return { ...base, background: tone === 'amber' ? AMBER_HATCH : GREEN_HATCH }
  if (kind === 'short') return { ...base, background: RED_HATCH }
  if (kind === 'due') return { ...base, background: tone === 'red' ? RED_HATCH : AMBER_HATCH }
  if (kind === 'gone') return { ...base, top: 0, height: TRACK_H, borderRadius: 0, background: 'var(--bg-subtle)', borderLeft: '2px solid #dc2626' }
  return { ...base, border: `1px dotted ${tone === 'amber' || tone === 'red' ? MARK[tone] : 'var(--border-strong)'}`, background: 'transparent' }
}

function labelStyle(m: BilledTrackMark): CSSProperties {
  const edge = m.align === 'left' ? { left: `${m.pct}%`, transform: 'translateX(-4px)' } : m.align === 'right' ? { left: `${m.pct}%`, transform: 'translateX(calc(-100% + 4px))' } : { left: `${m.pct}%`, transform: 'translateX(-50%)' }
  return { position: 'absolute', ...edge, top: m.side === 'up' ? 0 : LINE_Y + 9, lineHeight: 1.15, whiteSpace: 'nowrap', textAlign: m.align === 'right' ? 'right' : m.align === 'left' ? 'left' : 'center', fontSize: 10, pointerEvents: 'none' }
}

function Glyph({ m }: { m: BilledTrackMark }) {
  const color = MARK[m.tone]
  if (m.glyph === 'today') return <span aria-hidden style={{ position: 'absolute', left: `calc(${m.pct}% - 0.5px)`, top: 4, width: 1, height: LINE_Y + 3, background: '#2563eb' }} />
  if (m.glyph === 'dot') return <span aria-hidden style={{ position: 'absolute', left: `calc(${m.pct}% - 4.5px)`, top: LINE_Y - 4.5, width: 9, height: 9, borderRadius: '50%', background: color }} />
  if (m.glyph === 'ring_dashed') return <span aria-hidden style={{ position: 'absolute', left: `calc(${m.pct}% - 6px)`, top: LINE_Y - 6, width: 12, height: 12, borderRadius: '50%', border: `2px dashed ${color}`, background: 'var(--surface)', boxSizing: 'border-box' }} />
  if (m.glyph === 'ring_solid') return <span aria-hidden style={{ position: 'absolute', left: `calc(${m.pct}% - 6px)`, top: LINE_Y - 6, width: 12, height: 12, borderRadius: '50%', border: `2.5px solid ${color}`, background: 'var(--surface)', boxSizing: 'border-box' }} />
  if (m.glyph === 'check') return <span aria-hidden style={{ position: 'absolute', left: `calc(${m.pct}% - 6px)`, top: LINE_Y - 6, width: 12, height: 12, borderRadius: '50%', background: '#15803d', color: '#fff', fontSize: 9, lineHeight: '12px', textAlign: 'center', fontWeight: 700 }}>✓</span>
  // the flag: a pole on the day and a pennant to its right
  return (
    <span aria-hidden style={{ position: 'absolute', left: `calc(${m.pct}% - 1px)`, top: LINE_Y - FLAG_H, width: 12, height: FLAG_H }}>
      <span style={{ position: 'absolute', left: 0, top: 0, width: 2, height: FLAG_H, background: color }} />
      <span style={{ position: 'absolute', left: 2, top: 0, width: 10, height: 8, background: color, clipPath: 'polygon(0 0, 100% 50%, 0 100%)' }} />
    </span>
  )
}

const pressStyle: CSSProperties = { position: 'absolute', top: 0, height: TRACK_H, width: 22, transform: 'translateX(-11px)', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }
const chipStyle = (tone: LedgerTone, door: boolean): CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '1px 7px', borderRadius: 999, fontSize: '0.6875rem', lineHeight: 1.3, border: `1px solid ${tone === 'done' || tone === 'plain' ? 'var(--border-strong)' : MARK[tone]}`, color: INK[tone], background: 'var(--surface)', font: 'inherit', cursor: door ? 'pointer' : 'default', whiteSpace: 'nowrap', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' })

export default function BilledDatesTrack({ track, onMoney, onLienDesk, onPaySpeeds }: { track: TrackModel; /** Opens They said… / New date…. */ onMoney?: () => void; /** Opens the job's Lien window. */ onLienDesk?: () => void; /** Opens the pay-speeds breakdown, the forecast's door. */ onPaySpeeds?: () => void }) {
  const doorFor = (action: LedgerAction | null): (() => void) | undefined => {
    if (action === 'they-said' || action === 'new-date') return onMoney
    if (action === 'lien-desk') return onLienDesk
    return undefined
  }
  const press = (e: MouseEvent, door: () => void) => {
    e.stopPropagation()
    door()
  }
  const band = track.band
  const bandDoor = band ? doorFor(band.action) : undefined
  const tag = track.tag
  const tagDoor = tag ? (tag.action === 'pay-speeds' ? onPaySpeeds : tag.action === 'new-date' ? onMoney : undefined) : undefined
  return (
    <div data-testid="billed-dates-track" aria-label={track.full} style={{ width: '100%', maxWidth: '100%', marginTop: '0.35rem', textAlign: 'left', fontVariantNumeric: 'tabular-nums' }}>
      <div style={{ position: 'relative', height: TRACK_H }}>
        <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, top: LINE_Y, height: 1, background: 'var(--border-strong)' }} />
        {band ? (
          <>
            <div role="img" aria-label={band.label} title={band.title} data-testid="billed-track-band" data-kind={band.kind} style={{ ...bandStyle(band.kind, band.tone), left: `${band.fromPct}%`, width: `${Math.max(0.6, band.toPct - band.fromPct)}%` }} />
            {band.toPct - band.fromPct >= 24 && band.kind !== 'gone' ? (
              <span aria-hidden style={{ position: 'absolute', left: `${(band.fromPct + band.toPct) / 2}%`, transform: 'translateX(-50%)', top: LINE_Y - 4, fontSize: 8, lineHeight: 1, fontWeight: 700, color: INK[band.tone], whiteSpace: 'nowrap', pointerEvents: 'none' }}>{band.label}</span>
            ) : null}
            {bandDoor ? <button type="button" aria-label={`${band.label} — open the Lien window`} onClick={(e) => press(e, bandDoor)} style={{ position: 'absolute', left: `${band.fromPct}%`, width: `${Math.max(0.6, band.toPct - band.fromPct)}%`, top: LINE_Y - 8, height: 16, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }} /> : null}
          </>
        ) : null}
        {track.marks.map((m) => {
          const door = doorFor(m.action)
          const ink = m.key === 'today' ? 'var(--text-link)' : m.bold || m.tone === 'amber' || m.tone === 'red' ? INK[m.tone] : 'var(--text-strong)'
          return (
            <span key={m.key} data-testid={`billed-track-mark-${m.key}`} data-glyph={m.glyph}>
              <Glyph m={m} />
              <span style={labelStyle(m)}>
                <b style={{ display: 'block', fontWeight: 600, color: ink }}>{m.label}</b>
                <span style={{ display: 'block', fontSize: 9, color: m.key === 'money' && m.glyph === 'ring_dashed' ? INK[m.tone] : 'var(--text-muted)' }}>{m.sub}</span>
              </span>
              {door ? <button type="button" aria-label={`${m.label} · ${m.sub} — ${m.action === 'lien-desk' ? 'open the Lien window' : m.action === 'new-date' ? 'record a new date the customer named' : 'record what the customer said'}`} title={m.title} onClick={(e) => press(e, door)} style={{ ...pressStyle, left: `${m.pct}%` }} /> : <span role="img" aria-label={`${m.label} · ${m.sub}`} title={m.title} style={{ ...pressStyle, cursor: 'default', left: `${m.pct}%` }} />}
            </span>
          )
        })}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2, minWidth: 0 }}>
        {tag ? (
          tagDoor ? (
            <button type="button" data-testid="billed-track-tag" title={`${tag.title} — ${tag.action === 'pay-speeds' ? 'click to see the payments it read' : 'click to record a new date the customer named'}`} onClick={(e) => press(e, tagDoor)} style={chipStyle(tag.kind === 'promise' ? 'blue' : 'plain', true)}>
              {tag.words}
              <span aria-hidden style={{ color: 'var(--text-link)' }}>↗</span>
            </button>
          ) : (
            <span data-testid="billed-track-tag" title={tag.title} style={chipStyle(tag.kind === 'promise' ? 'blue' : 'plain', false)}>{tag.words}</span>
          )
        ) : null}
        {band ? (
          bandDoor ? (
            <button type="button" data-testid="billed-track-verdict" title={band.title} onClick={(e) => press(e, bandDoor)} style={{ ...chipStyle(band.tone, true), fontWeight: 600 }}>{band.label}</button>
          ) : (
            <span data-testid="billed-track-verdict" title={band.title} style={{ ...chipStyle(band.tone, false), fontWeight: 600 }}>{band.label}</span>
          )
        ) : null}
        {track.state ? <span data-testid="billed-track-state" title={track.state.title} style={chipStyle(track.state.tone, false)}>{track.state.words}</span> : null}
      </div>
    </div>
  )
}
