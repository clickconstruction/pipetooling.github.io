import { describe, expect, it } from 'vitest'
import { initialGcState } from './gcFixture'
import { architectWaits, architectWaitsWords } from './gcArchitectSchedule'

/** Fair Oaks Shops, Building D, today Fri Oct 2 2026: the fire alarm drawings went to Marsh & Vale Sep 30; RFI-3 (the storefront) Sep 30. */
const job = () => {
  const state = initialGcState()
  return { state, project: state.projects.find((p) => p.id === 'fairoaksd')! }
}

describe("the architect's view (G-95)", () => {
  it('lists what is in their hands with the work it holds and the day we need it back, soonest first', () => {
    const { state, project } = job()
    const waits = architectWaits(state, project)
    expect(waits.map((w) => [w.kind, w.label.slice(0, 32), w.neededBy, w.late])).toEqual([
      ['rfi', 'RFI-003, A-201 shows the storefr', '2026-10-09', false],
      ['submittal', 'The fire alarm shop drawings', '2026-10-19', false],
    ])
    expect(waits[0]?.words).toBe('With you since Sep 30. It holds HVAC · Rooftop units, starting Mon Oct 12; we need it by Fri Oct 9.')
    expect(waits[1]?.words).toBe('With you since Sep 30. It holds Electrical · Fire alarm, starting Mon Nov 2; we need it by Mon Oct 19.')
    expect(architectWaitsWords(waits)).toBe('2 things wait on you.')
    expect(architectWaitsWords([])).toBeNull()
  })

  it('says when one is late', () => {
    const { state, project } = job()
    const late = architectWaits({ ...state, today: '2026-10-12' }, project)
    expect(late[0]?.late).toBe(true)
    expect(late[0]?.words).toMatch(/we needed it by Oct 9, 3 days ago\.$/)
    expect(architectWaitsWords(late)).toBe('2 things wait on you, 1 of them late.')
  })
})
