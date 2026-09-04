import { describe, expect, it } from 'vitest'
import { customerJourneys, findStep, firstRenderableStep } from './customerJourneys'
import { SAMPLE_TOKEN, SAMPLE_TOKEN_DONE } from './customerSample'

describe('customerJourneys (What customers see)', () => {
  const journeys = customerJourneys()
  it('three audiences, steps in the order they are met, ids unique', () => {
    expect(journeys.map((j) => j.id)).toEqual(['homeowner', 'gc', 'sub'])
    const ids = journeys.flatMap((j) => j.steps.map((s) => s.id))
    expect(new Set(ids).size).toBe(ids.length)
    expect(journeys[0]!.steps.map((s) => s.id).slice(0, 3)).toEqual(['estimate-email', 'estimate-page', 'estimate-thankyou'])
  })
  it('page steps open the real public routes with the sample tokens', () => {
    const pages = journeys.flatMap((j) => j.steps).filter((s) => s.render.kind === 'page')
    for (const s of pages) {
      const path = (s.render as { path: string }).path
      expect(path.startsWith('/')).toBe(true)
      expect(path.endsWith(`t=${SAMPLE_TOKEN}`) || path.endsWith(`t=${SAMPLE_TOKEN_DONE}`)).toBe(true)
    }
    expect(findStep(journeys, 'homeowner', 'estimate-thankyou')?.render).toEqual({ kind: 'page', path: `/estimate/accept?t=${SAMPLE_TOKEN_DONE}` })
  })
  it('every renderable step names what it reflects; external and soon steps carry a note', () => {
    for (const s of journeys.flatMap((j) => j.steps)) {
      if (s.render.kind === 'page' || s.render.kind === 'email') expect(s.reflects.length).toBeGreaterThan(0)
      else expect(s.render.note.length).toBeGreaterThan(10)
    }
  })
  it('lands on the estimate email first', () => {
    expect(firstRenderableStep(journeys)).toEqual({ journeyId: 'homeowner', stepId: 'estimate-email' })
    expect(findStep(journeys, 'sub', 'nope')).toBeNull()
  })
})
