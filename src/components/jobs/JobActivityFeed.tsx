import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { eventRenderMeta } from '../../lib/jobActivityEvent'
import type { JobActivityLine } from '../../lib/jobs/jobActivityLine'
import { groupJobActivityLinesByDay } from '../../lib/jobs/jobActivityLine'

/**
 * The shared Job activity feed (v2.1673) — ONE rendering used by every Pipeline
 * activity surface: the floating modal, the expanded row's panel and that
 * panel's full-screen mode. Before this, the same thread had three different
 * looks and only two of them numbered anything.
 *
 * Anatomy (owner-approved mockup): day headers carrying the date AND the age,
 * then one line per item on a column grid — number · time · kind · person ·
 * body. The columns are the compaction: the meta stacks down the page instead
 * of running inline through every row, so thirteen items fit where the old
 * modal showed three. Long report answers and clock/schedule notes fold into
 * `detail`, opened by clicking the line.
 *
 * Numbering comes from the kernel and matches the row preview box, so
 * "check note 3" means note 3 on every surface.
 */

const KIND_TAG_COLOR: Record<string, string> = {
  report: '#2563eb',
  schedule_block: '#15803d',
  clock_session: '#4f46e5',
}

function tagColor(line: JobActivityLine): string {
  if (line.kind === 'event' && line.eventType) return eventRenderMeta(line.eventType).tagColor
  return KIND_TAG_COLOR[line.kind] ?? 'var(--text-muted)'
}

const dayHeadStyle: CSSProperties = {
  textAlign: 'center',
  color: 'var(--text-faint)',
  fontSize: '0.65rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  padding: '0.7rem 0 0.2rem',
}

const numStyle: CSSProperties = {
  justifySelf: 'start',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 18,
  height: 18,
  borderRadius: '50%',
  border: '1px solid var(--border-strong)',
  color: 'var(--text-muted)',
  fontSize: '0.625rem',
  fontWeight: 700,
  lineHeight: 1,
  fontVariantNumeric: 'tabular-nums',
}

const pendingChipStyle: CSSProperties = {
  fontSize: '0.625rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  color: 'var(--text-amber-800)',
  background: 'var(--bg-amber-100)',
  border: '1px solid var(--border-amber-soft)',
  borderRadius: 4,
  padding: '0 0.3rem',
  marginLeft: '0.35rem',
  verticalAlign: 'middle',
}

type Props = {
  /** null while the lazy load is in flight. */
  lines: JobActivityLine[] | null
  /** True when a filter is hiding everything (changes the empty copy). */
  filtered: boolean
  /**
   * Narrow shells (full screen on a phone) drop the columns and put the body on
   * its own row underneath the meta — five columns can't fit at 380px.
   */
  narrow?: boolean
}

export function JobActivityFeed({ lines, filtered, narrow = false }: Props) {
  const [openKeys, setOpenKeys] = useState<ReadonlySet<string>>(() => new Set())
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const loaded = lines != null
  const groups = loaded ? groupJobActivityLinesByDay(lines) : []
  const count = lines?.length ?? 0

  // Newest sits at the bottom (transcript order) — start there. Opening a line
  // must NOT re-pin, or reading an old report would yank you back to today.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [loaded, count])

  const toggle = (key: string) => {
    setOpenKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div
      ref={scrollRef}
      style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0.2rem 0.9rem 0.8rem', scrollbarWidth: 'thin' }}
    >
      {!loaded ? (
        <div style={{ color: 'var(--text-faint)', padding: '1.5rem 0', textAlign: 'center' }}>Loading activity…</div>
      ) : groups.length === 0 ? (
        <div style={{ color: 'var(--text-faint)', padding: '1.5rem 0', textAlign: 'center' }}>
          {filtered ? 'Nothing here for this filter' : 'No activity yet — post the first note'}
        </div>
      ) : (
        groups.map((g) => (
          <div key={g.dayKey || 'unknown-day'}>
            <div style={dayHeadStyle}>
              {g.label}
              {g.agoLabel ? ` · ${g.agoLabel}` : ''}
            </div>
            {g.lines.map((line) => {
              const open = openKeys.has(line.key)
              const hasDetail = line.detail.length > 0
              return (
                <button
                  key={line.key}
                  type="button"
                  onClick={() => toggle(line.key)}
                  aria-expanded={open}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: narrow ? '20px 46px minmax(0, 1fr)' : '22px 52px 48px 70px minmax(0, 1fr)',
                    columnGap: 8,
                    rowGap: narrow ? 2 : 0,
                    alignItems: 'baseline',
                    width: '100%',
                    textAlign: 'left',
                    font: 'inherit',
                    fontSize: '0.8125rem',
                    color: 'var(--text-700)',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px dashed var(--border)',
                    padding: '3px 2px',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    style={{
                      ...numStyle,
                      ...(line.number == null ? { borderColor: 'transparent' } : null),
                      ...(narrow ? { gridColumn: 1, gridRow: 1 } : null),
                    }}
                    {...(line.number == null ? { 'aria-hidden': true } : { 'aria-label': `Entry ${line.number}` })}
                  >
                    {line.number ?? ''}
                  </span>
                  <span
                    style={{
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                      fontSize: '0.6875rem',
                      color: 'var(--text-muted)',
                      fontVariantNumeric: 'tabular-nums',
                      whiteSpace: 'nowrap',
                      ...(narrow ? { gridColumn: 2, gridRow: 1 } : null),
                    }}
                  >
                    {line.timeLabel}
                  </span>
                  <span
                    style={{
                      fontSize: '0.625rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      whiteSpace: 'nowrap',
                      color: tagColor(line),
                      ...(narrow ? { gridColumn: 3, gridRow: 1, justifySelf: 'end' } : null),
                    }}
                  >
                    {line.kindLabel}
                  </span>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 650,
                      color: 'var(--text-strong)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      ...(narrow ? { gridColumn: 3, gridRow: 1, justifySelf: 'start' } : null),
                    }}
                  >
                    {line.who}
                  </span>
                  <span
                    style={{
                      minWidth: 0,
                      lineHeight: 1.5,
                      ...(narrow ? { gridColumn: '2 / 4', gridRow: 2 } : null),
                      ...(open
                        ? null
                        : {
                            overflow: 'hidden',
                            display: '-webkit-box',
                            WebkitBoxOrient: 'vertical' as const,
                            WebkitLineClamp: 1,
                          }),
                    }}
                  >
                    {line.body}
                    {line.pending ? <span style={pendingChipStyle}>Pending</span> : null}
                    {hasDetail && !open ? (
                      <span style={{ color: 'var(--text-link)', fontWeight: 600, fontSize: '0.6875rem', marginLeft: '0.35rem' }}>
                        {line.kind === 'report'
                          ? `▸ ${line.detail.length} answer${line.detail.length === 1 ? '' : 's'}`
                          : '▸ note'}
                      </span>
                    ) : null}
                  </span>
                  {hasDetail && open ? (
                    <span
                      style={{
                        display: 'block',
                        margin: '4px 0 5px',
                        ...(narrow ? { gridColumn: '2 / 4', gridRow: 3 } : { gridColumn: 5 }),
                      }}
                    >
                      {line.detail.map((d, i) => (
                        <span
                          key={`${d.label ?? ''}-${i}`}
                          style={{
                            display: 'block',
                            marginTop: 3,
                            color: 'var(--text-gray-800)',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                          }}
                        >
                          {d.label ? <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{d.label} — </span> : null}
                          {d.value}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        ))
      )}
    </div>
  )
}
