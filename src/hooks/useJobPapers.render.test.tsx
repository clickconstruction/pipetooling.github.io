// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FlowRowsKindAnswer } from '../lib/flows/boardRead'

let answer: () => Promise<FlowRowsKindAnswer> = () => Promise.resolve({})
const calls: [string | null, string | null][] = []
vi.mock('../lib/flows/flowsIo', async () => {
  const { SEED_FLOWS } = await import('../lib/flows/seed')
  return {
    loadFlowDef: (kind: 'trade' | 'customer' | 'arch') => Promise.resolve(SEED_FLOWS[kind]),
    loadFlowRowsKind: (kind: string | null, projectId: string | null) => {
      calls.push([kind, projectId])
      return answer()
    },
  }
})
const { useJobPapers } = await import('./useJobPapers')

const contact = (id: string, kind: 'trade' | 'customer' | 'arch') => ({ id, kind, off_since: null, off_why: null, off_by: null })
const ON_JOB: FlowRowsKindAnswer = {
  t1: { contact: contact('t1', 'trade'), card: { name: 'Ana Ruiz', goes_by: null, company: 'Alamo Steel', trades: ['Structural steel'], gc_company_id: 'co-1', customer_id: null }, contactJobs: [{ project_id: 'p1', is_default: true }] },
  k1: { contact: contact('k1', 'customer'), card: { name: 'Elena Marchetti', goes_by: null, company: 'Cibolo Creek Partners', trades: [], gc_company_id: null, customer_id: 'cu-1' }, contactJobs: [{ project_id: 'p1', is_default: true }] },
}

describe('useJobPapers', () => {
  beforeEach(() => {
    calls.length = 0
    answer = () => Promise.resolve(ON_JOB)
  })

  it('reads everyone on the job in one call, each kind on its flow, with the records their windows open by', async () => {
    const { result } = renderHook(() => useJobPapers('p1'))
    await waitFor(() => expect(result.current.input).not.toBeNull())
    expect(calls).toEqual([[null, 'p1']])
    expect(result.current.input?.companies.map((c) => [c.contactId, c.kind])).toEqual([
      ['t1', 'trade'],
      ['k1', 'customer'],
    ])
    expect(result.current.input?.jobId).toBe('p1')
    expect(Object.keys(result.current.input?.companies[0]?.reads ?? {})).toContain('final_waiver')
    expect(result.current.refs).toEqual({ t1: { companyId: 'co-1', customerId: null }, k1: { companyId: null, customerId: 'cu-1' } })
  })

  it('reads nothing with no job, and says so in words when the read fails', async () => {
    renderHook(() => useJobPapers(null))
    expect(calls).toEqual([])
    answer = () => Promise.reject(new Error('notAllowed'))
    const { result } = renderHook(() => useJobPapers('p1'))
    await waitFor(() => expect(result.current.error).toBe('notAllowed'))
    expect(result.current.input).toBeNull()
  })
})
