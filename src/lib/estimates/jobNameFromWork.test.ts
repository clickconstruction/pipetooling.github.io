import { describe, expect, it } from 'vitest'
import { isSpecificWorkName, jobNameForCustomerAndWork, specificWorkFromLines, tidyWorkName } from './jobNameFromWork'

describe('isSpecificWorkName', () => {
  it('accepts the office’s short work names', () => {
    for (const n of ['Pretest', 'Post test', 'Pinpoint', 'Trim Set', 'Repair gas line', 'Second-floor bathroom rough-in']) {
      expect(isSpecificWorkName(n)).toBe(true)
    }
  })
  it('rejects generic service words, empties and descriptions', () => {
    for (const n of ['Item', 'custom service visit', ' Service Visit ', 'Labor', 'Job total (migrated)', 'Water heater (migrated)', 'job total', '', '   ', null, undefined]) {
      expect(isSpecificWorkName(n)).toBe(false)
    }
    expect(isSpecificWorkName('Repaired hose bib at front of house. Did not have to cut the wall, sealed it up')).toBe(false)
  })
})

describe('specificWorkFromLines', () => {
  it('names the work from exactly one specific line', () => {
    expect(specificWorkFromLines([{ line_item: 'Second-floor bathroom rough-in', description: '' }])).toBe(
      'Second-floor bathroom rough-in',
    )
    expect(specificWorkFromLines([{ line_item: '', description: '  Post   test ' }])).toBe('Post test')
    expect(specificWorkFromLines([{ line_item: 'pretest.' }])).toBe('Pretest')
    expect(specificWorkFromLines([{ line_item: 'Repair broken pipe under hall bath.' }])).toBe('Repair broken pipe under hall bath')
  })
  it('is null for no lines, several lines, a generic line or bad JSON', () => {
    expect(specificWorkFromLines([])).toBeNull()
    expect(specificWorkFromLines([{ line_item: 'Pretest' }, { line_item: 'Post test' }])).toBeNull()
    expect(specificWorkFromLines([{ line_item: 'Custom Service Visit', description: 'Repair break under foundation' }])).toBeNull()
    expect(specificWorkFromLines(null)).toBeNull()
    expect(specificWorkFromLines('x')).toBeNull()
    expect(specificWorkFromLines([null])).toBeNull()
  })
})

describe('jobNameForCustomerAndWork', () => {
  it('joins customer and work with an em dash, or gives the customer alone', () => {
    expect(jobNameForCustomerAndWork('Kimberly Coe', 'Pretest')).toBe('Kimberly Coe — Pretest')
    expect(jobNameForCustomerAndWork(' Kimberly  Coe ', null)).toBe('Kimberly Coe')
    expect(jobNameForCustomerAndWork('', 'Pretest')).toBe('')
  })
})

describe('tidyWorkName', () => {
  it('folds whitespace, drops trailing periods and capitalises the first letter', () => {
    expect(tidyWorkName('  post   test.. ')).toBe('Post test')
    expect(tidyWorkName('Trim Set')).toBe('Trim Set')
    expect(tidyWorkName('...')).toBe('')
    expect(tidyWorkName(null)).toBe('')
  })
})
