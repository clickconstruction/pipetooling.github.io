import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { lineFilesFromRows, driveOf, type MessageAttachmentRow } from './lineFiles'
import { SAVE_WORDS, looksLikeQuote, saveTarget, savedWords } from './saveToDrive'

/**
 * Messages, cut 7f: Save to Drive on a file that came in (`files-out-mockups.html`, screen 8). Greg's sitework PDF and
 * site photo from the spine's demo rows, on B482 (a bid), #47 Helotes (a GC project) or on nobody's job.
 */

const pdf = { name: 'Hillside-Boerne-sitework-rev1.pdf', mime: 'application/pdf' }
const photo = { name: 'site-photo-pad.jpg', mime: 'image/jpeg' }

describe('saveTarget', () => {
  it('asks for a job first when the line is on nobody’s', () => {
    expect(saveTarget(pdf, null)).toEqual({ kind: 'noJob' })
    expect(saveTarget(pdf, 'not-a-key')).toEqual({ kind: 'noJob' })
  })

  it('sends a photo to the job’s photos, whatever the job', () => {
    expect(saveTarget(photo, 'bid:bid-boerne')).toEqual({ kind: 'photos' })
    expect(saveTarget({ name: 'IMG_2208.HEIC', mime: null }, 'project:p-helotes')).toEqual({ kind: 'photos' })
  })

  it('puts a file on a bid or a Pipeline job into the folder, which has no halves', () => {
    expect(saveTarget(pdf, 'bid:bid-boerne')).toEqual({ kind: 'folder' })
    expect(saveTarget(pdf, 'pipeline:j1077')).toEqual({ kind: 'folder' })
  })

  it('on a GC project picks Plans for a drawing and Team only for a quote', () => {
    expect(saveTarget(pdf, 'project:p-helotes')).toEqual({ kind: 'halves', pick: 'plans' })
    expect(saveTarget({ name: 'Hillside quote rev 2.pdf', mime: 'application/pdf' }, 'project:p-helotes')).toEqual({ kind: 'halves', pick: 'team_only' })
    expect(saveTarget({ name: 'Bid_tab_Sitework.xlsx', mime: null }, 'project:p-helotes')).toEqual({ kind: 'halves', pick: 'team_only' })
  })
})

describe('looksLikeQuote', () => {
  it('reads a quote, a bid, a proposal or a price in the name, and not a word that only holds one', () => {
    for (const n of ['Quote 114.pdf', 'Our bid, Boerne.pdf', 'Plumbing-proposal.pdf', 'pricing_sheet.xlsx', 'Estimate.pdf']) expect(looksLikeQuote(n)).toBe(true)
    for (const n of ['Addendum 2.pdf', 'Hillside-Boerne-sitework-rev1.pdf', 'forbid.pdf', 'Priceless view.jpg']) expect(looksLikeQuote(n)).toBe(false)
  })
})

describe('the words', () => {
  it('say where it went once it is saved', () => {
    expect(savedWords({ kind: 'halves', pick: 'plans' }, 'plans')).toBe('Saved to the job’s Plans folder.')
    expect(savedWords({ kind: 'halves', pick: 'plans' }, 'team_only')).toBe('Saved to the job’s Team only folder, under From email.')
    expect(savedWords({ kind: 'photos' }, null)).toBe('Saved to the job’s photos.')
    expect(savedWords({ kind: 'folder' }, null)).toBe('Saved to the job’s Drive folder.')
    expect(savedWords(null, null)).toBe('Saved to the job’s Drive.')
  })

  it('keep to plain words', () => {
    const all = [
      SAVE_WORDS.title('B482'),
      SAVE_WORDS.teamOnly.hint,
      SAVE_WORDS.plans.hint,
      SAVE_WORDS.photos,
      SAVE_WORDS.folder,
      SAVE_WORDS.noJob,
      savedWords({ kind: 'halves', pick: 'team_only' }, 'team_only'),
    ]
    expect(all.flatMap(plainWordsFailures)).toEqual([])
  })
})

describe('a line’s file keeps where it is in Drive and how it went (cut 7a’s columns)', () => {
  const row = (more: Partial<MessageAttachmentRow>): MessageAttachmentRow => ({
    id: 'att-1',
    message_id: 'm-1',
    sort_order: 0,
    kind: 'file',
    name: 'Hillside COI 2027.pdf',
    mime: 'application/pdf',
    size_bytes: 380_000,
    bucket_path: 'g-1/1-coi.pdf',
    left_in_gmail: null,
    url: null,
    host: null,
    paper: null,
    paper_answer: null,
    paper_answered_by: null,
    paper_answered_at: null,
    ...more,
  })

  it('reads the Drive file, how it went and our link, and none of them from a row read before the columns', () => {
    const [saved] = lineFilesFromRows([row({ drive_file_id: 'drvCoi2027000', sent_as: null, drive_link_id: null })]).get('m-1')!
    expect(driveOf(saved!)).toEqual({ driveFileId: 'drvCoi2027000', sentAs: null, driveLinkId: null })
    const [sentLink] = lineFilesFromRows([row({ kind: 'link', url: 'https://clicktooling.com/f/k3Pw', bucket_path: null, sent_as: 'link', drive_link_id: 'dl-1' })]).get('m-1')!
    expect(driveOf(sentLink!)).toEqual({ driveFileId: null, sentAs: 'link', driveLinkId: 'dl-1' })
    const [old] = lineFilesFromRows([row({})]).get('m-1')!
    expect(driveOf(old!)).toEqual({ driveFileId: null, sentAs: null, driveLinkId: null })
    expect(lineFilesFromRows([row({ sent_as: 'fax' })]).get('m-1')![0]!.sentAs).toBeNull()
  })
})
