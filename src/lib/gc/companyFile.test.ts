/**
 * The tests of `gcCompanyFile.test.ts` on branch spike/gc-mode that read only these kernels and the made-up data,
 * moved word for word (the Board's B2-ii). The data is `schedule/testState.ts`. The tests that play the
 * prototype's reducer or read another lane stay on the spike, where they run against these kernels.
 */
import { describe, expect, it } from 'vitest'
import { partnerDocuments, partnerPaper } from './companyFile'
import { partnerById } from './lookups'
import { initialGcState } from './schedule/testState'
import type { GcState, Partner } from './types'

function partner(state: GcState, id: string): Partner {
  const p = partnerById(state, id)
  if (!p) throw new Error(`no ${id}`)
  return p
}

const docOf = (state: GcState, id: string, key: string) =>
  partnerDocuments(state, partner(state, id)).groups.flatMap((g) => g.docs).find((d) => d.key === key)

describe("a company's window (the owner, 2026-10-04)", () => {
  it('Documents lead with what is missing, and say what each one is', () => {
    const state = initialGcState()
    const pecan = partnerDocuments(state, partner(state, 'pecanvalley'))
    expect(pecan.groups.map((g) => g.title)).toEqual(['Their company papers', 'Fair Oaks Shops, Building D · Electrical', 'Their quotes'])
    // Their insurance ran out and draw 1's unconditional waiver is owed: two papers to get.
    expect(pecan.toGet).toBe(2)
    expect(docOf(state, 'pecanvalley', 'insurance')).toMatchObject({ status: 'missing', statusWords: 'ran out Sep 15' })
    expect(docOf(state, 'pecanvalley', 'waivers-felec')).toMatchObject({ status: 'missing', statusWords: '1 owed' })
    // A draft statement of work is ours to send, not a paper to get from them.
    expect(docOf(state, 'kendall', 'sow-dhvac')).toMatchObject({ status: 'info', statusWords: 'drafted, not sent yet' })
  })

  it('a W-9 never shows the tax number', () => {
    const state = initialGcState()
    const paper = partnerPaper(state, partner(state, 'ironhorse'), 'w9')
    expect(paper?.rows.find((r) => r.label === 'Tax number')?.value).toBe('on file · never shown here')
  })

  it('a paper shows what it holds: the waivers by draw', () => {
    const state = initialGcState()
    const paper = partnerPaper(state, partner(state, 'pecanvalley'), 'waivers-felec')
    expect(paper?.table?.rows).toEqual([
      ['1', 'in, with the pay application', 'owed since Aug 29'],
      ['2', 'in, with the pay application', 'once it is paid'],
    ])
    expect(partnerPaper(state, partner(state, 'pecanvalley'), 'no-such-paper')).toBeNull()
  })
})
