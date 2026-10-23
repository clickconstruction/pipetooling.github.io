/**
 * Messages' jump strip (punch list #151 PR 1, v2.5799): the Pipeline's stage bar (`jobs/JobsStagesJumpStrip`, v2.4512)
 * over the lanes of `/messages`, drawn with the bar's own classes so the two read the same. One segment a lane with the
 * count its heading shows, pinned at the top while the page scrolls, the lane being read lit in its color, a press
 * scrolling to the lane through the page's `onJump` (which unfolds the queues on a phone first). On a phone the
 * segments read as one wrapping line of name and count (`isLine`), the shape the queues fold already draws. Sets
 * `--messages-jump-offset` on the document so a lane's section (`.messagesLane`) lands just under the bar. The rows,
 * the colors and the lit lane come from `lib/messages/jumpStrip.ts`.
 */
import { Fragment, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useMatchMedia } from '../../hooks/useMatchMedia'
import { JUMP_LANE_ANCHOR, jumpStripActive, jumpStripItems, type JumpCounts, type JumpLane } from '../../lib/messages/jumpStrip'

/** Room between the pinned bar and the heading a jump lands on. */
const LAND_GAP_PX = 8

/** The page's own phone line (`Messages.tsx`, the queues fold). */
export const JUMP_STRIP_PHONE_QUERY = '(max-width: 760px)'

export interface MessagesJumpStripProps {
  counts: JumpCounts
  /** Scrolls the page to the lane's section. */
  onJump: (lane: JumpLane) => void
  /** The DOM id of a lane's section, which the bar watches while the page scrolls; the kernel's ids unless a smoke says otherwise. */
  anchorId?: (lane: JumpLane) => string
}

const defaultAnchorId = (lane: JumpLane) => JUMP_LANE_ANCHOR[lane]

export function MessagesJumpStrip({ counts, onJump, anchorId = defaultAnchorId }: MessagesJumpStripProps) {
  const items = jumpStripItems(counts)
  const keys = items.map((i) => i.key).join(',')
  const barRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState<JumpLane | null>(null)
  const phone = useMatchMedia(JUMP_STRIP_PHONE_QUERY)

  useEffect(() => {
    let raf = 0
    const measure = () => {
      raf = 0
      const bar = barRef.current
      if (!bar) return
      const rect = bar.getBoundingClientRect()
      document.documentElement.style.setProperty('--messages-jump-offset', `${Math.round(rect.height) + LAND_GAP_PX}px`)
      const tops = (keys ? (keys.split(',') as JumpLane[]) : []).map((key) => ({
        key,
        top: document.getElementById(anchorId(key))?.getBoundingClientRect().top ?? null,
      }))
      setActive(jumpStripActive(tops, rect.bottom + LAND_GAP_PX * 2))
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(measure)
    }
    measure()
    window.addEventListener('scroll', schedule, { passive: true, capture: true })
    window.addEventListener('resize', schedule)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('scroll', schedule, { capture: true })
      window.removeEventListener('resize', schedule)
      document.documentElement.style.removeProperty('--messages-jump-offset')
    }
  }, [keys, anchorId])

  return (
    <div ref={barRef} className={`stagesStageBar messagesJumpStrip${phone ? ' isLine' : ''}`} data-messages-jump-strip style={{ top: 0 }}>
      <nav aria-label="Messages lanes" className="stagesStageSegs">
        {items.map((item, index) => {
          const on = item.key === active
          return (
            <Fragment key={item.key}>
              {index > 0 ? (
                <span className="stagesStageArrow" aria-hidden>
                  →
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => onJump(item.key)}
                aria-label={`Jump to ${item.label}, ${item.count} ${item.noun}`}
                aria-current={on ? 'location' : undefined}
                className={`stagesStageSeg${on ? ' isOn' : ''}${item.empty ? ' isEmpty' : ''}`}
                style={{ '--stage-color': item.color } as CSSProperties}
                data-lane={item.key}
                data-testid="jump-lane"
              >
                <span className="stagesStageSegName">
                  <span className="stagesStageSegDot" aria-hidden />
                  {item.label}
                </span>
                <span className="stagesStageSegMeta">{item.count}</span>
              </button>
            </Fragment>
          )
        })}
      </nav>
    </div>
  )
}
