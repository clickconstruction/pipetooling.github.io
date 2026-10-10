/** Every next step How the stage is going can name leads to a part of main's project card (the Board's B2b-vii). */
import { describe, expect, it } from 'vitest'
import type { HealthTab } from './stageHealth'
import { healthTabTarget } from './stageHealthTargets'

const ALL: HealthTab[] = ['packages', 'plans', 'number', 'tabs', 'contracts', 'start', 'submittals', 'schedule', 'log', 'draws', 'owner', 'closeout']

describe('healthTabTarget', () => {
  it('leads every tab the strip can name somewhere on the card', () => {
    expect(Object.fromEntries(ALL.map((t) => [t, healthTabTarget(t)]))).toEqual({
      packages: 'trades',
      plans: 'plans',
      number: 'number',
      tabs: 'bidTabs',
      contracts: 'trades',
      start: 'start',
      submittals: 'submittals',
      schedule: 'schedule',
      log: 'log',
      draws: 'draws',
      owner: 'bill',
      closeout: 'closeout',
    })
  })
})
