import { describe, expect, it } from 'vitest'
import { lineFilesFromRows, type MessageAttachmentRow } from './lineFiles'
import { canCut, linkOff, openWhen, opensList, opensWords, portalOpensWords, sentChipWords, sentRowNote, sentWay, shortDay, type OwnLinkState } from './sentLineFiles'

/**
 * Messages, cut 7f: the files on a line we sent (`files-out-mockups.html`, screen 6). Rosa's email to Greg with addendum
 * 2 as the file, the plan set as our link to his portal and the rock clause from this computer; Jonah's bid tab as our
 * own link. The clock is Monday, October 12, 2026, 3:00 PM in Chicago.
 */

const NOW = '2026-10-12T20:00:00Z'
const TODAY_210 = '2026-10-12T19:10:00Z'
const FRI_442 = '2026-10-09T21:42:00Z'

const row = (id: string, more: Partial<MessageAttachmentRow>): MessageAttachmentRow => ({
  id,
  message_id: 'm-rosa-out',
  sort_order: 0,
  kind: 'file',
  name: '',
  mime: 'application/pdf',
  size_bytes: null,
  bucket_path: null,
  left_in_gmail: null,
  url: null,
  host: null,
  paper: null,
  paper_answer: null,
  paper_answered_by: null,
  paper_answered_at: null,
  ...more,
})

const files = lineFilesFromRows([
  row('a-addendum', { sort_order: 0, name: 'Addendum 2.pdf', size_bytes: 412_000, bucket_path: 'out/m/1-Addendum 2.pdf', sent_as: 'file', drive_file_id: 'drvAddendum2000' }),
  row('a-plans', { sort_order: 1, kind: 'link', name: 'Boerne Retail Shell plans, rev 2', url: 'https://clicktooling.com/t/7Hq2#plans', sent_as: 'link' }),
  row('a-photo', { sort_order: 2, name: 'IMG_2041.jpg', mime: 'image/jpeg', size_bytes: 2_100_000, bucket_path: 'out/m/3-IMG_2041.jpg', sent_as: 'picture' }),
  row('a-bidtab', { sort_order: 3, kind: 'link', name: 'Bid tab, Sitework.pdf', url: 'https://clicktooling.com/f/k3Pw9xQaB2cD4eF6gH8iJ0', sent_as: 'link', drive_link_id: 'dl-bidtab', drive_file_id: 'drvBidTab00001' }),
  row('a-in', { sort_order: 4, name: 'Came in.pdf', size_bytes: 1000, bucket_path: 'g/1-in.pdf' }),
]).get('m-rosa-out')!
const [addendum, plans, photo, bidTab, cameIn] = files as [(typeof files)[number], (typeof files)[number], (typeof files)[number], (typeof files)[number], (typeof files)[number]]

const open: OwnLinkState = { cutAt: null, cutByName: null, endsAt: '2026-11-08T21:42:00Z', opens: 2, openedAt: [TODAY_210, FRI_442] }

describe('how a file on a line we sent went', () => {
  it('reads the file, the picture, their portal and our own link, and nothing for a file that came in', () => {
    expect(files.map(sentWay)).toEqual(['file', 'portal', 'picture', 'own', null])
    expect(files.map(sentChipWords)).toEqual(['sent as the file', 'sent as our link to their portal', 'sent as the picture', 'sent as our link to the file', null])
  })

  it('says each row’s words as the mock-up does', () => {
    expect(sentRowNote(addendum, undefined, NOW)).toBe('412 KB · sent as the file · kept with the copy')
    expect(sentRowNote(plans, undefined, NOW)).toBe('sent as our link to their portal')
    expect(sentRowNote(photo, undefined, NOW)).toBe('2.1 MB · sent as the picture · kept with the copy')
    expect(sentRowNote(bidTab, undefined, NOW)).toBe('sent as our link to the file')
    expect(sentRowNote(bidTab, open, NOW)).toBe('sent as our link to the file · opened twice, last 2:10 PM')
    expect(sentRowNote(cameIn, undefined, NOW)).toBe('')
  })
})

describe('our own link’s opens', () => {
  it('counts them, the time of the last today and its day when it was not', () => {
    expect(opensWords(open, NOW)).toBe('opened twice, last 2:10 PM')
    expect(opensWords({ opens: 1, openedAt: [FRI_442] }, NOW)).toBe('opened once, last Fri Oct 9')
    expect(opensWords({ opens: 7, openedAt: [FRI_442] }, NOW)).toBe('opened 7 times, last Fri Oct 9')
    expect(opensWords({ opens: 0, openedAt: [] }, NOW)).toBe('not opened yet')
  })

  it('lists each open’s time, newest first, and never who', () => {
    expect(opensList(open, NOW)).toBe('Opens: today 2:10 PM · Fri Oct 9, 4:42 PM')
    expect(opensList({ openedAt: [] }, NOW)).toBeNull()
    expect(openWhen(FRI_442, NOW)).toBe('Fri Oct 9, 4:42 PM')
    expect(shortDay(NOW)).toBe('Mon Oct 12')
  })

  it('opens nothing once cut off or ended, and only an open one of ours can be cut', () => {
    const cut: OwnLinkState = { ...open, cutAt: '2026-10-12T15:00:00Z', cutByName: 'Rosa' }
    expect(linkOff(cut, NOW)).toBe('cut off by Rosa Mon Oct 12 · our link opens nothing now')
    expect(sentRowNote(bidTab, cut, NOW)).toBe('cut off by Rosa Mon Oct 12 · our link opens nothing now')
    expect(linkOff({ ...open, endsAt: '2026-10-11T21:42:00Z' }, NOW)).toBe('ended Sun Oct 11 · our link opens nothing now')
    expect(linkOff(open, NOW)).toBeNull()
    expect(canCut(bidTab, open, NOW)).toBe(true)
    expect(canCut(bidTab, cut, NOW)).toBe(false)
    expect(canCut(bidTab, undefined, NOW)).toBe(false)
    expect(canCut(plans, open, NOW)).toBe(false)
  })
})

describe('their portal’s opens since the line went', () => {
  it('counts the portal’s opens, never the one file’s, with the day and time of the last', () => {
    expect(portalOpensWords({ opens: 2, lastOpenedAt: TODAY_210 })).toBe('they opened their portal twice since, last Mon Oct 12 at 2:10 PM')
    expect(portalOpensWords({ opens: 1, lastOpenedAt: FRI_442 })).toBe('they opened their portal once since, last Fri Oct 9 at 4:42 PM')
    expect(portalOpensWords({ opens: 4, lastOpenedAt: FRI_442 })).toBe('they opened their portal 4 times since, last Fri Oct 9 at 4:42 PM')
    expect(portalOpensWords({ opens: 0, lastOpenedAt: null })).toBe('they have not opened their portal since')
  })

  it('puts them beside a link to their portal, once read', () => {
    expect(sentRowNote(plans, undefined, NOW, { opens: 2, lastOpenedAt: TODAY_210 })).toBe('sent as our link to their portal · they opened their portal twice since, last Mon Oct 12 at 2:10 PM')
    expect(sentRowNote(plans, undefined, NOW, null)).toBe('sent as our link to their portal')
    expect(sentRowNote(addendum, undefined, NOW, { opens: 2, lastOpenedAt: TODAY_210 })).toBe('412 KB · sent as the file · kept with the copy')
  })
})
