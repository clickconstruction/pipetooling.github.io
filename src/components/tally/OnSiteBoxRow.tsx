/**
 * A box as one row (v2.8284): its name, how it sits, its line, how its count stands, and a chevron. It was drawn
 * inside `TallyOnSiteTab.tsx` until the office's Materials desk needed the same row on a phone, where each box had
 * been a card with a table wider than the card. The row's last line and its amber are `lib/materials/boxRow.ts`.
 *
 * The whole row is one press. With `to` it is a link (the desk's row, which opens the Tally's box screen); with
 * `action` its right end reads the act in words where the chevron stands (an empty box's **Add a part**).
 */
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { boxRowState } from '../../lib/materials/boxRow'
import type { BoxLine } from '../../lib/materials/boxLine'
import { boxKindWords } from '../../lib/materials/editBox'
import type { Container, lastCountedAt } from '../../lib/materials/onSite'

const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.85rem' }
const rowStyle = (amber: boolean): CSSProperties => ({ background: 'var(--surface)', borderWidth: 1, borderStyle: 'solid', borderColor: amber ? 'var(--text-amber-800)' : 'var(--border)', borderRadius: 10, textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'var(--text-strong)', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.08)', minHeight: 48, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', textDecoration: 'none', boxSizing: 'border-box', width: '100%', minWidth: 0 })

export default function OnSiteBoxRow({ box, line, parts, cannot, last, now, stickers, onPress, to, action, testId }: {
  box: Container
  line: BoxLine
  /** The parts with something on hand. */
  parts: number
  /** Pieces pressed Can't find since the last count. */
  cannot: number
  last: ReturnType<typeof lastCountedAt>
  now: Date
  /** What the stickers on it say, when that is news. */
  stickers?: string
  onPress?: () => void
  to?: string
  /** The act the press does, in words at the row's right end, where the chevron otherwise stands. */
  action?: string
  testId?: string
}) {
  const state = boxRowState({ kind: box.kind, parts, lineIsApps: line.by === 'app', last, now, cannot })
  const style = rowStyle(state.amber || cannot > 0)
  const body = (
    <>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '0.02em' }}>{box.label}</span>
          {stickers ? <span style={{ ...muted, fontWeight: 600 }} title="The stickers on it" data-testid="on-site-box-stickers">· {stickers}</span> : null}
          <span style={{ ...muted, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.75rem', fontWeight: 600 }}>{box.kind === 'unsorted' ? 'delivered' : boxKindWords(box.kind).toLowerCase()}</span>
          {box.where ? <span style={muted}>{box.where}</span> : null}
        </div>
        {line.text ? <div style={{ fontWeight: 600, marginTop: '0.15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} data-testid="on-site-box-row-line" data-by={line.by}>{line.text}</div> : null}
        <div style={{ ...muted, marginTop: '0.15rem' }} data-testid="on-site-box-row-state">
          {state.partsWords ? <><b style={{ color: 'var(--text-strong)', fontWeight: 600 }}>{state.partsWords}</b> · </> : null}
          <span style={state.amber ? { color: 'var(--text-amber-700)', fontWeight: 600 } : undefined}>{state.stateWords}</span>
          {cannot > 0 ? <> · <span style={{ color: 'var(--text-amber-700)', fontWeight: 600 }}>{cannot} can't find</span></> : null}
        </div>
      </div>
      {action ? <span style={{ flex: '0 0 auto', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-link)', whiteSpace: 'nowrap' }}>{action}</span> : <span aria-hidden style={{ color: 'var(--text-faint)', fontSize: '1.5rem', lineHeight: 1 }}>›</span>}
    </>
  )
  if (to) return <Link to={to} style={style} data-testid={testId} data-box-card={box.id}>{body}</Link>
  return <button type="button" onClick={onPress} style={style} data-testid={testId} data-box-card={box.id}>{body}</button>
}
