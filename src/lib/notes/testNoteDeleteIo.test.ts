import { beforeEach, describe, expect, it, vi } from 'vitest'

/** What the database answers each table's statements in turn, and every call each statement made, in order. */
const db = vi.hoisted(() => ({
  answers: {} as Record<string, Array<{ data: unknown; error: unknown; count?: number | null }>>,
  statements: [] as Array<{ table: string; calls: Array<[string, unknown[]]> }>,
}))
vi.mock('../supabase', () => {
  const builder = (table: string) => {
    const statement = { table, calls: [] as Array<[string, unknown[]]> }
    db.statements.push(statement)
    const b: Record<string, unknown> = new Proxy(
      {},
      {
        get: (_t, op: string) => {
          if (op === 'then') {
            return (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(db.answers[table]?.shift() ?? { data: [], error: null, count: 0 }).then(resolve, reject)
          }
          return (...args: unknown[]) => {
            statement.calls.push([op, args])
            return b
          }
        },
      },
    )
    return b
  }
  return { supabase: { from: (table: string) => builder(table) } }
})

import { countJobNoteAnswers, countTaskCommentAnswers, deleteTestJobNote, deleteTestTaskComment } from './testNoteDeleteIo'

const ok = (data: unknown, count: number | null = null) => ({ data, error: null, count })
const deletes = () => db.statements.filter((s) => s.calls.some(([op]) => op === 'delete'))

beforeEach(() => {
  db.answers = {}
  db.statements.length = 0
})

describe('deleteTestJobNote (punch list #443, row 13)', () => {
  it('reads the job and the answers again, then deletes the one note by its id', async () => {
    db.answers = { jobs_ledger: [ok({ job_name: 'ZZ Test walk job', customer_name: null })], jobs_ledger_note_tags: [ok([], 0)], jobs_ledger_thread_notes: [ok([{ id: 'n1' }])] }
    await deleteTestJobNote('n1', 'j1')
    expect(db.statements.map((s) => s.table)).toEqual(['jobs_ledger', 'jobs_ledger_note_tags', 'jobs_ledger_thread_notes'])
    expect(db.statements[1]?.calls).toEqual([['select', ['id', { count: 'exact' }]], ['eq', ['answer_note_id', 'n1']], ['limit', [1]]])
    expect(deletes()[0]?.calls).toEqual([['delete', []], ['eq', ['id', 'n1']], ['select', ['id']]])
  })
  it('refuses a real job’s note before counting anything, and deletes nothing', async () => {
    db.answers = { jobs_ledger: [ok({ job_name: 'Loft rough-in', customer_name: 'Harbor Row' })] }
    await expect(deleteTestJobNote('n1', 'j1')).rejects.toThrow('Only a note on a test job can be deleted.')
    expect(db.statements).toHaveLength(1)
  })
  it('refuses a note a tag names as its answer, and deletes nothing', async () => {
    db.answers = { jobs_ledger: [ok({ job_name: 'ZZ Test walk job', customer_name: null })], jobs_ledger_note_tags: [ok([], 1)] }
    await expect(deleteTestJobNote('n1', 'j1')).rejects.toThrow('1 tag names this as its answer. It stays.')
    expect(deletes()).toHaveLength(0)
  })
  it('says so when the delete reaches no row', async () => {
    db.answers = { jobs_ledger: [ok({ job_name: 'ZZ Test walk job', customer_name: null })], jobs_ledger_note_tags: [ok([], 0)], jobs_ledger_thread_notes: [ok([])] }
    await expect(deleteTestJobNote('n1', 'j1')).rejects.toThrow('The note was not deleted.')
  })
  it('the counts throw on no answer', async () => {
    db.answers = { jobs_ledger_note_tags: [{ data: null, error: null, count: null }], task_note_tags: [{ data: null, error: { message: 'no signal' } }] }
    await expect(countJobNoteAnswers('n1')).rejects.toThrow('could not be counted')
    await expect(countTaskCommentAnswers('e1')).rejects.toEqual({ message: 'no signal' })
  })
})

describe('deleteTestTaskComment (punch list #443, row 13)', () => {
  const comment = (title: string, type = 'comment') => ok({ id: 'e1', event_type: type, instance_id: 'i1', checklist_instances: { checklist_items: { title } } })
  it('reads the comment with its task, counts the answers, then deletes the one comment', async () => {
    db.answers = { checklist_instance_events: [comment('ZZ Test comment task'), ok([{ id: 'e1' }])], task_note_tags: [ok([], 0)] }
    await deleteTestTaskComment('e1')
    expect(db.statements.map((s) => s.table)).toEqual(['checklist_instance_events', 'task_note_tags', 'checklist_instance_events'])
    expect(deletes()[0]?.calls).toEqual([['delete', []], ['eq', ['id', 'e1']], ['eq', ['event_type', 'comment']], ['select', ['id']]])
  })
  it('refuses a real task’s comment and the app’s own line, and deletes nothing', async () => {
    db.answers = { checklist_instance_events: [comment('Walk the lofts')] }
    await expect(deleteTestTaskComment('e1')).rejects.toThrow('Only a comment on a test task can be deleted.')
    db.answers = { checklist_instance_events: [comment('ZZ Test comment task', 'completed')] }
    await expect(deleteTestTaskComment('e1')).rejects.toThrow('Only a comment a person wrote can be deleted.')
    expect(deletes()).toHaveLength(0)
  })
  it('refuses a comment a tag names as its answer', async () => {
    db.answers = { checklist_instance_events: [comment('ZZ Test comment task')], task_note_tags: [ok([], 2)] }
    await expect(deleteTestTaskComment('e1')).rejects.toThrow('2 tags name this as their answer. It stays.')
    expect(deletes()).toHaveLength(0)
  })
})
