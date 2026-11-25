// @vitest-environment jsdom
/**
 * A job's On site section says *No containers on this site yet* only once the read is in (punch list #398). It
 * drew the empty words, with **Add a container**, while the boxes were still being read and after a read failed.
 * On a site that has boxes that press is the harm. Every name is made up.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { ReservedRunPrint } from '../../lib/materials/reservedPrint'

type Box = { id: string; jobId: string; label: string; kind: string; where: string; said?: string; locationId: null; lat: null; lng: null; retiredAt: string | null; createdAt: string }
const data = vi.hoisted(() => ({ boxes: [] as Box[] }))
const held = vi.hoisted(() => ({ reserved: { count: 0, runs: 0, span: '', names: [] as string[], anyNamed: false, printedByName: '', printedAt: '', mark: { printed: 0, waiting: 0, unknown: 0 } }, toPrint: [] as ReservedRunPrint[], mint: vi.fn() }))
const movements: never[] = []
const READ = { loaded: true, loading: false, error: null as string | null, raw: null as unknown }
const jobLoad = vi.hoisted(() => ({ state: { loaded: true, loading: false, error: null as string | null, raw: null as unknown } }))

vi.mock('../../lib/materials/onSiteStore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/materials/onSiteStore')>()),
  jobIdsWithData: () => ['ja'],
  listContainers: () => data.boxes,
  listMovements: () => movements,
  listPlaces: () => [],
  listPhotos: () => [],
  serverSummary: () => null,
  jobLedgerCapped: () => false,
  loadJob: () => Promise.resolve(),
  loadBookPrices: async () => {},
  jobLoadState: () => ({ loaded: true, loading: false, error: null, raw: null }),
}))
vi.mock('../../hooks/useOnSiteStore', () => ({
  useOnSiteDesk: () => ({ loaded: true, loading: false, error: null, raw: null, retry: () => {} }),
  useOnSiteJob: () => ({ ...jobLoad.state, retry: () => {} }),
  useOnSiteStoreVersion: () => 0,
}))
vi.mock('../../hooks/useOnSiteSites', () => ({ useOnSiteSites: () => ({ siteOfJob: new Map(), siteNames: new Map(), loaded: true, failed: null, retry: () => {} }) }))
vi.mock('../../hooks/useSiteBoxNames', () => ({ useSiteBoxNames: () => ({ rows: [], siteId: null, loaded: true }) }))
vi.mock('../../hooks/useJobStickers', () => ({ useJobStickers: () => ({ byBox: new Map(), marksByBox: new Map(), blank: held.reserved.count, reserved: held.reserved, toPrint: held.toPrint, loaded: true, refresh: () => {} }) }))
vi.mock('../../lib/materials/stickerRunsIo', () => ({ fetchSiteStickerNames: vi.fn(async () => ({ boxes: [], blankNames: held.reserved.names })), fetchStickerRuns: vi.fn(async () => []), mintStickerRun: held.mint }))
vi.mock('../../hooks/usePartTies', () => ({ usePartTies: () => ({ ties: [], available: false, failed: null, retry: () => {}, answer: async () => {}, undo: async () => {} }) }))
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant', user: { id: 'u1', email: 'office@example.com' }, profileName: 'Sam' })
})

import JobsMaterialsTab, { type MaterialsPrintSheetDoor } from './JobsMaterialsTab'

const jobs = [{ id: 'ja', hcp_number: '', click_number: '1111', job_name: 'ZZ Test bio walk', job_address: null, google_drive_link: null }]

const open = (over: { phone?: boolean; role?: string | null; printSheet?: MaterialsPrintSheetDoor } = {}) =>
  renderWithProviders(<JobsMaterialsTab jobs={jobs} byUserId="u1" byName="Sam" onOpenJobDetail={() => {}} driveBackfill={false} role={over.role ?? 'assistant'} phone={over.phone ?? true} printSheet={over.printSheet} />, { route: '/materials?tab=on-site&job=ja' })

afterEach(() => {
  cleanup()
  jobLoad.state = { ...READ }
})

const emptyWords = () => document.querySelector('[data-testid="materials-empty-job"]')

describe('A job’s On site section and its empty words', () => {
  for (const phone of [true, false]) {
    const where = phone ? 'on a phone' : 'at a desk'
    it(`says the job is empty, with Add a container, once the read is in (${where})`, () => {
      data.boxes = []
      open({ phone })
      expect(emptyWords()?.textContent).toContain('No containers on this site yet.')
      expect(within(emptyWords() as HTMLElement).getByRole('button', { name: 'Add a container' })).toBeTruthy()
    })

    it(`draws only the loading line while the boxes are read (${where})`, () => {
      data.boxes = []
      jobLoad.state = { loaded: false, loading: true, error: null, raw: null }
      open({ phone })
      expect(screen.getByText('Loading the boxes…')).toBeTruthy()
      expect(emptyWords()).toBeNull()
      expect(document.body.textContent).not.toContain('No containers on this site yet.')
    })

    it(`draws the failure and no empty words after a read failed (${where})`, () => {
      data.boxes = []
      jobLoad.state = { loaded: false, loading: false, error: 'The boxes on this job did not load.', raw: { message: 'TypeError: Failed to fetch' } }
      open({ phone })
      // A lost signal's own words, on the retry panel.
      expect(document.body.textContent).toContain('No connection')
      expect(emptyWords()).toBeNull()
      expect(document.body.textContent).not.toContain('No containers on this site yet.')
    })
  }
})
