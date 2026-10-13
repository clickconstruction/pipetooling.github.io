import { describe, expect, it } from 'vitest'
import { BOERNE, FAIR_OAKS } from '../../test/fixtures/jobFilesDemo'
import { jobFiles } from '../documents/jobFiles'
import { audienceOf, fileTag, previewHref, replyFileAsks, replyFileFromDevice, replyFileFromJob, replyFileFromPortal, replyWays, STARRED_FORMS, wordsMakers, type DeviceFile } from './replyFiles'

/** Messages, cut 7f: the files on a reply, over the prototype's B482 Boerne Retail Shell and J1077 Fair Oaks files. */

const boerne = jobFiles(BOERNE)
const byName = (name: string) => boerne.find((f) => f.name === name)!
const rock: DeviceFile = { name: 'Rock clause, marked up.pdf', size: 640 * 1024, type: 'application/pdf', lastModified: 1760000000000, arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) }

describe('who the reply goes to, and the words’ link makers', () => {
  it('reads a trade partner, a customer and an architect, and anyone else as unknown', () => {
    expect(['trade', 'customer', 'arch', 'lead', 'unknown'].map(audienceOf)).toEqual(['trade', 'customer', 'arch', 'unknown', 'unknown'])
  })

  it('opens their portal only when a link to it is on', () => {
    expect(wordsMakers(true).portal?.('plans')).toBe('their portal#plans')
    expect(wordsMakers(false).portal).toBeNull()
  })
})

describe('a file on the reply', () => {
  it('keys a file from this computer by what it is, so picking it twice is one', () => {
    expect(replyFileFromDevice(rock, 'computer').draft).toMatchObject({ key: 'device:computer:Rock clause, marked up.pdf:655360:1760000000000', from: 'computer', kind: 'pdf', bytes: 655360 })
    expect(replyFileFromDevice({ ...rock, name: 'IMG_2041.jpg', type: 'image/jpeg' }, 'photo').draft).toMatchObject({ from: 'photo', kind: 'image' })
  })

  it('goes on an email as the file or our link, and on a text always as our link', () => {
    const files = [replyFileFromJob(byName('Addendum 2.pdf')), replyFileFromJob(byName('Boerne Retail Shell plans, rev 2'))]
    expect(replyWays(files, 'email').map((w) => w.way)).toEqual(['file', 'link'])
    expect(replyWays(files, 'text').map((w) => w.way)).toEqual(['link', 'link'])
  })

  it('makes the asks the function takes, and says so when a file from this computer did not read', () => {
    const files = [replyFileFromJob(byName('Addendum 2.pdf')), replyFileFromDevice(rock, 'computer')]
    const key = files[1]!.draft.key
    const ok = replyFileAsks(files, 'trade', true, new Map([[key, { base64: 'JVBERi0=', mime: 'application/pdf' }]]))
    expect(ok.ok && ok.asks.map((a) => [a.source, a.way])).toEqual([
      ['drive', 'file'],
      ['device', 'file'],
    ])
    expect(replyFileAsks(files, 'trade', true, new Map())).toEqual({ ok: false, words: 'Rock clause, marked up.pdf cannot go from here. Take it off the message and add it again.' })
  })
})

describe('a starred form on their portal', () => {
  it('stars our forms they fill in there, and goes as their portal at the papers', () => {
    expect([...STARRED_FORMS].sort()).toEqual(['msa', 'w9'])
    const form = replyFileFromPortal('form:w9', 'The W-9 form')
    expect(form.draft).toMatchObject({ key: 'form:w9', from: 'portal', portalPage: 'papers', bytes: null })
    const asks = replyFileAsks([form], 'trade', true, new Map())
    expect(asks.ok && asks.asks).toEqual([expect.objectContaining({ source: 'portal', way: 'link', page: 'papers' })])
    expect(replyFileAsks([form], 'trade', false, new Map()).ok).toBe(false)
  })
})

describe('the picker’s tags and the preview’s Open in a tab', () => {
  it('tags where each file lives', () => {
    expect(boerne.map(fileTag)).toEqual(['plan set', 'Drive · Team only', 'Drive · Plans'])
    expect(jobFiles(FAIR_OAKS).map(fileTag)).toEqual(['the app makes it', 'the app makes it'])
    const arrived = jobFiles({ arrived: [{ id: 'att-1', name: 'Hillside-Boerne-sitework-rev1.pdf', bytes: 1_250_000, mime: 'application/pdf', drive_file_id: null, at: '2026-10-06T16:30:00Z' }] })[0]!
    expect(fileTag(arrived)).toBe('came in Oct 6')
    const sent = jobFiles({ sent: [{ sentId: 'sd-1', name: 'Our bid.pdf', path: 'sd-1/bid.pdf', type: 'application/pdf', bytes: 1_100_000, sent_at: '2026-10-08T15:00:00Z' }] })[0]!
    expect(fileTag(sent)).toBe('we sent it Oct 8')
  })

  it('opens a Drive file through the office’s page, our copy of one that came in, and a plan set’s folder', () => {
    expect(previewHref(byName('Addendum 2.pdf'), 'bid:bid-boerne')).toBe('/files/drive/bid%3Abid-boerne%3Adrv-addendum-2')
    expect(previewHref(byName('Addendum 2.pdf'), null)).toBeNull()
    expect(previewHref(byName('Boerne Retail Shell plans, rev 2'), 'bid:bid-boerne')).toBe('https://drive.google.com/drive/folders/boerne-rev-2-folder')
    const arrived = jobFiles({ arrived: [{ id: 'att-1', name: 'x.pdf', bytes: 1, mime: 'application/pdf', drive_file_id: null, at: '2026-10-06T16:30:00Z' }] })[0]!
    expect(previewHref(arrived, 'bid:bid-boerne')).toBe('/files/messages/att-1')
    expect(previewHref(jobFiles(FAIR_OAKS)[0]!, 'pipeline:j1077')).toBeNull()
  })
})
