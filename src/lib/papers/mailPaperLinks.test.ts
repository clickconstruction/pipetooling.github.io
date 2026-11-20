import { describe, expect, it } from 'vitest'
import { MAIL_PAPER_LINK_WORDS, cleanMailLink, fileLinksInWords, linkKindWords, mailHasPaper, mailLinkChoices, mailPaperLinks } from './mailPaperLinks'

// Made-up links in the shapes real mail carries.
const DOC = 'https://docs.google.com/document/d/1MadeUpDocKeyForATest_0123456789abcdefghij/edit?usp=sharing'
const FOLDER = 'https://drive.google.com/drive/folders/1MadeUpFolderKeyForATest0123456789'
const SHEET = 'https://docs.google.com/spreadsheets/d/1MadeUpSheetKeyForATest_0123456789abcdefg/edit'
/** The mark an email program leaves where a picture sat, as real mail carries it right after a link. */
const MARK = String.fromCharCode(0xfffc)

describe('what a job’s mail carries that a paper can hold (v2.7973)', () => {
  it('a real file or a file link earns the press; neither earns none', () => {
    expect(mailHasPaper({ files: 1, links: 0 })).toBe(true)
    expect(mailHasPaper({ files: 0, links: 1 })).toBe(true)
    expect(mailHasPaper({ files: 2, links: 3 })).toBe(true)
    expect(mailHasPaper({ files: 0, links: 0 })).toBe(false)
  })

  it('cleans what clings to a link’s end, and nothing else', () => {
    expect(cleanMailLink(`${DOC}${MARK}`)).toBe(DOC)
    expect(cleanMailLink(`  ${DOC}${String.fromCharCode(0xa0)}${String.fromCharCode(0x200b)} `)).toBe(DOC)
    expect(cleanMailLink(DOC)).toBe(DOC)
    expect(cleanMailLink('')).toBe('')
  })

  it('one link stored twice, once with the mark on its end, reads as one', () => {
    expect(mailPaperLinks([DOC, `${DOC}${MARK}`])).toEqual([DOC])
    expect(mailPaperLinks([DOC, FOLDER, `${DOC}${MARK}`, `${FOLDER}${MARK}`])).toEqual([DOC, FOLDER])
  })

  it('keeps the mail’s order, and leaves out a link that is no file host’s, an empty one and a missing one', () => {
    expect(mailPaperLinks([FOLDER, 'https://example.com/about', '', null, undefined, DOC, 'not a link'])).toEqual([FOLDER, DOC])
    expect(mailPaperLinks([])).toEqual([])
  })

  it('finds the file links in a mail’s words, behind the HTML’s links first, each once', () => {
    const bodyHtml = `<p>Here is the spec book: <a href="${DOC}">Spec book</a> and our site <a href="https://example.com">home</a>.</p>`
    const bodyText = `Here is the spec book: ${DOC}${MARK}\n\nAnd the folder: ${FOLDER}.\n\nhttps://example.com`
    expect(fileLinksInWords({ bodyText, bodyHtml })).toEqual([DOC, FOLDER])
    expect(fileLinksInWords({ bodyText: 'See you Monday.', bodyHtml: null })).toEqual([])
    expect(fileLinksInWords({})).toEqual([])
    expect(fileLinksInWords({ bodyHtml: `<a href="${FOLDER}?a=1&amp;b=2">x</a>` })).toEqual([`${FOLDER}?a=1&b=2`])
  })

  it('says what a link is, so two from one mail can be told apart', () => {
    expect(linkKindWords(DOC)).toBe('Google Doc')
    expect(linkKindWords(SHEET)).toBe('Google Sheet')
    expect(linkKindWords('https://docs.google.com/presentation/d/1MadeUpSlidesKey/edit')).toBe('Google Slides')
    expect(linkKindWords(FOLDER)).toBe('Drive folder')
    expect(linkKindWords('https://drive.google.com/file/d/1MadeUpFileKey/view')).toBe('Drive file')
    expect(linkKindWords('https://www.dropbox.com/s/madeupkey/spec.pdf')).toBe('Dropbox link')
    expect(linkKindWords('not a link')).toBe('Link')
    expect(mailLinkChoices([DOC, FOLDER])).toEqual([
      { url: DOC, label: '1. Google Doc' },
      { url: FOLDER, label: '2. Drive folder' },
    ])
    expect(MAIL_PAPER_LINK_WORDS.filled).toBe('Filled from the mail. Change it if the paper lives somewhere else.')
  })
})
