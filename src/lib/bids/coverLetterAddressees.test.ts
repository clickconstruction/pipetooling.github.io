import { describe, expect, it } from 'vitest'

import { addresseeRowVisible, bidDefaultPacketKey, coverLetterAddressees, resolveAddressedCustomer } from './coverLetterAddressees'

const bidGc = { id: 'gc-1', name: 'Ridgeway Builders', address: '214 W. Alder St' }

describe('coverLetterAddressees', () => {
  it('bid GC leads; recorded recipients follow as same-letter addressees', () => {
    const list = coverLetterAddressees({
      bidGc,
      recipients: [
        { customerId: 'gc-2', name: 'Harbor Point', address: '900 Lakeway Commons' },
        { customerId: 'gc-3', name: 'Caldwell & Sons', address: null },
      ],
      packetGcIds: [],
    })
    expect(list.map((a) => [a.gcId, a.kind])).toEqual([
      ['gc-1', 'bid'],
      ['gc-2', 'shared'],
      ['gc-3', 'shared'],
    ])
    expect(list[1]).toMatchObject({ name: 'Harbor Point', address: '900 Lakeway Commons' })
    // No address on file prints the dash, same as a packet GC's missing address.
    expect(list[2]?.address).toBe('—')
  })

  it('a GC with a packet is not listed — their letter follows their tab', () => {
    const list = coverLetterAddressees({
      bidGc,
      recipients: [
        { customerId: 'gc-2', name: 'Harbor Point', address: null },
        { customerId: 'gc-9', name: 'Packet GC', address: null },
      ],
      packetGcIds: ['gc-9', null, undefined],
    })
    expect(list.map((a) => a.gcId)).toEqual(['gc-1', 'gc-2'])
  })

  it('dedupes: a recipient row for the bid GC itself never doubles the chip', () => {
    const list = coverLetterAddressees({
      bidGc,
      recipients: [
        { customerId: 'gc-1', name: 'Ridgeway Builders', address: null },
        { customerId: 'gc-2', name: 'Harbor Point', address: null },
        { customerId: 'gc-2', name: 'Harbor Point', address: null },
      ],
      packetGcIds: [],
    })
    expect(list.map((a) => a.gcId)).toEqual(['gc-1', 'gc-2'])
  })

  it('row visibility: only when there is a choice to make', () => {
    const solo = coverLetterAddressees({ bidGc, recipients: [], packetGcIds: [] })
    expect(addresseeRowVisible(solo)).toBe(false)
    const two = coverLetterAddressees({ bidGc, recipients: [{ customerId: 'gc-2', name: 'Harbor Point', address: null }], packetGcIds: [] })
    expect(addresseeRowVisible(two)).toBe(true)
  })
})

describe('resolveAddressedCustomer', () => {
  const list = coverLetterAddressees({
    bidGc,
    recipients: [{ customerId: 'gc-2', name: 'Harbor Point', address: '900 Lakeway Commons' }],
    packetGcIds: [],
  })

  it('a shared selection overrides the address block', () => {
    expect(resolveAddressedCustomer(list, 'gc-2')).toEqual({ id: 'gc-2', name: 'Harbor Point', address: '900 Lakeway Commons' })
  })

  it('the bid GC, no selection, or a selection no longer offered: no override', () => {
    expect(resolveAddressedCustomer(list, null)).toBeNull()
    expect(resolveAddressedCustomer(list, 'gc-1')).toBeNull()
    expect(resolveAddressedCustomer(list, 'gc-gone')).toBeNull()
  })
})

describe('bidDefaultPacketKey', () => {
  it('the bid GC files under its customer id when it has one, else the literal key', () => {
    expect(bidDefaultPacketKey(bidGc)).toBe('gc-1')
    expect(bidDefaultPacketKey({ id: null, name: 'To Plans', address: '—' })).toBe('bid-default')
  })
})
