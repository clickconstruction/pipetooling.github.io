import { describe, expect, it } from 'vitest'
import { LIEN_CLERK_PAGE_NOTE } from './lienServiceProof'
import { LIEN_CLERK_SCAN_NOTE, LIEN_SCAN_ACCEPT, lienFiledScanName, lienScanExtension, lienScanIsPdf, lienScanProblem } from './lienScanFile'

describe('lienScanProblem', () => {
  it('takes a PDF, a picture, and a scanner’s file with no type but a PDF name', () => {
    expect(lienScanProblem({ size: 400_000, type: 'application/pdf', name: 'scan.pdf' }, 'affidavit')).toBeNull()
    expect(lienScanProblem({ size: 400_000, type: 'image/jpeg', name: 'IMG_0412.jpg' }, 'affidavit')).toBeNull()
    expect(lienScanProblem({ size: 400_000, type: '', name: 'SCAN0007.PDF' }, 'affidavit')).toBeNull()
    expect(lienScanIsPdf({ type: '', name: 'SCAN0007.PDF' })).toBe(true)
  })

  it('refuses another kind of file, an empty one, and one over the folder’s limit, each with what to do', () => {
    expect(lienScanProblem({ size: 400_000, type: 'text/plain', name: 'notes.txt' }, 'affidavit')).toBe('That file is not a scan or a photo. Add a PDF or a picture.')
    expect(lienScanProblem({ size: 0, type: 'application/pdf', name: 'scan.pdf' }, 'affidavit')).toBe('That file is empty. Scan the papers again.')
    expect(lienScanProblem({ size: 14 * 1024 * 1024, type: 'application/pdf', name: 'stack.pdf' }, 'affidavit')).toBe('That file is 14 MB. The most a file can be is 10 MB. Scan this affidavit alone, or at a lower quality.')
    expect(lienScanProblem({ size: 14 * 1024 * 1024, type: 'application/pdf', name: 'stack.pdf' }, 'notice')).toContain('Scan this notice alone')
  })

  it('offers both kinds to the picker', () => {
    expect(LIEN_SCAN_ACCEPT).toBe('application/pdf,image/*')
  })
})

describe('the scan’s name in Drive', () => {
  it('says what it is, whose job and the day filed, and keeps the file’s own extension', () => {
    expect(lienFiledScanName('2291', '2026-11-13', { type: 'application/pdf', name: 'SCAN0007.PDF' })).toBe('Lien affidavit, Job 2291, the clerk’s stamped affidavit, scanned, 2026-11-13.pdf')
    expect(lienFiledScanName(' ', '', { type: 'image/png', name: 'shot' })).toBe('Lien affidavit, the clerk’s stamped affidavit, scanned.png')
    expect(lienScanExtension({ type: 'application/pdf', name: 'scan' })).toBe('pdf')
    expect(lienScanExtension({ type: '', name: 'scan' })).toBe('jpg')
  })

  it('has a note of its own, so a photo of the page and a scan are told apart', () => {
    expect(LIEN_CLERK_SCAN_NOTE).not.toBe(LIEN_CLERK_PAGE_NOTE)
  })
})
