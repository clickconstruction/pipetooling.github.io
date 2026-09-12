import { useStagesCrewModalOpener } from '../../contexts/StagesCrewModalContext'
import { splitStagesCrew, stagesCrewArchivedTail } from '../../lib/jobs/stagesCrew'
import type { JobWithDetails } from '../../types/jobWithDetails'

/**
 * The Crew & Dates cell's names (v2.3373): live accounts by name, archived ones
 * folded into "and N archived". The whole line is one button that opens the
 * crew modal — everyone who has been on the job, with hours, days and last day.
 */
export function StagesCrewLine({ job }: { job: JobWithDetails }) {
  const open = useStagesCrewModalOpener()
  const split = splitStagesCrew(job.team_members)
  const tail = stagesCrewArchivedTail(split)
  if (split.active.length === 0 && !tail) return <div>—</div>
  const body = (
    <>
      {split.active.join(', ')}
      {tail ? (
        <>
          {split.active.length > 0 ? ', ' : ''}
          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{tail}</span>
        </>
      ) : null}
    </>
  )
  if (!open) return <div>{body}</div>
  return (
    <div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          open(job)
        }}
        title="Everyone who has been on this job, with their hours"
        aria-label={`Crew on ${(job.job_name ?? '').trim() || 'this job'} — open hours by person`}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          margin: 0,
          font: 'inherit',
          color: 'inherit',
          textAlign: 'left',
          cursor: 'pointer',
          textDecorationLine: 'underline',
          textDecorationStyle: 'dotted',
          textDecorationColor: 'var(--text-faint)',
          textUnderlineOffset: 3,
        }}
      >
        {body}
      </button>
    </div>
  )
}
