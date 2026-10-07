/**
 * Main's own test for a hold's words inside a list (the schedule's PR 1b), as the morning list
 * says them: the spike's own cases.
 */
import { describe, expect, it } from 'vitest'
import { holdWordsInList } from './notReady'

describe('a hold’s words inside a list', () => {
  it('lowers a first word that starts a sentence, and keeps a name, a number and a short form', () => {
    expect(holdWordsInList('The transformer, expected Oct 15 and not in')).toBe('the transformer, expected Oct 15 and not in')
    expect(holdWordsInList('RFI-004, waiting on us')).toBe('RFI-004, waiting on us')
    expect(holdWordsInList('CPS Energy service drop, expected Oct 15 and not in')).toBe('CPS Energy service drop, expected Oct 15 and not in')
    for (const first of ['A', 'An', 'Their', 'Its', 'Our']) expect(holdWordsInList(`${first} new panel`)).toBe(`${first.toLowerCase()} new panel`)
    expect(holdWordsInList('Anchor bolts')).toBe('Anchor bolts')
    expect(holdWordsInList('A/C units')).toBe('A/C units')
  })
})
