import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Person / user duplicate detection and merge (People page, Settings people
 * directory). The two finders are pure; the merge is pinned by what it writes:
 * the upsert of the merged pay config, the delete of the source row (by person
 * id when the roster knows it, else by name), the name cascade, and the user
 * rename.
 */
type Step = { method: string; args: unknown[] }
const queries: Array<{ table: string; steps: Step[] }> = []
vi.mock('./supabase', () => ({
  supabase: {
    from: (table: string) => {
      const steps: Step[] = []
      queries.push({ table, steps })
      const p: unknown = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === 'then') return (resolve: (v: { data: unknown; error: null }) => void) => resolve({ data: null, error: null })
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
  withSupabaseRetry: async (op: () => Promise<unknown>) => op(),
}))
const cascade = vi.fn(async (_from: string, _to: string) => {})
vi.mock('./cascadePersonName', () => ({ cascadePersonNameInPayTables: (a: string, b: string) => cascade(a, b) }))

import { findNameSimilarDuplicates, findPersonUserDuplicates, mergePersonIntoUser, type PayConfigRowForMerge } from './mergePersonUserDuplicates'

const cfg = (over: Partial<PayConfigRowForMerge> = {}): PayConfigRowForMerge => ({ person_name: 'x', hourly_wage: null, is_salary: false, record_hours_but_salary: false, ...over })
const trace = () => queries.map((q) => `${q.table} ${q.steps.map((s) => `${s.method}(${s.args.map((a) => JSON.stringify(a)).join(',')})`).join(' ')}`)

beforeEach(() => {
  queries.length = 0
  cascade.mockClear()
})

describe('findPersonUserDuplicates', () => {
  const people = [
    { id: 'p1', name: 'Paige Turner', email: 'Paige@X.test' },
    { id: 'p2', name: 'Sam', email: 'sam@x.test' },
    { id: 'p3', name: 'NoMail', email: null },
  ]
  const users = [
    { id: 'u1', name: 'Paige', email: 'paige@x.test' },
    { id: 'u2', name: 'Sam', email: 'sam@x.test' },
    { id: 'u3', name: 'Casey', email: 'casey@x.test' },
  ]
  it('flags a pay-config name whose roster person and login share an email under different names, from either side', () => {
    // From the roster side: the pay row is under the person's name, the login has a shorter name.
    expect(findPersonUserDuplicates(people, users, { 'Paige Turner': cfg() })).toEqual([{ personName: 'Paige Turner', userDisplayName: 'Paige', email: 'Paige@X.test' }])
    // From the login side: the pay row is under the login's name; the roster person with that email differs.
    expect(findPersonUserDuplicates(people, users, { Paige: cfg() })).toEqual([{ personName: 'Paige Turner', userDisplayName: 'Paige', email: 'Paige@X.test' }])
    // Both rows present: reported once.
    expect(findPersonUserDuplicates(people, users, { 'Paige Turner': cfg(), ' Paige ': cfg() })).toHaveLength(1)
  })
  it('ignores names that already agree, rows without an email match, and unknown names', () => {
    expect(findPersonUserDuplicates(people, users, { Sam: cfg() })).toEqual([])
    expect(findPersonUserDuplicates(people, users, { NoMail: cfg(), Casey: cfg(), Stranger: cfg() })).toEqual([])
    expect(findPersonUserDuplicates([], [], { Paige: cfg() })).toEqual([])
  })
})

describe('findNameSimilarDuplicates', () => {
  it('pairs a name with its role-suffixed twin, shorter name first, each pair once, no email', () => {
    expect(findNameSimilarDuplicates({ 'Paige (Assistant)': cfg(), Paige: cfg(), 'Sam (master)': cfg(), Sam: cfg(), Casey: cfg(), 'Casey (Foreman)': cfg() })).toEqual([
      { personName: 'Paige', userDisplayName: 'Paige (Assistant)', email: '' },
      { personName: 'Sam', userDisplayName: 'Sam (master)', email: '' },
      // "(Foreman)" is not one of the role suffixes: Casey stays single
    ])
    expect(findNameSimilarDuplicates({ Paige: cfg(), ' Paige': cfg() })).toEqual([]) // same name after trimming
    expect(findNameSimilarDuplicates({})).toEqual([])
  })
})

describe('mergePersonIntoUser', () => {
  const payConfig = {
    'Paige Turner': cfg({ person_name: 'Paige Turner', hourly_wage: 30, is_salary: false, record_hours_but_salary: true }),
    Paige: cfg({ person_name: 'Paige', hourly_wage: 32, is_salary: true, record_hours_but_salary: false }),
  }
  const roster = [
    { id: 'p-long', name: 'Paige Turner', email: 'paige@x.test' },
    { id: 'p-short', name: 'Paige', email: 'paige@x.test' },
  ]

  it('upserts the merged config under the login name (its values first, the person’s as fallback), deletes the person row by roster id, cascades the name, renames the user', async () => {
    await mergePersonIntoUser(' Paige Turner ', ' Paige ', payConfig, 'u1', roster)
    expect(trace()).toEqual([
      'people_pay_config upsert({"person_name":"Paige","person_id":"p-short","hourly_wage":32,"is_salary":true,"record_hours_but_salary":false},{"onConflict":"person_name"})',
      'people_pay_config delete() eq("person_id","p-long")',
      'users update({"name":"Paige"}) eq("id","u1")',
    ])
    expect(cascade).toHaveBeenCalledWith('Paige Turner', 'Paige')
  })

  it('falls back to the person’s values when the login has no config, deletes by name without a roster, and skips the user rename without a user id', async () => {
    await mergePersonIntoUser('Paige Turner', 'Paige', { 'Paige Turner': payConfig['Paige Turner'] })
    expect(trace()).toEqual([
      'people_pay_config upsert({"person_name":"Paige","person_id":null,"hourly_wage":30,"is_salary":false,"record_hours_but_salary":true},{"onConflict":"person_name"})',
      'people_pay_config delete() eq("person_name","Paige Turner")',
    ])
    expect(cascade).toHaveBeenCalledWith('Paige Turner', 'Paige')
  })

  it('with neither side configured the merged row carries the defaults', async () => {
    await mergePersonIntoUser('A', 'B', {})
    expect(trace()[0]).toBe('people_pay_config upsert({"person_name":"B","person_id":null,"hourly_wage":null,"is_salary":false,"record_hours_but_salary":false},{"onConflict":"person_name"})')
  })

  it('does nothing for a blank or identical pair', async () => {
    await mergePersonIntoUser('', 'Paige', payConfig, 'u1')
    await mergePersonIntoUser('Paige', '  ', payConfig, 'u1')
    await mergePersonIntoUser(' Paige ', 'Paige', payConfig, 'u1')
    expect(queries).toHaveLength(0)
    expect(cascade).not.toHaveBeenCalled()
  })
})
