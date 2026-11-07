import { describe, expect, it } from 'vitest'
import type { PlanSetRow } from '../plans/planSets'
import { askChipWords, askFromRequest, buildPapersView, emptyPaperDraft, fromGuess, historyLineForPaper, isPaperKind, kindGuess, moveLineForPaper, nameFromSubject, paperChipWords, paperDraftProblem, paperLineWords, papersFromRows, partsToMoveTo, type PaperRequest } from './papers'

function row(over: Partial<PlanSetRow> & { id: string }): PlanSetRow {
  return {
    part_id: 'p1', name: 'Fixture spec book', kind: 'spec', source: 'supplier', dated: null, came_at: '2025-07-07T12:00:00Z', memo: '', link: 'https://x/y',
    replaces_set_id: null, marks_up_set_id: 's1', job_id: null, file_name: null, file_size: null, file_count: null, checked_at: null, check_note: null,
    owed: false, ask_lane: null, ask_request_id: null, created_by: null, created_at: '2025-07-07T12:00:00Z', updated_at: '2025-07-07T12:00:00Z', ...over,
  }
}

describe('papers among the sets', () => {
  it('tells a paper kind from a drawing kind', () => {
    expect(isPaperKind('spec')).toBe(true)
    expect(isPaperKind('task_list')).toBe(true)
    expect(isPaperKind('addendum')).toBe(false)
    expect(isPaperKind('as_built')).toBe(false)
  })

  it('reads the paper rows out of a part’s sets and resolves each ask from its lane', () => {
    const rows = [
      row({ id: 'd1', kind: 'issued', name: 'Issued set' }),
      row({ id: 'a', name: 'The owner’s task list', kind: 'task_list', source: 'gc', came_at: '2026-06-24T12:00:00Z', ask_lane: 'estimators', ask_request_id: 'q1' }),
      row({ id: 'b', name: 'Soil report', kind: 'report', owed: true, link: '', came_at: '2025-09-15T12:00:00Z', ask_lane: 'estimators', ask_request_id: 'q2' }),
      row({ id: 'c', name: 'Loads table', kind: 'schedule', source: 'ours', marks_up_set_id: null, came_at: '2026-07-02T12:00:00Z' }),
    ]
    const requests: PaperRequest[] = [
      { id: 'q1', lane: 'estimators', title: 'Paint spec for the overhead piping?', status: 'open', created_at: '2026-06-25T15:00:00Z', closed_at: null, closed_note: null },
      { id: 'q2', lane: 'estimators', title: 'The owner owes the soil report', status: 'closed', created_at: '2025-09-15T12:00:00Z', closed_at: '2025-09-20T12:00:00Z', closed_note: 'Came by hand on site.' },
    ]
    const papers = papersFromRows(rows, requests)
    expect(papers.map((p) => p.id)).toEqual(['a', 'b', 'c'])
    expect(papers[0]!.ask).toEqual({ lane: 'estimators', words: 'Paint spec for the overhead piping?', askedAt: '2026-06-25T15:00:00Z', answer: null, answeredAt: null })
    expect(papers[1]!.ask?.answer).toBe('Came by hand on site.')
    const v = buildPapersView(papers, 'p1')
    expect(v.bySet.map((g) => [g.setId, g.papers.map((p) => p.id)])).toEqual([
      ['s1', ['a']],
      ['', ['c']],
    ])
    expect(v.owed.map((p) => p.id)).toEqual(['b'])
    expect(v.openAsks).toBe(1)
    expect(v.count).toBe(2)
    expect(paperChipWords(v)).toEqual({ papers: '2 papers', asks: '1 asks', owed: '1 owed' })
    expect(paperChipWords(buildPapersView([], 'p1'))).toEqual({ papers: null, asks: null, owed: null })
  })

  it('writes the lines', () => {
    expect(paperLineWords(row({ id: 'x', kind: 'task_list', source: 'gc', came_at: '2026-06-24T12:00:00Z' }))).toBe('Task list · the owner · came Jun 24')
    expect(paperLineWords(row({ id: 'x', kind: 'report', source: 'gc', owed: true, came_at: '2025-09-15T12:00:00Z' }))).toBe('Report · the owner · asked Sep 15')
    const now = Date.parse('2026-06-28T12:00:00Z')
    expect(askChipWords({ lane: 'estimators', words: 'x', askedAt: '2026-06-25T15:00:00Z', answer: null, answeredAt: null }, now)).toEqual({ words: 'asked the estimators Jun 25 · waiting 2 days', open: true })
    expect(askChipWords({ lane: 'dispatch', words: 'x', askedAt: '2026-06-25T15:00:00Z', answer: 'ok', answeredAt: '2026-06-26T15:00:00Z' }, now)).toEqual({ words: 'answered Jun 26', open: false })
    expect(askFromRequest({ id: 'q', lane: 'dispatch', title: 't', status: 'resolved', created_at: '2026-06-25T15:00:00Z', closed_at: null, closed_note: '' }).answeredAt).toBeNull()
  })

  it('writes the History line the trigger writes', () => {
    expect(historyLineForPaper({ kind: 'task_list', name: 'The owner’s task list', source: 'gc', memo: 'doors already bought', owed: false, askWords: 'paint spec?', askLane: 'estimators' }, 'Bunker addendum 1', null)).toBe(
      'Kept task list The owner’s task list, the owner, on Bunker addendum 1: doors already bought · asked the estimators: paint spec?',
    )
    expect(historyLineForPaper({ kind: 'schedule', name: 'Equipment schedule', source: 'ours', memo: '', owed: false, askWords: null, askLane: null }, null, 'July loads')).toBe('Kept schedule Equipment schedule, ours · replaces July loads')
    expect(historyLineForPaper({ kind: 'report', name: 'Soil report', source: 'gc', memo: 'never came by mail', owed: true, askWords: null, askLane: null }, null, null)).toBe('Owed: Soil report from the owner · never came by mail')
  })

  it('checks a draft and guesses from a mail', () => {
    const d = emptyPaperDraft('2026-11-02', 's1')
    expect(paperDraftProblem(d, false)).toBe('Give the paper a name.')
    expect(paperDraftProblem({ ...d, name: 'Spec', link: 'drive.google.com/x' }, false)).toMatch(/^Paste the paper’s link/)
    expect(paperDraftProblem({ ...d, name: 'Spec', asks: true }, false)).toBe('Say what it asks of us, in a line.')
    expect(paperDraftProblem({ ...d, name: 'Soil report' }, true)).toBe('Say who owes it and what it is.')
    expect(paperDraftProblem({ ...d, name: 'Spec' }, false)).toBeNull()
    expect(fromGuess('pat@quailridgearchitects.example')).toBe('architect')
    expect(fromGuess('sam@reece.example')).toBe('supplier')
    expect(fromGuess('office@clickplumbing.com')).toBe('ours')
    expect(fromGuess('owner@example.com')).toBe('gc')
    expect(kindGuess('Fwd: Task list items from the owner')).toBe('task_list')
    expect(kindGuess('Equipment schedule, presently')).toBe('schedule')
    expect(kindGuess('Submittals for HVAC')).toBe('submittal')
    expect(kindGuess('Hello')).toBe('other')
    expect(nameFromSubject('Fwd: Re: Task list items from the owner')).toBe('Task list items from the owner')
  })

  it('names the parts a paper may move to and writes the move line (v2.6632)', () => {
    const parts = [
      { id: 'p1', name: 'Lodge' },
      { id: 'p2', name: 'Bunker' },
      { id: 'p3', name: 'Site' },
    ]
    expect(partsToMoveTo(parts, 'p2').map((p) => p.name)).toEqual(['Lodge', 'Site'])
    expect(partsToMoveTo(parts.slice(1, 2), 'p2')).toEqual([])
    expect(moveLineForPaper({ kind: 'change_order', name: 'gun dog change order 3' }, 'Bunker', 'Lodge')).toBe('Moved change order gun dog change order 3 from Bunker to Lodge; it goes on Lodge itself now.')
  })
})
