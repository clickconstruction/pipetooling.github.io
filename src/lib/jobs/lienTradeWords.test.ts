import { describe, expect, it } from 'vitest'
import { lienTradeWords } from './lienTradeWords'

describe('lienTradeWords (v2.3849)', () => {
  it('a plumbing job keeps counsel’s words; blank or missing reads as plumbing', () => {
    const p = { contractor: 'plumbing contractor', work: 'the plumbing', installed: 'installed the plumbing', laborMaterials: 'Plumbing labor and materials' }
    expect(lienTradeWords('Plumbing')).toEqual(p)
    expect(lienTradeWords('plumbing')).toEqual(p)
    expect(lienTradeWords('')).toEqual(p)
    expect(lienTradeWords('  ')).toEqual(p)
    expect(lienTradeWords(null)).toEqual(p)
    expect(lienTradeWords(undefined)).toEqual(p)
  })

  it('an electrical job says so in the letter and on the form', () => {
    expect(lienTradeWords('Electrical')).toEqual({
      contractor: 'electrical contractor',
      work: 'the electrical work',
      installed: 'did the electrical work',
      laborMaterials: 'Electrical labor and materials',
    })
  })

  it('an acronym stays upper-case; a lower-cased name still starts the form’s line with a capital', () => {
    expect(lienTradeWords('HVAC')).toEqual({ contractor: 'HVAC contractor', work: 'the HVAC work', installed: 'did the HVAC work', laborMaterials: 'HVAC labor and materials' })
    expect(lienTradeWords('fire sprinkler').laborMaterials).toBe('Fire sprinkler labor and materials')
    expect(lienTradeWords('fire sprinkler').contractor).toBe('fire sprinkler contractor')
  })
})
