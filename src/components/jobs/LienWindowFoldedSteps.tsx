import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import LienTimelineStrip from './LienTimelineStrip'
import { lienTimelineFoldSummary, type LienTimeline } from '../../lib/jobs/lienTimeline'
import { useLienTimelineView } from '../../hooks/useLienTimelineView'

/**
 * The Lien window's steps on a phone (v2.4398). Stacked, the steps took 426 of the window's
 * 776 px and the paper under them got 120. Here they fold to one strip that still says what
 * the window is for: the next step, who we wait on, and any § 53.056 window that closed.
 * A press drops the steps down OVER the paper, so opening them never squeezes it again; the
 * strip, the grey behind the steps and Escape put them away. It always opens folded.
 *
 * `[data-lien-window-card]` on an ancestor says where the dropped steps must end.
 */

const chipBase: CSSProperties = { fontSize: '0.72rem', fontWeight: 600, borderRadius: 999, padding: '1px 8px', whiteSpace: 'nowrap', border: '1px solid var(--border)' }

function nextColor(tone: LienTimeline['next']['tone']): string {
  return tone === 'red' ? 'var(--text-red-600)' : tone === 'amber' ? 'var(--text-amber-800)' : tone === 'green' ? 'var(--text-green-800)' : 'var(--text-strong)'
}

export default function LienWindowFoldedSteps({ timeline }: { timeline: LienTimeline }) {
  const [open, setOpen] = useState(false)
  const [maxHeight, setMaxHeight] = useState<number | null>(null)
  const stripRef = useRef<HTMLButtonElement | null>(null)
  const panelId = useId()
  const view = useLienTimelineView()
  const f = lienTimelineFoldSummary(timeline)

  // The dropped steps end inside the window's card, whatever the title and the job's name took above them.
  useLayoutEffect(() => {
    if (!open) return
    const read = () => {
      const strip = stripRef.current
      const card = strip?.closest('[data-lien-window-card]')
      if (!strip || !card) return
      const room = card.getBoundingClientRect().bottom - strip.getBoundingClientRect().bottom - 15
      setMaxHeight(room > 120 ? Math.floor(room) : null)
    }
    read()
    window.addEventListener('resize', read)
    return () => window.removeEventListener('resize', read)
  }, [open])

  useEffect(() => {
    if (!open) return
    // Capture phase: Escape puts the steps away alone, never the window under them.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open])

  return (
    <>
      {open ? (
        // Inside the card, so a press on the grey reaches the card (which keeps it from the window's own backdrop) and closes the steps only.
        <div data-lien-window-fold-scrim aria-hidden onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 3, background: 'rgba(17,24,39,0.3)' }} />
      ) : null}
      <div data-lien-window-fold style={{ position: 'relative', zIndex: open ? 4 : undefined, marginTop: '0.5rem' }}>
        <button
          ref={stripRef}
          type="button"
          data-lien-window-fold-strip
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
          style={{ width: '100%', minHeight: 56, display: 'flex', alignItems: 'center', gap: '0.6rem', border: '1px solid var(--border-strong)', borderRadius: 9, background: 'var(--surface)', color: 'var(--text-base)', padding: '0.5rem 0.6rem 0.5rem 0.75rem', font: 'inherit', textAlign: 'left', cursor: 'pointer' }}
        >
          <span style={{ flex: 1, minWidth: 0, display: 'grid', gap: 5 }}>
            <span style={{ fontSize: '0.8125rem', lineHeight: 1.4 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.69rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Next</span>{' '}
              <strong style={{ color: nextColor(f.tone) }}>{f.next}</strong>
            </span>
            {f.waitingOn || f.closed ? (
              <span style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {f.waitingOn ? <span style={{ ...chipBase, background: 'var(--bg-muted)', color: 'var(--text-700)' }}>{f.waitingOn}</span> : null}
                {f.closed ? <span data-lien-window-fold-closed style={{ ...chipBase, background: 'var(--bg-red-tint)', color: 'var(--text-red-700)', borderColor: 'var(--border-red)' }}>{f.closed}</span> : null}
              </span>
            ) : null}
          </span>
          <span style={{ flexShrink: 0, display: 'grid', justifyItems: 'center', color: 'var(--text-link)', fontSize: '0.72rem', fontWeight: 600 }}>
            {open ? 'Hide' : 'Steps'}
            {open ? <ChevronUp size={16} aria-hidden /> : <ChevronDown size={16} aria-hidden />}
          </span>
        </button>
        {open ? (
          <div
            id={panelId}
            data-lien-window-fold-panel
            style={{ position: 'absolute', left: -6, right: -6, top: 'calc(100% + 5px)', maxHeight: maxHeight ?? 'calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 15.5rem)', overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 10, boxShadow: '0 14px 30px -6px rgba(0,0,0,0.3)', padding: '0.55rem 0.75rem' }}
          >
            {/* The sentence and who we wait on are on the strip above; the steps do not say them twice. */}
            <LienTimelineStrip timeline={timeline} layout="list" withNext={false} />
            {f.notes.length > 0 || (view === 'windows' && timeline.windowsAside) ? (
              <div style={{ display: 'grid', gap: 2, fontSize: '0.78rem', color: 'var(--text-muted)', paddingTop: '0.35rem' }}>
                {f.notes.map((n) => (
                  <span key={n}>{n}</span>
                ))}
                {view === 'windows' && timeline.windowsAside ? <span>{timeline.windowsAside}</span> : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  )
}
