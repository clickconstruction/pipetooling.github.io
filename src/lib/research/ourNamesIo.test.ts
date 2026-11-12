import { beforeEach, describe, expect, it, vi } from 'vitest'

// The names that are us on a plumbing permit (punch list #307): the one read and the one write.
// Every name here is made up.
const db = vi.hoisted(() => ({
  rows: [] as Array<{ key: string; value_text: string | null }>,
  reads: [] as string[][],
  writes: [] as Array<{ key: string; value_text: string }>,
  readError: null as { message: string; code: string } | null,
  writeError: null as { message: string; code: string } | null,
}))

vi.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table !== 'app_settings') throw new Error(`unexpected table ${table}`)
      return {
        select: () => ({
          in: (_column: string, keys: string[]) => {
            db.reads.push(keys)
            return Promise.resolve(db.readError ? { data: null, error: db.readError } : { data: db.rows.filter((r) => keys.includes(r.key)), error: null })
          },
        }),
        upsert: (row: { key: string; value_text: string }) => {
          if (db.writeError) return Promise.resolve({ data: null, error: db.writeError })
          db.writes.push(row)
          db.rows = [...db.rows.filter((r) => r.key !== row.key), row]
          return Promise.resolve({ data: null, error: null })
        },
      }
    },
  },
}))

const ISSUER = { key: 'physical_invoice_issuer_v1', value_text: JSON.stringify({ companyName: ' Blue Heron Plumbing LLC ', addressText: '1 Made Up Way' }) }
const names = (list: string[]) => ({ key: 'permit_our_names_v1', value_text: JSON.stringify({ names: list }) })

async function fresh() {
  vi.resetModules()
  return await import('./ourNamesIo')
}

beforeEach(() => {
  db.rows = []
  db.reads = []
  db.writes = []
  db.readError = null
  db.writeError = null
})

describe('ourNamesIo', () => {
  it('reads the list and the company name on paper bills in one read, once a session', async () => {
    db.rows = [ISSUER, names(['Marco Vale'])]
    const io = await fresh()
    expect(await io.loadOurNames()).toEqual({ names: ['Marco Vale'], companyName: 'Blue Heron Plumbing LLC' })
    await io.loadOurNames()
    expect(db.reads).toEqual([['permit_our_names_v1', 'physical_invoice_issuer_v1']])
  })

  it('starts empty: no row, no company name, or a company block that cannot be read', async () => {
    const io = await fresh()
    expect(await io.loadOurNames()).toEqual({ names: [], companyName: null })
    db.rows = [{ key: 'physical_invoice_issuer_v1', value_text: 'not json' }, { key: 'permit_our_names_v1', value_text: null }]
    expect(await (await fresh()).loadOurNames()).toEqual({ names: [], companyName: null })
  })

  it('does not keep a failed read, so the next ask reads again', async () => {
    db.readError = { message: 'permission denied', code: '42501' }
    const io = await fresh()
    await expect(io.loadOurNames()).rejects.toBeTruthy()
    db.readError = null
    db.rows = [names(['Marco Vale'])]
    expect((await io.loadOurNames()).names).toEqual(['Marco Vale'])
  })

  it('adds a name onto the list as it stands now, and tells the panels', async () => {
    db.rows = [ISSUER, names(['Marco Vale'])]
    const io = await fresh()
    await io.loadOurNames()
    const told = vi.fn()
    const off = io.onOurNamesChanged(told)
    // Someone else added a name since this session read the list.
    db.rows = [ISSUER, names(['Marco Vale', 'M Vale Plumbing'])]
    const { result, ours } = await io.changeOurNames({ add: 'Heron Drain Co' })
    expect(result).toEqual({ ok: true, names: ['Marco Vale', 'M Vale Plumbing', 'Heron Drain Co'] })
    expect(db.writes).toEqual([names(['Marco Vale', 'M Vale Plumbing', 'Heron Drain Co'])])
    expect(ours).toEqual({ names: ['Marco Vale', 'M Vale Plumbing', 'Heron Drain Co'], companyName: 'Blue Heron Plumbing LLC' })
    expect(told).toHaveBeenCalledTimes(1)
    // The next ask has the saved list without another read.
    const reads = db.reads.length
    expect((await io.loadOurNames()).names).toHaveLength(3)
    expect(db.reads.length).toBe(reads)
    off()
    await io.changeOurNames({ remove: 'Marco Vale' })
    expect(told).toHaveBeenCalledTimes(1)
    expect(db.writes[1]).toEqual(names(['M Vale Plumbing', 'Heron Drain Co']))
  })

  it('writes nothing when the list refuses a name', async () => {
    db.rows = [ISSUER, names(['Marco Vale'])]
    const io = await fresh()
    const told = vi.fn()
    io.onOurNamesChanged(told)
    expect((await io.changeOurNames({ add: 'MARCO VALE' })).result).toEqual({ ok: false, reason: 'Marco Vale is on the list, and it reads the same as that name.' })
    expect((await io.changeOurNames({ add: 'blue heron plumbing' })).result.ok).toBe(false)
    expect(db.writes).toEqual([])
    expect(told).not.toHaveBeenCalled()
  })

  it('throws the database’s refusal and keeps the list as it was', async () => {
    db.rows = [names(['Marco Vale'])]
    db.writeError = { message: 'new row violates row-level security policy for table "app_settings"', code: '42501' }
    const io = await fresh()
    await expect(io.changeOurNames({ add: 'Heron Drain Co' })).rejects.toBeTruthy()
    expect((await io.loadOurNames()).names).toEqual(['Marco Vale'])
  })
})
