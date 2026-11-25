import { describe, expect, it } from 'vitest'
import { DECLINE_WORDS, PROPOSAL_WORDS, declineWhy, decidedWords, proposalChanges, proposalHead, proposalProblem, stricterChoices, takeWords } from './jobPaperProposal'
import { parseSettingsDef, type SettingsDef } from './paperSettings'

/** Made-up words: two topics, the first with a choice that leaves it out. */
const def = parseSettingsDef({
  settings: [
    { key: 'photos', label: 'Photos and video', choices: [
      { key: 'off', label: 'Off', says: 'Placeholder: no photo rule.', out: true },
      { key: 'standard', label: 'Standard', says: 'Placeholder: ask first.' },
      { key: 'strict', label: 'Strict', says: 'Placeholder: no photos.' },
    ] },
    { key: 'term', label: 'How long', choices: [
      { key: 'short', label: 'Short', says: 'Placeholder: a short term.' },
      { key: 'long', label: 'Long', says: 'Placeholder: a long term.' },
    ] },
  ],
  fields: [],
  levels: [],
}) as SettingsDef

const from = { photos: 'standard', term: 'short' }

describe('jobPaperProposal · a GC proposes, the office answers', () => {
  it('lists only the topics a proposal moves, in the list’s order, with the words of the choice asked for', () => {
    expect(proposalChanges(def, from, { photos: 'strict', term: 'long' })).toEqual([
      { key: 'photos', label: 'Photos and video', from: 'Standard', to: 'Strict', says: 'Placeholder: no photos.' },
      { key: 'term', label: 'How long', from: 'Short', to: 'Long', says: 'Placeholder: a long term.' },
    ])
    expect(proposalChanges(def, from, { photos: 'standard', term: 'long' }).map((c) => c.key)).toEqual(['term'])
    expect(proposalChanges(def, from, from)).toEqual([])
    // A choice the list no longer has is not a move, and a topic the job never had reads as not set.
    expect(proposalChanges(def, from, { photos: 'loud', term: 'short' })).toEqual([])
    expect(proposalChanges(def, null, { photos: 'standard', term: 'short' }).map((c) => c.from)).toEqual(['Not set', 'Not set'])
  })

  it('offers a GC the job’s own choice and every stricter one', () => {
    const photos = def.settings[0]!
    expect(stricterChoices(def, photos, 'standard').map((c) => c.key)).toEqual(['standard', 'strict'])
    expect(stricterChoices(def, photos, 'strict').map((c) => c.key)).toEqual(['strict'])
    expect(stricterChoices(def, photos, 'off').map((c) => c.key)).toEqual(['off', 'standard', 'strict'])
    // A pick the list does not have starts from the loosest.
    expect(stricterChoices(def, photos, 'loud').map((c) => c.key)).toEqual(['off', 'standard', 'strict'])
  })

  it('says what stops a proposal, in the page’s order', () => {
    const ask = { def, from, to: { photos: 'strict', term: 'short' }, name: 'Greta Sample', hasNotice: true, ticked: true }
    expect(proposalProblem(ask)).toBeNull()
    expect(proposalProblem({ ...ask, to: from })).toBe(PROPOSAL_WORDS.nothing)
    expect(proposalProblem({ ...ask, to: { photos: 'off', term: 'short' } })).toBe(PROPOSAL_WORDS.looser)
    expect(proposalProblem({ ...ask, to: { photos: 'off', term: 'long' } })).toBe(PROPOSAL_WORDS.looser)
    expect(proposalProblem({ ...ask, ticked: false })).toBe(PROPOSAL_WORDS.notice)
    expect(proposalProblem({ ...ask, ticked: false, hasNotice: false })).toBeNull()
    expect(proposalProblem({ ...ask, name: '  ' })).toBe(PROPOSAL_WORDS.name)
    // The notice comes before the name, as the page asks for them.
    expect(proposalProblem({ ...ask, ticked: false, name: '' })).toBe(PROPOSAL_WORDS.notice)
  })

  it('words the office’s take by who has signed', () => {
    expect(takeWords(0)).toEqual({
      press: 'Take it',
      title: 'Take the GC’s proposal?',
      lines: ['The paper gets the stricter settings.', 'Nobody has signed yet, so nobody signs again.'],
      confirm: 'Take the proposal',
    })
    expect(takeWords(1).press).toBe('Take it, and ask 1 person to sign again')
    expect(takeWords(3).confirm).toBe('Take it, and ask 3 people to sign again')
    expect(takeWords(3).lines[1]).toBe('3 people have signed this paper. Each signs the new version again, and the job stays closed to each until then.')
    expect(takeWords(1).lines[1]).toContain('1 person has signed this paper.')
  })

  it('words the answer and the card’s head', () => {
    expect(decidedWords({ took: false, signAgain: 0 })).toBe('The proposal is declined. The GC’s page says so.')
    expect(decidedWords({ took: true, signAgain: 0 })).toBe('The proposal is taken. Nobody signs again.')
    expect(decidedWords({ took: true, signAgain: 2 })).toBe('The proposal is taken. 2 people sign the new version again.')
    expect(decidedWords({ took: true, signAgain: 1 })).toBe('The proposal is taken. 1 person signs the new version again.')
    expect(proposalHead('Greta Sample', 'Nov 24, 2026')).toBe('Greta Sample proposed stricter settings on Nov 24, 2026')
    expect(proposalHead('  ', null)).toBe('The GC proposed stricter settings')
    expect(DECLINE_WORDS.confirm).toBe('Decline the proposal')
  })

  it('a decline carries a reason or is not sent: spaces alone and a cancelled window are no reason', () => {
    expect(declineWhy('  Placeholder reason.  ')).toBe('Placeholder reason.')
    expect(declineWhy('')).toBeNull()
    expect(declineWhy('   ')).toBeNull()
    expect(declineWhy(null)).toBeNull()
  })
})
