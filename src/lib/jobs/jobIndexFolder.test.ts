import { describe, expect, it } from 'vitest'
import { HELD_SHOWN, INDEX_JOB_MAX_ROUNDS, addRound, emptyTally, hasRetryableHeld, heldLineWords, indexJobFromAnswer, indexedWords, indexingWords, moreHeldWords, wantsAnotherRound } from './jobIndexFolder'

/** Index this job's files (punch list #240, PR 1): the answer read, the rounds tallied, the words. Made-up names. */
describe('jobIndexFolder', () => {
  it('reads the function’s answer, dropping a held row it does not know, and nothing from a shape it does not know', () => {
    expect(indexJobFromAnswer({ indexed: 3, held: [{ id: 'a', name: 'Scan.pdf', why: 'scan' }, { id: 'b', why: 'odd' }, { why: 'big' }], remaining: 2, total: 9 })).toEqual({ indexed: 3, held: [{ id: 'a', name: 'Scan.pdf', why: 'scan' }], remaining: 2, total: 9 })
    expect(indexJobFromAnswer(null)).toEqual({ indexed: 0, held: [], remaining: 0, total: 0 })
  })

  it('tallies the rounds: counts add up, the last answer’s held list stands once the job is done, and the loop stops at zero or the cap', () => {
    let t = emptyTally()
    t = addRound(t, { indexed: 40, held: [{ id: 'a', name: 'A.pdf', why: 'slow' }], remaining: 5, total: 45 })
    expect(t).toEqual({ indexed: 40, held: [{ id: 'a', name: 'A.pdf', why: 'slow' }], remaining: 5, total: 45, rounds: 1 })
    expect(wantsAnotherRound(t)).toBe(true)
    expect(indexingWords(t)).toBe('Indexed 40 files, 5 to go…')
    t = addRound(t, { indexed: 5, held: [{ id: 'a', name: 'A.pdf', why: 'slow' }, { id: 'b', name: 'B.jpg', why: 'scan' }], remaining: 0, total: 45 })
    expect(t).toEqual({ indexed: 45, held: [{ id: 'a', name: 'A.pdf', why: 'slow' }, { id: 'b', name: 'B.jpg', why: 'scan' }], remaining: 0, total: 45, rounds: 2 })
    expect(wantsAnotherRound(t)).toBe(false)
    expect(indexedWords(t)).toBe('Indexed 45 files, 43 with their words, 2 held.')
    expect(hasRetryableHeld(t.held)).toBe(true)
    expect(hasRetryableHeld([{ id: 'b', name: 'B.jpg', why: 'scan' }])).toBe(false)
    expect(wantsAnotherRound({ ...t, remaining: 1, rounds: INDEX_JOB_MAX_ROUNDS })).toBe(false)
  })

  it('says what a held file is, folds the long tail, and names an empty job', () => {
    expect(heldLineWords({ id: 'b', name: 'B.jpg', why: 'scan' })).toBe('B.jpg: a scan with no text to read.')
    expect(indexingWords(emptyTally())).toBe('Reading the job’s folders…')
    expect(indexedWords(emptyTally())).toBe('The job’s folders hold no files to index.')
    const held = Array.from({ length: HELD_SHOWN + 3 }, (_, i) => ({ id: `h${i}`, name: `H${i}.pdf`, why: 'big' as const }))
    expect(moreHeldWords(held)).toBe('and 3 more.')
    expect(moreHeldWords(held.slice(0, HELD_SHOWN))).toBeNull()
  })
})
