import { beforeEach, describe, expect, it, vi } from 'vitest'

/** What the view answers, and every call each read made on its query, in order. */
const db = vi.hoisted(() => ({
  answer: { data: [] as unknown, error: null as unknown, count: null as number | null },
  /** Answers to hand out first, one a read, before `answer`: a view that refuses once and then reads. */
  first: [] as Array<{ data: unknown; error: unknown; count: number | null }>,
  throws: false,
  reads: [] as Array<{ table: string; calls: Array<[string, unknown[]]> }>,
}))

vi.mock('../supabase', () => {
  const builder = (table: string) => {
    const read = { table, calls: [] as Array<[string, unknown[]]> }
    db.reads.push(read)
    const b: Record<string, unknown> = new Proxy(
      {},
      {
        get: (_t, op: string) => {
          if (op === 'then') {
            return (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
              (db.throws ? Promise.reject(new Error('network down')) : Promise.resolve(db.first.shift() ?? db.answer)).then(resolve, reject)
          }
          return (...args: unknown[]) => {
            read.calls.push([op, args])
            return b
          }
        },
      },
    )
    return b
  }
  return { supabase: { from: (table: string) => builder(table) } }
})

import { AGREEMENTS_SELECT, AGREEMENTS_SELECT_BEFORE_PRINT } from './agreementsLedger'
import { AGREEMENTS_VIEW, countAgreementsNotSent, countAgreementsWaiting, forgetAgreementsViewPrint, readAgreements } from './agreementsLedgerIo'

const calls = () => db.reads[db.reads.length - 1]?.calls ?? []
const ops = () => calls().map(([op]) => op)

beforeEach(() => {
  db.answer = { data: [], error: null, count: null }
  db.throws = false
  db.first = []
  db.reads.length = 0
  forgetAgreementsViewPrint()
})

describe('readAgreements', () => {
  it('reads the view newest first, a page at a time, with the default state and no kind filter', async () => {
    await readAgreements({ kind: 'all', state: 'live', typed: '', limit: 100 })
    expect(db.reads[0]?.table).toBe(AGREEMENTS_VIEW)
    expect(calls()).toEqual([
      ['select', [AGREEMENTS_SELECT]],
      ['in', ['state', ['waiting', 'signed']]],
      ['order', ['at', { ascending: false }]],
      ['order', ['id', { ascending: false }]],
      ['limit', [100]],
    ])
  })

  it('asks the database for a kind chip’s kinds and a state chip’s state', async () => {
    await readAgreements({ kind: 'jobs', state: 'ended', typed: '', limit: 100 })
    expect(calls().slice(1, 3)).toEqual([
      ['in', ['kind', ['job_contract', 'their_paper']]],
      ['in', ['state', ['ended']]],
    ])
  })

  it('asks for an estimator’s kinds under their chips, and for no kind under a chip they do not have', async () => {
    await readAgreements({ kind: 'outside', state: 'live', typed: '', limit: 100, reader: 'estimator' })
    expect(calls()[1]).toEqual(['in', ['kind', ['customer_agreement', 'supply_house_agreement', 'trade_agreement', 'company_agreement']]])
    await readAgreements({ kind: 'people', state: 'live', typed: '', limit: 100, reader: 'estimator' })
    expect(calls()[1]).toEqual(['in', ['kind', []]])
    await readAgreements({ kind: 'all', state: 'live', typed: '', limit: 100, reader: 'estimator' })
    expect(calls().filter(([op, args]) => op === 'in' && args[0] === 'kind')).toEqual([])
  })

  it('asks for every state under the Search tab', async () => {
    await readAgreements({ kind: 'all', state: 'any', typed: 'pierce', limit: 100 })
    expect(calls()).toEqual([
      ['select', [AGREEMENTS_SELECT]],
      ['ilike', ['find_text', '*pierce*']],
      ['order', ['at', { ascending: false }]],
      ['order', ['id', { ascending: false }]],
      ['limit', [100]],
    ])
  })

  it('asks for every typed word in find_text, and nothing under two letters', async () => {
    await readAgreements({ kind: 'all', state: 'live', typed: 'Cedar  J2391', limit: 100 })
    expect(calls().filter(([op]) => op === 'ilike')).toEqual([
      ['ilike', ['find_text', '*cedar*']],
      ['ilike', ['find_text', '*j2391*']],
    ])
    await readAgreements({ kind: 'all', state: 'live', typed: 'c', limit: 100 })
    expect(ops()).not.toContain('ilike')
  })

  it('asks for one site’s papers by its keys, forty at most, and for every line with no site asked (punch list #439)', async () => {
    await readAgreements({ kind: 'all', state: 'live', typed: '', limit: 100, site: { keys: ['118 old quarry trail sampleton tx', '118 old quarry trail barn sampleton tx'] } })
    expect(calls()).toContainEqual(['in', ['site_address_key', ['118 old quarry trail sampleton tx', '118 old quarry trail barn sampleton tx']]])
    await readAgreements({ kind: 'all', state: 'live', typed: '', limit: 100, site: { keys: Array.from({ length: 60 }, (_, i) => `k${i}`) } })
    const asked = calls().find(([op, args]) => op === 'in' && args[0] === 'site_address_key')
    expect((asked?.[1][1] as string[]).length).toBe(40)
    for (const site of [null, undefined, { keys: [] }]) {
      await readAgreements({ kind: 'all', state: 'live', typed: '', limit: 100, site })
      expect(calls().some(([op, args]) => op === 'in' && args[0] === 'site_address_key')).toBe(false)
    }
  })

  it('says another page may follow when the page came back full', async () => {
    db.answer = { data: [{ id: 'a' }, { id: 'b' }], error: null, count: null }
    expect(await readAgreements({ kind: 'all', state: 'live', typed: '', limit: 2 })).toEqual({ rows: [{ id: 'a' }, { id: 'b' }], more: true })
    expect(await readAgreements({ kind: 'all', state: 'live', typed: '', limit: 3 })).toEqual({ rows: [{ id: 'a' }, { id: 'b' }], more: false })
  })

  it('reads a page of a hundred when the limit is missing', async () => {
    await readAgreements({ kind: 'all', state: 'live', typed: '', limit: 0 })
    expect(calls()[calls().length - 1]).toEqual(['limit', [100]])
  })

  it('throws with the database’s own reason', async () => {
    db.answer = { data: null, error: { message: 'relation "agreements_on_file" does not exist', code: '42P01' }, count: null }
    await expect(readAgreements({ kind: 'all', state: 'live', typed: '', limit: 100 })).rejects.toThrow(/agreements_on_file/)
  })

  it('reads no row as an empty list', async () => {
    db.answer = { data: null, error: null, count: null }
    expect(await readAgreements({ kind: 'all', state: 'live', typed: '', limit: 100 })).toEqual({ rows: [], more: false })
  })

  it('a view that does not answer the print yet is read again without it, with the same filters, and remembered', async () => {
    const refusal = { data: null, error: { code: '42703', message: 'column agreements_on_file.site_prints_address does not exist' }, count: null }
    db.first = [refusal]
    db.answer = { data: [{ id: 'a' }], error: null, count: null }
    expect(await readAgreements({ kind: 'jobs', state: 'ended', typed: 'cedar', limit: 100 })).toEqual({ rows: [{ id: 'a' }], more: false })
    expect(db.reads).toHaveLength(2)
    expect(db.reads[0]?.calls[0]).toEqual(['select', [AGREEMENTS_SELECT]])
    expect(db.reads[1]?.calls[0]).toEqual(['select', [AGREEMENTS_SELECT_BEFORE_PRINT]])
    // Everything after the columns is asked the same way both times.
    expect(db.reads[1]?.calls.slice(1)).toEqual(db.reads[0]?.calls.slice(1))
    // The next page asks once, for the older columns.
    await readAgreements({ kind: 'all', state: 'live', typed: '', limit: 100 })
    expect(db.reads).toHaveLength(3)
    expect(db.reads[2]?.calls[0]).toEqual(['select', [AGREEMENTS_SELECT_BEFORE_PRINT]])
  })

  it('any other refusal is thrown as it is, and is not read again', async () => {
    db.answer = { data: null, error: { code: '42501', message: 'permission denied for view agreements_on_file' }, count: null }
    await expect(readAgreements({ kind: 'all', state: 'live', typed: '', limit: 100 })).rejects.toThrow(/have access/)
    expect(db.reads).toHaveLength(1)
  })

  it('a view that refuses again without the column throws that second reason', async () => {
    db.first = [{ data: null, error: { code: '42703', message: 'column agreements_on_file.site_prints_address does not exist' }, count: null }]
    db.answer = { data: null, error: { code: '42501', message: 'permission denied for view agreements_on_file' }, count: null }
    await expect(readAgreements({ kind: 'all', state: 'live', typed: '', limit: 100 })).rejects.toThrow(/have access/)
    expect(db.reads).toHaveLength(2)
  })
})

describe('countAgreementsWaiting', () => {
  it('counts the waiting rows without reading them', async () => {
    db.answer = { data: null, error: null, count: 3 }
    expect(await countAgreementsWaiting('all')).toBe(3)
    expect(calls()).toEqual([
      ['select', ['id', { count: 'exact', head: true }]],
      ['eq', ['state', 'waiting']],
    ])
  })

  it('counts under a kind chip', async () => {
    db.answer = { data: null, error: null, count: 1 }
    expect(await countAgreementsWaiting('orders')).toBe(1)
    expect(calls()[2]).toEqual(['in', ['kind', ['work_order']]])
  })

  it('counts an estimator’s kinds under their chip', async () => {
    db.answer = { data: null, error: null, count: 2 }
    expect(await countAgreementsWaiting('outside', 'estimator')).toBe(2)
    expect(calls()[2]).toEqual(['in', ['kind', ['customer_agreement', 'supply_house_agreement', 'trade_agreement', 'company_agreement']]])
  })

  it('answers zero for no count, and null when the count cannot be read', async () => {
    expect(await countAgreementsWaiting('all')).toBe(0)
    db.answer = { data: null, error: { message: 'no' }, count: null }
    expect(await countAgreementsWaiting('all')).toBeNull()
    db.throws = true
    expect(await countAgreementsWaiting('all')).toBeNull()
  })
})

describe('countAgreementsNotSent', () => {
  it('counts the papers that were made and never sent, without reading them', async () => {
    db.answer = { data: null, error: null, count: 2 }
    expect(await countAgreementsNotSent('all')).toBe(2)
    expect(calls()).toEqual([
      ['select', ['id', { count: 'exact', head: true }]],
      ['eq', ['state', 'not_sent']],
    ])
  })

  it('counts under a kind chip, and an estimator’s kinds under theirs', async () => {
    db.answer = { data: null, error: null, count: 1 }
    expect(await countAgreementsNotSent('outside')).toBe(1)
    expect(calls()[2]).toEqual(['in', ['kind', ['customer_agreement', 'supply_house_agreement', 'outside_agreement']]])
    expect(await countAgreementsNotSent('outside', 'estimator')).toBe(1)
    expect(calls()[2]).toEqual(['in', ['kind', ['customer_agreement', 'supply_house_agreement', 'trade_agreement', 'company_agreement']]])
  })

  it('answers null when the count cannot be read, which draws no chip', async () => {
    db.answer = { data: null, error: { message: 'no' }, count: null }
    expect(await countAgreementsNotSent('all')).toBeNull()
    db.throws = true
    expect(await countAgreementsNotSent('all')).toBeNull()
  })
})
