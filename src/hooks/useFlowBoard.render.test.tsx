// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FlowRowsKindAnswer } from '../lib/flows/boardRead'

/** The read, answered by the test: a plain function, so a rejection is the hook's to catch and no spy's. */
let answer: () => Promise<FlowRowsKindAnswer> = () => Promise.resolve({})
const calls: [string, string | null][] = []
vi.mock('../lib/flows/flowsIo', async () => {
  const { SEED_FLOWS } = await import('../lib/flows/seed')
  return {
    loadFlowDef: (kind: 'trade' | 'customer') => Promise.resolve(SEED_FLOWS[kind]),
    loadFlowRowsKind: (kind: string, projectId: string | null) => {
      calls.push([kind, projectId])
      return answer()
    },
  }
})

const { useFlowBoard } = await import('./useFlowBoard')

const contact = (id: string) => ({ id, kind: 'trade' as const, off_since: null, off_why: null, off_by: null })
const ANSWER: FlowRowsKindAnswer = {
  c1: { contact: contact('c1'), card: { name: 'Dan Ruiz', goes_by: null, company: 'Rio Paving', trades: ['Paving'], gc_company_id: 'co-1', customer_id: null } },
  c2: { contact: contact('c2'), card: { name: 'Ana Ruiz', goes_by: null, company: 'Alamo Steel', trades: ['Structural steel'], gc_company_id: 'co-2', customer_id: null } },
}

describe('useFlowBoard', () => {
  beforeEach(() => {
    calls.length = 0
    answer = () => Promise.resolve(ANSWER)
  })

  it('reads one kind’s board from the definer’s answer, with the boards’ context', async () => {
    const { result } = renderHook(() => useFlowBoard('trade'))
    await waitFor(() => expect(result.current.read).not.toBeNull())
    expect(calls).toEqual([['trade', null]])
    expect(result.current.read?.companies.map((c) => c.name)).toEqual(['Alamo Steel', 'Rio Paving'])
    expect(result.current.ctx).toMatchObject({ flow: { kind: 'trade' }, firstNames: { c1: 'Dan', c2: 'Ana' }, usual: { papers: 3, ask: 6 } })
    expect(result.current.error).toBeNull()
  })

  it('reads only one job’s people for the papers window, and reads again on refresh', async () => {
    const { result } = renderHook(() => useFlowBoard('customer', { projectId: 'p1' }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(calls).toEqual([['customer', 'p1']])
    act(() => result.current.refresh())
    await waitFor(() => expect(calls).toHaveLength(2))
  })

  it('says so in words when the read fails, and reads nothing while not enabled', async () => {
    answer = () => Promise.reject(new Error('notAllowed'))
    const { result } = renderHook(() => useFlowBoard('trade'))
    await waitFor(() => expect(result.current.error).toBe('notAllowed'))
    expect(result.current.read).toBeNull()
    calls.length = 0
    renderHook(() => useFlowBoard('trade', { enabled: false }))
    expect(calls).toEqual([])
  })
})
