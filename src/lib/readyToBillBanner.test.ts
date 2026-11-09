import { describe, expect, it } from 'vitest'
import { canRoleSeeReadyToBillBanner, readyToBillBannerCount, readyToBillBannerLabel } from './readyToBillBanner'
import { summarizeContractNudge } from './jobs/jobContractNudge'
import { hidesZzTestJobs, withoutZzTestJobs } from './jobs/zzTestJobVisibility'

describe('canRoleSeeReadyToBillBanner', () => {
  it('is assistants only', () => {
    expect(canRoleSeeReadyToBillBanner('assistant')).toBe(true)
    for (const r of ['dev', 'master_technician', 'controller', 'subcontractor', 'helpers', 'estimator', 'primary', 'superintendent', null]) {
      expect(canRoleSeeReadyToBillBanner(r)).toBe(false)
    }
  })
})

describe('readyToBillBannerLabel', () => {
  it('counts with verb copy, singular flips, zero hides', () => {
    expect(readyToBillBannerLabel(3)).toBe('3 ready to bill — send them')
    expect(readyToBillBannerLabel(1)).toBe('1 ready to bill — send it')
    expect(readyToBillBannerLabel(0)).toBeNull()
    expect(readyToBillBannerLabel(null)).toBeNull()
  })
})

describe('readyToBillBannerCount', () => {
  const rows = [
    { job_name: 'Locks', customer_name: 'A Customer' },
    { job_name: 'ZZ TEST dispute walk', customer_name: 'A Tester' },
    { job_name: 'Water heater', customer_name: 'ZZ Test Customer' },
  ]

  it('drops ZZ test jobs when the board hides them, by the job name or the customer name', () => {
    expect(readyToBillBannerCount(rows, true)).toBe(1)
    expect(readyToBillBannerCount(rows, false)).toBe(3)
    expect(readyToBillBannerCount([], true)).toBe(0)
  })
})

// v2.6805: the banner, the Get contracts signed card and the Ready to Bill section read the stage three
// ways. One ZZ test job in the stage made the first two say 2 over a section of 1. This holds them equal.
describe('the three Ready to Bill counts share the ZZ rule', () => {
  const NOW = new Date('2026-11-09T18:00:00Z')
  const stage = [
    { id: 'real', bid_id: null, status: 'ready_to_bill', revenue: 215, job_name: 'Locks', customer_name: 'A Customer' },
    { id: 'zz', bid_id: null, status: 'ready_to_bill', revenue: 7, job_name: 'ZZ TEST dispute walk', customer_name: 'A Tester' },
    { id: 'work', bid_id: null, status: 'working', revenue: 900, job_name: 'Repipe', customer_name: 'B Customer' },
  ]
  const readyToBill = stage.filter((j) => j.status === 'ready_to_bill')

  for (const [who, role, devShowsZz] of [
    ['an assistant', 'assistant', false],
    ['a dev who hides them', 'dev', false],
    ['a dev who shows them', 'dev', true],
  ] as const) {
    it(`for ${who}, the banner and the card's stage count equal the section's rows`, () => {
      const hide = hidesZzTestJobs(role, devShowsZz)
      // The section: the jobs cache hands the board its rows without ZZ jobs when they are hidden.
      const section = (hide ? withoutZzTestJobs(stage) : stage).filter((j) => j.status === 'ready_to_bill')
      const card = summarizeContractNudge(stage, [], [], NOW, { hideZzTestJobs: hide }).byStage.ready_to_bill
      expect(readyToBillBannerCount(readyToBill, hide)).toBe(section.length)
      expect(card.total).toBe(section.length)
      expect(card.missing).toBe(section.length)
      expect(card.revenueMissing).toBe(section.reduce((sum, j) => sum + j.revenue, 0))
      expect(section.length).toBe(devShowsZz ? 2 : 1)
    })
  }
})
