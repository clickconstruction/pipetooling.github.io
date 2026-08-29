import { describe, expect, it } from 'vitest'
import { openRfiAssumptions, substrateNotesToSuggestions } from './scopeSheet'

describe('substrateNotesToSuggestions', () => {
  it('exclusion_candidate → exclusion; certification/risk → risk; plain notes ignored', () => {
    const out = substrateNotesToSuggestions([
      { category: 'renovation', text: { value: 'Sprinkler rework fully specified on P001' }, flags: ['exclusion_candidate', 'risk'], source_sheet: 'P001' },
      { category: 'animal_gas', text: { value: 'NFPA 99 certification required' }, flags: ['certification_required'] },
      { category: 'general', text: { value: 'drawings are diagrammatic' }, flags: ['scope_commitment'] },
      { category: 'general', text: { value: '' }, flags: ['exclusion_candidate'] },
    ])
    expect(out).toEqual([
      { kind: 'exclusion', text: 'Sprinkler rework fully specified on P001', source: 'P001' },
      { kind: 'risk', text: 'NFPA 99 certification required', source: 'animal_gas' },
    ])
  })
  it('accepts plain-string text', () => {
    expect(substrateNotesToSuggestions([{ text: 'impact fees excluded', flags: ['exclusion_candidate'] }])[0]?.text).toBe('impact fees excluded')
  })
})

describe('openRfiAssumptions', () => {
  it('draft/approved/sent become assumptions; answered/withdrawn drop', () => {
    const out = openRfiAssumptions([
      { rfi_number: 1, question: 'gas or all-electric?', status: 'sent', answer: null },
      { rfi_number: 2, question: 'sprinkler in package?', status: 'draft', answer: null },
      { rfi_number: 3, question: 'answered one', status: 'answered', answer: 'yes' },
      { rfi_number: 4, question: 'withdrawn one', status: 'withdrawn', answer: null },
    ])
    expect(out.map((s) => s.source)).toEqual(['RFI-1', 'RFI-2'])
    expect(out[0]?.text).toContain('(sent, unanswered)')
    expect(out[1]?.text).toContain('(not yet sent)')
    expect(out.every((s) => s.kind === 'assumption')).toBe(true)
  })
})
