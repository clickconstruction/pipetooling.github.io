import { describe, expect, it } from 'vitest'
import { answeredWords, foldNameAnswers, listedName, listedOnWords, nameGrade, nameStanding, questionWords, standingChip, tiePreviewWords, tiedNames, wordOfWords, type NameAnswerRow } from './nameAnswers'

// Every name here is made up.
const GC = 'Ridgeway Builders'
const ME = 'u1'
const names: Record<string, string> = { u1: 'Eve', u2: 'Sam' }
const nameOf = (id: string) => names[id] ?? null

let n = 0
function row(over: Partial<NameAnswerRow> = {}): NameAnswerRow {
  n += 1
  return { id: `a${n}`, builder_key: 'danawhitlow', customer_id: 'c1', answer: 'works_for', scope: 'all', permit_id: 'p1', name: 'Dana Whitlow', answered_by: 'u2', answered_at: `2026-11-10T1${n % 10}:00:00Z`, ...over }
}
const permit = { id: 'p1', contact: 'Dana Whitlow', builder_key: 'danawhitlow' }
const NONE = new Map<string, string | null>()

describe('foldNameAnswers', () => {
  it('lets the newest decisive answer stand', () => {
    const rows = [
      row({ answered_at: '2026-11-01T15:00:00Z' }),
      row({ answer: 'someone_else', scope: null, answered_at: '2026-11-02T15:00:00Z', answered_by: 'u1' }),
    ]
    expect(foldNameAnswers(rows, ['c1']).get('danawhitlow')).toMatchObject({ all: false, someoneElse: true, by: 'u1', at: '2026-11-02T15:00:00Z' })
    expect(foldNameAnswers([...rows].reverse(), ['c1']).get('danawhitlow')).toMatchObject({ someoneElse: true })
  })

  it('keeps permits tied one at a time, and widens to all', () => {
    const one = [row({ scope: 'this_permit', permit_id: 'p1', answered_at: '2026-11-01T15:00:00Z' }), row({ scope: 'this_permit', permit_id: 'p2', answered_at: '2026-11-02T15:00:00Z' })]
    expect(foldNameAnswers(one, ['c1']).get('danawhitlow')).toMatchObject({ all: false, permitIds: ['p1', 'p2'] })
    expect(foldNameAnswers([...one, row({ scope: 'all', answered_at: '2026-11-03T15:00:00Z' })], ['c1']).get('danawhitlow')).toMatchObject({ all: true })
  })

  it('takes an answer back, so the question comes back', () => {
    const rows = [row({ answered_at: '2026-11-01T15:00:00Z' }), row({ answer: 'taken_back', scope: null, answered_at: '2026-11-02T15:00:00Z' })]
    expect(foldNameAnswers(rows, ['c1']).get('danawhitlow')).toMatchObject({ all: false, permitIds: [], someoneElse: false, by: null, at: null })
  })

  it('remembers who is not sure without settling anything', () => {
    const rows = [row({ answer: 'not_sure', scope: null, answered_by: 'u1' }), row({ answer: 'not_sure', scope: null, answered_by: 'u1' })]
    expect(foldNameAnswers(rows, ['c1']).get('danawhitlow')).toMatchObject({ all: false, someoneElse: false, notSureBy: ['u1'], by: null })
  })

  it('reads one GC under two customer rows as one, and leaves another GC’s answers out', () => {
    const rows = [row({ customer_id: 'c2' }), row({ customer_id: 'c9', builder_key: 'other', name: 'Other Name' })]
    const states = foldNameAnswers(rows, ['c1', 'c2'])
    expect([...states.keys()]).toEqual(['danawhitlow'])
  })
})

describe('nameStanding', () => {
  const states = (rows: NameAnswerRow[]) => foldNameAnswers(rows, ['c1'])

  it('asks while nothing is settled', () => {
    expect(nameStanding(permit, GC, states([]), ME, NONE)).toEqual({ kind: 'ask', key: 'danawhitlow', name: 'Dana Whitlow', grade: 'possible' })
  })

  it('does not ask about the GC’s own name, or a permit that lists nobody', () => {
    expect(nameStanding({ id: 'p1', contact: 'Ridgeway Builders, LLC', builder_key: 'ridgewaybuilders' }, GC, states([]), ME, NONE).kind).toBe('own_name')
    expect(nameStanding({ id: 'p1', contact: null, builder_key: null }, GC, states([]), ME, NONE)).toEqual({ kind: 'nobody' })
  })

  it('reads the key off the contact line when the row carries none', () => {
    expect(nameStanding({ id: 'p1', contact: 'Paula Kemp, Hartwell Interiors LLC' }, GC, states([]), ME, NONE)).toEqual({ kind: 'ask', key: 'hartwellinteriors', name: 'Hartwell Interiors LLC', grade: 'possible' })
  })

  it('is settled by a tie to every permit, or to this one alone', () => {
    expect(nameStanding(permit, GC, states([row()]), ME, NONE)).toMatchObject({ kind: 'tied', scope: 'all', by: 'u2' })
    const one = states([row({ scope: 'this_permit', permit_id: 'p1' })])
    expect(nameStanding(permit, GC, one, ME, NONE)).toMatchObject({ kind: 'tied', scope: 'this_permit' })
    // Another permit under the same name is still open.
    expect(nameStanding({ ...permit, id: 'p2' }, GC, one, ME, NONE).kind).toBe('ask')
  })

  it('is settled by someone else, and never asked of a name that files for others', () => {
    expect(nameStanding(permit, GC, states([row({ answer: 'someone_else', scope: null })]), ME, NONE).kind).toBe('someone_else')
    expect(nameStanding(permit, GC, states([]), ME, new Map([['danawhitlow', 'files_for_others']])).kind).toBe('files_for_others')
  })

  it('stays open for everyone but the person who was not sure', () => {
    const s = states([row({ answer: 'not_sure', scope: null, answered_by: 'u1' })])
    expect(nameStanding(permit, GC, s, 'u1', NONE).kind).toBe('not_sure')
    expect(nameStanding(permit, GC, s, 'u2', NONE).kind).toBe('ask')
  })

  it('asks the likely grade when one name begins the other, and still ties nothing by itself', () => {
    const branch = { id: 'p1', contact: 'Ridgeway Builders of Texas LLC', builder_key: 'ridgewaybuildersoftexas' }
    expect(nameStanding(branch, GC, states([]), ME, NONE)).toEqual({ kind: 'ask', key: 'ridgewaybuildersoftexas', name: 'Ridgeway Builders of Texas LLC', grade: 'likely' })
    // The answers settle it the way they settle any name: the same rows.
    const tied = states([row({ builder_key: 'ridgewaybuildersoftexas', name: 'Ridgeway Builders of Texas LLC' })])
    expect(nameStanding(branch, GC, tied, ME, NONE)).toMatchObject({ kind: 'tied', scope: 'all' })
    const no = states([row({ builder_key: 'ridgewaybuildersoftexas', answer: 'someone_else', scope: null })])
    expect(nameStanding(branch, GC, no, ME, NONE).kind).toBe('someone_else')
    const passed = states([row({ builder_key: 'ridgewaybuildersoftexas', answer: 'not_sure', scope: null, answered_by: ME })])
    expect(nameStanding(branch, GC, passed, ME, NONE).kind).toBe('not_sure')
    // A name that files for others is never asked, however alike.
    expect(nameStanding(branch, GC, states([]), ME, new Map([['ridgewaybuildersoftexas', 'files_for_others']])).kind).toBe('files_for_others')
  })
})

describe('nameGrade', () => {
  it('is likely when one name begins the other, either way round, word for word', () => {
    expect(nameGrade('Ridgeway Builders of Texas LLC', GC)).toBe('likely')
    expect(nameGrade('Ridgeway Builders San Antonio', GC)).toBe('likely')
    expect(nameGrade('Ridgeway', 'Ridgeway Builders')).toBe('likely')
    // A legal word apart is the longer legal name too, though the keys differ.
    expect(nameGrade('Ridgeway Builders LP', GC)).toBe('likely')
  })

  it('is possible for a shared word, a near miss, a person, or a word that only starts the same', () => {
    expect(nameGrade('Ridgeway Roofing Co', GC)).toBe('possible')
    expect(nameGrade('Ridgway Builders', GC)).toBe('possible')
    expect(nameGrade('Dana Whitlow', GC)).toBe('possible')
    expect(nameGrade('Ridgewayne Builders', GC)).toBe('possible')
    // A trade word alone begins nothing.
    expect(nameGrade('Builders', 'Builders Supply Group')).toBe('possible')
  })
})

describe('the words', () => {
  it('names the contact the way a person reads it', () => {
    expect(listedName('Paula Kemp, Hartwell Interiors LLC')).toBe('Hartwell Interiors LLC')
    expect(listedName('Dana Whitlow')).toBe('Dana Whitlow')
    expect(listedName(null)).toBeNull()
  })

  it('asks the question with its reason', () => {
    expect(questionWords('Dana Whitlow', GC)).toEqual({
      lead: 'The city lists Dana Whitlow on this permit.',
      ask: 'Do you know who that is?',
      worksFor: 'Works for Ridgeway Builders',
      someoneElse: 'Someone else…',
      why: 'Asked because you are bidding this address to Ridgeway Builders. Asked once.',
    })
  })

  it('asks Same company? on the likely grade, beside the customer’s own name', () => {
    expect(questionWords('Ridgeway Builders of Texas LLC', GC, 'likely')).toEqual({
      lead: 'The city lists Ridgeway Builders of Texas LLC on this permit. Your customer is Ridgeway Builders.',
      ask: 'Same company?',
      worksFor: 'Same company',
      someoneElse: 'Not them…',
      why: 'Asked because one name begins the other. Asked once.',
    })
    expect(questionWords('Hartwell', 'Hartwell & Assoc.', 'likely').lead).toBe('The city lists Hartwell on this permit. Your customer is Hartwell & Assoc.')
    expect(questionWords('Dana Whitlow', GC, 'possible')).toEqual(questionWords('Dana Whitlow', GC))
  })

  it('ends a sentence once after a name that ends in a full stop', () => {
    expect(questionWords('Dana Whitlow', 'Hartwell & Assoc.').why).toBe('Asked because you are bidding this address to Hartwell & Assoc. Asked once.')
    expect(tiePreviewWords('Dana Whitlow', 'Hartwell & Assoc.', 0).lead).toBe('Dana Whitlow works for Hartwell & Assoc. The city lists Dana Whitlow on no other permit we can see.')
  })

  it('shows what a tie would do before it does it', () => {
    expect(tiePreviewWords('Dana Whitlow', GC, 7)).toEqual({
      lead: 'Dana Whitlow works for Ridgeway Builders. The city lists Dana Whitlow on 7 other permits we can see.',
      all: 'Show all 7 under Ridgeway Builders',
      one: 'This permit only',
      why: 'Look at them first. One person can file for more than one builder.',
    })
    expect(tiePreviewWords('Dana Whitlow', GC, 1).lead).toBe('Dana Whitlow works for Ridgeway Builders. The city lists Dana Whitlow on 1 other permit we can see.')
    expect(tiePreviewWords('Dana Whitlow', GC, 0)).toMatchObject({ all: 'Tie Dana Whitlow to Ridgeway Builders', one: null })
  })

  it('shows a likely tie as the same company, with the same two presses', () => {
    expect(tiePreviewWords('Ridgeway Builders of Texas LLC', GC, 7, 'likely')).toEqual({
      lead: 'Ridgeway Builders of Texas LLC is the same company as Ridgeway Builders. The city lists Ridgeway Builders of Texas LLC on 7 other permits we can see.',
      all: 'Show all 7 under Ridgeway Builders',
      one: 'This permit only',
      why: 'Look at them first. Two companies can share the start of a name.',
    })
    expect(tiePreviewWords('Ridgeway Builders of Texas LLC', GC, 0, 'likely')).toMatchObject({ lead: 'Ridgeway Builders of Texas LLC is the same company as Ridgeway Builders. The city lists Ridgeway Builders of Texas LLC on no other permit we can see.', one: null })
  })

  it('says whose word an answer is', () => {
    expect(wordOfWords('u1', '2026-11-10T18:00:00Z', 'u1', nameOf)).toBe('your word, Nov 10')
    expect(wordOfWords('u2', '2026-11-10T18:00:00Z', 'u1', nameOf)).toBe('Sam’s word, Nov 10')
    expect(wordOfWords('u7', null, 'u1', nameOf)).toBe('a teammate’s word')
    expect(wordOfWords(null, null, 'u1', nameOf)).toBe('')
  })

  it('says what an answer did', () => {
    const tied = { kind: 'tied' as const, key: 'danawhitlow', name: 'Dana Whitlow', scope: 'all' as const, by: 'u1', at: null }
    expect(answeredWords(tied, GC, 7, 'your word, Nov 10')).toBe('Tied on your word, Nov 10. Dana Whitlow works for Ridgeway Builders. 7 other permits now show under Ridgeway Builders.')
    expect(answeredWords(tied, GC, 1, 'your word, Nov 10')).toBe('Tied on your word, Nov 10. Dana Whitlow works for Ridgeway Builders. 1 other permit now shows under Ridgeway Builders.')
    expect(answeredWords({ ...tied, scope: 'this_permit' }, GC, 7, '')).toBe('Tied. Dana Whitlow works for Ridgeway Builders. This permit only.')
    expect(answeredWords(tied, GC, 0, 'Sam’s word, Nov 9')).toBe('Tied on Sam’s word, Nov 9. Dana Whitlow works for Ridgeway Builders.')
    expect(answeredWords({ kind: 'someone_else', key: 'k', name: 'Dana Whitlow', by: 'u2', at: null }, GC, 0, 'Sam’s word, Nov 10')).toBe('Sam’s word, Nov 10. Dana Whitlow does not work for Ridgeway Builders.')
    expect(answeredWords({ kind: 'not_sure', key: 'k', name: 'Dana Whitlow' }, GC, 0, '')).toBe('You said you are not sure who Dana Whitlow is. The question stays open for the rest of the team.')
    expect(answeredWords({ kind: 'ask', key: 'k', name: 'Dana Whitlow', grade: 'possible' }, GC, 0, '')).toBeNull()
  })

  it('says what an answer on the likely grade did, as the same company', () => {
    const tied = { kind: 'tied' as const, key: 'k', name: 'Ridgeway Builders of Texas LLC', scope: 'all' as const, by: 'u1', at: null }
    expect(answeredWords(tied, GC, 7, 'your word, Nov 10')).toBe('Tied on your word, Nov 10. Ridgeway Builders of Texas LLC is the same company as Ridgeway Builders. 7 other permits now show under Ridgeway Builders.')
    expect(answeredWords({ kind: 'someone_else', key: 'k', name: 'Ridgeway Builders of Texas LLC', by: 'u2', at: null }, GC, 0, 'Sam’s word, Nov 10')).toBe('Sam’s word, Nov 10. Ridgeway Builders of Texas LLC is not Ridgeway Builders.')
    expect(standingChip(tied, GC)).toEqual({ words: 'Same company as Ridgeway Builders', tone: 'blue' })
  })

  it('draws a chip once the question is settled', () => {
    expect(standingChip({ kind: 'tied', key: 'k', name: 'n', scope: 'all', by: null, at: null }, GC)).toEqual({ words: 'Works for Ridgeway Builders', tone: 'blue' })
    expect(standingChip({ kind: 'own_name', key: 'k', name: 'n' }, GC)).toEqual({ words: 'Their own name', tone: 'blue' })
    expect(standingChip({ kind: 'someone_else', key: 'k', name: 'n', by: null, at: null }, GC)).toEqual({ words: 'Not theirs', tone: 'grey' })
    expect(standingChip({ kind: 'ask', key: 'k', name: 'n', grade: 'possible' }, GC)).toBeNull()
  })
})

describe('tiedNames', () => {
  it('lists the GC’s own name, then the names tied to it, each with how it was tied', () => {
    const states = foldNameAnswers(
      [
        row({ answered_by: 'u1', answered_at: '2026-11-10T18:00:00Z' }),
        row({ builder_key: 'marlowdesign', name: 'Marlow Design Group', scope: 'this_permit', permit_id: 'p9', answered_by: 'u2', answered_at: '2026-11-09T18:00:00Z' }),
        row({ builder_key: 'hartwell', name: 'Hartwell Interiors', answer: 'someone_else', scope: null }),
        row({ builder_key: 'ridgewaybuilderstexas', name: 'Ridgeway Builders of Texas LLC', answered_by: 'u2', answered_at: '2026-11-08T18:00:00Z' }),
      ],
      ['c1'],
    )
    expect(tiedNames(states, GC, ME, nameOf)).toEqual([
      { key: 'ridgewaybuilders', name: 'Ridgeway Builders', how: 'Their own name', tie: 'own', permitIds: [] },
      { key: 'danawhitlow', name: 'Dana Whitlow', how: 'Works for them · your word, Nov 10', tie: 'all', permitIds: [] },
      { key: 'marlowdesign', name: 'Marlow Design Group', how: 'Tied on 1 permit · Sam’s word, Nov 9', tie: 'permits', permitIds: ['p9'] },
      { key: 'ridgewaybuilderstexas', name: 'Ridgeway Builders of Texas LLC', how: 'Same company · Sam’s word, Nov 8', tie: 'all', permitIds: [] },
    ])
  })

  it('counts what a name is listed on, as far back as the records go', () => {
    expect(listedOnWords(7, 'since Aug 26')).toBe('Listed on 7 permits since Aug 26')
    expect(listedOnWords(1, null)).toBe('Listed on 1 permit we can see')
    expect(listedOnWords(0, 'since Aug 26')).toBe('Listed on no permit since Aug 26')
    expect(listedOnWords(0, null)).toBe('Listed on no permit we can see')
  })
})
