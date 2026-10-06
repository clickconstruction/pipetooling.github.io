import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { LIEN_KIND_UNKNOWN_WORDS, keepDatesWhole, lienDateWords, lienFirmNext, lienFirmWaitingOn, lienMoveWords, lienWindowSpan, type LienTimeline, type LienTimelineMove, type LienTimelineStep, type LienTimelineStepKind } from '../../lib/jobs/lienTimeline'
import { daysBetweenYmd } from '../../lib/jobs/billedExpectedPay'
import { windowsAxis } from '../../lib/jobs/lienWindowsAxis'
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
 *
 * Whose move (v2.3877, punch list #32): a small word under each live node — ours · the GC ·
 * the owner · county · counsel — and a *Waiting on* line under Next on the path. The demand
 * letter is a square node, because it is our paper and not a Chapter 53 step. The mini row
 * carries neither word nor line.
 *
 * One story (v2.4652): the row, the list and the calendar lead with a **verdict band** — Next
 * on the path, its aside and Waiting on, tinted by tone — because that sentence decides how
 * the rest is read. The calendar draws **every** window, the closed ones too (a grey bar struck
 * at its last day), a blocked lien as a dotted ghost of the window it never got, no date on a
 * step that cannot happen, the today line only across bar rows, an axis of at least three
 * months, a legend of only the marks drawn, and the papers that follow a filing as one quiet
 * sentence. The Job History box fixes the calendar and hides the switch.
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

/** The verdict band's tint per tone (v2.4652) — the Next line's own colours, as a wash. */
function verdictBg(tone: LienTimeline['next']['tone']): string {
  return tone === 'red' ? 'var(--bg-red-tint)' : tone === 'amber' ? 'var(--bg-amber-tint)' : tone === 'green' ? 'var(--bg-green-tint)' : 'var(--bg-subtle)'
}

const LABEL: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }

function Node({ s, size }: { s: LienTimelineStep; size: number }) {
  const t = toneFor(s)
  if (s.fold) {
    // Several closed months as one node (v2.4111): three overlapping discs say "folded" before any word does; the badge says how many.
    const disc = (left: number, opacity: number): CSSProperties => ({ position: 'absolute', left, top: 0, width: size, height: size, borderRadius: '50%', background: t.ring, opacity })
    return (
      <span aria-hidden data-lien-timeline-fold style={{ position: 'relative', display: 'inline-block', width: size + 10, height: size, flex: 'none', zIndex: 1 }}>
        <span style={disc(0, 0.3)} />
        <span style={disc(5, 0.55)} />
        <span
          style={{
            position: 'absolute',
            left: 10,
            top: 0,
            width: size,
            height: size,
            borderRadius: '50%',
            border: `2px solid ${t.ring}`,
            background: t.fill,
            color: t.ink,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: size <= 12 ? 8 : 9,
            fontWeight: 800,
            lineHeight: 1,
            boxSizing: 'border-box',
          }}
        >
          {t.mark}
        </span>
        <span
          data-lien-timeline-fold-count
          style={{ position: 'absolute', top: -7, right: -9, minWidth: 14, height: 14, borderRadius: 999, background: 'var(--text-strong)', color: 'var(--surface)', fontSize: 9, fontWeight: 800, lineHeight: '14px', textAlign: 'center', padding: '0 3px' }}
        >
          {s.fold.count}
        </span>
      </span>
    )
  }
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: s.kind === 'demand' ? 3 : '50%',
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

/** A folded node's words (v2.4111): `3 noted · 1 to note` — the part still owed reads amber, the rest in the step's colour. */
function FoldWords({ s }: { s: LienTimelineStep }) {
  const parts = s.words.split(' · ')
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 ? ' · ' : ''}
          <span style={/to note/.test(part) ? { color: 'var(--text-amber-800)', fontWeight: 700 } : undefined}>{part}</span>
        </span>
      ))}
    </>
  )
}

/** The hover on a folded node: the node's line, then one line per month (v2.4111). */
function foldTitle(s: LienTimelineStep, todayYmd: string): string {
  const head = `${s.label} · ${s.dateWords} · ${s.words}`
  if (!s.fold) return head
  return [head, ...s.fold.steps.map((f) => `${f.label} · closed ${lienDateWords(f.date, todayYmd)} · ${f.words}`)].join('\n')
}

/** The months a folded node holds, fanned open under the strip (v2.4111). */
function FoldTray({ s, todayYmd }: { s: LienTimelineStep; todayYmd: string }) {
  if (!s.fold) return null
  return (
    <div data-lien-timeline-fold-tray style={{ margin: '0.35rem 0 0.2rem', padding: '0.5rem 0.7rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-subtle)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.4rem 0.9rem', fontSize: '0.75rem', lineHeight: 1.35 }}>
      {s.fold.steps.map((f) => (
        <div key={f.key} data-lien-timeline-step={f.key}>
          <div style={{ fontWeight: 700, color: 'var(--text-red-600)' }}>{f.label}</div>
          <div style={{ color: 'var(--text-muted)' }}>closed {lienDateWords(f.date, todayYmd)}</div>
          <div style={{ color: / not noted/.test(f.words) ? 'var(--text-amber-800)' : 'var(--text-700)', fontWeight: / not noted/.test(f.words) ? 700 : 400 }}>{f.words.replace(/^window closed · ?/, '') || 'window closed'}</div>
        </div>
      ))}
    </div>
  )
}

/** The pill's word and tint per move: ours reads in the link blue, the GC in violet, the owner in amber, the county and counsel in quiet grey. */
function moveLook(move: LienTimelineMove, voice: LienTimelineVoice = 'office'): { word: string; color: string; background: string; border: string } {
  switch (move) {
    case 'ours':
      return { word: voice === 'firm' ? 'the office' : 'ours', color: 'var(--text-link)', background: 'var(--bg-blue-tint)', border: 'transparent' }
    case 'gc':
      return { word: 'the GC', color: 'var(--text-violet-700)', background: 'var(--bg-subtle)', border: 'var(--border)' }
    case 'owner':
      return { word: 'the owner', color: 'var(--text-amber-800)', background: 'var(--bg-amber-tint)', border: 'transparent' }
    case 'county':
      return { word: 'county', color: 'var(--text-700)', background: 'var(--bg-subtle)', border: 'var(--border)' }
    default:
      return { word: voice === 'firm' ? 'you' : 'counsel', color: 'var(--text-700)', background: 'var(--bg-subtle)', border: 'var(--border)' }
  }
}

function MovePill({ move, voice, style }: { move: LienTimelineMove; voice?: LienTimelineVoice; style?: CSSProperties }) {
  const l = moveLook(move, voice)
  return (
    <span data-lien-timeline-move={move} style={{ display: 'inline-block', fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0 5px', borderRadius: 999, lineHeight: '14px', whiteSpace: 'nowrap', color: l.color, background: l.background, border: `1px solid ${l.border}`, ...style }}>
      {l.word}
    </span>
  )
}

/** Whose words the strip speaks (punch list #85, item 3): the office's own, or the law firm's on its portal (`lienFirmNext`). */
export type LienTimelineVoice = 'office' | 'firm'

export type LienTimelineStripProps = {
  timeline: LienTimeline
  /** `firm` on the law firm's page: *the office* for *us*, *you* for counsel, no office screen named. */
  voice?: LienTimelineVoice
  layout?: LienTimelineLayout
  /** A dashed step's door — `contract_end` opens Edit Job on the contract row; the desk passes it only once the job carries that field (v2.3753). */
  onDoor?: (door: NonNullable<LienTimelineStep['door']>) => void
  /** Whether to draw the Next line (the row and list do; a list of jobs prints it in its own column). */
  withNext?: boolean
  /** Force a view instead of the remembered one (tests, print); the switch hides when set. */
  view?: LienTimelineView
  style?: CSSProperties
}

export default function LienTimelineStrip({ timeline, voice = 'office', layout: layoutProp = 'auto', onDoor, withNext = true, view: viewProp, style }: LienTimelineStripProps) {
  const { steps, todayIndex, kindUnknown } = timeline
  const next = voice === 'firm' ? { ...timeline.next, ...lienFirmNext(timeline.next) } : timeline.next
  const waiting = voice === 'firm' ? lienFirmWaitingOn(timeline) : timeline.waitingOn ? { who: lienMoveWords(timeline.waitingOn.who), words: timeline.waitingOn.words } : null
  const rememberedView = useLienTimelineView()
  const n = Math.max(1, steps.length)
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [narrow, setNarrow] = useState(false)
  // Which folded node is fanned open (v2.4111); the mini row never fans.
  const [openFold, setOpenFold] = useState<string | null>(null)
  const openFoldStep = steps.find((s) => s.key === openFold && s.fold) ?? null
  const foldDoor = (s: LienTimelineStep) =>
    s.fold ? (
      <button
        type="button"
        data-lien-timeline-fold-door
        aria-expanded={openFold === s.key}
        onClick={() => setOpenFold((cur) => (cur === s.key ? null : s.key))}
        style={{ border: 'none', background: 'none', color: 'var(--text-link)', font: 'inherit', fontSize: 'inherit', fontWeight: 600, cursor: 'pointer', padding: 0 }}
      >
        {openFold === s.key ? 'hide the months' : 'show the months ›'}
      </button>
    ) : null
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
  // The verdict band (v2.4652): Next on the path, its aside and Waiting on, ABOVE the drawing on the
  // row, the list and the calendar. The mini row keeps the one quiet line under its rail.
  const mini = layout === 'mini'
  const waitLine = withNext && !mini && waiting ? (
    <div data-lien-timeline-waiting style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem 0.5rem', alignItems: 'baseline', fontSize: '0.8125rem' }}>
      <span style={LABEL}>Waiting on</span>
      <strong style={{ color: 'var(--text-strong)' }}>{waiting.who}</strong>
      <span style={{ color: 'var(--text-muted)' }}>— {waiting.words}</span>
    </div>
  ) : null
  const nextWords = (
    <div data-lien-timeline-next style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem 0.5rem', alignItems: 'baseline', fontSize: '0.8125rem', paddingTop: mini ? '0.35rem' : 0 }}>
      <span style={LABEL}>Next on the path</span>
      <strong style={{ color: nextColor(next.tone), fontSize: mini ? undefined : '0.875rem' }}>{next.words}</strong>
      {next.aside ? <span style={{ color: 'var(--text-muted)' }}>{next.aside}</span> : null}
      {view === 'windows' && timeline.windowsAside ? <span data-lien-timeline-windows-aside style={{ color: 'var(--text-muted)' }}>{timeline.windowsAside}</span> : null}
      {kindUnknown ? <span style={{ color: 'var(--text-amber-800)' }}>{LIEN_KIND_UNKNOWN_WORDS}</span> : null}
    </div>
  )
  const nextLine = !withNext ? null : mini ? nextWords : (
    <div data-lien-timeline-verdict data-tone={next.tone} style={{ display: 'grid', gap: '0.25rem', padding: '0.5rem 0.7rem', marginBottom: '0.55rem', border: '1px solid var(--border)', borderRadius: 8, background: verdictBg(next.tone) }}>
      {nextWords}
      {waitLine}
    </div>
  )

  if (view === 'windows') {
    return (
      <div ref={hostRef} data-lien-timeline data-layout={layout} data-view="windows" style={{ display: 'grid', gap: 0, minWidth: 0, ...style }}>
        {switchRow}
        {nextLine}
        <WindowsChart timeline={timeline} onDoor={onDoor} voice={voice} />
      </div>
    )
  }

  if (layout === 'list') {
    return (
      <div ref={hostRef} data-lien-timeline data-layout="list" data-view="steps" style={{ display: 'grid', gap: 0, ...style }}>
        {switchRow}
        {nextLine}
        <div style={{ position: 'relative', display: 'grid', gap: 0 }}>
          <span aria-hidden style={{ position: 'absolute', left: 7, top: 8, bottom: 8, width: 2, background: 'var(--border-strong)' }} />
          {steps.map((s, i) => (
            <div key={s.key} data-lien-timeline-step={s.key} style={{ display: 'grid', gridTemplateColumns: '16px minmax(0, 1fr)', gap: '0 0.6rem', alignItems: 'start', padding: '0.28rem 0', borderTop: i === todayIndex && i > 0 ? '2px dashed var(--text-link)' : 'none', position: 'relative' }}>
              {i === todayIndex && i > 0 ? <span style={{ position: 'absolute', right: 0, top: -9, fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-link)', background: 'var(--surface)', padding: '0 4px' }}>today</span> : null}
              <Node s={s} size={16} />
              <div style={{ minWidth: 0, fontSize: '0.8125rem', lineHeight: 1.3 }}>
                {s.move ? <MovePill move={s.move} voice={voice} style={{ marginRight: '0.4rem', verticalAlign: 1 }} /> : null}
                <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{s.label}</span>
                <span style={{ margin: '0 0.4rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: s.state === 'undated' || s.state === 'blocked' ? 'var(--text-muted)' : 'var(--text-strong)' }}>{s.dateWords}</span>
                {s.opensWords ? <span data-lien-timeline-opens style={{ color: 'var(--text-green-800)', fontWeight: 600, marginRight: '0.4rem' }}>{keepDatesWhole(s.opensWords)} ·</span> : null}
                <span style={{ color: wordsColor(s) }}>{s.fold ? <FoldWords s={s} /> : keepDatesWhole(s.words)}</span>
                {s.fold ? <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem' }}>{foldDoor(s)}</span> : null}
                {s.door && onDoor ? (
                  <button type="button" onClick={() => onDoor(s.door!)} style={{ marginLeft: '0.4rem', border: 'none', background: 'none', color: 'var(--text-link)', font: 'inherit', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                    set the date ›
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
        {openFoldStep ? <FoldTray s={openFoldStep} todayYmd={timeline.todayYmd} /> : null}
      </div>
    )
  }

  const nodeSize = mini ? 12 : 14
  const railTop = mini ? 5 : 6
  return (
    <div ref={hostRef} data-lien-timeline data-layout={layout} data-view="steps" style={{ display: 'grid', gap: 0, minWidth: 0, ...style }}>
      {switchRow}
      {mini ? null : nextLine}
      <div style={{ position: 'relative', padding: mini ? '0 4px' : '0 6px' }}>
        <span aria-hidden style={{ position: 'absolute', left: `calc(${100 / n / 2}% + 2px)`, right: `calc(${100 / n / 2}% + 2px)`, top: railTop, height: 2, background: 'var(--border-strong)' }} />
        {todayIndex > 0 && todayIndex < n ? (
          <span aria-hidden title="today" style={{ position: 'absolute', left: `${(todayIndex / n) * 100}%`, top: mini ? -3 : -4, height: mini ? 18 : 22, width: 0, borderLeft: '2px dashed var(--text-link)' }}>
            {mini ? null : <span style={{ position: 'absolute', top: -2, left: 5, fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-link)', whiteSpace: 'nowrap' }}>today</span>}
          </span>
        ) : null}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, position: 'relative' }}>
          {steps.map((s) => (
            <div key={s.key} data-lien-timeline-step={s.key} title={s.fold ? foldTitle(s, timeline.todayYmd) : `${s.label}${s.dateWords ? ` · ${s.dateWords}` : ''}${s.words ? ` · ${s.words}` : ''}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0 2px', minWidth: 0, fontSize: mini ? '0.68rem' : '0.72rem', lineHeight: 1.25, height: '100%' }}>
              <Node s={s} size={nodeSize} />
              {mini ? null : <span style={{ marginTop: 3, fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{s.label}</span>}
              {!mini && s.opensWords ? <span data-lien-timeline-opens style={{ color: 'var(--text-green-800)', fontWeight: 600, maxWidth: '100%' }}>{keepDatesWhole(s.opensWords)}</span> : null}
              <span style={{ marginTop: mini ? 2 : 1, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: s.state === 'undated' || s.state === 'blocked' ? 'var(--text-muted)' : 'var(--text-strong)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{mini ? miniDateWords(s.dateWords) : s.dateWords}</span>
              {mini ? null : (
                <span style={{ color: wordsColor(s), maxWidth: '100%' }}>
                  {s.fold ? <FoldWords s={s} /> : keepDatesWhole(s.words)}
                  {s.fold ? (
                    <>
                      <br />
                      {foldDoor(s)}
                    </>
                  ) : null}
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
              {!mini && s.move ? <MovePill move={s.move} voice={voice} style={{ marginTop: 'auto', position: 'relative', top: 4 }} /> : null}
            </div>
          ))}
        </div>
        {!mini && openFoldStep ? <FoldTray s={openFoldStep} todayYmd={timeline.todayYmd} /> : null}
      </div>
      {mini ? nextLine : null}
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
        {btn('windows', 'Windows', 'Each paper as a window on one calendar, from the first day it can go out to the last, the closed ones too — remembered on this device')}
      </div>
    </div>
  )
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

type BarTone = 'amber' | 'green' | 'violet' | 'closed' | 'ghost'

type WindowRow =
  | {
      key: string
      label: string
      sub: string
      kind: 'bar'
      start: string
      end: string
      tone: BarTone
      /** Dashed: a window that opens on another paper (the lien on the notice's mailing). */
      waits: boolean
      /** Hatch the days from `start` to here — the days already spent of an open window. */
      hatchTo: string
      /** The words under the bar, from its first day. */
      caption: string
      captionTone: 'red' | 'amber' | 'green' | 'violet' | 'muted'
      /** A small chip after the caption — `not noted`. */
      chip: string
      title: string
      /** The row's name reads muted — a step that cannot happen. */
      dim: boolean
    }
  | { key: string; label: string; sub: string; kind: 'text'; words: string; tone: 'muted' | 'red' | 'green'; door: LienTimelineStep['door']; undated: boolean }

function spanWords(from: string, to: string, todayYmd: string): string {
  return `${lienDateWords(from, todayYmd)} → ${lienDateWords(to, todayYmd)}`
}

/** A closed month's own words after `window closed` — `noted`, `not noted`, `dated from creation`; '' when none. */
function closedRest(words: string): string {
  return words.replace(/^window closed(?: · )?/, '')
}

/** A closed § 53.056 month as a bar struck at its last day (v2.4652) — the fact, not a footnote. */
function closedNoticeRow(s: LienTimelineStep, todayYmd: string): WindowRow | null {
  if (!s.opensOn || !s.date) return null
  const rest = closedRest(s.words)
  const notNoted = / ?not noted/.test(rest)
  const more = rest.split(' · ').filter((p) => p && !/not noted/.test(p))
  return {
    key: s.key,
    label: s.label,
    sub: 'closed',
    kind: 'bar',
    start: s.opensOn,
    end: s.date,
    tone: 'closed',
    waits: false,
    hatchTo: '',
    caption: [`open ${spanWords(s.opensOn, s.date, todayYmd)} · closed, nothing sent`, ...more].join(' · '),
    captionTone: notNoted ? 'red' : 'muted',
    chip: notNoted ? 'not noted' : '',
    title: `${s.label} · closed ${lienDateWords(s.date, todayYmd)} · ${s.words}`,
    dim: true,
  }
}

const AFTER_FILING = new Set<LienTimelineStepKind>(['serve', 'hold', 'suit', 'release'])

/** The kernel's steps as calendar rows (v2.4652): every window a bar, the closed ones too; a step with no window a line of words; the papers that follow a filing one quiet sentence. */
function windowRows(timeline: LienTimeline): { rows: WindowRow[]; after: string } {
  const { todayYmd, lienGone } = timeline
  const rows: WindowRow[] = []
  const also: string[] = []
  // The last day of the latest closed notice — where a blocked lien's ghost window would have begun.
  let lastClosed = ''
  const undatedText = (s: LienTimelineStep, label: string): WindowRow => ({ key: s.key, label, sub: '', kind: 'text', words: s.words, tone: 'muted', door: s.door, undated: true })
  for (const s of timeline.steps) {
    if (s.fold) {
      // Up to three closed months get a bar each; more fold into one bar across the run, with the fold's own count.
      if (s.fold.count <= 3) {
        for (const f of s.fold.steps) {
          const r = closedNoticeRow(f, todayYmd)
          if (r) rows.push(r)
          if (f.date > lastClosed) lastClosed = f.date
        }
      } else {
        const first = s.fold.steps[0]
        const last = s.fold.steps[s.fold.steps.length - 1]
        if (first && last && first.opensOn && last.date) {
          rows.push({ key: s.key, label: s.label, sub: 'closed', kind: 'bar', start: first.opensOn, end: last.date, tone: 'closed', waits: false, hatchTo: '', caption: [`open ${spanWords(first.opensOn, last.date, todayYmd)}`, s.dateWords, ...s.words.split(' · ').filter((p) => p && !/to note/.test(p))].join(' · '), captionTone: s.fold.unnoted ? 'red' : 'muted', chip: s.fold.unnoted ? `${s.fold.unnoted} to note` : '', title: foldTitle(s, todayYmd), dim: true })
        }
        if (last && last.date > lastClosed) lastClosed = last.date
      }
      continue
    }
    if (s.kind === 'notice' && s.monthKey && s.opensOn && s.date) {
      if (s.state === 'due') {
        const span = lienWindowSpan(s.opensOn, s.date, todayYmd)
        rows.push({ key: s.key, label: s.label, sub: '', kind: 'bar', start: s.opensOn, end: s.date, tone: 'amber', waits: false, hatchTo: todayYmd, caption: [`open ${spanWords(s.opensOn, s.date, todayYmd)}`, span ? `${span.leftDays} of ${span.totalDays} days left` : '', s.words].filter(Boolean).join(' · '), captionTone: 'amber', chip: '', title: [s.opensWords, `mail by ${s.dateWords}`, s.words].filter(Boolean).join(' · '), dim: false })
      } else if (s.state === 'done') {
        rows.push({ key: s.key, label: s.label, sub: '', kind: 'bar', start: s.opensOn, end: s.date, tone: 'green', waits: false, hatchTo: '', caption: s.words, captionTone: 'green', chip: '', title: `${s.words} · the window ran ${spanWords(s.opensOn, s.date, todayYmd)}`, dim: false })
      } else {
        const r = closedNoticeRow(s, todayYmd)
        if (r) rows.push(r)
        if (s.date > lastClosed) lastClosed = s.date
      }
      continue
    }
    if (s.kind === 'retainage' || s.kind === 'affidavit') {
      const name = s.kind === 'affidavit' ? '§ 53.052 lien' : s.label
      if (s.state === 'done') {
        rows.push({ key: s.key, label: name, sub: s.dateWords === '—' ? '' : s.dateWords, kind: 'text', words: s.words, tone: 'green', door: null, undated: false })
      } else if (s.state === 'undated' || !s.date) {
        rows.push(undatedText(s, name))
      } else if (s.state === 'blocked') {
        // The lien that cannot follow: a dotted ghost of the window it never got, no date printed.
        const from = lastClosed || todayYmd
        const start = from < s.date ? from : s.date
        rows.push({ key: s.key, label: name, sub: s.kind === 'affidavit' ? '↳ needs the notice above' : '', kind: 'bar', start, end: s.date, tone: 'ghost', waits: false, hatchTo: '', caption: start < s.date ? `blocked — it would have run ${spanWords(start, s.date, todayYmd)}, once the notice was mailed` : 'blocked — no notice went out', captionTone: 'muted', chip: '', title: s.words, dim: true })
      } else if (s.state === 'missed') {
        const start = s.opensOn || lastClosed
        if (start && start < s.date) {
          rows.push({ key: s.key, label: name, sub: 'closed', kind: 'bar', start, end: s.date, tone: 'closed', waits: false, hatchTo: '', caption: `open ${spanWords(start, s.date, todayYmd)} · ${s.words}`, captionTone: 'red', chip: '', title: `${name} · ${s.dateWords} · ${s.words}`, dim: true })
        } else {
          rows.push({ key: s.key, label: name, sub: s.dateWords, kind: 'text', words: s.words, tone: 'red', door: null, undated: false })
        }
      } else if (s.opensOn) {
        rows.push({ key: s.key, label: name, sub: '', kind: 'bar', start: s.opensOn, end: s.date, tone: s.kind === 'affidavit' ? 'violet' : 'amber', waits: false, hatchTo: s.kind === 'retainage' ? todayYmd : '', caption: [`open ${spanWords(s.opensOn, s.date, todayYmd)}`, s.kind === 'affidavit' ? `file by ${s.dateWords}` : `send by ${s.dateWords}`, s.words].filter(Boolean).join(' · '), captionTone: s.kind === 'affidavit' ? 'violet' : 'amber', chip: '', title: [s.opensWords, `last day ${s.dateWords}`, s.words].filter(Boolean).join(' · '), dim: false })
      } else {
        rows.push({ key: s.key, label: name, sub: s.kind === 'affidavit' ? '↳ after the notice above' : '', kind: 'bar', start: todayYmd, end: s.date, tone: 'violet', waits: true, hatchTo: '', caption: `${s.opensWords || 'opens later'} · by ${s.dateWords}`, captionTone: 'violet', chip: '', title: [s.opensWords, `last day ${s.dateWords}`, s.words].filter(Boolean).join(' · '), dim: false })
      }
      continue
    }
    if (s.kind === 'demand') {
      rows.push({ key: s.key, label: s.label, sub: s.dateWords, kind: 'text', words: s.words, tone: s.state === 'done' ? 'green' : s.state === 'missed' ? 'red' : 'muted', door: null, undated: false })
      continue
    }
    if (s.kind === 'notice' || s.kind === 'last_work') continue
    if (AFTER_FILING.has(s.kind)) {
      if (s.state === 'due' || s.state === 'missed' || s.state === 'done') {
        rows.push({ key: s.key, label: s.label, sub: s.dateWords === '—' ? '' : s.dateWords, kind: 'text', words: s.words, tone: s.state === 'done' ? 'green' : s.state === 'missed' ? 'red' : 'muted', door: s.door, undated: false })
      } else {
        const date = s.date && s.dateWords !== '—' ? s.dateWords : ''
        const words = s.words === 'after filing' ? '' : s.words
        also.push([s.label, date, words].filter(Boolean).join(' · '))
      }
    }
  }
  const after = lienGone
    ? '§ 53.055 serve · § 53.158 suit follow a filing. None can follow on this job.'
    : also.length
      ? `After a filing: ${also.join(' · ')}.`
      : ''
  return { rows, after }
}

const BAR_TONE: Record<BarTone, { bg: string; line: string }> = {
  amber: { bg: 'var(--bg-amber-tint)', line: 'var(--text-amber-800)' },
  green: { bg: 'var(--bg-green-tint)', line: 'var(--text-green-800)' },
  violet: { bg: 'var(--bg-violet-100)', line: 'var(--text-violet-700)' },
  closed: { bg: 'var(--bg-subtle)', line: 'var(--text-red-600)' },
  ghost: { bg: 'transparent', line: 'var(--border-strong)' },
}

function captionColor(tone: Extract<WindowRow, { kind: 'bar' }>['captionTone']): string {
  return tone === 'red' ? 'var(--text-red-600)' : tone === 'amber' ? 'var(--text-amber-800)' : tone === 'green' ? 'var(--text-green-800)' : tone === 'violet' ? 'var(--text-violet-700)' : 'var(--text-muted)'
}

/** The calendar (v2.3815, redrawn v2.4652): each paper's first day to its last on one axis, today marked, the closed windows drawn too. */
function WindowsChart({ timeline, onDoor, voice }: { timeline: LienTimeline; onDoor?: LienTimelineStripProps['onDoor']; voice?: LienTimelineVoice }) {
  const { todayYmd } = timeline
  const { rows, after } = windowRows(timeline)
  // Whose move, by row key — the folded months' own steps included (their moves are null).
  const moveOf = (key: string): LienTimelineMove | null => {
    for (const s of timeline.steps) {
      if (s.key === key) return s.move ?? null
      if (s.fold) for (const f of s.fold.steps) if (f.key === key) return f.move ?? null
    }
    return null
  }
  const bars = rows.filter((r): r is Extract<WindowRow, { kind: 'bar' }> => r.kind === 'bar')
  const { first, last, ticks } = windowsAxis(todayYmd, bars)
  const total = Math.max(1, daysBetweenYmd(first, last) ?? 1)
  const pct = (ymd: string) => Math.max(0, Math.min(100, ((daysBetweenYmd(first, ymd) ?? 0) / total) * 100))
  const nameCol = 'minmax(110px, 30%)'
  const todayAt = pct(todayYmd)
  const legend: string[] = []
  if (bars.some((b) => b.tone === 'closed')) legend.push('▭ a window that closed')
  if (bars.some((b) => b.hatchTo && b.hatchTo > b.start)) legend.push('▨ days already gone')
  if (bars.some((b) => b.waits)) legend.push('┄ opens when the notice is mailed')
  if (bars.some((b) => b.tone === 'ghost')) legend.push('┈ a window that never opened')
  legend.push('│ today')
  return (
    <div data-lien-timeline-windows style={{ display: 'grid', gap: 0, fontSize: '0.75rem', minWidth: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: `${nameCol} minmax(0, 1fr)` }}>
        <span />
        <div data-lien-timeline-windows-axis style={{ position: 'relative', height: 26, borderBottom: '1px solid var(--border-strong)', color: 'var(--text-muted)', fontSize: '0.68rem' }}>
          {ticks.map((t) => (
            <span key={t} data-lien-timeline-windows-tick={t.slice(0, 7)} style={{ position: 'absolute', left: `${pct(t)}%`, bottom: 2, paddingLeft: 3, borderLeft: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{MONTH_SHORT[Number(t.slice(5, 7)) - 1]}</span>
          ))}
          <span style={{ position: 'absolute', left: `${todayAt}%`, top: 0, paddingLeft: 4, fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-link)', whiteSpace: 'nowrap', transform: todayAt > 75 ? 'translateX(-100%)' : undefined }}>today · {lienDateWords(todayYmd, todayYmd)}</span>
        </div>
      </div>
      {rows.map((r) => (
        <div key={r.key} data-lien-timeline-window={r.key} data-lien-timeline-window-kind={r.kind === 'bar' ? r.tone : r.undated ? 'undated' : 'text'} style={{ display: 'grid', gridTemplateColumns: `${nameCol} minmax(0, 1fr)`, alignItems: 'center', minHeight: r.kind === 'bar' ? 48 : 36, borderBottom: '1px dashed var(--border)' }}>
          <div style={{ minWidth: 0, paddingRight: 6, lineHeight: 1.25 }}>
            <div style={{ fontWeight: 700, color: r.kind === 'bar' && r.dim ? 'var(--text-muted)' : 'var(--text-strong)' }}>{r.label}</div>
            {r.sub ? <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>{r.sub}</div> : null}
            {moveOf(r.key) ? <MovePill move={moveOf(r.key)!} voice={voice} style={{ marginTop: 3 }} /> : null}
          </div>
          {r.kind === 'bar' ? (
            <div style={{ position: 'relative', height: 48 }}>
              <span aria-hidden data-lien-timeline-today style={{ position: 'absolute', left: `${todayAt}%`, top: 0, bottom: 0, borderLeft: '2px solid var(--text-link)', zIndex: 2 }} />
              <span
                title={r.title}
                style={{
                  position: 'absolute',
                  top: 9,
                  height: 14,
                  left: `${pct(r.start)}%`,
                  width: `${Math.max(1.5, pct(r.end) - pct(r.start))}%`,
                  borderRadius: 4,
                  border: `1px ${r.waits ? 'dashed' : r.tone === 'ghost' ? 'dotted' : 'solid'} ${BAR_TONE[r.tone].line}`,
                  background: r.waits ? 'transparent' : BAR_TONE[r.tone].bg,
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                  opacity: r.tone === 'green' ? 0.75 : 1,
                }}
              >
                {r.hatchTo && r.hatchTo > r.start ? (
                  <span aria-hidden data-lien-timeline-hatch style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, ((pct(r.hatchTo) - pct(r.start)) / Math.max(0.1, pct(r.end) - pct(r.start))) * 100)}%`, background: `repeating-linear-gradient(135deg, color-mix(in srgb, ${BAR_TONE[r.tone].line} 40%, transparent) 0 3px, color-mix(in srgb, ${BAR_TONE[r.tone].line} 12%, transparent) 3px 6px)` }} />
                ) : null}
              </span>
              {r.tone === 'closed' ? (
                <span aria-hidden data-lien-timeline-struck style={{ position: 'absolute', top: 6, left: `${pct(r.end)}%`, marginLeft: -8, width: 16, height: 16, borderRadius: '50%', background: 'var(--text-red-600)', color: '#fff', fontSize: 10, fontWeight: 800, lineHeight: '16px', textAlign: 'center', border: '2px solid var(--surface)', boxSizing: 'border-box', zIndex: 3 }}>
                  ✗
                </span>
              ) : null}
              <span
                data-lien-timeline-caption
                style={{ position: 'absolute', top: 27, ...(pct(r.start) > 55 ? { right: 0, textAlign: 'right' } : { left: `${pct(r.start)}%` }), maxWidth: '100%', fontSize: '0.7rem', lineHeight: 1.3, color: captionColor(r.captionTone), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
              >
                {r.caption}
                {r.chip ? <span data-lien-timeline-chip style={{ marginLeft: 6, fontSize: '0.62rem', fontWeight: 700, padding: '0 6px', borderRadius: 999, lineHeight: '15px', background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', verticalAlign: 1 }}>{r.chip}</span> : null}
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.35rem 0', lineHeight: 1.3, color: r.tone === 'red' ? 'var(--text-red-600)' : r.tone === 'green' ? 'var(--text-green-800)' : 'var(--text-muted)' }}>
              {r.undated ? <span aria-hidden style={{ width: 12, height: 12, borderRadius: '50%', border: '2px dashed var(--border-strong)', boxSizing: 'border-box', flex: 'none' }} /> : null}
              <span>{r.words}</span>
              {r.door && onDoor ? (
                <button type="button" onClick={() => onDoor(r.door!)} style={{ border: 'none', background: 'none', color: 'var(--text-link)', font: 'inherit', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                  set the date ›
                </button>
              ) : null}
            </div>
          )}
        </div>
      ))}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.2rem 0.9rem', color: 'var(--text-muted)', fontSize: '0.68rem', paddingTop: '0.4rem' }}>
        {after ? <span data-lien-timeline-windows-after>{after}</span> : <span />}
        <span data-lien-timeline-windows-legend style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem 0.9rem' }}>
          {legend.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </span>
      </div>
    </div>
  )
}
