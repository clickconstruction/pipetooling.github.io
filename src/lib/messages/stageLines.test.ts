import { describe, expect, it } from 'vitest'
import type { QuickReply } from '../quickReplies/kernel'
import { appLineFor, appLinesForStage, isAppLine, stageStepIds } from './stageLines'

const team = (id: string, stepId: string | null, text = 'The team’s words.'): QuickReply => ({ id, text, for: 'customer', stepId, scope: 'team', addedBy: 'rosa', addedAt: 1, removed: false, uses: {}, lastUsed: null })

describe('stageStepIds', () => {
  it('maps a Pipeline stage to the steps it speaks to, the reminder first on a billed job, and none for Waiting', () => {
    expect(stageStepIds('working')).toEqual(['working'])
    expect(stageStepIds('ready_to_bill')).toEqual(['done'])
    expect(stageStepIds('billed')).toEqual(['paid', 'billed'])
    expect(stageStepIds('paid')).toEqual(['paid'])
    expect(stageStepIds('waiting')).toEqual([])
    expect(stageStepIds(null)).toEqual([])
  })
})

describe('the app’s own lines for a stage', () => {
  it('stands in for a step the team has no line on, with the app’s words in both languages, and never for Paid', () => {
    const done = appLineFor('done')
    expect(done).toMatchObject({ id: 'app:done', for: 'customer', stepId: 'done', scope: 'team', addedBy: 'app' })
    expect(done?.text).toContain('The work on {job} is done.')
    expect(done?.textEs).toContain('El trabajo de {job} está terminado.')
    expect(appLineFor('paid')).toBeNull()
    expect(isAppLine(done!)).toBe(true)
    expect(isAppLine(team('q1', 'done'))).toBe(false)
  })

  it('yields only for the steps without a team line, in the stage’s order', () => {
    expect(appLinesForStage(['paid', 'billed'], []).map((q) => q.id)).toEqual(['app:billed'])
    expect(appLinesForStage(['paid', 'billed'], [team('q1', 'billed')]).map((q) => q.id)).toEqual([])
    expect(appLinesForStage(['working'], [team('q2', 'working')]).map((q) => q.id)).toEqual([])
    expect(appLinesForStage(['working'], [{ ...team('q2', 'working'), removed: true }]).map((q) => q.id)).toEqual(['app:working'])
    expect(appLinesForStage(['done'], [{ ...team('q3', 'done'), for: 'trade' }]).map((q) => q.id)).toEqual(['app:done'])
  })
})
