import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react'
import type { JobActivityLine } from '../../lib/jobs/jobActivityLine'
import { groupJobActivityLinesByDay, isConversationalLine } from '../../lib/jobs/jobActivityLine'

/**
 * The shared Job activity feed (v2.1673) — ONE rendering used by every Pipeline
 * activity surface: the floating modal, the expanded row's panel and that
 * panel's full-screen mode. Before this, the same thread had three different
 * looks and only two of them numbered anything.
 *
 * Anatomy (owner-approved mockup): left-aligned day headers carrying the date
 * AND the age, then one line per item — EVERY line numbered. There is no
 * kind/tag column; the hierarchy is carried by treatment instead. Notes and
 * reports (a person talking) sit on a faint tinted band so speech reads as
 * blocks in the system stream; system-recorded rows (clock, schedule, crew,
 * status) render muted between them, their names de-emphasised too — on
 * "Paige added to crew" the event is the news, not the author. Long report
 * answers and clock/schedule notes fold into `detail`, opened by clicking the
 * line.
 *
 * Wide shells align number · time · person · body into columns. Narrow shells
 * (≤700px) render each line as ONE FLOWING LINE — number gutter, then
 * time name — body with a hanging indent — instead of spending a whole row on
 * metadata; ragged body starts are fine at phone width (the row preview box
 * has always read this way).
 *
 * Rows are divs with a keyboard handler, NOT buttons: notes can contain links
 * and an opened report needs selectable text, and nested interactives inside a
 * button are invalid. Clicks inside the opened detail select text; they don't
 * collapse the line.
 */

const dayHeadStyle: CSSProperties = {
  textAlign: 'left',
  color: 'var(--text-faint)',
  fontSize: '0.65rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  padding: '0.7rem 2px 0.2rem',
}

const numStyle: CSSProperties = {
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
  flexShrink: 0,
}

const timeStyle: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: '0.6875rem',
  color: 'var(--text-muted)',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
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
  /** Narrow shells (≤700px) switch to the flowing-line layout. */
  narrow?: boolean
}

export function JobActivityFeed({ lines, filtered, narrow = false }: Props) {
  const [openKeys, setOpenKeys] = useState<ReadonlySet<string>>(() => new Set())
  const scrollRef = useRef<HTMLDivElement | null>(null)
  // Whether the reader is parked at the newest item. New arrivals re-pin only
  // then — a filter change or a realtime insert must never yank someone who
  // scrolled up to read an old report.
  const atBottomRef = useRef(true)

  const loaded = lines != null
  const groups = loaded ? groupJobActivityLinesByDay(lines) : []
  const count = lines?.length ?? 0

  // Newest sits at the bottom (transcript order) — start there.
  useEffect(() => {
    const el = scrollRef.current
    if (el && atBottomRef.current) el.scrollTop = el.scrollHeight
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
      onScroll={(e) => {
        const el = e.currentTarget
        atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60
      }}
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
              const hasDetail = line.detail.length > 0
              const msg = isConversationalLine(line)
              // Report answers fold (they're long); schedule/clock notes are a
              // sentence and show by default (owner call). openKeys therefore
              // stores TOGGLES away from each line's default, not "open".
              const defaultOpen = hasDetail && line.kind !== 'report'
              const open = openKeys.has(line.key) ? !defaultOpen : defaultOpen

              const onRowClick = (e: MouseEvent<HTMLDivElement>) => {
                // Clicks inside the opened detail select/copy; they don't collapse.
                if ((e.target as HTMLElement).closest('[data-activity-detail]')) return
                toggle(line.key)
              }
              const onRowKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
                if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
                  e.preventDefault()
                  toggle(line.key)
                }
              }

              const num = (
                <span style={numStyle} aria-label={`Entry ${line.number}`}>
                  {line.number}
                </span>
              )
              const time = <span style={timeStyle}>{line.timeLabel}</span>
              const who = (
                <span
                  style={{
                    fontSize: '0.75rem',
                    // The strong name is reserved for speech; on system rows
                    // the body is the news, not the author.
                    fontWeight: msg ? 650 : 500,
                    color: msg ? 'var(--text-strong)' : 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                    ...(narrow ? null : { overflow: 'hidden', textOverflow: 'ellipsis' }),
                  }}
                >
                  {line.who}
                </span>
              )
              const body = (
                <span
                  style={{
                    minWidth: 0,
                    lineHeight: 1.5,
                    color: msg ? 'var(--text-700)' : 'var(--text-muted)',
                    ...(narrow
                      ? { display: 'inline' }
                      : open
                        ? null
                        : {
                            overflow: 'hidden',
                            display: '-webkit-box',
                            WebkitBoxOrient: 'vertical' as const,
                            WebkitLineClamp: 1,
                          }),
                  }}
                >
                  {narrow && line.who ? <span style={{ color: 'var(--text-faint)' }}>{'— '}</span> : null}
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
              )
              const detail =
                hasDetail && open ? (
                  <span data-activity-detail style={{ display: 'block', margin: '4px 0 5px', cursor: 'text' }}>
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
                ) : null

              const rowShellStyle: CSSProperties = {
                width: '100%',
                textAlign: 'left',
                font: 'inherit',
                fontSize: '0.8125rem',
                borderBottom: `1px dashed ${msg ? 'transparent' : 'var(--border)'}`,
                padding: '3px 4px',
                cursor: 'pointer',
                // Tier 1: speech sits on a faint band so what people actually
                // said stands out of the system stream.
                ...(msg ? { background: 'var(--bg-subtle)', borderRadius: 6 } : null),
              }

              return (
                <div
                  key={line.key}
                  role="button"
                  tabIndex={0}
                  onClick={onRowClick}
                  onKeyDown={onRowKeyDown}
                  aria-expanded={open}
                  style={
                    narrow
                      ? { ...rowShellStyle, display: 'flex', gap: 8, alignItems: 'flex-start' }
                      : {
                          ...rowShellStyle,
                          display: 'grid',
                          gridTemplateColumns: '22px 52px 70px minmax(0, 1fr)',
                          columnGap: 8,
                          alignItems: 'baseline',
                        }
                  }
                >
                  {narrow ? (
                    <>
                      <span style={{ marginTop: 2, display: 'inline-flex' }}>{num}</span>
                      {/* One flowing line: time name — body, wrapping with a
                          hanging indent after the number gutter. */}
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span
                          style={
                            open
                              ? { display: 'block' }
                              : {
                                  overflow: 'hidden',
                                  display: '-webkit-box',
                                  WebkitBoxOrient: 'vertical' as const,
                                  WebkitLineClamp: 1,
                                }
                          }
                        >
                          <span style={{ ...timeStyle, marginRight: 7 }}>{line.timeLabel}</span>
                          <span style={{ marginRight: line.who ? 7 : 0, display: 'inline' }}>{who}</span>
                          {body}
                        </span>
                        {detail}
                      </span>
                    </>
                  ) : (
                    <>
                      <span style={{ justifySelf: 'start', display: 'inline-flex' }}>{num}</span>
                      {time}
                      {who}
                      <span style={{ minWidth: 0 }}>
                        {body}
                        {detail}
                      </span>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        ))
      )}
    </div>
  )
}
