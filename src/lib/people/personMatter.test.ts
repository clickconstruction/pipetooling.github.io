import { describe, expect, it } from 'vitest'
import { PERSON_MATTER_NONE_MAIN, PERSON_MATTER_OPEN_LABEL, personMatterChipWords, personMatterStageWords, personMatterStandingWords } from './personMatter'

describe('a matter on a person (v2.6543)', () => {
  it('words the stage, closed first', () => {
    expect(personMatterStageWords({ stage: 'review', closed_at: null, closed_reason: '' })).toBe('Under review')
    expect(personMatterStageWords({ stage: 'in_house', closed_at: null, closed_reason: '' })).toBe('In house')
    expect(personMatterStageWords({ stage: 'review', closed_at: '2026-11-05T00:00:00Z', closed_reason: 'settled' })).toBe('Closed · settled')
    expect(personMatterStageWords({ stage: 'review', closed_at: '2026-11-05T00:00:00Z', closed_reason: '' })).toBe('Closed')
  })

  it('the chip names the matter and its stage, and is nothing when none stands', () => {
    expect(personMatterChipWords({ stage: 'review', closed_at: null, closed_reason: '' })).toBe('Matter · Under review')
    expect(personMatterChipWords(null)).toBeNull()
  })

  it('the standing line counts what is written', () => {
    expect(personMatterStandingWords({ narrative_md: '', updated_at: '' }, { documents: 0, entries: 0 })).toBe('no narrative yet · 0 documents · 0 steps and events')
    expect(personMatterStandingWords({ narrative_md: '## Who', updated_at: '' }, { documents: 1, entries: 1 })).toBe('narrative written · 1 document · 1 step or event')
    expect(PERSON_MATTER_NONE_MAIN).toBe('No matter on this person.')
    expect(PERSON_MATTER_OPEN_LABEL).toBe('Open a matter…')
  })
})
