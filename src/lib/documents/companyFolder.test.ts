import { describe, expect, it } from 'vitest'
import { canUploadCompanyFiles, companyFileRows, companyFilesCountWords, companyUploadHold, companyUploadedWords, fileSizeWords } from './companyFolder'

describe('the company folder', () => {
  it('lets the four office roles upload, never the estimator or the field', () => {
    for (const r of ['dev', 'master_technician', 'assistant', 'controller']) expect(canUploadCompanyFiles(r)).toBe(true)
    for (const r of ['estimator', 'primary', 'superintendent', 'subcontractor', 'helpers', null, undefined]) expect(canUploadCompanyFiles(r)).toBe(false)
  })

  it('holds an empty, nameless or oversized file before it is sent, and lets the rest go', () => {
    expect(companyUploadHold({ size: 0, name: 'W-9.pdf' })).toBe('That file is empty.')
    expect(companyUploadHold({ size: 12, name: ' ' })).toBe('That file has no name.')
    expect(companyUploadHold({ size: 10 * 1024 * 1024 + 1, name: 'COI.pdf' })).toBe('COI.pdf is over 10 MB. Put it in the company folder in Drive instead.')
    expect(companyUploadHold({ size: 10 * 1024 * 1024, name: 'COI.pdf' })).toBeNull()
  })

  it('says a size in words, and nothing when Drive gave none', () => {
    expect(fileSizeWords(null)).toBe('')
    expect(fileSizeWords(12)).toBe('12 B')
    expect(fileSizeWords(340 * 1024)).toBe('340 KB')
    expect(fileSizeWords(1.25 * 1024 * 1024)).toBe('1.3 MB')
    expect(fileSizeWords(12 * 1024 * 1024)).toBe('12 MB')
  })

  it('lists the newest change first with its day and size', () => {
    const rows = companyFileRows([
      { id: 'a', name: 'W-9 2025.pdf', bytes: 120_000, mime: 'application/pdf', half: 'team_only', url: 'https://drive.google.com/file/d/a/view', modified: '2025-01-05T15:00:00Z' },
      { id: 'b', name: 'COI 2026.pdf', bytes: null, mime: 'application/pdf', half: 'team_only', url: 'https://drive.google.com/file/d/b/view', modified: '2026-03-02T15:00:00Z' },
      { id: 'c', name: 'Plumbing license.pdf', bytes: 2048, mime: 'application/pdf', half: 'team_only', url: 'https://drive.google.com/file/d/c/view', modified: null },
    ])
    expect(rows.map((r) => r.name)).toEqual(['COI 2026.pdf', 'W-9 2025.pdf', 'Plumbing license.pdf'])
    expect(rows[0]).toMatchObject({ id: 'b', size: '', day: '2026-03-02' })
    expect(rows[1]).toMatchObject({ size: '117 KB', day: '2025-01-05' })
    expect(rows[2]).toMatchObject({ size: '2 KB', day: '' })
  })

  it('counts the list and says when the folder holds more', () => {
    expect(companyFilesCountWords(1, false)).toBe('1 file in the company folder.')
    expect(companyFilesCountWords(12, false)).toBe('12 files in the company folder.')
    expect(companyFilesCountWords(500, true)).toBe('The first 500 files in the company folder. Open the folder for the rest.')
    expect(companyUploadedWords('W-9 2026.pdf')).toBe('W-9 2026.pdf is in the company folder.')
  })
})
