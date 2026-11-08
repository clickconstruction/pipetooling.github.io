import { describe, expect, it } from 'vitest'
import type { JobModeScheduleBlock } from '../jobModePickCurrentNext'
import { formatJobLedgerNumberLabel } from '../ledgerDisplayPrefixes'
import { fillScheduledJobLabels, scheduledJobReadCameBackEmpty } from './scheduledJobLabels'

const empty = (id: string, job_id: string): JobModeScheduleBlock => ({
  id,
  job_id,
  time_start: '08:00',
  time_end: '12:00',
  hcp_number: null,
  click_number: null,
  job_name: null,
  job_address: null,
  service_type_id: null,
})

const read = (id: string, job_id: string): JobModeScheduleBlock => ({
  ...empty(id, job_id),
  hcp_number: '512',
  job_name: 'Ridgeway Builders',
  job_address: '1407 Cedar Bend Dr',
  service_type_id: 'st-plumb',
})

describe('scheduledJobReadCameBackEmpty', () => {
  it('is true only when the visit has no number, no name and no address', () => {
    expect(scheduledJobReadCameBackEmpty(empty('b1', 'job-a'))).toBe(true)
    expect(scheduledJobReadCameBackEmpty({ ...empty('b1', 'job-a'), hcp_number: '  ' })).toBe(true)
    expect(scheduledJobReadCameBackEmpty({ ...empty('b1', 'job-a'), click_number: '1113' })).toBe(false)
    expect(scheduledJobReadCameBackEmpty({ ...empty('b1', 'job-a'), job_name: 'Ridgeway Builders' })).toBe(false)
    expect(scheduledJobReadCameBackEmpty({ ...empty('b1', 'job-a'), job_address: '1407 Cedar Bend Dr' })).toBe(false)
  })
})

describe('fillScheduledJobLabels', () => {
  it('fills a visit whose job read came back empty from the job the Dashboard knows, so the card draws a number and an address', () => {
    // The team read folds the click number into hcp_number when the HCP is empty, and carries the click number too.
    const known = [{ id: 'job-a', hcp_number: '1113', click_number: '1113', job_name: 'Harbor Lane Offices', job_address: '100 Harbor Ln, San Antonio, TX', service_type_id: 'st-plumb' }]
    const [b] = fillScheduledJobLabels([empty('b1', 'job-a')], known)
    expect(b).toMatchObject({ hcp_number: '1113', click_number: '1113', job_name: 'Harbor Lane Offices', job_address: '100 Harbor Ln, San Antonio, TX', service_type_id: 'st-plumb' })
    expect(formatJobLedgerNumberLabel('J', b!.hcp_number, b!.click_number)).toBe('J1113')
    // Before the fill the same visit drew the blank this fixes.
    expect(formatJobLedgerNumberLabel('J', null, null)).toBe('J—')
  })

  it('takes a superintendent project job, which carries no trade, and keeps the visit’s own fields', () => {
    const known = [{ id: 'job-b', hcp_number: '', click_number: '1110', job_name: 'Cedar Row', job_address: '12 Cedar Row' }]
    const [b] = fillScheduledJobLabels([empty('b2', 'job-b')], known)
    expect(b).toMatchObject({ hcp_number: '', click_number: '1110', job_name: 'Cedar Row', job_address: '12 Cedar Row', service_type_id: null })
    expect(formatJobLedgerNumberLabel('J', b!.hcp_number, b!.click_number)).toBe('J1110')
  })

  it('never replaces a visit its own read filled, and leaves an unknown job blank', () => {
    const known = [{ id: 'job-a', hcp_number: '999', job_name: 'Something else', job_address: 'Elsewhere' }]
    const blocks = [read('b1', 'job-a'), empty('b2', 'job-z')]
    const out = fillScheduledJobLabels(blocks, known)
    expect(out[0]).toBe(blocks[0])
    expect(out[1]).toBe(blocks[1])
  })

  it('hands back the same array when nothing changed, so a memo downstream holds', () => {
    const blocks = [read('b1', 'job-a')]
    expect(fillScheduledJobLabels(blocks, [{ id: 'job-a', hcp_number: '1' }])).toBe(blocks)
    expect(fillScheduledJobLabels(blocks, [])).toBe(blocks)
    expect(fillScheduledJobLabels(blocks, undefined)).toBe(blocks)
    const none: JobModeScheduleBlock[] = []
    expect(fillScheduledJobLabels(none, [{ id: 'job-a' }])).toBe(none)
  })

  it('takes the first known row for a job listed twice (team and project)', () => {
    const known = [
      { id: 'job-a', hcp_number: '1113', job_name: 'From the team read', job_address: 'A' },
      { id: 'job-a', hcp_number: '1113', job_name: 'From the project read', job_address: 'B' },
    ]
    expect(fillScheduledJobLabels([empty('b1', 'job-a')], known)[0]!.job_name).toBe('From the team read')
  })
})
