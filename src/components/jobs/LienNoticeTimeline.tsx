import type { CSSProperties } from 'react'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import type { LienTimelineRow, LienTimelineStatus } from '../../lib/jobs/lienNoticeTimeline'

/**
 * One notice's timeline, drawn down the brief (punch list #274, PR 2): one row per event or
 * window in date order — the date, the marker on a rail, the words, the kind chip, the status
 * and what happens next. Only events get a dot: a red square for the law's days, a green one
 * for a payment; a window we chose is a dashed bar. Today is a band across every column with
 * the one action it needs. The words all come from `lienNoticeTimeline`; nothing here reads.
 */

export type LienTimelineAction = { press: string; who: 'office' | 'leader'; means: string; instead: ReadonlyArray<{ press: string; means: string }> }

const PILL: Record<LienTimelineStatus, { bg: string; fg: string; border?: string; strike?: boolean }> = {
  done: { bg: 'var(--bg-green-tint)', fg: 'var(--text-green-700)' },
  paid: { bg: 'var(--bg-green-tint)', fg: 'var(--text-green-700)' },
  paying: { bg: 'var(--bg-green-tint)', fg: 'var(--text-green-700)', border: 'var(--text-green-700)' },
  open: { bg: 'var(--surface)', fg: 'var(--text-muted)', border: 'var(--border-strong)' },
  soon: { bg: 'var(--surface)', fg: 'var(--text-700)', border: 'var(--border-strong)' },
  now: { bg: 'var(--surface)', fg: 'var(--text-700)', border: 'var(--border-strong)' },
  late: { bg: '#b91c1c', fg: '#fff' },
  deadline: { bg: 'var(--bg-red-tint)', fg: 'var(--text-red-700)', border: 'var(--text-red-700)' },
  missed: { bg: '#b91c1c', fg: '#fff' },
  cleared: { bg: 'var(--surface)', fg: 'var(--text-muted)', border: 'var(--border-strong)', strike: true },
  skipped: { bg: 'var(--surface)', fg: 'var(--text-muted)', border: 'var(--border-strong)' },
}

const CHIP: Record<string, { bg: string; fg: string; dashed?: boolean }> = {
  'legal requirement': { bg: 'var(--bg-red-tint)', fg: 'var(--text-red-700)' },
  payment: { bg: 'var(--bg-green-tint)', fg: 'var(--text-green-700)' },
}

export function LienNoticeTimeline({ rows, isMobile, tone, action, picker }: { rows: ReadonlyArray<LienTimelineRow>; isMobile: boolean; tone: string; action?: LienTimelineAction | null; picker?: { options: ReadonlyArray<{ jobId: string; title: string }>; picked: string; onPick: (jobId: string) => void } | null }) {
  const dateCol = isMobile ? '5.6rem' : '9.5rem'
  const grid: CSSProperties = { display: 'grid', gridTemplateColumns: isMobile ? `${dateCol} 18px minmax(0, 1fr)` : `${dateCol} 22px minmax(0, 1fr) auto minmax(0, 13rem)`, columnGap: isMobile ? 8 : 12, alignItems: 'start', fontSize: '0.8125rem' }
  const dateCell: CSSProperties = { textAlign: 'right', fontWeight: 700, padding: '7px 0', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', color: 'var(--text-700)' }
  const sub: CSSProperties = { display: 'block', fontWeight: 500, color: 'var(--text-muted)', fontSize: '0.72rem' }
  const words: CSSProperties = { padding: '7px 0', lineHeight: 1.4, color: 'var(--text-700)', minWidth: 0 }
  const chipStyle = (chip: string): CSSProperties => {
    const c = CHIP[chip]
    return { display: 'inline-block', fontSize: '0.7rem', fontWeight: 700, padding: '1px 7px', borderRadius: 4, whiteSpace: 'nowrap', background: c ? c.bg : 'var(--surface)', color: c ? c.fg : 'var(--text-muted)', border: c ? `1px solid ${c.fg}` : '1px dashed var(--border-strong)' }
  }
  const pill = (s: LienTimelineStatus): CSSProperties => {
    const p = PILL[s]
    return { display: 'inline-block', fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap', background: p.bg, color: p.fg, border: p.border ? `1px solid ${p.border}` : 'none', textDecoration: p.strike ? 'line-through' : 'none' }
  }
  const marker = (r: LienTimelineRow, i: number): CSSProperties => {
    const base: CSSProperties = { position: 'relative', zIndex: 1, marginTop: 10, boxSizing: 'border-box', background: 'var(--surface)' }
    if (r.kind === 'law') return { ...base, width: 12, height: 12, borderRadius: 2, border: '2px solid var(--text-red-700)', background: 'var(--text-red-700)' }
    if (r.kind === 'payment') return { ...base, width: 12, height: 12, borderRadius: 2, border: '2px solid var(--text-green-700)', background: 'var(--text-green-700)' }
    if (r.to) return { ...base, width: 10, height: 26, borderRadius: 5, border: r.kind === 'letter' ? `2px solid ${tone}` : '2px dashed var(--border-strong)' }
    void i
    return { ...base, width: 12, height: 12, borderRadius: 999, border: `2px solid ${tone}` }
  }
  const last = rows.length - 1
  return (
    <div data-testid="lien-notice-timeline" style={{ display: 'grid', gap: 6 }}>
      {picker && picker.options.length > 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: '0.8125rem' }}>
          <strong>{picker.options.find((o) => o.jobId === picker.picked)?.title ?? picker.options[0]!.title}</strong>
          {picker.options.length > 1 ? (
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.78rem' }}>
              Show another
              <select value={picker.picked} onChange={(e) => picker.onPick(e.target.value)} data-testid="lien-notice-timeline-pick" style={{ font: 'inherit', fontSize: '0.78rem', padding: '2px 6px', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', maxWidth: '16rem' }}>
                {picker.options.map((o) => (
                  <option key={o.jobId} value={o.jobId}>{o.title}</option>
                ))}
              </select>
            </label>
          ) : null}
          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>one of the notices on this step, with its own dates</span>
        </div>
      ) : null}
      <div style={grid}>
        {rows.map((r, i) => {
          const dateWords = r.to ? `${formatYmdMonthDay(r.from)} → ${formatYmdMonthDay(r.to)}` : formatYmdMonthDay(r.from)
          const dayWords = r.to && r.dayTo != null ? `day ${r.dayFrom} to day ${r.dayTo}` : `day ${r.dayFrom}`
          const railStyle: CSSProperties = { position: 'absolute', left: '50%', width: 2, marginLeft: -1, top: i === 0 ? 14 : 0, bottom: i === last ? 'auto' : 0, height: i === last ? 14 : undefined, background: r.from <= (rows.find((x) => x.kind === 'today')?.from ?? r.from) ? tone : 'var(--border-strong)' }
          if (r.kind === 'today') {
            return (
              <div key={r.key} data-lien-timeline-row="today" style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: isMobile ? `${dateCol} 18px minmax(0, 1fr)` : `${dateCol} 22px minmax(0, 1fr) auto`, columnGap: isMobile ? 8 : 12, alignItems: 'center', background: 'var(--surface)', border: `2px solid ${tone}`, borderRadius: 10, padding: '10px 12px 10px 0', margin: '6px 0', position: 'relative' }}>
                <span style={{ ...dateCell, color: tone, fontSize: '0.95rem', lineHeight: 1.2 }}>{formatYmdMonthDay(r.from)}<small style={{ ...sub, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>today · day {r.dayFrom}</small></span>
                <span style={{ position: 'relative', alignSelf: 'stretch', display: 'grid', placeItems: 'center' }}>
                  <i aria-hidden style={{ position: 'absolute', top: -12, bottom: -12, left: '50%', width: 2, marginLeft: -1, background: tone }} />
                  <i aria-hidden style={{ position: 'relative', zIndex: 1, width: 16, height: 16, borderRadius: 3, background: tone, transform: 'rotate(45deg)', boxShadow: '0 0 0 4px var(--surface)' }} />
                </span>
                <span style={{ ...words, fontSize: '0.875rem' }}>
                  {r.title}
                  {action ? (
                    <span style={{ display: 'block', marginTop: 6 }} data-testid="lien-notice-timeline-action">
                      <strong>{action.press}</strong> <span style={{ color: 'var(--text-muted)' }}>· {action.who === 'leader' ? 'the leader presses it' : 'the office presses it'} · {action.means} · the press is on the row below</span>
                      {action.instead.length ? <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 3 }}>Or, if that is not right: {action.instead.map((m, k) => (<span key={m.press}>{k ? ' · ' : ''}<strong style={{ color: 'var(--text-700)' }}>{m.press}</strong></span>))}</span> : null}
                    </span>
                  ) : null}
                </span>
                {isMobile ? null : <span style={{ fontSize: '0.66rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: tone, writingMode: 'vertical-rl', transform: 'rotate(180deg)', justifySelf: 'center' }}>{action ? 'action needed' : 'you are here'}</span>}
              </div>
            )
          }
          return (
            <div key={r.key} data-lien-timeline-row={r.key} data-status={r.status} style={{ display: 'contents' }}>
              <span style={dateCell}>{dateWords}<small style={sub}>{dayWords}</small></span>
              <span style={{ position: 'relative', alignSelf: 'stretch', display: 'grid', justifyItems: 'center' }}>
                <i aria-hidden style={railStyle} />
                <i aria-hidden style={marker(r, i)} />
              </span>
              <span style={words}>
                <span style={{ color: r.status === 'late' || r.status === 'missed' ? 'var(--text-red-700)' : undefined, fontWeight: r.kind === 'payment' ? 600 : undefined }}>{r.title}</span>
                {r.detail ? <small style={{ ...sub, fontSize: '0.76rem', marginTop: 1 }}>{r.detail}</small> : null}
                {isMobile ? (
                  <small style={{ ...sub, marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {r.chip ? <span style={chipStyle(r.chip)}>{r.chip}</span> : null}
                    <span style={pill(r.status)}>{r.statusWords}</span>
                    <span>{r.next}</span>
                  </small>
                ) : null}
              </span>
              {isMobile ? null : <span style={{ padding: '8px 0' }}>{r.chip ? <span style={chipStyle(r.chip)}>{r.chip}</span> : null}</span>}
              {isMobile ? null : (
                <span style={{ padding: '7px 0', textAlign: 'right', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  <span style={pill(r.status)}>{r.statusWords}</span>
                  {r.next ? <small style={{ ...sub, marginTop: 3, lineHeight: 1.3 }}>{r.next}</small> : null}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
