import { describe, expect, it } from 'vitest'
import { followUpTeamOf } from './team'

describe('followUpTeamOf', () => {
  it('lists the office team with a name, by name, and never a superintendent', () => {
    const team = [
      { id: 'u2', name: 'Rosa', role: 'assistant' },
      { id: 's1', name: 'Sam', role: 'superintendent' },
      { id: 'u1', name: 'Robert', role: 'estimator' },
      { id: 'u3', name: ' ', role: 'controller' },
      { id: 'u4', name: 'Owner', role: 'master_technician' },
    ]
    expect(followUpTeamOf(team).map((t) => t.name)).toEqual(['Owner', 'Robert', 'Rosa'])
  })
})
