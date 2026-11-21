/** A walked builder's link (punch list #404, step 8). The paper is the made-up one. */
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { INSURANCE_SHEET_FIXTURE } from './insuranceSheet.fixture'
import { WALKED_LINK_WORDS, walkedLinkCardWords, walkedLinkPage } from './linkPage'
import { SECRECY_PAPER_FIXTURE } from './secrecyPaper.fixture'

const paper = (): unknown => JSON.parse(JSON.stringify(SECRECY_PAPER_FIXTURE))

describe('what a builder’s link opens', () => {
  it('is the published paper, under the name someone outside reads and its revision', () => {
    const page = walkedLinkPage({ builder: 'sub-nda', revision: 3, contents: paper() })
    expect(page?.name).toBe('Secrecy on your jobs')
    expect(page?.stamp).toBe('Revision 3')
    expect(page?.def.topics).toHaveLength(7)
    expect(page?.def.levels.map((l) => l.id)).toEqual(['std', 'gov', 'mid', 'strict'])
  })

  it('never reads the office’s own name for the builder, and has a name for a builder it does not know', () => {
    expect(walkedLinkPage({ builder: 'sub-nda', revision: 1, contents: paper() })?.name).not.toMatch(/nda/i)
    expect(walkedLinkPage({ builder: 'another-walked', revision: 1, contents: paper() })?.name).toBe(WALKED_LINK_WORDS.name)
  })

  it('opens a paper that breaks a rule made after it was published: only its shape is checked', () => {
    const loose = paper() as { notice: { lines: string[] } }
    loose.notice.lines = [...loose.notice.lines, 'A made-up line that runs on (with a note in brackets); the rules would refuse it today.']
    expect(walkedLinkPage({ builder: 'sub-nda', revision: 2, contents: loose })?.def.notice.lines).toHaveLength(loose.notice.lines.length)
  })

  it('draws nothing for contents that are not a paper to walk', () => {
    expect(walkedLinkPage({ builder: 'insurance', revision: 1, contents: JSON.parse(JSON.stringify(INSURANCE_SHEET_FIXTURE)) })).toBeNull()
    for (const none of [null, undefined, 'a paper', 4, [], {}]) expect(walkedLinkPage({ builder: 'sub-nda', revision: 1, contents: none })).toBeNull()
  })
})

describe('the words', () => {
  it('name the revision a link opens, and say it is a look only', () => {
    const words = walkedLinkCardWords(4)
    expect(words.on).toContain('revision 4')
    expect(words.on).toContain('They only look.')
    expect(words.title).toBe("This builder's link")
  })

  it('pass the plain-words rules', () => {
    const texts = [...Object.values(WALKED_LINK_WORDS), ...Object.values(walkedLinkCardWords(12))]
    expect(texts.flatMap((t) => plainWordsFailures(t))).toEqual([])
  })
})
