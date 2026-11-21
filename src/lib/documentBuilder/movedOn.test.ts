import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { MOVED_ON_PUBLISH, MOVED_ON_SAVE, WRITE_GONE } from './documentBuildersIo'
import { MOVED_ON_KEEP, MOVED_ON_LOAD, MOVED_ON_USUAL, movedOnJobName, movedOnWords } from './movedOn'

describe('the panel for a page that fell behind', () => {
  it('says a newer draft was saved, and that what was typed stays until the person chooses', () => {
    const words = movedOnWords(MOVED_ON_USUAL, { revision: 2 }, { revision: 2 })
    expect(words.title).toBe('Your usual sheet changed somewhere else')
    expect(words.lines).toEqual(['A newer draft was saved after this page read it.', 'What you typed here is not saved. It stays on this page until you choose.'])
    expect(words.costs).toEqual(['Load the newer one drops what you typed here.', 'Save mine over it drops the newer draft.'])
    expect([words.load, words.keep]).toEqual([MOVED_ON_LOAD, MOVED_ON_KEEP])
  })

  it('names the revision when someone published since, and says it stays published', () => {
    const words = movedOnWords('Sub NDA', { revision: 2 }, { revision: 3 })
    expect(words.title).toBe('Sub NDA changed somewhere else')
    expect(words.lines[0]).toBe('Revision 3 was published after this page read it.')
    expect(words.costs[1]).toBe('Save mine over it drops the newer draft. Revision 3 stays published.')
  })

  it('names a job’s sheet by the job', () => {
    expect(movedOnJobName(' Cedar Park Medical Office ')).toBe('The sheet for Cedar Park Medical Office')
    expect(movedOnJobName('')).toBe("This job's sheet")
  })

  it('is plain words, the refusals too', () => {
    const all = [...Object.values(movedOnWords(MOVED_ON_USUAL, { revision: 1 }, { revision: 2 })).flat(), ...Object.values(movedOnWords(MOVED_ON_USUAL, { revision: 1 }, { revision: 1 })).flat(), MOVED_ON_SAVE, MOVED_ON_PUBLISH, WRITE_GONE]
    for (const line of all) expect(plainWordsFailures(line), line).toEqual([])
  })
})
