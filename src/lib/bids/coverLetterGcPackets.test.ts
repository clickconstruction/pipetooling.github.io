import { describe, expect, it } from 'vitest'
import { groupSectionsByEffectiveGc, hasMultipleEffectiveGcs, type GcPacketCustomer } from './coverLetterGcPackets'

const bidGc: GcPacketCustomer = { id: 'harper', name: 'Harper GC', address: '1 Main St' }
const turner: GcPacketCustomer = { id: 'turner', name: 'Turner Construction', address: '2 Oak Ave' }
const dpr: GcPacketCustomer = { id: 'dpr', name: 'DPR Builders', address: '3 Elm Rd' }

describe('groupSectionsByEffectiveGc', () => {
  it('falls back to the bid-level GC when versions have no override (single packet, order kept)', () => {
    const packets = groupSectionsByEffectiveGc(
      [
        { name: 'Base bid', bidVersionId: 'v1' },
        { name: 'Alt — VE', bidVersionId: 'v2' },
      ],
      { v1: null, v2: undefined },
      bidGc,
    )
    expect(packets).toHaveLength(1)
    expect(packets[0]!.customer).toBe(bidGc)
    expect(packets[0]!.isBidDefault).toBe(true)
    expect(packets[0]!.sections.map((s) => s.name)).toEqual(['Base bid', 'Alt — VE'])
  })

  it('sections with no version link at all use the bid GC', () => {
    const packets = groupSectionsByEffectiveGc([{ name: 'Base', bidVersionId: null }], {}, bidGc)
    expect(packets).toHaveLength(1)
    expect(packets[0]!.isBidDefault).toBe(true)
  })

  it('splits by override and keeps first-seen group order + in-group section order', () => {
    const packets = groupSectionsByEffectiveGc(
      [
        { name: 'Base — Turner', bidVersionId: 'v1' },
        { name: 'Base — DPR', bidVersionId: 'v2' },
        { name: 'Alt — DPR', bidVersionId: 'v3' },
        { name: 'Alt — default', bidVersionId: 'v4' },
      ],
      { v1: turner, v2: dpr, v3: dpr, v4: null },
      bidGc,
    )
    expect(packets.map((p) => p.customer.name)).toEqual(['Turner Construction', 'DPR Builders', 'Harper GC'])
    expect(packets[1]!.sections.map((s) => s.name)).toEqual(['Base — DPR', 'Alt — DPR'])
    expect(packets[2]!.isBidDefault).toBe(true)
    expect(hasMultipleEffectiveGcs(packets)).toBe(true)
  })

  it('an override equal to the bid GC id merges with default sections (same customer, one packet)', () => {
    const packets = groupSectionsByEffectiveGc(
      [
        { name: 'A', bidVersionId: 'v1' },
        { name: 'B', bidVersionId: 'v2' },
      ],
      { v1: { ...bidGc }, v2: null },
      bidGc,
    )
    expect(packets).toHaveLength(1)
    expect(packets[0]!.sections.map((s) => s.name)).toEqual(['A', 'B'])
    expect(hasMultipleEffectiveGcs(packets)).toBe(false)
  })

  it('never mixes sections across packets (leakage guard invariant)', () => {
    const packets = groupSectionsByEffectiveGc(
      [
        { name: 'T1', bidVersionId: 'v1' },
        { name: 'D1', bidVersionId: 'v2' },
      ],
      { v1: turner, v2: dpr },
      bidGc,
    )
    const all = packets.flatMap((p) => p.sections.map((s) => s.name))
    expect(all.sort()).toEqual(['D1', 'T1'])
    for (const p of packets) expect(p.sections).toHaveLength(1)
  })
})
