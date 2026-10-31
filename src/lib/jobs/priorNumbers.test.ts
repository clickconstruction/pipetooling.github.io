/**
 * A job's prior numbers (v2.6226): the entry shape, the parse, the labels in the job's prefix, the words.
 */
import { describe, expect, it } from 'vitest'
import { parsePriorNumber, priorNumberEntry, priorNumberLabels, priorNumbersBare, priorNumbersWords } from './priorNumbers'

describe('prior numbers', () => {
  it('writes and reads the two kinds of entry, and reads a bare number as an HCP number', () => {
    expect(priorNumberEntry('hcp', ' 550 ')).toBe('HCP 550')
    expect(priorNumberEntry('click', '543')).toBe('C# 543')
    expect(parsePriorNumber('HCP 550')).toEqual({ kind: 'hcp', number: '550' })
    expect(parsePriorNumber('c# 543')).toEqual({ kind: 'click', number: '543' })
    expect(parsePriorNumber('549')).toEqual({ kind: 'hcp', number: '549' })
    expect(parsePriorNumber('  ')).toBeNull()
  })
  it('labels them in the job\'s own prefix, each once, and words them', () => {
    const labels = priorNumberLabels(['HCP 550', 'C# 543', 'HCP 550', 'HCP 549'], 'JP')
    expect(labels).toEqual(['JP550', 'JP543', 'JP549'])
    expect(priorNumbersWords(labels)).toBe('also JP550, JP543, JP549')
    expect(priorNumbersWords([])).toBe('')
    expect(priorNumberLabels(null, 'JP')).toEqual([])
    expect(priorNumbersBare(['HCP 550', 'C# 543'])).toBe('also 550 · 543')
    expect(priorNumbersBare([])).toBe('')
  })
})
