/**
 * Today's work on the crew's job window (punch list #355, v2.7376): the fourth section on a phone, after Who. The
 * open stage as a card with the job's bar, each stage's checklist as a press, then Plans and Materials on site as
 * folds that say what is in them beside their title. Before it the stage checklists sat under the photos, Plans
 * was the second fold at the foot, and materials had no door from this window at all.
 *
 * The window hands in the plans (its own section, with the words it reports) and which folds are open; this holds
 * the stage read and the site's read. A job with fewer than two stages draws no card, and a stage with no checklist
 * no press, so a service call's section is Plans and Materials on site alone.
 */
import { useMemo, type ReactNode } from 'react'
import { useJobStageRows } from '../../hooks/useJobStageRows'
import { useOnSiteJob, useOnSiteStoreVersion } from '../../hooks/useOnSiteStore'
import { CREW_FOLD_TITLES, crewMaterialsWords, crewStageCard, type CrewFoldKey } from '../../lib/jobs/jobWindowCrewPhone'
import { jobMaterialsSummaryFor } from '../../lib/materials/onSiteSummary'
import { JobStageChecklistStrip, type OpenStageChecklistAsk } from '../stageChecklists/JobStageChecklistStrip'
import JobWindowMaterialsPanel from './JobWindowMaterialsPanel'
import { PhoneFold, PhoneSectionTitle } from './JobWindowPhoneSections'

export function CrewTodaysWork({
  jobId,
  stageRev,
  plans,
  plansWords,
  plansUrl,
  openStage,
  foldsOpen,
  onToggleFold,
  onLeave,
}: {
  jobId: string
  /** Bumped when a report lands, so the card reads the stages again. */
  stageRev: number
  /** The window's Plans section, drawn inside its fold. */
  plans: ReactNode
  /** The current set in a few words, from the section's own read. */
  plansWords: string
  plansUrl: string | null | undefined
  openStage: OpenStageChecklistAsk | null
  foldsOpen: ReadonlySet<CrewFoldKey>
  onToggleFold: (key: CrewFoldKey) => void
  /** Called before the materials press leaves for the Tally, so the window closes first. */
  onLeave: () => void
}) {
  const stageRows = useJobStageRows(jobId, true, stageRev)
  const card = useMemo(() => crewStageCard(stageRows), [stageRows])
  const site = useOnSiteJob(jobId)
  const siteVersion = useOnSiteStoreVersion()
  // siteVersion: the store's reads are plain functions, so the sum is taken again when the store says it moved.
  const materialsWords = useMemo(() => {
    const sum = jobMaterialsSummaryFor(jobId, new Date())
    return crewMaterialsWords({ loaded: site.loaded, containers: sum.containers, lines: sum.onSiteLines })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, site.loaded, siteVersion])
  return (
    <div data-testid="crew-window-work">
      <PhoneSectionTitle>Today's work</PhoneSectionTitle>
      {card ? (
        <div data-testid="crew-window-stage" style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '0.6rem 0.75rem', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ minWidth: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-strong)', overflowWrap: 'anywhere' }}>{card.title}</span>
            <span style={{ marginLeft: 'auto', fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{card.pct}%</span>
          </div>
          <div style={{ marginTop: 2, fontSize: '0.8125rem', color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>{card.line}</div>
          <div role="progressbar" aria-label="The job by its stages" aria-valuemin={0} aria-valuemax={100} aria-valuenow={card.pct} style={{ marginTop: 8, height: 6, borderRadius: 999, background: 'var(--bg-subtle)', overflow: 'hidden' }}>
            <div style={{ width: `${card.pct}%`, height: '100%', borderRadius: 999, background: card.allDone ? '#16a34a' : '#2563eb' }} />
          </div>
        </div>
      ) : null}
      <div style={{ marginBottom: 6 }}>
        <JobStageChecklistStrip jobId={jobId} plansUrl={plansUrl ?? null} openStage={openStage} label={false} />
      </div>
      <PhoneFold title={CREW_FOLD_TITLES.plans} count={plansWords || undefined} open={foldsOpen.has('plans')} onToggle={() => onToggleFold('plans')}>
        {plans}
      </PhoneFold>
      <PhoneFold title={CREW_FOLD_TITLES.materials} count={materialsWords || undefined} open={foldsOpen.has('materials')} onToggle={() => onToggleFold('materials')}>
        <JobWindowMaterialsPanel jobId={jobId} door="tally" onBeforeNavigate={onLeave} />
      </PhoneFold>
    </div>
  )
}

export default CrewTodaysWork
