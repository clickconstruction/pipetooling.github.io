/**
 * The Pipeline board's stage bar (v2.4512; the jump strip since Stages tab decomposition PR 4,
 * v2.3534): Waiting · Working · Ready to Bill · Billed Awaiting Payment (· Collections while
 * it has rows), each a segment that opens and scrolls to its section, with the section's
 * count and dollars under its name.
 *
 * It stays pinned to the top while the board scrolls, and the segment of the section being
 * scrolled through is lit in that section's color (`lib/jobs/stagesStageBar`). The counts
 * and totals come in already resolved (live, stats-spine or "…").
 *
 * v2.4519: each segment's name and numbers are centered, with an arrow between neighbours as
 * the strip always had; the arrows drop out when the bar is too tight for them. Collections is
 * a side road, not the step after Billed, so its arrow points back the way a job leaves it.
 */
import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { stageBarItems, stageColorVar, stagesActiveSection, type StageBarKey } from '../../lib/jobs/stagesStageBar'

export type JumpStripSection = StageBarKey

export type JumpStripCounts = Record<JumpStripSection, string>

/** Room between the pinned bar and the header a jump lands on. */
const LAND_GAP_PX = 8

export function JobsStagesJumpStrip({
  counts,
  totals,
  onFocusSection,
  sectionElementId,
  leading,
  trailing,
}: {
  counts: JumpStripCounts
  /** Abbreviated dollars per section, without the "$". */
  totals: JumpStripCounts
  /** Opens the section and scrolls to its header (the tab's `focusStagesSection`). */
  onFocusSection: (section: JumpStripSection) => void
  /** The DOM id of a section's header, which the bar watches while the page scrolls. */
  sectionElementId: (section: JumpStripSection) => string
  /** The ☰ tools menu, at the bar's left end. */
  leading?: ReactNode
  /** The way back from the Recently added view, at the bar's right end. */
  trailing?: ReactNode
}) {
  const items = stageBarItems(counts, totals)
  const keys = items.map((i) => i.key).join(',')
  const barRef = useRef<HTMLDivElement>(null)
  const [top, setTop] = useState(0)
  const [active, setActive] = useState<JumpStripSection | null>(null)

  useEffect(() => {
    let raf = 0
    const measure = () => {
      raf = 0
      const bar = barRef.current
      if (!bar) return
      // The page's own tab strip sticks on a narrow window; the bar sits under it there.
      const tabs = document.querySelector('[data-jobs-page-tabs]') as HTMLElement | null
      const under = tabs && getComputedStyle(tabs).position === 'sticky' ? Math.round(tabs.getBoundingClientRect().height) : 0
      setTop(under)
      const rect = bar.getBoundingClientRect()
      document.documentElement.style.setProperty('--stages-jump-offset', `${under + Math.round(rect.height) + LAND_GAP_PX}px`)
      const tops = (keys ? (keys.split(',') as JumpStripSection[]) : []).map((key) => ({
        key,
        top: document.getElementById(sectionElementId(key))?.getBoundingClientRect().top ?? null,
      }))
      setActive(stagesActiveSection(tops, rect.bottom + LAND_GAP_PX * 2))
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
      document.documentElement.style.removeProperty('--stages-jump-offset')
    }
  }, [keys, sectionElementId])

  return (
    <div ref={barRef} className="stagesStageBar" data-stages-stage-bar style={{ top }}>
      {leading ? <div className="stagesStageBarEnd">{leading}</div> : null}
      <nav aria-label="Pipeline stages" className="stagesStageSegs">
        {items.map((item, index) => {
          const on = item.key === active
          return (
            <Fragment key={item.key}>
            {index > 0 ? (
              <span className="stagesStageArrow" aria-hidden>
                {item.key === 'collections' ? '←' : '→'}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => onFocusSection(item.key)}
              aria-label={`Jump to ${item.label}, ${item.count} ${item.noun}`}
              aria-current={on ? 'location' : undefined}
              className={`stagesStageSeg${on ? ' isOn' : ''}${item.empty ? ' isEmpty' : ''}${item.key === 'billed' ? ' isWide' : ''}`}
              style={stageColorVar(item.key) as CSSProperties}
            >
              <span className="stagesStageSegName">
                <span className="stagesStageSegDot" aria-hidden />
                {item.label}
              </span>
              <span className="stagesStageSegMeta">
                {item.count} · <span className="stagesMoney">${item.total}</span>
              </span>
            </button>
            </Fragment>
          )
        })}
      </nav>
      {trailing ? <div className="stagesStageBarEnd isTrailing">{trailing}</div> : null}
    </div>
  )
}

/**
 * A section header's title inside its colored band: the name, the count in a pill, the
 * dollars beside it. The header's own `--stage-color` colors the pill. The spaces between
 * the pieces draw nothing in the header's flex row; they are for a screen reader and a copy.
 */
export function StagesSectionBandTitle({ label, count, total }: { label: string; count: string; total?: string }) {
  return (
    <>
      <span className="stagesBandTitle">{label}</span>{' '}
      <span className="stagesBandCount">{count}</span>{' '}
      {total != null ? <span className="stagesMoney stagesBandTotal">${total}</span> : null}
    </>
  )
}
