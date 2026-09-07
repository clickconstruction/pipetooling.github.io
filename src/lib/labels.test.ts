import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The people / user label catalog (People → User tags panel, Users tab tags).
 * Pins the slug rule, each read's filters and shape (empty buckets for ids
 * with no rows, usage counts per label), and the replace-all writes.
 */
type Step = { method: string; args: unknown[] }
const queries: Array<{ table: string; steps: Step[] }> = []
let route: (table: string, steps: Step[]) => unknown = () => []
vi.mock('./supabase', () => ({
  supabase: {
    from: (table: string) => {
      const steps: Step[] = []
      queries.push({ table, steps })
      const p: unknown = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === 'then') {
              return (resolve: (v: { data: unknown; error: null }) => void, reject: (e: unknown) => void) => {
                try {
                  resolve({ data: route(table, steps), error: null })
                } catch (e) {
                  reject(e)
                }
              }
            }
            return (...a: unknown[]) => {
              steps.push({ method: String(prop), args: a })
              return p
            }
          },
        },
      )
      return p
    },
  },
}))
vi.mock('../utils/errorHandling', () => ({
  withSupabaseRetry: async (op: () => Promise<{ data: unknown; error: null }>) => (await op()).data,
}))

import {
  deleteLabel,
  fetchLabelsForMaster,
  fetchLabelsForMasterIds,
  fetchLabelUsageCounts,
  fetchPeopleLabelsForPersonIds,
  fetchPersonLabelIds,
  fetchUserLabelsForUserIds,
  insertLabel,
  setPersonLabels,
  setUserLabels,
  slugifyLabelName,
  updateLabel,
} from './labels'

const trace = () => queries.map((q) => `${q.table} ${q.steps.map((s) => `${s.method}(${s.args.map((a) => JSON.stringify(a)).join(',')})`).join(' ')}`)

beforeEach(() => {
  queries.length = 0
  route = () => []
})

describe('slugifyLabelName', () => {
  it('lowercases, collapses runs of non-alphanumerics to one dash, trims dashes, caps at 128, and never comes back empty', () => {
    expect(slugifyLabelName('  Lead Plumber ')).toBe('lead-plumber')
    expect(slugifyLabelName('A/C & Heat -- 2nd shift!')).toBe('a-c-heat-2nd-shift')
    expect(slugifyLabelName('---')).toBe('label')
    expect(slugifyLabelName('')).toBe('label')
    expect(slugifyLabelName('x'.repeat(200))).toHaveLength(128)
  })
})

describe('catalog reads', () => {
  it('labels for one master, or for a de-duplicated set of masters, by name; nothing asked for no masters', async () => {
    route = () => [{ id: 'l1', name: 'A' }]
    expect(await fetchLabelsForMaster('m1')).toEqual([{ id: 'l1', name: 'A' }])
    expect(trace()).toEqual(['labels select("*") eq("master_user_id","m1") order("name",{"ascending":true})'])
    queries.length = 0
    await fetchLabelsForMasterIds(['m1', '', 'm2', 'm1'])
    expect(trace()).toEqual(['labels select("*") in("master_user_id",["m1","m2"]) order("name",{"ascending":true})'])
    queries.length = 0
    expect(await fetchLabelsForMasterIds(['', ''])).toEqual([])
    expect(queries).toHaveLength(0)
  })
  it('label ids per person / per user: every asked-for id gets a bucket, rows fill them, nothing asked for no ids', async () => {
    expect(await fetchPeopleLabelsForPersonIds([])).toEqual({})
    expect(await fetchUserLabelsForUserIds([])).toEqual({})
    expect(queries).toHaveLength(0)
    route = (table) => (table === 'people_labels' ? [{ person_id: 'p1', label_id: 'l1' }, { person_id: 'p1', label_id: 'l2' }, { person_id: 'p9', label_id: 'l3' }] : [{ user_id: 'u2', label_id: 'l1' }])
    expect(await fetchPeopleLabelsForPersonIds(['p1', 'p2'])).toEqual({ p1: ['l1', 'l2'], p2: [], p9: ['l3'] })
    expect(trace()).toEqual(['people_labels select("person_id, label_id") in("person_id",["p1","p2"])'])
    queries.length = 0
    expect(await fetchUserLabelsForUserIds(['u1', 'u2'])).toEqual({ u1: [], u2: ['l1'] })
    expect(trace()).toEqual(['user_labels select("user_id, label_id") in("user_id",["u1","u2"])'])
  })
  it('usage counts per label from both join tables, zero-filled for the asked-for ids', async () => {
    expect(await fetchLabelUsageCounts([])).toEqual({})
    expect(queries).toHaveLength(0)
    route = (table) => (table === 'people_labels' ? [{ label_id: 'l1' }, { label_id: 'l1' }, { label_id: 'l3' }] : [{ label_id: 'l1' }])
    expect(await fetchLabelUsageCounts(['l1', 'l2', 'l1', ''])).toEqual({ l1: { people: 2, users: 1 }, l2: { people: 0, users: 0 }, l3: { people: 1, users: 0 } })
    expect(trace()).toEqual(['people_labels select("label_id") in("label_id",["l1","l2"])', 'user_labels select("label_id") in("label_id",["l1","l2"])'])
  })
  it('one person’s label ids', async () => {
    route = () => [{ label_id: 'l2' }, { label_id: 'l1' }]
    expect(await fetchPersonLabelIds('p1')).toEqual(['l2', 'l1'])
    expect(trace()).toEqual(['people_labels select("label_id") eq("person_id","p1")'])
  })
  it('a failed read throws', async () => {
    route = () => {
      throw new Error('rls')
    }
    await expect(fetchLabelsForMaster('m1')).rejects.toThrow('rls')
    await expect(fetchLabelUsageCounts(['l1'])).rejects.toThrow('rls')
  })
})

describe('catalog writes', () => {
  it('insert and update return the row; delete removes by id', async () => {
    route = () => ({ id: 'l1', name: 'Lead', slug: 'lead' })
    expect(await insertLabel({ master_user_id: 'm1', name: 'Lead', slug: 'lead' } as never)).toEqual({ id: 'l1', name: 'Lead', slug: 'lead' })
    expect(trace()).toEqual(['labels insert({"master_user_id":"m1","name":"Lead","slug":"lead"}) select() single()'])
    queries.length = 0
    await updateLabel('l1', { name: 'Lead Plumber', slug: 'lead-plumber' })
    expect(trace()).toEqual(['labels update({"name":"Lead Plumber","slug":"lead-plumber"}) eq("id","l1") select() single()'])
    queries.length = 0
    await deleteLabel('l1')
    expect(trace()).toEqual(['labels delete() eq("id","l1")'])
  })
  it('replacing a person’s or user’s labels clears first, then inserts one row per id — and only clears when the new set is empty', async () => {
    await setPersonLabels('p1', ['l1', 'l2'])
    expect(trace()).toEqual([
      'people_labels delete() eq("person_id","p1")',
      'people_labels insert([{"person_id":"p1","label_id":"l1"},{"person_id":"p1","label_id":"l2"}])',
    ])
    queries.length = 0
    await setPersonLabels('p1', [])
    expect(trace()).toEqual(['people_labels delete() eq("person_id","p1")'])
    queries.length = 0
    await setUserLabels('u1', ['l1'])
    expect(trace()).toEqual(['user_labels delete() eq("user_id","u1")', 'user_labels insert([{"user_id":"u1","label_id":"l1"}])'])
    queries.length = 0
    await setUserLabels('u1', [])
    expect(trace()).toEqual(['user_labels delete() eq("user_id","u1")'])
  })
  it('a failed write throws', async () => {
    route = () => {
      throw new Error('read only')
    }
    await expect(setPersonLabels('p1', ['l1'])).rejects.toThrow('read only')
    await expect(deleteLabel('l1')).rejects.toThrow('read only')
  })
})
