/**
 * Dashboard → the trial-helper verdict (Try-out loop, PR 2 — to-dos/helper-tryout-loop).
 *
 * For anyone who could run a job a trial helper worked today: the card sits at the top of the
 * Dashboard once the helper has clocked out, until it is answered or skipped — through the next
 * morning. Today's answer stays so it can be changed. Renders nothing for anyone else. The push
 * a leader gets at the helper's clock-out opens here (`TRIAL_VERDICT_DEEP_LINK`).
 */
import { useEffect, useRef } from 'react'
import TrialVerdictCards from '../team-feedback/TrialVerdictCards'
import { dashboardTrialCards } from '../../lib/hiring/trialVerdicts'
import { canEverLeadTrialHelper, useTrialVerdictFeed } from '../../lib/hiring/useTrialVerdictFeed'

type Props = { authUserId: string | null | undefined; role: string | null }

export const TRIAL_VERDICT_SECTION_ID = 'trial-verdicts'

export default function DashboardTrialVerdictSection({ authUserId, role }: Props) {
  const enabled = !!authUserId && canEverLeadTrialHelper(role)
  const { cards, loaded, reload } = useTrialVerdictFeed({ enabled, includeOpen: false })
  const shown = dashboardTrialCards(cards)
  const ref = useRef<HTMLElement | null>(null)
  const hasCards = shown.length > 0

  // The push opens /dashboard#trial-verdicts; the section only exists once the feed answers.
  useEffect(() => {
    if (hasCards && typeof window !== 'undefined' && window.location.hash === `#${TRIAL_VERDICT_SECTION_ID}`) ref.current?.scrollIntoView?.({ block: 'start' })
  }, [hasCards])

  if (!enabled || !authUserId || !loaded || !hasCards) return null
  return (
    <section ref={ref} id={TRIAL_VERDICT_SECTION_ID} aria-label="Trial helpers" style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Trial helpers</h2>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>the office reads your answer by name · it decides who gets hired</span>
      </div>
      <div style={{ maxWidth: 520 }}>
        <TrialVerdictCards cards={shown} userId={authUserId} onSaved={() => void reload()} />
      </div>
    </section>
  )
}
