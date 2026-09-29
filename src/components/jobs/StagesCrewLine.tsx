import { useStagesCrewModalOpener } from '../../contexts/StagesCrewModalContext'
import { splitStagesCrew, stagesCrewLineParts } from '../../lib/jobs/stagesCrew'
import type { JobWithDetails } from '../../types/jobWithDetails'

/**
 * The Crew & Dates cell's names (v2.3373): live accounts by name, archived ones
 * folded into "and N archived". The whole line is one button that opens the
 * crew modal — everyone who has been on the job, with hours, days and last day.
 * Since v2.4128 it is one line: the first two live names and "+N" for the rest
 * (a five-person crew used to stack five lines in the cell); the modal lists everyone.
 */
export function StagesCrewLine({ job }: { job: JobWithDetails }) {
  const open = useStagesCrewModalOpener()
  const split = splitStagesCrew(job.team_members)
  const parts = stagesCrewLineParts(split)
  if (!parts) return <div>—</div>
  const everyone = [...split.active, ...split.archived].join(', ')
  const body = (
    <>
      {parts.shown.join(', ')}
      {parts.more > 0 ? <span style={{ color: 'var(--text-muted)' }}> +{parts.more}</span> : null}
      {parts.tail ? <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{parts.tail}</span> : null}
    </>
  )
  const oneLine = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' } as const
  if (!open) return <div style={oneLine} title={everyone}>{body}</div>
  return (
    <div style={oneLine}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          open(job)
        }}
        title={`${everyone} — everyone who has been on this job, with their hours`}
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
