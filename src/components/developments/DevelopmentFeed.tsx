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

/** The since line as a press: folded, it holds the older lines; open, it lets them out. */
function SinceLine({ lastLooked, olderCount, open, onToggle, everythingNew }: { lastLooked: string | null; olderCount: number; open: boolean; onToggle: () => void; everythingNew: boolean }) {
  const when = lastLooked ? `${shortDay(lastLooked)}${ageWords(lastLooked) && ageWords(lastLooked) !== 'today' ? ` · ${ageWords(lastLooked)} ago` : ''}` : '—'
  const older = everythingNew ? 'everything above is new' : olderCount === 1 ? '1 older' : `${olderCount} older`
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      data-testid="since-line"
      title={open ? 'Fold the lines you have seen' : 'Show the lines you have seen'}
      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '6px 0', border: 'none', background: 'none', font: 'inherit', color: 'var(--text-faint)', fontSize: '0.75rem', cursor: olderCount > 0 ? 'pointer' : 'default' }}
    >
      <span style={{ flex: 1, borderTop: '2px dashed var(--border-strong)' }} />
      <span style={{ whiteSpace: 'nowrap' }}>
        You last looked · {when} · {older}
        {olderCount > 0 ? <span aria-hidden> {open ? '▾' : '▸'}</span> : null}
      </span>
      <span style={{ flex: 1, borderTop: '2px dashed var(--border-strong)' }} />
    </button>
  )
}

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
  // The lines under the since line fold by default (the owner, 2026-10-28: compact, the line is what shows); the line opens them.
  const [olderOpen, setOlderOpen] = useState(false)
  const rowStyle: CSSProperties = { display: 'grid', gridTemplateColumns: '52px 22px 1fr', gap: 10, alignItems: 'start', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: '0.84rem' }
  if (lines.length === 0) {
    return <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Nothing has moved on this site yet. A send, a stage move, a bill, a payment, a note or a question draws a line here.</p>
  }
  const row = (line: ChangeLine, isNew: boolean) => {
    const b = badge(line.kind)
    return (
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
  }

  // No stamp yet: the first look, the newest page with Show all.
  if (sinceIndex === null) {
    const visible = lines.slice(0, shown)
    return (
      <div>
        {visible.map((line) => row(line, false))}
        {visible.length < lines.length ? (
          <div style={{ paddingTop: 8 }}>
            <LinkButton onClick={() => setShown(lines.length)}>Show all {lines.length} lines</LinkButton>
          </div>
        ) : null}
      </div>
    )
  }

  // A stamp: the new lines above the since line, the older ones folded under it.
  const fresh = lines.slice(0, sinceIndex)
  const older = lines.slice(sinceIndex)
  const olderVisible = olderOpen ? older.slice(0, shown) : []
  return (
    <div>
      {fresh.map((line) => row(line, true))}
      <SinceLine lastLooked={lastLooked} olderCount={older.length} open={olderOpen} onToggle={() => older.length > 0 && setOlderOpen((v) => !v)} everythingNew={older.length === 0} />
      {olderVisible.map((line) => row(line, false))}
      {olderOpen && olderVisible.length < older.length ? (
        <div style={{ paddingTop: 8 }}>
          <LinkButton onClick={() => setShown(older.length)}>Show all {older.length} older lines</LinkButton>
        </div>
      ) : null}
    </div>
  )
}
