import { describe, expect, it } from 'vitest'
import { tagBlock, type TagBlockRow } from './procurementTagBlocks'

const part = (key: string, o: Partial<TagBlockRow> = {}): TagBlockRow => ({ key, partKey: `k-${key}`, isHand: false, orderOnly: false, assembly: null, ...o })
const shape = (rows: TagBlockRow[]) =>
  tagBlock(rows).lines.map((l) => (l.kind === 'assembly' ? `[${l.name}: ${l.keys.join(',')}]` : `${'·'.repeat(l.level)}${l.row.key}${l.orderOnlyStarts ? ' (order only from here)' : ''}`))

// BP375 as it stands on 2026-10-02.
describe('tagBlock', () => {
  it('a one-part fixture (FCO) is one line at the fixture’s edge', () => {
    const b = tagBlock([part('zurn-zn1400')])
    expect(b.single).toBe(true)
    expect(shape([part('zurn-zn1400')])).toEqual(['zurn-zn1400'])
  })

  it('a row typed as one product (UTILITY SINK) is one line too', () => {
    expect(tagBlock([{ key: 'UTILITY SINK', partKey: null, isHand: false }]).single).toBe(true)
  })

  it('one assembly and nothing else (LAV-1): named on the fixture, its parts one step in, order-only last', () => {
    const asm = 'LAV 1 assembly SPACEX'
    const rows = [part('tsl', { assembly: asm }), part('toto', { assembly: asm }), part('bobrick', { assembly: asm }), part('supply', { assembly: asm, orderOnly: true }), part('drain', { assembly: asm, orderOnly: true })]
    const b = tagBlock(rows)
    expect(b.single).toBe(false)
    expect(b.from).toBe(asm)
    expect(shape(rows)).toEqual(['·tsl', '·toto', '·bobrick', '·supply (order only from here)', '·drain'])
  })

  it('an assembly plus a part added by hand (EWC-1): the assembly gets its own step, the carrier stays one step in', () => {
    const asm = 'EWC1 assembly'
    const rows = [
      part('elkay', { assembly: asm }), part('apron', { assembly: asm }), part('josam'),
      part('trap', { assembly: asm, orderOnly: true }), part('stop', { assembly: asm, orderOnly: true }),
    ]
    expect(tagBlock(rows).from).toBeNull()
    expect(shape(rows)).toEqual(['[EWC1 assembly: elkay,apron,trap,stop]', '··elkay', '··apron', '··trap (order only from here)', '··stop', '·josam'])
  })

  it('loose takeoff lines and a carrier added by hand (WC-1, WC-2): every part one step in, nothing named', () => {
    const rows = [part('bowl'), part('valve'), part('seat'), part('zurn'), part('josam')]
    const b = tagBlock(rows)
    expect(b.from).toBeNull()
    expect(shape(rows)).toEqual(['·bowl', '·valve', '·seat', '·zurn', '·josam'])
  })

  it('two assemblies under one fixture: each gets its own step, in the order they first appear', () => {
    const rows = [part('a1', { assembly: 'A' }), part('b1', { assembly: 'B' }), part('a2', { assembly: 'A', orderOnly: true }), part('b2', { assembly: 'B', orderOnly: true })]
    expect(shape(rows)).toEqual(['[A: a1,a2]', '··a1', '··a2 (order only from here)', '[B: b1,b2]', '··b1', '··b2 (order only from here)'])
  })

  it('the tag’s own line logged before its parts leads, one step in', () => {
    const rows = [{ key: 'WC-1', partKey: null, isHand: false }, part('bowl'), part('stop', { orderOnly: true })]
    expect(shape(rows)).toEqual(['·WC-1', '·bowl', '·stop (order only from here)'])
  })

  it('connectors run like a folder tree: ├ while a sibling follows, └ on the last, │ where an outer block carries on', () => {
    const asm = 'EWC1 assembly'
    const rows = [part('elkay', { assembly: asm }), part('apron', { assembly: asm }), part('josam'), part('trap', { assembly: asm, orderOnly: true })]
    const g = tagBlock(rows).lines.map((l) => `${l.kind === 'assembly' ? l.name : l.row.key}:${l.guides.join('/')}`)
    // The assembly's label is ├ because the carrier follows it one step in; inside it, │ carries the outer column down to the carrier.
    expect(g).toEqual(['EWC1 assembly:tee', 'elkay:pass/tee', 'apron:pass/tee', 'trap:pass/end', 'josam:end'])
    const lav = tagBlock([part('a', { assembly: 'L' }), part('b', { assembly: 'L' })]).lines.map((l) => (l.kind === 'line' ? l.guides.join('/') : ''))
    expect(lav).toEqual(['tee', 'end'])
    expect(tagBlock([part('one')]).lines[0]!.guides).toEqual([])
  })

  it('the first order-only line of each block says how many follow', () => {
    const rows = [part('a', { assembly: 'A' }), part('a2', { assembly: 'A', orderOnly: true }), part('a3', { assembly: 'A', orderOnly: true }), part('x'), part('x2', { orderOnly: true })]
    const starts = tagBlock(rows).lines.flatMap((l) => (l.kind === 'line' && l.orderOnlyStarts ? [`${l.row.key}:${l.orderOnlyCount}`] : []))
    expect(starts).toEqual(['a2:2', 'x2:1'])
  })

  it('lines typed on the log by hand sit one step in under their heading', () => {
    const rows = [{ key: 'hand:1', partKey: null, isHand: true }]
    const b = tagBlock(rows)
    expect(b.single).toBe(false)
    expect(shape(rows)).toEqual(['·hand:1'])
  })
})
