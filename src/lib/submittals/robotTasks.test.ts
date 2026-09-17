import { describe, expect, it } from 'vitest'
import { confirmLabel, guessByPage, liveTask, redlinesToConfirm, scheduleToConfirm, sheetGuessesToConfirm, type SubmittalTaskRow } from './robotTasks'

const task = (o: Partial<SubmittalTaskRow>): SubmittalTaskRow => ({ id: 't', bid_id: 'b', submittal_id: 'r', kind: 'read_schedule', input: {}, result: null, status: 'queued', requested_at: '2026-09-17T10:00:00Z', claimed_at: null, finished_at: null, reviewed_at: null, summary: null, ...o })

describe('robotTasks', () => {
  it('liveTask picks the newest live task of a kind on the matching input; done ones are history', () => {
    const tasks = [task({ id: 'a', status: 'done' }), task({ id: 'b', status: 'ready', requested_at: '2026-09-17T11:00:00Z' }), task({ id: 'c', kind: 'file_cut_sheets', status: 'queued', input: { file_index: 1 } }), task({ id: 'd', kind: 'file_cut_sheets', status: 'blocked', input: { file_index: 0 } })]
    expect(liveTask(tasks, 'read_schedule')?.id).toBe('b')
    expect(liveTask(tasks, 'file_cut_sheets', (i) => i.file_index === 0)?.id).toBe('d')
    expect(liveTask(tasks, 'read_redlines')).toBeNull()
  })
  it('splits a ready schedule into sure and want-a-look; nothing when not ready', () => {
    const t = task({ status: 'ready', result: { rows: [{ tag: 'WC-1', confidence: 0.9 }, { tag: 'HB-3', model: 'B74-CH', confidence: 0.4 }] } })
    const s = scheduleToConfirm(t)!
    expect(s.sure.map((r) => r.tag)).toEqual(['WC-1'])
    expect(s.look.map((r) => r.tag)).toEqual(['HB-3'])
    expect(scheduleToConfirm(task({ status: 'working', result: { rows: [] } }))).toBeNull()
    expect(confirmLabel(s.sure.length, s.look.length)).toBe('Confirm 1 · pick 1')
    expect(confirmLabel(3, 0)).toBe('Confirm 3')
    expect(confirmLabel(0, 0)).toBe('')
  })
  it('sheet guesses by page with the tier', () => {
    const t = task({ kind: 'file_cut_sheets', status: 'ready', result: { guesses: [{ page: 1, tag: 'WC-1', confidence: 0.95 }, { page: 2, tag: 'WC-1', confidence: 0.6 }], skipped: [3] } })
    const g = sheetGuessesToConfirm(t, 4)!
    expect(g.sure).toHaveLength(1)
    expect(g.unsure).toHaveLength(1)
    expect(g.skipped).toEqual([3])
    expect([...guessByPage(g).entries()]).toEqual([[1, { tag: 'WC-1', sure: true }], [2, { tag: 'WC-1', sure: false }]])
  })
  it('redlines split into sure decisions, unsure ones and questions', () => {
    const t = task({ kind: 'read_redlines', status: 'ready', result: { annotations: [{ tag: 'DWH-1', text: 'per spec', proposed: 'revise', confidence: 0.9 }, { tag: 'RD-2', text: '21512?', proposed: 'revise', confidence: 0.5 }, { text: 'same body?', proposed: 'question' }] } })
    const r = redlinesToConfirm(t)!
    expect(r.sure.map((a) => a.tag)).toEqual(['DWH-1'])
    expect(r.unsure.map((a) => a.tag)).toEqual(['RD-2'])
    expect(r.questions.map((a) => a.text)).toEqual(['same body?'])
    expect(confirmLabel(r.sure.length, r.unsure.length, 'settle')).toBe('Confirm 1 · settle 1')
  })
})
