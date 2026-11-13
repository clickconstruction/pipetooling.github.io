import { describe, expect, it } from 'vitest'
import { buildCustomerWaitingBanner, canHideForMe, customerWaitingInboxHref, isInboxRoute, pruneHiddenIds, rowsVisibleToViewer, summarizeCustomerWaiting, waitsOnTheBanner, type CustomerWaitingRow } from './customerWaiting'

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
      [row({ id: 'g', pending_action: 'gc_stage_ask', pending_payload: { source: 'customer_portal', kind: 'gc_stage_ask', gcName: 'Kestrin Contracting', start: '2026-09-15', end: '2026-09-17', note: 'framing slipped' } })],
      NOW,
    )
    expect(b?.leadName).toBe('Kestrin Contracting')
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


describe('hide for me (v2.3524)', () => {
  const calledByMe = row({ id: 'mine', last_called_at: minAgo(5), last_called_by: { name: 'Robert' }, last_called_by_user_id: 'u-me' })
  const calledByOther = row({ id: 'theirs', last_called_at: minAgo(9), last_called_by: { name: 'Sam Rivera' }, last_called_by_user_id: 'u-sam' })
  const waiting = row({ id: 'w', created_at: minAgo(2) })

  it('is offered only on the called state, only to the caller', () => {
    expect(canHideForMe(buildCustomerWaitingBanner([calledByMe], NOW), 'u-me')).toBe(true)
    expect(canHideForMe(buildCustomerWaitingBanner([calledByMe], NOW), 'u-sam')).toBe(false)
    expect(canHideForMe(buildCustomerWaitingBanner([calledByOther], NOW), 'u-me')).toBe(false)
    expect(canHideForMe(buildCustomerWaitingBanner([calledByMe, waiting], NOW), 'u-me')).toBe(false) // someone is still waiting: the strip stays
    expect(canHideForMe(null, 'u-me')).toBe(false)
  })

  it('drops only this viewer\'s own hidden calls; the team and other callers are untouched', () => {
    const hidden = new Set(['mine', 'theirs'])
    expect(rowsVisibleToViewer([calledByMe, calledByOther], 'u-me', hidden).map((r) => r.id)).toEqual(['theirs'])
    expect(rowsVisibleToViewer([calledByMe, calledByOther], 'u-sam', hidden).map((r) => r.id)).toEqual(['mine'])
    expect(rowsVisibleToViewer([calledByMe, calledByOther], 'u-taunya', hidden).map((r) => r.id)).toEqual(['mine', 'theirs'])
    expect(rowsVisibleToViewer([calledByMe], null, hidden).map((r) => r.id)).toEqual(['mine'])
  })

  it('a hidden row that is called again by someone else, or is no longer called, comes back', () => {
    const recalled = { ...calledByMe, last_called_by_user_id: 'u-sam' }
    expect(rowsVisibleToViewer([recalled], 'u-me', new Set(['mine'])).length).toBe(1)
    const reopened = { ...calledByMe, last_called_at: null, last_called_by_user_id: null }
    expect(rowsVisibleToViewer([reopened], 'u-me', new Set(['mine'])).length).toBe(1)
  })

  it('prunes hidden ids to the rows still open and high', () => {
    expect(pruneHiddenIds(new Set(['mine', 'gone']), [calledByMe])).toEqual(['mine'])
    expect(pruneHiddenIds(new Set(), [calledByMe])).toEqual([])
  })
})

describe('a stage check stays off the banner and Needs You (v2.6466)', () => {
  const stageCheck = (over: Partial<CustomerWaitingRow> & { id: string }) =>
    row({
      title: "Trim Set · “Is the pan drain run to the hub?” · can't do it · JP1088 ZZ TEST Riders Walk",
      reference_summary: 'JP1088 · ZZ TEST Riders Walk',
      pending_action: 'stage_check',
      pending_payload: { stage_check: { fixture_id: 'f3', question_id: 't3', reason: 'cant_do', stage_name: 'Trim Set' } },
      ...over,
    })

  it('is a customer\'s banner: a stage check never waits on it', () => {
    expect(waitsOnTheBanner({ pending_action: 'stage_check' })).toBe(false)
    expect(waitsOnTheBanner({ pending_action: null })).toBe(true)
    expect(waitsOnTheBanner({ pending_action: 'gc_stage_ask' })).toBe(true)
  })

  it('draws no banner and no Needs You item when only a stage check is open and high', () => {
    expect(buildCustomerWaitingBanner([stageCheck({ id: 's' })], NOW)).toBeNull()
    expect(summarizeCustomerWaiting([stageCheck({ id: 's' })], NOW)).toBeNull()
  })

  it('never takes the lead from a waiting customer, however long it has waited, nor counts as one', () => {
    const rows = [stageCheck({ id: 's', created_at: minAgo(50) }), row({ id: 'c', created_at: minAgo(5) })]
    const b = buildCustomerWaitingBanner(rows, NOW)
    expect(b?.lead.id).toBe('c')
    expect(b?.leadName).toBe('Jane Doe')
    expect(b?.others).toBe(0)
    expect(b?.waitingCount).toBe(1)
    expect(summarizeCustomerWaiting(rows, NOW)).toMatchObject({ count: 1, uncalled: 1, oldestMinutes: 5, leadName: 'Jane Doe' })
  })

  it('lets the banner calm to amber once every customer is called, with a stage check still open', () => {
    const rows = [stageCheck({ id: 's', created_at: minAgo(50) }), row({ id: 'c', last_called_at: minAgo(2), last_called_by: { name: 'Sam Rivera' } })]
    expect(buildCustomerWaitingBanner(rows, NOW)?.state).toBe('called')
  })
})
