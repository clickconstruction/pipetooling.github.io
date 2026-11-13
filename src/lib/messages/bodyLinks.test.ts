import { describe, expect, it } from 'vitest'
import { bodyHtml, bodyLinks, bodyPieces } from './bodyLinks'

// Glenn Gelwin's invitation of 2026-10-22 as the bids@ reader kept it: the sender's bold as stars, the plans link
// written twice, once bare and once in angle brackets, a bold span across a line break.
const GLENN = [
  'Wendi,',
  '',
  'We at *Marrex Builders* are currently working on a project called *Northeast',
  'Bible Church Elementary Building* located at *19185 FM 2252 Northeast Bible',
  'Church, Garden Ridge, TX 78266*',
  '',
  '*Scope of Work*:',
  '',
  'Plumbing',
  '',
  'Link to Plans*:',
  '**https://maxxbuilders.box.example/s/vzgc9sp8fwsrcni1c7d8j0qh3995pqi3',
  '<https://maxxbuilders.box.example/s/vzgc9sp8fwsrcni1c7d8j0qh3995pqi3>*',
  'Deadline: *Monday, November 02, 2026, 3:00 PM*',
  '',
  '·  Itemized breakdown of scope *unit type, quantities, unit cost , total',
  'cost of each item*',
].join('\n')

const PLANS = 'https://maxxbuilders.box.example/s/vzgc9sp8fwsrcni1c7d8j0qh3995pqi3'

describe('bodyPieces: the words of an email as the viewer draws them (v2.6508)', () => {
  it('folds the doubled address into one link and hides the stars around it', () => {
    const pieces = bodyPieces(GLENN)
    const links = pieces.filter((p) => p.kind === 'link')
    expect(links).toEqual([{ kind: 'link', href: PLANS, bold: true }])
    const text = pieces.map((p) => (p.kind === 'link' ? p.href : p.text)).join('')
    // The one star left is the sender's own stray mark on "Link to Plans*:", whose opening mark the mail client lost.
    expect(text.match(/\*/g)).toEqual(['*'])
    expect(text).toContain('Link to Plans*:')
    expect(text).not.toContain('<')
    expect(text.match(/https:/g)?.length).toBe(1)
  })

  it('reads the sender’s bold marks as bold, across one line break but never a blank line', () => {
    const bold = bodyPieces(GLENN)
      .filter((p) => p.bold && p.kind === 'text')
      .map((p) => (p.kind === 'text' ? p.text : ''))
    expect(bold).toEqual([
      'Marrex Builders',
      'Northeast\nBible Church Elementary Building',
      '19185 FM 2252 Northeast Bible\nChurch, Garden Ridge, TX 78266',
      'Scope of Work',
      'Monday, November 02, 2026, 3:00 PM',
      'unit type, quantities, unit cost , total\ncost of each item',
    ])
    // A lone star stays a star; it opens nothing when its closing mark is past a blank line.
    expect(bodyPieces('Link to Plans*:\n\nmore words*')).toEqual([{ kind: 'text', text: 'Link to Plans*:\n\nmore words*', bold: false }])
  })

  it('keeps the words as they are around the marks: the colon after the span, the sentence after it', () => {
    expect(bodyPieces('*Scope of Work*: plumbing')).toEqual([
      { kind: 'text', text: 'Scope of Work', bold: true },
      { kind: 'text', text: ': plumbing', bold: false },
    ])
    expect(bodyPieces('We at *Marrex Builders* are')).toEqual([
      { kind: 'text', text: 'We at ', bold: false },
      { kind: 'text', text: 'Marrex Builders', bold: true },
      { kind: 'text', text: ' are', bold: false },
    ])
    expect(bodyPieces('**Note** and *one*')).toEqual([
      { kind: 'text', text: 'Note', bold: true },
      { kind: 'text', text: ' and ', bold: false },
      { kind: 'text', text: 'one', bold: true },
    ])
  })

  it('never reads arithmetic, a bullet or an unclosed mark as bold', () => {
    for (const words of ['2*3*4 = 24', 'a * b * c', '* first\n* second', '*unclosed words', 'words closed*', '*** CONFIDENTIAL ***', 'price*']) {
      expect(bodyPieces(words), words).toEqual([{ kind: 'text', text: words, bold: false }])
    }
  })

  it('finds a plain address, leaves the sentence’s punctuation outside it, and drops the brackets around a bare <url>', () => {
    expect(bodyPieces('Plans at https://plans.example/set-1. Thanks')).toEqual([
      { kind: 'text', text: 'Plans at ', bold: false },
      { kind: 'link', href: 'https://plans.example/set-1', bold: false },
      { kind: 'text', text: '. Thanks', bold: false },
    ])
    expect(bodyPieces('See <https://plans.example/set-1> today')).toEqual([
      { kind: 'text', text: 'See ', bold: false },
      { kind: 'link', href: 'https://plans.example/set-1', bold: false },
      { kind: 'text', text: ' today', bold: false },
    ])
    expect(bodyPieces('(https://plans.example/a) and http://b.example/')).toEqual([
      { kind: 'text', text: '(', bold: false },
      { kind: 'link', href: 'https://plans.example/a', bold: false },
      { kind: 'text', text: ') and ', bold: false },
      { kind: 'link', href: 'http://b.example/', bold: false },
    ])
  })

  it('folds only the same address: two different ones stay two links', () => {
    expect(bodyPieces('https://a.example/x <https://a.example/x/> https://a.example/x <https://b.example/y>').filter((p) => p.kind === 'link')).toEqual([
      { kind: 'link', href: 'https://a.example/x', bold: false },
      { kind: 'link', href: 'https://a.example/x', bold: false },
      { kind: 'link', href: 'https://b.example/y', bold: false },
    ])
  })

  it('reads words with no mark and no address as one piece, so what the thread showed before still reads the same', () => {
    const words = 'Robert,\n\nNumbers attached for the Boerne sitework.'
    expect(bodyPieces(words)).toEqual([{ kind: 'text', text: words, bold: false }])
    expect(bodyPieces('')).toEqual([])
    expect(bodyPieces('https://')).toEqual([{ kind: 'text', text: 'https://', bold: false }])
  })
})

describe('bodyLinks and bodyHtml', () => {
  it('lists each address once, in order', () => {
    expect(bodyLinks(GLENN)).toEqual([PLANS])
    expect(bodyLinks('https://a.example/1 then https://b.example/2 then https://a.example/1')).toEqual(['https://a.example/1', 'https://b.example/2'])
    expect(bodyLinks('no address here')).toEqual([])
  })

  it('writes the print page’s words: links that open in a new tab, bold in <b>, everything else escaped', () => {
    expect(bodyHtml('*Scope* <b>: https://plans.example/a?x=1&y=2.')).toBe(
      '<b>Scope</b> &lt;b&gt;: <a href="https://plans.example/a?x=1&amp;y=2" target="_blank" rel="noopener noreferrer">https://plans.example/a?x=1&amp;y=2</a>.',
    )
  })
})
