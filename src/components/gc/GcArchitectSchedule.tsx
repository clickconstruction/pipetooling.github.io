/**
 * GC mode design spike: the schedule in the architect's portal, the Gantt's Phase 3 (G-95). The
 * customer's picture, the stages of the job against the finish, then what waits on the architect:
 * the submittals and questions in their hands, each with the work it holds and the day we need it
 * back. Drawn on the portal's paper, in the light theme.
 */
import type { GcProject, GcState } from '../../lib/gcMode/gcModel'
import { shortDate, weekdayDate } from '../../lib/gcMode/gcModel'
import { customerStages, customerStanding } from '../../lib/gcMode/gcCustomerSchedule'
import { architectWaits, architectWaitsWords } from '../../lib/gcMode/gcArchitectSchedule'
import { PortalBlock } from './GcPortalUi'

export function GcArchitectSchedule({ state, project }: { state: GcState; project: GcProject }) {
  const stages = customerStages(state, project)
  if (stages.length === 0) return null
  const standing = customerStanding(state, project)
  const waits = architectWaits(state, project)
  const STATE_WORDS = { done: 'done', underway: 'under way', behind: 'behind', notStarted: 'not started' } as const
  return (
    <PortalBlock title={waits.length > 0 ? `The schedule · ${waits.length} on you` : 'The schedule'}>
      <div style={{ display: 'grid', gap: '0.6rem', fontSize: '0.875rem' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{standing.finishWords}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(8rem, 12rem) auto minmax(0, 1fr)', gap: '0.2rem 0.6rem', alignItems: 'baseline' }}>
          {stages.map((s) => (
            <div key={s.key} style={{ display: 'contents' }}>
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</span>
              <span style={{ color: s.state === 'behind' ? 'var(--text-amber-800)' : s.state === 'done' ? 'var(--text-green-800)' : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {STATE_WORDS[s.state]}
                {s.state !== 'done' && s.state !== 'notStarted' ? `, ${Math.round(s.pct)}%` : ''}
              </span>
              <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {shortDate(s.start)} to {shortDate(s.finish)}
              </span>
            </div>
          ))}
        </div>
        <div>
          <strong>{architectWaitsWords(waits) ?? 'Nothing on the schedule waits on you.'}</strong>
          {waits.map((w) => (
            <div key={`${w.kind}:${w.label}`} style={{ marginTop: '0.3rem', display: 'grid', gap: '0.1rem' }}>
              <span style={{ fontWeight: 600, color: w.late ? 'var(--text-red-700)' : undefined }}>
                {w.label}
                {w.neededBy ? ` · by ${weekdayDate(w.neededBy)}` : ''}
              </span>
              <span style={{ color: 'var(--text-muted)' }}>{w.words}</span>
            </div>
          ))}
        </div>
      </div>
    </PortalBlock>
  )
}
