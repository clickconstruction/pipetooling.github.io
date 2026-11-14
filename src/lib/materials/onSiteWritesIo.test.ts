import { beforeEach, describe, expect, it, vi } from 'vitest'

type Answer = { error: { code?: string; message: string; details?: string } | null; status?: number }
const calls: string[] = []
const answers: Answer[] = []
const next = (): Promise<Answer> => Promise.resolve(answers.shift() ?? { error: null, status: 201 })

vi.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => ({
      insert: (row: { id: string }) => {
        calls.push(`insert ${table} ${row.id}`)
        return next()
      },
      update: (patch: Record<string, unknown>) => ({
        eq: (_col: string, id: string) => {
          calls.push(`update ${table} ${id} ${Object.keys(patch).join(',')}`)
          return next()
        },
      }),
    }),
  },
}))

import { DatabaseError } from '../../utils/errorHandling'
import { OnSiteWritesShapeError, landOnSiteWrites } from './onSiteWritesIo'

const box = { table: 'job_containers', op: 'insert', id: 'b2', row: { id: 'b2', job_id: 'j1', label: 'B2', kind: 'box' } }
const part = { table: 'job_material_movements', op: 'insert', id: 'm1', row: { id: 'm1', job_id: 'j1', part_name: 'ZZ test elbow', quantity: 3, reason: 'delivered', to_container_id: 'b2' } }
const retire = { table: 'job_containers', op: 'update', id: 'b2', row: { retired_at: '2026-11-13T15:00:00.000Z' } }

beforeEach(() => {
  calls.length = 0
  answers.length = 0
})

describe('landOnSiteWrites', () => {
  it('sends the rows one after another, in the order the press wrote them', async () => {
    expect(await landOnSiteWrites([box, part, retire])).toEqual({ rows: 3, landed: ['b2', 'm1', 'b2'], refused: [] })
    expect(calls).toEqual(['insert job_containers b2', 'insert job_material_movements m1', 'update job_containers b2 retired_at'])
  })

  it('an insert that meets its own row landed before, and the rest still go', async () => {
    answers.push({ error: { code: '23505', message: 'duplicate key value violates unique constraint "job_containers_pkey"' }, status: 409 })
    expect(await landOnSiteWrites([box, part])).toEqual({ rows: 2, landed: ['b2', 'm1'], refused: [] })
    expect(calls).toHaveLength(2)
  })

  it('any other no stops the press with the office’s reason, and nothing after it is sent', async () => {
    answers.push({ error: { code: '23505', message: 'duplicate key value violates unique constraint "job_containers_live_label_key"' }, status: 409 })
    const thrown = await landOnSiteWrites([box, part]).catch((e: unknown) => e)
    expect(thrown).toBeInstanceOf(DatabaseError)
    expect((thrown as DatabaseError).kind).toBe('server')
    expect((thrown as DatabaseError).code).toBe('23505')
    expect(calls).toEqual(['insert job_containers b2'])
  })

  it('a lost signal is thrown as one, so the press waits', async () => {
    answers.push({ error: { message: 'TypeError: Failed to fetch', code: '' }, status: 0 })
    const thrown = await landOnSiteWrites([part]).catch((e: unknown) => e)
    expect((thrown as DatabaseError).kind).toBe('network')
  })

  it('a press whose rows are not the store’s shape is refused before anything is sent', async () => {
    const thrown = await landOnSiteWrites([{ table: 'users', op: 'insert', id: 'x', row: { id: 'x' } }]).catch((e: unknown) => e)
    expect(thrown).toBeInstanceOf(OnSiteWritesShapeError)
    expect(calls).toEqual([])
  })

  describe('rows that stand alone (v2.7267)', () => {
    const line = (id: string, quantity: number) => ({ table: 'job_material_movements', op: 'insert', id, row: { id, job_id: 'j1', part_name: `ZZ test ${id}`, quantity, reason: 'delivered', to_container_id: 'b2' } })
    const lines = [line('d1', 25), line('d2', 0), line('d3', 12)]
    const CHECK = { code: '23514', message: 'new row violates check constraint "job_material_movements_quantity_check"' }
    const PKEY = { code: '23505', message: 'duplicate key value violates unique constraint "job_material_movements_pkey"' }

    it('a refused row is kept with its reason and the rows after it still go', async () => {
      answers.push({ error: null, status: 201 }, { error: CHECK, status: 400 })
      expect(await landOnSiteWrites(lines, { rowsStandAlone: true })).toEqual({ rows: 3, landed: ['d1', 'd3'], refused: [{ id: 'd2', message: CHECK.message, code: '23514' }] })
      expect(calls).toEqual(['insert job_material_movements d1', 'insert job_material_movements d2', 'insert job_material_movements d3'])
    })

    it('the same press again, the bad row mended, lands every row once', async () => {
      answers.push({ error: null, status: 201 }, { error: CHECK, status: 400 })
      await landOnSiteWrites(lines, { rowsStandAlone: true })
      // The second send meets the two rows that landed, and the mended row goes in.
      answers.push({ error: PKEY, status: 409 }, { error: null, status: 201 }, { error: PKEY, status: 409 })
      expect(await landOnSiteWrites([lines[0], line('d2', 4), lines[2]], { rowsStandAlone: true })).toEqual({ rows: 3, landed: ['d1', 'd2', 'd3'], refused: [] })
      expect(calls.filter((c) => c.endsWith('d2'))).toHaveLength(2)
    })

    it('a lost signal still stops the press, so the rest wait for the next try under the same ids', async () => {
      answers.push({ error: null, status: 201 }, { error: { message: 'TypeError: Failed to fetch', code: '' }, status: 0 })
      const thrown = await landOnSiteWrites(lines, { rowsStandAlone: true }).catch((e: unknown) => e)
      expect((thrown as DatabaseError).kind).toBe('network')
      expect(calls).toHaveLength(2)
    })

    it('without the word, the first refusal still stops the press', async () => {
      answers.push({ error: null, status: 201 }, { error: CHECK, status: 400 })
      await expect(landOnSiteWrites(lines)).rejects.toBeInstanceOf(DatabaseError)
      expect(calls).toHaveLength(2)
    })
  })
})
