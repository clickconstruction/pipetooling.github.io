import { describe, expect, it } from 'vitest'
import { planStepTransition } from './stepLifecycle'
import type { LifecycleStepInput } from './stepLifecycle'

const NOW = '2026-08-01T12:00:00.000Z'

function stepStub(overrides: Partial<LifecycleStepInput> & { id: string }): LifecycleStepInput {
  return { name: 'Rough In [Work]', status: 'pending', next_step_rejected_notice: null, ...overrides }
}

describe('planStepTransition start', () => {
  it('starts now when no explicit start time is given', () => {
    const plan = planStepTransition({ transition: 'start', step: stepStub({ id: 's1' }), nowIso: NOW })
    expect(plan.updates).toEqual([{ stepId: 's1', update: { started_at: NOW, status: 'in_progress' } }])
    expect(plan.actions).toEqual([{ stepId: 's1', actionType: 'started', notes: null }])
    expect(plan.notifications).toEqual([{ stepId: 's1', actionType: 'started' }])
  })

  it('uses the explicit start time when provided', () => {
    const plan = planStepTransition({
      transition: 'start',
      step: stepStub({ id: 's1' }),
      nowIso: NOW,
      startedAtIso: '2026-07-30T08:00:00.000Z',
    })
    expect(plan.updates[0]?.update).toEqual({ started_at: '2026-07-30T08:00:00.000Z', status: 'in_progress' })
  })
})

describe('planStepTransition complete/approve', () => {
  it('completes with ended_at and no cascade when the next step is not rejected', () => {
    const plan = planStepTransition({
      transition: 'complete',
      step: stepStub({ id: 's1', status: 'in_progress' }),
      nextStep: stepStub({ id: 's2', status: 'pending' }),
      nowIso: NOW,
    })
    expect(plan.updates).toEqual([{ stepId: 's1', update: { status: 'completed', ended_at: NOW } }])
    expect(plan.actions).toEqual([{ stepId: 's1', actionType: 'completed', notes: null }])
    expect(plan.notifications).toEqual([{ stepId: 's1', actionType: 'completed' }])
  })

  it('reopens a rejected next step and clears its own notice on complete', () => {
    const plan = planStepTransition({
      transition: 'complete',
      step: stepStub({ id: 's1', status: 'in_progress', next_step_rejected_notice: 'Top Out Walk' }),
      nextStep: stepStub({ id: 's2', status: 'rejected' }),
      nowIso: NOW,
    })
    expect(plan.updates).toEqual([
      { stepId: 's1', update: { status: 'completed', ended_at: NOW } },
      { stepId: 's1', update: { next_step_rejected_notice: null, next_step_rejection_reason: null } },
      { stepId: 's2', update: { status: 'pending', rejection_reason: null, ended_at: null } },
    ])
    expect(plan.actions).toEqual([
      { stepId: 's1', actionType: 'completed', notes: null },
      { stepId: 's2', actionType: 'reopened', notes: 'Previous step was re-completed' },
    ])
    expect(plan.notifications).toEqual([
      { stepId: 's1', actionType: 'completed' },
      { stepId: 's2', actionType: 'reopened' },
    ])
  })

  it('skips the notice-clear update when no notice is set on the completing step', () => {
    const plan = planStepTransition({
      transition: 'complete',
      step: stepStub({ id: 's1', status: 'in_progress' }),
      nextStep: stepStub({ id: 's2', status: 'rejected' }),
      nowIso: NOW,
    })
    expect(plan.updates).toHaveLength(2)
    expect(plan.updates[1]).toEqual({ stepId: 's2', update: { status: 'pending', rejection_reason: null, ended_at: null } })
  })

  it('approves with approver name/time and the re-approved cascade note', () => {
    const plan = planStepTransition({
      transition: 'approve',
      step: stepStub({ id: 's1', status: 'in_progress' }),
      nextStep: stepStub({ id: 's2', status: 'rejected' }),
      approvedByName: 'Robert',
      nowIso: NOW,
    })
    expect(plan.updates[0]).toEqual({
      stepId: 's1',
      update: { status: 'approved', ended_at: NOW, approved_by: 'Robert', approved_at: NOW },
    })
    expect(plan.actions[1]).toEqual({ stepId: 's2', actionType: 'reopened', notes: 'Previous step was re-approved' })
    expect(plan.notifications[0]).toEqual({ stepId: 's1', actionType: 'approved' })
  })
})

describe('planStepTransition reject', () => {
  it('rejects with the trimmed reason and reopens a completed previous step to in_progress', () => {
    const plan = planStepTransition({
      transition: 'reject',
      step: stepStub({ id: 's2', name: 'Rough In Walk', status: 'in_progress' }),
      prevStep: stepStub({ id: 's1', status: 'completed' }),
      reason: '  missing cleanouts  ',
      nowIso: NOW,
    })
    expect(plan.updates).toEqual([
      { stepId: 's2', update: { status: 'rejected', rejection_reason: 'missing cleanouts', ended_at: NOW } },
      {
        stepId: 's1',
        update: {
          status: 'in_progress',
          ended_at: null,
          approved_by: null,
          approved_at: null,
          next_step_rejected_notice: 'Rough In Walk',
          next_step_rejection_reason: 'missing cleanouts',
        },
      },
    ])
    expect(plan.actions).toEqual([
      { stepId: 's2', actionType: 'rejected', notes: 'missing cleanouts' },
      { stepId: 's1', actionType: 'reopened', notes: 'Next step "Rough In Walk" was rejected' },
    ])
    expect(plan.notifications).toEqual([
      { stepId: 's2', actionType: 'rejected', stepOverrides: { rejection_reason: 'missing cleanouts' } },
      { stepId: 's1', actionType: 'reopened' },
    ])
  })

  it('only stamps the notice on a previous step that is still pending or in progress', () => {
    const plan = planStepTransition({
      transition: 'reject',
      step: stepStub({ id: 's2', name: 'Rough In Walk', status: 'in_progress' }),
      prevStep: stepStub({ id: 's1', status: 'in_progress' }),
      reason: 'redo',
      nowIso: NOW,
    })
    expect(plan.updates[1]).toEqual({
      stepId: 's1',
      update: { next_step_rejected_notice: 'Rough In Walk', next_step_rejection_reason: 'redo' },
    })
    expect(plan.actions).toHaveLength(1)
    expect(plan.notifications).toHaveLength(1)
  })

  it('normalizes a blank reason to null and plans nothing extra without a previous step', () => {
    const plan = planStepTransition({
      transition: 'reject',
      step: stepStub({ id: 's1', status: 'in_progress' }),
      prevStep: null,
      reason: '   ',
      nowIso: NOW,
    })
    expect(plan.updates).toEqual([
      { stepId: 's1', update: { status: 'rejected', rejection_reason: null, ended_at: NOW } },
    ])
    expect(plan.notifications).toEqual([
      { stepId: 's1', actionType: 'rejected', stepOverrides: { rejection_reason: null } },
    ])
  })
})

describe('planStepTransition skip and reopen', () => {
  it('skips with the trimmed reason and plans NO notifications', () => {
    const plan = planStepTransition({
      transition: 'skip',
      step: stepStub({ id: 's1' }),
      reason: ' not relevant ',
      nowIso: NOW,
    })
    expect(plan.updates).toEqual([
      { stepId: 's1', update: { status: 'skipped', skipped_reason: 'not relevant', ended_at: NOW } },
    ])
    expect(plan.actions).toEqual([{ stepId: 's1', actionType: 'skipped', notes: 'not relevant' }])
    expect(plan.notifications).toEqual([])
  })

  it('reopen clears every terminal field back to a clean pending step', () => {
    const plan = planStepTransition({ transition: 'reopen', step: stepStub({ id: 's1', status: 'approved' }), nowIso: NOW })
    expect(plan.updates).toEqual([
      {
        stepId: 's1',
        update: {
          status: 'pending',
          ended_at: null,
          rejection_reason: null,
          skipped_reason: null,
          approved_by: null,
          approved_at: null,
          next_step_rejected_notice: null,
          next_step_rejection_reason: null,
        },
      },
    ])
    expect(plan.actions).toEqual([{ stepId: 's1', actionType: 'reopened', notes: null }])
    expect(plan.notifications).toEqual([{ stepId: 's1', actionType: 'reopened' }])
  })
})
