/**
 * GC mode, the real build, the Board's B2b-vii: where How the stage is going's next step leads. The design spike's
 * project page had a tab for each; main's project card opens one of its windows or a part of the card instead. Pure,
 * so a test holds it to every `HealthTab`, and the page decides for each reader which it may open.
 */
import type { HealthTab } from './stageHealth'

/** A project card's windows and parts, as the strip's next step reaches them. */
export type HealthTarget = 'trades' | 'plans' | 'number' | 'bidTabs' | 'start' | 'submittals' | 'schedule' | 'log' | 'draws' | 'bill' | 'closeout'

const TARGET: Record<HealthTab, HealthTarget> = {
  packages: 'trades',
  contracts: 'trades',
  plans: 'plans',
  number: 'number',
  tabs: 'bidTabs',
  start: 'start',
  submittals: 'submittals',
  schedule: 'schedule',
  log: 'log',
  draws: 'draws',
  owner: 'bill',
  closeout: 'closeout',
}

export function healthTabTarget(tab: HealthTab): HealthTarget {
  return TARGET[tab]
}
