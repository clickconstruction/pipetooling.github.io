import { describe, expect, it } from 'vitest'
import { BOERNE, FAIR_OAKS, HELOTES, KB, MB, STONE_OAK } from '../../test/fixtures/jobFilesDemo'
import { plainWordsFailures } from '../plainWords'
import { PORTAL_PAGES, PORTAL_PAGE_KEYS, fileKindOf, jobFiles, portalHasPage, portalWords, sizeWords } from './jobFiles'

describe('jobFiles: the one list of a job’s files', () => {
  it("walks Boerne's plan set and its Drive folder, the app's papers first, then the plans, then Drive newest first", () => {
    const files = jobFiles(BOERNE)
    expect(files.map((f) => [f.key, f.name, f.home, f.portalPage, f.planSet])).toEqual([
      ['plans:set-2', 'Boerne Retail Shell plans, rev 2', 'plans', 'plans', true],
      ['drive:drv-bid-tab', 'Bid tab, Sitework.pdf', 'team_only', null, false],
      ['drive:drv-addendum-2', 'Addendum 2.pdf', 'plans', 'plans', false],
    ])
    expect(files[0]?.bytes).toBeNull()
    expect(files[2]?.bytes).toBe(412 * KB)
  })

  it('tags each paper the app makes with the portal page it lives on', () => {
    const pages = (src: Parameters<typeof jobFiles>[0]) => jobFiles(src).map((f) => [f.name, f.portalPage, f.paper])
    expect(pages(STONE_OAK)).toEqual([
      ['Schedule, week of Oct 5.pdf', 'schedule', 'schedule'],
      ['Statement of work, Sitework.pdf', 'sow', 'sow'],
    ])
    expect(pages(HELOTES)).toEqual([
      ['Our contract.pdf', 'contract', 'contract'],
      ['Schedule, rough.pdf', 'schedule', 'schedule'],
    ])
    expect(pages(FAIR_OAKS)).toEqual([
      ['Pay application 3.pdf', 'bills', 'payapp'],
      ['Change order 2.pdf', 'changes', 'co'],
    ])
  })

  it("keeps a trade partner's upload that Drive also lists as one file: where it lives from Drive, how it came from the upload", () => {
    const files = jobFiles({
      drive: [{ id: 'drv-sub-1', name: 'Hillside submittal, renamed.pdf', bytes: null, mime: 'application/pdf', half: 'team_only', url: 'https://drive.google.com/file/d/drv-sub-1', modified: '2026-10-07T14:00:00Z' }],
      trade: [{ id: 'tf-1', name: 'Hillside submittal.pdf', bytes: 300 * KB, mime: 'application/pdf', drive_file_id: 'drv-sub-1', drive_url: 'https://drive.google.com/file/d/drv-sub-1', uploaded_at: '2026-10-06T14:00:00Z' }],
    })
    expect(files).toHaveLength(1)
    expect(files[0]).toMatchObject({ key: 'drive:drv-sub-1', source: 'trade', name: 'Hillside submittal, renamed.pdf', bytes: 300 * KB, home: 'team_only', at: '2026-10-06T14:00:00Z' })
  })

  it('keeps an arrived file filed in the Plans half as one file with its page', () => {
    const files = jobFiles({
      arrived: [{ id: 'att-9', name: 'Addendum 3.pdf', bytes: 500 * KB, kind: 'application/pdf', drive_file_id: 'drv-add-3', at: '2026-10-08T14:00:00Z' }],
      drive: [{ id: 'drv-add-3', name: 'Addendum 3.pdf', bytes: 500 * KB, mime: 'application/pdf', half: 'plans', url: 'https://drive.google.com/file/d/drv-add-3', modified: '2026-10-08T15:00:00Z' }],
    })
    expect(files).toEqual([expect.objectContaining({ key: 'drive:drv-add-3', source: 'arrived', home: 'plans', portalPage: 'plans', driveUrl: 'https://drive.google.com/file/d/drv-add-3' })])
  })

  it('lists an arrived file not filed yet from our bucket, and the files on what we sent', () => {
    const files = jobFiles({
      arrived: [{ id: 'att-1', name: 'IMG_2208.jpg', bytes: 3 * MB, kind: 'image/jpeg', drive_file_id: null, at: '2026-10-08T14:00:00Z' }],
      sent: [{ sentId: 'sent-7', name: 'Pay application 3.pdf', path: 'sent/sent-7/pay-app-3.pdf', type: 'application/pdf', bytes: 180 * KB, sent_at: '2026-10-01T16:00:00Z' }],
    })
    expect(files.map((f) => [f.key, f.source, f.home, f.kind])).toEqual([
      ['sent:sent-7:sent/sent-7/pay-app-3.pdf', 'sent', 'bucket', 'pdf'],
      ['arrived:att-1', 'arrived', 'bucket', 'image'],
    ])
  })

  it('adds no row for a sent copy of a paper already listed, and one for a different file of the same name', () => {
    const sentPayApp = { sentId: 'sent-7', name: 'Pay application 3.pdf', path: 'sent/sent-7/pay-app-3.pdf', type: 'application/pdf', bytes: 180 * KB, sent_at: '2026-10-01T16:00:00Z' }
    expect(jobFiles({ ...FAIR_OAKS, sent: [sentPayApp] }).map((f) => f.key)).toEqual(['paper:payapp:payapp-3', 'paper:co:co-2'])
    expect(jobFiles({ ...FAIR_OAKS, sent: [{ ...sentPayApp, bytes: 181 * KB }] })).toHaveLength(3)
  })

  it('is empty for a job with nothing on it', () => {
    expect(jobFiles({})).toEqual([])
  })
})

describe('the words', () => {
  it('says a size as people read it', () => {
    expect(sizeWords(412 * KB)).toBe('412 KB')
    expect(sizeWords(Math.round(2.1 * MB))).toBe('2.1 MB')
    expect(sizeWords(184 * MB)).toBe('184 MB')
    expect(sizeWords(10)).toBe('1 KB')
    expect(sizeWords(null)).toBeNull()
  })

  it('reads a kind from the type, and from the name when the type says nothing', () => {
    expect(fileKindOf('application/pdf')).toBe('pdf')
    expect(fileKindOf('image/heic')).toBe('image')
    expect(fileKindOf('', 'Bid tab.XLSX')).toBe('sheet')
    expect(fileKindOf('', 'plans.pdf')).toBe('pdf')
    expect(fileKindOf('application/zip', 'plans.pdf')).toBe('other')
  })

  it('names every page once, with whose portal has it', () => {
    expect(PORTAL_PAGE_KEYS).toEqual(['plans', 'sow', 'schedule', 'contract', 'bills', 'changes', 'papers'])
    expect(portalHasPage('trade', 'plans')).toBe(true)
    expect(portalHasPage('customer', 'plans')).toBe(false)
    expect(portalHasPage('customer', 'contract')).toBe(true)
    expect(portalHasPage('trade', 'contract')).toBe(false)
    expect(portalWords('plans')).toBe('in their portal under the plans')
  })

  it('keeps the pages’ words plain', () => {
    for (const k of PORTAL_PAGE_KEYS) {
      expect(plainWordsFailures(`${PORTAL_PAGES[k].line}.`)).toEqual([])
      expect(plainWordsFailures(portalWords(k))).toEqual([])
    }
  })
})
