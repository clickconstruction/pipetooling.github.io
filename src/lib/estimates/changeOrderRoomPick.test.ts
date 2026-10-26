import { describe, expect, it } from 'vitest'
import { pickBidRoomForChangeOrder } from './changeOrderRoomPick'

const room = (id: string, customer_id: string | null) => ({ id, customer_id })

describe('pickBidRoomForChangeOrder', () => {
  it('picks the room whose customer matches the CO', () => {
    const rooms = [room('a', 'c1'), room('b', 'c2'), room('c', null)]
    expect(pickBidRoomForChangeOrder(rooms, 'c2')?.id).toBe('b')
  })

  it('a customer-less CO matches a customer-less room first', () => {
    const rooms = [room('a', 'c1'), room('b', null)]
    expect(pickBidRoomForChangeOrder(rooms, null)?.id).toBe('b')
  })

  it('falls back to the only open room whatever its customer', () => {
    expect(pickBidRoomForChangeOrder([room('a', 'c9')], 'c1')?.id).toBe('a')
  })

  it('with several rooms and no match, takes the customer-less room', () => {
    const rooms = [room('a', 'c1'), room('b', 'c2'), room('c', null)]
    expect(pickBidRoomForChangeOrder(rooms, 'c9')?.id).toBe('c')
  })

  it('refuses (null) when several rooms exist, none matches and none is customer-less', () => {
    const rooms = [room('a', 'c1'), room('b', 'c2')]
    expect(pickBidRoomForChangeOrder(rooms, 'c9')).toBeNull()
  })

  it('returns null for no rooms', () => {
    expect(pickBidRoomForChangeOrder([], 'c1')).toBeNull()
    expect(pickBidRoomForChangeOrder([], null)).toBeNull()
  })

  it('order matters: the first matching room wins', () => {
    const rooms = [room('a', 'c1'), room('b', 'c1')]
    expect(pickBidRoomForChangeOrder(rooms, 'c1')?.id).toBe('a')
  })
})
