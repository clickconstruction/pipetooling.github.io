/**
 * The Development page's jump strip (punch list #208, design spike): Messages' strip
 * (`MessagesJumpStrip`, the Pipeline's stage bar classes) over the page's four cards — What changed ·
 * Pieces · Plans · Questions — pinned at the top while the page scrolls, the card being read lit, a
 * press scrolling to it. At its right, the newest plan set and how many pieces are on an older one.
 * On a phone the segments read as one wrapping line.
 */
import { Fragment, useEffect, useRef, type CSSProperties } from 'react'
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
/** Changed blue (the new), Pieces indigo, Plans violet, Questions amber (waiting on someone). */
const COLOR: Record<DevelopmentJumpKey, string> = { changed: '#3b82f6', pieces: '#4f46e5', plans: '#7c3aed', questions: '#d97706' }

export const DEVELOPMENT_PHONE_QUERY = '(max-width: 760px)'

export function DevelopmentJumpStrip({ counts, tail }: { counts: Record<DevelopmentJumpKey, number>; tail: string | null }) {
  const phone = useMatchMedia(DEVELOPMENT_PHONE_QUERY)
  const { active, jumpTo } = useJumpStrip(true, ORDER, (k) => DEVELOPMENT_JUMP_ANCHOR[k as DevelopmentJumpKey])
  const barRef = useRef<HTMLDivElement>(null)
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
  return (
    <div ref={barRef} className={`stagesStageBar messagesJumpStrip${phone ? ' isLine' : ''}`} data-development-jump-strip style={{ top: 0, marginBottom: 12 }}>
      <nav aria-label="Development cards" className="stagesStageSegs">
        {ORDER.map((key, index) => {
          const on = key === active
          const n = counts[key]
          return (
            <Fragment key={key}>
              {index > 0 ? (
                <span className="stagesStageArrow" aria-hidden>
                  →
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => jumpTo(key)}
                aria-label={`Jump to ${LABEL[key]}, ${n}`}
                aria-current={on ? 'location' : undefined}
                className={`stagesStageSeg${on ? ' isOn' : ''}${n === 0 ? ' isEmpty' : ''}`}
                style={{ '--stage-color': COLOR[key] } as CSSProperties}
                data-testid="development-jump"
              >
                <span className="stagesStageSegName">
                  <span className="stagesStageSegDot" aria-hidden />
                  {LABEL[key]}
                </span>
                <span className="stagesStageSegMeta">{n}</span>
              </button>
            </Fragment>
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
