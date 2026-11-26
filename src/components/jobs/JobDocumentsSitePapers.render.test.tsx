// @vitest-environment jsdom
/**
 * A job's Documents tab, Papers for this site (punch list #439, piece 3): the papers outside companies were sent for
 * the place the job is at, read by its address key, by a spelling answered Same place and by its development. The
 * section is drawn only when there is one, reads for the roles a company's papers are listed for, and says so when
 * the read fails. Every name and address here is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { JobDocumentsSitePapers } from './JobDocumentsSitePapers'

const QUARRY = '118 Old Quarry Trl, Sampleton, TX'
const KEY_QUARRY = '118 old quarry trail sampleton tx'
const KEY_BARN = '118 old quarry trail barn sampleton tx'

const io = vi.hoisted(() => ({
  role: 'assistant' as string,
  byKey: [] as unknown[],
  byDevelopment: [] as unknown[],
  fail: null as unknown,
  answers: [] as unknown[],
  /** Each read of the papers, as the filters it asked with. */
  asked: [] as string[],
}))
vi.mock('../../hooks/useAuth', () => {
  const auth = () => ({ role: io.role, readOnly: false, user: { id: 'u1' } })
  return { useAuth: auth, useOptionalAuth: auth }
})
vi.mock('../../hooks/useAddressLookAlikes', () => ({ readAnswers: async () => io.answers }))
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      let how = table
      let rows: unknown[] = []
      const chain = {
        select: () => chain,
        in: (column: string, values: string[]) => {
          how += ` in ${column} [${[...values].sort().join(' | ')}]`
          rows = io.byKey
          return chain
        },
        eq: (column: string, value: string) => {
          how += ` eq ${column} ${value}`
          rows = io.byDevelopment
          return chain
        },
        not: (column: string, op: string, value: unknown) => {
          how += ` not ${column} ${op} ${String(value)}`
          return chain
        },
        limit: async () => {
          io.asked.push(how)
          return io.fail ? { data: null, error: io.fail } : { data: rows, error: null }
        },
      }
      return chain
    },
  },
}))

const paper = (id: string, p: Record<string, unknown> = {}) => ({
  id,
  document_name: 'Vendor NDA',
  doc_type: 'agreement',
  status: 'sent',
  party_contact_id: 'k1',
  party_name: 'Tallgrass Supply Co.',
  signer_name: 'Lena Park',
  signer_title: 'Branch manager',
  signer_printed_name: null,
  signed_at: null,
  sent_at: '2026-11-20T15:00:00Z',
  created_at: '2026-11-20T14:00:00Z',
  signer_last_viewed_at: null,
  supersedes_person_contract_document_id: null,
  site_address_key: KEY_QUARRY,
  site_address: QUARRY,
  site_development_id: null,
  ...p,
})
const JOB = { job_address: QUARRY, development_id: 'd1' }

beforeEach(() => {
  io.role = 'assistant'
  io.byKey = []
  io.byDevelopment = []
  io.fail = null
  io.answers = []
  io.asked = []
})
afterEach(() => cleanup())

describe('Job Documents · Papers for this site', () => {
  it('lists the site’s papers, the ones still to sign first, with the count', async () => {
    io.byKey = [paper('signed', { status: 'signed', signed_at: '2026-11-12', party_name: 'Sample Well Drilling', signer_name: 'Rae Sample', signer_title: null }), paper('waiting')]
    io.byDevelopment = [paper('dev', { party_name: 'Example Pipe & Valve', sent_at: '2026-11-22T15:00:00Z', site_address_key: null, site_address: null, site_development_id: 'd1' })]
    renderWithProviders(<JobDocumentsSitePapers job={JOB} />)
    const rows = await screen.findAllByTestId('job-site-paper-row')
    expect(screen.getByRole('heading', { name: 'Papers for this site' })).toBeTruthy()
    expect(rows.map((r) => r.textContent)).toEqual([
      'Example Pipe & ValveVendor NDA · Lena Park signs, Branch managernever openedSent Nov 22',
      'Tallgrass Supply Co.Vendor NDA · Lena Park signs, Branch managernever openedSent Nov 20',
      'Sample Well DrillingVendor NDA · signed by Rae Samplesigned ✓Signed Nov 12',
    ])
    expect(screen.getByTestId('job-site-papers-count').textContent).toBe('1 of 3 papers signed.')
    expect(io.asked.sort()).toEqual([
      'person_contract_documents eq site_development_id d1 not party_contact_id is null',
      `person_contract_documents in site_address_key [${KEY_QUARRY}] not party_contact_id is null`,
    ])
  })

  it('reads a spelling answered Same place as the same site', async () => {
    io.answers = [{ keyA: KEY_BARN, keyB: KEY_QUARRY, same: true, byName: 'Cora Sample', at: '2026-11-24T15:00:00Z' }]
    io.byKey = [paper('at-barn', { site_address_key: KEY_BARN, site_address: '118 Old Quarry Trl Barn, Sampleton, TX' })]
    renderWithProviders(<JobDocumentsSitePapers job={{ job_address: QUARRY, development_id: null }} />)
    expect(await screen.findAllByTestId('job-site-paper-row')).toHaveLength(1)
    expect(io.asked).toEqual([`person_contract_documents in site_address_key [${KEY_BARN} | ${KEY_QUARRY}] not party_contact_id is null`])
  })

  it('draws nothing for a site with no paper, and asks nothing for a job with no address and no development', async () => {
    renderWithProviders(<JobDocumentsSitePapers job={JOB} />)
    await waitFor(() => expect(io.asked).toHaveLength(2))
    expect(screen.queryByTestId('job-site-papers')).toBeNull()
    cleanup()
    io.asked = []
    renderWithProviders(<JobDocumentsSitePapers job={{ job_address: '  ', development_id: null }} />)
    await new Promise((r) => setTimeout(r, 30))
    expect(io.asked).toEqual([])
    expect(screen.queryByTestId('job-site-papers')).toBeNull()
  })

  it('reads for the office and the estimator, and for nobody else', async () => {
    io.byKey = [paper('waiting')]
    io.role = 'estimator'
    renderWithProviders(<JobDocumentsSitePapers job={JOB} />)
    expect(await screen.findAllByTestId('job-site-paper-row')).toHaveLength(1)
    cleanup()
    io.asked = []
    io.role = 'subcontractor'
    renderWithProviders(<JobDocumentsSitePapers job={JOB} />)
    await new Promise((r) => setTimeout(r, 30))
    expect(io.asked).toEqual([])
    expect(screen.queryByTestId('job-site-papers')).toBeNull()
  })

  it('a read that is refused says why under the heading', async () => {
    io.fail = { message: 'permission denied for table person_contract_documents', code: '42501' }
    renderWithProviders(<JobDocumentsSitePapers job={JOB} />)
    const section = await screen.findByTestId('job-site-papers')
    expect(section.textContent).toContain('Papers for this site')
    // A refusal reads as its class, in the panel's own words.
    expect(section.textContent).toContain('Couldn’t read the papers for this site.')
    expect(section.textContent).toContain('You don\'t have access to this record.')
    expect(screen.queryAllByTestId('job-site-paper-row')).toEqual([])
  })
})
