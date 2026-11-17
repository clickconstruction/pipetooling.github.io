import { describe, expect, it } from 'vitest'
import { marked } from 'marked'
// @ts-expect-error — ci.yml runs the kernel on bare Node right after npm ci, so it is plain JS with no types
import * as kernel from '../../scripts/lib/docSentenceLines.mjs'

/**
 * scripts/lib/docSentenceLines.mjs breaks the shared docs' entries to one sentence a line, so git can merge two
 * PRs that amend one entry. These pin where a line breaks, what is left whole, that a second run changes
 * nothing, and that the page Markdown draws is the same before and after.
 */
type Split = { line: number; pieces: number; starts: string }
type Long = { line: number; length: number; kind: 'prose' | 'table'; starts: string }
const k = kernel as {
  sentenceBreaks: (text: string) => number[]
  splitLine: (line: string) => string[]
  proseLines: (lines: string[]) => boolean[]
  reflowDocument: (source: string) => { text: string; split: Split[] }
  longLines: (source: string, caps: { prose: number; table: number }) => Long[]
}

/** A page's HTML with white space folded outside <pre>, where a line break in a paragraph is a space. */
function page(markdown: string): string {
  return (marked.parse(markdown, { gfm: true, async: false }) as string)
    .split(/(<pre[\s\S]*?<\/pre>)/)
    .map((part, i) => (i % 2 === 1 ? part : part.replace(/\s+/g, ' ')))
    .join('')
}

describe('splitLine', () => {
  it('breaks a paragraph after each sentence and each semicolon', () => {
    expect(k.splitLine('One thing. Two things! Three? Four; five.')).toEqual(['One thing.', 'Two things!', 'Three?', 'Four;', 'five.'])
  })

  it('leaves a line of one sentence exactly as written', () => {
    const line = '- **Term** (v2.7331, `a.b`): one sentence, with a comma and a version v2.5 inside.'
    expect(k.splitLine(line)).toEqual([line])
  })

  it('puts a bullet’s later sentences under its words, and a quote’s under its mark', () => {
    expect(k.splitLine('- First. Second.')).toEqual(['- First.', '  Second.'])
    expect(k.splitLine('  12. First. Second.')).toEqual(['  12. First.', '      Second.'])
    expect(k.splitLine('> First. Second.')).toEqual(['> First.', '> Second.'])
    expect(k.splitLine('> - [ ] First. Second.')).toEqual(['> - [ ] First.', '>       Second.'])
  })

  it('breaks behind the marks that close emphasis, a quote or a parenthesis', () => {
    expect(k.splitLine('**Bold.** *Soft.* (Aside.) "Said." Done.')).toEqual(['**Bold.**', '*Soft.*', '(Aside.)', '"Said."', 'Done.'])
  })

  it('never breaks inside a code span, a link or an HTML tag', () => {
    for (const line of [
      'Run `npm test. Then lint; then build` once.',
      'See [the guide. Part two](https://example.test/a. b; c) now.',
      'A <span title="One. Two; three">tag</span> here.',
      'Two ``ticks ` inside. Here`` stay.',
    ]) {
      expect(k.splitLine(line)).toEqual([line])
    }
  })

  it('breaks right behind a code span or a link that ends the sentence', () => {
    expect(k.splitLine('Run `npm test`. Then [read this](https://example.test/x). Done.')).toEqual(['Run `npm test`.', 'Then [read this](https://example.test/x).', 'Done.'])
  })

  it('does not take an abbreviation, an initial or a version for a sentence end', () => {
    for (const line of ['Use a tool, e.g. The big one.', 'J. Smith signed it.', 'It moved in v2.7331 and stayed.', 'Sold vs. Built is the split.', 'the file is a.b.c and more']) {
      expect(k.splitLine(line)).toEqual([line])
    }
  })

  it('starts a sentence on a version number, as these docs do', () => {
    expect(k.splitLine('The dial came first. v2.5237 adds the three readings.')).toEqual(['The dial came first.', 'v2.5237 adds the three readings.'])
  })

  it('never breaks before words that would open a list, a heading, a quote or a table', () => {
    for (const line of ['Count them. 1. is first.', 'It ended. - not a bullet', 'Done. # not a heading', 'Said. > not a quote', 'Cells; | not a row']) {
      expect(k.splitLine(line)).toEqual([line])
    }
  })

  it('keeps a hard break’s two trailing spaces on the last piece', () => {
    expect(k.splitLine('One. Two.  ')).toEqual(['One.', 'Two.  '])
  })
})

describe('proseLines', () => {
  const flagsOf = (source: string) => k.proseLines(source.split('\n'))

  it('leaves code fences, indented code, table rows, headings, HTML and the YAML block alone', () => {
    const source = [
      '# Title. Still the title.',
      '',
      '---',
      'purpose: One. Two.',
      '---',
      '',
      'Prose. More prose.',
      '',
      '```ts',
      'const a = 1. Two; three',
      '```',
      '',
      '    indented code. Stays.',
      '',
      '| A. B | C; D |',
      '| --- | --- |',
      '| One. Two | Three; four |',
      '',
      '<details>',
      'Raw. Html.',
      '</details>',
      '',
      '- Item. More.',
      '  Under the item. Still prose.',
      '',
      '      code in the item. Stays.',
      '',
      '> Quote. More.',
    ].join('\n')
    const flags = flagsOf(source)
    const lines = source.split('\n')
    expect(lines.filter((_, i) => flags[i])).toEqual(['Prose. More prose.', '- Item. More.', '  Under the item. Still prose.', '> Quote. More.'])
  })

  it('reads a `---` far from the top as a rule, not as a YAML block', () => {
    const source = ['One.', '', 'Two.', '', 'Three.', '', 'Four.', '', 'Five.', '', 'Six.', '', 'Seven.', '', '---', '', 'After. The rule.'].join('\n')
    const flags = flagsOf(source)
    expect(flags[flags.length - 1]).toBe(true)
  })
})

describe('reflowDocument', () => {
  const ENTRY = [
    '## Lien desk',
    '',
    '**The run** (v2.5369, `runJourney.ts`): a journey across the top; one card per envelope. On a phone each box has **Scan ›** (v2.7331). A notice whose job owes $0 is held. See [the guide](/help/send-lien-notices. html).',
    '',
    '- **Pile** — one. Two; three. `four. Five`.',
    '  - Nested. Deeper.',
    '',
    '> **v2.7330 (the kernel):** `lienBoard.ts` draws it. The desk reads it; nothing else does.',
    '>',
    '> - In the quote. Twice.',
    '',
    '| Role | Can |',
    '| --- | --- |',
    '| dev | Everything. Always; no gate. |',
    '',
    '1. Step one. Then wait.',
    '2. Step two; then go.',
    '',
  ].join('\n')

  it('draws the same page before and after', () => {
    const { text, split } = k.reflowDocument(ENTRY)
    expect(split.length).toBeGreaterThan(5)
    expect(text).not.toBe(ENTRY)
    expect(page(text)).toBe(page(ENTRY))
  })

  it('changes nothing on a second run', () => {
    const once = k.reflowDocument(ENTRY).text
    const twice = k.reflowDocument(once)
    expect(twice.text).toBe(once)
    expect(twice.split).toEqual([])
  })

  it('keeps a hand-made break and Windows line ends', () => {
    const wrapped = 'One clause of an amendment,\non its own line.\n'
    expect(k.reflowDocument(wrapped).text).toBe(wrapped)
    expect(k.reflowDocument('One. Two.\r\nThree.\r\n').text).toBe('One.\r\nTwo.\r\nThree.\r\n')
  })

  it('lets git merge two amendments to one entry: each side’s change is its own line', () => {
    const base = 'The run prints. The desk mails. The office records.\n'
    const ours = 'The run prints, since v2.1 in one press. The desk mails. The office records.\n'
    const theirs = 'The run prints. The desk mails. The office records, with the mail number.\n'
    const lines = (s: string) => k.reflowDocument(s).text.split('\n')
    const [b, o, t] = [lines(base), lines(ours), lines(theirs)]
    // As written each side changes line 1 of 1. Reflowed, ours changes only line 1 and theirs only line 3.
    expect(o.map((l, i) => l !== b[i])).toEqual([true, false, false, false])
    expect(t.map((l, i) => l !== b[i])).toEqual([false, false, true, false])
  })

  it('names each line it split', () => {
    const { split } = k.reflowDocument('Whole.\n\nOne. Two. Three.\n')
    expect(split).toEqual([{ line: 3, pieces: 3, starts: 'One. Two. Three.' }])
  })
})

describe('longLines', () => {
  it('lists a sentence or a table row over its cap, and nothing in a code fence', () => {
    const source = ['Short.', 'x'.repeat(30), '| ' + 'y'.repeat(40) + ' |', '```', 'z'.repeat(99), '```'].join('\n')
    expect(k.longLines(source, { prose: 20, table: 30 }).map((l) => [l.line, l.kind, l.length])).toEqual([
      [2, 'prose', 30],
      [3, 'table', 44],
    ])
    expect(k.longLines(source, { prose: 30, table: 44 })).toEqual([])
  })
})
