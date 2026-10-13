import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { emptyDraft, KIND_CARDS, newPaperClauses, newPaperCreateArgs, newPaperDoneWhen, newPaperFacts, newPaperLabel, newPaperProblems, savedWords, type NewPaperDraft } from './newPaper'

const ID = '0b5e3c1e-2f4a-4c1b-9d7e-1a2b3c4d5e6f'
const draft = (over: Partial<NewPaperDraft>): NewPaperDraft => ({ ...emptyDraft(), ...over })

describe('what a new paper still needs', () => {
  it('asks for the kind first, then a name', () => {
    expect(newPaperProblems(emptyDraft())).toEqual(['Pick what kind of paper it is.'])
    expect(newPaperProblems(draft({ kind: 'upload' }))).toEqual(['Give it a name.'])
    expect(newPaperProblems(draft({ kind: 'upload', name: 'their bond' }))).toEqual([])
  })

  it('asks for days within a year on an upload that runs out', () => {
    expect(newPaperProblems(draft({ kind: 'upload', name: 'their bond', runsOut: true, renewAskDays: 0 }))).toEqual(['Ask between 1 and 365 days before it runs out.'])
    expect(newPaperProblems(draft({ kind: 'upload', name: 'their bond', runsOut: false, renewAskDays: 0 }))).toEqual([])
  })

  it('asks a contract for a clause, and a notice for its words', () => {
    expect(newPaperProblems(draft({ kind: 'contract', name: 'the safety agreement' }))).toEqual(['A contract needs at least one clause.'])
    expect(newPaperProblems(draft({ kind: 'contract', name: 'the safety agreement', clauses: [{ en: 'Tie off above six feet.', es: '', scope: ['all'] }] }))).toEqual([])
    expect(newPaperProblems(draft({ kind: 'notice', name: 'the start letter' }))).toEqual(['Write the notice.'])
  })
})

describe('the facts that finish the step', () => {
  it('reads one fact a paper: an upload on file, or current when it runs out; a contract signed; a notice sent', () => {
    expect(newPaperFacts('upload', false, ID)).toEqual([`doc:${ID}:on_file`])
    expect(newPaperFacts('upload', true, ID)).toEqual([`doc:${ID}:current`])
    expect(newPaperFacts('contract', true, ID)).toEqual([`doc:${ID}:signed`])
    expect(newPaperFacts('notice', false, ID)).toEqual([`doc:${ID}:sent`])
  })
})

describe('what the office writes', () => {
  it('sends an upload’s days, a notice’s words and no contract words, each trimmed', () => {
    expect(newPaperCreateArgs('trade', { ...draft({ name: ' their bond ', nameEs: ' su fianza ', runsOut: true, renewAskDays: 45 }), kind: 'upload' })).toEqual({
      p_flow: 'trade',
      p_kind: 'upload',
      p_name: 'their bond',
      p_name_es: 'su fianza',
      p_renew_ask_days: 45,
      p_body_en: '',
      p_body_es: '',
    })
    expect(newPaperCreateArgs('customer', { ...draft({ name: 'the start letter', bodyEn: ' Dear {person}. ', bodyEs: 'Estimado {person}.', runsOut: true }), kind: 'notice' })).toMatchObject({ p_renew_ask_days: null, p_body_en: 'Dear {person}.', p_body_es: 'Estimado {person}.' })
    expect(newPaperCreateArgs('arch', { ...draft({ name: 'the agreement', bodyEn: 'stray words' }), kind: 'contract' })).toMatchObject({ p_body_en: '', p_body_es: '' })
  })

  it('writes each clause with words, the base when it names no trade', () => {
    const d = draft({ kind: 'contract', clauses: [{ en: ' Tie off above six feet. ', es: 'Amárrese.', scope: [] }, { en: '  ', es: 'nada', scope: ['all'] }, { en: 'Call in a locate.', es: '', scope: ['Sitework'] }] })
    expect(newPaperClauses(d)).toEqual([
      { en: 'Tie off above six feet.', es: 'Amárrese.', scope: ['all'] },
      { en: 'Call in a locate.', es: '', scope: ['Sitework'] },
    ])
    expect(newPaperClauses(draft({ kind: 'upload', clauses: [{ en: 'x', es: '', scope: ['all'] }] }))).toEqual([])
  })

  it('labels a paper without its article', () => {
    expect([newPaperLabel('their bond'), newPaperLabel('the start letter'), newPaperLabel('Safety plan'), newPaperLabel('  ')]).toEqual(['Bond', 'Start letter', 'Safety plan', ''])
  })
})

describe('the words', () => {
  it('says when the step is done for each kind', () => {
    expect(newPaperDoneWhen(draft({ kind: 'upload', name: 'their bond', runsOut: true }), 'Papers in')).toBe('Their bond is on file and its date is ahead of today. Their upload in the portal, or one we file by hand, finishes Papers in.')
    expect(newPaperDoneWhen(draft({ kind: 'contract', name: 'the safety agreement' }), 'MSA signed')).toBe('The safety agreement is signed. MSA signed finishes on the signature.')
    expect(newPaperDoneWhen(draft({ kind: 'notice', name: 'the start letter' }), 'Start date')).toBe('The start letter went. Sending it finishes Start date, and nothing comes back.')
  })

  it('says what was saved, a contract waiting for a controller or a dev when it waits', () => {
    const contract = { paperId: `doc:${ID}` as const, factIds: [], label: 'Safety agreement', kind: 'contract' as const }
    expect(savedWords({ ...contract, state: 'published' }, 'MSA signed', 3)).toBe('Safety agreement is published as v1 with 3 clauses. MSA signed finishes on the signature.')
    expect(savedWords({ ...contract, state: 'proposed' }, 'MSA signed', 1)).toBe('Safety agreement is saved with 1 clause. They wait for a controller or a dev to approve them.')
    expect(savedWords({ ...contract, kind: 'upload', label: 'Bond', state: 'published' }, 'Papers in', 0)).toBe('Bond is a paper now. Their upload finishes Papers in.')
  })

  it('says whom the clauses that wait reached, and how', () => {
    const waiting = { paperId: `doc:${ID}` as const, factIds: [], label: 'Safety agreement', kind: 'contract' as const, state: 'proposed' as const }
    expect(savedWords(waiting, 'MSA signed', 2, { names: ['Maria', 'Robert'], pushSent: 2, emailSent: 2 })).toBe('Safety agreement is saved with 2 clauses. Maria and Robert got a push and an email to approve them.')
    expect(savedWords(waiting, 'MSA signed', 1, { names: ['Maria'], pushSent: 0, emailSent: 1 })).toBe('Safety agreement is saved with 1 clause. Maria got an email to approve them.')
    expect(savedWords(waiting, 'MSA signed', 1, { names: [], pushSent: 1, emailSent: 0 })).toBe('Safety agreement is saved with 1 clause. The approvers got a push to approve them.')
    expect(savedWords(waiting, 'MSA signed', 1, { names: ['Maria'], pushSent: 0, emailSent: 0 })).toBe('Safety agreement is saved with 1 clause. They wait for a controller or a dev to approve them.')
    expect(savedWords(waiting, 'MSA signed', 1, null)).toBe('Safety agreement is saved with 1 clause. They wait for a controller or a dev to approve them.')
  })

  it('writes every sentence the window says in plain words', () => {
    const sentences = [
      ...KIND_CARDS.map((c) => c.words),
      ...newPaperProblems(emptyDraft()),
      newPaperDoneWhen(draft({ kind: 'upload', name: 'their bond', runsOut: true }), 'Papers in'),
      newPaperDoneWhen(draft({ kind: 'contract', name: 'the safety agreement' }), 'MSA signed'),
      newPaperDoneWhen(draft({ kind: 'notice', name: 'the start letter' }), 'Start date'),
      savedWords({ paperId: `doc:${ID}`, factIds: [], label: 'Safety agreement', kind: 'contract', state: 'proposed' }, 'MSA signed', 2, { names: ['Maria', 'Robert'], pushSent: 2, emailSent: 2 }),
      savedWords({ paperId: `doc:${ID}`, factIds: [], label: 'Safety agreement', kind: 'contract', state: 'proposed' }, 'MSA signed', 2, null),
    ]
    expect(sentences.flatMap((s) => plainWordsFailures(s))).toEqual([])
  })
})
