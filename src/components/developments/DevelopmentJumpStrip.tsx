/**
 * The Development page's strip (punch list #208, design spike): a review, not a flow (the owner,
 * 2026-10-28: *make it more clear that this is a review process and not a flow chart*). Draft B of
 * `strip-mockup.html`: four numbered looks — ① What changed ② Pieces ③ Plans ④ Questions — the
 * number lit while that section is in view, a tick once the page has scrolled past it, the left cap
 * keeping the score (*Review · 2 of 4*) with the one-sentence tell as its title, the newest-set tail
 * on the right. No arrows, no stage dots: the order is the page's, top to bottom, and a tick means
 * *looked at this visit*, which resets on the next. Pinned while the page scrolls, a press jumps to
 * the section; the Pipeline's bar classes still size it, overridden by `.developmentReviewStrip`.
 */
import { useEffect, useRef, useState } from 'react'
import { useMatchMedia } from '../../hooks/useMatchMedia'
import { useJumpStrip } from '../gc/useJumpStrip'

export type DevelopmentJumpKey = 'changed' | 'pieces' | 'plans' | 'questions'

export const DEVELOPMENT_JUMP_ANCHOR: Record<DevelopmentJumpKey, string> = {
  changed: 'development-what-changed',
  pieces: 'development-pieces',
  plans: 'development-plans',
  questions: 'development-questions',
}

const ORDER: DevelopmentJumpKey[] = ['changed', 'pieces', 'plans', 'questions']
const LABEL: Record<DevelopmentJumpKey, string> = { changed: 'What changed', pieces: 'Pieces', plans: 'Plans', questions: 'Questions' }

export const DEVELOPMENT_PHONE_QUERY = '(max-width: 760px)'

/** The one-sentence tell, on the cap's title. */
export const REVIEW_TELL = 'Four looks at the site, top to bottom: what moved, the pieces, the plans, the questions. A tick means you have looked at it on this visit.'

/** The count with its noun, so a zero reads as a fact and not an empty stage. */
function countWords(key: DevelopmentJumpKey, n: number): string {
  switch (key) {
    case 'changed':
      return `${n} new`
    case 'plans':
      return `${n} ${n === 1 ? 'set' : 'sets'}`
    default:
      return String(n)
  }
}

export function DevelopmentJumpStrip({ counts, tail }: { counts: Record<DevelopmentJumpKey, number>; tail: string | null }) {
  const phone = useMatchMedia(DEVELOPMENT_PHONE_QUERY)
  const { active, jumpTo } = useJumpStrip(true, ORDER, (k) => DEVELOPMENT_JUMP_ANCHOR[k as DevelopmentJumpKey])
  const barRef = useRef<HTMLDivElement>(null)
  // A look is ticked once its whole card has been on screen this visit: its bottom edge has come up
  // past the window's bottom, which a long card reaches only when scrolled through, a short one at once.
  const [seen, setSeen] = useState<ReadonlySet<DevelopmentJumpKey>>(() => new Set())
  const activeIndex = active ? ORDER.indexOf(active as DevelopmentJumpKey) : -1
  useEffect(() => {
    let frame = 0
    const look = () => {
      frame = 0
      const next = new Set<DevelopmentJumpKey>()
      for (const key of ORDER) {
        const el = document.getElementById(DEVELOPMENT_JUMP_ANCHOR[key])
        if (el && el.getBoundingClientRect().bottom <= window.innerHeight + 2) next.add(key)
      }
      if (next.size > 0) setSeen((prev) => ([...next].some((k) => !prev.has(k)) ? new Set([...prev, ...next]) : prev))
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(look)
    }
    look()
    const settle = window.setTimeout(look, 600)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      window.clearTimeout(settle)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])
  useEffect(() => {
    const bar = barRef.current
    if (!bar) return
    const set = () => document.documentElement.style.setProperty('--development-jump-offset', `${Math.round(bar.getBoundingClientRect().height) + 12}px`)
    set()
    window.addEventListener('resize', set)
    return () => {
      window.removeEventListener('resize', set)
      document.documentElement.style.removeProperty('--development-jump-offset')
    }
  }, [phone])

  // Ticked: its card has been on screen whole, or the page has scrolled past it to a later look.
  const ticked = (index: number) => seen.has(ORDER[index]!) || (activeIndex > index)
  const score = ORDER.filter((_, i) => ticked(i)).length

  return (
    <div ref={barRef} className={`stagesStageBar messagesJumpStrip developmentReviewStrip${phone ? ' isLine' : ''}`} data-development-jump-strip style={{ top: 0, marginBottom: 12 }}>
      <div className="stagesStageBarEnd reviewCap" title={REVIEW_TELL} data-testid="review-cap">
        <strong>Review</strong>
        <span>
          {score} of {ORDER.length}
        </span>
      </div>
      <nav aria-label="Four looks at the site" className="stagesStageSegs">
        {ORDER.map((key, index) => {
          const on = key === active
          const done = ticked(index)
          const n = counts[key]
          return (
            <button
              key={key}
              type="button"
              onClick={() => jumpTo(key)}
              aria-label={`Look ${index + 1}, ${LABEL[key]}, ${countWords(key, n)}${done ? ', looked at' : ''}`}
              aria-current={on ? 'location' : undefined}
              className={`stagesStageSeg${on ? ' isOn' : ''}${n === 0 ? ' isEmpty' : ''}`}
              style={{ '--stage-color': '#3b82f6' } as React.CSSProperties}
              data-testid="development-jump"
              data-done={done ? '1' : undefined}
            >
              <span className={`reviewOrd${on ? ' isOn' : ''}${done ? ' isDone' : ''}`} aria-hidden>
                {done ? '✓' : index + 1}
              </span>
              <span className="stagesStageSegName">{LABEL[key]}</span>
              <span className="stagesStageSegMeta">{countWords(key, n)}</span>
            </button>
          )
        })}
      </nav>
      {tail && !phone ? (
        <div className="stagesStageBarEnd isTrailing" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {tail}
        </div>
      ) : null}
    </div>
  )
}
