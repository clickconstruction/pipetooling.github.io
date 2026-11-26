// @vitest-environment jsdom
/**
 * A development's page, Papers for this site (punch list #439, piece 3): the papers outside companies hold for the
 * development or for the address of a job or a bid in it. Asked by every address's key, forty a request, and by the
 * development. Drawn only when there is one, for the roles a company's papers are listed for. Every name and address
 * here is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { DevelopmentSitePapers } from './DevelopmentSitePapers'

const QUARRY = '118 Old Quarry Trl, Sampleton, TX'
const COVE = '801 Magnolia Cove, Exampleville, TX'
const KEY_QUARRY = '118 old quarry trail sampleton tx'
const KEY_COVE = '801 magnolia cove exampleville tx'

const io = vi.hoisted(() => ({
  role: 'assistant' as string,
  byKey: [] as unknown[],
  byDevelopment: [] as unknown[],
  fail: null as unknown,
  /** Each read of the papers, as the filter it asked with. */
  asked: [] as string[],
}))
vi.mock('../../hooks/useAuth', () => {
  const auth = () => ({ role: io.role, readOnly: false, user: { id: 'u1' } })
  return { useAuth: auth, useOptionalAuth: auth }
})
vi.mock('../../hooks/useAddressLookAlikes', () => ({ readAnswers: async () => [] }))
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      let how = table
      let rows: unknown[] = []
      const chain = {
        select: () => chain,
        in: (column: string, values: string[]) => {
          how += ` in ${column} ${values.length}`
          rows = io.byKey
          return chain
        },
        eq: (column: string, value: string) => {
          how += ` eq ${column} ${value}`
          rows = io.byDevelopment
          return chain
        },
        not: () => chain,
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

beforeEach(() => {
  io.role = 'assistant'
  io.byKey = []
  io.byDevelopment = []
  io.fail = null
  io.asked = []
})
afterEach(() => cleanup())

describe('Development page · Papers for this site', () => {
  it('lists the papers that name a job’s address in it and the ones that name the development', async () => {
    io.byKey = [paper('at-quarry'), paper('at-cove', { party_name: 'Example Pipe & Valve', site_address_key: KEY_COVE, site_address: COVE, sent_at: '2026-11-22T15:00:00Z' }), paper('away', { site_address_key: 'somewhere else' })]
    io.byDevelopment = [paper('named', { party_name: 'Sample Well Drilling', status: 'signed', signed_at: '2026-11-12', signer_name: 'Rae Sample', signer_title: null, site_address_key: null, site_address: null, site_development_id: 'd1' })]
    renderWithProviders(<DevelopmentSitePapers developmentId="d1" addresses={[QUARRY, COVE, null, QUARRY]} />)
    const rows = await screen.findAllByTestId('development-site-paper-row')
    expect(screen.getByRole('heading', { name: 'Papers for this site' })).toBeTruthy()
    expect(rows.map((r) => r.textContent)).toEqual([
      'Example Pipe & ValveVendor NDA · Lena Park signs, Branch managernever openedSent Nov 22',
      'Tallgrass Supply Co.Vendor NDA · Lena Park signs, Branch managernever openedSent Nov 20',
      'Sample Well DrillingVendor NDA · signed by Rae Samplesigned ✓Signed Nov 12',
    ])
    expect(screen.getByTestId('development-site-papers').textContent).toContain('Papers outside companies were sent for this development, or for a job in it.')
    expect(screen.getByTestId('development-site-papers-count').textContent).toBe('1 of 3 papers signed.')
    // Two addresses, one request for their keys, and one for the development.
    expect(io.asked.sort()).toEqual(['person_contract_documents eq site_development_id d1', 'person_contract_documents in site_address_key 2'])
  })

  it('asks a long list of addresses forty keys at a time', async () => {
    renderWithProviders(<DevelopmentSitePapers developmentId="d1" addresses={Array.from({ length: 95 }, (_, i) => `${i + 1} Lot Ln, Sampleton, TX`)} />)
    await waitFor(() => expect(io.asked).toHaveLength(4))
    expect(io.asked.sort()).toEqual(['person_contract_documents eq site_development_id d1', 'person_contract_documents in site_address_key 15', 'person_contract_documents in site_address_key 40', 'person_contract_documents in site_address_key 40'])
  })

  it('draws nothing for a site with no paper, and reads nothing for a role that reads no company’s papers', async () => {
    renderWithProviders(<DevelopmentSitePapers developmentId="d1" addresses={[QUARRY]} />)
    await waitFor(() => expect(io.asked).toHaveLength(2))
    expect(screen.queryByTestId('development-site-papers')).toBeNull()
    cleanup()
    io.asked = []
    io.role = 'subcontractor'
    io.byKey = [paper('at-quarry')]
    renderWithProviders(<DevelopmentSitePapers developmentId="d1" addresses={[QUARRY]} />)
    await new Promise((r) => setTimeout(r, 30))
    expect(io.asked).toEqual([])
    expect(screen.queryByTestId('development-site-papers')).toBeNull()
  })

  it('a development with no address still reads the papers that name it', async () => {
    io.byDevelopment = [paper('named', { site_address_key: null, site_address: null, site_development_id: 'd1' })]
    renderWithProviders(<DevelopmentSitePapers developmentId="d1" addresses={[]} />)
    expect(await screen.findAllByTestId('development-site-paper-row')).toHaveLength(1)
    expect(io.asked).toEqual(['person_contract_documents eq site_development_id d1'])
  })

  it('a read that is refused says so under the heading', async () => {
    io.fail = { message: 'permission denied for table person_contract_documents', code: '42501' }
    renderWithProviders(<DevelopmentSitePapers developmentId="d1" addresses={[QUARRY]} />)
    const section = await screen.findByTestId('development-site-papers')
    expect(section.textContent).toContain('Couldn’t read the papers for this site.')
    expect(screen.queryAllByTestId('development-site-paper-row')).toEqual([])
  })
})
