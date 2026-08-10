import { describe, expect, it } from 'vitest'
import { computeStagesActivityFeedItems } from './stagesActivityFeed'

const EMPTY = {
  lastNoteAt: null,
  lastNoteAuthorName: null,
  lastNoteBody: null,
  lastReportAt: null,
  lastReportAuthorName: null,
  lastReportPreview: null,
  lastReportTemplateName: null,
}

describe('computeStagesActivityFeedItems', () => {
  it('returns note and report sorted newest first (note newer)', () => {
    const items = computeStagesActivityFeedItems({
      ...EMPTY,
      lastNoteAt: '2026-08-07T20:36:00Z',
      lastNoteAuthorName: 'Taunya',
      lastNoteBody: 'Called Laura — trim set pushed to Friday.',
      lastReportAt: '2026-08-05T15:00:00Z',
      lastReportAuthorName: 'Abraham',
      lastReportPreview: 'Rough-in walkthrough, 2 photos.',
      lastReportTemplateName: 'Walkthrough',
    })
    expect(items.map((i) => i.kind)).toEqual(['note', 'report'])
    expect(items[0]).toMatchObject({ author: 'Taunya', body: 'Called Laura — trim set pushed to Friday.' })
    expect(items[1]).toMatchObject({ author: 'Abraham', body: 'Rough-in walkthrough, 2 photos.' })
  })

  it('puts the report first when it is newer than the note', () => {
    const items = computeStagesActivityFeedItems({
      ...EMPTY,
      lastNoteAt: '2026-08-01T10:00:00Z',
      lastNoteBody: 'old note',
      lastReportAt: '2026-08-09T10:00:00Z',
      lastReportPreview: 'fresh report',
    })
    expect(items.map((i) => i.kind)).toEqual(['report', 'note'])
  })

  it('report body falls back to "Report: <template>" when there is no preview', () => {
    const items = computeStagesActivityFeedItems({
      ...EMPTY,
      lastReportAt: '2026-08-09T10:00:00Z',
      lastReportPreview: '   ',
      lastReportTemplateName: 'Take 5 inspection',
    })
    expect(items).toHaveLength(1)
    expect(items[0]?.body).toBe('Report: Take 5 inspection')
  })

  it('note author/body fall back to the thread-derived values', () => {
    const items = computeStagesActivityFeedItems({
      ...EMPTY,
      lastNoteAt: '2026-08-09T10:00:00Z',
      lastNoteAuthorName: '  ',
      lastNoteBody: '',
      fallbackNoteAuthorName: 'Wendi',
      fallbackNoteBody: 'from the loaded thread',
    })
    expect(items[0]).toMatchObject({ author: 'Wendi', body: 'from the loaded thread' })
  })

  it('skips entries with missing or unparseable timestamps', () => {
    expect(computeStagesActivityFeedItems({ ...EMPTY })).toEqual([])
    expect(
      computeStagesActivityFeedItems({
        ...EMPTY,
        lastNoteAt: 'not-a-date',
        lastNoteBody: 'body',
        lastReportAt: '   ',
        lastReportPreview: 'preview',
      }),
    ).toEqual([])
  })

  it('note-only input yields a single note item with empty-string fallbacks', () => {
    const items = computeStagesActivityFeedItems({
      ...EMPTY,
      lastNoteAt: '2026-08-09T10:00:00Z',
    })
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ kind: 'note', author: '', body: '' })
  })
})
