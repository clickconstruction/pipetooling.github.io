import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Dispatch Settings → "Jobs that don't require a note" picker: the live job
 * search (with its abort hand-off), the label lookup for already-saved ids,
 * and the one label formatter both share.
 */
type RpcCall = { fn: string; args: unknown; aborted: AbortSignal[] }
const rpcCalls: RpcCall[] = []
let supportsAbort = true
let rpcResult: { data: unknown; error: { message: string } | null } | undefined = { data: [], error: null }
vi.mock('./supabase', () => ({
  supabase: {
    rpc: (fn: string, args: unknown) => {
      const call: RpcCall = { fn, args, aborted: [] }
      rpcCalls.push(call)
      const thenable = {
        then: (resolve: (v: unknown) => void) => resolve(rpcResult),
      }
      if (!supportsAbort) return thenable
      return {
        ...thenable,
        abortSignal: (s: AbortSignal) => {
          call.aborted.push(s)
          return thenable
        },
      }
    },
  },
}))
const retryNames: string[] = []
vi.mock('../utils/errorHandling', () => ({
  withSupabaseRetry: async (op: () => Promise<{ data: unknown; error: { message: string } | null }>, name: string) => {
    retryNames.push(name)
    const r = await op()
    if (r.error) throw new Error(r.error.message)
    return r.data
  },
}))

import { fetchJobLabelsByIds, formatDispatchSettingsJobLabel, searchJobsLedgerForDispatchSettings } from './dispatchSettingsJobsSearch'

beforeEach(() => {
  rpcCalls.length = 0
  retryNames.length = 0
  supportsAbort = true
  rpcResult = { data: [], error: null }
})

describe('formatDispatchSettingsJobLabel', () => {
  it('J-number and name, number only, name only, then the untitled fallback', () => {
    expect(formatDispatchSettingsJobLabel('1842', 'Riverside rough-in')).toBe('J1842 · Riverside rough-in')
    expect(formatDispatchSettingsJobLabel('1842', null)).toBe('J1842')
    expect(formatDispatchSettingsJobLabel(null, 'Riverside rough-in')).toBe('Riverside rough-in')
    expect(formatDispatchSettingsJobLabel(null, null)).toBe('(untitled job)')
    expect(formatDispatchSettingsJobLabel('  ', '   ')).toBe('(untitled job)')
  })
  it('a Click-only job keeps its number; a blank HCP number falls through to the Click number; whitespace is trimmed', () => {
    expect(formatDispatchSettingsJobLabel(null, 'Elm', 'C-77')).toBe('JC-77 · Elm')
    expect(formatDispatchSettingsJobLabel(' ', null, ' C-77 ')).toBe('JC-77')
    expect(formatDispatchSettingsJobLabel(' 1842 ', '  Elm  ', 'C-77')).toBe('J1842 · Elm')
  })
})

describe('searchJobsLedgerForDispatchSettings', () => {
  const signal = new AbortController().signal

  it('a blank or whitespace query returns nothing without calling the RPC', async () => {
    expect(await searchJobsLedgerForDispatchSettings('', signal)).toEqual([])
    expect(await searchJobsLedgerForDispatchSettings('   ', signal)).toEqual([])
    expect(rpcCalls).toEqual([])
  })

  it('calls search_jobs_ledger with the trimmed text, hands the abort signal to the request, and maps each row to a chip option with the raw search row', async () => {
    rpcResult = {
      data: [
        { id: 'j1', hcp_number: '1842', click_number: null, job_name: 'Riverside', job_address: '1 Main St', service_type_id: 'st1', service_type_name: 'Rough-in' },
        { id: 'j2', hcp_number: null, click_number: 'C-9', job_name: null },
      ],
      error: null,
    }
    const r = await searchJobsLedgerForDispatchSettings('  river ', signal)
    expect(rpcCalls).toHaveLength(1)
    expect(rpcCalls[0]!.fn).toBe('search_jobs_ledger')
    expect(rpcCalls[0]!.args).toEqual({ search_text: 'river' })
    expect(rpcCalls[0]!.aborted).toEqual([signal])
    expect(r).toEqual([
      {
        value: 'j1',
        label: 'J1842 · Riverside',
        row: { source: 'job', id: 'j1', hcp_number: '1842', click_number: null, job_name: 'Riverside', job_address: '1 Main St', service_type_id: 'st1', service_type_name: 'Rough-in' },
      },
      {
        value: 'j2',
        label: 'JC-9',
        row: { source: 'job', id: 'j2', hcp_number: '', click_number: 'C-9', job_name: '', job_address: '', service_type_id: null, service_type_name: null },
      },
    ])
    expect(retryNames).toEqual([]) // the live search is not retried: a stale keystroke should fail fast
  })

  it('a runtime whose query has no abortSignal still searches', async () => {
    supportsAbort = false
    rpcResult = { data: [{ id: 'j1', hcp_number: '1', click_number: null, job_name: 'A' }], error: null }
    expect((await searchJobsLedgerForDispatchSettings('a', signal)).map((o) => o.value)).toEqual(['j1'])
    expect(rpcCalls[0]!.aborted).toEqual([])
  })

  it('null data reads as no matches; an RPC error (including an aborted request) is thrown with its message', async () => {
    rpcResult = { data: null, error: null }
    expect(await searchJobsLedgerForDispatchSettings('a', signal)).toEqual([])
    rpcResult = { data: null, error: { message: 'AbortError: The user aborted a request.' } }
    await expect(searchJobsLedgerForDispatchSettings('a', signal)).rejects.toThrow('AbortError: The user aborted a request.')
    rpcResult = undefined
    expect(await searchJobsLedgerForDispatchSettings('a', signal)).toEqual([])
  })
})

describe('fetchJobLabelsByIds', () => {
  it('no ids → an empty map without a read', async () => {
    expect(await fetchJobLabelsByIds([])).toEqual(new Map())
    expect(rpcCalls).toEqual([])
  })

  it('reads get_jobs_ledger_by_ids through the retry wrapper and labels every returned row', async () => {
    rpcResult = {
      data: [
        { id: 'j1', hcp_number: '1842', click_number: null, job_name: 'Riverside' },
        { id: 'j2', hcp_number: null, click_number: null, job_name: null },
      ],
      error: null,
    }
    const map = await fetchJobLabelsByIds(['j1', 'j2', 'j3'])
    expect(rpcCalls).toEqual([{ fn: 'get_jobs_ledger_by_ids', args: { p_job_ids: ['j1', 'j2', 'j3'] }, aborted: [] }])
    expect(retryNames).toEqual(['fetch_dispatch_settings_job_labels_by_ids'])
    expect([...map]).toEqual([
      ['j1', 'J1842 · Riverside'],
      ['j2', '(untitled job)'],
    ]) // j3 is simply absent: the caller falls back for unknown ids
  })

  it('null rows read as an empty map; a failed read throws', async () => {
    rpcResult = { data: null, error: null }
    expect(await fetchJobLabelsByIds(['j1'])).toEqual(new Map())
    rpcResult = { data: null, error: { message: 'permission denied' } }
    await expect(fetchJobLabelsByIds(['j1'])).rejects.toThrow('permission denied')
  })
})
