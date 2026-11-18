import { describe, expect, it } from 'vitest'
import { letterBlanks, letterBlanksWords, letterCopiedWords, letterCopyText, letterLeavesWordsOut, letterLeftOutWords, letterMarks, letterPieceLabel, letterStillSaysWords, markdownToPlainText } from './letterCopyText'

/** A made-up letter: a draft banner, the letter, a variant under its own heading and internal notes. */
const LETTER = [
  '# DRAFT: notice to customers',
  '',
  '*Not sent. Counsel reads it first.*',
  '',
  '---',
  '',
  '## Letter',
  '',
  '[DATE]',
  '',
  'Dear [CUSTOMER NAME],',
  '',
  'As of [DATE], **Pat Sample** no longer acts for *Sample Plumbing Co.*',
  'Please send every question to the office.',
  '',
  '- Call the office at 555-0100.',
  '* Write to office@example.com.',
  '',
  'Sincerely,  ',
  'Lee Example\\',
  'Owner',
  '',
  '## Short version for a text',
  '',
  'Pat Sample no longer acts for us. [counsel: confirm the wording]',
  '',
  '## INTERNAL: notes',
  '',
  'Do not send before the review.',
  '',
  '### Open questions',
  '',
  '- Who signs?',
  '',
].join('\n')

describe('letterCopyText · the part of a text document to paste into an email', () => {
  it('leaves out the draft banner with its italic note and every internal section, and answers the pieces by heading', () => {
    const copy = letterCopyText(LETTER)
    expect(copy.draftBanner).toBe('DRAFT: notice to customers')
    expect(copy.internalHeadings).toEqual(['INTERNAL: notes'])
    expect(copy.pieces.map((p) => p.heading)).toEqual(['Letter', 'Short version for a text'])
    expect(copy.pieces[0]!.text).toBe(
      ['[DATE]', '', 'Dear [CUSTOMER NAME],', '', 'As of [DATE], Pat Sample no longer acts for Sample Plumbing Co.', 'Please send every question to the office.', '', '- Call the office at 555-0100.', '- Write to office@example.com.', '', 'Sincerely,', 'Lee Example', 'Owner'].join('\n'),
    )
    expect(copy.pieces[1]!.text).toBe('Pat Sample no longer acts for us. [counsel: confirm the wording]')
    for (const p of copy.pieces) {
      expect(p.text).not.toMatch(/DRAFT|Not sent|INTERNAL|Do not send|Who signs|[*#]|---/)
    }
    expect(letterLeavesWordsOut(copy)).toBe(true)
    expect(letterLeftOutWords(copy)).toBe('The copy leaves out the draft note at the top and the section “INTERNAL: notes”.')
  })

  it('counts the blanks still open in each piece, a repeated one each time, and lists each once', () => {
    const copy = letterCopyText(LETTER)
    expect(copy.pieces[0]!.blanks).toEqual([{ text: '[DATE]', times: 2 }, { text: '[CUSTOMER NAME]', times: 1 }])
    expect(copy.pieces[0]!.blankCount).toBe(3)
    expect(copy.pieces[1]!.blanks).toEqual([{ text: '[counsel: confirm the wording]', times: 1 }])
    expect(letterBlanks('Paid [ ] yes [x] no, see note [1] and [^2], on [________].')).toEqual([{ text: '[________]', times: 1 }])
  })

  it('everything is the whole document as plain text, the banner and the internal notes included', () => {
    const copy = letterCopyText(LETTER)
    expect(copy.everything.startsWith('DRAFT: notice to customers\n\nNot sent. Counsel reads it first.\n\nLetter\n\n[DATE]')).toBe(true)
    expect(copy.everything).toContain('INTERNAL: notes\n\nDo not send before the review.\n\nOpen questions\n\n- Who signs?')
    expect(copy.everything).not.toMatch(/[*#]|---/)
  })

  it('a paragraph banner goes with the italic notes under it; the words under it are the letter', () => {
    const copy = letterCopyText('**DRAFT, not sent**\n\n_For review._\n\n*Second note.*\n\nDear [NAME],\n\nThank you.')
    expect(copy.draftBanner).toBe('DRAFT, not sent')
    expect(copy.pieces).toEqual([{ heading: null, text: 'Dear [NAME],\n\nThank you.', blanks: [{ text: '[NAME]', times: 1 }], blankCount: 1, stillSays: [] }])
  })

  it('a document with no banner and no internal section leaves nothing out', () => {
    const copy = letterCopyText('Dear Pat,\n\nThis is a draft of nothing, only a letter.\n\nLee')
    expect(copy.draftBanner).toBeNull()
    expect(letterLeavesWordsOut(copy)).toBe(false)
    expect(letterLeftOutWords(copy)).toBeNull()
    expect(copy.pieces).toHaveLength(1)
    expect(copy.pieces[0]!.text).toBe('Dear Pat,\n\nThis is a draft of nothing, only a letter.\n\nLee')
  })

  it('an internal heading of any size drops what is under it up to the next heading of its size or larger', () => {
    const copy = letterCopyText(['# Letter to the builder', '', 'First part.', '', '### Internal: who to call', '', 'Hidden.', '', '#### Deeper', '', 'Hidden too.', '', '### What we ask', '', 'Shown.', '', '# INTERNAL', '', '## Under it', '', 'Hidden.', '', '# Letter to the supplier', '', 'Second letter.'].join('\n'))
    expect(copy.internalHeadings).toEqual(['Internal: who to call', 'INTERNAL'])
    expect(copy.pieces.map((p) => [p.heading, p.text])).toEqual([
      ['Letter to the builder', 'First part.\n\nWhat we ask\n\nShown.'],
      ['Letter to the supplier', 'Second letter.'],
    ])
    expect(letterLeftOutWords(copy)).toBe('The copy leaves out 2 internal sections.')
  })

  it('a heading with no words under it is a title, never a piece; a comment is dropped', () => {
    const copy = letterCopyText('# Notice\n\n<!-- a note\nto self -->\n\n## Letter\n\nHello.\n')
    expect(copy.pieces.map((p) => p.heading)).toEqual(['Letter'])
    expect(copy.everything).toBe('Notice\n\nLetter\n\nHello.')
  })

  it('an empty document has no piece', () => {
    expect(letterCopyText('').pieces).toEqual([])
    expect(letterCopyText('## INTERNAL\n\nOnly notes.').pieces).toEqual([])
  })
})

describe('markdownToPlainText · marks an email would show as stray stars', () => {
  it('drops emphasis, ticks, heading marks and rules; keeps list dashes, numbers, line breaks and blanks', () => {
    expect(markdownToPlainText('## Title ##\n\n***\n\n1. **One** and __two__\n2) `three`\n\n> A _quoted_ line\n\n- [ ] a box\n+ plus\n   - nested *item*')).toBe('Title\n\n1. One and two\n2) three\n\nA quoted line\n\n- a box\n- plus\n   - nested item')
  })
  it('leaves an underscore inside a word, a blank line of underscores, a lone star and an escaped mark', () => {
    expect(markdownToPlainText('file_name_here and [________] and price* and \\*not italic\\* and 2 * 3')).toBe('file_name_here and [________] and price* and *not italic* and 2 * 3')
  })
  it('writes a link as its words and its address, and keeps a fenced block as written', () => {
    expect(markdownToPlainText('See [our page](https://example.com/a) or <https://example.com>.\n\n```\n**kept**\n```')).toBe('See our page (https://example.com/a) or <https://example.com>.\n\n**kept**')
  })
})

describe('the press and its toast', () => {
  it('one piece is the letter; a draft says so', () => {
    const one = letterCopyText('## Letter\n\nDear [NAME],')
    expect(letterPieceLabel(one, 0, false)).toBe('Copy the letter')
    expect(letterPieceLabel(one, 0, true)).toBe('Copy the draft letter')
    expect(letterCopiedWords(one, 0, true)).toEqual({ words: 'Copied the draft letter. 1 blank is still open in it.', warn: true })
  })
  it('several pieces: a nameless first one is the letter, a named one its heading', () => {
    const copy = letterCopyText('Dear Pat,\n\n## Short version\n\nHi [NAME], [DATE].')
    expect(letterPieceLabel(copy, 0, false)).toBe('Copy the letter')
    expect(letterPieceLabel(copy, 1, false)).toBe('Copy “Short version”')
    expect(letterPieceLabel(copy, 1, true)).toBe('Copy the draft “Short version”')
    expect(letterCopiedWords(copy, 0, false)).toEqual({ words: 'Copied the letter.', warn: false })
    expect(letterCopiedWords(copy, 1, false)).toEqual({ words: 'Copied “Short version”. 2 blanks are still open in it.', warn: true })
    expect(letterBlanksWords(copy, 0)).toBeNull()
    expect(letterBlanksWords(copy, 1)).toBe('Still to fill in “Short version”: [NAME] · [DATE]')
    expect(letterBlanksWords(letterCopyText('On [DATE] and [DATE], [NAME].'), 0)).toBe('Still to fill: [DATE] ×2 · [NAME]')
  })
})

describe('a tag in capitals (v2.7716)', () => {
  it('a title tagged INTERNAL at its end makes the whole paper internal: no piece, and the words say what was left out', () => {
    const copy = letterCopyText(['# Review of the supplier account (INTERNAL, 2026-01-05)', '', 'Opening words.', '', '## What we found', '', 'Finding one.', '', '## What we do next', '', 'Call Lee Example.'].join('\n'))
    expect(copy.pieces).toEqual([])
    expect(copy.internalHeadings).toEqual(['Review of the supplier account (INTERNAL, 2026-01-05)'])
    expect(letterLeavesWordsOut(copy)).toBe(true)
    expect(letterLeftOutWords(copy)).toBe('The copy leaves out the section “Review of the supplier account (INTERNAL, 2026-01-05)”.')
    // The whole paper is still one press away.
    expect(copy.everything).toContain('Finding one.')
  })
  it('a section tagged in capitals anywhere in its heading drops; the word in small letters is an ordinary word', () => {
    const copy = letterCopyText(['## Letter', '', 'Dear Pat,', '', '## Notes for the office (INTERNAL)', '', 'Hidden.', '', '## Our internal records', '', 'They show two visits.'].join('\n'))
    expect(copy.internalHeadings).toEqual(['Notes for the office (INTERNAL)'])
    expect(copy.pieces.map((p) => p.heading)).toEqual(['Letter', 'Our internal records'])
    expect(copy.pieces.map((p) => p.text).join('\n')).not.toContain('Hidden.')
  })
  it('a piece that still says DRAFT or INTERNAL in capitals says so, and the toast warns', () => {
    const copy = letterCopyText(['# Service terms', '', '- **Status**: house paper (INTERNAL), version 2 (DRAFT for review)', '', 'The terms.', '', '## Letter', '', 'Dear Pat, here is the first draft of our internal review.'].join('\n'))
    expect(copy.pieces.map((p) => p.stillSays)).toEqual([['DRAFT', 'INTERNAL'], []])
    expect(letterStillSaysWords(copy, 0)).toBe('The copy of “Service terms” still says DRAFT and INTERNAL. Read it before you paste.')
    expect(letterStillSaysWords(copy, 1)).toBeNull()
    expect(letterCopiedWords(copy, 0, false)).toEqual({ words: 'Copied “Service terms”. The copy still says DRAFT and INTERNAL.', warn: true })
    expect(letterCopiedWords(copy, 1, false)).toEqual({ words: 'Copied “Letter”.', warn: false })
    const one = letterCopyText('Dear [NAME],\n\nThis DRAFT is yours.')
    expect(letterStillSaysWords(one, 0)).toBe('The copy still says DRAFT. Read it before you paste.')
    expect(letterCopiedWords(one, 0, false)).toEqual({ words: 'Copied the letter. 1 blank is still open in it. The copy still says DRAFT.', warn: true })
  })
  it('reads the marks as whole words in capitals only', () => {
    expect(letterMarks('DRAFT, then INTERNAL.')).toEqual(['DRAFT', 'INTERNAL'])
    expect(letterMarks('a draft of the internal note, DRAFTED and INTERNALLY')).toEqual([])
  })
})
