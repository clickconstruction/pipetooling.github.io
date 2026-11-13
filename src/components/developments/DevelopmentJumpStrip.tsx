/**
 * The Development page's strip (punch list #208, design spike): six looks at one site, top to
 * bottom — ① What changed ② Pieces ③ Money ④ Plans ⑤ Questions ⑥ Photos (punch list #247) — and the mark is on the place, never on the
 * look. The owner on the first cut's ticks and score (2026-10-28): *I don't understand how pieces or
 * plans can be marked off*; and on the plans tail: *I don't understand the subject*. Draft B of
 * `strip-place-mockup.html`: the number says the order (no arrow), the filled one is where you are,
 * nothing ever turns to a tick, there is no score and no tail; each look's count carries its noun,
 * and in amber the thing in it that needs the leader (*4 likely pairs*, *42 without plans*,
 * *1 waiting*), so the tail's fact sits on its subject. Pinned while the page scrolls, a press jumps
 * to the look; the Pipeline's bar classes still size it, overridden by `.developmentReviewStrip`.
 */
import { useEffect, useRef } from 'react'
import { useMatchMedia } from '../../hooks/useMatchMedia'
import { lookFigure } from '../../lib/developments/lookFigure'
import { useJumpStrip } from '../gc/useJumpStrip'

export type DevelopmentJumpKey = 'changed' | 'pieces' | 'money' | 'plans' | 'questions' | 'photos'

export const DEVELOPMENT_JUMP_ANCHOR: Record<DevelopmentJumpKey, string> = {
  changed: 'development-what-changed',
  pieces: 'development-pieces',
  money: 'development-money',
  plans: 'development-plans',
  questions: 'development-questions',
  photos: 'development-photos',
}

const ORDER: DevelopmentJumpKey[] = ['changed', 'pieces', 'money', 'plans', 'questions', 'photos']
const LABEL: Record<DevelopmentJumpKey, string> = { changed: 'History', pieces: 'Jobs & bids', money: 'Money', plans: 'Plans', questions: 'Questions', photos: 'Photos' }

export const DEVELOPMENT_PHONE_QUERY = '(max-width: 760px)'

/** The one-sentence tell, on the cap's title. */
const COUNT_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'] as const
/**
 * The strip's name, counted from its own list: *Six looks*. The phone's nav kept *Five looks* by hand after
 * Photos joined as the sixth (v2.6371), so the cap and both navs read this one name.
 */
const LOOKS_NAME = `${COUNT_WORDS[ORDER.length] ?? ORDER.length} looks`

export const REVIEW_TELL = 'Six looks at the site, top to bottom: the history, the jobs and bids, the money, the plans, the questions, the photos. The filled number is where you are.'

/**
 * What a look says of itself: `count` the plain count with its noun (*0 new*, *23*, *1 set*), `need`
 * the thing in it waiting on the leader, with its noun (*4 likely pairs*), or null when nothing is.
 * When `need` repeats `count` (*3 new*), it is drawn once, in amber.
 */
export type DevelopmentLook = { n: number; count: string; need: string | null }

export function DevelopmentJumpStrip({ looks }: { looks: Record<DevelopmentJumpKey, DevelopmentLook> }) {
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

  // The phone (the Gray Fox spike, 2026-11-02): one row with a cell for each look, the look's name over
  // one figure, the look you are in underlined, no cap and no ordinals. The desk's chips wrapped into
  // four ragged lines there (the owner: *I don't like how this looks on mobile*). The row counts no
  // columns: each cell is as wide as its words and shares what is left (v2.6371's sixth look dropped
  // to a second row of a five-column grid).
  if (phone) {
    return (
      <nav ref={barRef as React.RefObject<HTMLDivElement>} aria-label={`${LOOKS_NAME} at the site`} className="developmentPhoneStrip" data-development-jump-strip data-testid="development-phone-strip">
        {ORDER.map((key, index) => {
          const on = key === active
          const look = looks[key]
          const need = look.need && look.need.trim() ? look.need : null
          const whole = `${look.count}${need && need !== look.count ? `, ${need}` : ''}`
          return (
            <button
              key={key}
              type="button"
              onClick={() => jumpTo(key)}
              aria-label={`Look ${index + 1}, ${LABEL[key]}, ${whole}`}
              aria-current={on ? 'location' : undefined}
              title={`${LABEL[key]} · ${whole}`}
              className={`developmentPhoneLook${on ? ' isOn' : ''}${look.n === 0 && !need ? ' isEmpty' : ''}`}
              data-testid="development-jump"
              data-need={need ? '1' : undefined}
            >
              <span className="developmentPhoneLookName">{LABEL[key]}</span>
              <span className={`developmentPhoneLookFigure${need ? ' reviewNeed' : ''}`}>{lookFigure(look)}</span>
            </button>
          )
        })}
      </nav>
    )
  }

  return (
    <div ref={barRef} className="stagesStageBar messagesJumpStrip developmentReviewStrip" data-development-jump-strip style={{ top: 0, marginBottom: 12 }}>
      <div className="stagesStageBarEnd reviewCap" title={REVIEW_TELL} data-testid="review-cap">
        <strong>{LOOKS_NAME}</strong>
      </div>
      <nav aria-label={`${LOOKS_NAME} at the site`} className="stagesStageSegs">
        {ORDER.map((key, index) => {
          const on = key === active
          const look = looks[key]
          const need = look.need && look.need.trim() ? look.need : null
          const meta = need ? (need === look.count ? <span className="reviewNeed">{need}</span> : <>{look.count} · <span className="reviewNeed">{need}</span></>) : look.count
          return (
            <button
              key={key}
              type="button"
              onClick={() => jumpTo(key)}
              aria-label={`Look ${index + 1}, ${LABEL[key]}, ${look.count}${need && need !== look.count ? `, ${need}` : ''}`}
              aria-current={on ? 'location' : undefined}
              className={`stagesStageSeg${on ? ' isOn' : ''}${look.n === 0 && !need ? ' isEmpty' : ''}`}
              style={{ '--stage-color': '#3b82f6' } as React.CSSProperties}
              data-testid="development-jump"
              data-need={need ? '1' : undefined}
            >
              <span className={`reviewOrd${on ? ' isOn' : ''}`} aria-hidden>
                {index + 1}
              </span>
              <span className="stagesStageSegName">{LABEL[key]}</span>
              <span className="stagesStageSegMeta">{meta}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
