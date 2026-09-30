import { describe, expect, it } from 'vitest'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import {
  arTrailJobLabel,
  arTrailWhenWords,
  bankFailedAtFromRaw,
  buildArDepositTrail,
  groupArDepositTrailRows,
  type ArDepositTrailRow,
} from './arDepositTrail'

const TZ = APP_CALENDAR_TZ
const NOW = new Date('2026-09-30T21:30:00Z') // 4:30 PM Chicago, Sep 30
const when = (iso: string) => arTrailWhenWords(iso, NOW, TZ)

const row = (o: Partial<ArDepositTrailRow> & Pick<ArDepositTrailRow, 'payment_id' | 'live'>): ArDepositTrailRow => ({
  mercury_transaction_id: 'tx',
  job_id: 'j',
  job_number: '',
  job_name: null,
  invoice_id: null,
  amount: 0,
  applied_at: null,
  applied_by: null,
  removed_at: null,
  removed_by: null,
  ...o,
})

// The three real cases of 2026-09-30, times as prod holds them (UTC).
const lobersLive = row({ payment_id: 'p-650', live: true, job_number: '650', job_name: 'ATI Schertz — As per plans', amount: 6077.51, applied_at: '2026-09-30T21:02:53Z', applied_by: 'Taunya' })
const lobersGone = row({ payment_id: 'p-878', live: false, job_number: '878', job_name: 'Take 5- Seguin', amount: 6077.51, applied_at: '2026-09-29T15:29:40Z', applied_by: 'Taunya', removed_at: '2026-09-30T21:00:57Z', removed_by: 'Taunya' })
const southernGone = row({ payment_id: 'p-sp', live: false, job_number: '878', job_name: 'Take 5- Seguin', amount: 13680, applied_at: '2026-09-21T15:06:44Z', applied_by: 'Taunya', removed_at: '2026-09-24T13:43:04Z', removed_by: 'Taunya' })
const lobergGone = row({ payment_id: 'p-lb', live: false, job_number: '650', job_name: 'ATI Schertz — As per plans', amount: 5622.49, applied_at: '2026-09-29T15:28:00Z', applied_by: 'Taunya', removed_at: '2026-09-30T21:02:00Z', removed_by: 'Taunya' })

describe('arTrailWhenWords', () => {
  it('says today with the time on the calendar day now falls on, else month/day', () => {
    expect(when('2026-09-30T21:02:53Z')).toBe('today 4:02 PM')
    expect(when('2026-09-29T15:29:40Z')).toBe('9/29')
    // 11 PM Chicago on 9/29 is 04:00Z on 9/30 — still 9/29 in the app's zone.
    expect(when('2026-09-30T04:00:00Z')).toBe('9/29')
    expect(arTrailWhenWords('nope', NOW, TZ)).toBe('')
  })
})

describe('arTrailJobLabel', () => {
  it('#number name, the name alone without a number, and the words for a job the archive lost', () => {
    expect(arTrailJobLabel({ job_number: '650', job_name: 'ATI Schertz' })).toBe('#650 ATI Schertz')
    expect(arTrailJobLabel({ job_number: '', job_name: 'Clog' })).toBe('Clog')
    expect(arTrailJobLabel({ job_number: null, job_name: null })).toBe('a job the archive did not keep')
  })
})

describe('buildArDepositTrail', () => {
  it('a move: where it is now, then where it was — no "taken off", the re-add says who', () => {
    const t = buildArDepositTrail({ rows: [lobersLive, lobersGone], returned: false, bankFailedAt: null, whenWords: when })!
    expect(t.words).toBe('→ #650 ATI Schertz — As per plans today 4:02 PM by Taunya · was #878 Take 5- Seguin 9/29 by Taunya')
    expect(t.parts.map((p) => p.kind)).toEqual(['on', 'was'])
    expect(t.parts[0]!.jobs).toEqual(['#650 ATI Schertz — As per plans'])
    expect(t.lastTouchedAt).toBe('2026-09-30T21:02:53.000Z')
  })
  it('a bounce: applied, the bank failed it, taken off and marked returned', () => {
    const t = buildArDepositTrail({ rows: [southernGone], returned: true, bankFailedAt: '2026-09-23T13:41:04Z', whenWords: when })!
    expect(t.words).toBe('was #878 Take 5- Seguin 9/21 by Taunya · bank failed it 9/23 · taken off, marked returned 9/24 by Taunya')
    expect(t.parts.map((p) => p.kind)).toEqual(['was', 'bankFailed', 'off'])
    expect(t.lastTouchedAt).toBe('2026-09-24T13:43:04.000Z')
  })
  it('taken off and not put back: the row in To match says where it was', () => {
    const t = buildArDepositTrail({ rows: [lobergGone], returned: false, bankFailedAt: null, whenWords: when })!
    expect(t.words).toBe('was #650 ATI Schertz — As per plans 9/29 by Taunya · taken off today 4:02 PM by Taunya')
  })
  it('a payment recorded by hand and linked later says both steps, with or without the names', () => {
    const marked = row({ payment_id: 'm', live: true, job_number: '1025', job_name: 'Tovi Polk Repairs', applied_at: '2026-09-28T16:56:30Z', applied_by: null, payment_type: 'Check', reference_number: '3463', recorded_by_hand: true })
    expect(buildArDepositTrail({ rows: [marked], returned: false, bankFailedAt: null, whenWords: when })!.words).toBe(
      '→ #1025 Tovi Polk Repairs · recorded as Check 3463 9/28 · linked to this deposit later',
    )
    const stamped = { ...marked, applied_by: 'Taunya', linked_at: '2026-09-30T21:10:00Z', linked_by: 'Grace' }
    const t = buildArDepositTrail({ rows: [stamped], returned: false, bankFailedAt: null, whenWords: when })!
    expect(t.words).toBe('→ #1025 Tovi Polk Repairs · recorded as Check 3463 9/28 by Taunya · linked to this deposit today 4:10 PM by Grace')
    expect(t.lastTouchedAt).toBe('2026-09-30T21:10:00.000Z')
  })
  it('a row whose recorder is not on record says no name; one deposit over several jobs on one day is one part', () => {
    const rows = [
      row({ payment_id: 'a', live: true, job_number: '', job_name: 'Springtown', applied_at: '2026-09-17T15:50:00Z', applied_by: 'Taunya' }),
      row({ payment_id: 'b', live: true, job_number: '', job_name: 'Springtown- HVAC', applied_at: '2026-09-17T15:51:00Z', applied_by: 'Taunya' }),
      row({ payment_id: 'c', live: true, job_number: '', job_name: 'Springtown', applied_at: '2026-09-17T15:53:00Z', applied_by: 'Taunya' }),
    ]
    expect(buildArDepositTrail({ rows, returned: false, bankFailedAt: null, whenWords: when })!.words).toBe('→ Springtown, Springtown- HVAC 9/17 by Taunya')
    const unsigned = [row({ payment_id: 'd', live: true, job_number: '1025', job_name: 'Tovi Polk Repairs', applied_at: '2026-09-28T16:56:00Z' })]
    expect(buildArDepositTrail({ rows: unsigned, returned: false, bankFailedAt: null, whenWords: when })!.words).toBe('→ #1025 Tovi Polk Repairs 9/28')
    expect(buildArDepositTrail({ rows: unsigned, returned: false, bankFailedAt: null, whenWords: when, unsignedName: 'someone' })!.words).toBe('→ #1025 Tovi Polk Repairs 9/28 by someone')
  })
  it('a bounce still on the job (nobody has taken it off) ends on the bank; nothing at all is null', () => {
    const still = row({ payment_id: 'x', live: true, job_number: '878', job_name: 'Take 5- Seguin', applied_at: '2026-09-21T15:06:44Z', applied_by: 'Taunya' })
    const t = buildArDepositTrail({ rows: [still], returned: true, bankFailedAt: '2026-09-23T13:41:04Z', whenWords: when })!
    expect(t.words).toBe('→ #878 Take 5- Seguin 9/21 by Taunya · bank failed it 9/23')
    expect(t.lastTouchedAt).toBe('2026-09-23T13:41:04.000Z')
    expect(buildArDepositTrail({ rows: [], returned: false, bankFailedAt: null, whenWords: when })).toBeNull()
  })
  it('the Elgin cheque: two removals, one of them from a job the archive lost, then the live one', () => {
    const rows = [
      row({ payment_id: 'e1', live: false, job_number: '690', job_name: 'Mission Pet Health', amount: 855, applied_at: '2026-09-01T20:10:00Z', removed_at: '2026-09-02T15:35:00Z', removed_by: 'Taunya' }),
      row({ payment_id: 'e2', live: false, job_number: null, job_name: null, amount: 885, applied_at: '2026-09-02T15:35:00Z', removed_at: '2026-09-02T16:22:00Z', removed_by: 'Robert' }),
      row({ payment_id: 'e3', live: true, job_number: '', job_name: 'Hamilton Valley Management', amount: 885, applied_at: '2026-09-02T16:22:00Z', applied_by: 'Taunya' }),
    ]
    const t = buildArDepositTrail({ rows, returned: false, bankFailedAt: null, whenWords: when })!
    // e2's removal is within the move window of e3's apply → a move; e1's is not → taken off.
    expect(t.words).toBe(
      '→ Hamilton Valley Management 9/2 by Taunya · was #690 Mission Pet Health 9/1 · was a job the archive did not keep 9/2 · taken off 9/2 by Taunya',
    )
  })
})

describe('helpers', () => {
  it('groups RPC rows by deposit and reads failedAt off the raw payload', () => {
    const g = groupArDepositTrailRows([{ ...lobersLive, mercury_transaction_id: 'a' }, { ...lobersGone, mercury_transaction_id: 'a' }, { ...southernGone, mercury_transaction_id: 'b' }])
    expect([...g.keys()]).toEqual(['a', 'b'])
    expect(g.get('a')!.length).toBe(2)
    expect(bankFailedAtFromRaw({ failedAt: '2026-09-23T13:41:04.194972Z' })).toBe('2026-09-23T13:41:04.194972Z')
    expect(bankFailedAtFromRaw({ failedAt: '' })).toBeNull()
    expect(bankFailedAtFromRaw(null)).toBeNull()
  })
})
