import { describe, expect, it } from 'vitest'
import { contractsSweepFromAnswer } from './whereFilesGoContractsIo'

describe('one page of the contracts sweep', () => {
  it('counts a filing, an adoption and a file found by its mark as filed', () => {
    expect(contractsSweepFromAnswer({ ok: true, counts: { looked: 5, filed: 2, adopted: 1, found: 1, held: 1, marked: 0 }, left: 3 })).toEqual({ filed: 4, held: 1, looked: 5, left: 3 })
  })
  it('reads a missing field as zero, and never throws', () => {
    expect(contractsSweepFromAnswer(null)).toEqual({ filed: 0, held: 0, looked: 0, left: 0 })
    expect(contractsSweepFromAnswer({ counts: { filed: 'two' } })).toEqual({ filed: 0, held: 0, looked: 0, left: 0 })
  })
})
