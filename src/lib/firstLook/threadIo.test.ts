import { describe, expect, it, vi } from 'vitest'
import { supabaseFirstLookThreadIo } from './threadIo'

/** A stand-in for the client: each `from(table).select(columns)` answers what the table's script says for those columns. */
function fakeDb(script: (table: string, columns: string) => { data: unknown; error: { code?: string; message?: string } | null }) {
  const asked: Array<{ table: string; columns: string }> = []
  const chain = (table: string, columns: string) => {
    const answer = script(table, columns)
    const q: Record<string, unknown> = {}
    for (const m of ['eq', 'is', 'in', 'not', 'order', 'limit']) q[m] = () => q
    q.then = (ok: (v: unknown) => unknown) => Promise.resolve(answer).then(ok)
    return q
  }
  return {
    asked,
    from: (table: string) => ({
      select: (columns: string) => {
        asked.push({ table, columns })
        return chain(table, columns)
      },
    }),
    rpc: vi.fn(async () => ({ data: { ok: true, id: 'L1', code: 'k7m2p9xq4d' }, error: null })),
  }
}

describe('the thread’s reads of a First look (punch list #319)', () => {
  it('reads the looks and their finished files with the Drive columns', async () => {
    const db = fakeDb((table) => (table === 'first_looks' ? { data: [{ id: 'L1' }], error: null } : { data: [{ id: 'F1', look_id: 'L1' }], error: null }))
    const got = await supabaseFirstLookThreadIo(db).looks('dana')
    expect(got.looks).toEqual([{ id: 'L1' }])
    expect(got.files).toEqual([{ id: 'F1', look_id: 'L1' }])
    expect(db.asked.map((a) => a.table)).toEqual(['first_looks', 'first_look_files'])
    expect(db.asked[0]!.columns).toContain('drive_folder_id')
    expect(db.asked[1]!.columns).toContain('drive_file_id')
  })

  it('a database from before the Drive columns is read without them', async () => {
    const db = fakeDb((table, columns) => {
      if (/drive_/.test(columns)) return { data: null, error: { code: '42703', message: `column ${table}.drive_folder_id does not exist` } }
      return table === 'first_looks' ? { data: [{ id: 'L1' }], error: null } : { data: [], error: null }
    })
    const got = await supabaseFirstLookThreadIo(db).looks('dana')
    expect(got.looks).toEqual([{ id: 'L1' }])
    // The looks step down twice (PR 7's columns, then PR 2's), the files once.
    expect(db.asked.map((a) => /drive_/.test(a.columns))).toEqual([true, true, false, true, false])
  })

  it('a database with the Drive columns and not the tech’s still reads the Drive folder', async () => {
    const db = fakeDb((table, columns) => {
      if (/tech_read/.test(columns)) return { data: null, error: { code: '42703', message: `column ${table}.tech_read does not exist` } }
      return table === 'first_looks' ? { data: [{ id: 'L1', drive_folder_id: 'FOLDER' }], error: null } : { data: [], error: null }
    })
    const got = await supabaseFirstLookThreadIo(db).looks('dana')
    expect(got.looks).toEqual([{ id: 'L1', drive_folder_id: 'FOLDER' }])
    expect(db.asked.filter((a) => a.table === 'first_looks').map((a) => [/tech_read/.test(a.columns), /drive_folder_id/.test(a.columns)])).toEqual([
      [true, true],
      [false, true],
    ])
  })

  it('no look means no second read', async () => {
    const db = fakeDb(() => ({ data: [], error: null }))
    expect(await supabaseFirstLookThreadIo(db).looks('dana')).toEqual({ looks: [], files: [] })
    expect(db.asked).toHaveLength(1)
  })

  it('the mint answers the look and the link the text carries', async () => {
    const db = fakeDb(() => ({ data: [], error: null }))
    expect(await supabaseFirstLookThreadIo(db).mint('dana')).toEqual({ id: 'L1', link: 'https://clicktooling.com/show/k7m2p9xq4d' })
    expect(db.rpc).toHaveBeenCalledWith('mint_first_look', { p_contact_id: 'dana' })
  })
})
