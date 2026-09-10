import { describe, expect, it } from 'vitest'
import { buildCustomerWaitingBanner, customerWaitingInboxHref, isInboxRoute, summarizeCustomerWaiting, type CustomerWaitingRow } from './customerWaiting'

const NOW = Date.parse('2026-09-10T19:14:00Z')
const minAgo = (m: number) => new Date(NOW - m * 60_000).toISOString()

function row(over: Partial<CustomerWaitingRow> & { id: string }): CustomerWaitingRow {
  return {
    inbox: 'dispatch',
    title: 'Customer waiting — Jane Doe asks for a visit: Water heater leaking',
    created_at: minAgo(14),
    reference_summary: null,
    pending_action: null,
    pending_payload: { source: 'portal', kind: 'visit', customerName: 'Jane Doe', description: 'Water heater in the garage is leaking, there is water on the floor and it is getting worse, can someone come today', phone: '5125550142' },
    last_called_at: null,
    last_called_by: null,
    ...over,
  }
}

describe('buildCustomerWaitingBanner', () => {
  it('null with nothing open; waiting state leads with the OLDEST uncalled row', () => {
    expect(buildCustomerWaitingBanner([], NOW)).toBeNull()
    const b = buildCustomerWaitingBanner([row({ id: 'new', created_at: minAgo(3) }), row({ id: 'old', created_at: minAgo(41) })], NOW)
    expect(b?.state).toBe('waiting')
    expect(b?.lead.id).toBe('old')
    expect(b?.leadName).toBe('Jane Doe')
    expect(b?.leadKind).toBe('asks for a visit')
    expect(b?.leadPhone).toBe('5125550142')
    expect(b?.wait).toMatchObject({ minutes: 41, red: true })
    expect(b?.others).toBe(1)
    expect(b?.snippet).toBe('Water heater in the garage is leaking, there is water on the floor and it is getting wors…')
  })

  it('once every open row has been called the banner calms: most recent call leads, "<who> called <name> <time>"', () => {
    const b = buildCustomerWaitingBanner(
      [
        row({ id: 'a', last_called_at: minAgo(30), last_called_by: { name: 'Taunya M' } }),
        row({ id: 'b', last_called_at: minAgo(5), last_called_by: { name: 'Sam Rivera' } }),
      ],
      NOW,
      'UTC',
    )
    expect(b?.state).toBe('called')
    expect(b?.lead.id).toBe('b')
    expect(b?.calledLine).toBe('Sam called Jane Doe 7:09 pm')
    expect(b?.wait).toBeNull()
    expect(b?.waitingCount).toBe(0)
    expect(b?.calledCount).toBe(2)
  })

  it('one uncalled row outranks any number of called ones', () => {
    const b = buildCustomerWaitingBanner([row({ id: 'c', last_called_at: minAgo(1), last_called_by: { name: 'Sam' } }), row({ id: 'w', created_at: minAgo(2) })], NOW)
    expect(b?.state).toBe('waiting')
    expect(b?.lead.id).toBe('w')
  })

  it('a GC stage ask reads as "asks for other dates" under the GC name', () => {
    const b = buildCustomerWaitingBanner(
      [row({ id: 'g', pending_action: 'gc_stage_ask', pending_payload: { source: 'customer_portal', kind: 'gc_stage_ask', gcName: 'Knight Contracting', start: '2026-09-15', end: '2026-09-17', note: 'framing slipped' } })],
      NOW,
    )
    expect(b?.leadName).toBe('Knight Contracting')
    expect(b?.leadKind).toBe('asks for other dates')
    expect(b?.snippet).toBe('framing slipped')
  })
})

describe('summarizeCustomerWaiting / hrefs', () => {
  it('counts, uncalled, the oldest wait and the lead name; null when empty', () => {
    expect(summarizeCustomerWaiting([], NOW)).toBeNull()
    expect(summarizeCustomerWaiting([row({ id: 'a', created_at: minAgo(20) }), row({ id: 'b', last_called_at: minAgo(1), last_called_by: { name: 'Sam' } })], NOW)).toEqual({
      count: 2,
      uncalled: 1,
      oldestMinutes: 20,
      leadName: 'Jane Doe',
    })
  })
  it('Dispatch Mode users open the Inbox tab; everyone else the Dashboard card; the inbox route collapses the banner', () => {
    expect(customerWaitingInboxHref(true)).toBe('/dispatch-mode/inbox')
    expect(customerWaitingInboxHref(false)).toBe('/dashboard#dash-teams-inbox')
    expect(isInboxRoute('/dispatch-mode/inbox')).toBe(true)
    expect(isInboxRoute('/dispatch-mode/schedule')).toBe(false)
    expect(isInboxRoute('/dashboard')).toBe(false)
  })
})
