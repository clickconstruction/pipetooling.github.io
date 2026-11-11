import { describe, expect, it } from 'vitest'
import { BOARD_LINK_ORDER } from './bidBoardLinkSlots'
import { BID_FORM_FOCUS_ELEMENT_ID } from './bidFormFocus'
import { BID_FILE_FORM_FOCUS, BID_FILE_LINK_COLUMN, BID_FILE_LINK_LABEL, BID_FILE_LINK_SAVED, BID_FILE_ORDER, BID_FILE_TITLE, BOARD_LINK_MISSING_TITLE, bidFileRows, filesWindowLabel, isDriveFolderLink, linkDraft, linkPlaceWords, madeFolderWords, photosRowLine } from './bidFilesWindow'

const nothing = { photoCount: 0, driveLink: null, planSets: [], countLink: null, submissionLink: null }
const set = (name: string, link: string, onBid = false) => ({ name, link, onBid })

describe('bidFileRows', () => {
  it('lays five rows in the column’s order, photos first', () => {
    expect(BID_FILE_ORDER).toEqual(['photos', 'folder', 'plans', 'count', 'submission'])
    expect(bidFileRows(nothing).map((r) => r.kind)).toEqual([...BID_FILE_ORDER])
    expect(bidFileRows(nothing).map((r) => r.title)).toEqual(['Photos', 'Project folder', 'Plans', 'CountTooling', 'Bid submission'])
  })

  it('reads a bid with nothing as five rows that are not there, each link with its landing in Edit bid', () => {
    const rows = bidFileRows(nothing)
    expect(rows.every((r) => !r.there)).toBe(true)
    expect(rows.map((r) => r.line)).toEqual(['None yet', 'Not set yet', 'None yet', 'Not linked yet', 'Nothing filed as sent yet'])
    expect(rows.map((r) => r.focus)).toEqual([null, 'driveLink', 'plansLink', 'countLink', 'submissionLink'])
    expect(rows.every((r) => r.opens.length === 0)).toBe(true)
  })

  it('reads a full bid as five rows that are there, each with what it opens and its landing kept', () => {
    const rows = bidFileRows({
      photoCount: 12,
      driveLink: ' https://drive.google.com/drive/folders/1Folder ',
      planSets: [set('Issued for bid', 'https://drive.google.com/drive/folders/1Plans')],
      countLink: 'https://counttooling.com/?t=abc',
      submissionLink: 'https://www.dropbox.com/s/sent.pdf',
    })
    expect(rows.every((r) => r.there)).toBe(true)
    expect(rows.map((r) => r.focus)).toEqual([null, 'driveLink', 'plansLink', 'countLink', 'submissionLink'])
    expect(rows.map((r) => r.line)).toEqual(['12 photos', 'Linked · Google Drive', 'Issued for bid', 'Linked', 'Linked · Dropbox'])
    expect(rows[1]!.opens).toEqual([{ name: null, href: 'https://drive.google.com/drive/folders/1Folder' }])
    expect(rows[0]!.opens).toEqual([])
  })

  it('names each set when the bid has two or more, and the one set by its name', () => {
    const three = bidFileRows({ ...nothing, planSets: [set('Issued for bid', 'a'), set('Addendum 1', 'b'), set('Permit set', 'c')] })[2]!
    expect(three.line).toBe('3 sets')
    expect(three.opens.map((o) => o.name)).toEqual(['Issued for bid', 'Addendum 1', 'Permit set'])
    const own = bidFileRows({ ...nothing, planSets: [set('Plans', 'https://drive.google.com/x', true)] })[2]!
    expect(own.line).toBe('Linked · Google Drive')
    expect(own.opens).toEqual([{ name: null, href: 'https://drive.google.com/x' }])
  })

  it('leaves out a set with no link', () => {
    expect(bidFileRows({ ...nothing, planSets: [set('Draft', '  ')] })[2]!.there).toBe(false)
  })

  it('lists every CountTooling project once, the bid’s own first', () => {
    const one = bidFileRows({ ...nothing, countLink: 'https://counttooling.com/?t=a', countSources: [{ link: 'https://counttooling.com/?t=a', project_name: 'Level 1' }] })[3]!
    expect(one.line).toBe('Level 1')
    expect(one.opens).toEqual([{ name: null, href: 'https://counttooling.com/?t=a' }])
    const two = bidFileRows({ ...nothing, countLink: 'https://counttooling.com/?t=a', countSources: [{ link: 'https://counttooling.com/?t=a', project_name: null }, { link: 'https://counttooling.com/?t=b', project_name: 'Site work' }, { link: 'https://counttooling.com/?t=b', project_name: 'Site work' }] })[3]!
    expect(two.line).toBe('2 projects')
    expect(two.opens).toEqual([
      { name: 'The bid’s own project', href: 'https://counttooling.com/?t=a' },
      { name: 'Site work', href: 'https://counttooling.com/?t=b' },
    ])
    const sourceOnly = bidFileRows({ ...nothing, countSources: [{ link: 'https://counttooling.com/?t=c', project_name: null }] })[3]!
    expect(sourceOnly.there).toBe(true)
    expect(sourceOnly.line).toBe('Another project')
  })

  it('reads a count that has not read as a row with no line, not as none', () => {
    expect(bidFileRows({ ...nothing, photoCount: null })[0]).toMatchObject({ there: false, line: '' })
    expect(photosRowLine(undefined)).toBe('')
    expect(photosRowLine(1)).toBe('1 photo')
    expect(photosRowLine(0)).toBe('None yet')
  })
})

describe('the words around the rows', () => {
  it('names where a link leads', () => {
    expect(linkPlaceWords('https://drive.google.com/drive/folders/1')).toBe('Google Drive')
    expect(linkPlaceWords('docs.google.com/document/d/1')).toBe('Google Drive')
    expect(linkPlaceWords('https://counttooling.com/?t=1')).toBe('CountTooling')
    expect(linkPlaceWords('https://www.buildingconnected.com/x')).toBe('buildingconnected.com')
    expect(linkPlaceWords('')).toBeNull()
    expect(linkPlaceWords('not a link at all')).toBeNull()
  })

  it('gives every link kind a grey name and a field the form holds', () => {
    for (const kind of BOARD_LINK_ORDER) {
      expect(BOARD_LINK_MISSING_TITLE[kind]).toMatch(/^No .+ yet$/)
      expect(BID_FORM_FOCUS_ELEMENT_ID[BID_FILE_FORM_FOCUS[kind]]).toMatch(/^bid-form-/)
      expect(BID_FILE_TITLE[kind]).toBeTruthy()
    }
  })

  it('writes each pasted link to the column the form writes', () => {
    expect(BID_FILE_LINK_COLUMN).toEqual({ folder: 'drive_link', count: 'count_tooling_plans_link', submission: 'bid_submission_link' })
    for (const kind of ['folder', 'count', 'submission'] as const) {
      expect(BID_FILE_LINK_LABEL[kind]).toMatch(/^Link to /)
      expect(BID_FILE_LINK_SAVED[kind]).toMatch(/ is set\.$/)
    }
  })

  it('names the window by the bid', () => {
    expect(filesWindowLabel('b598 Quarry Road Storage Bunker')).toBe('Files · b598 Quarry Road Storage Bunker')
    expect(filesWindowLabel('  ')).toBe('Files')
  })
})

describe('linkDraft', () => {
  it('holds the press while nothing is typed, with no reason to give', () => {
    expect(linkDraft('count', '   ', null)).toEqual({ value: null, dead: true, why: null, note: null })
  })

  it('holds what is not a link, and says what a link is', () => {
    expect(linkDraft('count', 'counttooling.com/?t=abc', null)).toMatchObject({ dead: true, why: 'A link starts with https:// and has no spaces.' })
    expect(linkDraft('submission', 'https://drive.google.com/x and more', null).dead).toBe(true)
  })

  it('does not save the link the bid has now', () => {
    expect(linkDraft('count', ' https://counttooling.com/?t=abc ', 'https://counttooling.com/?t=abc')).toMatchObject({ dead: true, why: 'That is the link the bid has now.' })
  })

  it('trims a good link and lets it save', () => {
    expect(linkDraft('count', '  https://counttooling.com/?t=new ', 'https://counttooling.com/?t=abc')).toEqual({ value: 'https://counttooling.com/?t=new', dead: false, why: null, note: null })
  })

  it('saves a project folder that is not in Drive, and says photos cannot file there', () => {
    expect(linkDraft('folder', 'https://www.dropbox.com/sh/abc', null)).toMatchObject({ dead: false, note: 'This is not a Google Drive folder. The bid’s photos cannot be filed there.' })
    expect(linkDraft('folder', 'https://drive.google.com/drive/folders/1HbY7NbwSgn9d87fFJTu?usp=sharing', null).note).toBeNull()
    expect(linkDraft('submission', 'https://www.dropbox.com/sh/abc', null).note).toBeNull()
  })

  it('knows a Drive folder link in the shapes Drive hands out', () => {
    expect(isDriveFolderLink('https://drive.google.com/drive/folders/1HbY7NbwSgn9d87fFJTu')).toBe(true)
    expect(isDriveFolderLink('https://drive.google.com/drive/u/2/folders/1HbY7NbwSgn9d87fFJTu')).toBe(true)
    expect(isDriveFolderLink('https://drive.google.com/open?id=1HbY7NbwSgn9d87fFJTu')).toBe(true)
    expect(isDriveFolderLink('https://drive.google.com/file/d/1HbY7NbwSgn9d87fFJTu/view')).toBe(false)
    expect(isDriveFolderLink(null)).toBe(false)
  })

  it('names the folder the app made', () => {
    expect(madeFolderWords('b598 Quarry Road Storage Bunker')).toBe('Made the project folder: b598 Quarry Road Storage Bunker.')
    expect(madeFolderWords(' ')).toBe('Made the project folder.')
  })
})
