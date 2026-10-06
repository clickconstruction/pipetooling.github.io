import { describe, expect, it } from 'vitest'
import { changedLinesFromDiff, helpGuidePronounOpeners, openersOnChangedLines, opensOnBarePronoun, opensOnSo } from './pronounOpeners'

describe('pronoun openers: what counts as a bare pronoun', () => {
  it('flags a personal or possessive pronoun at the start, always', () => {
    for (const s of ['It clears a Report due reminder.', 'They are the chapter 53 notices.', 'Its block hatches.', 'Their name stays on.', 'He draws his signature.', "It's off by default."]) {
      expect(opensOnBarePronoun(s), s).toBe(true)
    }
  })

  it('flags a demonstrative, each or both only when it stands alone before a verb or a comma', () => {
    for (const s of ['That is the record of who signed off.', "That's a per-invoice choice.", 'This means search and the sort buttons.', 'Those, and bids with no estimator, are listed.', 'Each has a Cancel.', 'Both show the job.', 'These need a wage.']) {
      expect(opensOnBarePronoun(s), s).toBe(true)
    }
    for (const s of ['That section only appears when there is something in it.', 'This week is on the grid.', 'These sessions count in the pool.', 'Each of the three lens cards is a button.', 'Both buttons wait a moment.', 'That bucket doubles as your list.', 'These open bills are listed first.', 'Those work orders go out.']) {
      expect(opensOnBarePronoun(s), s).toBe(false)
    }
  })

  it('finds the pronoun behind an opening then, so, if, when or under', () => {
    for (const s of ['Then it waits.', 'So they no longer add to this indicator.', 'If they texted, emailed, or called:', 'When that happens, the card says why.', 'Under it sit the rows.', 'For them the hand-off is the only button.']) {
      expect(opensOnBarePronoun(s), s).toBe(true)
    }
    expect(opensOnBarePronoun('Then the draft removes itself.')).toBe(false)
  })

  it('lets a demonstrative point forward to a list, but never a bare it', () => {
    expect(opensOnBarePronoun('These are the gaps:')).toBe(false)
    expect(opensOnBarePronoun('It reads like:')).toBe(true)
  })

  it('passes the dummy it, which points at nothing', () => {
    for (const s of ["If it's been a while, check the email address before you chase.", 'If it’s been a while, check the address.', 'It does not matter whether a statement has picked it up yet.', "It doesn't matter which one you press.", 'It is safe to close or walk away.', 'So it is safe to tap it as soon as you have a bar.', 'It is harmless to leave checked.']) {
      expect(opensOnBarePronoun(s), s).toBe(false)
    }
    expect(opensOnBarePronoun('It takes ten seconds.')).toBe(true)
    expect(opensOnBarePronoun('It is worth fixing, since pay screens match people by name.')).toBe(true)
  })

  it('reads a numbered step and a curly apostrophe', () => {
    expect(opensOnBarePronoun('3. It saves automatically.')).toBe(true)
    expect(opensOnBarePronoun('It’s ready to print.')).toBe(true)
  })

  it('a sentence that opens on So', () => {
    expect(opensOnSo('So the office sees it.')).toBe(true)
    expect(opensOnSo('2. So nobody asks twice.')).toBe(true)
    expect(opensOnSo('Some rows are left out.')).toBe(false)
    expect(opensOnSo('The money moves, so the line drops.')).toBe(false)
  })
})

describe('pronoun openers: a whole guide', () => {
  const guide = [
    '---',
    'title: try a thing',
    'category: Office',
    '---',
    'The card shows the job. It shows the date too.',
    '',
    '## A heading',
    '',
    '- The office gets the notice. *It is quoted as printed* on the page.',
    ':::example A panel',
    'It is kept as written. That is fine here.',
    ':::',
    'Tap {{button:blue|Save}}. That is all. So it lands. So the office sees it.',
    'One So per paragraph. So this one is fine.',
  ].join('\n')

  it('names each finding with its line in the file and its rule', () => {
    expect(helpGuidePronounOpeners(guide)).toEqual([
      { line: 5, sentence: 'It shows the date too.', rule: 'pronoun' },
      { line: 13, sentence: 'That is all.', rule: 'pronoun' },
      { line: 13, sentence: 'So it lands.', rule: 'pronoun' },
      { line: 13, sentence: 'So the office sees it.', rule: 'so' },
    ])
  })

  it('reads nothing in the frontmatter, the headings, an example panel or an italic quote', () => {
    const lines = helpGuidePronounOpeners(guide).map((f) => f.line)
    expect(lines).not.toContain(9)
    expect(lines).not.toContain(11)
  })

  it('a guide with no frontmatter counts from its first line', () => {
    expect(helpGuidePronounOpeners('First line.\nThe second. It points back.')).toEqual([{ line: 2, sentence: 'It points back.', rule: 'pronoun' }])
  })
})

describe('pronoun openers: only the lines a change wrote', () => {
  it('reads the new side of each hunk in a zero-context diff', () => {
    const diff = [
      'diff --git a/x.md b/x.md',
      '--- a/x.md',
      '+++ b/x.md',
      '@@ -12 +12 @@ heading',
      '-old sentence.',
      '+new sentence.',
      '@@ -30,0 +31,3 @@',
      '+a',
      '+b',
      '+c',
      '@@ -40,2 +43,0 @@',
      '-gone',
      '-gone',
    ].join('\n')
    expect([...changedLinesFromDiff(diff)].sort((a, b) => a - b)).toEqual([12, 31, 32, 33])
  })

  it('a new guide is every line', () => {
    expect(changedLinesFromDiff('@@ -0,0 +1,4 @@\n+a\n+b\n+c\n+d').size).toBe(4)
  })

  it('splits the findings: the changed lines are listed, the rest only counted', () => {
    const found = [
      { line: 5, sentence: 'It shows the date.', rule: 'pronoun' as const },
      { line: 9, sentence: 'That is all.', rule: 'pronoun' as const },
      { line: 9, sentence: 'So it lands.', rule: 'so' as const },
      { line: 20, sentence: 'They wait.', rule: 'pronoun' as const },
    ]
    expect(openersOnChangedLines(found, new Set([9]))).toEqual({ onChanged: [found[1], found[2]], elsewhere: 2 })
    expect(openersOnChangedLines(found, new Set())).toEqual({ onChanged: [], elsewhere: 4 })
  })
})
