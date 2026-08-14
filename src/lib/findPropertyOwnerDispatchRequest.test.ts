import { describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({ supabase: {} }))

import {
  buildFindOwnerPendingPayload,
  findOwnerRequestTitle,
  parseFindOwnerPendingPayload,
} from './findPropertyOwnerDispatchRequest'

const ferguson = { id: 'c1', label: 'Ferguson — Central desk', email: 'orders@ferguson.com' }
const winsupply = { id: 'c2', label: 'Winsupply', email: 'desk@winsupply.com' }

describe('buildFindOwnerPendingPayload', () => {
  it('returns null when nothing was picked (choice is optional)', () => {
    expect(buildFindOwnerPendingPayload([])).toBeNull()
  })

  it('trims and drops rows missing an id or label', () => {
    const payload = buildFindOwnerPendingPayload([
      { id: ' c1 ', label: ' Ferguson — Central desk ', email: ' orders@ferguson.com ' },
      { id: '', label: 'ghost', email: '' },
      { id: 'c3', label: '  ', email: '' },
    ])
    expect(payload).toEqual({ supply_houses: [ferguson] })
  })
})

describe('parseFindOwnerPendingPayload', () => {
  it('round-trips the built payload', () => {
    const payload = buildFindOwnerPendingPayload([ferguson, winsupply])
    expect(parseFindOwnerPendingPayload(payload)).toEqual([ferguson, winsupply])
  })

  it('tolerates null, foreign shapes, and junk entries', () => {
    expect(parseFindOwnerPendingPayload(null)).toEqual([])
    expect(parseFindOwnerPendingPayload({ other: true })).toEqual([])
    expect(parseFindOwnerPendingPayload({ supply_houses: 'nope' })).toEqual([])
    expect(
      parseFindOwnerPendingPayload({ supply_houses: [null, 42, { id: 'c1', label: 'Ferguson — Central desk', email: 'orders@ferguson.com' }, { label: 'no id' }] })
    ).toEqual([ferguson])
  })
})

describe('findOwnerRequestTitle', () => {
  it('keeps the v2.1610 title when no supply house was picked', () => {
    expect(findOwnerRequestTitle('925 · Keith', [])).toBe(
      'Find the property owner for 925 · Keith (name/company + mailing address), then open Job Detail → Share with supply house and send the job account.'
    )
  })

  it('names the wanted supply houses so the inbox card carries the intent', () => {
    expect(findOwnerRequestTitle('925 · Keith', [ferguson, winsupply])).toBe(
      'Find the property owner for 925 · Keith (name/company + mailing address), then open Job Detail → Share with supply house and send the job account to Ferguson — Central desk, Winsupply.'
    )
  })
})
