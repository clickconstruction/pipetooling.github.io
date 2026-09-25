import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { lienDateWords, lienWindowSpan, type LienTimeline, type LienTimelineStep } from '../../lib/jobs/lienTimeline'
import { daysBetweenYmd } from '../../lib/jobs/billedExpectedPay'
import { setLienTimelineView, useLienTimelineView, type LienTimelineView } from '../../hooks/useLienTimelineView'

/**
 * The lien timeline drawn (v2.3761): the job's Chapter 53 steps on one rail,
 * today marked, one *Next on the path* line under it. `layout: 'row'` is the
 * rail; `'list'` is the same steps stacked, for a phone or a narrow pane,
 * where seven columns would be seven slivers; `'auto'` (the default) picks by
 * the strip's own width, not the viewport's — the desk's pane column is
 * narrow on a tablet too. `'mini'` is the row without its names, for a list
 * of jobs (PR 2). Reads the kernel's output only.
 *
 * Steps · Windows (v2.3815, punch list #42): the row and the list carry a switch in the
 * corner, remembered per browser. **Steps** is the strip above, plus a green first-day line
 * under each step that has one (`open since Aug 1`). **Windows** draws each paper as a bar
 * on a calendar, from its first day to its last, today marked and the days already gone
 * hatched. The mini row has no switch and never changes.
 */

export type LienTimelineLayout = 'auto' | 'row' | 'list' | 'mini'

/** Below this many pixels the row becomes the list (about 75 px per step at seven steps). */
export const LIEN_TIMELINE_LIST_BELOW_PX = 520

type Tone = { ring: string; fill: string; ink: string; mark: string }

function toneFor(s: LienTimelineStep): Tone {
  switch (s.state) {
    case 'done':
      return { ring: 'var(--text-green-800)', fill: 'var(--text-green-800)', ink: '#fff', mark: '✓' }
    case 'due':
      return (s.daysLeft ?? 99) <= 7
        ? { ring: 'var(--text-red-600)', fill: 'var(--bg-red-tint)', ink: 'var(--text-red-600)', mark: '!' }
        : { ring: 'var(--text-amber-800)', fill: 'var(--bg-amber-tint)', ink: 'var(--text-amber-800)', mark: '!' }
    case 'missed':
      return { ring: 'var(--text-red-600)', fill: 'var(--text-red-600)', ink: '#fff', mark: '✗' }
    case 'blocked':
      return { ring: 'var(--border-strong)', fill: 'var(--bg-subtle)', ink: 'var(--text-muted)', mark: '–' }
    case 'undated':
      return { ring: 'var(--border-strong)', fill: 'var(--surface)', ink: 'var(--text-muted)', mark: '' }
    default:
      return { ring: 'var(--border-strong)', fill: 'var(--surface)', ink: 'var(--text-muted)', mark: '' }
  }
}

function wordsColor(s: LienTimelineStep): string {
  if (s.state === 'missed') return 'var(--text-red-600)'
  if (s.state === 'due') return (s.daysLeft ?? 99) <= 7 ? 'var(--text-red-600)' : 'var(--text-amber-800)'
  if (s.state === 'done' && s.kind !== 'last_work') return 'var(--text-green-800)'
  return 'var(--text-muted)'
}

/** The mini row has no room for a year: `Nov 16, 2027` → `Nov ’27`; `served Jul 16` → `Jul 16`. */
function miniDateWords(words: string): string {
  const m = /^(?:filed |served |sent )?([A-Z][a-z]{2}) (\d{1,2})(?:, (\d{2})(\d{2}))?$/.exec(words)
  if (!m) return words
  return m[3] ? `${m[1]} ’${m[4]}` : `${m[1]} ${m[2]}`
}

function nextColor(tone: LienTimeline['next']['tone']): string {
  return tone === 'red' ? 'var(--text-red-600)' : tone === 'amber' ? 'var(--text-amber-800)' : tone === 'green' ? 'var(--text-green-800)' : 'var(--text-strong)'
}

function Node({ s, size }: { s: LienTimelineStep; size: number }) {
  const t = toneFor(s)
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: `2px ${s.state === 'undated' ? 'dashed' : 'solid'} ${t.ring}`,
        background: t.fill,
        color: t.ink,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size <= 12 ? 8 : 9,
        fontWeight: 800,
        lineHeight: 1,
        flex: 'none',
        position: 'relative',
        zIndex: 1,
      }}
    >
      {t.mark}
    </span>
  )
}

export type LienTimelineStripProps = {
  timeline: LienTimeline
  layout?: LienTimelineLayout
  /** A dashed step's door — `contract_end` opens Edit Job on the contract row; the desk passes it only once the job carries that field (v2.3753). */
  onDoor?: (door: NonNullable<LienTimelineStep['door']>) => void
  /** Whether to draw the Next line (the row and list do; a list of jobs prints it in its own column). */
  withNext?: boolean
  /** Force a view instead of the remembered one (tests, print); the switch hides when set. */
  view?: LienTimelineView
  style?: CSSProperties
}

export default function LienTimelineStrip({ timeline, layout: layoutProp = 'auto', onDoor, withNext = true, view: viewProp, style }: LienTimelineStripProps) {
  const { steps, next, todayIndex, kindUnknown } = timeline
  const rememberedView = useLienTimelineView()
  const n = Math.max(1, steps.length)
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    if (layoutProp !== 'auto') return
    const el = hostRef.current
    if (!el) return
    const read = () => setNarrow(el.getBoundingClientRect().width < LIEN_TIMELINE_LIST_BELOW_PX)
    read()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [layoutProp])
  const layout: Exclude<LienTimelineLayout, 'auto'> = layoutProp === 'auto' ? (narrow ? 'list' : 'row') : layoutProp
  const view: LienTimelineView = layout === 'mini' ? 'steps' : viewProp ?? rememberedView
  const switchRow = layout === 'mini' || viewProp ? null : <ViewSwitch view={view} />
  const nextLine = withNext ? (
    <div data-lien-timeline-next style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem 0.5rem', alignItems: 'baseline', fontSize: '0.8125rem', paddingTop: layout === 'list' ? '0.4rem' : '0.35rem', borderTop: layout === 'mini' ? 'none' : '1px solid var(--border)', marginTop: layout === 'mini' ? 0 : '0.3rem' }}>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Next on the path</span>
      <strong style={{ color: nextColor(next.tone) }}>{next.words}</strong>
      {next.aside ? <span style={{ color: 'var(--text-muted)' }}>{next.aside}</span> : null}
      {view === 'windows' && timeline.windowsAside ? <span data-lien-timeline-windows-aside style={{ color: 'var(--text-muted)' }}>{timeline.windowsAside}</span> : null}
      {kindUnknown ? <span style={{ color: 'var(--text-amber-800)' }}>Commercial dates shown — a residential property is a month earlier.</span> : null}
    </div>
  ) : null

  if (view === 'windows') {
    return (
      <div ref={hostRef} data-lien-timeline data-layout={layout} data-view="windows" style={{ display: 'grid', gap: 0, minWidth: 0, ...style }}>
        {switchRow}
        <WindowsChart timeline={timeline} onDoor={onDoor} />
        {nextLine}
      </div>
    )
  }

  if (layout === 'list') {
    return (
      <div ref={hostRef} data-lien-timeline data-layout="list" data-view="steps" style={{ display: 'grid', gap: 0, ...style }}>
        {switchRow}
        <div style={{ position: 'relative', display: 'grid', gap: 0 }}>
          <span aria-hidden style={{ position: 'absolute', left: 7, top: 8, bottom: 8, width: 2, background: 'var(--border-strong)' }} />
          {steps.map((s, i) => (
            <div key={s.key} data-lien-timeline-step={s.key} style={{ display: 'grid', gridTemplateColumns: '16px minmax(0, 1fr)', gap: '0 0.6rem', alignItems: 'start', padding: '0.28rem 0', borderTop: i === todayIndex && i > 0 ? '2px dashed var(--text-link)' : 'none', position: 'relative' }}>
              {i === todayIndex && i > 0 ? <span style={{ position: 'absolute', right: 0, top: -9, fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-link)', background: 'var(--surface)', padding: '0 4px' }}>today</span> : null}
              <Node s={s} size={16} />
              <div style={{ minWidth: 0, fontSize: '0.8125rem', lineHeight: 1.3 }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{s.label}</span>
                <span style={{ margin: '0 0.4rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: s.state === 'undated' || s.state === 'blocked' ? 'var(--text-muted)' : 'var(--text-strong)' }}>{s.dateWords}</span>
                {s.opensWords ? <span data-lien-timeline-opens style={{ color: 'var(--text-green-800)', fontWeight: 600, marginRight: '0.4rem' }}>{s.opensWords} ·</span> : null}
                <span style={{ color: wordsColor(s) }}>{s.words}</span>
                {s.door && onDoor ? (
                  <button type="button" onClick={() => onDoor(s.door!)} style={{ marginLeft: '0.4rem', border: 'none', background: 'none', color: 'var(--text-link)', font: 'inherit', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                    set the date ›
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
        {nextLine}
      </div>
    )
  }

  const mini = layout === 'mini'
  const nodeSize = mini ? 12 : 14
  const railTop = mini ? 5 : 6
  return (
    <div ref={hostRef} data-lien-timeline data-layout={layout} data-view="steps" style={{ display: 'grid', gap: 0, minWidth: 0, ...style }}>
      {switchRow}
      <div style={{ position: 'relative', padding: mini ? '0 4px' : '0 6px' }}>
        <span aria-hidden style={{ position: 'absolute', left: `calc(${100 / n / 2}% + 2px)`, right: `calc(${100 / n / 2}% + 2px)`, top: railTop, height: 2, background: 'var(--border-strong)' }} />
        {todayIndex > 0 && todayIndex < n ? (
          <span aria-hidden title="today" style={{ position: 'absolute', left: `${(todayIndex / n) * 100}%`, top: mini ? -3 : -4, height: mini ? 18 : 22, width: 0, borderLeft: '2px dashed var(--text-link)' }}>
            {mini ? null : <span style={{ position: 'absolute', top: -2, left: 5, fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-link)', whiteSpace: 'nowrap' }}>today</span>}
          </span>
        ) : null}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, position: 'relative' }}>
          {steps.map((s) => (
            <div key={s.key} data-lien-timeline-step={s.key} title={`${s.label}${s.dateWords ? ` · ${s.dateWords}` : ''}${s.words ? ` · ${s.words}` : ''}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0 2px', minWidth: 0, fontSize: mini ? '0.68rem' : '0.72rem', lineHeight: 1.25 }}>
              <Node s={s} size={nodeSize} />
              {mini ? null : <span style={{ marginTop: 3, fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{s.label}</span>}
              {!mini && s.opensWords ? <span data-lien-timeline-opens style={{ color: 'var(--text-green-800)', fontWeight: 600, maxWidth: '100%' }}>{s.opensWords}</span> : null}
              <span style={{ marginTop: mini ? 2 : 1, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: s.state === 'undated' || s.state === 'blocked' ? 'var(--text-muted)' : 'var(--text-strong)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{mini ? miniDateWords(s.dateWords) : s.dateWords}</span>
              {mini ? null : (
                <span style={{ color: wordsColor(s), maxWidth: '100%' }}>
                  {s.words}
                  {s.door && onDoor ? (
                    <>
                      {' '}
                      <button type="button" onClick={() => onDoor(s.door!)} style={{ border: 'none', background: 'none', color: 'var(--text-link)', font: 'inherit', fontSize: 'inherit', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                        set the date ›
                      </button>
                    </>
                  ) : null}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
      {nextLine}
    </div>
  )
}

/** The corner switch (v2.3815): Steps is today's strip, Windows the calendar of first and last days. */
function ViewSwitch({ view }: { view: LienTimelineView }) {
  const btn = (v: LienTimelineView, label: string, title: string) => (
    <button
      type="button"
      aria-pressed={view === v}
      data-lien-timeline-view={v}
      onClick={() => setLienTimelineView(v)}
      title={title}
      style={{ padding: '1px 9px', border: 'none', background: view === v ? 'var(--text-link)' : 'var(--surface)', color: view === v ? '#fff' : 'var(--text-700)', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', lineHeight: '18px' }}
    >
      {label}
    </button>
  )
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.3rem' }}>
      <div role="group" aria-label="Timeline view" style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 6, overflow: 'hidden' }}>
        {btn('steps', 'Steps', 'Each paper as a step, dated by its last day')}
        {btn('windows', 'Windows', 'Each paper as a window, from the first day it can go out to the last — remembered on this device')}
      </div>
    </div>
  )
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

type WindowRow =
  | { key: string; label: string; sub: string; kind: 'bar'; start: string; end: string; tone: 'amber' | 'green' | 'violet'; waits: boolean; hatchTo: string; title: string }
  | { key: string; label: string; sub: string; kind: 'text'; words: string; tone: 'muted' | 'red' | 'green'; door: LienTimelineStep['door'] }

function spanWords(from: string, to: string, todayYmd: string): string {
  return `${lienDateWords(from, todayYmd)} → ${lienDateWords(to, todayYmd)}`
}

/** The kernel's steps as calendar rows: which get a bar, which a line of words. */
function windowRows(steps: ReadonlyArray<LienTimelineStep>, todayYmd: string): { rows: WindowRow[]; closed: string[]; also: string[] } {
  const rows: WindowRow[] = []
  const closed: string[] = []
  const also: string[] = []
  for (const s of steps) {
    if (s.kind === 'notice' && s.monthKey && s.opensOn && s.date) {
      if (s.state === 'due') {
        const span = lienWindowSpan(s.opensOn, s.date, todayYmd)
        rows.push({ key: s.key, label: s.label, sub: span ? `${spanWords(s.opensOn, s.date, todayYmd)} · ${span.leftDays} of ${span.totalDays} days left` : '', kind: 'bar', start: s.opensOn, end: s.date, tone: 'amber', waits: false, hatchTo: todayYmd, title: [s.opensWords, `mail by ${s.dateWords}`, s.words].filter(Boolean).join(' · ') })
      } else if (s.state === 'done') {
        rows.push({ key: s.key, label: s.label, sub: s.words, kind: 'bar', start: s.opensOn, end: s.date, tone: 'green', waits: false, hatchTo: '', title: `${s.words} · the window ran ${spanWords(s.opensOn, s.date, todayYmd)}` })
      } else {
        closed.push(`${s.label.replace('§ 53.056 · ', '')} closed ${lienDateWords(s.date, todayYmd)} — it was open ${spanWords(s.opensOn, s.date, todayYmd)}`)
      }
      continue
    }
    if (s.kind === 'retainage' || s.kind === 'affidavit') {
      const name = s.kind === 'affidavit' ? '§ 53.052 lien' : s.label
      if (s.state === 'done' || s.state === 'missed' || s.state === 'blocked' || s.state === 'undated' || !s.date) {
        rows.push({ key: s.key, label: name, sub: s.dateWords === '—' ? '' : s.dateWords, kind: 'text', words: s.words, tone: s.state === 'done' ? 'green' : s.state === 'missed' || s.state === 'blocked' ? 'red' : 'muted', door: s.door })
      } else if (s.opensOn) {
        rows.push({ key: s.key, label: name, sub: spanWords(s.opensOn, s.date, todayYmd), kind: 'bar', start: s.opensOn, end: s.date, tone: s.kind === 'affidavit' ? 'violet' : 'amber', waits: false, hatchTo: s.kind === 'retainage' ? todayYmd : '', title: [s.opensWords, `last day ${s.dateWords}`, s.words].filter(Boolean).join(' · ') })
      } else {
        rows.push({ key: s.key, label: name, sub: `${s.opensWords || 'opens later'} · by ${s.dateWords}`, kind: 'bar', start: todayYmd, end: s.date, tone: 'violet', waits: true, hatchTo: '', title: [s.opensWords, `last day ${s.dateWords}`, s.words].filter(Boolean).join(' · ') })
      }
      continue
    }
    if (s.kind === 'notice') continue
    if (s.kind === 'last_work') continue
    also.push([s.label, s.dateWords, s.words].filter((x) => x && x !== '—').join(' · '))
  }
  return { rows, closed, also }
}

function monthStart(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`
}

function monthEnd(ymd: string): string {
  const y = Number(ymd.slice(0, 4))
  const m = Number(ymd.slice(5, 7))
  return new Date(Date.UTC(y, m, 0, 12)).toISOString().slice(0, 10)
}

/** Windows (v2.3815): each paper's first day to its last on one calendar, today marked. */
function WindowsChart({ timeline, onDoor }: { timeline: LienTimeline; onDoor?: LienTimelineStripProps['onDoor'] }) {
  const { todayYmd } = timeline
  const { rows, closed, also } = windowRows(timeline.steps, todayYmd)
  const bars = rows.filter((r): r is Extract<WindowRow, { kind: 'bar' }> => r.kind === 'bar')
  const first = monthStart([todayYmd, ...bars.map((b) => b.start)].sort()[0] ?? todayYmd)
  const last = monthEnd([todayYmd, ...bars.map((b) => b.end)].sort().slice(-1)[0] ?? todayYmd)
  const total = Math.max(1, daysBetweenYmd(first, last) ?? 1)
  const pct = (ymd: string) => Math.max(0, Math.min(100, ((daysBetweenYmd(first, ymd) ?? 0) / total) * 100))
  const ticks: string[] = []
  for (let y = Number(first.slice(0, 4)), m = Number(first.slice(5, 7)); `${y}-${String(m).padStart(2, '0')}-01` <= last; m === 12 ? ((m = 1), (y += 1)) : (m += 1)) ticks.push(`${y}-${String(m).padStart(2, '0')}-01`)
  const nameCol = 'minmax(96px, 30%)'
  const todayAt = pct(todayYmd)
  const tone = {
    amber: { bg: 'var(--bg-amber-tint)', line: 'var(--text-amber-800)' },
    green: { bg: 'var(--bg-green-tint)', line: 'var(--text-green-800)' },
    violet: { bg: 'var(--bg-violet-100)', line: 'var(--text-violet-700)' },
  } as const
  return (
    <div data-lien-timeline-windows style={{ display: 'grid', gap: 0, fontSize: '0.75rem', minWidth: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: `${nameCol} minmax(0, 1fr)` }}>
        <span />
        <div style={{ position: 'relative', height: 26, borderBottom: '1px solid var(--border-strong)', color: 'var(--text-muted)', fontSize: '0.68rem' }}>
          {ticks.map((t) => (
            <span key={t} style={{ position: 'absolute', left: `${pct(t)}%`, bottom: 2, paddingLeft: 3, borderLeft: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{MONTH_SHORT[Number(t.slice(5, 7)) - 1]}</span>
          ))}
          <span style={{ position: 'absolute', left: `${todayAt}%`, top: 0, paddingLeft: 4, fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-link)', whiteSpace: 'nowrap', transform: todayAt > 75 ? 'translateX(-100%)' : undefined }}>today</span>
        </div>
      </div>
      {rows.map((r) => (
        <div key={r.key} data-lien-timeline-window={r.key} style={{ display: 'grid', gridTemplateColumns: `${nameCol} minmax(0, 1fr)`, alignItems: 'center', minHeight: 34, borderBottom: '1px dashed var(--border)' }}>
          <div style={{ minWidth: 0, paddingRight: 6, lineHeight: 1.25 }}>
            <div style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{r.label}</div>
            {r.sub ? <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>{r.sub}</div> : null}
          </div>
          <div style={{ position: 'relative', minHeight: 34, height: r.kind === 'bar' ? 34 : undefined }}>
            <span aria-hidden style={{ position: 'absolute', left: `${todayAt}%`, top: 0, bottom: 0, borderLeft: '2px solid var(--text-link)', zIndex: 2 }} />
            {r.kind === 'bar' ? (
              <span
                title={r.title}
                style={{
                  position: 'absolute',
                  top: 10,
                  height: 14,
                  left: `${pct(r.start)}%`,
                  width: `${Math.max(1.5, pct(r.end) - pct(r.start))}%`,
                  borderRadius: 4,
                  border: `1px ${r.waits ? 'dashed' : 'solid'} ${tone[r.tone].line}`,
                  background: r.waits ? 'transparent' : tone[r.tone].bg,
                  overflow: 'hidden',
                  opacity: r.tone === 'green' ? 0.75 : 1,
                }}
              >
                {r.hatchTo && r.hatchTo > r.start ? (
                  <span aria-hidden style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, ((pct(r.hatchTo) - pct(r.start)) / Math.max(0.1, pct(r.end) - pct(r.start))) * 100)}%`, background: `repeating-linear-gradient(135deg, color-mix(in srgb, ${tone[r.tone].line} 40%, transparent) 0 3px, color-mix(in srgb, ${tone[r.tone].line} 12%, transparent) 3px 6px)` }} />
                ) : null}
              </span>
            ) : (
              <div style={{ position: 'relative', padding: '0.45rem 0 0.45rem 8px', lineHeight: 1.3, color: r.tone === 'red' ? 'var(--text-red-600)' : r.tone === 'green' ? 'var(--text-green-800)' : 'var(--text-muted)' }}>
                {r.words}
                {r.door && onDoor ? (
                  <>
                    {' '}
                    <button type="button" onClick={() => onDoor(r.door!)} style={{ border: 'none', background: 'none', color: 'var(--text-link)', font: 'inherit', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                      set the date ›
                    </button>
                  </>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ))}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem 0.9rem', color: 'var(--text-muted)', fontSize: '0.68rem', paddingTop: '0.35rem' }}>
        <span>▭ the window: first day → last day</span>
        <span>▨ days already gone</span>
        <span>┆ opens when the notice is mailed</span>
      </div>
      {closed.length ? <div data-lien-timeline-windows-closed style={{ color: 'var(--text-red-600)', fontSize: '0.72rem', paddingTop: '0.2rem' }}>{closed.join(' · ')}</div> : null}
      {also.length ? <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', paddingTop: '0.2rem' }}>{also.join(' · ')}</div> : null}
    </div>
  )
}
