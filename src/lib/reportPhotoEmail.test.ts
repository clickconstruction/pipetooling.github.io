import { describe, expect, it } from 'vitest'
import {
  photoBytesBase64,
  photoBytesWords,
  planReportEmailPhotos,
  reportEmailPhotoFilename,
  reportPhotoCountClause,
  reportPhotosEmailBlock,
  REPORT_EMAIL_PHOTO_MAX_COUNT,
  type ReportEmailPhotoRow,
} from '../../supabase/functions/_shared/reportPhotoEmail'

const row = (p: Partial<ReportEmailPhotoRow> & { id: string }): ReportEmailPhotoRow => ({
  stage_name: 'Rough In',
  caption: 'Rough In',
  by_name: 'Luis Ortega',
  bytes: 310_000,
  storage_path: `job-1/${p.id}.jpg`,
  drive_file_id: null,
  fail_why: null,
  ...p,
})

// A report's photos on its email (punch list #229, PR 5): what attaches, what links, what is only named.
describe('reportPhotoEmail kernel', () => {
  it('attaches a shot still in the bucket, links one the sweep filed, and names one with no bytes anywhere', () => {
    const plan = planReportEmailPhotos([row({ id: 'a' }), row({ id: 'b', drive_file_id: 'drive-b' }), row({ id: 'c', storage_path: null, caption: 'Water heater', stage_name: '' })])
    expect(plan.map((p) => p.how)).toEqual(['attached', 'drive', 'named'])
    expect(plan[0]).toMatchObject({ label: 'Rough In · Luis Ortega', filename: '1 Rough In · Luis Ortega.jpg', storagePath: 'job-1/a.jpg', driveUrl: null })
    expect(plan[1]!.driveUrl).toBe('https://drive.google.com/file/d/drive-b/view')
    expect(plan[1]!.storagePath).toBeNull()
    expect(plan[2]!.label).toBe('Water heater · Luis Ortega')
  })

  it('stops attaching past the count and the bytes, and names the rest', () => {
    const many = Array.from({ length: REPORT_EMAIL_PHOTO_MAX_COUNT + 2 }, (_, i) => row({ id: `p${i}` }))
    const byCount = planReportEmailPhotos(many)
    expect(byCount.filter((p) => p.how === 'attached')).toHaveLength(REPORT_EMAIL_PHOTO_MAX_COUNT)
    expect(byCount.slice(-2).map((p) => p.how)).toEqual(['named', 'named'])
    const byBytes = planReportEmailPhotos([row({ id: 'x', bytes: 600 }), row({ id: 'y', bytes: 500 }), row({ id: 'z', bytes: 100 })], { maxBytes: 1000 })
    // The second does not fit; the third, smaller, still does: the caps are applied as the rows come.
    expect(byBytes.map((p) => p.how)).toEqual(['attached', 'named', 'attached'])
  })

  it('the attachment name is numbered and safe for a mail client', () => {
    expect(reportEmailPhotoFilename('Rough In · Luis Ortega', 0)).toBe('1 Rough In · Luis Ortega.jpg')
    expect(reportEmailPhotoFilename('Bath 2 / "drain" <pipe>', 3)).toBe('4 Bath 2 drain pipe.jpg')
    expect(reportEmailPhotoFilename('   ', 1)).toBe('2 Photo.jpg')
  })

  it('the block names the count, each photo with its size, and how it rides; nothing for none', () => {
    expect(reportPhotosEmailBlock([])).toEqual({ html: '', text: '' })
    const plan = planReportEmailPhotos([row({ id: 'a' }), row({ id: 'b', drive_file_id: 'drive-b', bytes: 298_000 })])
    const block = reportPhotosEmailBlock(plan)
    expect(block.html).toContain('Photos · 2 · 1 attached')
    expect(block.html).toContain('Rough In · Luis Ortega · 303 KB · attached')
    expect(block.html).toContain('<a href="https://drive.google.com/file/d/drive-b/view" style="color:#2563eb">in the customer’s Drive folder</a>')
    expect(block.text).toBe('Photos · 2 · 1 attached:\nRough In · Luis Ortega · 303 KB · attached\nRough In · Luis Ortega · 291 KB · in the customer’s Drive folder https://drive.google.com/file/d/drive-b/view\n')
    const all = reportPhotosEmailBlock(planReportEmailPhotos([row({ id: 'a' })]))
    expect(all.html).toContain('Photos · 1 · attached')
    const none = reportPhotosEmailBlock(planReportEmailPhotos([row({ id: 'c', storage_path: null })]))
    expect(none.html).toContain('Photos · 1<')
    expect(none.html).toContain('on its way to the customer’s Drive folder, not attached')
  })

  it('the bytes go as base64, in pieces', () => {
    const small = new TextEncoder().encode('hello')
    expect(photoBytesBase64(small)).toBe('aGVsbG8=')
    const big = new Uint8Array(0x8000 * 3 + 7).fill(0x41)
    expect(photoBytesBase64(big)).toBe(btoa('A'.repeat(0x8000 * 3 + 7)))
  })

  it('the size words and the push clause', () => {
    expect(photoBytesWords(310_000)).toBe('303 KB')
    expect(photoBytesWords(1_300_000)).toBe('1.2 MB')
    expect(reportPhotoCountClause(0)).toBe('')
    expect(reportPhotoCountClause(1)).toBe(' · 1 photo')
    expect(reportPhotoCountClause(3)).toBe(' · 3 photos')
  })
})
