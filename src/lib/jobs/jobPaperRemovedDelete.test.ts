/**
 * The rule for deleting a taken-off paper of a test job (punch list #443, row 10): who reads the fold, what the
 * function's answer becomes, why a paper stays, and the words of the confirm. Made-up names.
 */
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import {
  REMOVED_PAPERS_NOTE,
  REMOVED_PAPER_DELETE_PRESS,
  parseRemovedPapers,
  removedPaperDayWords,
  removedPaperDeleteConfirm,
  removedPaperDeletedWords,
  removedPaperStaysWhy,
  removedPapersDrawn,
  removedPapersHeading,
} from './jobPaperRemovedDelete'

const ZZ = { job_name: 'ZZ Test papers walk', customer_name: 'Larkfield Homes' }
const ZZ_BY_CUSTOMER = { job_name: 'Lot 9 rough-in', customer_name: 'zz test customer' }
const REAL = { job_name: 'Larkfield Lot 9', customer_name: 'Larkfield Homes' }
const free = { copies: 0, proposals: 0, takenAs: 0, revisions: 0 }

describe('removedPapersDrawn', () => {
  it('draws the fold for a dev on a ZZ test job, by the job’s name or its customer’s', () => {
    expect(removedPapersDrawn('dev', ZZ)).toBe(true)
    expect(removedPapersDrawn('dev', ZZ_BY_CUSTOMER)).toBe(true)
  })
  it('draws nothing on a real job, or a job whose names are not known', () => {
    expect(removedPapersDrawn('dev', REAL)).toBe(false)
    expect(removedPapersDrawn('dev', {})).toBe(false)
    expect(removedPapersDrawn('dev', null)).toBe(false)
    expect(removedPapersDrawn('dev', undefined)).toBe(false)
  })
  it('draws nothing for every other role, on a test job too', () => {
    for (const role of ['master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'subcontractor', 'helpers', '', null, undefined]) {
      expect(removedPapersDrawn(role, ZZ)).toBe(false)
    }
  })
})

describe('parseRemovedPapers', () => {
  const row = (over: Record<string, unknown> = {}) => ({ id: 'p1', paper_name: ' ZZ Test site rules ', required_at: '2026-11-20T15:00:00Z', removed_at: '2026-11-24T20:00:00Z', copies: 0, proposals: 0, taken_as: 0, revisions: 0, ...over })
  it('reads each paper in the order the function gave, with its four counts', () => {
    const papers = parseRemovedPapers({ ok: true, job_id: 'j1', papers: [row({ id: 'p2', copies: 2, taken_as: 1 }), row()] })
    expect(papers).toEqual([
      { id: 'p2', paperName: 'ZZ Test site rules', requiredAt: '2026-11-20T15:00:00Z', removedAt: '2026-11-24T20:00:00Z', copies: 2, proposals: 0, takenAs: 1, revisions: 0 },
      { id: 'p1', paperName: 'ZZ Test site rules', requiredAt: '2026-11-20T15:00:00Z', removedAt: '2026-11-24T20:00:00Z', copies: 0, proposals: 0, takenAs: 0, revisions: 0 },
    ])
  })
  it('answers an empty list for a job with no taken-off paper', () => {
    expect(parseRemovedPapers({ ok: true, job_id: 'j1', papers: [] })).toEqual([])
  })
  it('throws on anything that is not the function’s answer', () => {
    for (const raw of [null, undefined, 'ok', [], {}, { ok: false, papers: [] }, { ok: true }, { ok: true, papers: 'none' }]) {
      expect(() => parseRemovedPapers(raw)).toThrow('The taken-off papers could not be read.')
    }
  })
  it('leaves out a row with no id, and holds a paper whose count did not come as a number', () => {
    const papers = parseRemovedPapers({ ok: true, papers: [row({ id: '' }), null, 'x', row({ id: 'p3', copies: '1', removed_at: 'not a day', paper_name: '' })] })
    expect(papers).toHaveLength(1)
    expect(papers[0]!.id).toBe('p3')
    expect(papers[0]!.paperName).toBe('A paper with no name')
    expect(papers[0]!.removedAt).toBeNull()
    expect(Number.isNaN(papers[0]!.copies)).toBe(true)
    expect(removedPaperStaysWhy(papers[0]!)).toBe('What points at this paper could not be read. Nothing was deleted.')
  })
})

describe('removedPaperStaysWhy', () => {
  it('lets a paper go when nothing points at it', () => {
    expect(removedPaperStaysWhy(free)).toBe('')
  })
  it('says each tie in the sentence the function raises for it, one and many', () => {
    expect(removedPaperStaysWhy({ ...free, copies: 1 })).toBe('A copy on a person’s file names this paper. It stays.')
    expect(removedPaperStaysWhy({ ...free, copies: 3 })).toBe('3 copies on people’s files name this paper. It stays.')
    expect(removedPaperStaysWhy({ ...free, proposals: 1 })).toBe('A GC proposal was made on this paper. It stays.')
    expect(removedPaperStaysWhy({ ...free, proposals: 2 })).toBe('2 GC proposals were made on this paper. It stays.')
    expect(removedPaperStaysWhy({ ...free, takenAs: 1 })).toBe('A GC proposal was taken as this paper. It stays.')
    expect(removedPaperStaysWhy({ ...free, takenAs: 2 })).toBe('2 GC proposals were taken as this paper. It stays.')
    expect(removedPaperStaysWhy({ ...free, revisions: 1 })).toBe('Another paper is a revision of this one. Delete the later one first.')
    expect(removedPaperStaysWhy({ ...free, revisions: 2 })).toBe('2 other papers are a revision of this one. Delete the later one first.')
  })
  it('names the first tie in the function’s order: copies, proposals made, proposals taken, revisions', () => {
    expect(removedPaperStaysWhy({ copies: 1, proposals: 1, takenAs: 1, revisions: 1 })).toContain('A copy on a person’s file')
    expect(removedPaperStaysWhy({ copies: 0, proposals: 1, takenAs: 1, revisions: 1 })).toContain('made on this paper')
    expect(removedPaperStaysWhy({ copies: 0, proposals: 0, takenAs: 1, revisions: 1 })).toContain('taken as this paper')
  })
  it('holds a paper whose counts could not be read', () => {
    expect(removedPaperStaysWhy({ ...free, revisions: Number.NaN })).toBe('What points at this paper could not be read. Nothing was deleted.')
    expect(removedPaperStaysWhy({ ...free, proposals: -1 })).toBe('What points at this paper could not be read. Nothing was deleted.')
  })
})

describe('the words', () => {
  it('writes the day a paper came off in the company’s time zone', () => {
    expect(removedPaperDayWords('2026-11-24T20:00:00Z')).toBe('Tue, Nov 24')
    // Two in the morning in Greenwich is still the evening before in the company's zone.
    expect(removedPaperDayWords('2026-11-25T02:00:00Z')).toBe('Tue, Nov 24')
    expect(removedPaperDayWords(null)).toBe('')
    expect(removedPaperDayWords('not a day')).toBe('')
  })
  it('counts the papers on the fold’s line', () => {
    expect(removedPapersHeading(1)).toBe('Taken-off papers · 1')
    expect(removedPapersHeading(14)).toBe('Taken-off papers · 14')
  })
  it('asks first in a confirm that names the paper, says it cannot be brought back, and whose button names the act', () => {
    const c = removedPaperDeleteConfirm('ZZ Test site rules')
    expect(c.title).toBe('Delete ZZ Test site rules for good?')
    expect(c.message).toContain('cannot be brought back')
    expect(c.confirmLabel).toBe('Delete the paper')
    expect(c.confirmLabel).not.toMatch(/^ok$/i)
  })
  it('says what went once it is gone', () => {
    expect(removedPaperDeletedWords('ZZ Test site rules')).toBe('ZZ Test site rules was deleted.')
    expect(REMOVED_PAPER_DELETE_PRESS).toBe('Delete…')
  })
  it('keeps every sentence a person reads to the plain-words rules', () => {
    const words = [
      REMOVED_PAPERS_NOTE,
      removedPaperDeleteConfirm('ZZ Test site rules').title,
      removedPaperDeleteConfirm('ZZ Test site rules').message,
      removedPaperDeletedWords('ZZ Test site rules'),
      removedPaperStaysWhy({ ...free, copies: 1 }),
      removedPaperStaysWhy({ ...free, copies: 3 }),
      removedPaperStaysWhy({ ...free, proposals: 2 }),
      removedPaperStaysWhy({ ...free, takenAs: 2 }),
      removedPaperStaysWhy({ ...free, revisions: 2 }),
      removedPaperStaysWhy({ ...free, revisions: Number.NaN }),
    ]
    for (const w of words) expect(plainWordsFailures(w)).toEqual([])
  })
})
