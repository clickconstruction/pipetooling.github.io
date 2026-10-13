import { describe, expect, it } from 'vitest'
import {
  DRIVE_FOLDER_MIME,
  LINK_DAYS,
  STREAM_CAP_BYTES,
  contentDisposition,
  driveViewUrl,
  fileLinkUrl,
  landingPath,
  linkToken,
  linkTokenShape,
  openAnswer,
  parseOfficeAsk,
  saveHalfFor,
  streamUrl,
  tokenFromLink,
  type LinkRow,
} from '../../../supabase/functions/_shared/driveLink'

/**
 * The drive-link function's rules (Messages, cut 7b): our own link to one Drive file of one job opens Drive's viewer for a
 * Plans file, our stream for a Team only file up to 50 MB, and the turned-off words for a link cut off, ended or unknown;
 * the office's door takes five asks and nothing else. The prototype's demo cast: Rosa sends Greg Paulk of Hillside the
 * rock clause from this computer and the plan set for B482 Boerne Retail Shell.
 */
const NOW = new Date('2026-10-12T19:10:00Z')
const ROCK: LinkRow = {
  id: 'l-rock',
  half: 'team_only',
  drive_file_id: '1RockClauseMarkedUp0001',
  name: 'Rock clause, marked up.pdf',
  mime: 'application/pdf',
  size_bytes: 655360,
  ends_at: '2026-11-11T19:00:00Z',
  cut_at: null,
}
const PROJECT = '00000000-0000-4000-8000-0000000008a1'

describe('openAnswer', () => {
  it('streams a Team only file, so Team only is never opened up', () => {
    expect(openAnswer(ROCK, NOW)).toEqual({ kind: 'stream', name: 'Rock clause, marked up.pdf' })
  })

  it('opens a Plans file in Drive’s own viewer, since that half is open to anyone with its link', () => {
    expect(openAnswer({ ...ROCK, half: 'plans', drive_file_id: '1PlanSetRev2000000184', name: 'Boerne Retail Shell plans, rev 2', size_bytes: 192937984 }, NOW)).toEqual({
      kind: 'drive',
      url: 'https://drive.google.com/file/d/1PlanSetRev2000000184/view',
      name: 'Boerne Retail Shell plans, rev 2',
    })
  })

  it('opens nothing for a link cut off, ended or unknown, and a cut reads before an end', () => {
    expect(openAnswer({ ...ROCK, cut_at: '2026-10-12T18:00:00Z' }, NOW)).toEqual({ kind: 'off', why: 'cut' })
    expect(openAnswer({ ...ROCK, ends_at: '2026-10-12T19:10:00Z' }, NOW)).toEqual({ kind: 'off', why: 'ended' })
    expect(openAnswer({ ...ROCK, ends_at: '2026-10-01T00:00:00Z', cut_at: '2026-09-30T00:00:00Z' }, NOW)).toEqual({ kind: 'off', why: 'cut' })
    expect(openAnswer(null, NOW)).toEqual({ kind: 'off', why: 'unknown' })
  })

  it('streams up to 50 MB of Team only, and no more; a size not known streams', () => {
    expect(openAnswer({ ...ROCK, size_bytes: STREAM_CAP_BYTES }, NOW).kind).toBe('stream')
    expect(openAnswer({ ...ROCK, size_bytes: STREAM_CAP_BYTES + 1 }, NOW)).toEqual({ kind: 'off', why: 'tooBig' })
    expect(openAnswer({ ...ROCK, size_bytes: null }, NOW).kind).toBe('stream')
    // A plan set past the cap still opens: Drive's viewer carries it.
    expect(openAnswer({ ...ROCK, half: 'plans', size_bytes: STREAM_CAP_BYTES * 4 }, NOW).kind).toBe('drive')
  })

  it('opens a plan set’s folder in Plans as the folder, and never streams a folder', () => {
    const set = { ...ROCK, half: 'plans' as const, drive_file_id: '1PlanSetFolderRev2000', name: 'Boerne Retail Shell plans, rev 2', mime: DRIVE_FOLDER_MIME, size_bytes: null }
    expect(openAnswer(set, NOW)).toEqual({ kind: 'drive', url: 'https://drive.google.com/drive/folders/1PlanSetFolderRev2000', name: 'Boerne Retail Shell plans, rev 2' })
    expect(openAnswer({ ...set, half: 'team_only' }, NOW)).toEqual({ kind: 'off', why: 'unknown' })
  })

  it('lives 30 days', () => {
    expect(LINK_DAYS).toBe(30)
  })
})

describe('the link itself', () => {
  it('is 22 characters of base64url from 16 random bytes, short for a text', () => {
    const t = linkToken(new Uint8Array([251, 255, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]))
    expect(t).toHaveLength(22)
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(t.startsWith('-_8')).toBe(true)
    expect(linkTokenShape(t)).toBe(true)
  })

  it('is the app’s page, never Drive’s, and its token reads back from a pasted link', () => {
    expect(fileLinkUrl('https://clicktooling.com/', 'k3Pw9xQaB2cD4eF6gH8iJ0')).toBe('https://clicktooling.com/f/k3Pw9xQaB2cD4eF6gH8iJ0')
    expect(tokenFromLink('https://clicktooling.com/f/k3Pw9xQaB2cD4eF6gH8iJ0')).toBe('k3Pw9xQaB2cD4eF6gH8iJ0')
    expect(tokenFromLink('clicktooling.com/f/k3Pw9xQaB2cD4eF6gH8iJ0?x=1')).toBe('k3Pw9xQaB2cD4eF6gH8iJ0')
    expect(tokenFromLink('https://clicktooling.com/t/7Hq2#plans')).toBeNull()
    expect(linkTokenShape('short')).toBe(false)
    expect(linkTokenShape('has spaces in it, so no')).toBe(false)
  })

  it('streams a Team only file from the function’s public address, never the gateway’s', () => {
    expect(streamUrl('https://yewfzhbofbbyvkvtaatw.supabase.co/', 'k3Pw9xQaB2cD4eF6gH8iJ0')).toBe('https://yewfzhbofbbyvkvtaatw.supabase.co/functions/v1/drive-link?t=k3Pw9xQaB2cD4eF6gH8iJ0&raw=1')
  })

  it('names the streamed file as the browser shows it and saves it', () => {
    expect(contentDisposition('Rock clause, marked up.pdf')).toBe(`inline; filename="Rock clause, marked up.pdf"; filename*=UTF-8''Rock%20clause%2C%20marked%20up.pdf`)
    expect(contentDisposition('Cláusula "roca".pdf')).toBe(`inline; filename="Cl_usula _roca_.pdf"; filename*=UTF-8''Cl%C3%A1usula%20%22roca%22.pdf`)
    expect(driveViewUrl('1PlanSetRev2000000184')).toBe('https://drive.google.com/file/d/1PlanSetRev2000000184/view')
  })
})

describe('the office’s door', () => {
  it('lists a job’s folder, one job by one of its three ids', () => {
    expect(parseOfficeAsk({ action: 'list', job: { project_id: PROJECT } })).toEqual({ action: 'list', job: { project_id: PROJECT } })
    expect(parseOfficeAsk({ action: 'list', job: { project_id: PROJECT, bid_id: PROJECT } })).toBeNull()
    expect(parseOfficeAsk({ action: 'list', job: {} })).toBeNull()
    expect(parseOfficeAsk({ action: 'list', job: { project_id: 'B482' } })).toBeNull()
  })

  it('puts a file from this computer in Sent by us, and a photo in Photos', () => {
    expect(parseOfficeAsk({ action: 'put', job: { project_id: PROJECT }, name: ' Rock clause, marked up.pdf ', mime: 'application/pdf', where: 'sent' })).toEqual({
      action: 'put',
      job: { project_id: PROJECT },
      name: 'Rock clause, marked up.pdf',
      mime: 'application/pdf',
      where: 'sent',
    })
    expect(parseOfficeAsk({ action: 'put', job: { project_id: PROJECT }, name: 'IMG_2041.jpg', where: 'photos' })).toMatchObject({ mime: 'application/octet-stream', where: 'photos' })
    expect(parseOfficeAsk({ action: 'put', job: { project_id: PROJECT }, name: '', where: 'sent' })).toBeNull()
    expect(parseOfficeAsk({ action: 'put', job: { project_id: PROJECT }, name: 'x.pdf', where: 'plans' })).toBeNull()
    expect(landingPath('sent')).toEqual(['Team only', 'Sent by us'])
    expect(landingPath('photos')).toEqual(['Team only', 'Photos'])
  })

  it('makes a link to a Drive file, on a line or on none', () => {
    expect(parseOfficeAsk({ action: 'link', job: { project_id: PROJECT }, driveFileId: '1RockClauseMarkedUp0001', messageId: null })).toMatchObject({ action: 'link', messageId: null })
    expect(parseOfficeAsk({ action: 'link', job: { project_id: PROJECT }, driveFileId: '1RockClauseMarkedUp0001', messageId: PROJECT })).toMatchObject({ messageId: PROJECT })
    expect(parseOfficeAsk({ action: 'link', job: { project_id: PROJECT }, driveFileId: 'not a drive id!', messageId: null })).toBeNull()
    expect(parseOfficeAsk({ action: 'link', job: { project_id: PROJECT }, driveFileId: '1RockClauseMarkedUp0001', messageId: 'line-1' })).toBeNull()
  })

  it('saves a file that came in to Team only for a quote or a photo, and to Plans for anything else', () => {
    expect(parseOfficeAsk({ action: 'save', attachmentId: PROJECT, half: 'team_only' })).toEqual({ action: 'save', attachmentId: PROJECT, half: 'team_only' })
    expect(parseOfficeAsk({ action: 'save', attachmentId: PROJECT, half: 'everyone' })).toBeNull()
    expect(saveHalfFor({ kind: 'file', mime: 'application/pdf', name: 'Hillside-Boerne-sitework-rev1.pdf', isQuote: true })).toBe('team_only')
    expect(saveHalfFor({ kind: 'file', mime: 'image/jpeg', name: 'site-photo-pad.jpg', isQuote: false })).toBe('team_only')
    expect(saveHalfFor({ kind: 'file', mime: null, name: 'IMG_2041.HEIC', isQuote: false })).toBe('team_only')
    expect(saveHalfFor({ kind: 'file', mime: 'application/pdf', name: 'Addendum 3.pdf', isQuote: false })).toBe('plans')
    expect(landingPath('saved', 'team_only')).toEqual(['Team only', 'From email'])
    expect(landingPath('saved', 'plans')).toEqual(['Plans'])
  })

  it('opens a Drive file for the office, and takes no other ask', () => {
    expect(parseOfficeAsk({ action: 'open', job: { bid_id: PROJECT }, driveFileId: '1BidTabSitework000002' })).toEqual({ action: 'open', job: { bid_id: PROJECT }, driveFileId: '1BidTabSitework000002' })
    expect(parseOfficeAsk({ action: 'delete', job: { project_id: PROJECT } })).toBeNull()
    expect(parseOfficeAsk(null)).toBeNull()
  })
})
