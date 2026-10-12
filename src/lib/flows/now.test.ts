import { describe, expect, it } from 'vitest'
import { demoPeople, demoPerson } from './demoPeople.fixture'
import { flowNowOf } from './now'
import { flowPanel } from './panel'

describe('flowNowOf: where a person is on their flow, in a line', () => {
  it('Greg: the ask on his default job, their move, and what finishes it', () => {
    const greg = demoPerson('greg')
    const now = flowNowOf(greg)
    expect(now).toMatchObject({ stepId: 'ask', jobId: greg.reading.nowJobId, stepName: 'Asked to quote', who: 'them', finishes: 'their quote is in the portal or they declined to quote' })
    expect(now?.sinceYmd).toMatch(/^2026-\d\d-\d\d$/)
  })

  it('says whose move it is as the panel does, waiting on someone else included', () => {
    const people = demoPeople()
    for (const p of people) {
      const now = flowNowOf(p)
      if (!now) continue
      const box = flowPanel(p, now.jobId, people).lanes.flatMap((l) => l.boxes).find((b) => b.stepId === now.stepId && b.jobId === now.jobId)
      expect(`${p.id}: ${now.who}`).toBe(`${p.id}: ${box?.move}`)
    }
    expect(flowNowOf(demoPerson('elena'))?.who).toBe('wait')
  })

  it('has nothing on now for someone off the flow', () => {
    const greg = demoPerson('greg')
    expect(flowNowOf({ ...greg, reading: { ...greg.reading, off: { since: '2026-10-01', why: 'Closed the business.', by: null }, nowStepId: null, nowJobId: null } })).toBeNull()
  })
})
