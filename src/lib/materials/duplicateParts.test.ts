import { describe, expect, it } from 'vitest'
import {
  buildDuplicateGroups,
  exactDuplicateGroups,
  isExactGroup,
  nearDuplicateGroups,
  normalizePartName,
  numericSignature,
  numericTokens,
} from './duplicateParts'

const p = (id: string, name: string) => ({ id, name })
const names = (groups: { name: string }[][]) => groups.map((g) => g.map((x) => x.name))

describe('normalizePartName', () => {
  it('trims, lowercases and collapses whitespace', () => {
    expect(normalizePartName('  PEX  1/2  Elbow ')).toBe('pex 1/2 elbow')
  })
})

describe('numericTokens / numericSignature', () => {
  it('extracts fractions, mixed fractions, decimals and plain numbers with punctuation trimmed', () => {
    expect(numericTokens('1-1/2 X 1-1/4 PEX Coupling')).toEqual(['1-1/2', '1-1/4'])
    expect(numericTokens('PVC Elbow 3/4"')).toEqual(['3/4'])
    expect(numericTokens('Copper Type L 0.75 in x 20 ft.')).toEqual(['0.75', '20'])
    expect(numericTokens('Watts LF007M1QT 1/2')).toEqual(['007', '1', '1/2'])
    expect(numericTokens('Ball Valve')).toEqual([])
  })

  it('signature is order-independent and keeps leading zeros', () => {
    expect(numericSignature('1/2 x 3/4')).toBe(numericSignature('3/4 X 1/2'))
    expect(numericSignature('Model 007')).not.toBe(numericSignature('Model 7'))
  })
})

describe('exactDuplicateGroups', () => {
  it('groups case / whitespace variants of the same name and nothing else', () => {
    const groups = exactDuplicateGroups([
      p('a', 'PEX 1/2 Elbow'),
      p('b', 'pex 1/2  elbow'),
      p('c', 'PEX 3/4 Elbow'),
      p('d', ' PEX 1/2 Elbow '),
      p('e', 'Ball Valve 1/2'),
    ])
    expect(names(groups)).toEqual([['PEX 1/2 Elbow', ' PEX 1/2 Elbow ', 'pex 1/2  elbow'].sort((x, y) => x.localeCompare(y))])
    expect(groups[0]!.map((x) => x.id).sort()).toEqual(['a', 'b', 'd'])
  })

  it('ignores blank names and returns nothing for singletons', () => {
    expect(exactDuplicateGroups([p('a', ''), p('b', '   '), p('c', 'Tee')])).toEqual([])
  })
})

describe('nearDuplicateGroups', () => {
  it('never groups parts that differ only by size tokens (the PEX size family)', () => {
    const family = [
      p('1', 'PEX Crimp Coupling 1/2'),
      p('2', 'PEX Crimp Coupling 3/4'),
      p('3', 'PEX Crimp Coupling 1'),
      p('4', 'PEX Crimp Coupling 1-1/4'),
      p('5', 'PEX Crimp Coupling 1-1/2'),
    ]
    expect(nearDuplicateGroups(family)).toEqual([])
  })

  it('keeps "1-1/2 X 1-1/4" apart from "1-1/4 X 3/4" even though the strings are near-identical', () => {
    expect(
      nearDuplicateGroups([p('a', '1-1/2 X 1-1/4 PEX Reducing Coupling'), p('b', '1-1/4 X 3/4 PEX Reducing Coupling')]),
    ).toEqual([])
  })

  it('groups a typo / suffix variant when every number agrees', () => {
    const groups = nearDuplicateGroups([
      p('a', 'Sharkbite 1/2 Coupling'),
      p('b', 'Shark bite 1/2 Coupling'),
      p('c', 'Sharkbite 1/2 Coupling LF'),
      p('d', 'Sharkbite 3/4 Coupling'),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0]!.map((x) => x.id).sort()).toEqual(['a', 'b', 'c'])
  })

  it('does not group same-number names that are far apart in spelling', () => {
    expect(nearDuplicateGroups([p('a', 'Copper Elbow 1/2'), p('b', 'Brass Nipple 1/2')])).toEqual([])
  })

  it('includes exact matches as groups too (exact ⊂ near)', () => {
    const rows = [p('a', 'Ball Valve 1/2'), p('b', 'ball valve 1/2'), p('c', 'Ball Valve 3/4')]
    expect(names(nearDuplicateGroups(rows))).toEqual(names(exactDuplicateGroups(rows)))
  })

  it('transitive closure stays inside one numeric bucket', () => {
    const groups = nearDuplicateGroups([
      p('a', 'PVC DWV Sanitary Tee 2'),
      p('b', 'PVC DWV Sanitary Tee 2 Hub'),
      p('c', 'PVC DWV Sanitary Tee 2 Hub x Hub'),
      p('d', 'PVC DWV Sanitary Tee 3'),
      p('e', 'PVC DWV Sanitary Tee 3 Hub'),
    ])
    expect(groups).toHaveLength(2)
    expect(groups.map((g) => g.map((x) => x.id).sort())).toEqual([
      ['a', 'b', 'c'],
      ['d', 'e'],
    ])
  })
})

describe('isExactGroup / buildDuplicateGroups', () => {
  it('flags exact groups and defaults the page to exact mode', () => {
    const rows = [p('a', 'Copper Sweat Tee 1/2'), p('b', 'copper sweat tee 1/2'), p('c', 'Copper Sweat Tee 1/2 C')]
    const exact = buildDuplicateGroups(rows, 'exact')
    const near = buildDuplicateGroups(rows, 'near')
    expect(exact).toHaveLength(1)
    expect(isExactGroup(exact[0]!)).toBe(true)
    expect(near).toHaveLength(1)
    expect(near[0]).toHaveLength(3)
    expect(isExactGroup(near[0]!)).toBe(false)
  })
})
