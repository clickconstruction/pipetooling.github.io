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
import { useEffect, useMemo, useRef } from 'react'
import { useMatchMedia } from '../../hooks/useMatchMedia'
import { lookFigure } from '../../lib/developments/lookFigure'
import { useJumpStrip } from '../gc/useJumpStrip'
import { ScrollableTabStrip } from '../ScrollableTabStrip'

export type DevelopmentJumpKey = 'changed' | 'pieces' | 'money' | 'plans' | 'questions' | 'photos'

/**
 * The looks a site may add after the six. Trips (punch list #379) is drawn only on a site that has a trip or is far
 * from the shop. Schedule (punch list #382) is drawn only on a site with a stage line the reader is on the desk of.
 */
export type DevelopmentStripKey = DevelopmentJumpKey | 'trips' | 'schedule'

export const DEVELOPMENT_JUMP_ANCHOR: Record<DevelopmentStripKey, string> = {
  changed: 'development-what-changed',
  pieces: 'development-pieces',
  money: 'development-money',
  plans: 'development-plans',
  questions: 'development-questions',
  photos: 'development-photos',
  trips: 'development-trips',
  schedule: 'development-schedule',
}

const SIX: DevelopmentJumpKey[] = ['changed', 'pieces', 'money', 'plans', 'questions', 'photos']
const LABEL: Record<DevelopmentStripKey, string> = { changed: 'History', pieces: 'Jobs & bids', money: 'Money', plans: 'Plans', questions: 'Questions', photos: 'Photos', trips: 'Trips', schedule: 'Schedule' }
/** How the tell names each look. */
const TELL_NAME: Record<DevelopmentStripKey, string> = { changed: 'the history', pieces: 'the jobs and bids', money: 'the money', plans: 'the plans', questions: 'the questions', photos: 'the photos', trips: 'the trips', schedule: 'the schedule' }

export const DEVELOPMENT_PHONE_QUERY = '(max-width: 760px)'

/** How much of the next look shows beside the one you are in, on a phone's strip, so the row reads as going on. */
const PHONE_LOOK_PEEK_PX = 28

/** The one-sentence tell, on the cap's title. */
const COUNT_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'] as const
/**
 * The strip's name, counted from its own list: *Six looks*. The phone's nav kept *Five looks* by hand after
 * Photos joined as the sixth (v2.6371), so the cap and both navs read this one name.
 */
const looksName = (n: number): string => `${COUNT_WORDS[n] ?? n} looks`

/** The tell for the looks a site has, counted and named from its own list. */
const reviewTell = (order: readonly DevelopmentStripKey[]): string => `${looksName(order.length)} at the site, top to bottom: ${order.map((k) => TELL_NAME[k]).join(', ')}. The filled number is where you are.`


/**
 * What a look says of itself: `count` the plain count with its noun (*0 new*, *23*, *1 set*), `need`
 * the thing in it waiting on the leader, with its noun (*4 likely pairs*), or null when nothing is.
 * When `need` repeats `count` (*3 new*), it is drawn once, in amber.
 */
export type DevelopmentLook = { n: number; count: string; need: string | null }

export function DevelopmentJumpStrip({ looks }: { looks: Record<DevelopmentJumpKey, DevelopmentLook> & { trips?: DevelopmentLook; schedule?: DevelopmentLook } }) {
  const phone = useMatchMedia(DEVELOPMENT_PHONE_QUERY)
  // The six, then Trips and Schedule after them on a site that has each look.
  const hasTrips = !!looks.trips
  const hasSchedule = !!looks.schedule
  const ORDER = useMemo<DevelopmentStripKey[]>(() => [...SIX, ...(hasTrips ? (['trips'] as const) : []), ...(hasSchedule ? (['schedule'] as const) : [])], [hasTrips, hasSchedule])
  const LOOKS_NAME = looksName(ORDER.length)
  const lookOf = (key: DevelopmentStripKey): DevelopmentLook => (key === 'trips' || key === 'schedule' ? (looks[key] ?? { n: 0, count: '', need: null }) : looks[key])
  const { active, jumpTo } = useJumpStrip(true, ORDER, (k) => DEVELOPMENT_JUMP_ANCHOR[k as DevelopmentStripKey])
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
  // Since v2.8293 a cell never gives up its name. Six looks fit a phone. Trips and Schedule made eight, and at
  // 393 px every name was cut: *Histo…*, *Pla…*, *Questio…*. The row now slides: the look you are in is kept
  // whole in view with the start of the next beside it, and an arrow marks an edge with more past it.
  if (phone) {
    return (
      <nav ref={barRef as React.RefObject<HTMLDivElement>} aria-label={`${LOOKS_NAME} at the site`} className="developmentPhoneStrip" data-development-jump-strip data-testid="development-phone-strip">
        <ScrollableTabStrip activeKey={active ?? undefined} activePeek={PHONE_LOOK_PEEK_PX} edgeMarks fill gap="0" align="start" fadeColor="var(--surface)">
        {ORDER.map((key, index) => {
          const on = key === active
          const look = lookOf(key)
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
              data-tabkey={key}
              data-need={need ? '1' : undefined}
            >
              <span className="developmentPhoneLookName">{LABEL[key]}</span>
              <span className={`developmentPhoneLookFigure${need ? ' reviewNeed' : ''}`}>{lookFigure(look)}</span>
            </button>
          )
        })}
        </ScrollableTabStrip>
      </nav>
    )
  }

  return (
    <div ref={barRef} className="stagesStageBar messagesJumpStrip developmentReviewStrip" data-development-jump-strip style={{ top: 0, marginBottom: 12 }}>
      <div className="stagesStageBarEnd reviewCap" title={reviewTell(ORDER)} data-testid="review-cap">
        <strong>{LOOKS_NAME}</strong>
      </div>
      <nav aria-label={`${LOOKS_NAME} at the site`} className="stagesStageSegs">
        {ORDER.map((key, index) => {
          const on = key === active
          const look = lookOf(key)
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
