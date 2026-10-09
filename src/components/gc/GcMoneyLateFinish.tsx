import { Card } from './gcUi'
import { allJobsMoney } from '../../lib/gc/ownerBilling'
import { ownerFinishRisk, ownerFinishWords } from '../../lib/gc/ownerBillingFinish'
import { lateFinish } from '../../lib/gc/lateFinish'
import type { GcState } from '../../lib/gc/types'
import { money } from '../../lib/gc/words'

/**
 * GC mode, the real build, Owner Billing's O6b-3: the late finish on the Money lens. Each job we build: the finish that
 * counts against the contract (the day we reached substantial completion once Building has it, the schedule's
 * projected finish until then) and, at the contract's late fee, what the days past cost and whose they are. The jobs'
 * schedules are read beside the money when the lens opens; a job with none says so in one line. Read only.
 */
export function GcMoneyLateFinish({ state, schedulesRead }: { state: GcState; schedulesRead: boolean }) {
  const jobs = allJobsMoney(state).jobs
  return (
    <Card>
      <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.4rem' }}>The late finish</div>
      {!schedulesRead ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Reading the jobs&rsquo; schedules…</div>
      ) : (
        <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.875rem' }}>
          {jobs.map(({ project }) => {
            const risk = ownerFinishRisk(state, project)
            const late = lateFinish(state, project)
            return (
              <div key={project.id} style={{ borderTop: '1px solid var(--border)', paddingTop: '0.4rem', display: 'grid', gap: '0.15rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <strong style={{ flex: 1, minWidth: 0 }}>{project.name}</strong>
                  <span style={{ color: 'var(--text-muted)' }}>{risk.perDay ? `${money(risk.perDay)} a day` : 'no late fee'}</span>
                  {late.atRisk ? <strong style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-red-700)' }}>{money(late.atRisk)}</strong> : null}
                </div>
                <div style={{ color: 'var(--text-muted)' }}>{project.schedule ? ownerFinishWords(risk) : 'No schedule yet.'}</div>
                {project.schedule && risk.perDay
                  ? late.words.map((w) => (
                      <div key={w} style={{ color: 'var(--text-muted)' }}>
                        {w}
                      </div>
                    ))
                  : null}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
