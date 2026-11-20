import { describe, expect, it } from 'vitest'
import { marketJobs, type MarketPermit } from './permitMarket'

/** Every name, address and number here is made up. */
function permit(over: Partial<MarketPermit> = {}): MarketPermit {
  return { builder_key: 'ridgewaybuilders', stage: 'issued', work_type: 'Commercial remodel', submitted_on: null, issued_on: '2026-10-20', declared_value: null, address_key: '100 sample pkwy', ...over }
}

describe('marketJobs', () => {
  it('counts an application and its permit as one job, issued, with the permit’s kind of work', () => {
    // The city writes the permit’s issued day on the application once the permit is out.
    const application = permit({ stage: 'applied', work_type: 'Commercial project', submitted_on: '2026-08-01', declared_value: 400_000 })
    const issued = permit({ declared_value: 450_000 })
    for (const rows of [[application, issued], [issued, application]]) {
      expect(marketJobs(rows)).toEqual([{ builder_key: 'ridgewaybuilders', stage: 'issued', work_type: 'Commercial remodel', submitted_on: '2026-08-01', issued_on: '2026-10-20', declared_value: 450_000, address_key: '100 sample pkwy' }])
    }
  })

  it('counts the buildings of one project, filed on one day at one address, as one job with its value once', () => {
    const rows = [...Array.from({ length: 10 }, () => permit({ work_type: 'New commercial', declared_value: 1_800_000 })), permit({ work_type: 'Commercial site work', declared_value: 1_800_000 })]
    expect(marketJobs(rows)).toEqual([permit({ work_type: 'New commercial', declared_value: 1_800_000 })])
  })

  it('keeps jobs apart by the name, the day and the address', () => {
    const rows = [permit(), permit({ builder_key: 'asterridgecontracting' }), permit({ issued_on: '2026-10-21' }), permit({ address_key: '7 elm st' })]
    expect(marketJobs(rows)).toHaveLength(4)
  })

  it('keeps an application still waiting apart from a permit of another day', () => {
    const waiting = permit({ stage: 'applied', work_type: 'Commercial project', submitted_on: '2026-10-20', issued_on: null })
    const later = permit({ issued_on: '2026-11-02' })
    expect(marketJobs([waiting, later])).toEqual([waiting, later])
    // Two applications of one day at one address are one job, still applied for.
    expect(marketJobs([waiting, waiting])).toEqual([waiting])
  })

  it('leaves a row with no day or no address a job by itself', () => {
    const noAddress = permit({ address_key: null })
    const noDay = permit({ issued_on: null })
    expect(marketJobs([noAddress, noAddress, noDay, noDay])).toHaveLength(4)
  })

  it('folds the rows of no name at one address, and returns nothing for nothing', () => {
    expect(marketJobs([permit({ builder_key: null }), permit({ builder_key: null })])).toHaveLength(1)
    expect(marketJobs([])).toEqual([])
  })
})
