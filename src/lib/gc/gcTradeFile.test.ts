/**
 * The trade portal's files (P5a-1, `_shared/gcTradeFile.ts`): the type read from the first bytes, never the name; the
 * 10 MB cap; the two folder rules; and a Drive name that never meets another file's.
 */
import { describe, expect, it } from 'vitest'
import {
  cleanFileName,
  driveFileUrl,
  driveMinute,
  fileMimeOf,
  parseTradeFile,
  TRADE_FILE_HOURLY_CAP,
  TRADE_FILE_MAX_BYTES,
  tradeFileDriveName,
  tradeFileFolders,
} from '../../../supabase/functions/_shared/gcTradeFile'

const SUB = '88888888-8888-4888-8888-888888888888'
const b64 = (...bytes: number[]) => btoa(String.fromCharCode(...bytes))
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0x10]
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]
const ftyp = (brand: string) => [0, 0, 0, 0x18, ...[...'ftyp'].map((c) => c.charCodeAt(0)), ...[...brand].map((c) => c.charCodeAt(0))]

describe('a trade’s file (P5a-1)', () => {
  it('reads the type from the first bytes, never the name', () => {
    expect(fileMimeOf(new Uint8Array(PDF))).toBe('application/pdf')
    expect(fileMimeOf(new Uint8Array(JPEG))).toBe('image/jpeg')
    expect(fileMimeOf(new Uint8Array(PNG))).toBe('image/png')
    expect(fileMimeOf(new Uint8Array(ftyp('heic')))).toBe('image/heic')
    expect(fileMimeOf(new Uint8Array(ftyp('mif1')))).toBe('image/heif')
    expect(fileMimeOf(new Uint8Array(ftyp('isom')))).toBeNull()
    expect(fileMimeOf(new TextEncoder().encode('PK\u0003\u0004'))).toBeNull()
    // A PDF named .jpg is a PDF; a ZIP named .pdf is refused.
    expect(parseTradeFile({ for: 'submittal', submittalId: SUB, name: 'scan.jpg', base64: b64(...PDF) })).toMatchObject({ mime: 'application/pdf', name: 'scan.jpg' })
    expect(parseTradeFile({ for: 'submittal', submittalId: SUB, name: 'a.pdf', base64: btoa('PK\u0003\u0004 zip') })).toBe('fileType')
  })

  it('takes a data URL or bare base64, and holds the cap at 10 MB', () => {
    expect(TRADE_FILE_MAX_BYTES).toBe(10 * 1024 * 1024)
    expect(parseTradeFile({ for: 'quote', inviteId: SUB, name: 'q.pdf', base64: `data:application/pdf;base64,${b64(...PDF)}` })).toMatchObject({ for: 'quote', recordId: SUB })
    const over = new Uint8Array(TRADE_FILE_MAX_BYTES + 1)
    over.set(PDF)
    let bin = ''
    for (let i = 0; i < over.length; i += 0x8000) bin += String.fromCharCode(...over.subarray(i, i + 0x8000))
    expect(parseTradeFile({ for: 'quote', inviteId: SUB, name: 'q.pdf', base64: btoa(bin) })).toBe('fileTooBig')
  })

  it('refuses a shape the page never sends', () => {
    for (const b of [
      { for: 'coi', submittalId: SUB, name: 'a.pdf', base64: b64(...PDF) },
      { for: 'submittal', packageId: SUB, name: 'a.pdf', base64: b64(...PDF) },
      { for: 'submittal', submittalId: 'sub-1', name: 'a.pdf', base64: b64(...PDF) },
      { for: 'submittal', submittalId: SUB, name: '   ', base64: b64(...PDF) },
      { for: 'submittal', submittalId: SUB, name: 'a.pdf', base64: '' },
      { for: 'submittal', submittalId: SUB, name: 'a.pdf', base64: 'not base64!' },
    ]) {
      expect(parseTradeFile(b), JSON.stringify(b).slice(0, 60)).toBeNull()
    }
  })

  it('cleans a name of paths and control characters', () => {
    expect(cleanFileName(' ../plans\\E-101:rev?.pdf ')).toBe('..-plans-E-101-rev-.pdf')
    expect(cleanFileName('a\u0007b   c.pdf')).toBe('a-b c.pdf')
  })

  it('puts a submittal’s file in Submittals and every other in Team only → From trades → the company', () => {
    expect(tradeFileFolders('submittal', 'Bright Line Electric')).toEqual(['Submittals'])
    expect(tradeFileFolders('change', 'Bright Line Electric')).toEqual(['Team only', 'From trades', 'Bright Line Electric'])
    expect(tradeFileFolders('quote', ' / ')).toEqual(['Team only', 'From trades', '-'])
  })

  it('names a file in Drive so it never meets another', () => {
    const at = new Date('2026-10-10T18:42:00Z')
    expect(driveMinute(at)).toBe('2026-10-10 1342')
    expect(tradeFileDriveName('submittal', 'panelboards.pdf', at, { number: '26 24 16-01', round: 2 })).toBe('26 24 16-01 round 2 - panelboards.pdf')
    expect(tradeFileDriveName('change', 'chairs.jpg', at)).toBe('2026-10-10 1342 - chairs.jpg')
    expect(driveFileUrl('abc')).toBe('https://drive.google.com/file/d/abc/view')
    expect(TRADE_FILE_HOURLY_CAP).toBe(20)
  })
})
