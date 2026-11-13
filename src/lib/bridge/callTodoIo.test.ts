import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { loadTodoCards } from './callTodoIo'

// A made-up database: every read is answered from the tables below, and each read is written down.
type Row = Record<string, unknown>
function fakeDb(tables: Record<string, Row[]>, opts: { noTagColumn?: boolean } = {}) {
  const reads: string[] = []
  const from = (table: string) => {
    const answer = (rows: Row[], error: { message: string } | null = null) => Promise.resolve({ data: error ? null : rows, error })
    return {
      select: (cols: string) => ({
        in: (col: string, values: string[]) => {
          reads.push(`${table}.in(${col})`)
          if (col === 'source_tag' && opts.noTagColumn) return answer([], { message: `column ${table}.source_tag does not exist` })
          if (cols.includes('source_tag') && opts.noTagColumn) return answer([], { message: 'column does not exist' })
          return answer((tables[table] ?? []).filter((r) => values.includes(r[col] as string)))
        },
        overlaps: (col: string, values: string[]) => {
          reads.push(`${table}.overlaps(${col})`)
          return answer((tables[table] ?? []).filter((r) => ((r[col] as string[] | null) ?? []).some((v) => values.includes(v))))
        },
      }),
    }
  }
  return { db: { from } as unknown as SupabaseClient<Database>, reads }
}

const toYmd = (iso: string): string => iso.slice(0, 10)
const LINK = 'https://app.example/jobs?jobDetail=j201&todo=pct.j201'

describe('loadTodoCards', () => {
  const tables = {
    checklist_items: [
      // Made after the column: the link was taken off, the tag stays.
      { id: 'i-tag', title: 'Set the percent done on 201 · Maple Lofts.', links: [], created_at: '2026-03-10T15:00:00Z', due_date: null, source_tag: 'pct.j201' },
      // Made before the column: found by its link.
      { id: 'i-link', title: 'Bill 202 · Oak Court.', links: ['https://app.example/jobs?jobDetail=j202&todo=bill.j202'], created_at: '2026-03-09T15:00:00Z', due_date: '2026-03-20', source_tag: null },
      { id: 'i-other', title: 'Somebody else’s card', links: ['https://app.example/jobs'], created_at: '2026-03-01T15:00:00Z', due_date: null, source_tag: null },
    ],
    checklist_instances: [
      { id: 'n1', checklist_item_id: 'i-tag', completed_at: null, completed_by_user_id: null },
      { id: 'n2', checklist_item_id: 'i-link', completed_at: '2026-03-11T18:00:00Z', completed_by_user_id: 'u2' },
    ],
    checklist_item_assignees: [
      { checklist_item_id: 'i-tag', user_id: 'u1', display_order: 0 },
      { checklist_item_id: 'i-link', user_id: 'u2', display_order: 0 },
    ],
    users: [
      { id: 'u1', name: 'Dana Reyes' },
      { id: 'u2', name: 'Sam Holt' },
    ],
  }

  it('finds a card by its own tag and a card by its link, each with its people and its finish', async () => {
    const { db } = fakeDb(tables)
    const cards = await loadTodoCards(db, ['pct.j201', 'bill.j202'], [LINK, 'https://app.example/jobs?jobDetail=j202&todo=bill.j202'], toYmd, new Map())
    expect(cards.map((c) => c.itemId).sort()).toEqual(['i-link', 'i-tag'])
    const byTag = cards.find((c) => c.itemId === 'i-tag')
    expect(byTag).toEqual({ itemId: 'i-tag', title: 'Set the percent done on 201 · Maple Lofts.', tag: 'pct.j201', links: [], madeYmd: '2026-03-10', dueYmd: null, who: ['Dana Reyes'], instances: [{ id: 'n1', doneYmd: null, doneBy: null }] })
    const byLink = cards.find((c) => c.itemId === 'i-link')
    expect(byLink).toMatchObject({ tag: null, dueYmd: '2026-03-20', who: ['Sam Holt'], instances: [{ id: 'n2', doneYmd: '2026-03-11', doneBy: 'Sam Holt' }] })
  })

  it('still reads the cards by their links while the column is not there yet', async () => {
    const { db, reads } = fakeDb(tables, { noTagColumn: true })
    const cards = await loadTodoCards(db, ['pct.j201', 'bill.j202'], [LINK, 'https://app.example/jobs?jobDetail=j202&todo=bill.j202'], toYmd, new Map())
    // The card whose link was taken off cannot be found without its tag; the other is found as before.
    expect(cards.map((c) => c.itemId)).toEqual(['i-link'])
    expect(reads).toContain('checklist_items.in(source_tag)')
    expect(reads).toContain('checklist_items.overlaps(links)')
  })

  it('asks for nothing when the page names nothing', async () => {
    const { db, reads } = fakeDb(tables)
    expect(await loadTodoCards(db, [], [], toYmd, new Map())).toEqual([])
    expect(reads).toEqual([])
  })

  it('uses the names the page already holds, and reads only the ones it does not', async () => {
    const { db, reads } = fakeDb(tables)
    const cards = await loadTodoCards(db, ['pct.j201'], [], toYmd, new Map([['u1', 'Dana R.']]))
    expect(cards[0]?.who).toEqual(['Dana R.'])
    expect(reads).not.toContain('users.in(id)')
  })
})
