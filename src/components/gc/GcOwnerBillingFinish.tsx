import { useState, type Dispatch } from 'react'
import { Btn, Card, Chip, input } from './gcUi'
import { money, ownerFinishRisk, shortDate, type GcAction, type GcProject, type GcState } from '../../lib/gcMode/gcModel'

/**
 * GC mode design spike: the finish date against the owner contract, on Bill the owner (owner's
 * go-ahead 2026-10-04). The contract's day beside the schedule's, the days to spare or past, and
 * what finishing late costs at the contract's fee a day, which we enter from the owner contract.
 */
export function GcOwnerBillingFinish({ state, project, dispatch }: { state: GcState; project: GcProject; dispatch: Dispatch<GcAction> }) {
  const f = ownerFinishRisk(state, project)
  const [open, setOpen] = useState(false)
  const [fee, setFee] = useState(String(f.perDay ?? ''))
  const feeNum = Number(fee)
  const ready = Number.isFinite(feeNum) && feeNum > 0
  if (!f.contract && !f.schedule) return null
  const days = (n: number) => (n === 1 ? '1 day' : `${n} days`)
  const tone = f.past === null ? 'grey' : f.past > 0 ? 'red' : f.past === 0 ? 'amber' : 'green'
  const status =
    f.past === null ? null : f.past > 0 ? `${days(f.past)} past the contract` : f.past === 0 ? 'no days to spare' : `${days(-f.past)} to spare`
  const save = (value: number | null) => {
    dispatch({ type: 'setOwnerLateFinish', projectId: project.id, perDay: value })
    setOpen(false)
  }

  return (
    <Card>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <strong style={{ fontSize: '1.05rem' }}>Finish date</strong>
        {status && <Chip tone={tone}>{status}</Chip>}
        {f.atRisk > 0 && <Chip tone="red">{`${money(f.atRisk)} at risk`}</Chip>}
      </div>
      <div style={{ display: 'grid', gap: '0.25rem', fontSize: '0.875rem', marginTop: '0.35rem' }}>
        {f.contract && (
          <div>
            The contract with {project.owner} says substantial completion by {shortDate(f.contract.on)}
            {f.contract.days > 0 ? `: ${shortDate(f.contract.planned)}, plus ${days(f.contract.days)} by signed change orders.` : '.'}
          </div>
        )}
        {f.schedule ? (
          <div>
            {f.schedule.from === 'pace'
              ? `At today's pace the schedule finishes ${shortDate(f.schedule.on)}. The work runs ${days(f.schedule.behind)} behind the plan.`
              : `The schedule finishes ${shortDate(f.schedule.on)}${f.schedule.behind > 0 ? `, with the work ${days(f.schedule.behind)} behind the plan` : ''}.`}
          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)' }}>No schedule is drawn yet, so there is no finish to compare.</div>
        )}
        {f.past !== null && f.past > 0 && (
          <div style={{ color: 'var(--text-red-700)' }}>
            {f.perDay
              ? `At ${money(f.perDay)} a day, finishing ${days(f.past)} late costs ${money(f.atRisk)}.`
              : `That is ${days(f.past)} late. Enter the contract's late fee to see what it costs.`}{' '}
            If {project.owner} caused the delay, a change order with the days moves the contract date.
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.5rem', fontSize: '0.85rem' }}>
        <span style={{ color: 'var(--text-muted)' }}>
          {f.perDay ? `The contract's late fee: ${money(f.perDay)} a day.` : 'No late fee entered from the contract.'}
        </span>
        {!open && (
          <Btn kind="quiet" onClick={() => setOpen(true)}>
            {f.perDay ? 'Change' : 'Enter the late fee'}
          </Btn>
        )}
      </div>
      {open && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.4rem', fontSize: '0.875rem' }}>
          <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
            $
            <input style={{ ...input, width: '6rem' }} type="number" min={1} value={fee} onChange={(e) => setFee(e.target.value)} placeholder="500" />a day
          </label>
          <Btn kind="primary" disabled={!ready} onClick={() => save(feeNum)}>
            Save
          </Btn>
          {f.perDay !== null && <Btn onClick={() => save(null)}>The contract has none</Btn>}
          <Btn kind="quiet" onClick={() => setOpen(false)}>
            Cancel
          </Btn>
        </div>
      )}
    </Card>
  )
}
