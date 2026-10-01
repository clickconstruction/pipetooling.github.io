import { describe, expect, it, vi } from 'vitest'

vi.mock('../combinePeople', () => ({
  previewCombinePeople: vi.fn(async () => ({ lines: [{ table: 'people_hours', nameRows: 3, idRows: 1 }, { table: 'person_offsets', nameRows: 0, idRows: 0 }], laborSheets: 2 })),
  executeCombinePeople: vi.fn(async () => ({ renamedRows: 3, repointedRows: 1, sheetsRewritten: 2, accountMoved: false })),
}))

import { previewAccountMerge, previewExternalMerge, runAccountMerge, runExternalMerge } from './accountMerge'
import { executeCombinePeople } from '../combinePeople'

function fakeClient(opts: { invoke?: (name: string, body: unknown) => { data: unknown; error: unknown }; rosterRows?: unknown[] } = {}) {
  const updates: Array<{ table: string; patch: unknown; eq: unknown[] }> = []
  const client = {
    functions: { invoke: vi.fn(async (name: string, o: { body: unknown }) => opts.invoke?.(name, o.body) ?? { data: { success: true }, error: null }) },
    from(table: string) {
      const b: Record<string, unknown> = {}
      let patch: unknown = null
      for (const op of ['select', 'is', 'order', 'limit']) b[op] = () => b
      b.eq = (...args: unknown[]) => {
        if (patch) updates.push({ table, patch, eq: args })
        return b
      }
      b.update = (p: unknown) => {
        patch = p
        return b
      }
      b.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: patch ? null : (opts.rosterRows ?? []), error: null }).then(ok)
      return b
    },
  }
  return { client: client as never, updates, invoke: client.functions.invoke }
}

const KEEP = { id: 'u-keep', name: 'Behar', email: 'behar@x.com' }

describe('folding a duplicate login into the account you keep', () => {
  it('a preview is a dry run of merge-users and changes nothing', async () => {
    const { client, invoke } = fakeClient({ invoke: () => ({ data: { success: true, moved: { clock_sessions: 4 }, warnings: ['heads up'] }, error: null }) })
    expect(await previewAccountMerge(client, { survivorId: 'u-keep', absorbedId: 'u-dup' })).toEqual({ moved: { clock_sessions: 4 }, warnings: ['heads up'] })
    expect(invoke).toHaveBeenCalledWith('merge-users', { body: { survivor_user_id: 'u-keep', absorbed_user_id: 'u-dup', dry_run: true } })
  })

  it('the merge itself is the same call without the dry run, and a refusal comes back as words', async () => {
    const ok = fakeClient()
    await runAccountMerge(ok.client, { survivorId: 'u-keep', absorbedId: 'u-dup' })
    expect(ok.invoke).toHaveBeenCalledWith('merge-users', { body: { survivor_user_id: 'u-keep', absorbed_user_id: 'u-dup', dry_run: false } })
    const no = fakeClient({ invoke: () => ({ data: { success: false, error: 'Both accounts must have the same role' }, error: null }) })
    await expect(runAccountMerge(no.client, { survivorId: 'u-keep', absorbedId: 'u-dup' })).rejects.toThrow('Both accounts must have the same role')
  })
})

describe('folding a roster row with no login into a sub account', () => {
  it('with no roster row of its own, the account takes this one as its entry: a link, nothing moves', async () => {
    const { client, updates } = fakeClient({ rosterRows: [] })
    const preview = await previewExternalMerge(client, { survivor: KEEP, person: { id: 'p-ext', name: 'Behar Crew' } })
    expect(preview.moved).toEqual({})
    expect(preview.warnings[0]).toContain('will simply be linked')
    expect(await runExternalMerge(client, { survivor: KEEP, person: { id: 'p-ext', name: 'Behar Crew' } })).toContain('Linked Behar Crew')
    expect(updates).toEqual([{ table: 'people', patch: { account_user_id: 'u-keep' }, eq: ['id', 'p-ext'] }])
  })

  it('with a roster row, the combine engine folds the records onto it', async () => {
    const { client, updates } = fakeClient({ rosterRows: [{ id: 'p-keep', name: 'Behar', account_user_id: 'u-keep' }] })
    const preview = await previewExternalMerge(client, { survivor: KEEP, person: { id: 'p-ext', name: 'Behar Crew' } })
    expect(preview.moved).toEqual({ people_hours: 3, 'sub sheets (assigned names)': 2 })
    const line = await runExternalMerge(client, { survivor: KEEP, person: { id: 'p-ext', name: 'Behar Crew' } })
    expect(line).toBe('Merged Behar Crew into Behar: 3 rows renamed, 1 repointed, 2 sheets updated. External row archived.')
    expect(vi.mocked(executeCombinePeople)).toHaveBeenCalledWith({ source: { id: 'p-ext', name: 'Behar Crew', account_user_id: null }, target: { id: 'p-keep', name: 'Behar', account_user_id: 'u-keep' } })
    expect(updates).toEqual([])
  })
})
