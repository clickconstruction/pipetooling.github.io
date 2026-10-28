/**
 * The What changed card (punch list #208, design spike): one list, newest first, with *You last
 * looked* as a line inside it — above the line is new, under it is seen — and **Mark as looked**
 * moving the line to now. The lines come from `lib/developments/whatChanged.ts`.
 */
import { useState, type CSSProperties } from 'react'
import type { ChangeLine } from '../../lib/developments/whatChanged'
import { ageWords, LinkButton, shortDay } from './developmentPageBits'

function badge(kind: ChangeLine['kind']): { glyph: string; bg: string; fg: string } {
  switch (kind) {
    case 'paid':
      return { glyph: '$', bg: 'var(--bg-green-tint)', fg: 'var(--text-green-600)' }
    case 'billed':
      return { glyph: '➤', bg: 'var(--bg-green-tint)', fg: 'var(--text-green-600)' }
    case 'won':
      return { glyph: '✓', bg: 'var(--bg-green-tint)', fg: 'var(--text-green-600)' }
    case 'lost':
      return { glyph: '✕', bg: 'var(--bg-red-tint)', fg: 'var(--text-red-600)' }
    case 'sent':
    case 'contact':
      return { glyph: '➤', bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-800)' }
    case 'plans':
      return { glyph: '▤', bg: 'var(--bg-blue-tint)', fg: 'var(--text-blue-800)' }
    case 'stage':
    case 'new_job':
    case 'new_bid':
      return { glyph: '◆', bg: 'var(--bg-blue-tint)', fg: 'var(--text-blue-800)' }
    case 'asked':
      return { glyph: '?', bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-800)' }
    case 'answered':
      return { glyph: '↩', bg: 'var(--bg-green-tint)', fg: 'var(--text-green-600)' }
    case 'note':
      return { glyph: '✎', bg: 'var(--bg-muted)', fg: 'var(--text-muted)' }
  }
}

const PAGE = 12

export function DevelopmentFeed({
  lines,
  sinceIndex,
  lastLooked,
  openAbout,
}: {
  lines: ChangeLine[]
  /** Where the *You last looked* line sits, or null with no stamp yet. */
  sinceIndex: number | null
  lastLooked: string | null
  openAbout: (about: ChangeLine['about']) => void
}) {
  const [shown, setShown] = useState(PAGE)
  const visible = lines.slice(0, Math.max(shown, sinceIndex != null ? Math.min(sinceIndex + 4, lines.length) : 0))
  const rowStyle: CSSProperties = { display: 'grid', gridTemplateColumns: '52px 22px 1fr', gap: 10, alignItems: 'start', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: '0.84rem' }
  if (lines.length === 0) {
    return <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Nothing has moved on this site yet. A send, a stage move, a bill, a payment, a note or a question draws a line here.</p>
  }
  return (
    <div>
      {visible.map((line, i) => {
        const b = badge(line.kind)
        const isNew = sinceIndex != null && i < sinceIndex
        const node = (
          <div key={line.id} style={{ ...rowStyle, background: line.waitingDays != null ? 'var(--bg-amber-tint)' : undefined }} data-testid="changed-line">
            <span style={{ color: isNew ? 'var(--text-strong)' : 'var(--text-faint)', fontWeight: isNew ? 700 : 500, fontVariantNumeric: 'tabular-nums' }}>{shortDay(line.at)}</span>
            <span aria-hidden style={{ width: 22, height: 22, borderRadius: 9999, background: b.bg, color: b.fg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
              {b.glyph}
            </span>
            <span style={{ minWidth: 0 }}>
              <strong style={{ color: 'var(--text-strong)' }}>{line.verb}</strong>
              {' · '}
              {line.about.id ? (
                <LinkButton onClick={() => openAbout(line.about)}>{line.about.label}</LinkButton>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>{line.about.label}</span>
              )}
              {line.detail ? <span style={{ color: 'var(--text-muted)' }}> · {line.detail}</span> : null}
              {line.by ? <span style={{ color: 'var(--text-faint)' }}> · {line.by}</span> : null}
              {line.waitingDays != null ? (
                <span style={{ color: 'var(--text-amber-800)', fontWeight: 700 }}>
                  {' '}
                  · waiting {line.waitingDays === 0 ? 'since today' : `${line.waitingDays} ${line.waitingDays === 1 ? 'day' : 'days'}`}
                </span>
              ) : null}
            </span>
          </div>
        )
        if (sinceIndex != null && i === sinceIndex) {
          return (
            <div key={`since-${line.id}`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', color: 'var(--text-faint)', fontSize: '0.75rem' }} data-testid="since-line">
                <span style={{ flex: 1, borderTop: '2px dashed var(--border-strong)' }} />
                <span style={{ whiteSpace: 'nowrap' }}>
                  You last looked · {lastLooked ? `${shortDay(lastLooked)}${ageWords(lastLooked) && ageWords(lastLooked) !== 'today' ? ` · ${ageWords(lastLooked)} ago` : ''}` : '—'} · older ↓
                </span>
                <span style={{ flex: 1, borderTop: '2px dashed var(--border-strong)' }} />
              </div>
              {node}
            </div>
          )
        }
        return node
      })}
      {sinceIndex != null && sinceIndex >= visible.length ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', color: 'var(--text-faint)', fontSize: '0.75rem' }} data-testid="since-line">
          <span style={{ flex: 1, borderTop: '2px dashed var(--border-strong)' }} />
          <span>You last looked · {lastLooked ? shortDay(lastLooked) : '—'} · everything above is new</span>
          <span style={{ flex: 1, borderTop: '2px dashed var(--border-strong)' }} />
        </div>
      ) : null}
      {visible.length < lines.length ? (
        <div style={{ paddingTop: 8 }}>
          <LinkButton onClick={() => setShown(lines.length)}>Show all {lines.length} lines</LinkButton>
        </div>
      ) : null}
    </div>
  )
}
