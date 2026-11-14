import { describe, expect, it } from 'vitest'
import { boxAddress, boxAddressWords, boxClipboardWords, boxCode, boxCodeWords, boxUrl, copiedLabelWords, dashedCode, labelPlate, labelPrintName, labelPrintNames, labelRows, normalizeBoxCode, shortenedLabelsNote } from './labels'

const ID = '7d759246-8476-4a37-884f-ed1562d5663f'

describe('the box code', () => {
  it('is the first eight characters of the id, in capitals', () => {
    expect(boxCode(ID)).toBe('7D759246')
  })

  it('carries the scheme so a phone opens it, short enough for a 25-module code, in the letters a QR packs tight', () => {
    const url = boxUrl(ID)
    // v2.6862: with no scheme an iPhone's camera searched the web for the words.
    expect(url).toBe('HTTPS://PRTS.CO/B/7D759246')
    expect(new URL(url.toLowerCase()).pathname).toBe('/b/7d759246')
    // a version-2 QR at level M holds 38 characters of its letter mode
    expect(url.length).toBeLessThanOrEqual(38)
    expect(url).toMatch(/^[0-9A-Z $%*+\-./:]+$/)
    expect(boxAddress(ID)).toBe('prts.co/b/7D759246')
  })

  it('reads a code back however it was typed', () => {
    expect(normalizeBoxCode('7d759246')).toBe('7D759246')
    expect(normalizeBoxCode('7D75-9246')).toBe('7D759246')
    expect(normalizeBoxCode('7D75')).toBe('')
  })

  it('prints the code for a person with a dash in the middle, and the dashed address round-trips (v2.6796)', () => {
    expect(boxCodeWords(ID)).toBe('7D75-9246')
    expect(boxAddressWords(ID)).toBe('prts.co/b/7D75-9246')
    expect(dashedCode('7d759246')).toBe('7D75-9246')
    expect(dashedCode('7D75-9246')).toBe('7D75-9246')
    expect(normalizeBoxCode(boxCodeWords(ID))).toBe(boxCode(ID))
    // the QR keeps the code with no dash; the dashed address with its scheme still fits a 25-module code at level M (38 characters)
    expect(boxUrl(ID)).not.toContain('-')
    expect(boxClipboardWords(ID).length).toBeLessThanOrEqual(38)
  })

  it('Copy the label code puts the dashed address in capitals on the clipboard and says so (v2.6800)', () => {
    expect(boxClipboardWords(ID)).toBe('HTTPS://PRTS.CO/B/7D75-9246')
    expect(boxClipboardWords(ID)).toMatch(/^[0-9A-Z $%*+\-./:]+$/)
    expect(copiedLabelWords(ID)).toBe('Copied HTTPS://PRTS.CO/B/7D75-9246. Paste it into the Brother app as a QR code.')
    expect(normalizeBoxCode(boxClipboardWords(ID).split('/').pop() ?? '')).toBe(boxCode(ID))
  })
})

describe('labelRows', () => {
  const line = (partName: string, onHand: number) => ({ partName, manufacturer: null, onHand })

  it('lists what is on hand, then blank rows up to ten', () => {
    const rows = labelRows([line('3/4" copper 90', 25), line('1/2" ball valve', 4), line('gone', 0)])
    expect(rows).toHaveLength(10)
    expect(rows.slice(0, 2)).toEqual([{ partName: '3/4" copper 90', manufacturer: null, onHand: 25 }, { partName: '1/2" ball valve', manufacturer: null, onHand: 4 }])
    expect(rows.slice(2).every((r) => r === null)).toBe(true)
  })

  it('keeps four blank rows under a full box', () => {
    const rows = labelRows(Array.from({ length: 12 }, (_, i) => line(`part ${i}`, 1)))
    expect(rows).toHaveLength(16)
    expect(rows.filter((r) => r === null)).toHaveLength(4)
  })

  it('is ten blank rows on an empty box', () => {
    expect(labelRows([])).toEqual(Array.from({ length: 10 }, () => null))
  })
})

describe('what a label prints in large type (v2.7195)', () => {
  const b = (id: string, label: string, retiredAt: string | null = null) => ({ id, label, retiredAt })

  it('reads the letters and number a name starts with', () => {
    expect(labelPlate('R74 3/4 PEX')).toBe('R74')
    expect(labelPlate('r70 no container')).toBe('R70')
    expect(labelPlate('R12')).toBe('R12')
    expect(labelPlate('  AB7  toilets')).toBe('AB7')
    expect(labelPlate('T8678')).toBe('T8678')
  })

  it('keeps one letter after the number, since R24 and R24B are two boxes', () => {
    expect(labelPlate('R24B')).toBe('R24B')
    expect(labelPlate('R24B PUMPS')).toBe('R24B')
  })

  it('finds none in a name of words, or one that runs on past the number', () => {
    expect(labelPlate('CONCRETE MIX')).toBeNull()
    expect(labelPlate('PVC COUNT')).toBeNull()
    expect(labelPlate('3/4 PEX')).toBeNull()
    expect(labelPlate('R74PEX')).toBeNull()
    expect(labelPlate('Unsorted')).toBeNull()
  })

  it('prints the letters and number alone, and a name of words whole', () => {
    const names = labelPrintNames([b('1', 'R74 3/4 PEX'), b('2', 'R12'), b('3', 'CONCRETE MIX'), b('4', 'R24B')])
    expect([...names.values()]).toEqual(['R74', 'R12', 'CONCRETE MIX', 'R24B'])
  })

  it('prints both names whole when two live boxes would read the same', () => {
    const names = labelPrintNames([b('1', 'R74 3/4 PEX'), b('2', 'R74'), b('3', 'R76 TOILETS'), b('4', 'R76 SINKS')])
    expect([...names.values()]).toEqual(['R74 3/4 PEX', 'R74', 'R76 TOILETS', 'R76 SINKS'])
  })

  it('does not let a retired box hold a short name', () => {
    const names = labelPrintNames([b('1', 'R74 3/4 PEX'), b('2', 'R74', '2026-11-02T00:00:00Z')])
    expect(names.get('1')).toBe('R74')
  })

  it('falls back to the whole name for a box that is not in the list', () => {
    expect(labelPrintName(new Map(), { id: 'x', label: 'R74 3/4 PEX' })).toBe('R74 3/4 PEX')
  })

  it('says under the pick which labels print shorter, and nothing when none does', () => {
    const all = [b('1', 'R74 3/4 PEX'), b('2', 'R12'), b('3', 'R76 TOILETS'), b('4', 'CONCRETE MIX')]
    const names = labelPrintNames(all)
    expect(shortenedLabelsNote(all, names)).toBe('R74 3/4 PEX prints as R74, and 1 more like it. A label carries the letter and number alone.')
    expect(shortenedLabelsNote([all[0]!], names)).toBe('R74 3/4 PEX prints as R74. A label carries the letter and number alone.')
    expect(shortenedLabelsNote([all[1]!, all[3]!], names)).toBeNull()
  })
})
