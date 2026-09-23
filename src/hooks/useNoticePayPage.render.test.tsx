// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useNoticePayPage } from './useNoticePayPage'

const fetchMock = vi.fn()
vi.mock('../lib/fetchJobWithDetailsById', () => ({ fetchJobWithDetailsById: (id: string) => fetchMock(id) }))
vi.mock('../lib/jobs/noticeInvoiceEnclosure', () => ({
  noticeInvoiceDocs: (job: { id: string }) => (job.id === 'j-billed' ? [{ invoiceId: 'inv-1', title: 'Invoice #1, May 5, 2026', doc: {}, stripeInvoiceId: 'in_1', openAmount: 350, description: 'Trip charge.' }] : []),
}))
vi.mock('../lib/jobs/lienNoticePayPageAssets', () => ({ buildPayPageAssets: async () => ({ 'inv-1': { svg: '<svg data-code></svg>', png: null } }) }))

describe('useNoticePayPage', () => {
  it('loads the rows and codes for a job once, and answers empty for a job with no unpaid bill', async () => {
    fetchMock.mockImplementation(async (id: string) => ({ id }))
    const { result, rerender } = renderHook(({ id }: { id: string | null }) => useNoticePayPage(id), { initialProps: { id: 'j-billed' } })
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.rows).toEqual([{ invoiceId: 'inv-1', label: 'Invoice #1, May 5, 2026', description: 'Trip charge.', openAmount: 350, payable: true }])
    expect(result.current.assets['inv-1']?.svg).toContain('<svg')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    rerender({ id: 'j-empty' })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.rows).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(2)

    // Back to the first job: from the cache, no third fetch.
    rerender({ id: 'j-billed' })
    await waitFor(() => expect(result.current.rows.length).toBe(1))
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('answers empty while disabled or without a job, and never fetches', async () => {
    fetchMock.mockClear()
    const { result } = renderHook(() => useNoticePayPage(null))
    expect(result.current).toEqual({ rows: [], assets: {}, loading: false })
    const off = renderHook(() => useNoticePayPage('j-billed', false))
    expect(off.result.current.rows).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
