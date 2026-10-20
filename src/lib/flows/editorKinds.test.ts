import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { EDITOR_KINDS, PEOPLE_NOT_READ, readsPeopleOf } from './editorKinds'
import { FLOW_KINDS } from './facts'
import { SEED_FLOWS } from './seed'

describe('flows/editorKinds', () => {
  it('edits every flow but the unknown number’s, the GC three first', () => {
    expect(EDITOR_KINDS.map(([k, label]) => `${k}:${label}`)).toEqual([
      'customer:Customer',
      'trade:Trade partner',
      'arch:Architect',
      'residential:Residential customer',
      'sub:Sub',
    ])
    // A kind the app learns later shows up here or fails this line.
    expect(EDITOR_KINDS.map(([k]) => k).sort()).toEqual(FLOW_KINDS.filter((k) => k !== 'unknown').sort())
    for (const [k] of EDITOR_KINDS) expect(SEED_FLOWS[k].lanes.flatMap((l) => l.steps).length).toBeGreaterThan(0)
  })

  it('reads who is on a flow only where flow_rows_kind does', () => {
    expect(EDITOR_KINDS.filter(([k]) => readsPeopleOf(k)).map(([k]) => k)).toEqual(['customer', 'trade', 'arch'])
  })

  it('says so in plain words', () => {
    expect(plainWordsFailures(PEOPLE_NOT_READ)).toEqual([])
    for (const [, label] of EDITOR_KINDS) expect(plainWordsFailures(label)).toEqual([])
  })
})
