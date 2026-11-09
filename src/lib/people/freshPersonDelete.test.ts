import { describe, expect, it, vi } from 'vitest'
import { canOfferFreshDelete, deleteFreshPerson, foldHolds, freshDeleteConfirmWords, freshDeleteHeldWords, holdWords, readFreshDeleteAnswer, runFreshDelete } from './freshPersonDelete'
import type { PersonDeskViewer } from './personDeskGates'

const base: PersonDeskViewer = { role: 'helpers', isDev: false, canAccessPay: false, canAccessHours: false, canAccessVehicles: false, canAccessLicenses: false, canAccessContracts: false, readOnly: false }
const DEV: PersonDeskViewer = { ...base, role: 'dev', isDev: true, canAccessPay: true }
const CONTROLLER: PersonDeskViewer = { ...base, role: 'controller' }
const PAY_LEADER: PersonDeskViewer = { ...base, role: 'master_technician', canAccessPay: true }
const LEADER: PersonDeskViewer = { ...base, role: 'master_technician' }
const ASSISTANT: PersonDeskViewer = { ...base, role: 'assistant' }

describe('canOfferFreshDelete', () => {
  it('the people who may archive see Delete on a row with no login', () => {
    for (const viewer of [DEV, CONTROLLER, PAY_LEADER]) expect(canOfferFreshDelete({ loginAttachedAt: null, isSelf: false, viewer })).toBe(true)
    for (const viewer of [LEADER, ASSISTANT]) expect(canOfferFreshDelete({ loginAttachedAt: null, isSelf: false, viewer })).toBe(false)
  })
  it('never on a login, your own row, an archived row or in training mode', () => {
    expect(canOfferFreshDelete({ loginAttachedAt: '2026-11-09T00:00:00Z', isSelf: false, viewer: DEV })).toBe(false)
    expect(canOfferFreshDelete({ loginAttachedAt: null, isSelf: true, viewer: DEV })).toBe(false)
    expect(canOfferFreshDelete({ loginAttachedAt: null, isSelf: false, archived: true, viewer: DEV })).toBe(false)
    expect(canOfferFreshDelete({ loginAttachedAt: null, isSelf: false, viewer: { ...DEV, readOnly: true } })).toBe(false)
  })
})

describe('readFreshDeleteAnswer', () => {
  it('reads the function answer, with holds and what went along', () => {
    const a = readFreshDeleteAnswer({ deleted: false, dry_run: true, name: 'Dobert Rouglas', user_id: 'u1', person_id: 'p1', holds: [{ table: 'clock_sessions', column: 'user_id', count: 3 }], removed: ['pay row'] })
    expect(a).toEqual({ deleted: false, dryRun: true, name: 'Dobert Rouglas', userId: 'u1', personId: 'p1', holds: [{ table: 'clock_sessions', column: 'user_id', count: 3 }], removed: ['pay row'] })
  })
  it('throws on an answer with no verdict', () => {
    expect(() => readFreshDeleteAnswer(null)).toThrow('The answer had no verdict.')
    expect(() => readFreshDeleteAnswer({ user_id: 'u1' })).toThrow()
  })
})

describe('the words', () => {
  it('names a hold in plain words, one or many, and falls back to the table', () => {
    expect(holdWords({ table: 'clock_sessions', column: 'user_id', count: 1 })).toBe('a clock session')
    expect(holdWords({ table: 'clock_sessions', column: 'user_id', count: 3 })).toBe('3 clock sessions')
    expect(holdWords({ table: 'hr_file_entries', column: 'person_id', count: 1 })).toBe('an HR file entry')
    expect(holdWords({ table: 'team_prospects', column: 'hired_user_id', count: 2 })).toBe('2 rows in team prospects')
  })
  it('folds two keys from one table into one line', () => {
    expect(foldHolds([{ table: 'clock_sessions', column: 'user_id', count: 2 }, { table: 'clock_sessions', column: 'approved_by', count: 1 }, { table: 'customers', column: 'master_user_id', count: 1 }])).toEqual([
      { table: 'clock_sessions', column: 'user_id', count: 3 },
      { table: 'customers', column: 'master_user_id', count: 1 },
    ])
  })
  it('the confirm names the person and the verb, and what goes with them', () => {
    const w = freshDeleteConfirmWords('Dobert Rouglas', [])
    expect(w.confirmLabel).toBe('Delete Dobert Rouglas')
    expect(w.message).toContain('Nothing points at them yet')
    expect(w.message).not.toContain('goes too')
    expect(freshDeleteConfirmWords('Ana Lind', ['pay row']).message).toContain('Their pay row goes too.')
    expect(freshDeleteConfirmWords('Ana Lind', ['pay row', 'workday template']).message).toContain('Their pay row and workday template go too.')
  })
  it('the held words list what points at them and offer Archive', () => {
    const w = freshDeleteHeldWords('Ana Lind', [{ table: 'clock_sessions', column: 'user_id', count: 3 }, { table: 'customers', column: 'master_user_id', count: 1 }])
    expect(w.title).toBe('Ana Lind cannot be deleted')
    expect(w.message).toContain('Ana Lind has 3 clock sessions and a customer.')
    expect(w.confirmLabel).toBe('Archive instead')
  })
})

describe('deleteFreshPerson', () => {
  it('calls the function with the id and the dry-run flag, and throws its reason', async () => {
    const rpc = vi.fn(async () => ({ data: { deleted: true, dry_run: false, name: 'Ana', user_id: 'u1', person_id: 'p1', holds: [], removed: [] }, error: null }))
    const a = await deleteFreshPerson({ rpc }, { userId: 'u1' })
    expect(a.deleted).toBe(true)
    expect(rpc).toHaveBeenCalledWith('delete_fresh_person', { p_user_id: 'u1', p_dry_run: false })
    const refused = vi.fn(async () => ({ data: null, error: { message: 'Ana has a login. Remove the login first from their desk, or archive them.' } }))
    await expect(deleteFreshPerson({ rpc: refused }, { userId: 'u1', dryRun: true })).rejects.toThrow('Ana has a login.')
    expect(refused).toHaveBeenCalledWith('delete_fresh_person', { p_user_id: 'u1', p_dry_run: true })
  })
})

type ConfirmOpts = { title: string; message: string; confirmLabel: string; danger: boolean }

describe('runFreshDelete', () => {
  const clean = { deleted: false, dry_run: true, name: 'Ana Lind', user_id: 'u1', person_id: 'p1', holds: [], removed: ['pay row'] }
  it('a clean row: dry run, the typed confirm, then the delete', async () => {
    const rpc = vi.fn(async (_fn: string, args: Record<string, unknown>) => ({ data: args.p_dry_run ? clean : { ...clean, deleted: true, dry_run: false }, error: null }))
    const confirm = vi.fn(async (_opts: ConfirmOpts) => true)
    await expect(runFreshDelete({ client: { rpc }, userId: 'u1', name: 'Ana', confirm })).resolves.toBe('deleted')
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(confirm.mock.calls[0]![0]).toMatchObject({ confirmLabel: 'Delete Ana Lind', danger: true })
    expect(rpc).toHaveBeenCalledTimes(2)
    expect(rpc).toHaveBeenLastCalledWith('delete_fresh_person', { p_user_id: 'u1', p_dry_run: false })
  })
  it('Cancel on the confirm deletes nothing', async () => {
    const rpc = vi.fn(async () => ({ data: clean, error: null }))
    const confirm = vi.fn(async () => false)
    await expect(runFreshDelete({ client: { rpc }, userId: 'u1', name: 'Ana', confirm })).resolves.toBe('cancelled')
    expect(rpc).toHaveBeenCalledTimes(1)
  })
  it('a held row: the holds are named, Archive instead opens the archive door, nothing is deleted', async () => {
    const held = { ...clean, holds: [{ table: 'clock_sessions', column: 'user_id', count: 2 }] }
    const rpc = vi.fn(async () => ({ data: held, error: null }))
    const confirm = vi.fn(async (_opts: ConfirmOpts) => true)
    const archiveInstead = vi.fn()
    await expect(runFreshDelete({ client: { rpc }, userId: 'u1', name: 'Ana', confirm, archiveInstead })).resolves.toBe('held')
    expect(confirm.mock.calls[0]![0]).toMatchObject({ title: 'Ana Lind cannot be deleted', confirmLabel: 'Archive instead' })
    expect(archiveInstead).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledTimes(1)
  })
})
