import { describe, expect, it } from 'vitest'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import { describeEnteredCount, describeReviewerFile, parseReviewerFiles, reviewerFileKind, reviewerFilePath, serializeReviewerFiles } from './reviewerFiles'

describe('reviewerFiles', () => {
  it('a PDF is a redline, an email file is an email, anything else is refused', () => {
    expect(reviewerFileKind('SUBMITTALS-REVISED.pdf')).toBe('redline')
    expect(reviewerFileKind('blob', 'application/pdf')).toBe('redline')
    expect(reviewerFileKind('Re_ submittals.eml')).toBe('email')
    expect(reviewerFileKind('fwd.msg')).toBe('email')
    expect(reviewerFileKind('notes.txt')).toBe('email')
    expect(reviewerFileKind('photo.jpg')).toBeNull()
  })
  it('the path is under the revision, safe and short', () => {
    expect(reviewerFilePath('b1', 'r2', 0, 'Dana W. — redlines (Sep 1).pdf')).toBe('b1/r2/reviewer/0-Dana_W._redlines_Sep_1_.pdf')
    expect(reviewerFilePath('b1', 'r2', 3, '   ')).toBe('b1/r2/reviewer/3-file')
  })
  it('parses and serializes round-trip, dropping junk', () => {
    const files = parseReviewerFiles([{ path: 'b/r/reviewer/0-x.pdf', name: 'x.pdf', kind: 'redline', dropped_at: '2026-09-17T15:00:00Z', dropped_by: 'u1', dropped_by_name: 'Wendi', person_id: 'p1', person_name: 'Dana Whitfield' }, { nope: true }, 'junk', { path: 'b/r/reviewer/1-m.eml', kind: 'email' }])
    expect(files).toHaveLength(2)
    expect(files[0]).toMatchObject({ kind: 'redline', droppedByName: 'Wendi', personName: 'Dana Whitfield' })
    expect(files[1]).toMatchObject({ name: '1-m.eml', kind: 'email', droppedAt: '', personId: null })
    expect(parseReviewerFiles(serializeReviewerFiles(files))).toEqual(files)
    expect(parseReviewerFiles(null)).toEqual([])
  })
  it('describes the file and the entered count', () => {
    const f = parseReviewerFiles([{ path: 'p', name: 'x.pdf', kind: 'redline', dropped_at: '2026-09-17T15:00:00Z', dropped_by_name: 'Wendi', person_name: 'Dana Whitfield' }])[0]!
    expect(describeReviewerFile(f, APP_CALENDAR_TZ)).toBe("Dana Whitfield's redlined PDF · dropped Sep 17 by Wendi")
    expect(describeReviewerFile({ ...f, kind: 'email', personName: null, droppedByName: null }, APP_CALENDAR_TZ)).toBe("a reviewer's forwarded email · dropped Sep 17")
    expect(describeEnteredCount(0)).toBe('')
    expect(describeEnteredCount(1)).toBe('1 row entered by hand on this revision')
    expect(describeEnteredCount(2)).toBe('2 rows entered by hand on this revision')
  })
})
