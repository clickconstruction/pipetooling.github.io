/**
 * The What changed card (punch list #208, design spike): one list, newest first, with *You last
 * looked* as a line inside it — above the line is new, under it is seen — and **Mark as looked**
 * moving the line to now. The lines come from `lib/developments/whatChanged.ts`.
 */
import { useState, type CSSProperties } from 'react'
import { filterChangeLines, searchWords, splitForHighlight, type ChangeLine } from '../../lib/developments/whatChanged'
import { HISTORY_SOURCE } from '../../lib/developments/history'
import { ageWords, LinkButton, shortDay, timeOfDay } from './developmentPageBits'

function badge(line: ChangeLine): { glyph: string; bg: string; fg: string } {
  // A history entry wears its source's glyph: amber for what happened, the note's grey for what a person wrote.
  if (line.kind === 'entry') {
    const src = HISTORY_SOURCE[line.source ?? 'note']
    return line.source === 'note' || !line.source ? { glyph: src.glyph, bg: 'var(--bg-muted)', fg: 'var(--text-700)' } : { glyph: src.glyph, bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-800)' }
  }
  switch (line.kind) {
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

/** The text with the searched words lit. */
function Lit({ text, words }: { text: string; words: readonly string[] }) {
  if (words.length === 0) return <>{text}</>
  return (
    <>
      {splitForHighlight(text, words).map((part, i) =>
        part.hit ? (
          <mark key={i} style={{ background: 'var(--bg-amber-100)', color: 'inherit', borderRadius: 2, padding: '0 1px' }} data-testid="search-hit">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  )
}

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
  olderOpen,
  onToggleOlder,
  query,
}: {
  lines: ChangeLine[]
  /** Where the *You last looked* line sits, or null with no stamp yet. */
  sinceIndex: number | null
  lastLooked: string | null
  openAbout: (about: ChangeLine['about']) => void
  /** The lines under the since line fold by default (the owner, 2026-10-28: compact); the card's button and the line open them. */
  olderOpen: boolean
  onToggleOlder: () => void
  /** The search (the owner, 2026-10-28): people, jobs or bids; the matches show with their time as well as their day. */
  query?: string
}) {
  const [shown, setShown] = useState(PAGE)
  const searching = (query ?? '').trim() !== ''
  const words = searching ? searchWords(query ?? '') : []
  const rowStyle: CSSProperties = { display: 'grid', gridTemplateColumns: `${searching ? '124px' : '52px'} 22px 1fr`, gap: 10, alignItems: 'start', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: '0.84rem' }
  if (lines.length === 0) {
    return <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Nothing has moved on this site yet. A send, a stage move, a bill, a payment, a note, a question or a line kept above draws a line here.</p>
  }
  const row = (line: ChangeLine, isNew: boolean) => {
    const b = badge(line)
    const entry = line.kind === 'entry'
    return (
      <div key={line.id} style={{ ...rowStyle, ...(entry ? { background: 'var(--bg-subtle)', margin: '0 -8px', padding: '6px 8px', borderRadius: 6 } : {}), background: line.waitingDays != null ? 'var(--bg-amber-tint)' : entry ? 'var(--bg-subtle)' : undefined }} data-testid={entry ? 'history-entry-line' : 'changed-line'}>
        <span style={{ color: isNew ? 'var(--text-strong)' : 'var(--text-faint)', fontWeight: isNew ? 700 : 500, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }} title={line.dayOnly ? 'The source keeps the day, not the time' : new Date(line.at).toLocaleString()}>
          {shortDay(line.at)}
          {searching && !line.dayOnly && timeOfDay(line.at) ? <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}> · {timeOfDay(line.at)}</span> : null}
        </span>
        <span aria-hidden style={{ width: 22, height: 22, borderRadius: 9999, background: b.bg, color: b.fg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
          {b.glyph}
        </span>
        <span style={{ minWidth: 0 }}>
          <strong style={{ color: 'var(--text-strong)' }}>
            <Lit text={line.verb} words={words} />
          </strong>
          {' · '}
          {line.about.id && line.about.kind !== 'customer' ? (
            <LinkButton onClick={() => openAbout(line.about)}>
              <Lit text={line.about.label} words={words} />
            </LinkButton>
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>
              <Lit text={line.about.label} words={words} />
            </span>
          )}
          {line.detail ? (
            <span style={{ color: 'var(--text-muted)' }}>
              {' · '}
              <Lit text={line.detail} words={words} />
            </span>
          ) : null}
          {line.by ? (
            <span style={{ color: 'var(--text-faint)' }}>
              {' · '}
              <Lit text={line.by} words={words} />
            </span>
          ) : null}
          {line.via === 'mcp' ? (
            <span className="developmentViaMark" title={`Kept through MCP${line.agent ? ` by ${line.agent}` : ''}`}>
              via MCP
            </span>
          ) : null}
          {/* An entry's time is the point (kept at the email's time): drawn at the line's end, where the day column has no room for it. */}
          {line.withTime && !searching && !line.dayOnly && timeOfDay(line.at) ? <span style={{ color: 'var(--text-faint)', fontSize: '0.76rem' }}> · {timeOfDay(line.at)}</span> : null}
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

  // A search: every line that matches, new and old alike, newest first, with its time.
  if (searching) {
    const hits = filterChangeLines(lines, query ?? '')
    if (hits.length === 0) {
      return <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }} data-testid="feed-search-empty">Nothing on this site matches that. Try a number, a name or a word from a note.</p>
    }
    const visible = hits.slice(0, Math.max(shown, PAGE * 2))
    return (
      <div data-testid="feed-search-hits">
        {visible.map((line) => row(line, sinceIndex !== null && lines.indexOf(line) < sinceIndex))}
        {visible.length < hits.length ? (
          <div style={{ paddingTop: 8 }}>
            <LinkButton onClick={() => setShown(hits.length)}>Show all {hits.length} matches</LinkButton>
          </div>
        ) : null}
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

  // A stamp: the new lines above the since line, the older ones folded under it. With nothing new the
  // card's header carries the words and the button, so the line is not drawn twice.
  const fresh = lines.slice(0, sinceIndex)
  const older = lines.slice(sinceIndex)
  const olderVisible = olderOpen ? older.slice(0, shown) : []
  return (
    <div>
      {fresh.map((line) => row(line, true))}
      {fresh.length > 0 ? <SinceLine lastLooked={lastLooked} olderCount={older.length} open={olderOpen} onToggle={() => older.length > 0 && onToggleOlder()} everythingNew={older.length === 0} /> : null}
      {olderOpen ? (
        <div className="developmentUnfold" data-testid="older-lines">
          {olderVisible.map((line) => row(line, false))}
          {olderVisible.length < older.length ? (
            <div style={{ paddingTop: 8 }}>
              <LinkButton onClick={() => setShown(older.length)}>Show all {older.length} older lines</LinkButton>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
