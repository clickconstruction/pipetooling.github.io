/**
 * Settings → Jobs & billing drawn by heading (punch list #261): the strip of headings pinned
 * under the tab's title, then each heading with its line and its cards, every card in a
 * `SettingsFoldCard` with its anchor. The page hands in one element per card; the kernel
 * says which cards the role sees and in what order, so a card the role is not shown is never
 * mounted. The strip is the Pipeline's stage bar over the headings (as Messages reuses it):
 * the heading being scrolled through lit, a press landing on the heading, one wrapping line
 * on a phone. It sets `--settings-jobs-jump-offset` so a heading or a card lands under it. Since
 * PR 3 the page hands in each Billing and money card's live value as one line (`valueLines`), drawn
 * on the folded row, and hears each fold (`onCardFold`) to read the values again.
 */
import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useMatchMedia } from '../../hooks/useMatchMedia'
import { JOBS_BILLING_STRIP_MIN_GROUPS, JOBS_BILLING_TAB, jobsBillingActiveGroup, jobsBillingGroupsFor, type JobsBillingGroup, type JobsBillingGroupId, type JobsBillingSlug } from '../../lib/settings/jobsBillingGroups'
import type { UserRole } from '../../hooks/useAuth'
import type { JobsBillingValueLines } from '../../lib/settings/jobsBillingValueLines'
import { SettingsFoldCard } from './SettingsFoldCard'

/** Room between the pinned strip and the heading a jump lands on. */
const LAND_GAP_PX = 8
/** The page's phone line: under it the strip is one wrapping line. */
export const JOBS_BILLING_STRIP_PHONE_QUERY = '(max-width: 760px)'

const HEADING: CSSProperties = { margin: '1.1rem 0 0.5rem', scrollMarginTop: 'var(--settings-jobs-jump-offset, 0.75rem)' }
const HEADING_H3: CSSProperties = { margin: 0, fontSize: '1rem', color: 'var(--text-strong)' }
const HEADING_LINE: CSSProperties = { margin: '0.1rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }

export type JobsBillingCardElements = Partial<Record<JobsBillingSlug, ReactNode>>

export function SettingsJobsBillingGroups({ role, cards, forceOpen, valueLines, onCardFold }: {
  role: UserRole | null
  /** One element per card; a card with none is not drawn (a dev-only card the page did not build for this role). */
  cards: JobsBillingCardElements
  /** Cards the address opens whatever their fold (`?focus=issuer.…` opens the company block). */
  forceOpen?: Partial<Record<JobsBillingSlug, boolean>>
  /** Each money card's live value in one line, on its folded row; a card with none keeps its static line. */
  valueLines?: JobsBillingValueLines
  /** A card folded by its header press, so the values are read again. */
  onCardFold?: (slug: JobsBillingSlug) => void
}) {
  const groups = jobsBillingGroupsFor(role)
  return (
    <div data-settings-jobs-billing>
      {groups.length >= JOBS_BILLING_STRIP_MIN_GROUPS ? <SettingsJobsBillingStrip groups={groups} /> : null}
      {groups.map((g) => (
        <Fragment key={g.id}>
          <div id={g.anchor} data-settings-jobs-group={g.id} style={HEADING}>
            <h3 style={HEADING_H3}>{g.name}</h3>
            <p style={HEADING_LINE}>{g.line}</p>
          </div>
          {g.cards.map((c) => {
            const el = cards[c.slug]
            if (el == null) return null
            return (
              <SettingsFoldCard key={c.slug} card={c} track={JOBS_BILLING_TAB} forceOpen={forceOpen?.[c.slug] ?? false} valueLine={valueLines?.[c.slug]} onFold={onCardFold ? () => onCardFold(c.slug) : undefined}>
                {el}
              </SettingsFoldCard>
            )
          })}
        </Fragment>
      ))}
    </div>
  )
}

export function SettingsJobsBillingStrip({ groups }: { groups: readonly JobsBillingGroup[] }) {
  const keys = groups.map((g) => g.id).join(',')
  const barRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState<JobsBillingGroupId | null>(null)
  const phone = useMatchMedia(JOBS_BILLING_STRIP_PHONE_QUERY)

  useEffect(() => {
    let raf = 0
    const measure = () => {
      raf = 0
      const bar = barRef.current
      if (!bar) return
      const rect = bar.getBoundingClientRect()
      document.documentElement.style.setProperty('--settings-jobs-jump-offset', `${Math.round(rect.height) + LAND_GAP_PX}px`)
      const tops = (keys ? (keys.split(',') as JobsBillingGroupId[]) : []).map((id) => ({
        id,
        top: document.querySelector<HTMLElement>(`[data-settings-jobs-group="${id}"]`)?.getBoundingClientRect().top ?? null,
      }))
      setActive(jobsBillingActiveGroup(tops, rect.bottom + LAND_GAP_PX * 2))
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(measure)
    }
    measure()
    window.addEventListener('scroll', schedule, { passive: true, capture: true })
    window.addEventListener('resize', schedule)
    // The tab is kept mounted while hidden, so the bar measures 0 tall at mount; it measures again when it is shown.
    const ro = typeof ResizeObserver !== 'undefined' && barRef.current ? new ResizeObserver(schedule) : null
    if (ro && barRef.current) ro.observe(barRef.current)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      ro?.disconnect()
      window.removeEventListener('scroll', schedule, { capture: true })
      window.removeEventListener('resize', schedule)
      document.documentElement.style.removeProperty('--settings-jobs-jump-offset')
    }
  }, [keys])

  const jump = (g: JobsBillingGroup) => {
    document.getElementById(g.anchor)?.scrollIntoView({ block: 'start', behavior: 'auto' })
  }

  return (
    <div ref={barRef} className={`stagesStageBar settingsJumpStrip${phone ? ' isLine' : ''}`} data-settings-jobs-strip style={{ top: 0 }}>
      <nav aria-label="Jobs and billing headings" className="stagesStageSegs">
        {groups.map((g, index) => {
          const on = g.id === active
          return (
            <Fragment key={g.id}>
              {index > 0 ? (
                <span className="stagesStageArrow" aria-hidden>
                  →
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => jump(g)}
                aria-label={`Jump to ${g.name}, ${g.cards.length} ${g.cards.length === 1 ? 'card' : 'cards'}`}
                aria-current={on ? 'location' : undefined}
                className={`stagesStageSeg${on ? ' isOn' : ''}`}
                style={{ '--stage-color': 'var(--text-link)' } as CSSProperties}
              >
                <span className="stagesStageSegName">{g.short}</span>
                <span className="stagesStageSegMeta">{g.cards.length}</span>
              </button>
            </Fragment>
          )
        })}
      </nav>
    </div>
  )
}
