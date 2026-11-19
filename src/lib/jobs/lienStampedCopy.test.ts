import { describe, expect, it } from 'vitest'
import {
  LIEN_COPY_ASK_BYTES,
  LIEN_COPY_ASK_PAGES,
  isStampedPrintSnapshot,
  lienCopyDoubt,
  lienCopyKind,
  lienCopyPagesWords,
  lienCopyReadyWords,
  lienCopySeveralHold,
  lienCopySizeWords,
  lienCopySource,
  lienCopyUnreadableHold,
  lienStampedPrintFileName,
  lienStampedPrintSnapshot,
} from './lienStampedCopy'

const bytes = (...head: number[]) => new Uint8Array([...head, 0, 0, 0, 0, 0, 0, 0, 0])
const text = (s: string) => new TextEncoder().encode(s)

describe('where a filing’s saved copy is', () => {
  it('finds the file in Drive behind the link', () => {
    expect(lienCopySource('https://drive.google.com/file/d/1SampleStampedScan01/view')).toEqual({ kind: 'drive', fileId: '1SampleStampedScan01', url: 'https://drive.google.com/file/d/1SampleStampedScan01/view' })
    expect(lienCopySource(' https://drive.google.com/open?id=1SampleStampedScan01 ')).toMatchObject({ kind: 'drive', fileId: '1SampleStampedScan01' })
  })

  it('knows a link typed by hand to somewhere else, which the app cannot read', () => {
    expect(lienCopySource('https://www.dropbox.com/s/abc/scan.pdf')).toEqual({ kind: 'not_drive', url: 'https://www.dropbox.com/s/abc/scan.pdf' })
    expect(lienCopySource('example.com/scan.pdf')).toMatchObject({ kind: 'not_drive' })
    // A Drive folder is not a file.
    expect(lienCopySource('https://drive.google.com/drive/folders/1SampleFolder0000001')).toMatchObject({ kind: 'not_drive' })
  })

  it('reads nothing, or a note typed in the link’s place, as no copy', () => {
    for (const v of [null, undefined, '', '   ', 'in the red folder', 'n/a']) expect(lienCopySource(v)).toEqual({ kind: 'none' })
  })
})

describe('what a saved copy is, by its own bytes', () => {
  it('knows a PDF, a JPEG and a PNG', () => {
    expect(lienCopyKind(text('%PDF-1.7\n…'))).toBe('pdf')
    // A scanner may put a line in front of the header.
    expect(lienCopyKind(text('\n\n%PDF-1.4'))).toBe('pdf')
    expect(lienCopyKind(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('jpeg')
    expect(lienCopyKind(bytes(0x89, 0x50, 0x4e, 0x47))).toBe('png')
  })

  it('knows nothing else, whatever its name said', () => {
    expect(lienCopyKind(text('<!doctype html><html>Sign in to Google</html>'))).toBeNull()
    // A HEIC photo off a phone.
    expect(lienCopyKind(bytes(0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63))).toBeNull()
    expect(lienCopyKind(new Uint8Array())).toBeNull()
  })
})

describe('a copy that looks like more than one lien', () => {
  it('lets the usual two pages through, and a third', () => {
    expect(lienCopyDoubt({ pages: 2, bytes: 480_000 })).toBe('')
    expect(lienCopyDoubt({ pages: LIEN_COPY_ASK_PAGES, bytes: 900_000 })).toBe('')
    expect(lienCopyDoubt({ pages: 1, bytes: LIEN_COPY_ASK_BYTES })).toBe('')
  })

  it('asks about many pages: the 18-page stack of eight liens of 2026-11-18', () => {
    expect(lienCopyDoubt({ pages: 18, bytes: 3_900_000 })).toBe('the saved copy has 18 pages, and a stamped lien is usually 2')
    expect(lienCopyDoubt({ pages: 4, bytes: 100 })).toBe('the saved copy has 4 pages, and a stamped lien is usually 2')
  })

  it('asks about a file several times the usual size', () => {
    expect(lienCopyDoubt({ pages: 2, bytes: 6_500_000 })).toBe('the saved copy is 6.2 MB, several times a usual scan')
  })

  it('holds it with a door, and the reader can lift it', () => {
    expect(lienCopySeveralHold('the saved copy has 18 pages, and a stamped lien is usually 2')).toEqual({
      key: 'copy_several',
      words: 'the saved copy has 18 pages, and a stamped lien is usually 2',
      act: 'Open it and look. If it holds other liens, put this lien’s own scan in its place on the job’s Lien window.',
      door: 'scan',
      ask: true,
    })
  })
})

describe('the words', () => {
  it('counts pages and sizes as a person reads them', () => {
    expect(lienCopyPagesWords(1)).toBe('1 page')
    expect(lienCopyPagesWords(2)).toBe('2 pages')
    expect(lienCopyReadyWords({ pages: 2 })).toBe('Stamped copy: 2 pages.')
    expect(lienCopySizeWords(480_000)).toBe('469 KB')
    expect(lienCopySizeWords(6_500_000)).toBe('6.2 MB')
  })

  it('says why a copy could not be read, in the door’s own words', () => {
    expect(lienCopyUnreadableHold('That file is not in the job’s Drive folder.')).toMatchObject({ key: 'copy_unreadable', words: 'the app could not read the saved copy: That file is not in the job’s Drive folder', door: 'scan' })
    expect(lienCopyUnreadableHold('').words).toBe('the app could not read the saved copy: the file did not come through')
  })
})

describe('what the kept print says about itself', () => {
  const file = { kind: 'pdf' as const, pages: 2, bytes: 472_378, sha256: 'ab12' }

  it('names the stamped scan that went in the envelope', () => {
    const snapshot = lienStampedPrintSnapshot({ fileId: '1SampleStampedScan01', file, envelopes: 2, letter: true })
    expect(snapshot).toEqual({ copy: 'stamped', drive_file_id: '1SampleStampedScan01', scan_sha256: 'ab12', scan_pages: 2, scan_bytes: 472_378, envelopes: 2, letter: true })
    expect(isStampedPrintSnapshot(snapshot)).toBe(true)
  })

  it('does not take a print of the old redrawn page for one', () => {
    // A print made before v2.7916 has no note at all.
    for (const v of [null, undefined, '', {}, { copy: 'redrawn' }, 'stamped']) expect(isStampedPrintSnapshot(v)).toBe(false)
  })

  it('names the kept file by its job', () => {
    expect(lienStampedPrintFileName('2291')).toBe('copy-of-lien-affidavit-job-2291.pdf')
    expect(lienStampedPrintFileName(' JP 858 ')).toBe('copy-of-lien-affidavit-job-JP-858.pdf')
    expect(lienStampedPrintFileName('')).toBe('copy-of-lien-affidavit.pdf')
  })
})
