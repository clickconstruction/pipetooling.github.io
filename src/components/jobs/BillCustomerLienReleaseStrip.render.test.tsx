// @vitest-environment jsdom
/**
 * The Bill Customer strip's View and Void (v2.4569): View draws the page with the ink stored
 * at signing, as every other View does, and Void records who voided.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import BillCustomerLienReleaseStrip from './BillCustomerLienReleaseStrip'

const io = vi.hoisted(() => ({ updates: [] as Array<Record<string, unknown>>, html: [] as string[], inkAsked: [] as string[] }))
const release = {
  id: 'rel-1', job_id: 'job-1', invoice_ids: ['inv-1'], form_type: 'conditional_progress', amount: 408, through_date: '2026-09-30', signed_date: '2026-10-01',
  fields: { companyName: 'Click Plumbing', amount: '408.00' }, created_by: null, created_at: '2026-10-01T15:00:00Z', voided_at: null, status: 'signed', signer_printed_name: 'Malachi Whites',
}

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant' })
})
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => {
      const read: Record<string, unknown> = {
        select: () => read,
        eq: () => read,
        order: async () => ({ data: [release], error: null }),
        update: (patch: Record<string, unknown>) => {
          io.updates.push(patch)
          return { eq: async () => ({ data: null, error: null }) }
        },
      }
      return read
    },
  },
}))
vi.mock('../../lib/jobs/lienReleaseInk', () => ({
  lienReleaseRowSignatureWithInk: async (row: { id: string }) => {
    io.inkAsked.push(row.id)
    return { printedName: 'Malachi Whites', signedAtIso: '2026-10-01T15:00:00Z', inkDataUrl: 'data:image/png;base64,INK' }
  },
}))
vi.mock('../../lib/jobsDocuments/printWindow', () => ({
  openHtmlWindowWhenReady: async (build: () => Promise<string>) => {
    io.html.push(await build())
    return true
  },
}))

afterEach(() => {
  cleanup()
  io.updates.length = 0
  io.html.length = 0
  io.inkAsked.length = 0
})

describe('BillCustomerLienReleaseStrip', () => {
  it('View asks for the signature stored with the release and draws the page with it', async () => {
    renderWithProviders(<BillCustomerLienReleaseStrip open jobId="job-1" jobDetails={null} jobNumber="1042" />)
    fireEvent.click(await screen.findByRole('button', { name: 'View' }))
    await waitFor(() => expect(io.html).toHaveLength(1))
    expect(io.inkAsked).toEqual(['rel-1'])
    expect(io.html[0]).toContain('Malachi Whites')
  })

  it('Void records who voided', async () => {
    renderWithProviders(<BillCustomerLienReleaseStrip open jobId="job-1" jobDetails={null} jobNumber="1042" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Void' }))
    fireEvent.click(await screen.findByRole('button', { name: /^(Yes|Void it|Confirm)/ }))
    await waitFor(() => expect(io.updates).toHaveLength(1))
    expect(io.updates[0]!.voided_by).toBe('smoke-auth-user-1')
    expect(typeof io.updates[0]!.voided_at).toBe('string')
  })
})
