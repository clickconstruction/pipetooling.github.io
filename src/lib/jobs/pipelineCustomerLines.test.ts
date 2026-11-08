import { describe, expect, it } from 'vitest'
import { pipelineCustomerLineRow, pipelineCustomerLinesByJob } from './pipelineCustomerLines'
import { lastLinesOnJob } from '../messages/customerDoor'

/** One wire row, as `pipeline_customer_lines` returns it. */
const row = (over: Record<string, unknown>): Record<string, unknown> => ({
  job_id: 'jl-1312',
  id: 'm-1',
  contact_id: 'c-dana',
  contact_kind: 'customer',
  contact_name: 'Dana Whitfield',
  contact_goes_by: null,
  channel: 'text',
  direction: 'in',
  at: '2026-10-06T23:15:00Z',
  who_user_id: null,
  who_text: '',
  who_name: null,
  subject: null,
  body: 'Can you do Thursday after 10 instead?',
  duration_seconds: null,
  summary: null,
  transcript: null,
  delivery: null,
  auto: false,
  tied: true,
  ...over,
})

describe('pipelineCustomerLinesByJob', () => {
  it('folds the rows into one list per job, oldest first, as Job activity reads a line', () => {
    const byJob = pipelineCustomerLinesByJob([
      row({ id: 'm-3' }),
      row({ id: 'm-2', direction: 'out', who_user_id: 'u-tanya', who_name: 'Tanya Ortiz', at: '2026-10-06T21:40:00Z', body: 'Dana, the city set your inspection for Thursday 8 to 10.' }),
      row({ id: 'm-9', job_id: 'jl-1298', contact_id: 'c-hector', contact_name: 'Hector Ruiz', channel: 'call', direction: 'in', at: '2026-10-06T20:00:00Z', duration_seconds: 192, summary: 'Trencher free Thursday.', body: 'Call.' }),
    ])
    expect([...byJob.keys()].sort()).toEqual(['jl-1298', 'jl-1312'])
    const dana = byJob.get('jl-1312')!
    expect(dana.map((m) => m.id)).toEqual(['m-2', 'm-3'])
    expect(dana[0]).toMatchObject({ direction: 'out', who: 'Tanya Ortiz', tied: true, contact: { name: 'Dana Whitfield', kind: 'customer' } })
    expect(dana[1]).toMatchObject({ direction: 'in', channel: 'text', body: 'Can you do Thursday after 10 instead?' })
    expect(byJob.get('jl-1298')![0]).toMatchObject({ channel: 'call', durationSeconds: 192, summary: 'Trencher free Thursday.' })
  })

  it('keeps an untied line of the customer and marks it not tied', () => {
    const byJob = pipelineCustomerLinesByJob([row({ tied: false })])
    expect(byJob.get('jl-1312')![0]!.tied).toBe(false)
  })

  it('reads as the sheet does: the same three lines, newest last', () => {
    const rows = ['m-4', 'm-3', 'm-2'].map((id, i) => row({ id, at: `2026-10-0${6 - i}T12:00:00Z` }))
    const lines = pipelineCustomerLinesByJob(rows).get('jl-1312')!
    expect(lastLinesOnJob(lines).map((l) => l.id)).toEqual(['m-2', 'm-3', 'm-4'])
  })

  it('drops a row that is not a row, and a channel this build does not know', () => {
    expect(pipelineCustomerLinesByJob([null, 'x', row({ channel: 'carrier-pigeon' })]).size).toBe(0)
    expect(pipelineCustomerLineRow({ job_id: 'j' })).toBeNull()
  })
})
