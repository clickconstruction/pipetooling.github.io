import { describe, expect, it } from 'vitest'
import {
  PLAIN_WORDS_GLUE,
  helpGuideLineForCounting,
  helpGuideLineForGlue,
  helpGuidePlainWordsFailures,
  helpGuideProseLines,
  plainWordsFailures,
  plainWordsSentences,
} from './plainWords'

describe('plain words: the mechanical rules', () => {
  it('splits sentences after . ? and !', () => {
    expect(plainWordsSentences('Tap Share. The link is copied! Where does it go? Paste it.')).toEqual(['Tap Share.', 'The link is copied!', 'Where does it go?', 'Paste it.'])
    expect(plainWordsSentences('as .eml, .msg or .txt.')).toEqual(['as .eml, .msg or .txt.'])
  })

  it('a short, unglued text passes', () => {
    expect(plainWordsFailures('A packet is what one GC gets. Tap ＋ Add GC to start another.')).toEqual([])
  })

  it('names a sentence over 20 words and a glued one', () => {
    const long = 'This one sentence keeps going and going with one more clause and then another clause until it is well over twenty words long.'
    expect(plainWordsFailures(long)).toHaveLength(1)
    expect(plainWordsFailures(long)[0]).toMatch(/^2\d words \(over 20\)/)
    expect(plainWordsFailures('Press the blue Solver › — its ring holds the slider.')).toEqual([expect.stringMatching(/^glued/)])
    expect(plainWordsFailures('Revenue, cost, profit and margin (the price you view).')).toHaveLength(1)
    expect(plainWordsFailures('Apply writes them; Discard clears them.')).toHaveLength(1)
    expect(plainWordsFailures('Rev 2 is up · Dana decided.')).toHaveLength(1)
  })
})

describe('plain words: a help guide', () => {
  it('the prose reader keeps paragraphs and list items, and drops the rest', () => {
    const source = ['---', 'title: x', '---', 'First line.', '', '## Heading', '- an item', ':::example The bid', 'quoted (kept as is) — with glue', ':::', 'Last line.'].join('\n')
    expect(helpGuideProseLines(source)).toEqual(['First line.', 'an item', 'Last line.'])
  })

  it('a token is its label and an italic span is one word when counting; both are silent for glue', () => {
    expect(helpGuideLineForCounting('Tap {{button:blue|Build Rev 1 from the picks}} and *a · b* stays. **Bold** too. {{icon:help}} starts it.')).toBe(
      'Tap Build Rev 1 from the picks and quoted stays. Bold too. icon starts it.',
    )
    expect(helpGuideLineForGlue('Tap {{button:green|Confirm 14 · pick 2}} then *x · y*.')).not.toMatch(PLAIN_WORDS_GLUE)
    expect(helpGuideLineForCounting('{{gif:settings-walkthrough.gif|The Settings page, one tab at a time.}}')).toBe('The Settings page, one tab at a time.')
    expect(helpGuideLineForGlue('See [read the bid board](?g=read-the-bid-board) first.')).not.toMatch(PLAIN_WORDS_GLUE)
    expect(helpGuideLineForCounting('See [read the bid board](?g=read-the-bid-board) first.')).toBe('See read the bid board first.')
    expect(helpGuideLineForGlue('A sentence — glued.')).toMatch(PLAIN_WORDS_GLUE)
  })

  it("a table row's pipes are cell walls, not words", () => {
    // see-what-a-sub-sees-on-their-portal's row is 19 words; its three pipes made it count 22.
    const row = '| {{chip:blue|Waiting on customer}} + a *payable after* date | The fourth dot lights with a green {{chip:green|Queued for Friday}} chip: *"Queued for the pay run — the date is right below."* |'
    expect(helpGuideLineForCounting(row).split(/\s+/)).toHaveLength(19)
    expect(helpGuidePlainWordsFailures(['---', 'title: x', '---', '| On Sub Labor | What the sub reads |', '| --- | --- |', row].join('\n'))).toEqual([])
    // A row whose own words run over 20 still fails.
    const long = '| A cell that keeps going | and a second cell that keeps going with more words until the row runs well over twenty |'
    expect(helpGuidePlainWordsFailures(['---', 'title: x', '---', long].join('\n'))).toEqual([expect.stringMatching(/^22 words \(over 20\)/)])
    // Pipes outside a table row are left alone.
    expect(helpGuideLineForCounting('Pick Schedule / Inbox | Customers.')).toBe('Pick Schedule / Inbox | Customers.')
  })

  it('a table cell holding only — is an empty cell, not glue', () => {
    // start-here-as-a-master's roles table: the controller has nothing hidden.
    expect(helpGuideLineForGlue('| **Controller** | Everything an assistant sees, plus payroll and money detail | — |')).not.toMatch(PLAIN_WORDS_GLUE)
    expect(helpGuideLineForGlue('| — | — |')).not.toMatch(PLAIN_WORDS_GLUE)
    // A dash among a cell's words is still glue, and so is one outside a table.
    expect(helpGuideLineForGlue('| Paid | The card leaves — Paid sets itself. |')).toMatch(PLAIN_WORDS_GLUE)
    expect(helpGuideLineForGlue('Nothing — then something.')).toMatch(PLAIN_WORDS_GLUE)
  })

  it('a guide written by the rules passes; one in the old voice names each failure with its line', () => {
    const plain = ['---', 'title: x', '---', 'A submittal is the list of products you will install. The GC approves it first.', '', '## Steps', '- Tap {{button:blue|Share}}. The link is copied.', ':::example SpaceX', '22 rows (8 alternates) — nothing retyped.', ':::'].join('\n')
    expect(helpGuidePlainWordsFailures(plain)).toEqual([])
    const old = ['---', 'title: x', '---', 'Bids → **Submittals** (the tab after Cover Letter; office and estimator roles).'].join('\n')
    const failures = helpGuidePlainWordsFailures(old)
    expect(failures).toHaveLength(1)
    expect(failures[0]).toMatch(/^glued/)
  })
})
