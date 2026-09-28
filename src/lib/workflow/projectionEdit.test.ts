import { describe, expect, it } from 'vitest'
import {
  nextProjectionSequence,
  projectionAnchorFields,
  projectionSaveProblem,
  projectionWriteFields,
  seedEditingProjection,
} from './projectionEdit'

const saved = { id: 'p1', stage_name: 'Rough', memo: 'draw 1', amount: 42000, step_id: 's2', placement: 'before' }

describe('seedEditingProjection', () => {
  it('opens an existing projection on its own fields', () => {
    expect(seedEditingProjection(saved)).toEqual({
      item: saved,
      stage_name: 'Rough',
      memo: 'draw 1',
      amount: '42000',
      step_id: 's2',
      placement: 'before',
    })
  })

  it('opens a new projection blank, unattached, placed after', () => {
    expect(seedEditingProjection(null)).toEqual({
      item: null,
      stage_name: '',
      memo: '',
      amount: '',
      step_id: '',
      placement: 'after',
    })
  })

  it('attaches a new projection to the step and side the opener names', () => {
    expect(seedEditingProjection(null, { step_id: 's3', placement: 'before' })).toMatchObject({
      step_id: 's3',
      placement: 'before',
    })
    expect(seedEditingProjection(null, { step_id: 's3' })).toMatchObject({ step_id: 's3', placement: 'after' })
  })

  it('keeps an existing projection’s own step over the opener’s', () => {
    expect(seedEditingProjection(saved, { step_id: 's9', placement: 'after' })).toMatchObject({
      step_id: 's2',
      placement: 'before',
    })
  })

  it('an unattached projection takes the opener’s step, and its side when its own is not "before"', () => {
    const loose = { ...saved, step_id: null, placement: null }
    expect(seedEditingProjection(loose, { step_id: 's3', placement: 'before' })).toMatchObject({
      step_id: 's3',
      placement: 'before',
    })
    expect(seedEditingProjection(loose)).toMatchObject({ step_id: '', placement: 'after' })
  })

  it('reads any placement but "before" as after', () => {
    expect(seedEditingProjection({ ...saved, placement: 'after' }).placement).toBe('after')
    expect(seedEditingProjection({ ...saved, placement: 'sideways' }).placement).toBe('after')
  })

  it('opens the amount as the number prints — 0 as "0", cents and a minus sign kept, none as blank', () => {
    expect(seedEditingProjection({ ...saved, amount: 0 }).amount).toBe('0')
    expect(seedEditingProjection({ ...saved, amount: null }).amount).toBe('')
    expect(seedEditingProjection({ ...saved, amount: -1250.5 }).amount).toBe('-1250.5')
  })
})

describe('projectionSaveProblem', () => {
  it('lets a named, described projection through', () => {
    expect(projectionSaveProblem('Rough', 'draw 1')).toBeNull()
  })

  it('refuses a blank step name or a blank memo', () => {
    expect(projectionSaveProblem('  ', 'draw 1')).toBe('Step name and memo are required')
    expect(projectionSaveProblem('Rough', '')).toBe('Step name and memo are required')
  })
})

describe('projectionAnchorFields', () => {
  it('carries the step and its side when attached', () => {
    expect(projectionAnchorFields({ step_id: 's2', placement: 'before' })).toEqual({ step_id: 's2', placement: 'before' })
  })

  it('nulls both when not attached — a side means nothing without a step', () => {
    expect(projectionAnchorFields({ step_id: '', placement: 'before' })).toEqual({ step_id: null, placement: null })
    expect(projectionAnchorFields()).toEqual({ step_id: null, placement: null })
  })
})

describe('projectionWriteFields', () => {
  it('trims the words, parses the amount and carries the anchor', () => {
    expect(projectionWriteFields('  Rough ', ' draw 1 ', '42000.50', { step_id: 's2', placement: 'after' })).toEqual({
      stage_name: 'Rough',
      memo: 'draw 1',
      amount: 42000.5,
      step_id: 's2',
      placement: 'after',
    })
  })

  it('writes 0 for an amount it cannot read, and keeps a negative', () => {
    expect(projectionWriteFields('Rough', 'x', 'abc').amount).toBe(0)
    expect(projectionWriteFields('Rough', 'x', '').amount).toBe(0)
    expect(projectionWriteFields('Rough', 'x', '-500').amount).toBe(-500)
  })
})

describe('nextProjectionSequence', () => {
  it('is one past the highest in hand, and 1 for the first', () => {
    expect(nextProjectionSequence([{ sequence_order: 3 }, { sequence_order: 7 }, { sequence_order: 1 }])).toBe(8)
    expect(nextProjectionSequence([])).toBe(1)
  })
})
