import { describe, expect, it, vi } from 'vitest'
import { addWorker, addWorkerArgs, readAddedWorker } from './addWorker'

describe('addWorkerArgs', () => {
  it('trims the name and turns blanks into NULL', () => {
    expect(addWorkerArgs({ name: '  Rio Vance ', kind: 'helper', email: '  ', phone: '', notes: undefined, startDate: null })).toEqual({
      p_name: 'Rio Vance',
      p_kind: 'helper',
      p_email: null,
      p_phone: null,
      p_notes: null,
      p_start_date: null,
    })
  })
  it('passes every field it is given', () => {
    expect(addWorkerArgs({ name: 'Tomas Reyes', kind: 'sub', email: 'Tomas@Example.test', phone: '555-0100', notes: 'from the sub sheet', startDate: '2026-11-01' })).toEqual({
      p_name: 'Tomas Reyes',
      p_kind: 'sub',
      p_email: 'Tomas@Example.test',
      p_phone: '555-0100',
      p_notes: 'from the sub sheet',
      p_start_date: '2026-11-01',
    })
  })
})

describe('readAddedWorker', () => {
  it('reads the two ids', () => {
    expect(readAddedWorker({ user_id: 'u1', person_id: 'p1' })).toEqual({ userId: 'u1', personId: 'p1' })
  })
  it('refuses an answer with no ids', () => {
    expect(() => readAddedWorker(null)).toThrow('no ids')
    expect(() => readAddedWorker({ user_id: 'u1' })).toThrow('no ids')
  })
})

describe('addWorker', () => {
  it('calls add_worker with the form fields and answers the ids', async () => {
    const rpc = vi.fn(async () => ({ data: { user_id: 'u1', person_id: 'p1' }, error: null }))
    const client = { rpc } as unknown as Parameters<typeof addWorker>[0]
    await expect(addWorker(client, { name: 'Ana Lind', kind: 'helper', email: 'ana@example.test' })).resolves.toEqual({ userId: 'u1', personId: 'p1' })
    expect(rpc).toHaveBeenCalledWith('add_worker', { p_name: 'Ana Lind', p_kind: 'helper', p_email: 'ana@example.test', p_phone: null, p_notes: null, p_start_date: null })
  })
  it('throws the refusal with its reason', async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: 'Ana Lind already has that address. Open their desk instead.' } }))
    const client = { rpc } as unknown as Parameters<typeof addWorker>[0]
    await expect(addWorker(client, { name: 'Another Ana', kind: 'helper', email: 'ana@example.test' })).rejects.toThrow('Ana Lind already has that address')
  })
})
