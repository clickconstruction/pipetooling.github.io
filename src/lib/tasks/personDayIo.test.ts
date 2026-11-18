import { beforeEach, describe, expect, it, vi } from 'vitest'

/** Every read is recorded with its table and its filters, and answered from a list the test sets. */
const H = vi.hoisted(() => ({
  calls: [] as Array<{ table: string; filters: Array<[string, string, unknown]> }>,
  answers: [] as Array<{ data: unknown; error: unknown }>,
}))

vi.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => {
      const call = { table, filters: [] as Array<[string, string, unknown]> }
      H.calls.push(call)
      const b: Record<string, unknown> = {}
      for (const m of ['eq', 'lt', 'lte', 'gt', 'is', 'in', 'limit']) b[m] = (col: unknown, val?: unknown) => (call.filters.push([m, String(col), val]), b)
      for (const m of ['select', 'order']) b[m] = () => b
      b.then = (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(H.answers.shift() ?? { data: [], error: null }).then(ok, bad)
      return b
    },
  },
}))

const { OLDER_OPEN_LIMIT, readPersonAhead, readPersonComingUp, readPersonDay } = await import('./personDayIo')

const TODAY = '2026-11-17'
const row = (id: string, scheduled: string, item: Record<string, unknown> = {}) => ({ id, checklist_item_id: `item-${id}`, scheduled_date: scheduled, completed_at: null, checklist_items: { title: id, repeat_type: 'day_of_week', ...item } })
const filter = (i: number, method: string, col: string) => H.calls[i]?.filters.find(([m, c]) => m === method && c === col)?.[2]

beforeEach(() => {
  H.calls = []
  H.answers = []
})

describe('readPersonDay', () => {
  it('reads the person it was given, in every read that names one', async () => {
    H.answers = [
      { data: [row('a', TODAY), row('b', TODAY)], error: null },
      { data: [row('daily', '2026-11-16')], error: null },
      { data: [], error: null },
      { data: [{ checklist_item_id: 'item-b', display_order: 1 }], error: null },
    ]
    const r = await readPersonDay('u-dana', TODAY)
    expect(H.calls.map((c) => c.table)).toEqual(['checklist_instances', 'checklist_instances', 'checklist_instance_events', 'checklist_item_assignees'])
    expect(filter(0, 'eq', 'checklist_instance_assignees.user_id')).toBe('u-dana')
    expect(filter(0, 'eq', 'scheduled_date')).toBe(TODAY)
    expect(filter(1, 'eq', 'checklist_instance_assignees.user_id')).toBe('u-dana')
    expect(filter(1, 'lt', 'scheduled_date')).toBe(TODAY)
    expect(H.calls[1]?.filters).toContainEqual(['limit', String(OLDER_OPEN_LIMIT), undefined])
    expect(filter(2, 'in', 'instance_id')).toEqual(['daily'])
    expect(filter(3, 'eq', 'user_id')).toBe('u-dana')
    if (!('day' in r)) throw new Error('the day did not read')
    expect(r.day.today.map((x) => x.id)).toEqual(['b', 'a'])
    expect(r.day.missed.map((x) => x.id)).toEqual(['daily'])
  })

  it('reads no threads when every older task is a one-off, and no order on a day with nothing', async () => {
    H.answers = [
      { data: [], error: null },
      { data: [row('once', '2026-11-01', { repeat_type: 'once' })], error: null },
    ]
    const r = await readPersonDay('u-marco', TODAY)
    expect(H.calls.map((c) => c.table)).toEqual(['checklist_instances', 'checklist_instances'])
    if (!('day' in r)) throw new Error('the day did not read')
    expect(r.day.today).toEqual([])
    expect(r.day.stillOpen.map((x) => x.id)).toEqual(['once'])
  })

  it('hands back the failure when today does not read, and stops there', async () => {
    const refusal = { message: 'permission denied', code: '42501' }
    H.answers = [{ data: null, error: refusal }]
    const r = await readPersonDay('u-dana', TODAY)
    expect(r).toEqual({ failure: refusal })
    expect(H.calls).toHaveLength(1)
  })
})

describe('readPersonAhead', () => {
  it('reads the person it was given, after today', async () => {
    H.answers = [{ data: [row('next', '2026-11-23')], error: null }]
    const rows = await readPersonAhead('u-june', TODAY)
    expect(filter(0, 'eq', 'checklist_instance_assignees.user_id')).toBe('u-june')
    expect(filter(0, 'gt', 'scheduled_date')).toBe(TODAY)
    expect(rows?.map((x) => x.id)).toEqual(['next'])
  })

  it('answers null when the read fails', async () => {
    H.answers = [{ data: null, error: { message: 'offline' } }]
    expect(await readPersonAhead('u-june', TODAY)).toBeNull()
  })
})

describe('readPersonComingUp', () => {
  it('reads the open tasks of the person it was given, after today and up to the last day', async () => {
    H.answers = [{ data: [row('next', '2026-11-23')], error: null }]
    const rows = await readPersonComingUp('u-june', TODAY, '2026-11-24')
    expect(H.calls[0]?.table).toBe('checklist_instances')
    expect(filter(0, 'eq', 'checklist_instance_assignees.user_id')).toBe('u-june')
    expect(filter(0, 'gt', 'scheduled_date')).toBe(TODAY)
    expect(filter(0, 'lte', 'scheduled_date')).toBe('2026-11-24')
    expect(filter(0, 'is', 'completed_at')).toBeNull()
    expect(rows?.map((x) => x.id)).toEqual(['next'])
  })

  it('answers null when the read fails', async () => {
    H.answers = [{ data: null, error: { message: 'offline' } }]
    expect(await readPersonComingUp('u-june', TODAY, '2026-11-24')).toBeNull()
  })
})
