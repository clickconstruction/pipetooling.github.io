import { describe, expect, it } from 'vitest'
import type { Container, ContainerLine } from './onSite'
import { matchOnHandNames, onHandNames, onHandNameWords } from './onSiteNames'

// A made-up job with four boxes.
const box = (id: string, label: string, retired = false): Container => ({ id, jobId: 'ja', label, kind: 'cage', where: '', locationId: null, lat: null, lng: null, retiredAt: retired ? '2026-11-01T00:00:00Z' : null, createdAt: '2026-10-01T00:00:00Z' })
const line = (containerId: string, partName: string, onHand: number, partId: string | null = null, manufacturer: string | null = null): ContainerLine => ({ containerId, partKey: partId ? `id:${partId}` : `text:${partName.toLowerCase()}`, partId, partName, manufacturer, onHand, lastTouchedAt: null, lastTouchedBy: null, lastCountAt: null, lastCountBy: null, lastCountDiff: null, cannotFindSinceCount: 0 })

const containers = [box('r12', 'R12'), box('r31', 'R31'), box('r44', 'R44'), box('r7', 'R7'), box('old', 'R99', true)]
const lines = [
  line('r12', '2" 90 pvc', 94),
  line('r31', '2 inch 90 PVC', 42),
  line('r44', '2inch 90s pvc', 28),
  line('r31', '3" 90 pvc', 30),
  line('r7', '3/4 COPPER TEE', 300, 'book-1', 'Mueller'),
  line('r7', 'Wax ring', 0),
  line('old', 'Toilet', 5),
]

describe('onHandNames', () => {
  it('lists one name per same-words key, the spelling with the most pieces, most pieces first', () => {
    const names = onHandNames(lines, containers)
    expect(names.map((n) => `${n.partName} ${n.pieces}`)).toEqual(['3/4 COPPER TEE 300', '2" 90 pvc 164', '3" 90 pvc 30'])
    expect(names[1]!.boxes).toEqual(['R12', 'R31', 'R44'])
    expect(names[0]!.partId).toBe('book-1')
  })
  it('leaves out an empty line and a retired box', () => {
    const names = onHandNames(lines, containers).map((n) => n.partName)
    expect(names).not.toContain('Wax ring')
    expect(names).not.toContain('Toilet')
  })
})

describe('matchOnHandNames', () => {
  const names = onHandNames(lines, containers)
  it('finds a name by the words typed, however the inch mark is written', () => {
    expect(matchOnHandNames(names, '2 inch 90').map((n) => n.partName)).toEqual(['2" 90 pvc'])
    expect(matchOnHandNames(names, '2 90').map((n) => n.partName)).toEqual(['2" 90 pvc'])
    expect(matchOnHandNames(names, '90 pvc').map((n) => n.partName)).toEqual(['2" 90 pvc', '3" 90 pvc'])
    expect(matchOnHandNames(names, 'PVC 2”90')[0]!.partName).toBe('2" 90 pvc')
  })
  it('finds a book part by its name or its maker', () => {
    expect(matchOnHandNames(names, 'copper tee').map((n) => n.partId)).toEqual(['book-1'])
    expect(matchOnHandNames(names, 'mueller').map((n) => n.partId)).toEqual(['book-1'])
  })
  it('offers nothing for nothing typed or for words no name holds, and stops at the cap', () => {
    expect(matchOnHandNames(names, '  ')).toEqual([])
    expect(matchOnHandNames(names, 'toilet')).toEqual([])
    expect(matchOnHandNames(names, '9', 1)).toHaveLength(1)
  })
  it('puts the name with exactly the same words first', () => {
    const more = onHandNames([...lines, line('r12', '2" 90', 500)], containers)
    expect(matchOnHandNames(more, '2 inch 90')[0]!.partName).toBe('2" 90')
  })
})

describe('onHandNameWords', () => {
  it('says how many and where', () => {
    expect(onHandNameWords({ pieces: 94, boxes: ['R12'] })).toBe('94 in R12')
    expect(onHandNameWords({ pieces: 1640, boxes: ['R12', 'R31', 'R44'] })).toBe('1,640 in R12, R31 and 1 more')
  })
})
