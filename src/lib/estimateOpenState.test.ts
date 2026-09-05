import { describe, expect, it } from 'vitest'
import { estimateOpenState, filterScannerViews, groupEventsByEstimateId } from './estimateOpenState'

// Noon UTC keeps the calendar day stable in every zone a test box is likely to run in.
const now = Date.parse('2026-09-05T12:00:00Z')
const sentAt = '2026-08-27T12:00:00Z' // 9 days before now → computeSentWait says "sent 9d ago — nudge?"

const view = (occurred_at: string, client_ip = '1.1.1.1') => ({ event_type: 'public_link_view', occurred_at, client_ip })

describe('estimateOpenState', () => {
  it('never opened keeps computeSentWait numbers and level', () => {
    const s = estimateOpenState([], { sent_at: sentAt, change_order_fields: null }, now)
    expect(s).toMatchObject({ opened: false, openCount: 0, quietDays: null, level: 'warn' })
    expect(s?.label).toBe('never opened · sent 9d ago — nudge?')
  })

  it('returns null without a usable sent_at (same contract as computeSentWait)', () => {
    expect(estimateOpenState([view('2026-09-01T12:00:00Z')], { sent_at: null, change_order_fields: null }, now)).toBeNull()
  })

  it('opened recently reads "opened <weekday> · quiet Nd" and is calm even when sent long ago', () => {
    const opened = '2026-09-03T12:00:00Z' // Thursday, 2 days quiet
    const s = estimateOpenState([view(opened)], { sent_at: sentAt, change_order_fields: null }, now)
    expect(s).toMatchObject({ opened: true, openCount: 1, quietDays: 2, level: 'ok', lastOpenedAt: '2026-09-03T12:00:00.000Z' })
    expect(s?.label).toBe('opened Thu · quiet 2d')
  })

  it('opened today', () => {
    const s = estimateOpenState([view('2026-09-05T09:00:00Z')], { sent_at: sentAt, change_order_fields: null }, now)
    expect(s?.label).toBe('opened today')
    expect(s?.quietDays).toBe(0)
  })

  it('a week of quiet after an open goes amber with a nudge, dated M/D', () => {
    const s = estimateOpenState([view('2026-08-28T12:00:00Z')], { sent_at: sentAt, change_order_fields: null }, now)
    expect(s?.level).toBe('warn')
    expect(s?.label).toBe('opened 8/28 · quiet 8d — nudge?')
  })

  it('the newest open wins; option views count as opens', () => {
    const s = estimateOpenState(
      [view('2026-08-28T12:00:00Z'), { event_type: 'option_viewed', occurred_at: '2026-09-04T12:00:00Z', client_ip: '1.1.1.1' }],
      { sent_at: sentAt, change_order_fields: null },
      now,
    )
    expect(s?.openCount).toBe(2)
    expect(s?.label).toBe('opened Fri · quiet 1d')
  })

  it('overdue response-requested-by beats everything, opened or not', () => {
    const co = { response_requested_by: '2026-09-01' }
    const opened = estimateOpenState([view('2026-09-04T12:00:00Z')], { sent_at: sentAt, change_order_fields: co }, now)
    expect(opened?.level).toBe('overdue')
    expect(opened?.label).toBe('opened Fri · response requested by 9/1 — 4d overdue')
    const never = estimateOpenState([], { sent_at: sentAt, change_order_fields: co }, now)
    expect(never?.label).toBe('never opened · response requested by 9/1 — 4d overdue')
  })

  it('mail-gateway scanners (2+ IPs inside the first minute) do not count as opened', () => {
    const burst = [view('2026-08-27T12:00:05Z', '10.0.0.1'), view('2026-08-27T12:00:20Z', '10.0.0.2'), view('2026-08-27T12:00:41Z', '10.0.0.3')]
    const s = estimateOpenState(burst, { sent_at: sentAt, change_order_fields: null }, now)
    expect(s?.opened).toBe(false)
    expect(s?.label).toBe('never opened · sent 9d ago — nudge?')
  })

  it('a single IP clicking straight away is a real customer, not a scanner', () => {
    const quick = [view('2026-08-27T12:00:30Z', '10.0.0.1')]
    expect(filterScannerViews(quick, sentAt)).toHaveLength(1)
    expect(estimateOpenState(quick, { sent_at: sentAt, change_order_fields: null }, now)?.opened).toBe(true)
  })

  it('a later human open survives the scanner filter', () => {
    const events = [view('2026-08-27T12:00:05Z', '10.0.0.1'), view('2026-08-27T12:00:20Z', '10.0.0.2'), view('2026-09-02T15:00:00Z', '73.1.2.3')]
    const kept = filterScannerViews(events, sentAt)
    expect(kept).toHaveLength(1)
    expect(kept[0]?.client_ip).toBe('73.1.2.3')
  })

  it('accept/decline events are not "opens" (they end the story instead)', () => {
    const s = estimateOpenState(
      [{ event_type: 'public_accept_submitted', occurred_at: '2026-09-04T12:00:00Z' }],
      { sent_at: sentAt, change_order_fields: null },
      now,
    )
    expect(s?.opened).toBe(false)
  })
})

describe('groupEventsByEstimateId', () => {
  it('buckets a flat fetch by estimate', () => {
    const g = groupEventsByEstimateId([
      { estimate_id: 'a', n: 1 },
      { estimate_id: 'b', n: 2 },
      { estimate_id: 'a', n: 3 },
    ])
    expect(Object.keys(g).sort()).toEqual(['a', 'b'])
    expect(g.a?.map((e) => e.n)).toEqual([1, 3])
  })
})
