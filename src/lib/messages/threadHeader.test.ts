import { describe, expect, it } from 'vitest'
import { threadHeaderPlan, type ThreadHeaderFacts } from './threadHeader'

const greg = (over: Partial<ThreadHeaderFacts> = {}): ThreadHeaderFacts => ({
  folded: false,
  channels: [{ kind: 'email' }, { kind: 'phone' }, { kind: 'fax' }],
  reachChosen: null,
  unknown: false,
  stamps: true,
  ...over,
})

describe('the thread header is three rows across the width at a desk (v2.6505)', () => {
  it('draws who, the status with the sentence, and the jobs, at any height', () => {
    const plan = threadHeaderPlan(greg())
    expect(plan.rows).toEqual(['who', 'status', 'jobs'])
    expect(plan.stampsOneLine).toBe(true)
    expect(plan.jobsStrip).toBe(false)
  })

  it('puts the first address and the first number on the company line, the rest behind the arrow', () => {
    const plan = threadHeaderPlan(greg())
    expect(plan.onLine).toEqual([0, 1])
    expect(plan.behind).toBe(1)
    expect(plan.reachOpen).toBe(false)
    expect(threadHeaderPlan(greg({ channels: [{ kind: 'phone' }, { kind: 'email' }, { kind: 'phone' }] })).onLine).toEqual([1, 0])
  })

  it('draws no arrow when nothing waits behind the line', () => {
    const one = threadHeaderPlan(greg({ channels: [{ kind: 'email' }] }))
    expect(one.onLine).toEqual([0])
    expect(one.behind).toBe(0)
    expect(threadHeaderPlan(greg({ channels: [{ kind: 'email' }], reachChosen: true })).reachOpen).toBe(false)
    expect(threadHeaderPlan(greg({ channels: [] })).behind).toBe(0)
  })

  it('opens the reach row on the arrow’s press, closed until then', () => {
    expect(threadHeaderPlan(greg({ reachChosen: true })).rows).toEqual(['who', 'reach', 'status', 'jobs'])
    expect(threadHeaderPlan(greg({ reachChosen: false })).rows).toEqual(['who', 'status', 'jobs'])
  })

  it('gives an unnamed number its words and Who is this? in place of the arrow', () => {
    const plan = threadHeaderPlan(greg({ unknown: true, channels: [{ kind: 'phone' }], stamps: false }))
    expect(plan.onLine).toEqual([])
    expect(plan.behind).toBe(0)
    expect(plan.rows).toEqual(['who', 'status', 'jobs'])
  })
})

describe('a narrow column stacks the same facts (cut 10’s fold)', () => {
  it('cuts the company line to one, every number behind the arrow, the sentence on its own row, the jobs in a strip', () => {
    const plan = threadHeaderPlan(greg({ folded: true }))
    expect(plan.rows).toEqual(['who', 'status', 'stamps', 'jobs'])
    expect(plan.onLine).toEqual([])
    expect(plan.behind).toBe(3)
    expect(plan.stampsOneLine).toBe(false)
    expect(plan.jobsStrip).toBe(true)
    expect(threadHeaderPlan(greg({ folded: true, reachChosen: true })).rows).toEqual(['who', 'reach', 'status', 'stamps', 'jobs'])
  })

  it('leaves the sentence row out when there is no sentence', () => {
    expect(threadHeaderPlan(greg({ folded: true, stamps: false })).rows).toEqual(['who', 'status', 'jobs'])
  })
})
