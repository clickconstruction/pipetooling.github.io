import { describe, expect, it } from 'vitest'
import {
  EMAIL_FILES_MAX,
  EMAIL_FILE_LIMIT_BYTES,
  EMAIL_MESSAGE_LIMIT_BYTES,
  PAPER_PAGE,
  PORTAL_PAGE_LINES,
  base64OfBytes,
  carryRefusal,
  carryWords,
  emailLinkLines,
  outCopyPath,
  paperRef,
  parseEmailFiles,
  portalHasPage,
  portalPageUrl,
} from '../../../supabase/functions/_shared/messagesEmailFiles'
import { PORTAL_PAGES, portalHasPage as appPortalHasPage, type PortalPage } from './jobFiles'
import { EMAIL_FILE_LIMIT_BYTES as APP_FILE_LIMIT, EMAIL_MESSAGE_LIMIT_BYTES as APP_MESSAGE_LIMIT } from './outgoing'

/**
 * Messages, cut 7e: the files on an email as `messages-email` takes them (`_shared/messagesEmailFiles.ts`). The files are
 * the mock-up's (`files-out-mockups.html`, screen 4): Greg's addendum 2 and plan set from B482's Drive folder, the rock
 * clause from this computer, and Helotes's contract.
 */

const KB = 1024
const MB = 1024 * 1024
const UUID = '3f1a9c2e-0b7d-4e8a-9c11-5d2f7a6b4c3e'
const UUID2 = '7b2c4d6e-8f90-4a1b-b2c3-d4e5f6a7b8c9'

const addendum = { key: 'drive:drv-addendum-2', source: 'drive', ref: 'drvAddendum2000', name: 'Addendum 2.pdf', mime: 'application/pdf', way: 'file' }
const planSet = { key: 'plans:set-2', source: 'drive', ref: 'boerneRev2Folder', name: 'Boerne Retail Shell plans, rev 2', mime: 'application/vnd.google-apps.folder', way: 'link', page: 'plans' }
const rockClause = { key: 'device:rock-clause', source: 'device', name: 'Rock clause, marked up.pdf', mime: 'application/pdf', way: 'file', base64: 'JVBERi0xLjQK', landing: 'sent' }

describe('the limits and the portal’s lines are the app’s own', () => {
  it('holds the same limits as outgoing.ts', () => {
    expect(EMAIL_FILE_LIMIT_BYTES).toBe(APP_FILE_LIMIT)
    expect(EMAIL_MESSAGE_LIMIT_BYTES).toBe(APP_MESSAGE_LIMIT)
  })

  it('holds the same pages, lines and audiences as jobFiles.ts', () => {
    expect(Object.keys(PORTAL_PAGE_LINES).sort()).toEqual(Object.keys(PORTAL_PAGES).sort())
    for (const [page, info] of Object.entries(PORTAL_PAGES)) {
      expect(PORTAL_PAGE_LINES[page as keyof typeof PORTAL_PAGE_LINES]).toEqual({ line: info.line, audiences: info.audiences })
    }
    expect(PAPER_PAGE).toEqual({ sow: 'sow', contract: 'contract', payapp: 'bills', co: 'changes', schedule: 'schedule' })
  })
})

describe('parseEmailFiles', () => {
  it('reads the mock-up’s three files: the addendum as the file, the plan set as their portal, the rock clause from this computer', () => {
    expect(parseEmailFiles([addendum, planSet, rockClause])).toEqual([
      { ...addendum, path: null, page: null, base64: null, landing: null },
      { ...planSet, path: null, base64: null, landing: null },
      { ...rockClause, ref: '', path: null, page: null },
    ])
  })

  it('reads no list as no files', () => {
    expect(parseEmailFiles(undefined)).toEqual([])
    expect(parseEmailFiles(null)).toEqual([])
  })

  it('reads a file that came in, a sent copy’s file and our contract, each by its own ref', () => {
    const files = parseEmailFiles([
      { key: 'arrived:a', source: 'arrived', ref: UUID, name: 'Hillside COI 2027.pdf', mime: 'application/pdf', way: 'file' },
      { key: 'sent:s', source: 'sent', ref: UUID2, path: `${UUID2}/1-bid-tab.pdf`, name: 'Bid tab.pdf', mime: 'application/pdf', way: 'file' },
      { key: 'paper:contract', source: 'paper', ref: `contract:${UUID}`, name: 'Our contract.pdf', mime: 'application/pdf', way: 'file' },
      { key: 'paper:schedule', source: 'paper', ref: 'schedule:schedule', name: 'Schedule', mime: '', way: 'link', page: 'schedule' },
    ])
    expect(files?.map((f) => [f.source, f.way, f.path])).toEqual([
      ['arrived', 'file', null],
      ['sent', 'file', `${UUID2}/1-bid-tab.pdf`],
      ['paper', 'file', null],
      ['paper', 'link', null],
    ])
  })

  it('sends a paper the app draws on demand only as its page, since only our contract is stored', () => {
    const payApp = { key: 'paper:pa', source: 'paper', ref: `payapp:${UUID}`, name: 'Pay application 3', mime: '', page: 'bills' }
    expect(parseEmailFiles([{ ...payApp, way: 'link' }])).toHaveLength(1)
    expect(parseEmailFiles([{ ...payApp, way: 'file', page: null }])).toBeNull()
    expect(paperRef(`co:${UUID}`)).toEqual({ paper: 'co', id: UUID })
    expect(paperRef('schedule:schedule')).toEqual({ paper: 'schedule', id: 'schedule' })
    expect(paperRef('contract:schedule')).toBeNull()
    expect(paperRef('invoice:x')).toBeNull()
  })

  it('refuses the whole list when one file does not fit, so a send never goes with part of it', () => {
    const bad = [
      { ...addendum, ref: 'short' },
      { ...addendum, source: 'email' },
      { ...addendum, way: 'fax' },
      { ...addendum, page: 'plans' },
      { ...addendum, page: 'attic', way: 'link' },
      { ...addendum, name: ' ' },
      { ...rockClause, base64: '' },
      { key: 'sent:s', source: 'sent', ref: UUID2, path: '../secrets/key.pem', name: 'x.pdf', mime: '', way: 'file' },
      { key: 'sent:s', source: 'sent', ref: UUID2, path: '/abs.pdf', name: 'x.pdf', mime: '', way: 'file' },
      { key: 'arrived:a', source: 'arrived', ref: 'not-a-uuid', name: 'x.pdf', mime: '', way: 'file' },
    ]
    for (const b of bad) expect(parseEmailFiles([addendum, b].map((f, i) => ({ ...f, key: `${f.key}-${i}` })))).toBeNull()
    expect(parseEmailFiles([addendum, addendum])).toBeNull()
    expect(parseEmailFiles('files')).toBeNull()
    expect(parseEmailFiles(Array.from({ length: EMAIL_FILES_MAX + 1 }, (_, i) => ({ ...addendum, key: `k${i}` })))).toBeNull()
  })

  it('puts a photo from this computer in Photos, and anything else in Sent by us', () => {
    expect(parseEmailFiles([{ ...rockClause, landing: 'photos', way: 'picture' }])?.[0]?.landing).toBe('photos')
    expect(parseEmailFiles([{ ...rockClause, landing: undefined }])?.[0]?.landing).toBe('sent')
  })
})

describe('their portal, with no file (cut 7f’s starred forms)', () => {
  it('takes their portal at a page as a link, and nothing else', () => {
    const portal = { key: 'form:w9', source: 'portal', name: 'The W-9 form', mime: '', way: 'link', page: 'papers' }
    expect(parseEmailFiles([portal])).toEqual([{ ...portal, ref: '', path: null, base64: null, landing: null }])
    expect(parseEmailFiles([{ ...portal, page: null }])).toBeNull()
    expect(parseEmailFiles([{ ...portal, way: 'file', page: null }])).toBeNull()
    expect(parseEmailFiles([{ ...portal, ref: 'drvAddendum2000' }])).toBeNull()
  })
})

describe('carryRefusal', () => {
  it('lets the files go when each is up to 10 MB and together up to 20 MB', () => {
    expect(carryRefusal([{ name: 'Addendum 2.pdf', bytes: 412 * KB }, { name: 'Rock clause, marked up.pdf', bytes: 640 * KB }])).toBeNull()
    expect(carryRefusal([{ name: 'a', bytes: 10 * MB }, { name: 'b', bytes: 10 * MB }])).toBeNull()
  })

  it('refuses a file of unknown size, one over 10 MB, and files together over 20 MB, in words', () => {
    const unknown = carryRefusal([{ name: 'Bid tab.xlsx', bytes: null }])
    expect(unknown).toEqual({ why: 'unknownSize', name: 'Bid tab.xlsx' })
    expect(carryWords(unknown!)).toBe('We do not know how big Bid tab.xlsx is, so it can only go as our link.')
    const over = carryRefusal([{ name: 'Survey.pdf', bytes: 10 * MB + 1 }])
    expect(carryWords(over!)).toBe('Survey.pdf is over the email limit of 10 MB, so it can only go as our link.')
    const together = carryRefusal([{ name: 'a', bytes: 9 * MB }, { name: 'b', bytes: 9 * MB }, { name: 'c', bytes: 3 * MB }])
    expect(together).toEqual({ why: 'overMessage', name: null })
    expect(carryWords(together!)).toBe('The files together are over the email limit of 20 MB. Send the largest as our link.')
  })
})

describe('the lines under the words', () => {
  it('gives one line a portal page, however many files share it, and one a file’s own link, as the text’s lines do', () => {
    expect(
      emailLinkLines([
        { name: 'Boerne Retail Shell plans, rev 2', url: 'https://clicktooling.com/t/7Hq2#plans', page: 'plans' },
        { name: 'Addendum 2.pdf', url: 'https://clicktooling.com/t/7Hq2#plans', page: 'plans' },
        { name: 'Rock clause, marked up.pdf', url: 'https://clicktooling.com/f/k3Pw9xQaB2cD4eF6gH8iJ0', page: null },
      ]),
    ).toEqual([
      { text: 'The plans are in your portal', url: 'https://clicktooling.com/t/7Hq2#plans' },
      { text: 'Rock clause, marked up.pdf', url: 'https://clicktooling.com/f/k3Pw9xQaB2cD4eF6gH8iJ0' },
    ])
  })

  it('opens their portal at the page, whatever anchor the address had', () => {
    expect(portalPageUrl('https://clicktooling.com/t/7Hq2', 'plans')).toBe('https://clicktooling.com/t/7Hq2#plans')
    expect(portalPageUrl('https://my.clickplumbing.com/raman#top', 'bills')).toBe('https://my.clickplumbing.com/raman#bills')
  })

  it('knows whose portal has each page, as jobFiles.ts does', () => {
    for (const page of Object.keys(PORTAL_PAGES) as PortalPage[]) {
      for (const who of ['trade', 'customer'] as const) expect(portalHasPage(who, page)).toBe(appPortalHasPage(who, page))
    }
  })
})

describe('base64OfBytes', () => {
  it('writes bytes as base64 a slice at a time, the same as one go', () => {
    expect(base64OfBytes(new Uint8Array([37, 80, 68, 70, 45]))).toBe('JVBERi0=')
    const big = new Uint8Array(0x8000 * 2 + 5).map((_, i) => i % 251)
    expect(base64OfBytes(big)).toBe(Buffer.from(big).toString('base64'))
  })
})

describe('outCopyPath', () => {
  it('keeps a file sent as the file under out/, by the line and its place, with a name the bucket takes', () => {
    expect(outCopyPath(UUID, 0, 'Rock clause, marked up.pdf')).toBe(`out/${UUID}/1-Rock clause_ marked up.pdf`)
    expect(outCopyPath(UUID, 2, '../../etc/passwd')).toBe(`out/${UUID}/3-.._.._etc_passwd`)
    expect(outCopyPath(UUID, 1, '日本語')).toBe(`out/${UUID}/2-_`)
  })
})
