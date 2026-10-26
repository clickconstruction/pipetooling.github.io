import type { CSSProperties } from 'react'
import type { StageFlow, StageId, StageReading } from '../../lib/bridge/stageFlow'

/**
 * Where the work piles up (the Bridge, link PR 1): the five stages as cards in
 * flow order, each with its pile, two flow lines with a subject, the weeks to
 * clear, and a badge. The link reads red. Pressing a card picks it; later PRs
 * hang the dial and the link's desk off the pick. A stage with a desk of its
 * own (Collect's, v2.5890) carries a door at the card's foot, there whichever
 * stage is the link; a stage with no desk yet draws no door.
 */

const label: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const det: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }

function toneColor(tone: StageReading['tone']): string {
  if (tone === 'link') return 'var(--text-red-700)'
  if (tone === 'pair') return 'var(--text-amber-800)'
  if (tone === 'muted') return 'var(--text-muted)'
  if (tone === 'green') return 'var(--text-green-700)'
  return 'var(--text)'
}

export type StageDeskDoor = { label: string; onPress: () => void }

function StageCard({ stage, picked, maxPileUsd, onPick, onOrder, desk }: { stage: StageReading; picked: boolean; maxPileUsd: number; onPick: (id: StageId) => void; onOrder?: (id: StageId) => void; desk?: StageDeskDoor }) {
  const h = stage.pile.usd == null ? 64 : Math.max(8, Math.round((stage.pile.usd / Math.max(1, maxPileUsd)) * 64))
  const pileBg = !stage.readable ? 'repeating-linear-gradient(135deg, var(--border) 0 6px, var(--surface) 6px 12px)' : stage.isLink ? 'var(--text-red-700)' : stage.pile.guessShare > 0 ? `linear-gradient(180deg, var(--border) 0 ${Math.round(stage.pile.guessShare * 100)}%, #93c5fd ${Math.round(stage.pile.guessShare * 100)}% 100%)` : '#93c5fd'
  // The badge is a sibling of the pick button, not a button inside it: nested interactive content is invalid markup.
  return (
    <div
      style={{
        color: picked ? 'var(--text)' : 'var(--text-muted)',
        background: 'var(--surface)',
        border: picked ? '2px solid var(--text-red-700)' : '1px solid var(--border)',
        borderRadius: 10,
        padding: picked ? 11 : 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minWidth: 0,
        minHeight: 190,
        boxShadow: picked ? '0 0 0 4px var(--bg-red-tint, transparent)' : undefined,
      }}
    >
    <button
      type="button"
      onClick={() => onPick(stage.id)}
      aria-pressed={picked}
      data-testid={`bridge-stage-${stage.id}`}
      style={{
        textAlign: 'left',
        font: 'inherit',
        color: 'inherit',
        background: 'none',
        border: 0,
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minWidth: 0,
        flex: 1,
        cursor: 'pointer',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ ...label, color: 'inherit' }}>{stage.name}</span>
        <span style={det}>{stage.object}</span>
        <span style={{ marginLeft: 'auto', ...det }}>→</span>
      </span>
      <span style={{ alignSelf: 'flex-end', fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: 'var(--border)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>↳ {stage.action}</span>
      <span style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 64 }}>
        <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: h, borderRadius: '4px 4px 0 0', background: pileBg, border: stage.readable ? undefined : '1px dashed var(--text-muted)', boxSizing: 'border-box', color: 'var(--text-muted)', fontWeight: 700 }}>{stage.readable ? '' : '?'}</span>
        <span style={{ fontSize: '0.78rem', lineHeight: 1.3, color: 'var(--text-muted)' }}>
          <b style={{ color: stage.isLink ? 'var(--text-red-700)' : 'var(--text)' }}>{stage.pile.headline}</b>
          {stage.pile.sub.map((s) => (
            <span key={s} style={{ display: 'block' }}>
              {s}
            </span>
          ))}
        </span>
      </span>
      {stage.flow.length > 0 && (
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column' }}>
          {stage.flow.map((f) => (
            <span key={f.who}>
              {f.who} <b style={{ color: 'var(--text)' }}>{f.usd}</b> {f.tail ?? 'a week'}
            </span>
          ))}
        </span>
      )}
      {stage.table && (
        <span style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr', gap: '2px 8px', fontSize: '0.78rem', color: 'var(--text-muted)', alignItems: 'baseline' }} data-testid={`bridge-stage-table-${stage.id}`}>
          <span />
          {stage.table.head.map((h) => (
            <span key={h} style={{ fontSize: '0.62rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {h}
            </span>
          ))}
          {stage.table.rows.map((r) => (
            <span key={r.label} style={{ display: 'contents' }}>
              <span>{r.label}</span>
              <b style={{ color: 'var(--text)' }}>{r.cells[0]}</b>
              <b style={{ color: 'var(--text-green-700)' }} title={r.note}>{r.cells[1]}</b>
              <b style={{ color: 'var(--text-red-700)' }}>{r.cells[2]}</b>
            </span>
          ))}
        </span>
      )}
      {stage.weeksText && (
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: toneColor(stage.tone) }}>
          {stage.weeksText}
          {stage.weeksText2 && <span style={{ display: 'block' }}>{stage.weeksText2}</span>}
        </span>
      )}
    </button>
      {onOrder ? (
        <button
          type="button"
          title="what to deal with first, in order"
          onClick={() => onOrder(stage.id)}
          style={{ font: 'inherit', background: 'none', border: 0, padding: 0, textAlign: 'left', alignSelf: 'flex-start', fontSize: '0.78rem', fontWeight: 700, color: toneColor(stage.tone), textDecoration: 'underline dotted', textUnderlineOffset: 3, cursor: 'pointer' }}
          data-testid={`bridge-stage-badge-${stage.id}`}
        >
          {stage.badge}
        </button>
      ) : (
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: toneColor(stage.tone) }} data-testid={`bridge-stage-badge-${stage.id}`}>
          {stage.badge}
        </span>
      )}
      {desk && (
        <button
          type="button"
          onClick={desk.onPress}
          data-testid={`bridge-stage-desk-${stage.id}`}
          style={{ font: 'inherit', marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '5px 9px', borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--text)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}
        >
          <span>{desk.label}</span>
          <span aria-hidden style={{ color: 'var(--text-muted)' }}>›</span>
        </button>
      )}
    </div>
  )
}

export function BridgeStages({ flow, pickedId, onPick, onOrder, desks }: { flow: StageFlow; pickedId: StageId | null; onPick: (id: StageId) => void; onOrder?: (id: StageId) => void; desks?: Partial<Record<StageId, StageDeskDoor>> }) {
  const maxPile = Math.max(1, ...flow.stages.map((s) => s.pile.usd ?? 0))
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem 0.9rem', marginTop: '0.6rem' }} data-testid="bridge-stages">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 0.9rem', alignItems: 'baseline', marginBottom: '0.5rem' }}>
        <span style={label}>Where the work piles up</span>
        <span style={det}>press a stage to read it</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10, alignItems: 'stretch' }}>
        {flow.stages.map((s) => (
          <StageCard key={s.id} stage={s} picked={pickedId === s.id} maxPileUsd={maxPile} onPick={onPick} onOrder={onOrder} desk={desks?.[s.id]} />
        ))}
      </div>
      <div style={{ ...det, marginTop: '0.5rem' }}>Market and Sales feed the field, so they read by pace against it. Build, Bill and Collect read by how many weeks it would take to clear what is already waiting, at today's pace. The grey part of a pile is work the app can only guess at. On Collect it is what is billed and not yet due.</div>
    </div>
  )
}
