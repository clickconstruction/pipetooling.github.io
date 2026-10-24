/**
 * Preview on the Tell the customer sheet (v2.5794): the text's words with the link filled by the sample, the note's
 * trigger, the blanks still in braces, which kinds the window offers, a text split at its links, and plain words.
 */
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { PREVIEW_WORDS, previewKinds, SAMPLE_ACCEPT_LINK, splitLinks, textPreview } from './preview'

describe('textPreview', () => {
  it('fills the link with the sample and says the link is a sample', () => {
    const p = textPreview('ZZ, this is Robert with Click Plumbing. Your estimate is ready, $1.00. Open it: {link}')
    expect(p.words).toBe(`ZZ, this is Robert with Click Plumbing. Your estimate is ready, $1.00. Open it: ${SAMPLE_ACCEPT_LINK}`)
    expect(p.sample).toBe(true)
    expect(p.left).toEqual([])
  })
  it('leaves words with no link as they are, trimmed, with no sample note', () => {
    const p = textPreview('  Dana, we have you booked for Friday, 10:00 AM to 12:00 PM.  ')
    expect(p.words).toBe('Dana, we have you booked for Friday, 10:00 AM to 12:00 PM.')
    expect(p.sample).toBe(false)
    expect(p.left).toEqual([])
  })
  it('keeps any other blank in braces and names it', () => {
    const p = textPreview('{first}, your estimate is ready. Open it: {link}')
    expect(p.words).toBe(`{first}, your estimate is ready. Open it: ${SAMPLE_ACCEPT_LINK}`)
    expect(p.left).toEqual(['first'])
  })
  it('takes another sample link', () => {
    expect(textPreview('Open it: {link}', 'https://example.test/e?t=x').words).toBe('Open it: https://example.test/e?t=x')
  })
})

describe('previewKinds', () => {
  it('offers the email only when the page handed one in, the text only when one goes', () => {
    expect(previewKinds({ email: true, text: true })).toEqual(['email', 'text'])
    expect(previewKinds({ email: false, text: true })).toEqual(['text'])
    expect(previewKinds({ email: true, text: false })).toEqual(['email'])
    expect(previewKinds({ email: false, text: false })).toEqual([])
  })
})

describe('splitLinks', () => {
  it('splits the words at each link and keeps the rest', () => {
    expect(splitLinks('Open it: https://clicktooling.com/estimate/accept?t=sample today.')).toEqual([
      { text: 'Open it: ', link: false },
      { text: 'https://clicktooling.com/estimate/accept?t=sample', link: true },
      { text: ' today.', link: false },
    ])
  })
  it('words with no link are one part, and a link at the end closes the list', () => {
    expect(splitLinks('No link here.')).toEqual([{ text: 'No link here.', link: false }])
    expect(splitLinks('See http://a.test/x')).toEqual([
      { text: 'See ', link: false },
      { text: 'http://a.test/x', link: true },
    ])
  })
})

describe('PREVIEW_WORDS', () => {
  it('every sentence a person reads is plain words', () => {
    const read = [
      PREVIEW_WORDS.press,
      PREVIEW_WORDS.pressTip('email'),
      PREVIEW_WORDS.pressTip('text'),
      PREVIEW_WORDS.title('Dana'),
      PREVIEW_WORDS.title(null),
      PREVIEW_WORDS.pill('email'),
      PREVIEW_WORDS.pill('text'),
      PREVIEW_WORDS.stays,
      PREVIEW_WORDS.frameTitle,
      PREVIEW_WORDS.textFrom,
      PREVIEW_WORDS.sampleLink,
      PREVIEW_WORDS.back,
    ]
    for (const words of read) expect(plainWordsFailures(words), words).toEqual([])
  })
})
